import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../lib/errors';
import { Brief } from '../models';
import { enqueue } from '../queue/jobs';
import { requireRole } from '../security/auth';
import { llmLimiter } from '../security/rateLimit';
import { objectId, slug, validate } from '../security/validate';
import { createBriefRecord } from '../services/briefs';

export const briefsRouter = Router();

briefsRouter.get('/', validate({ query: z.object({ scopeType: z.enum(['sector', 'company']).optional(), slug: slug.optional() }) }), async (req, res) => {
  const q = req.query as { scopeType?: string; slug?: string };
  const filter: Record<string, unknown> = {};
  if (q.scopeType) filter['scope.type'] = q.scopeType;
  if (q.slug) filter['scope.slug'] = q.slug;
  const items = await Brief.find(filter).sort({ createdAt: -1 }).limit(50).select('title scope status provider model createdAt error').lean();
  res.json({ items });
});

briefsRouter.get('/:id', validate({ params: z.object({ id: objectId }) }), async (req, res) => {
  const brief = await Brief.findById(req.params.id).populate('sourceIds', 'kind url title publisher publishedAt excerpt').lean();
  if (!brief) throw notFound('Brief');
  res.json({ brief });
});

briefsRouter.post(
  '/',
  requireRole('analyst'),
  llmLimiter(),
  validate({
    body: z.object({
      scope: z.object({ type: z.enum(['sector', 'company']), slug }),
      provider: z.enum(['openai', 'anthropic', 'gemini', 'heuristic']).optional(),
    }),
  }),
  async (req, res) => {
    const brief = await createBriefRecord(req.body.scope, req.user!.id, req.body.provider);
    await enqueue('generate-brief', { briefId: String(brief._id) }, { jobId: `brief:${brief._id}` });
    res.status(202).json({ brief });
  },
);
