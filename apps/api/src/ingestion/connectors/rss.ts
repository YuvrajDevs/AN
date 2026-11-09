import { XMLParser } from 'fast-xml-parser';
import { safeFetch } from '../../security/safeFetch';
import type { ConnectorContext, RssItemRecord } from '../types';

/**
 * RSS 2.0 / Atom feeds (company newsrooms, press-release wires that publish feeds).
 * Feed URLs are user-supplied, so they are fetched through the SSRF-safe client.
 */

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', parseTagValue: false, trimValues: true });

function text(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && '#text' in (v as Record<string, unknown>)) return String((v as Record<string, unknown>)['#text']);
  return String(v);
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function toIso(s: string): string | null {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function parseFeed(xml: string, feedUrl: string, companySlug: string | null = null): RssItemRecord[] {
  const doc = parser.parse(xml);
  const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

  if (doc?.rss?.channel) {
    return arr<any>(doc.rss.channel.item).map((it) => ({
      feedUrl,
      title: stripHtml(text(it.title)),
      link: text(it.link) || text(it.guid),
      publishedAt: toIso(text(it.pubDate)),
      summary: stripHtml(text(it['content:encoded']) || text(it.description)).slice(0, 6000),
      companySlug,
    }));
  }
  if (doc?.feed) {
    return arr<any>(doc.feed.entry).map((it) => {
      const links = arr<any>(it.link);
      const alt = links.find((l) => !l['@rel'] || l['@rel'] === 'alternate') ?? links[0];
      return {
        feedUrl,
        title: stripHtml(text(it.title)),
        link: alt?.['@href'] ?? '',
        publishedAt: toIso(text(it.published) || text(it.updated)),
        summary: stripHtml(text(it.content) || text(it.summary)).slice(0, 6000),
        companySlug,
      };
    });
  }
  throw new Error('Unrecognised feed format');
}

export async function runRssConnector(
  ctx: ConnectorContext,
  feeds: { url: string; companySlug?: string | null }[],
): Promise<{ fetched: number; published: number; errors: number }> {
  let published = 0;
  let errors = 0;
  for (const feed of feeds) {
    try {
      const res = await safeFetch(feed.url, { headers: { accept: 'application/rss+xml, application/atom+xml, application/xml' } });
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      for (const item of parseFeed(res.text, feed.url, feed.companySlug ?? null)) {
        if (!item.link || !/^https?:\/\//.test(item.link)) continue;
        await ctx.publish({ connector: 'rss', key: `rss:${item.link}`, data: item });
        published++;
      }
    } catch (err) {
      errors++;
      ctx.log('feed failed', { url: feed.url, err: (err as Error).message });
    }
  }
  return { fetched: feeds.length, published, errors };
}
