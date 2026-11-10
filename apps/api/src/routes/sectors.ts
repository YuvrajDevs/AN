import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../security/auth';
import { slug, validate } from '../security/validate';
import { sectorLandscape } from '../services/analytics';
import { createNode, deleteNode, getTaxonomyTree, updateNode } from '../services/taxonomy';

export const sectorsRouter = Router();

sectorsRouter.get('/', async (_req, res) => {
  res.json({ taxonomy: await getTaxonomyTree() });
});

sectorsRouter.get('/:slug/landscape', validate({ params: z.object({ slug }) }), async (req, res) => {
  res.json(await sectorLandscape(req.params.slug as string));
});

const keywordList = z.array(z.string().trim().min(1).max(60)).max(80);

sectorsRouter.post(
  '/',
  requireRole('analyst'),
  validate({
    body: z.object({
      name: z.string().trim().min(2).max(120),
      slug: slug.optional(),
      parentSlug: slug.nullable().optional(),
      description: z.string().trim().max(2000).optional(),
      keywords: keywordList.optional(),
      tracked: z.boolean().optional(),
      sourceTags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
    }),
  }),
  async (req, res) => {
    res.status(201).json({ node: await createNode(req.body) });
  },
);

sectorsRouter.patch(
  '/:slug',
  requireRole('analyst'),
  validate({
    params: z.object({ slug }),
    body: z
      .object({
        name: z.string().trim().min(2).max(120),
        description: z.string().trim().max(2000),
        keywords: keywordList,
        tracked: z.boolean(),
        sourceTags: z.array(z.string().trim().min(1).max(60)).max(20),
        order: z.number().int().min(0).max(1000),
      })
      .partial()
      .strict(),
  }),
  async (req, res) => {
    res.json({ node: await updateNode(req.params.slug as string, req.body) });
  },
);

sectorsRouter.delete('/:slug', requireRole('admin'), validate({ params: z.object({ slug }) }), async (req, res) => {
  await deleteNode(req.params.slug as string);
  res.status(204).end();
});
