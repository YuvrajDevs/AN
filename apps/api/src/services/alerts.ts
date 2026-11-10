import { Types } from 'mongoose';
import { logger } from '../logger';
import { formatUsd } from '../lib/text';
import { Alert, Company, FundingRound, Watchlist } from '../models';
import { safeFetch } from '../security/safeFetch';

const ROUND_LABEL: Record<string, string> = {
  pre_seed: 'pre-seed round',
  seed: 'seed round',
  series_a: 'Series A',
  series_b: 'Series B',
  series_c: 'Series C',
  series_d_plus: 'Series D+ round',
  growth: 'growth round',
  accelerator: 'accelerator investment',
  debt: 'debt financing',
  grant: 'grant',
  reg_d_offering: 'Reg D offering (SEC Form D)',
  undisclosed: 'funding round',
};

export function describeRound(companyName: string, roundType: string, amountUsd: number | null): string {
  const label = ROUND_LABEL[roundType] ?? 'funding round';
  return amountUsd ? `${companyName}: ${formatUsd(amountUsd)} ${label}` : `${companyName}: new ${label}`;
}

/**
 * Fan out one new funding round to every watchlist that matches it — by company, or by
 * sector/subsector — and that meets the list's minimum amount. Unique index on
 * (userId, fundingRoundId) makes re-delivery idempotent.
 */
export async function deliverAlertsForRound(fundingRoundId: string): Promise<number> {
  const round = await FundingRound.findById(fundingRoundId).lean();
  if (!round) return 0;
  const company = await Company.findById(round.companyId).lean();
  if (!company) return 0;

  const sectorSlugs = [company.classification?.sectorSlug, company.classification?.subsectorSlug, ...(company.trackedSectors ?? [])].filter(
    (s): s is string => Boolean(s),
  );
  const lists = await Watchlist.find({
    $or: [{ companyIds: company._id }, { sectorSlugs: { $in: sectorSlugs } }],
  }).lean();

  let created = 0;
  for (const list of lists) {
    if (list.minAmountUsd && (round.amountUsd ?? 0) < list.minAmountUsd) continue;
    const message = describeRound(company.name, round.roundType, round.amountUsd ?? null);
    try {
      const alert = await Alert.create({
        userId: list.userId,
        watchlistId: list._id,
        fundingRoundId: round._id,
        companyId: company._id,
        message,
      });
      created++;
      if (list.webhookUrl) {
        const status = await postWebhook(list.webhookUrl, {
          type: 'funding_round.created',
          watchlist: list.name,
          message,
          company: { name: company.name, slug: company.slug, website: company.website },
          round: { date: round.date, roundType: round.roundType, amountUsd: round.amountUsd },
        });
        await Alert.updateOne({ _id: alert._id }, { $set: { webhookStatus: status } });
      }
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err; // duplicate = already alerted
    }
  }
  return created;
}

async function postWebhook(url: string, payload: unknown): Promise<string> {
  try {
    const res = await safeFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: 5000,
      maxBytes: 64 * 1024,
      maxRedirects: 0,
    });
    return `HTTP ${res.status}`;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'webhook delivery failed');
    return `failed: ${(err as Error).message}`.slice(0, 120);
  }
}

export async function unreadCount(userId: string) {
  return Alert.countDocuments({ userId: new Types.ObjectId(userId), read: false });
}
