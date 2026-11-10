import { cached, CacheNs, invalidate } from '../lib/cache';
import { badRequest, conflict, notFound } from '../lib/errors';
import { slugify } from '../lib/text';
import { Company, Sector } from '../models';
import type { TaxonomyNodeForPrompt } from '../ai/types';

export interface TaxonomyNode {
  slug: string;
  name: string;
  description: string;
  keywords: string[];
  parentSlug: string | null;
  tracked: boolean;
  sourceTags: string[];
  color: string | null;
  order: number;
  companyCount: number;
  children: TaxonomyNode[];
}

export async function getTaxonomyTree(): Promise<TaxonomyNode[]> {
  return cached(CacheNs.taxonomy, 'tree', async () => {
    const [nodes, counts] = await Promise.all([
      Sector.find().sort({ order: 1, name: 1 }).lean(),
      Company.aggregate<{ _id: string; n: number }>([
        { $match: { 'classification.subsectorSlug': { $ne: null } } },
        { $group: { _id: '$classification.subsectorSlug', n: { $sum: 1 } } },
      ]),
    ]);
    const countBy = new Map(counts.map((c) => [c._id, c.n]));
    const bySlug = new Map<string, TaxonomyNode>();
    for (const n of nodes) {
      bySlug.set(n.slug, {
        slug: n.slug,
        name: n.name,
        description: n.description ?? '',
        keywords: n.keywords ?? [],
        parentSlug: n.parentSlug ?? null,
        tracked: Boolean(n.tracked),
        sourceTags: n.sourceTags ?? [],
        color: n.color ?? null,
        order: n.order ?? 0,
        companyCount: countBy.get(n.slug) ?? 0,
        children: [],
      });
    }
    const roots: TaxonomyNode[] = [];
    for (const node of bySlug.values()) {
      const parent = node.parentSlug ? bySlug.get(node.parentSlug) : null;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    for (const r of roots) r.companyCount = r.children.reduce((s, c) => s + c.companyCount, 0);
    return roots;
  });
}

export async function classifierNodes(sectorSlug: string): Promise<TaxonomyNodeForPrompt[]> {
  const children = await Sector.find({ parentSlug: sectorSlug }).sort({ order: 1 }).lean();
  return children.map((c) => ({ slug: c.slug, name: c.name, description: c.description ?? '', keywords: c.keywords ?? [] }));
}

export async function createNode(input: {
  name: string;
  slug?: string;
  parentSlug?: string | null;
  description?: string;
  keywords?: string[];
  tracked?: boolean;
  sourceTags?: string[];
}) {
  const slug = input.slug || slugify(input.name);
  if (await Sector.exists({ slug })) throw conflict(`A taxonomy node "${slug}" already exists`);
  let path: string[] = [];
  if (input.parentSlug) {
    const parent = await Sector.findOne({ slug: input.parentSlug }).lean();
    if (!parent) throw badRequest(`Parent "${input.parentSlug}" not found`);
    if ((parent.path ?? []).length >= 2) throw badRequest('Taxonomy depth is limited to sector → subsector → segment');
    path = [...(parent.path ?? []), parent.slug];
  }
  const order = await Sector.countDocuments({ parentSlug: input.parentSlug ?? null });
  const node = await Sector.create({
    slug,
    name: input.name,
    parentSlug: input.parentSlug ?? null,
    path,
    description: input.description ?? '',
    keywords: input.keywords ?? [],
    tracked: input.parentSlug ? false : Boolean(input.tracked),
    sourceTags: input.parentSlug ? [] : (input.sourceTags ?? []),
    order,
  });
  await invalidate(CacheNs.taxonomy, CacheNs.analytics);
  return node.toObject();
}

export async function updateNode(
  slug: string,
  patch: Partial<{ name: string; description: string; keywords: string[]; tracked: boolean; sourceTags: string[]; order: number }>,
) {
  const node = await Sector.findOneAndUpdate({ slug }, { $set: patch }, { new: true }).lean();
  if (!node) throw notFound('Taxonomy node');
  await invalidate(CacheNs.taxonomy, CacheNs.analytics);
  return node;
}

export async function deleteNode(slug: string) {
  const node = await Sector.findOne({ slug });
  if (!node) throw notFound('Taxonomy node');
  if (await Sector.exists({ parentSlug: slug })) throw conflict('Delete or move child nodes first');
  const inUse = await Company.countDocuments({ $or: [{ 'classification.subsectorSlug': slug }, { 'classification.sectorSlug': slug }] });
  if (inUse > 0) throw conflict(`${inUse} companies are classified here; reclassify them first`);
  await node.deleteOne();
  await invalidate(CacheNs.taxonomy, CacheNs.analytics);
}
