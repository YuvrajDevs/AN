import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../security/auth';
import { objectId, slug, validate } from '../security/validate';
import { decideReview, reviewQueue } from '../services/classification';

export const reviewRouter = Router();

reviewRouter.get(
  '/',
  validate({ query: z.object({ sector: slug.optional(), limit: z.coerce.number().int().min(1).max(100).default(25), cursor: objectId.optional() }) }),
  async (req, res) => {
    const q = req.query as unknown as { sector?: string; limit: number; cursor?: string };
    res.json(await reviewQueue({ sectorSlug: q.sector, limit: q.limit, cursor: q.cursor }));
  },
);

reviewRouter.post(
  '/:id/decision',
  requireRole('analyst'),
  validate({
    params: z.object({ id: objectId }),
    body: z.object({ action: z.enum(['accept', 'override']), subsectorSlug: slug.nullable().optional(), note: z.string().trim().max(1000).optional() }),
  }),
  async (req, res) => {
    res.json({ decision: await decideReview(req.params.id as string, req.body, req.user!.id) });
  },
);
