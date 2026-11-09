import { createHash } from 'node:crypto';
import { extractFundingRound } from '../ai/extract';
import { getProvider } from '../ai/registry';
import { getBus, Topics } from '../events';
import { logger } from '../logger';
import { formatUsd, hostnameOf, normalizeName, slugify } from '../lib/text';
import { Company, FundingRound, Source, type RoundType } from '../models';
import { recomputeCompanyMetrics } from '../services/funding';
import { absoluteUrl, batchShort } from './connectors/yc';
import type { FormDRecord, GithubOrgRecord, RawRecord, RssItemRecord, YcCompanyRecord } from './types';

/**
 * Consumer for the raw ingest topic: normalise → upsert into MongoDB → emit domain events.
 * Every write is an idempotent upsert keyed by a natural id, so replaying the topic
 * (Kafka offset reset, Redis pending re-delivery) never creates duplicates.
 */
export async function processRawRecord(record: RawRecord): Promise<void> {
  switch (record.connector) {
    case 'yc':
      return processYc(record.data);
    case 'sec_form_d':
      return processFormD(record.data);
    case 'rss':
      return processRss(record.data);
    case 'github':
      return processGithub(record.data);
    default:
      logger.warn({ record }, 'unknown connector');
  }
}

const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 32);

function parseLocation(loc: string | null): { city: string | null; region: string | null; country: string | null } {
  if (!loc) return { city: null, region: null, country: null };
  const first = loc.split(';')[0].split(',').map((s) => s.trim()).filter(Boolean);
  if (first.length === 0) return { city: null, region: null, country: null };
  const country = first.length >= 2 ? first[first.length - 1] : null;
  return { city: first[0] ?? null, region: first.length >= 3 ? first[1] : null, country: country === 'USA' ? 'United States' : country };
}

