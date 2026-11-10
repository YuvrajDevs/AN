import { Types } from 'mongoose';
import { draftBrief, validateClaims, type EvidenceSource, type FactCandidate } from '../ai/brief';
import { getProvider } from '../ai/registry';
import { logger } from '../logger';
import { notFound } from '../lib/errors';
import { formatUsd } from '../lib/text';
import { Brief, Company, FundingRound, Sector, Source } from '../models';
import { sectorLandscape } from './analytics';

/**
 * Builds an evidence pack from STORED sources only, asks the provider for a draft, then
 * keeps only claims that pass citation validation. Aggregates are first written to a
 * "dataset snapshot" Source so they are themselves citable and auditable.
 */

interface Pack {
  label: string;
  title: string;
  pack: EvidenceSource[];
  facts: FactCandidate[];
}

const today = () => new Date().toISOString().slice(0, 10);

async function datasetSource(url: string, title: string, excerpt: string, companyIds: Types.ObjectId[]) {
  return Source.findOneAndUpdate(
    { url },
    {
      $set: { kind: 'dataset', title, publisher: 'Strata dataset (derived from cited primary sources)', publishedAt: new Date(), excerpt, retrievedAt: new Date() },
      $addToSet: { companyIds: { $each: companyIds.slice(0, 500) } },
    },
    { upsert: true, new: true },
  );
}

export async function buildSectorPack(sectorSlug: string): Promise<Pack> {
  const sector = await Sector.findOne({ slug: sectorSlug, parentSlug: null }).lean();
  if (!sector) throw notFound('Sector');
  const land = await sectorLandscape(sectorSlug);
  const inSector = { $or: [{ 'classification.sectorSlug': sectorSlug }, { trackedSectors: sectorSlug }] };
  const companies = await Company.find(inSector).select('_id slug name').lean();
  const ids = companies.map((c) => c._id);

  const k = land.kpis as Record<string, number>;
  const subLines = land.marketMap.filter((m) => m.count > 0).sort((a, b) => b.count - a.count);
  const recentCohorts = land.cohorts.slice(-6);
  const funding = land.fundingByYear as { year: number; rounds: number; disclosedUsd: number; companies: number }[];
  const snapshot = await datasetSource(
    `strata://dataset/${sectorSlug}/${today()}`,
    `${sector.name}: Strata dataset snapshot ${today()}`,
    [
      `As of ${today()}, Strata tracks ${k.companies} ${sector.name} companies (${k.active} active, ${k.acquired} acquired, ${k.inactive} inactive), sourced from the Y Combinator public directory.`,
      `${k.classified} are classified into a subsector; ${k.pendingReview} classifications await analyst review.`,
      `Companies per subsector: ${subLines.map((s) => `${s.name} ${s.count}`).join('; ')}.`,
      `Companies by YC batch year: ${recentCohorts.map((c) => `${c.year}: ${c.companies}`).join('; ')}.`,
      `${k.withDisclosedFunding} companies have SEC Form D filings with disclosed amounts sold, totalling $${Math.round(k.totalDisclosedUsd).toLocaleString('en-US')} (${formatUsd(k.totalDisclosedUsd)}).`,
      funding.length ? `Form D offerings by year of first sale: ${funding.map((f) => `${f.year}: ${f.rounds} offerings, ${formatUsd(f.disclosedUsd)} sold`).join('; ')}.` : '',
    ].filter(Boolean).join(' '),
    ids,
  );

  const pack: EvidenceSource[] = [{ ref: 'S1', sourceId: String(snapshot._id), title: snapshot.title, excerpt: snapshot.excerpt }];
  const facts: FactCandidate[] = [];
  const S1 = ['S1'];
  facts.push({ section: 'Overview', text: `Strata tracks ${k.companies} ${sector.name} companies, of which ${k.active} are active, ${k.acquired} acquired and ${k.inactive} inactive.`, refs: S1 });
  if (subLines[0]) facts.push({ section: 'Overview', text: `The largest subsector by company count is ${subLines[0].name} with ${subLines[0].count} companies${subLines[1] ? `, followed by ${subLines[1].name} with ${subLines[1].count}` : ''}.`, refs: S1 });
  const lastTwo = recentCohorts.slice(-2);
  if (lastTwo.length === 2) facts.push({ section: 'Overview', text: `Company formation is visible in YC cohorts: ${lastTwo[0].companies} companies joined YC in ${lastTwo[0].year} and ${lastTwo[1].companies} in ${lastTwo[1].year}.`, refs: S1 });
  if (k.withDisclosedFunding) facts.push({ section: 'Funding activity', text: `${k.withDisclosedFunding} companies have Form D filings with disclosed amounts sold, totalling ${formatUsd(k.totalDisclosedUsd)}.`, refs: S1 });

  // Largest primary-source offerings.
  const rounds = await FundingRound.find({ companyId: { $in: ids }, roundType: 'reg_d_offering', amountUsd: { $gt: 0 } })
    .sort({ amountUsd: -1 })
    .limit(10)
    .populate<{ companyId: { name: string } }>('companyId', 'name')
    .lean();
  for (const r of rounds) {
    const src = await Source.findById(r.sourceIds[r.sourceIds.length - 1]).lean();
    if (!src) continue;
    const ref = `S${pack.length + 1}`;
    pack.push({ ref, sourceId: String(src._id), title: src.title, excerpt: src.excerpt });
    if (facts.filter((f) => f.section === 'Funding activity').length < 6) {
      facts.push({
        section: 'Funding activity',
        text: `${r.companyId.name} reported ${formatUsd(r.amountUsd)} sold in a Regulation D offering with first sale on ${r.date.toISOString().slice(0, 10)}.`,
        refs: [ref],
      });
    }
  }

  // Notable companies: their YC profiles.
  for (const c of land.notable.slice(0, 6) as any[]) {
    const src = await Source.findOne({ kind: 'yc_directory', companyIds: c._id }).lean();
    if (!src) continue;
    const ref = `S${pack.length + 1}`;
    pack.push({ ref, sourceId: String(src._id), title: src.title, excerpt: src.excerpt });
    facts.push({ section: 'Notable companies', text: `${c.name} (YC ${c.ycBatch ?? 'n/a'}) describes itself as: "${c.oneLiner}".`, refs: [ref] });
  }
  const pending = k.pendingReview;
  if (pending) facts.push({ section: 'Data caveats', text: `${pending} company classifications in this sector are still awaiting analyst review.`, refs: S1 });
  facts.push({ section: 'Data caveats', text: 'Funding amounts come from SEC Form D filings, which do not name the round or investors and are not filed by every company.', refs: rounds.length ? ['S2'] : S1 });

  return { label: `${sector.name} sector`, title: `${sector.name}: sector brief`, pack, facts: facts.filter((f) => f.refs.every((r) => pack.some((p) => p.ref === r))) };
}

