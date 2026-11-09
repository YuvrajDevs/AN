import type { PipelineStage } from 'mongoose';
import { cached, CacheNs } from '../lib/cache';
import { notFound } from '../lib/errors';
import { Company, FundingRound, Sector } from '../models';

/**
 * Sector landscape analytics — MongoDB aggregation pipelines, cached in Redis and
 * invalidated by generation bump whenever companies, rounds or the taxonomy change.
 */

const yearOf = { $year: '$date' };

export async function sectorLandscape(sectorSlug: string) {
  return cached(CacheNs.analytics, `landscape:${sectorSlug}`, async () => {
    const sector = await Sector.findOne({ slug: sectorSlug, parentSlug: null }).lean();
    if (!sector) throw notFound('Sector');
    const subsectors = await Sector.find({ parentSlug: sectorSlug }).sort({ order: 1 }).lean();
    const inSector = { $or: [{ 'classification.sectorSlug': sectorSlug }, { trackedSectors: sectorSlug }] };

    // One round-trip: market map + KPIs + cohort trend via $facet.
    const [facets] = await Company.aggregate([
      { $match: inSector },
      {
        $facet: {
          kpis: [
            {
              $group: {
                _id: null,
                companies: { $sum: 1 },
                active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
                acquired: { $sum: { $cond: [{ $eq: ['$status', 'acquired'] }, 1, 0] } },
                inactive: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } },
                classified: { $sum: { $cond: [{ $ne: ['$classification.subsectorSlug', null] }, 1, 0] } },
                pendingReview: { $sum: { $cond: [{ $eq: ['$classification.state', 'pending_review'] }, 1, 0] } },
                totalDisclosedUsd: { $sum: '$metrics.totalRaisedUsd' },
                withDisclosedFunding: { $sum: { $cond: [{ $gt: ['$metrics.totalRaisedUsd', 0] }, 1, 0] } },
                medianTeam: { $median: { input: '$teamSize', method: 'approximate' } },
              },
            },
          ],
          marketMap: [
            { $match: { 'classification.subsectorSlug': { $ne: null } } },
            { $sort: { notable: -1, 'metrics.totalRaisedUsd': -1, teamSize: -1 } },
            {
              $group: {
                _id: '$classification.subsectorSlug',
                count: { $sum: 1 },
                active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
                disclosedUsd: { $sum: '$metrics.totalRaisedUsd' },
                companies: {
                  $push: {
                    slug: '$slug', name: '$name', logoUrl: '$logoUrl', status: '$status', teamSize: '$teamSize',
                    totalRaisedUsd: '$metrics.totalRaisedUsd', ycBatch: '$ycBatch', confidence: '$classification.confidence', state: '$classification.state',
                  },
                },
              },
            },
            { $project: { count: 1, active: 1, disclosedUsd: 1, companies: { $slice: ['$companies', 12] } } },
          ],
          cohorts: [
            { $match: { ycBatchDate: { $ne: null } } },
            { $group: { _id: { $year: '$ycBatchDate' }, companies: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
          unclassified: [{ $match: { 'classification.subsectorSlug': null } }, { $count: 'n' }],
        },
      },
    ]);

    const companyIds = (await Company.find(inSector).select('_id').lean()).map((c) => c._id);
    const fundingByYear = await FundingRound.aggregate([
      { $match: { companyId: { $in: companyIds }, roundType: { $ne: 'accelerator' } } },
      { $group: { _id: yearOf, rounds: { $sum: 1 }, disclosedUsd: { $sum: { $ifNull: ['$amountUsd', 0] } }, companies: { $addToSet: '$companyId' } } },
      { $project: { _id: 0, year: '$_id', rounds: 1, disclosedUsd: 1, companies: { $size: '$companies' } } },
      { $sort: { year: 1 } },
    ]);
    const fundingBySubsector = await FundingRound.aggregate([
      { $match: { companyId: { $in: companyIds }, roundType: { $ne: 'accelerator' } } },
      { $lookup: { from: 'companies', localField: 'companyId', foreignField: '_id', as: 'c', pipeline: [{ $project: { 'classification.subsectorSlug': 1 } }] } },
      { $unwind: '$c' },
      { $group: { _id: { sub: '$c.classification.subsectorSlug', year: yearOf }, disclosedUsd: { $sum: { $ifNull: ['$amountUsd', 0] } }, rounds: { $sum: 1 } } },
      { $project: { _id: 0, subsectorSlug: '$_id.sub', year: '$_id.year', disclosedUsd: 1, rounds: 1 } },
      { $sort: { year: 1 } },
    ]);
    const recentRounds = await recentFunding({ companyIds, limit: 10 });

    const mapBySlug = new Map((facets.marketMap as any[]).map((m) => [m._id, m]));
    return {
      sector: { slug: sector.slug, name: sector.name, description: sector.description, color: sector.color },
      kpis: { ...(facets.kpis[0] ?? { companies: 0 }), unclassified: facets.unclassified[0]?.n ?? 0, _id: undefined },
      marketMap: subsectors.map((s) => ({
        slug: s.slug,
        name: s.name,
        description: s.description,
        count: mapBySlug.get(s.slug)?.count ?? 0,
        active: mapBySlug.get(s.slug)?.active ?? 0,
        disclosedUsd: mapBySlug.get(s.slug)?.disclosedUsd ?? 0,
        companies: mapBySlug.get(s.slug)?.companies ?? [],
      })),
      cohorts: (facets.cohorts as { _id: number; companies: number }[]).map((c) => ({ year: c._id, companies: c.companies })),
      fundingByYear,
      fundingBySubsector,
      recentRounds,
      notable: await notableCompanies(companyIds),
      generatedAt: new Date().toISOString(),
    };
  });
}

async function notableCompanies(companyIds: unknown[]) {
  return Company.find({ _id: { $in: companyIds } })
    .sort({ notable: -1, 'metrics.totalRaisedUsd': -1, teamSize: -1 })
    .limit(8)
    .select('slug name oneLiner logoUrl status teamSize ycBatch metrics classification.subsectorSlug notable')
    .lean();
}

export async function recentFunding(opts: { companyIds?: unknown[]; limit?: number; sectorSlug?: string; excludeAccelerator?: boolean } = {}) {
  const match: Record<string, unknown> = {};
  if (opts.companyIds) match.companyId = { $in: opts.companyIds };
  if (opts.excludeAccelerator !== false) match.roundType = { $ne: 'accelerator' };
  const pipeline: PipelineStage[] = [
    { $match: match },
    { $sort: { date: -1 } },
    { $limit: opts.limit ?? 20 },
    {
      $lookup: {
        from: 'companies',
        localField: 'companyId',
        foreignField: '_id',
        as: 'company',
        pipeline: [{ $project: { slug: 1, name: 1, logoUrl: 1, 'classification.subsectorSlug': 1, 'classification.sectorSlug': 1 } }],
      },
    },
    { $unwind: '$company' },
    { $project: { date: 1, roundType: 1, amountUsd: 1, targetAmountUsd: 1, investors: 1, sourceIds: 1, extractedBy: 1, company: 1 } },
  ];
  return FundingRound.aggregate(pipeline);
}

export async function dashboard() {
  return cached(CacheNs.analytics, 'dashboard', async () => {
    const [totals] = await Company.aggregate([
      {
        $group: {
          _id: null,
          companies: { $sum: 1 },
          pendingReview: { $sum: { $cond: [{ $eq: ['$classification.state', 'pending_review'] }, 1, 0] } },
          disclosedUsd: { $sum: '$metrics.totalRaisedUsd' },
        },
      },
    ]);
    const rounds = await FundingRound.countDocuments({ roundType: { $ne: 'accelerator' } });
    const bySector = await Company.aggregate([
      { $unwind: '$trackedSectors' },
      { $group: { _id: '$trackedSectors', companies: { $sum: 1 }, disclosedUsd: { $sum: '$metrics.totalRaisedUsd' } } },
      { $lookup: { from: 'sectors', localField: '_id', foreignField: 'slug', as: 's' } },
      { $unwind: '$s' },
      { $project: { _id: 0, slug: '$_id', name: '$s.name', color: '$s.color', companies: 1, disclosedUsd: 1 } },
      { $sort: { companies: -1 } },
    ]);
    const quarterly = await FundingRound.aggregate([
      { $match: { roundType: { $ne: 'accelerator' }, date: { $gte: new Date(Date.UTC(new Date().getUTCFullYear() - 4, 0, 1)) } } },
      {
        $group: {
          _id: { y: { $year: '$date' }, q: { $ceil: { $divide: [{ $month: '$date' }, 3] } } },
          rounds: { $sum: 1 },
          disclosedUsd: { $sum: { $ifNull: ['$amountUsd', 0] } },
        },
      },
      { $project: { _id: 0, period: { $concat: [{ $toString: '$_id.y' }, '-Q', { $toString: '$_id.q' }] }, rounds: 1, disclosedUsd: 1 } },
      { $sort: { period: 1 } },
    ]);
    return { totals: { companies: totals?.companies ?? 0, pendingReview: totals?.pendingReview ?? 0, disclosedUsd: totals?.disclosedUsd ?? 0, rounds }, bySector, quarterly };
  });
}
