import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HashEmbedder, setEmbedderOverride } from '../../src/ai/embeddings';
import { MockProvider } from '../../src/ai/providers/heuristic';
import { setProviderOverride } from '../../src/ai/registry';
import { getBus, Topics } from '../../src/events';
import type { FormDRecord, RawRecord, YcCompanyRecord } from '../../src/ingestion/types';
import { Chunk } from '../../src/models';
import { indexPassages, retrieve, rrf } from '../../src/services/rag';
import { startTestEnv, type TestEnv } from './helpers';

let env: TestEnv;

const yc = (over: Partial<YcCompanyRecord>): YcCompanyRecord => ({
  ycId: '1',
  slug: 'acme-legal',
  name: 'Acme Legal',
  website: 'https://acme-legal.example',
  oneLiner: 'AI contract review and negotiation for in-house teams',
  description: 'Acme Legal redlines commercial contracts for corporate lawyers.',
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

const formD: FormDRecord = {
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
};

async function ingest(record: RawRecord) {
  await getBus().publish(Topics.ingestRaw, record.key, `ingest.${record.connector}`, record);
  await env.settle();
}

beforeAll(async () => {
  env = await startTestEnv();
  setEmbedderOverride(new HashEmbedder());
  await ingest({ connector: 'yc', key: 'yc:acme-legal', data: yc({}) });
  await ingest({
    connector: 'yc',
    key: 'yc:carbonworks',
    data: yc({ ycId: '2', slug: 'carbonworks', name: 'CarbonWorks', oneLiner: 'Direct air capture machines that remove carbon dioxide', description: 'CarbonWorks builds carbon removal hardware.', tags: ['Climate'], industries: ['Climate'], sectors: ['climate-tech'], profileUrl: 'https://www.ycombinator.com/companies/carbonworks' }),
  });
  await ingest({
    connector: 'yc',
    key: 'yc:paylane',
    data: yc({ ycId: '3', slug: 'paylane', name: 'Paylane', oneLiner: 'Payments API for online marketplaces', description: 'Paylane splits payouts between buyers and sellers.', tags: ['Fintech', 'Payments'], industries: ['Fintech'], sectors: ['payments-infra'], profileUrl: 'https://www.ycombinator.com/companies/paylane' }),
  });
  await ingest({ connector: 'sec_form_d', key: 'sec:1', data: formD });
}, 120_000);

afterAll(async () => {
  setEmbedderOverride(null);
  setProviderOverride(null);
  await env.stop();
});

describe('Ask (RAG)', () => {
  it('indexes companies, Form D filings and sector snapshots, and re-embeds only what changed', async () => {
    const first = await indexPassages();
    expect(first.passages).toBeGreaterThanOrEqual(5);
    const kinds = new Set((await Chunk.find().select('kind').lean()).map((c) => c.kind));
    expect([...kinds].sort()).toEqual(['company', 'dataset', 'round']);
    expect(first.embedded).toBe(first.passages);
    expect(first.vectorIndex).toBe('local'); // no Atlas Search in tests: in-process cosine

    const again = await indexPassages();
    expect(again.embedded).toBe(again.passages - again.unchanged);
    // Sector snapshots are re-dated daily; company and filing passages stay cached.
    expect(again.unchanged).toBeGreaterThanOrEqual(4);
  });

  it('hybrid retrieval: names rank first, and each retriever is credited', async () => {
    const byName = await retrieve('Tell me about Paylane', 3);
    expect(byName.hits[0].companySlug).toBe('paylane');
    expect(byName.hits[0].via).toContain('name');

    const paraphrase = await retrieve('carbon dioxide removal machines', 3);
    expect(paraphrase.hits[0].companySlug).toBe('carbonworks');
    expect(paraphrase.mode.dense).toBe('in-process-cosine');
  });

  it('fuses rankings with reciprocal rank fusion', () => {
    const fused = rrf([
      { name: 'a', ids: ['x', 'y'] },
      { name: 'b', ids: ['y', 'z'] },
    ]);
    expect(fused[0].id).toBe('y');
    expect(fused[0].via).toEqual(['a', 'b']);
  });

  it('keeps cited claims, drops unsupported numbers and unknown citations', async () => {
    const mock = new MockProvider();
    setProviderOverride(mock);
    const analyst = await env.login('analyst@test.dev');
    const probe = await retrieve('How much did Acme Legal raise?', 8);
    const ref = `S${probe.hits.findIndex((h) => h.kind === 'round') + 1}`;
    mock.queue({
      answerable: true,
      claims: [
        { text: 'Acme Legal reported $8.0M sold in a Form D offering.', citations: [ref] },
        { text: 'Acme Legal raised $50M last year.', citations: [ref] },
        { text: 'It is the market leader.', citations: ['S99'] },
      ],
    });
    const res = await analyst.post('/api/ask').send({ question: 'How much did Acme Legal raise?' });
    expect(res.status).toBe(200);
    expect(res.body.answerMode).toBe('generated');
    expect(res.body.claims).toHaveLength(1);
    expect(res.body.claims[0].refs).toEqual([ref]);
    expect(res.body.rejected.map((r: { reason: string }) => r.reason).join(' ')).toMatch(/numbers not found.*unknown citation|unknown citation.*numbers not found/s);
    expect(mock.calls[0].system).toMatch(/Use ONLY the numbered passages/);
    expect(mock.calls[0].user).toContain('<passages>');
  });

  it('answers extractively, clearly labelled, when no model is used', async () => {
    setProviderOverride(null);
    const analyst = await env.login('analyst@test.dev');
    const res = await analyst.post('/api/ask').send({ question: 'payments API for marketplaces', provider: 'heuristic' });
    expect(res.status).toBe(200);
    expect(res.body.answerMode).toBe('extractive');
    expect(res.body.claims.length).toBeGreaterThan(0);
    expect(res.body.passages[0].companySlug).toBe('paylane');
  });

  it('requires sign-in, validates input, and limits reindexing to admins', async () => {
    expect((await request(env.app).post('/api/ask').send({ question: 'anything at all' })).status).toBe(401);
    const analyst = await env.login('analyst@test.dev');
    expect((await analyst.post('/api/ask').send({ question: 'x' })).status).toBe(400);
    expect((await analyst.post('/api/ask/reindex').send({})).status).toBe(403);
    const status = await analyst.get('/api/ask/status');
    expect(status.status).toBe(200);
    expect(status.body.embedded).toBeGreaterThan(0);
  });
});
