import { Types } from 'mongoose';
import { classifyCompany } from '../ai/classify';
import { getProvider } from '../ai/registry';
import { config } from '../config';
import { CacheNs, invalidate } from '../lib/cache';
import { badRequest, conflict, notFound } from '../lib/errors';
import { Classification, Company, Sector } from '../models';
import { classifierNodes } from './taxonomy';

/**
 * Classify one company within its tracked sector.
 * confidence >= REVIEW_CONFIDENCE_THRESHOLD → auto-accepted; otherwise → human review queue.
 * A human decision ("reviewed") is never overwritten by a later automatic run.
 */
export async function classifyCompanyById(companyId: string, opts: { provider?: string | null; sectorSlug?: string; force?: boolean } = {}) {
  const company = await Company.findById(companyId);
  if (!company) throw notFound('Company');
  if (company.classification?.state === 'reviewed' && !opts.force) return { skipped: 'already reviewed by an analyst' };

  const sectorSlug = opts.sectorSlug ?? company.classification?.sectorSlug ?? company.trackedSectors[0];
  if (!sectorSlug) throw badRequest('Company is not in a tracked sector');
  const nodes = await classifierNodes(sectorSlug);
  if (nodes.length === 0) throw badRequest(`Sector "${sectorSlug}" has no subsectors to classify into`);

  const provider = getProvider(opts.provider);
  const result = await classifyCompany(
    provider,
    { name: company.name, oneLiner: company.oneLiner, description: company.description, tags: company.tags, website: company.website },
    nodes,
  );
  const autoAccept = result.subsectorSlug !== null && result.confidence >= config.REVIEW_CONFIDENCE_THRESHOLD;

  // Supersede older open proposals for this company: only one item per company in the queue.
  await Classification.updateMany({ companyId: company._id, status: 'pending_review' }, { $set: { status: 'superseded' } });
  const decision = await Classification.create({
    companyId: company._id,
    sectorSlug,
    subsectorSlug: result.subsectorSlug,
    confidence: result.confidence,
    rationale: result.rationale,
    alternatives: result.alternatives,
    provider: provider.name,
    model: provider.model,
    status: autoAccept ? 'auto_accepted' : 'pending_review',
  });

  company.classification = {
    sectorSlug,
    subsectorSlug: autoAccept ? result.subsectorSlug : (company.classification?.subsectorSlug ?? null),
    confidence: result.confidence,
    state: autoAccept ? 'auto' : 'pending_review',
    provider: provider.name,
    model: provider.model,
    rationale: result.rationale,
    classifiedAt: new Date(),
    reviewedBy: null,
  } as any;
  await company.save();
  await invalidate(CacheNs.analytics, CacheNs.taxonomy);
  return { classificationId: String(decision._id), ...result, status: decision.status };
}

export async function reviewQueue(params: { sectorSlug?: string; limit: number; cursor?: string }) {
  const match: Record<string, unknown> = { status: 'pending_review' };
  if (params.sectorSlug) match.sectorSlug = params.sectorSlug;
  if (params.cursor) match._id = { $gt: new Types.ObjectId(params.cursor) };
  const items = await Classification.aggregate([
    { $match: match },
    { $sort: { confidence: 1, _id: 1 } },
    { $limit: params.limit },
    { $lookup: { from: 'companies', localField: 'companyId', foreignField: '_id', as: 'company' } },
    { $unwind: '$company' },
    {
      $project: {
        sectorSlug: 1, subsectorSlug: 1, confidence: 1, rationale: 1, alternatives: 1, provider: 1, model: 1, createdAt: 1,
        company: { _id: 1, slug: 1, name: 1, oneLiner: 1, description: 1, tags: 1, website: 1, logoUrl: 1, ycBatch: 1 },
      },
    },
  ]);
  const total = await Classification.countDocuments({ status: 'pending_review', ...(params.sectorSlug ? { sectorSlug: params.sectorSlug } : {}) });
  return { items, total };
}

export async function decideReview(
  classificationId: string,
  input: { action: 'accept' | 'override'; subsectorSlug?: string | null; note?: string },
  userId: string,
) {
  const item = await Classification.findById(classificationId);
  if (!item) throw notFound('Review item');
  if (item.status !== 'pending_review') throw conflict('This item has already been decided');

  let finalSlug = item.subsectorSlug ?? null;
  if (input.action === 'override') {
    finalSlug = input.subsectorSlug ?? null;
    if (finalSlug) {
      const node = await Sector.findOne({ slug: finalSlug }).lean();
      if (!node || node.parentSlug !== item.sectorSlug) throw badRequest('Subsector must belong to the same sector');
    }
  } else if (!finalSlug) {
    throw badRequest('Nothing to accept: the model proposed no subsector. Use override.');
  }

  item.status = input.action === 'accept' ? 'accepted' : 'overridden';
  item.finalSubsectorSlug = finalSlug;
  item.decidedBy = new Types.ObjectId(userId);
  item.decidedAt = new Date();
  item.reviewNote = input.note ?? '';
  await item.save();

  await Company.updateOne(
    { _id: item.companyId },
    {
      $set: {
        'classification.sectorSlug': item.sectorSlug,
        'classification.subsectorSlug': finalSlug,
        'classification.state': 'reviewed',
        'classification.confidence': 1,
        'classification.reviewedBy': new Types.ObjectId(userId),
        'classification.rationale': input.note || item.rationale,
      },
    },
  );
  await invalidate(CacheNs.analytics, CacheNs.taxonomy);
  return item.toObject();
}
