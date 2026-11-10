import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { badRequest, notFound } from '../lib/errors';
import { Alert, Company, Watchlist } from '../models';
import { BlockedUrlError, resolveSafeTarget } from '../security/safeFetch';
import { objectId, slug, validate } from '../security/validate';
import { unreadCount } from '../services/alerts';

export const watchlistsRouter = Router();
export const alertsRouter = Router();

const webhook = z
  .string()
  .trim()
  .url()
  .max(2000)
  .refine((u) => u.startsWith('https://'), 'Webhook URLs must use https')
  .nullable()
  .optional();

async function assertSafeWebhook(url?: string | null) {
  if (!url) return;
  try {
    await resolveSafeTarget(url); // reject private/internal targets at save time, and again at send time
  } catch (err) {
    if (err instanceof BlockedUrlError) throw badRequest(`Webhook URL rejected: ${err.message}`);
    throw err;
  }
}

const listBody = z.object({
  name: z.string().trim().min(1).max(120),
  sectorSlugs: z.array(slug).max(30).default([]),
  companySlugs: z.array(slug).max(500).default([]),
  minAmountUsd: z.number().nonnegative().nullable().optional(),
  webhookUrl: webhook,
});

async function slugsToIds(slugs: string[]) {
  if (!slugs.length) return [];
  const docs = await Company.find({ slug: { $in: slugs } }).select('_id').lean();
  return docs.map((d) => d._id);
}

async function ownList(id: string, userId: string) {
  const list = await Watchlist.findOne({ _id: id, userId });
  if (!list) throw notFound('Watchlist'); // 404 (not 403) for other users' lists: no existence leak
  return list;
}

watchlistsRouter.get('/', async (req, res) => {
  const lists = await Watchlist.find({ userId: req.user!.id }).sort({ createdAt: -1 }).populate('companyIds', 'slug name logoUrl metrics classification.subsectorSlug').lean();
  res.json({ items: lists });
});

watchlistsRouter.post('/', validate({ body: listBody }), async (req, res) => {
  await assertSafeWebhook(req.body.webhookUrl);
  const list = await Watchlist.create({
    userId: req.user!.id,
    name: req.body.name,
    sectorSlugs: req.body.sectorSlugs,
    companyIds: await slugsToIds(req.body.companySlugs),
    minAmountUsd: req.body.minAmountUsd ?? null,
    webhookUrl: req.body.webhookUrl ?? null,
  });
  res.status(201).json({ watchlist: list });
});

watchlistsRouter.patch('/:id', validate({ params: z.object({ id: objectId }), body: listBody.partial() }), async (req, res) => {
  const list = await ownList(req.params.id as string, req.user!.id);
  await assertSafeWebhook(req.body.webhookUrl);
  if (req.body.name !== undefined) list.name = req.body.name;
  if (req.body.sectorSlugs !== undefined) list.sectorSlugs = req.body.sectorSlugs;
  if (req.body.companySlugs !== undefined) list.companyIds = (await slugsToIds(req.body.companySlugs)) as any;
  if (req.body.minAmountUsd !== undefined) list.minAmountUsd = req.body.minAmountUsd;
  if (req.body.webhookUrl !== undefined) list.webhookUrl = req.body.webhookUrl;
  await list.save();
  res.json({ watchlist: list });
});

watchlistsRouter.post('/:id/companies', validate({ params: z.object({ id: objectId }), body: z.object({ companySlug: slug }) }), async (req, res) => {
  const list = await ownList(req.params.id as string, req.user!.id);
  const company = await Company.findOne({ slug: req.body.companySlug }).select('_id').lean();
  if (!company) throw notFound('Company');
  await Watchlist.updateOne({ _id: list._id }, { $addToSet: { companyIds: company._id } });
  res.status(204).end();
});

watchlistsRouter.delete('/:id/companies/:slug', validate({ params: z.object({ id: objectId, slug }) }), async (req, res) => {
  const list = await ownList(req.params.id as string, req.user!.id);
  const company = await Company.findOne({ slug: req.params.slug }).select('_id').lean();
  if (company) await Watchlist.updateOne({ _id: list._id }, { $pull: { companyIds: company._id } });
  res.status(204).end();
});

watchlistsRouter.delete('/:id', validate({ params: z.object({ id: objectId }) }), async (req, res) => {
  const list = await ownList(req.params.id as string, req.user!.id);
  await Alert.deleteMany({ watchlistId: list._id });
  await list.deleteOne();
  res.status(204).end();
});

alertsRouter.get('/', validate({ query: z.object({ unread: z.enum(['true']).optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }) }), async (req, res) => {
  const q = req.query as unknown as { unread?: 'true'; limit: number };
  const filter: Record<string, unknown> = { userId: new Types.ObjectId(req.user!.id) };
  if (q.unread) filter.read = false;
  const [items, unread] = await Promise.all([
    Alert.find(filter)
      .sort({ createdAt: -1 })
      .limit(q.limit)
      .populate('companyId', 'slug name logoUrl')
      .populate('fundingRoundId', 'date roundType amountUsd')
      .populate('watchlistId', 'name')
      .lean(),
    unreadCount(req.user!.id),
  ]);
  res.json({ items, unread });
});

alertsRouter.get('/unread-count', async (req, res) => {
  res.json({ unread: await unreadCount(req.user!.id) });
});

alertsRouter.post('/read', validate({ body: z.object({ ids: z.array(objectId).max(200).optional(), all: z.boolean().optional() }) }), async (req, res) => {
  const filter: Record<string, unknown> = { userId: new Types.ObjectId(req.user!.id) };
  if (!req.body.all) filter._id = { $in: (req.body.ids ?? []).map((id: string) => new Types.ObjectId(id)) };
  const r = await Alert.updateMany(filter, { $set: { read: true } });
  res.json({ updated: r.modifiedCount });
});