export async function buildCompanyPack(slug: string): Promise<Pack> {
  const company = await Company.findOne({ slug }).lean();
  if (!company) throw notFound('Company');
  const sources = await Source.find({ companyIds: company._id }).sort({ kind: 1, publishedAt: -1 }).limit(20).lean();
  const pack: EvidenceSource[] = sources.map((s, i) => ({ ref: `S${i + 1}`, sourceId: String(s._id), title: s.title, excerpt: s.excerpt }));
  const facts: FactCandidate[] = [];
  const yc = pack.find((p, i) => sources[i].kind === 'yc_directory');
  if (yc) {
    facts.push({ section: 'Overview', text: `${company.name} describes itself as: "${company.oneLiner}".`, refs: [yc.ref] });
    if (company.ycBatch) facts.push({ section: 'Overview', text: `${company.name} went through Y Combinator (${company.ycBatch}).`, refs: [yc.ref] });
    if (company.teamSize) facts.push({ section: 'Overview', text: `The YC directory lists a team size of ${company.teamSize}.`, refs: [yc.ref] });
  }
  sources.forEach((s, i) => {
    if (s.kind !== 'sec_form_d') return;
    const amount = /Total amount sold: \$[\d,]+ \(([^)]+)\)/.exec(s.excerpt)?.[1];
    const date = /filed Form D\/?A? with the SEC on (\d{4}-\d{2}-\d{2})/.exec(s.excerpt)?.[1];
    facts.push({ section: 'Funding', text: `A Form D filed on ${date ?? 'an undisclosed date'} reports ${amount ?? 'an undisclosed amount'} sold.`, refs: [pack[i].ref] });
  });
  if (!sources.some((s) => s.kind === 'sec_form_d') && yc) {
    facts.push({ section: 'Funding', text: `No SEC Form D filings are linked to ${company.name}; its funding is undisclosed in primary sources tracked here.`, refs: [yc.ref] });
  }
  return { label: `${company.name} (company)`, title: `${company.name}: company brief`, pack, facts };
}

export async function createBriefRecord(scope: { type: 'sector' | 'company'; slug: string }, userId: string | null, provider?: string | null) {
  const p = getProvider(provider);
  const exists = scope.type === 'sector' ? await Sector.exists({ slug: scope.slug, parentSlug: null }) : await Company.exists({ slug: scope.slug });
  if (!exists) throw notFound(scope.type === 'sector' ? 'Sector' : 'Company');
  return Brief.create({
    title: `${scope.slug} brief`,
    scope,
    status: 'queued',
    provider: p.name,
    model: p.model,
    createdBy: userId ? new Types.ObjectId(userId) : null,
  });
}

export async function generateBrief(briefId: string): Promise<void> {
  const brief = await Brief.findById(briefId);
  if (!brief) return;
  brief.status = 'running';
  await brief.save();
  try {
    const { label, title, pack, facts } = brief.scope!.type === 'sector' ? await buildSectorPack(brief.scope!.slug) : await buildCompanyPack(brief.scope!.slug);
    const provider = getProvider(brief.provider);
    const draft = await draftBrief(provider, label, pack, facts);
    const { sections, rejected } = validateClaims(draft, pack);
    brief.title = title;
    brief.sections = sections.map((s) => ({ heading: s.heading, claims: s.claims.map((c) => ({ text: c.text, sourceIds: c.sourceIds.map((id) => new Types.ObjectId(id)) })) })) as any;
    brief.rejectedClaims = rejected as any;
    brief.sourceIds = [...new Set(sections.flatMap((s) => s.claims.flatMap((c) => c.sourceIds)))].map((id) => new Types.ObjectId(id));
    brief.status = sections.length ? 'ready' : 'failed';
    brief.error = sections.length ? null : 'No claims survived citation validation';
    await brief.save();
  } catch (err) {
    logger.error({ err: (err as Error).message, briefId }, 'brief generation failed');
    brief.status = 'failed';
    brief.error = (err as Error).message.slice(0, 500);
    await brief.save();
  }
}
