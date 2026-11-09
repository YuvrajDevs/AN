import { Sector } from '../models';
import { TAXONOMY } from './taxonomy';

/** Insert default taxonomy nodes that do not exist yet (never overwrites analyst edits). */
export async function seedTaxonomy() {
  for (const [i, sector] of TAXONOMY.entries()) {
    await Sector.updateOne(
      { slug: sector.slug },
      {
        $setOnInsert: {
          name: sector.name, description: sector.description, parentSlug: null, path: [], keywords: [],
          tracked: true, sourceTags: sector.sourceTags, color: sector.color ?? null, order: i,
        },
      },
      { upsert: true },
    );
    for (const [j, child] of sector.children.entries()) {
      await Sector.updateOne(
        { slug: child.slug },
        { $setOnInsert: { name: child.name, description: child.description, parentSlug: sector.slug, path: [sector.slug], keywords: child.keywords ?? [], order: j } },
        { upsert: true },
      );
    }
  }
}