async function upsertSource(doc: {
  kind: string;
  url: string;
  title: string;
  publisher: string;
  publishedAt: Date | null;
  excerpt: string;
  companyId?: unknown;
  metadata?: Record<string, unknown>;
}) {
  return Source.findOneAndUpdate(
    { url: doc.url },
    {
      $set: {
        kind: doc.kind,
        title: doc.title,
        publisher: doc.publisher,
        publishedAt: doc.publishedAt,
        excerpt: doc.excerpt.slice(0, 8000),
        contentHash: hash(doc.excerpt),
        retrievedAt: new Date(),
        metadata: doc.metadata ?? {},
      },
      ...(doc.companyId ? { $addToSet: { companyIds: doc.companyId } } : {}),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

/* ------------------------------------------------------------------ YC */

async function uniqueSlug(base: string, ycId: string): Promise<string> {
  const existing = await Company.findOne({ slug: base }).select('externalIds.yc').lean();
  if (!existing || existing.externalIds?.yc === ycId) return base;
  return `${base}-${ycId}`;
}

export async function processYc(r: YcCompanyRecord) {
  const slug = await uniqueSlug(slugify(r.slug || r.name), r.ycId);
  const short = batchShort(r.batch);
  const before = await Company.findOne({ 'externalIds.yc': r.ycId }).select('_id trackedSectors').lean();

  const company = await Company.findOneAndUpdate(
    { 'externalIds.yc': r.ycId },
    {
      $set: {
        name: r.name,
        website: r.website,
        domain: hostnameOf(r.website),
        oneLiner: r.oneLiner.slice(0, 300),
        description: r.description.slice(0, 5000),
        logoUrl: absoluteUrl(r.logoUrl),
        teamSize: r.teamSize,
        status: r.status,
        tags: r.tags,
        ycBatch: short,
        ycBatchDate: r.batchDate ? new Date(r.batchDate) : null,
        hq: parseLocation(r.location),
        foundedYear: r.batchDate ? new Date(r.batchDate).getUTCFullYear() : null,
      },
      $setOnInsert: { slug, 'externalIds.yc': r.ycId },
      $addToSet: { trackedSectors: { $each: r.sectors } },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const source = await upsertSource({
    kind: 'yc_directory',
    url: r.profileUrl,
    title: `${r.name} — Y Combinator company profile`,
    publisher: 'Y Combinator (public directory)',
    publishedAt: r.batchDate ? new Date(r.batchDate) : null,
    excerpt: [
      `${r.name} (YC ${short ?? 'n/a'}): ${r.oneLiner}`,
      r.location ? `Location: ${r.location}.` : '',
      r.teamSize !== null ? `Team size listed in the YC directory: ${r.teamSize}.` : '',
      `Status in the YC directory: ${r.status}.`,
      r.description ? `Description: ${r.description.slice(0, 1200)}` : '',
      `Retrieved ${r.retrievedAt.slice(0, 10)}.`,
    ]
      .filter(Boolean)
      .join(' '),
    companyId: company._id,
    metadata: { batch: r.batch, tags: r.tags, industries: r.industries },
  });

  // YC participation as an accelerator round. YC's standard deal has changed over time,
  // so the amount is recorded as undisclosed rather than guessed.
  if (r.batchDate) {
    await FundingRound.updateOne(
      { dedupeKey: `yc:${r.ycId}` },
      {
        $set: { companyId: company._id, companySlug: company.slug, date: new Date(r.batchDate), roundType: 'accelerator', sourceIds: [source._id] },
        $setOnInsert: { amountUsd: null, investors: ['Y Combinator'], extractedBy: 'yc-directory', confidence: 1, notes: `Y Combinator ${r.batch}` },
      },
      { upsert: true },
    );
    await recomputeCompanyMetrics(company._id);
  }

  if (!before) {
    await getBus().publish(Topics.companyCreated, `company:${company.slug}`, 'company.created', { companyId: String(company._id) });
  } else if (r.sectors.some((s) => !before.trackedSectors?.includes(s))) {
    await getBus().publish(Topics.companyCreated, `company:${company.slug}`, 'company.sectors_changed', { companyId: String(company._id) });
  }
}

/* -------------------------------------------------------------- Form D */

export async function processFormD(f: FormDRecord) {
  const company = await Company.findOne({ slug: f.companySlug });
  if (!company) {
    logger.warn({ slug: f.companySlug, accession: f.accessionNumber }, 'form d for unknown company; skipping');
    return;
  }
  const amount = f.totalAmountSold && f.totalAmountSold > 0 ? f.totalAmountSold : null;
  const date = new Date(f.dateOfFirstSale ?? f.filingDate);
  const asOf = new Date(f.filingDate);

  const source = await upsertSource({
    kind: 'sec_form_d',
    url: f.indexUrl,
    title: `${f.entityName} — SEC Form ${f.form} filed ${f.filingDate}`,
    publisher: 'U.S. SEC EDGAR',
    publishedAt: asOf,
    excerpt: [
      `${f.entityName} (CIK ${f.cik}) filed Form ${f.form} with the SEC on ${f.filingDate} (accession ${f.accessionNumber}).`,
      f.dateOfFirstSale ? `Date of first sale: ${f.dateOfFirstSale}.` : '',
      f.totalOfferingAmount !== null ? `Total offering amount: $${f.totalOfferingAmount.toLocaleString('en-US')} (${formatUsd(f.totalOfferingAmount)}).` : 'Total offering amount: indefinite.',
      f.totalAmountSold !== null ? `Total amount sold: $${f.totalAmountSold.toLocaleString('en-US')} (${formatUsd(f.totalAmountSold)}).` : '',
      f.totalNumberAlreadyInvested !== null ? `Number of investors who have already invested: ${f.totalNumberAlreadyInvested}.` : '',
      f.industryGroup ? `Industry group: ${f.industryGroup}.` : '',
      f.isEquity ? 'Securities offered include equity.' : '',
      f.yearOfInc ? `Year of incorporation: ${f.yearOfInc}.` : '',
    ]
      .filter(Boolean)
      .join(' '),
    companyId: company._id,
    metadata: { cik: f.cik, accession: f.accessionNumber, form: f.form, matchMethod: f.matchMethod, primaryDoc: f.url },
  });

  // Amendments fold into the original offering's round.
  const existing = f.previousAccessionNumber
    ? await FundingRound.findOne({ aliases: f.previousAccessionNumber })
    : await FundingRound.findOne({ aliases: f.accessionNumber });
  const key = existing?.dedupeKey ?? `sec:${f.previousAccessionNumber ?? f.accessionNumber}`;
  const current = existing ?? (await FundingRound.findOne({ dedupeKey: key }));
  const newer = !current?.asOf || current.asOf <= asOf;

  const set: Record<string, unknown> = { companyId: company._id, companySlug: company.slug };
  if (newer) Object.assign(set, { amountUsd: amount, targetAmountUsd: f.totalOfferingAmount, asOf });
  if (!current || f.form === 'D') set.date = date;

  const res = await FundingRound.updateOne(
    { dedupeKey: key },
    {
      $set: set,
      $setOnInsert: {
        roundType: 'reg_d_offering' satisfies RoundType,
        extractedBy: 'sec-form-d-parser',
        confidence: f.matchMethod === 'exact_name' ? 0.95 : 0.8,
        notes: 'Regulation D offering reported on SEC Form D. Round name and investors are not disclosed on the form.',
        ...(set.date ? {} : { date }),
      },
      $addToSet: { sourceIds: source._id, aliases: { $each: [f.accessionNumber, ...(f.previousAccessionNumber ? [f.previousAccessionNumber] : [])] } },
    },
    { upsert: true },
  );

  await Company.updateOne({ _id: company._id }, { $addToSet: { legalNames: f.entityName, 'externalIds.secCiks': f.cik } });
  await recomputeCompanyMetrics(company._id);

  if (res.upsertedCount > 0) {
    const round = await FundingRound.findOne({ dedupeKey: key }).select('_id').lean();
    await getBus().publish(Topics.fundingCreated, `company:${company.slug}`, 'funding.created', { fundingRoundId: String(round!._id) });
  }
}

/* ----------------------------------------------------------------- RSS */

async function resolveCompany(item: RssItemRecord, extractedName: string | null) {
  if (item.companySlug) return Company.findOne({ slug: item.companySlug });
  if (!extractedName) return null;
  const norm = normalizeName(extractedName);
  const candidates = await Company.find({ $text: { $search: extractedName } }).limit(10);
  return candidates.find((c) => normalizeName(c.name) === norm || c.legalNames.some((l) => normalizeName(l) === norm)) ?? null;
}

export async function processRss(item: RssItemRecord) {
  const source = await upsertSource({
    kind: 'press_release',
    url: item.link,
    title: item.title,
    publisher: hostnameOf(item.feedUrl) ?? 'RSS',
    publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
    excerpt: item.summary,
    metadata: { feedUrl: item.feedUrl },
  });

  const extraction = await extractFundingRound(getProvider(), item.title, item.summary);
  if (!extraction.isFundingAnnouncement) return;
  const company = await resolveCompany(item, extraction.companyName);
  if (!company) {
    logger.info({ link: item.link, name: extraction.companyName }, 'funding announcement for an untracked company');
    return;
  }
  await Source.updateOne({ _id: source._id }, { $addToSet: { companyIds: company._id } });

  const date = extraction.announcedDate ? new Date(extraction.announcedDate) : (item.publishedAt ? new Date(item.publishedAt) : new Date());
  const key = `press:${company.slug}:${date.toISOString().slice(0, 7)}:${extraction.roundType}`;
  const res = await FundingRound.updateOne(
    { dedupeKey: key },
    {
      $set: { companyId: company._id, companySlug: company.slug },
      $setOnInsert: {
        date,
        roundType: (extraction.roundType ?? 'undisclosed') as RoundType,
        amountUsd: extraction.amountUsd,
        investors: extraction.investors,
        extractedBy: `llm:${getProvider().name}`,
        confidence: extraction.amountUsd ? 0.85 : 0.7,
        notes: extraction.evidenceQuote ? `Evidence: "${extraction.evidenceQuote.slice(0, 400)}"` : '',
      },
      $addToSet: { sourceIds: source._id },
    },
    { upsert: true },
  );
  await recomputeCompanyMetrics(company._id);
  if (res.upsertedCount > 0) {
    const round = await FundingRound.findOne({ dedupeKey: key }).select('_id').lean();
    await getBus().publish(Topics.fundingCreated, `company:${company.slug}`, 'funding.created', { fundingRoundId: String(round!._id) });
  }
}

/* -------------------------------------------------------------- GitHub */

export async function processGithub(g: GithubOrgRecord) {
  const company = await Company.findOne({ slug: g.companySlug });
  if (!company) return;
  await upsertSource({
    kind: 'github',
    url: g.url,
    title: `${g.org} on GitHub`,
    publisher: 'GitHub',
    publishedAt: new Date(g.retrievedAt),
    excerpt: `GitHub organisation ${g.org}: ${g.publicRepos} public non-fork repositories with ${g.totalStars} stars in total (retrieved ${g.retrievedAt.slice(0, 10)}). Top repositories: ${g.topRepos.map((r) => `${r.name} (${r.stars} stars)`).join(', ')}.`,
    companyId: company._id,
    metadata: g as unknown as Record<string, unknown>,
  });
  await Company.updateOne({ _id: company._id }, { $set: { 'externalIds.github': g.org } });
}
