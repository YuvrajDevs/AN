import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getBus, Topics } from '../../src/events';
import type { FormDRecord, RawRecord, YcCompanyRecord } from '../../src/ingestion/types';
import { Alert, Brief, Classification, Company, FundingRound, Source, User, Watchlist } from '../../src/models';
import { setProviderOverride } from '../../src/ai/registry';
import { MockProvider } from '../../src/ai/providers/heuristic';
import { startTestEnv, type TestEnv } from './helpers';

let env: TestEnv;

const yc = (over: Partial<YcCompanyRecord>): YcCompanyRecord => ({
  ycId: '1',
  slug: 'acme-legal',
  name: 'Acme Legal',
  website: 'https://acme-legal.example',
  oneLiner: 'AI contract review and negotiation for in-house teams',
  description: 'Acme Legal redlines commercial contracts.',
  logoUrl: null,
  teamSize: 12,
  status: 'active',
  batch: 'Winter 2024',
  batchDate: '2024-01-01T00:00:00.000Z',
  location: 'San Francisco, CA, USA',
  tags: ['LegalTech'],
  industries: ['B2B', 'Legal'],
  sectors: ['legal-ai'],
  profileUrl: 'https://www.ycombinator.com/companies/acme-legal',
  retrievedAt: '2026-11-01T00:00:00.000Z',
  ...over,
});

const formD = (over: Partial<FormDRecord>): FormDRecord => ({
  companySlug: 'acme-legal',
  matchMethod: 'exact_name',
  cik: '999',
  entityName: 'Acme Legal, Inc.',
  accessionNumber: '0000000999-25-000001',
  form: 'D',
  filingDate: '2025-03-01',
  dateOfFirstSale: '2025-02-15',
  totalOfferingAmount: 10_000_000,
  totalAmountSold: 8_000_000,
  totalNumberAlreadyInvested: 9,
  industryGroup: 'Other Technology',
  isEquity: true,
  previousAccessionNumber: null,
  yearOfInc: 2023,
  issuerCity: 'San Francisco',
  issuerState: 'CA',
  url: 'https://www.sec.gov/Archives/edgar/data/999/000000099925000001/primary_doc.xml',
  indexUrl: 'https://www.sec.gov/Archives/edgar/data/999/000000099925000001/0000000999-25-000001-index.htm',
  retrievedAt: '2026-11-01T00:00:00.000Z',
  ...over,
});

async function ingest(record: RawRecord) {
  await getBus().publish(Topics.ingestRaw, record.key, `ingest.${record.connector}`, record);
  await env.settle();
}

beforeAll(async () => {
  env = await startTestEnv();
});
afterAll(async () => {
  await env?.stop();
});

