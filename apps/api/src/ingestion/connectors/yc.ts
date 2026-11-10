import type { ConnectorContext, YcCompanyRecord } from '../types';

/**
 * Y Combinator public company directory, via the community-maintained yc-oss mirror
 * (https://github.com/yc-oss/api, MIT), which republishes the public directory as JSON.
 * Only public profile fields are used.
 */
export const YC_ALL_URL = 'https://yc-oss.github.io/api/companies/all.json';

export interface YcRaw {
  id: number;
  name: string;
  slug: string;
  website?: string | null;
  small_logo_thumb_url?: string | null;
  all_locations?: string | null;
  long_description?: string | null;
  one_liner?: string | null;
  team_size?: number | null;
  industry?: string | null;
  subindustry?: string | null;
  launched_at?: number | null;
  tags?: string[];
  industries?: string[];
  status?: string | null;
  batch?: string | null;
  url?: string;
}

export interface SectorSelector {
  slug: string;
  sourceTags: string[];
}

/** The directory uses a relative placeholder ("/company/thumb/missing.png") when there is no logo. */
export function absoluteUrl(u?: string | null): string | null {
  return u && /^https:\/\//i.test(u) ? u : null;
}

const SEASON_MONTH: Record<string, number> = { winter: 0, spring: 3, summer: 5, fall: 8 };

/** "Winter 2024" -> 2024-01-01, "Summer 2015" -> 2015-06-01. */
export function batchToDate(batch?: string | null): string | null {
  const m = /^(winter|spring|summer|fall)\s+(\d{4})$/i.exec(batch?.trim() ?? '');
  if (!m) return null;
  return new Date(Date.UTC(Number(m[2]), SEASON_MONTH[m[1].toLowerCase()], 1)).toISOString();
}

export function batchShort(batch?: string | null): string | null {
  const m = /^(winter|spring|summer|fall)\s+(\d{4})$/i.exec(batch?.trim() ?? '');
  if (!m) return batch ?? null;
  return `${{ winter: 'W', spring: 'X', summer: 'S', fall: 'F' }[m[1].toLowerCase()]}${m[2].slice(2)}`;
}

function mapStatus(s?: string | null): YcCompanyRecord['status'] {
  switch ((s ?? '').toLowerCase()) {
    case 'acquired':
      return 'acquired';
    case 'inactive':
      return 'inactive';
    case 'public':
      return 'public';
    default:
      return 'active';
  }
}

/** Which tracked sectors does this YC company belong to (by directory tags / industries)? */
export function matchSectors(c: YcRaw, selectors: SectorSelector[]): string[] {
  const labels = new Set(
    [...(c.tags ?? []), ...(c.industries ?? []), c.industry ?? '', ...(c.subindustry ?? '').split('->')]
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
  );
  return selectors.filter((s) => s.sourceTags.some((t) => labels.has(t.toLowerCase()))).map((s) => s.slug);
}

export function mapYc(c: YcRaw, sectors: string[], retrievedAt: string): YcCompanyRecord {
  return {
    ycId: String(c.id),
    slug: c.slug,
    name: c.name.trim(),
    website: c.website || null,
    oneLiner: (c.one_liner ?? '').trim(),
    description: (c.long_description ?? '').trim(),
    logoUrl: absoluteUrl(c.small_logo_thumb_url),
    teamSize: typeof c.team_size === 'number' ? c.team_size : null,
    status: mapStatus(c.status),
    batch: c.batch ?? null,
    batchDate: batchToDate(c.batch),
    location: c.all_locations || null,
    tags: c.tags ?? [],
    industries: c.industries ?? [],
    sectors,
    profileUrl: c.url ?? `https://www.ycombinator.com/companies/${c.slug}`,
    retrievedAt,
  };
}

export async function fetchYcDirectory(fetchImpl: typeof fetch = fetch): Promise<YcRaw[]> {
  const res = await fetchImpl(YC_ALL_URL, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`YC directory HTTP ${res.status}`);
  return (await res.json()) as YcRaw[];
}

export async function runYcConnector(
  ctx: ConnectorContext,
  selectors: SectorSelector[],
  opts: { limit?: number; companies?: YcRaw[] } = {},
): Promise<{ fetched: number; published: number }> {
  const all = opts.companies ?? (await fetchYcDirectory());
  const retrievedAt = new Date().toISOString();
  let published = 0;
  for (const c of all) {
    const sectors = matchSectors(c, selectors);
    if (sectors.length === 0) continue;
    await ctx.publish({ connector: 'yc', key: `yc:${c.slug}`, data: mapYc(c, sectors, retrievedAt) });
    published++;
    if (opts.limit && published >= opts.limit) break;
  }
  ctx.log('yc connector finished', { fetched: all.length, published });
  return { fetched: all.length, published };
}
