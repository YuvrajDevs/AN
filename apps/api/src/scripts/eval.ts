/**
 * Classification evaluation.
 *
 *   npm run eval -w apps/api                         # heuristic baseline (no key needed)
 *   npm run eval -w apps/api -- --provider anthropic # needs ANTHROPIC_API_KEY
 *   npm run eval -w apps/api -- --provider openai --split heldout --out ../../docs/eval-results.md
 *
 * Gold labels: apps/api/eval/classification.jsonl, hand-labelled by an analyst.
 *  - split "dev": Legal AI cohort. The heuristic keyword lists were written while reading
 *    these companies, so heuristic scores on dev are optimistic.
 *  - split "heldout": Climate + Payments samples, labelled after the keywords were frozen.
 *
 * Metrics: accuracy (null = "out of scope" is a valid label), macro-F1 over subsectors,
 * and the review-queue trade-off: share of companies auto-accepted at the confidence
 * threshold and the accuracy of those auto-accepted labels.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { classifyCompany } from '../ai/classify';
import { getProvider } from '../ai/registry';
import { config } from '../config';
import { TAXONOMY } from '../seed/taxonomy';

interface Example {
  id: string;
  split: 'dev' | 'heldout';
  sector: string;
  expected: string | null;
  name: string;
  oneLiner: string;
  description: string;
  tags: string[];
}

export interface EvalRow {
  id: string;
  split: string;
  sector: string;
  expected: string | null;
  predicted: string | null;
  confidence: number;
}

export function loadExamples(file = path.resolve(__dirname, '../../eval/classification.jsonl')): Example[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Example);
}

export function score(rows: EvalRow[], threshold: number) {
  const n = rows.length;
  const correct = rows.filter((r) => r.predicted === r.expected).length;
  const labels = [...new Set(rows.flatMap((r) => [r.expected, r.predicted]).filter((l): l is string => l !== null))];
  const f1s = labels.map((l) => {
    const tp = rows.filter((r) => r.predicted === l && r.expected === l).length;
    const fp = rows.filter((r) => r.predicted === l && r.expected !== l).length;
    const fn = rows.filter((r) => r.predicted !== l && r.expected === l).length;
    const p = tp + fp ? tp / (tp + fp) : 0;
    const rc = tp + fn ? tp / (tp + fn) : 0;
    return { label: l, precision: p, recall: rc, f1: p + rc ? (2 * p * rc) / (p + rc) : 0, support: tp + fn };
  });
  const auto = rows.filter((r) => r.predicted !== null && r.confidence >= threshold);
  const autoCorrect = auto.filter((r) => r.predicted === r.expected).length;
  return {
    n,
    accuracy: n ? correct / n : 0,
    macroF1: f1s.length ? f1s.reduce((s, x) => s + x.f1, 0) / f1s.length : 0,
    autoAcceptRate: n ? auto.length / n : 0,
    autoAcceptAccuracy: auto.length ? autoCorrect / auto.length : 0,
    perLabel: f1s.sort((a, b) => b.support - a.support),
  };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

async function main() {
  const args = process.argv.slice(2);
  const arg = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const providerName = arg('provider') ?? 'heuristic';
  const split = arg('split');
  const out = arg('out');
  // Free-tier LLM APIs limit requests per minute; pace calls (ms between requests).
  const delay = Number(arg('delay') ?? (providerName === 'heuristic' ? 0 : 7000));
  // Resumable: each prediction is cached per provider+model, so a rate-limited run can be continued.
  const cachePath = path.join(__dirname, '../../eval', `.cache-${providerName}.json`);
  const cache: Record<string, { predicted: string | null; confidence: number; model: string }> =
    providerName !== 'heuristic' && existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
  const models = new Set<string>();
  const provider = getProvider(providerName);
  const threshold = config.REVIEW_CONFIDENCE_THRESHOLD;

  const examples = loadExamples().filter((e) => !split || e.split === split);
  const rows: EvalRow[] = [];
  const failed: { id: string; error: string }[] = [];
  for (const [n, e] of examples.entries()) {
    if (n > 0 && delay) await new Promise((res) => setTimeout(res, delay));
    const sector = TAXONOMY.find((s) => s.slug === e.sector)!;
    const nodes = sector.children.map((c) => ({ slug: c.slug, name: c.name, description: c.description, keywords: c.keywords ?? [] }));
    const hit = cache[e.id];
    if (hit) {
      rows.push({ id: e.id, split: e.split, sector: e.sector, expected: e.expected, predicted: hit.predicted, confidence: hit.confidence });
      models.add(hit.model);
      continue;
    }
    try {
      let r: Awaited<ReturnType<typeof classifyCompany>> | undefined;
      // Per-minute quotas: wait and retry the same company rather than dropping it.
      for (let attempt = 0; ; attempt++) {
        try {
          r = await classifyCompany(provider, e, nodes);
          break;
        } catch (err) {
          if (attempt >= 4 || !/HTTP 429|quota/i.test((err as Error).message)) throw err;
          process.stderr.write(`\n  rate limited at ${e.id}; waiting 65s`);
          await new Promise((res) => setTimeout(res, 65_000));
        }
      }
      rows.push({ id: e.id, split: e.split, sector: e.sector, expected: e.expected, predicted: r.subsectorSlug, confidence: r.confidence });
      models.add(provider.model);
      if (providerName !== 'heuristic') {
        cache[e.id] = { predicted: r.subsectorSlug, confidence: r.confidence, model: provider.model };
        writeFileSync(cachePath, JSON.stringify(cache, null, 1));
      }
      if (provider.name !== 'heuristic') process.stderr.write(`\r  ${n + 1}/${examples.length}`);
    } catch (err) {
      // A failed call is not a prediction: scoring it as "out of scope" would inflate accuracy.
      failed.push({ id: e.id, error: (err as Error).message.slice(0, 120) });
      console.error(`\n  ${e.id}: ${(err as Error).message.slice(0, 160)}`);
    }
  }

  const groups: [string, EvalRow[]][] = [
    ['all', rows],
    ['dev (Legal AI)', rows.filter((r) => r.split === 'dev')],
    ['heldout (Climate + Payments)', rows.filter((r) => r.split === 'heldout')],
  ].filter(([, r]) => (r as EvalRow[]).length > 0) as [string, EvalRow[]][];

  const lines = [
    `## ${provider.name} (${[...models].join(', ') || provider.model}) — ${new Date().toISOString().slice(0, 10)}`,
    '',
    `Review threshold: ${threshold}`,
    '',
    ...(failed.length ? [`Excluded ${failed.length} of ${examples.length} companies where the provider call failed (not counted as predictions).`, ''] : []),
    '| Split | n | Accuracy | Macro-F1 | Auto-accepted | Accuracy of auto-accepted |',
    '|---|---:|---:|---:|---:|---:|',
    ...groups.map(([name, r]) => {
      const s = score(r, threshold);
      return `| ${name} | ${s.n} | ${pct(s.accuracy)} | ${s.macroF1.toFixed(3)} | ${pct(s.autoAcceptRate)} | ${pct(s.autoAcceptAccuracy)} |`;
    }),
    '',
    '<details><summary>Errors</summary>',
    '',
    '| Company | Expected | Predicted | Confidence |',
    '|---|---|---|---:|',
    ...rows.filter((r) => r.predicted !== r.expected).map((r) => `| ${r.id} | ${r.expected ?? '(out of scope)'} | ${r.predicted ?? '(none)'} | ${r.confidence.toFixed(2)} |`),
    '',
    '</details>',
    '',
  ];
  console.log(lines.join('\n'));
  if (out) {
    writeFileSync(out, lines.join('\n'));
    console.log(`written to ${out}`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
