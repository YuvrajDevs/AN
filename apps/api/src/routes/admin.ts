import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { providerInfo } from '../ai/registry';
import { config } from '../config';
import { getBus } from '../events';
import { getRedis } from '../lib/redis';
import { IngestRun, ROLES, User } from '../models';
import { CONNECTORS } from '../ingestion/pipeline';
import { enqueue, jobCounts } from '../queue/jobs';
import { requireAuth, requireRole } from '../security/auth';
import { objectId, validate } from '../security/validate';
import { dashboard } from '../services/analytics';
import { badRequest, notFound } from '../lib/errors';

export const metaRouter = Router();
export const ingestRouter = Router();
export const usersRouter = Router();

metaRouter.get('/health', async (_req, res) => {
  const mongo = mongoose.connection.readyState === 1;
  let redis: boolean | null = null;
  const r = getRedis();
  if (r) redis = await r.ping().then(() => true).catch(() => false);
  res.status(mongo ? 200 : 503).json({ status: mongo ? 'ok' : 'degraded', mongo, redis, eventBus: config.EVENT_BUS });
});

metaRouter.get('/meta', requireAuth, async (_req, res) => {
  res.json({
    llm: providerInfo(),
    eventBus: getBus().kind,
    reviewThreshold: config.REVIEW_CONFIDENCE_THRESHOLD,
    jobs: await jobCounts().catch(() => null),
  });
});

metaRouter.get('/dashboard', requireAuth, async (_req, res) => {
  res.json(await dashboard());
});

const runBody = z.discriminatedUnion('connector', [
  z.object({ connector: z.literal('yc'), params: z.object({ limit: z.number().int().positive().max(10000).optional() }).default({}) }),
  z.object({
    connector: z.literal('sec_form_d'),
    params: z.object({ companySlugs: z.array(z.string().max(80)).max(500).optional(), limit: z.number().int().positive().max(5000).optional() }).default({}),
  }),
  z.object({
    connector: z.literal('rss'),
    params: z.object({ feeds: z.array(z.object({ url: z.string().url().max(2000), companySlug: z.string().max(80).optional() })).min(1).max(20) }),
  }),
  z.object({
    connector: z.literal('github'),
    params: z.object({ targets: z.array(z.object({ companySlug: z.string().max(80), org: z.string().regex(/^[A-Za-z0-9-]{1,39}$/) })).min(1).max(50) }),
  }),
]);

ingestRouter.get('/runs', async (_req, res) => {
  res.json({ items: await IngestRun.find().sort({ createdAt: -1 }).limit(30).lean(), connectors: CONNECTORS });
});

ingestRouter.post('/runs', requireRole('admin'), validate({ body: runBody }), async (req, res) => {
  await enqueue('run-connector', { connector: req.body.connector, params: req.body.params, triggeredBy: req.user!.id });
  res.status(202).json({ queued: true });
});

usersRouter.get('/', requireRole('admin'), async (_req, res) => {
  res.json({ items: await User.find().sort({ createdAt: 1 }).select('email name role createdAt lastLoginAt').lean() });
});

usersRouter.patch('/:id', requireRole('admin'), validate({ params: z.object({ id: objectId }), body: z.object({ role: z.enum(ROLES) }) }), async (req, res) => {
  // Prevents the last admin from locking everyone out by demoting themselves.
  if (req.params.id === req.user!.id) throw badRequest('You cannot change your own role');
  const user = await User.findByIdAndUpdate(req.params.id, { $set: { role: req.body.role } }, { new: true }).select('email name role').lean();
  if (!user) throw notFound('User');
  res.json({ user });
});
