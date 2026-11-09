import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { matchEntity, parseFormDXml, plausibleFiling } from '../../src/ingestion/connectors/secFormD';
import { parseFeed } from '../../src/ingestion/connectors/rss';
import { absoluteUrl, batchShort, batchToDate, matchSectors, mapYc } from '../../src/ingestion/connectors/yc';
import { normalizeName, slugify } from '../../src/lib/text';
import { MemoryEventBus } from '../../src/events/memoryBus';
import { Topics } from '../../src/events/bus';

const fixture = (f: string) => readFileSync(path.join(__dirname, '../fixtures', f), 'utf8');

describe('text helpers', () => {
  it('normalises entity names', () => {
    expect(normalizeName('Legora, Inc.')).toBe('legora');
    expect(normalizeName('KODEX, INC.')).toBe('kodex');
    expect(normalizeName('Hona Software, Inc.')).toBe('hona software');
    expect(normalizeName('Noya PBC')).toBe('noya');
  });
  it('slugifies', () => {
    expect(slugify('&AI')).toBe('and-ai');
    expect(slugify('Solve Intelligence, Inc.')).toBe('solve-intelligence-inc');
  });
});

describe('SEC Form D', () => {
  it('parses a real Form D primary document', () => {
    const d = parseFormDXml(fixture('formd-legora.xml'));
    expect(d).toMatchObject({
      cik: '2071663',
      entityName: 'Legora, Inc.',
      form: 'D',
      dateOfFirstSale: '2025-05-19',
      totalOfferingAmount: 79_999_866,
      totalAmountSold: 79_849_626,
      totalNumberAlreadyInvested: 31,
      industryGroup: 'Other Technology',
      isEquity: true,
      yearOfInc: 2023,
    });
  });
  it('links entities conservatively', () => {
    expect(matchEntity('Legora', null, 'Legora, Inc.')).toBe('exact_name');
    expect(matchEntity('Hona', null, 'Hona Software, Inc.')).toBe('name_with_suffix');
    expect(matchEntity('Flo', 'https://www.florecruit.com', 'Flo Recruit Inc.')).toBe('domain_stem');
    expect(matchEntity('Parley', null, 'Parley Pro Inc.')).toBeNull();
    expect(matchEntity('Legalist', null, 'Legalist Fund II, L.P.')).toBeNull();
    expect(matchEntity('Pearson Labs', null, 'Pearson Labs Inc Nov 2024 a Series of CG')).toBeNull();
    expect(matchEntity('Balance', null, 'Balance Health Corp')).toBeNull();
  });
  it('rejects filings that predate the company', () => {
    expect(plausibleFiling({ filingDate: '2009-03-01', yearOfInc: null }, 2019)).toBe(false);
    expect(plausibleFiling({ filingDate: '2024-03-01', yearOfInc: 2012 }, 2026)).toBe(false);
    expect(plausibleFiling({ filingDate: '2025-07-01', yearOfInc: 2023 }, 2024)).toBe(true);
  });
});

describe('YC directory', () => {
  it('drops relative or non-https logo placeholders', () => {
    expect(absoluteUrl('/company/thumb/missing.png')).toBeNull();
    expect(absoluteUrl('http://insecure.example/logo.png')).toBeNull();
    expect(absoluteUrl('https://bookface-images.s3.amazonaws.com/x.png')).toBe('https://bookface-images.s3.amazonaws.com/x.png');
  });
  it('maps batches', () => {
    expect(batchToDate('Winter 2024')).toBe('2024-01-01T00:00:00.000Z');
    expect(batchShort('Summer 2015')).toBe('S15');
    expect(batchShort('Fall 2026')).toBe('F26');
  });
  it('matches sectors by tags and industries', () => {
    const raw = { id: 1, name: 'X', slug: 'x', tags: ['LegalTech'], industries: ['B2B'], subindustry: 'B2B -> Legal' };
    expect(matchSectors(raw, [{ slug: 'legal-ai', sourceTags: ['LegalTech'] }, { slug: 'climate', sourceTags: ['Climate'] }])).toEqual(['legal-ai']);
    expect(mapYc(raw, ['legal-ai'], '2026-01-01').status).toBe('active');
  });
});

describe('RSS / Atom', () => {
  it('parses RSS and strips HTML', () => {
    const items = parseFeed(fixture('feed.rss.xml'), 'https://news.example.com/feed');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ title: 'Acme Legal raises $12.5 million Series A', link: 'https://news.example.com/acme-series-a', publishedAt: '2026-03-03T14:00:00.000Z' });
    expect(items[0].summary).not.toContain('<p>');
  });
  it('parses Atom', () => {
    const [item] = parseFeed(fixture('feed.atom.xml'), 'https://atom.example.com/feed');
    expect(item).toMatchObject({ title: 'Widget Co secures $3M seed round', link: 'https://atom.example.com/widget-seed' });
  });
});

describe('memory event bus', () => {
  it('retries failing handlers, then dead-letters', async () => {
    const bus = new MemoryEventBus();
    let calls = 0;
    await bus.subscribe(Topics.ingestRaw, 'g', async () => {
      calls++;
      throw new Error('boom');
    });
    await bus.publish(Topics.ingestRaw, 'k', 't', { a: 1 });
    await bus.drain();
    expect(calls).toBe(3);
    expect(bus.deadLetters).toHaveLength(1);
    expect(bus.deadLetters[0].topic).toBe(`${Topics.ingestRaw}.dlq`);
  });
  it('delivers to every consumer group', async () => {
    const bus = new MemoryEventBus();
    const seen: string[] = [];
    await bus.subscribe(Topics.fundingCreated, 'a', async () => void seen.push('a'));
    await bus.subscribe(Topics.fundingCreated, 'b', async () => void seen.push('b'));
    await bus.publish(Topics.fundingCreated, 'k', 't', {});
    await bus.drain();
    expect(seen.sort()).toEqual(['a', 'b']);
  });
});
