import { Router } from 'express';
import type { FilterQuery } from 'mongoose';
import { z } from 'zod';
import { enqueue } from '../queue/jobs';
import { csvRow } from '../lib/csv';
import { notFound } from '../lib/errors';
import { escapeRegex } from '../lib/text';
import { Classification, Company, COMPANY_STATUSES, FundingRound, Source, Watchlist } from '../models';
import { requireRole } from '../security/auth';
import { llmLimiter } from '../security/rateLimit';
import { csvList, slug, validate } from '../security/validate';
import { classifyCompanyById } from '../services/classification';
import { CacheNs, invalidate } from '../lib/cache';

export const companiesRouter = Router();

const SORTS = {
  relevance: {},
  name: { name: 1 },
  raised: { 'metrics.totalRaisedUsd': -1, name: 1 },
  recent_round: { 'metrics.lastRoundDate': -1, name: 1 },
  team: { teamSize: -1, name: 1 },
  newest: { ycBatchDate: -1, name: 1 },
} as const;

export const companyQuery = z.object({
  q: z.string().trim().max(200).optional(),
  sector: slug.optional(),
  subsector: csvList.optional(),
  status: csvList.pipe(z.array(z.enum(COMPANY_STATUSES))).optional(),
  state: z.enum(['unclassified', 'auto', 'pending_review', 'reviewed']).optional(),
  country: z.string().trim().max(80).optional(),
  batchYearFrom: z.coerce.number().int().min(2005).max(2100).optional(),
  batchYearTo: z.coerce.number().int().min(2005).max(2100).optional(),
  minRaised: z.coerce.number().min(0).optional(),
  hasFunding: z.enum(['true', 'false']).optional(),
  notable: z.enum(['true']).optional(),
  sort: z.enum(Object.keys(SORTS) as [keyof typeof SORTS, ...(keyof typeof SORTS)[]]).default('relevance'),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
type CompanyQuery = z.infer<typeof companyQuery>;

export function buildCompanyFilter(q: CompanyQuery): FilterQuery<unknown> {
  const f: Record<string, unknown> = {};
  const and: Record<string, unknown>[] = [];
  if (q.q) {
    // Text index for words; anchored regex on name for prefixes ("leg" → Legora).
    and.push({ $or: [{ $text: { $search: q.q } }, { name: { $regex: `^${escapeRegex(q.q)}`, $options: 'i' } }] });
  }
  if (q.sector) and.push({ $or: [{ 'classification.sectorSlug': q.sector }, { trackedSectors: q.sector }] });
  if (q.subsector?.length) f['classification.subsectorSlug'] = { $in: q.subsector };
  if (q.status?.length) f.status = { $in: q.status };
  if (q.state) f['classification.state'] = q.state;
  if (q.country) f['hq.country'] = q.country;
  if (q.batchYearFrom || q.batchYearTo) {
    f.ycBatchDate = {
      ...(q.batchYearFrom ? { $gte: new Date(Date.UTC(q.batchYearFrom, 0, 1)) } : {}),
      ...(q.batchYearTo ? { $lt: new Date(Date.UTC(q.batchYearTo + 1, 0, 1)) } : {}),
    };
  }
  if (q.minRaised !== undefined) f['metrics.totalRaisedUsd'] = { $gte: q.minRaised };
  if (q.hasFunding === 'true') f['metrics.totalRaisedUsd'] = { $gt: 0 };
  if (q.hasFunding === 'false') f['metrics.totalRaisedUsd'] = 0;
  if (q.notable) f.notable = true;
  if (and.length) f.$and = and;
  return f;
}

const LIST_FIELDS = 'slug name oneLiner logoUrl website status teamSize ycBatch hq.country trackedSectors classification metrics notable';

companiesRouter.get('/', validate({ query: companyQuery }), async (req, res) => {
  const q = req.query as unknown as CompanyQuery;
  const filter = buildCompanyFilter(q);
  // $text cannot be combined with an $or-wrapped regex for scoring, so relevance falls back to name.
  const sort = q.sort === 'relevance' ? { notable: -1, 'metrics.totalRaisedUsd': -1, teamSize: -1, name: 1 } : SORTS[q.sort];
  const [items, total] = await Promise.all([
    Company.find(filter)
      .sort(sort as Record<string, 1 | -1>)
      .skip((q.page - 1) * q.pageSize)
      .limit(q.pageSize)
      .select(LIST_FIELDS)
      .lean(),
    Company.countDocuments(filter),
  ]);
  res.json({ items, total, page: q.page, pageSize: q.pageSize });
});

/** Streams every matching company as CSV (cursor-based: constant memory for any size). */
companiesRouter.get('/export.csv', validate({ query: companyQuery }), async (req, res) => {
  const q = req.query as unknown as CompanyQuery;
  res.setHeader('content-type', 'text/csv; charset=utf-8');
  res.setHeader('content-disposition', `attachment; filename="strata-companies-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.write(csvRow(['name', 'slug', 'website', 'one_liner', 'status', 'sector', 'subsector', 'classification_state', 'confidence', 'yc_batch', 'country', 'team_size', 'total_disclosed_usd', 'round_count', 'last_round_date', 'profile_url']));
  const cursor = Company.find(buildCompanyFilter(q)).sort({ name: 1 }).select(LIST_FIELDS + ' website').lean().cursor();
  for await (const c of cursor) {
    res.write(
      csvRow([
        c.name, c.slug, c.website, c.oneLiner, c.status, c.classification?.sectorSlug ?? c.trackedSectors?.[0], c.classification?.subsectorSlug,
        c.classification?.state, c.classification?.confidence, c.ycBatch, c.hq?.country, c.teamSize, c.metrics?.totalRaisedUsd,
        c.metrics?.roundCount, c.metrics?.lastRoundDate ? new Date(c.metrics.lastRoundDate).toISOString().slice(0, 10) : '',
        `/companies/${c.slug}`,
      ]),
    );
  }
  res.end();
});

companiesRouter.get('/:slug', validate({ params: z.object({ slug }) }), async (req, res) => {
  const company = await Company.findOne({ slug: req.params.slug }).lean();
  if (!company) throw notFound('Company');
  const [rounds, sources, history, watchlists] = await Promise.all([
    FundingRound.find({ companyId: company._id }).sort({ date: -1 }).lean(),
    Source.find({ companyIds: company._id }).sort({ publishedAt: -1 }).select('-companyIds').limit(50).lean(),
    Classification.find({ companyId: company._id }).sort({ createdAt: -1 }).limit(10).lean(),
    req.user ? Watchlist.find({ userId: req.user.id }).select('name companyIds').lean() : [],
  ]);
  res.json({
    company,
    rounds,
    sources,
    classificationHistory: history,
    watchlists: watchlists.map((w) => ({ _id: w._id, name: w.name, contains: w.companyIds.some((id) => String(id) === String(company._id)) })),
  });
});

companiesRouter.patch(
  '/:slug',
  requireRole('analyst'),
  validate({ params: z.object({ slug }), body: z.object({ notable: z.boolean().optional(), oneLiner: z.string().max(300).optional() }).strict() }),
  async (req, res) => {
    const company = await Company.findOneAndUpdate({ slug: req.params.slug }, { $set: req.body }, { new: true }).lean();
    if (!company) throw notFound('Company');
    await invalidate(CacheNs.analytics);
    res.json({ company });
  },
);

companiesRouter.post(
  '/:slug/classify',
  requireRole('analyst'),
  llmLimiter(),
  validate({ params: z.object({ slug }), body: z.object({ provider: z.enum(['openai', 'anthropic', 'gemini', 'heuristic']).optional(), async: z.boolean().optional() }) }),
  async (req, res) => {
    const company = await Company.findOne({ slug: req.params.slug }).select('_id').lean();
    if (!company) throw notFound('Company');
    if (req.body.async) {
      await enqueue('classify-company', { companyId: String(company._id), provider: req.body.provider });
      res.status(202).json({ queued: true });
      return;
    }
    res.json(await classifyCompanyById(String(company._id), { provider: req.body.provider, force: true }));
  },
);
