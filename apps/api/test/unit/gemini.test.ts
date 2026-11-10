import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { GeminiProvider } from '../../src/ai/providers/llm';
import type { JsonRequest } from '../../src/ai/types';

const req: JsonRequest<{ ok: boolean }> = { system: 's', user: 'u', schemaName: 'test', jsonSchema: { type: 'object' }, zod: z.object({ ok: z.boolean() }) };
const answer = { candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text: '{"ok":true}' }] } }] };

function mockGemini(status: Record<string, number>) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const model = decodeURIComponent(url.match(/models\/([^:]+):/)![1]);
      calls.push(model);
      const code = status[model] ?? 200;
      return code === 200 ? new Response(JSON.stringify(answer), { status: 200 }) : new Response('{"error":{}}', { status: code });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('Gemini model fallback', () => {
  it('falls back when the primary is overloaded, and stays on the model that answered', async () => {
    const calls = mockGemini({ 'm-primary': 503 });
    const p = new GeminiProvider('k', 'm-primary', 'm-backup');
    await expect(p.generateJson(req)).resolves.toEqual({ ok: true });
    expect(p.model).toBe('m-backup');
    expect(calls.filter((m) => m === 'm-primary').length).toBe(2); // bounded retries, then move on
    await p.generateJson(req);
    expect(calls.at(-1)).toBe('m-backup'); // sticky: does not hammer the overloaded model
  });

  it('skips a retired model (404) without retrying it', async () => {
    const calls = mockGemini({ 'm-old': 404 });
    const p = new GeminiProvider('k', 'm-old', 'm-new');
    await p.generateJson(req);
    expect(calls).toEqual(['m-old', 'm-new']);
  });

  it('does not fall back on a client error such as a bad key', async () => {
    mockGemini({ 'm-a': 403 });
    const p = new GeminiProvider('k', 'm-a', 'm-b');
    await expect(p.generateJson(req)).rejects.toThrow(/HTTP 403/);
  });

  it('ignores thought parts when parsing the answer', async () => {
    mockGemini({});
    await expect(new GeminiProvider('k', 'm', '').generateJson(req)).resolves.toEqual({ ok: true });
  });
});
