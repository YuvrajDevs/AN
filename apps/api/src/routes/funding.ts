import { Router } from 'express';
import { z } from 'zod';
import { getBus, Topics } from '../events';
import { csvRow } from '../lib/csv';
import { notFound } from '../lib/errors';
import { Company, FundingRound, ROUND_TYPES, Source } from '../models';
import { requireRole } from '../security/auth';
import { slug, validate } from '../security/validate';
import { recentFunding } from '../services/analytics';
import { recomputeCompanyMetrics } from '../services/funding';

export const fundingRouter = Router();

const listQuery = z.object({
  sector: slug.optional(),
  roundType: z.enum(ROUND_TYPES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  includeAccelerator: z.enum(['true', 'false']).default('false'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

async function companyIdsForSector(sector?: string) {
  if (!sector) return undefined;
  const ids = await Company.find({ $or: [{ 'classification.sectorSlug': sector }, { trackedSectors: sector }] }).select('_id').lean();
  return ids.map((c) => c._id);
}

fundingRouter.get('/', validate({ query: listQuery }), async (req, res) => {
  const q = req.query as unknown as z.infer<typeof listQuery>;
  const match: Record<string, unknown> = {};
  const ids = await companyIdsForSector(q.sector);
  if (ids) match.companyId = { $in: ids };
  if (q.roundType) match.roundType = q.roundType;
  else if (q.includeAccelerator === 'false') match.roundType = { $ne: 'accelerator' };
  if (q.from || q.to) match.date = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
  const items = await FundingRound.find(match)
    .sort({ date: -1 })
    .limit(q.limit)
    .populate('companyId', 'slug name logoUrl classification.subsectorSlug')
    .lean();
  res.json({ items });
});

fundingRouter.get('/recent', async (_req, res) => {
  res.json({ items: await recentFunding({ limit: 15 }) });
});

fundingRouter.get('/export.csv', validate({ query: listQuery }), async (req, res) => {
  const q = req.query as unknown as z.infer<typeof listQuery>;
  const match: Record<string, unknown> = {};
  const ids = await companyIdsForSector(q.sector);
  if (ids) match.companyId = { $in: ids };
  if (q.includeAccelerator === 'false') match.roundType = { $ne: 'accelerator' };
  res.setHeader('content-type', 'text/csv; charset=utf-8');
  res.setHeader('content-disposition', `attachment; filename="strata-funding-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.write(csvRow(['company', 'company_slug', 'date', 'round_type', 'amount_usd', 'offering_amount_usd', 'investors', 'extracted_by', 'confidence', 'source_urls']));
  const cursor = FundingRound.find(match).sort({ date: -1 }).populate('companyId', 'name slug').populate('sourceIds', 'url').lean().cursor();
  for await (const r of cursor) {
    const c = r.companyId as unknown as { name: string; slug: string } | null;
    res.write(
      csvRow([
        c?.name, c?.slug, r.date.toISOString().slice(0, 10), r.roundType, r.amountUsd, r.targetAmountUsd, r.investors, r.extractedBy, r.confidence,
        (r.sourceIds as unknown as { url: string }[]).map((s) => s.url),
      ]),
    );
  }
  res.end();
});

const manualRound = z.object({
  companySlug: slug,
  date: z.coerce.date(),
  roundType: z.enum(ROUND_TYPES),
  amountUsd: z.number().nonnegative().nullable(),
  investors: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  sourceUrl: z.string().url().max(2000).refine((u) => /^https?:\/\//.test(u), 'http(s) only'),
  sourceTitle: z.string().trim().min(1).max(300),
  sourceExcerpt: z.string().trim().min(1).max(4000),
});

/** Analysts can record a round by hand — but only with a source, so it can be cited. */
fundingRouter.post('/', requireRole('analyst'), validate({ body: manualRound }), async (req, res) => {
  const body = req.body as z.infer<typeof manualRound>;
  const company = await Company.findOne({ slug: body.companySlug });
  if (!company) throw notFound('Company');
  const source = await Source.findOneAndUpdate(
    { url: body.sourceUrl },
    {
      $set: { kind: 'manual', title: body.sourceTitle, excerpt: body.sourceExcerpt, publisher: new URL(body.sourceUrl).hostname, publishedAt: body.date },
      $addToSet: { companyIds: company._id },
    },
    { upsert: true, new: true },
  );
  const round = await FundingRound.create({
    companyId: company._id,
    companySlug: company.slug,
    date: body.date,
    roundType: body.roundType,
    amountUsd: body.amountUsd,
    investors: body.investors,
    sourceIds: [source._id],
    dedupeKey: `manual:${company.slug}:${body.date.toISOString().slice(0, 10)}:${body.roundType}`,
    extractedBy: `manual:${req.user!.email}`,
    confidence: 1,
  });
  await recomputeCompanyMetrics(company._id);
  await getBus().publish(Topics.fundingCreated, `company:${company.slug}`, 'funding.created', { fundingRoundId: String(round._id) });
  res.status(201).json({ round });
});