describe('auth', () => {
  it('rejects anonymous access to data', async () => {
    const res = await request(env.app).get('/api/companies');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('rejects bad credentials with a generic message', async () => {
    const a = await request(env.app).post('/api/auth/login').send({ email: 'analyst@test.dev', password: 'wrong-password' });
    const b = await request(env.app).post('/api/auth/login').send({ email: 'nobody@test.dev', password: 'wrong-password' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error.message).toBe(b.body.error.message);
  });

  it('blocks NoSQL operator injection in login', async () => {
    const res = await request(env.app).post('/api/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } });
    expect(res.status).toBe(400);
  });

  it('sets an httpOnly session cookie and never returns the password hash', async () => {
    const res = await request(env.app).post('/api/auth/login').send({ email: 'analyst@test.dev', password: 'correct-horse-battery' });
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/strata_session=.*HttpOnly.*SameSite=Lax/i);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('self-registration always creates a viewer', async () => {
    const res = await request(env.app).post('/api/auth/register').send({ email: 'new@test.dev', password: 'long-enough-pw', name: 'New', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('viewer');
    expect((await User.findOne({ email: 'new@test.dev' }))?.role).toBe('viewer');
  });

  it('sends security headers', async () => {
    const res = await request(env.app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('ingestion pipeline', () => {
  it('creates, classifies and funds a company from raw records, idempotently', async () => {
    const analyst = await User.findOne({ email: 'analyst@test.dev' });
    await Watchlist.create({ userId: analyst!._id, name: 'Legal', sectorSlugs: ['legal-ai'] });

    await ingest({ connector: 'yc', key: 'yc:acme-legal', data: yc({}) });
    const company = await Company.findOne({ slug: 'acme-legal' }).lean();
    expect(company?.classification?.subsectorSlug).toBe('legal-contracts');
    expect(company?.classification?.state).toBe('auto');
    expect(await FundingRound.countDocuments({ roundType: 'accelerator' })).toBe(1);

    await ingest({ connector: 'sec_form_d', key: 'sec:1', data: formD({}) });
    await ingest({ connector: 'sec_form_d', key: 'sec:1', data: formD({}) }); // replay
    await ingest({ connector: 'yc', key: 'yc:acme-legal', data: yc({}) }); // replay

    const rounds = await FundingRound.find({ roundType: 'reg_d_offering' }).lean();
    expect(rounds).toHaveLength(1);
    expect(rounds[0].amountUsd).toBe(8_000_000);
    expect(await Company.countDocuments()).toBe(1);
    expect(await Source.countDocuments({ kind: 'sec_form_d' })).toBe(1);
    expect(await Alert.countDocuments()).toBe(1); // one alert, despite the replay

    const updated = await Company.findOne({ slug: 'acme-legal' }).lean();
    expect(updated?.metrics?.totalRaisedUsd).toBe(8_000_000);
    expect(updated?.legalNames).toContain('Acme Legal, Inc.');
  });

  it('folds a Form D/A amendment into the original round', async () => {
    await ingest({
      connector: 'sec_form_d',
      key: 'sec:2',
      data: formD({ accessionNumber: '0000000999-25-000009', form: 'D/A', filingDate: '2025-06-01', indexUrl: 'https://www.sec.gov/Archives/edgar/data/999/000000099925000009/0000000999-25-000009-index.htm', previousAccessionNumber: '0000000999-25-000001', totalAmountSold: 10_000_000 }),
    });
    const rounds = await FundingRound.find({ roundType: 'reg_d_offering' }).lean();
    expect(rounds).toHaveLength(1);
    expect(rounds[0].amountUsd).toBe(10_000_000);
    expect(rounds[0].sourceIds).toHaveLength(2);
  });

  it('extracts a funding round from a press release and alerts', async () => {
    await ingest({
      connector: 'rss',
      key: 'rss:x',
      data: {
        feedUrl: 'https://news.example.com/feed',
        title: 'Acme Legal raises $20 million Series A',
        link: 'https://news.example.com/acme-a',
        publishedAt: '2026-03-01T00:00:00.000Z',
        summary: 'Acme Legal raised $20 million in a Series A round led by Example Ventures.',
        companySlug: 'acme-legal',
      },
    });
    const r = await FundingRound.findOne({ roundType: 'series_a' }).lean();
    expect(r).toMatchObject({ amountUsd: 20_000_000, investors: ['Example Ventures'] });
    expect(await Alert.countDocuments()).toBe(2);
  });

  it('sends low-confidence classifications to the review queue', async () => {
    await ingest({ connector: 'yc', key: 'yc:vague', data: yc({ ycId: '2', slug: 'vague-co', name: 'Vague Co', oneLiner: 'Agents for teams', description: '' }) });
    const c = await Company.findOne({ slug: 'vague-co' }).lean();
    expect(c?.classification?.state).toBe('pending_review');
    expect(await Classification.countDocuments({ companyId: c!._id, status: 'pending_review' })).toBe(1);
  });
});

describe('companies, search and export', () => {
  it('searches by prefix and filters by subsector', async () => {
    const agent = await env.login('viewer@test.dev');
    const res = await agent.get('/api/companies?q=acm');
    expect(res.status).toBe(200);
    expect(res.body.items.map((c: { slug: string }) => c.slug)).toContain('acme-legal');
    const f = await agent.get('/api/companies?sector=legal-ai&subsector=legal-contracts');
    expect(f.body.total).toBe(1);
  });

  it('validates query parameters', async () => {
    const agent = await env.login('viewer@test.dev');
    expect((await agent.get('/api/companies?pageSize=5000')).status).toBe(400);
    expect((await agent.get('/api/companies?sort=evil')).status).toBe(400);
  });

  it('returns a profile with rounds and sources', async () => {
    const agent = await env.login('viewer@test.dev');
    const res = await agent.get('/api/companies/acme-legal');
    expect(res.body.rounds.length).toBeGreaterThanOrEqual(3);
    expect(res.body.sources.length).toBeGreaterThanOrEqual(2);
    expect((await agent.get('/api/companies/does-not-exist')).status).toBe(404);
  });

  it('exports CSV', async () => {
    const agent = await env.login('viewer@test.dev');
    const res = await agent.get('/api/companies/export.csv?sector=legal-ai');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const lines = res.text.trim().split('\r\n');
    expect(lines[0]).toMatch(/^name,slug,website/);
    expect(lines.some((l) => l.startsWith('Acme Legal,acme-legal'))).toBe(true);
    const rounds = await agent.get('/api/funding/export.csv');
    expect(rounds.text).toContain('reg_d_offering');
  });
});

describe('review queue and roles', () => {
  it('forbids viewers from deciding', async () => {
    const item = await Classification.findOne({ status: 'pending_review' });
    const viewer = await env.login('viewer@test.dev');
    const res = await viewer.post(`/api/review/${item!._id}/decision`).send({ action: 'override', subsectorSlug: 'legal-workspace' });
    expect(res.status).toBe(403);
  });

  it('lets an analyst override, and protects the decision from re-classification', async () => {
    const item = await Classification.findOne({ status: 'pending_review' });
    const analyst = await env.login('analyst@test.dev');
    const queue = await analyst.get('/api/review');
    expect(queue.body.total).toBeGreaterThanOrEqual(1);
    const bad = await analyst.post(`/api/review/${item!._id}/decision`).send({ action: 'override', subsectorSlug: 'climate-carbon' });
    expect(bad.status).toBe(400);
    const res = await analyst.post(`/api/review/${item!._id}/decision`).send({ action: 'override', subsectorSlug: 'legal-workspace', note: 'horizontal agents' });
    expect(res.status).toBe(200);
    const c = await Company.findById(item!.companyId).lean();
    expect(c?.classification).toMatchObject({ subsectorSlug: 'legal-workspace', state: 'reviewed' });
    const again = await analyst.post(`/api/review/${item!._id}/decision`).send({ action: 'accept' });
    expect(again.status).toBe(409);
  });
});

describe('taxonomy', () => {
  it('lets analysts add nodes and blocks deleting nodes in use', async () => {
    const analyst = await env.login('analyst@test.dev');
    const created = await analyst.post('/api/sectors').send({ name: 'Legal Translation', parentSlug: 'legal-ai', description: 'Translation of legal documents', keywords: ['translation'] });
    expect(created.status).toBe(201);
    const admin = await env.login('admin@test.dev');
    expect((await admin.delete('/api/sectors/legal-contracts')).status).toBe(409);
    expect((await analyst.delete('/api/sectors/legal-translation')).status).toBe(403);
    expect((await admin.delete('/api/sectors/legal-translation')).status).toBe(204);
  });
});

describe('landscape analytics', () => {
  it('aggregates the market map, KPIs and funding trends', async () => {
    const agent = await env.login('viewer@test.dev');
    const res = await agent.get('/api/sectors/legal-ai/landscape');
    expect(res.status).toBe(200);
    expect(res.body.kpis.companies).toBe(2);
    expect(res.body.kpis.totalDisclosedUsd).toBe(30_000_000);
    const contracts = res.body.marketMap.find((m: { slug: string }) => m.slug === 'legal-contracts');
    expect(contracts.count).toBe(1);
    expect(res.body.fundingByYear.map((f: { year: number }) => f.year)).toEqual([2025, 2026]);
  });
});

describe('watchlists and safe outbound fetching', () => {
  it.each(['https://127.0.0.1/hook', 'https://169.254.169.254/latest', 'http://example.com/hook', 'https://localhost/x'])('rejects webhook %s', async (url) => {
    const agent = await env.login('analyst@test.dev');
    const res = await agent.post('/api/watchlists').send({ name: 'x', webhookUrl: url });
    expect(res.status).toBe(400);
  });

  it("hides other users' watchlists", async () => {
    const admin = await env.login('admin@test.dev');
    const own = await admin.post('/api/watchlists').send({ name: 'Admin list', sectorSlugs: ['legal-ai'] });
    const analyst = await env.login('analyst@test.dev');
    expect((await analyst.delete(`/api/watchlists/${own.body.watchlist._id}`)).status).toBe(404);
    expect((await analyst.get('/api/watchlists')).body.items.every((w: { name: string }) => w.name !== 'Admin list')).toBe(true);
  });

  it('lists and marks alerts as read', async () => {
    const agent = await env.login('analyst@test.dev');
    const res = await agent.get('/api/alerts');
    expect(res.body.unread).toBe(2);
    await agent.post('/api/alerts/read').send({ all: true });
    expect((await agent.get('/api/alerts/unread-count')).body.unread).toBe(0);
  });
});

describe('briefs', () => {
  it('generates a cited brief with the offline provider', async () => {
    const agent = await env.login('analyst@test.dev');
    const res = await agent.post('/api/briefs').send({ scope: { type: 'sector', slug: 'legal-ai' }, provider: 'heuristic' });
    expect(res.status).toBe(202);
    await env.settle();
    const b = await Brief.findById(res.body.brief._id).lean();
    expect(b?.status).toBe('ready');
    const claims = b!.sections.flatMap((s) => s.claims);
    expect(claims.length).toBeGreaterThan(3);
    expect(claims.every((c) => c.sourceIds.length > 0)).toBe(true);
    const full = await agent.get(`/api/briefs/${b!._id}`);
    expect(full.body.brief.sourceIds[0]).toHaveProperty('url');
  });

  it('drops hallucinated claims from an LLM draft', async () => {
    const mock = new MockProvider([
      {
        sections: [
          {
            heading: 'Funding',
            claims: [
              { text: 'Acme Legal sold $10.0M in a Regulation D offering.', citations: ['S2'] },
              { text: 'Acme Legal is valued at $2B.', citations: ['S2'] },
              { text: 'The market is huge.', citations: [] },
            ],
          },
        ],
      },
    ]);
    setProviderOverride(mock);
    try {
      const agent = await env.login('analyst@test.dev');
      const res = await agent.post('/api/briefs').send({ scope: { type: 'sector', slug: 'legal-ai' } });
      await env.settle();
      const b = await Brief.findById(res.body.brief._id).lean();
      expect(b?.status).toBe('ready');
      expect(b!.sections[0].claims.map((c) => c.text)).toEqual(['Acme Legal sold $10.0M in a Regulation D offering.']);
      expect(b!.rejectedClaims).toHaveLength(2);
      expect(mock.calls[0].user).toContain('[S1]');
    } finally {
      setProviderOverride(null);
    }
  });

  it('only analysts can generate briefs', async () => {
    const viewer = await env.login('viewer@test.dev');
    expect((await viewer.post('/api/briefs').send({ scope: { type: 'sector', slug: 'legal-ai' } })).status).toBe(403);
  });
});
