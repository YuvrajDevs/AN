import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Runs in its own worker process: allow-list loopback so real sockets can be exercised.
vi.stubEnv('FETCH_ALLOW_HOSTS', '127.0.0.1');

let server: http.Server;
let base = '';
let lastBody = '';

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      lastBody = body;
      if (req.url === '/redirect') res.writeHead(302, { location: '/feed' }).end();
      else if (req.url === '/to-metadata') res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' }).end();
      else if (req.url === '/big') res.writeHead(200).end('x'.repeat(5000));
      else if (req.url === '/loop') res.writeHead(302, { location: '/loop' }).end();
      else res.writeHead(200, { 'content-type': 'application/rss+xml' }).end('<rss><channel><item><title>Hello</title><link>https://e.com/a</link></item></channel></rss>');
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe('safeFetch over real sockets', () => {
  it('connects through the pinned lookup and follows a redirect', async () => {
    const { safeFetch } = await import('../../src/security/safeFetch');
    const res = await safeFetch(`${base}/redirect`);
    expect(res.status).toBe(200);
    expect(res.url).toBe(`${base}/feed`);
    expect(res.text).toContain('<title>Hello</title>');
  });

  it('re-validates every redirect hop (blocks a redirect to cloud metadata)', async () => {
    const { safeFetch, BlockedUrlError } = await import('../../src/security/safeFetch');
    await expect(safeFetch(`${base}/to-metadata`)).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it('caps redirects and response size', async () => {
    const { safeFetch } = await import('../../src/security/safeFetch');
    await expect(safeFetch(`${base}/loop`)).rejects.toThrow(/Too many redirects/);
    await expect(safeFetch(`${base}/big`, { maxBytes: 1000 })).rejects.toThrow(/too large/);
  });

  it('POSTs a body and does not replay it across redirects', async () => {
    const { safeFetch } = await import('../../src/security/safeFetch');
    const res = await safeFetch(`${base}/redirect`, { method: 'POST', body: '{"a":1}', headers: { 'content-type': 'application/json' } });
    expect(res.status).toBe(302);
    expect(lastBody).toBe('{"a":1}');
  });

  it('parses a feed fetched end to end by the RSS connector', async () => {
    const { runRssConnector } = await import('../../src/ingestion/connectors/rss');
    const published: unknown[] = [];
    const warnings: string[] = [];
    const r = await runRssConnector(
      { publish: async (x) => void published.push(x), log: () => undefined, warn: (m) => void warnings.push(m) },
      [{ url: `${base}/feed` }, { url: 'http://10.0.0.1/feed' }],
    );
    expect(r).toEqual({ fetched: 2, published: 1, errors: 1 });
    expect(warnings[0]).toMatch(/private or reserved/);
  });
});
