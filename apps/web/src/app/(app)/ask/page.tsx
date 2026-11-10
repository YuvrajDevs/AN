'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowUp, ExternalLink } from 'lucide-react';
import { Badge, Card, PageHeader, Spinner, buttonClass, cx } from '@/components/ui';
import { api, ApiError, useApi } from '@/lib/api';

interface Passage {
  ref: string;
  id: string;
  kind: 'company' | 'round' | 'dataset';
  title: string;
  text: string;
  url: string | null;
  companySlug: string | null;
  score: number;
  via: string[];
}

interface AskResult {
  question: string;
  answerable: boolean;
  claims: { text: string; refs: string[] }[];
  passages: Passage[];
  rejected: { text: string; reason: string }[];
  provider: string;
  model: string;
  answerMode: 'generated' | 'extractive';
  retrieval: { dense: string; model: string | null; ms: number };
  ms: number;
}

interface Status {
  passages: number;
  embedded: number;
  model: string | null;
}

const EXAMPLES = [
  'Which startups help lawyers review contracts?',
  'Who is working on carbon removal?',
  'How much has WePay disclosed in Form D filings?',
  'How many Legal AI companies does Strata track?',
  'Payment APIs for marketplaces',
];

const KIND_LABEL = { company: 'Company', round: 'Form D filing', dataset: 'Sector snapshot' } as const;

export default function AskPage() {
  const { data: status } = useApi<Status>('/ask/status');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<AskResult | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  async function run(question: string) {
    const text = question.trim();
    if (text.length < 3 || busy) return;
    setQ(text);
    setBusy(true);
    setErr(null);
    setFocus(null);
    try {
      setRes(await api<AskResult>('/ask', { method: 'POST', json: { question: text } }));
    } catch (error) {
      setErr(error instanceof ApiError ? error.message : 'Could not reach the server. Try again in a few seconds.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Ask Strata"
        subtitle="Questions answered from the stored dataset only. Every sentence cites the passages it came from, and any claim with a number that is not in its sources is dropped."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(q);
        }}
        className="card mb-3 flex items-center gap-2 p-2 pl-4"
      >
        <label htmlFor="ask-q" className="sr-only">Question</label>
        <input
          id="ask-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={300}
          placeholder="Ask about companies, sectors or funding…"
          className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none placeholder:text-subtle/80"
          autoComplete="off"
        />
        <button type="submit" disabled={busy || q.trim().length < 3} className={buttonClass('primary', 'md', 'shrink-0 gap-1.5 disabled:opacity-50')} aria-label="Ask">
          {busy ? <Spinner /> : <ArrowUp className="h-4 w-4" />} Ask
        </button>
      </form>

      <div className="mb-6 flex flex-wrap gap-2">
        {EXAMPLES.map((e) => (
          <button key={e} type="button" onClick={() => run(e)} disabled={busy} className="rounded-full border border-border bg-surface px-3 py-1 text-[13px] text-subtle hover:border-fg/40 hover:text-fg disabled:opacity-50">
            {e}
          </button>
        ))}
      </div>

      {err && (
        <p role="alert" className="mb-4 text-sm text-danger">
          {err}
        </p>
      )}

      {!res && !busy && (
        <Card bodyClass="p-5">
          <p className="text-sm text-subtle">
            {status?.embedded
              ? `${status.embedded.toLocaleString()} passages indexed with ${status.model}: company profiles, SEC Form D filings and sector snapshots.`
              : 'The search index is being built. Keyword search works meanwhile.'}
          </p>
          <p className="mt-2 text-sm text-subtle/80">
            Retrieval combines semantic search (Gemini embeddings), keyword search and exact company names, merged by reciprocal rank fusion.
          </p>
        </Card>
      )}

      {busy && !res && (
        <Card bodyClass="p-5">
          <p className="flex items-center gap-2 text-sm text-subtle">
            <Spinner /> Searching the dataset and drafting a cited answer…
          </p>
        </Card>
      )}

      {res && (
        <div className={cx('grid gap-4 lg:grid-cols-[1.2fr_1fr]', busy && 'opacity-60')} aria-busy={busy} aria-live="polite">
          <Card
            bodyClass="p-5"
            title="Answer"
            actions={
              <Badge tone={res.answerMode === 'generated' ? 'accent' : 'neutral'}>
                {res.answerMode === 'generated' ? `${res.model}` : 'Closest passages (no model)'}
              </Badge>
            }
          >
            {res.answerable && res.claims.length ? (
              <ul className="space-y-3">
                {res.claims.map((c, i) => (
                  <li key={i} className="text-[15px] leading-relaxed">
                    {c.text}{' '}
                    {c.refs.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onMouseEnter={() => setFocus(r)}
                        onFocus={() => setFocus(r)}
                        onClick={() => {
                          setFocus(r);
                          document.getElementById(`p-${r}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }}
                        className="ml-0.5 rounded bg-accent/15 px-1.5 py-0.5 align-middle font-mono text-[11px] font-semibold text-fg hover:bg-accent hover:text-accent-fg"
                      >
                        {r}
                      </button>
                    ))}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[15px] text-subtle">The dataset does not contain an answer to that. Try naming a company, a sector (Legal AI, Climate Tech, Payments) or a kind of product.</p>
            )}
            <p className="mt-4 border-t border-border pt-3 text-xs text-subtle/80">
              {res.answerMode === 'extractive'
                ? 'The language model was unavailable, so these are the opening lines of the best-matching passages.'
                : `${res.claims.length} claim${res.claims.length === 1 ? '' : 's'} passed the citation check${res.rejected.length ? `; ${res.rejected.length} dropped for unsupported citations or numbers` : ''}.`}{' '}
              Retrieval {res.retrieval.ms} ms ({res.retrieval.dense === 'atlas-vector-search' ? 'Atlas Vector Search' : res.retrieval.dense === 'in-process-cosine' ? 'cosine search' : 'keyword only'}), total {(res.ms / 1000).toFixed(1)} s.
            </p>
          </Card>

          <Card title={`Sources (${res.passages.length})`} bodyClass="p-0">
            <ol className="divide-y divide-border">
              {res.passages.map((p) => (
                <li key={p.ref} id={`p-${p.ref}`} className={cx('px-4 py-3 transition-colors', focus === p.ref && 'bg-accent/10')}>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold">{p.ref}</span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        {p.companySlug ? <Link href={`/companies/${p.companySlug}`} className="hover:underline">{p.title}</Link> : p.title}
                        <span className="text-[11px] font-normal text-subtle/80">{KIND_LABEL[p.kind]}</span>
                      </p>
                      <p className="mt-1 line-clamp-3 text-[13px] leading-snug text-subtle">{p.text}</p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-subtle/80">
                        {p.via.map((v) => (
                          <span key={v} className="rounded-full border border-border px-1.5">{v}</span>
                        ))}
                        {p.url?.startsWith('http') && (
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-fg">
                            original <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      )}
    </>
  );
}
