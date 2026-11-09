import type { Types } from 'mongoose';
import { CacheNs, invalidate } from '../lib/cache';
import { Company, FundingRound } from '../models';

/** Denormalise round totals onto the company document (used for sorting/filtering). */
export async function recomputeCompanyMetrics(companyId: Types.ObjectId | string) {
  const rounds = await FundingRound.find({ companyId }).sort({ date: -1 }).lean();
  const disclosed = rounds.filter((r) => typeof r.amountUsd === 'number');
  await Company.updateOne(
    { _id: companyId },
    {
      $set: {
        'metrics.totalRaisedUsd': disclosed.reduce((s, r) => s + (r.amountUsd ?? 0), 0),
        'metrics.roundCount': rounds.length,
        'metrics.lastRoundDate': rounds[0]?.date ?? null,
        'metrics.lastRoundAmountUsd': rounds[0]?.amountUsd ?? null,
      },
    },
  );
  await invalidate(CacheNs.analytics);
}
