import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../logger';
import { requireRole } from '../security/auth';
import { llmLimiter } from '../security/rateLimit';
import { validate } from '../security/validate';
import { ask, indexPassages, ragStatus, type IndexReport } from '../services/rag';

export const askRouter = Router();

let indexing: { startedAt: Date; report?: IndexReport; error?: string; finishedAt?: Date } | null = null;

askRouter.get('/status', async (_req, res) => {
  res.json({ ...(await ragStatus()), indexing });
});

askRouter.post(
  '/',
  llmLimiter(),
  validate({
    body: z.object({
      question: z.string().trim().min(3).max(300),
      provider: z.enum(['openai', 'anthropic', 'gemini', 'heuristic']).optional(),
    }),
  }),
  async (req, res) => {
    res.json(await ask(req.body.question, req.body.provider));
  },
);

/** Rebuild the retrieval index in the background (admins). Only changed passages are re-embedded. */
askRouter.post('/reindex', requireRole('admin'), validate({ body: z.object({ force: z.boolean().optional() }) }), async (req, res) => {
  if (indexing && !indexing.finishedAt) {
    res.status(409).json({ error: { message: 'An index run is already in progress', code: 'busy' } });
    return;
  }
  indexing = { startedAt: new Date() };
  const run = indexing;
  indexPassages({ force: req.body.force })
    .then((report) => Object.assign(run, { report, finishedAt: new Date() }))
    .catch((err) => {
      logger.error({ err }, 'rag: reindex failed');
      Object.assign(run, { error: (err as Error).message.slice(0, 300), finishedAt: new Date() });
    });
  res.status(202).json({ indexing });
});
