import { config } from '../config';
import { LlmError } from './types';
import { postJson } from './providers/http';

/**
 * Text embeddings for retrieval (RAG).
 *
 * Gemini embeddings are asymmetric: stored passages use RETRIEVAL_DOCUMENT and questions use
 * RETRIEVAL_QUERY. Vectors are truncated to EMBEDDING_DIMS and L2-normalised so a dot product
 * is cosine similarity. Vectors from different models live in different spaces, so the index
 * records which model built it and queries always use that same model.
 */

export type EmbedTask = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

export interface Embedder {
  readonly model: string;
  readonly dims: number;
  embed(texts: string[], task: EmbedTask): Promise<number[][]>;
}

export function normalise(v: number[]): number[] {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}

export function dot(a: number[], b: number[]): number {
  let s = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) s += a[i] * b[i];
  return s;
}

const BATCH = 100; // Gemini batchEmbedContents accepts up to 100 requests per call.

export class GeminiEmbedder implements Embedder {
  readonly dims: number;
  constructor(
    readonly model = config.GEMINI_EMBEDDING_MODEL,
    private apiKey = config.GEMINI_API_KEY,
    dims = config.EMBEDDING_DIMS,
  ) {
    this.dims = dims;
  }

  async embed(texts: string[], task: EmbedTask): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH) {
      const slice = texts.slice(i, i + BATCH);
      const data = await postJson(
        'gemini',
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:batchEmbedContents`,
        { 'x-goog-api-key': this.apiKey },
        {
          requests: slice.map((text) => ({
            model: `models/${this.model}`,
            content: { parts: [{ text: text.slice(0, 8000) }] },
            taskType: task,
            outputDimensionality: this.dims,
          })),
        },
      );
      const vecs: unknown = data?.embeddings;
      if (!Array.isArray(vecs) || vecs.length !== slice.length) {
        throw new LlmError('gemini returned an unexpected embeddings payload', 'gemini');
      }
      for (const e of vecs as { values?: number[] }[]) {
        if (!Array.isArray(e.values) || e.values.length === 0) throw new LlmError('gemini returned an empty embedding', 'gemini');
        out.push(normalise(e.values.slice(0, this.dims)));
      }
    }
    return out;
  }
}

/**
 * Deterministic offline embedder for tests and keyless local runs: hashed bag of words and
 * character trigrams. It captures lexical overlap only, and is labelled as such everywhere.
 */
export class HashEmbedder implements Embedder {
  readonly model = 'hash-v1';
  constructor(readonly dims = 256) {}

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => {
      const v = new Array(this.dims).fill(0);
      const words = t.toLowerCase().match(/[a-z0-9]+/g) ?? [];
      const add = (s: string, w: number) => {
        let h = 2166136261;
        for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
        v[Math.abs(h) % this.dims] += w;
      };
      for (const w of words) {
        add(w, 1);
        for (let i = 0; i + 3 <= w.length; i++) add(`#${w.slice(i, i + 3)}`, 0.3);
      }
      return normalise(v);
    });
  }
}

let override: Embedder | null = null;
let cached: Embedder | null = null;

/** Tests inject an embedder here. */
export function setEmbedderOverride(e: Embedder | null) {
  override = e;
}

/** Gemini when a key is configured, otherwise the lexical hash embedder. */
export function getEmbedder(): Embedder {
  if (override) return override;
  if (!cached) cached = config.GEMINI_API_KEY ? new GeminiEmbedder() : new HashEmbedder();
  return cached;
}

/** An embedder for a specific stored model name (queries must match the index's model). */
export function embedderFor(model: string): Embedder | null {
  const current = getEmbedder();
  if (current.model === model) return current;
  if (model === 'hash-v1') return new HashEmbedder();
  if (config.GEMINI_API_KEY && model.startsWith('gemini-')) return new GeminiEmbedder(model);
  return null;
}
