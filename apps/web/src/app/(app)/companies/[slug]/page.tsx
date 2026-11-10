'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { AddRoundForm } from '@/components/AddRoundForm';
import { useCan } from '@/components/session';
import { Badge, Button, Card, ConfidenceBadge, EmptyState, ErrorState, Logo, PageHeader, Skeleton, StatusBadge } from '@/components/ui';
import { api, ApiError, useApi } from '@/lib/api';
import { date, ROUND_LABELS, SOURCE_LABELS, pct, usd } from '@/lib/format';
import type { Company, FundingRound, Source, TaxonomyNode } from '@/lib/types';

interface Detail {
  company: Company;
  rounds: FundingRound[];
  sources: Source[];
  classificationHistory: { _id: string; subsectorSlug: string | null; confidence: number; status: string; provider: string; model: string; createdAt: string; rationale: string; finalSubsectorSlug: string | null }[];
  watchlists: { _id: string; name: string; contains: boolean }[];
}

export default function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data, error, mutate } = useApi<Detail>(`/companies/${slug}`);
  const { data: tax } = useApi<{ taxonomy: TaxonomyNode[] }>('/sectors');
  const { data: meta } = useApi<{ llm: { available: string[]; default: string } }>('/meta');
  const canAnalyse = useCan('analyst');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [addingRound, setAddingRound] = useState(false);

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-1/2" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );

  const { company: c, rounds, sources, classificationHistory, watchlists } = data;
  const names = new Map<string, string>();
  tax?.taxonomy.forEach((s) => {
    names.set(s.slug, s.name);
    s.children.forEach((ch) => names.set(ch.slug, ch.name));
  });
  const sourceById = new Map(sources.map((s) => [s._id, s]));

  async function reclassify(provider: string) {
    setBusy(provider);
    setMsg(null);
    try {
      const r = await api<{ subsectorSlug: string | null; confidence: number; status: string }>(`/companies/${slug}/classify`, { method: 'POST', json: { provider } });
      setMsg(`${provider}: ${r.subsectorSlug ? names.get(r.subsectorSlug) : 'no fit'} (${pct(r.confidence)}) → ${r.status.replace('_', ' ')}`);
      await mutate();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Classification failed');
    } finally {
      setBusy(null);
    }
  }

  async function toggleNotable() {
    await api(`/companies/${slug}`, { method: 'PATCH', json: { notable: !data!.company.notable } });
    mutate();
  }

  async function toggleWatch(id: string, contains: boolean) {
    await api(contains ? `/watchlists/${id}/companies/${slug}` : `/watchlists/${id}/companies`, contains ? { method: 'DELETE' } : { method: 'POST', json: { companySlug: slug } });
    mutate();
  }

  const sector = c.classification.sectorSlug ?? c.trackedSectors[0];

  return (
    <>
      <PageHeader
        crumbs={[
          { href: '/companies', label: 'Companies' },
          ...(sector ? [{ href: `/sectors/${sector}`, label: names.get(sector) ?? sector }] : []),
        ]}
        title={
          <span className="flex items-center gap-3">
            <Logo src={c.logoUrl} name={c.name} size={36} />
            {c.name}
            <StatusBadge status={c.status} />
          </span>
        }
        subtitle={c.oneLiner}
        actions={
          <>
            {canAnalyse && (
              <Button onClick={toggleNotable} aria-pressed={c.notable} title="Notable companies are featured first in landscapes">
                {c.notable ? '★ Notable' : '☆ Mark notable'}
              </Button>
            )}
            {c.website && (
              <a href={c.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full border border-border bg-surface px-4 text-sm font-medium hover:bg-muted">
                Website ↗
              </a>
            )}
            <Link href={`/briefs?company=${c.slug}`} className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-accent/90">
              Analyst brief
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="About" bodyClass="p-4">
            <p className="whitespace-pre-line break-words text-sm leading-relaxed">{c.description || c.oneLiner || 'No description available.'}</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
              {[
                ['HQ', [c.hq.city, c.hq.country].filter(Boolean).join(', ') || '—'],
                ['YC batch', c.ycBatch ?? '—'],
                ['Team size', c.teamSize ?? '—'],
                ['Disclosed funding', usd(c.metrics.totalRaisedUsd)],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <dt className="text-xs text-subtle">{k}</dt>
                  <dd className="tabular font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {c.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1">
                {c.tags.map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
            )}
          </Card>

          <Card
            title="Funding timeline"
            actions={
              <span className="flex items-center gap-3">
                <span className="text-xs text-subtle">{rounds.length} entries</span>
                {canAnalyse && !addingRound && (
                  <Button size="sm" onClick={() => setAddingRound(true)}>
                    Add round
                  </Button>
                )}
              </span>
            }
          >
            {addingRound && (
              <AddRoundForm
                companySlug={slug}
                onDone={() => {
                  setAddingRound(false);
                  mutate();
                }}
              />
            )}
            {rounds.length === 0 ? (
              <EmptyState title="No funding recorded" body="No primary-source funding has been linked to this company yet." />
            ) : (
              <ol className="relative px-4 py-4">
                <span className="absolute bottom-6 left-[27px] top-6 w-px bg-border" aria-hidden="true" />
                {rounds.map((r) => (
                  <li key={r._id} className="relative flex gap-4 pb-5 last:pb-0">
                    <span className={`relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-surface ${r.amountUsd ? 'bg-accent' : 'bg-subtle'}`} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="tabular text-base font-semibold">{usd(r.amountUsd, 'Undisclosed')}</span>
                        <Badge tone={r.roundType === 'accelerator' ? 'neutral' : 'accent'}>{ROUND_LABELS[r.roundType] ?? r.roundType}</Badge>
                        <span className="text-xs text-subtle">{date(r.date)}</span>
                      </div>
                      {r.targetAmountUsd ? <div className="text-xs text-subtle">Offering size {usd(r.targetAmountUsd)}</div> : null}
                      {r.investors.length > 0 && <div className="mt-0.5 text-xs">Investors: {r.investors.join(', ')}</div>}
                      <div className="mt-1 flex flex-wrap gap-2 text-xs">
                        {r.sourceIds.map((id) => {
                          const s = sourceById.get(id);
                          return s ? (
                            <a key={id} href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-accent hover:underline">
                              {SOURCE_LABELS[s.kind] ?? s.kind} ↗
                            </a>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card title="Sources" actions={<span className="text-xs text-subtle">Every fact on this page traces to one of these</span>}>
            <ul className="divide-y divide-border">
              {sources.map((s) => (
                <li key={s._id} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Badge>{SOURCE_LABELS[s.kind] ?? s.kind}</Badge>
                    <a href={s.url.startsWith('http') ? s.url : undefined} target="_blank" rel="noopener noreferrer nofollow" className="truncate text-sm font-medium hover:underline">
                      {s.title}
                    </a>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-subtle">{s.excerpt}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Classification" bodyClass="p-4 space-y-3">
            <div>
              <div className="text-xs text-subtle">{sector ? names.get(sector) : 'Sector'}</div>
              <div className="text-base font-semibold">{c.classification.subsectorSlug ? names.get(c.classification.subsectorSlug) : 'Not classified'}</div>
            </div>
            <ConfidenceBadge value={c.classification.confidence} state={c.classification.state} />
            {c.classification.rationale && <p className="text-xs text-subtle">{c.classification.rationale}</p>}
            {c.classification.state === 'pending_review' && (
              <Link href="/review" className="block text-xs text-accent hover:underline">
                In the review queue →
              </Link>
            )}
            {canAnalyse && meta && (
              <div className="border-t border-border pt-3">
                <div className="label">Re-run classifier</div>
                <div className="flex flex-wrap gap-1.5">
                  {meta.llm.available.map((p) => (
                    <Button key={p} size="sm" loading={busy === p} disabled={!!busy} onClick={() => reclassify(p)}>
                      {p}
                    </Button>
                  ))}
                </div>
                {msg && (
                  <p className="mt-2 text-xs" role="status">
                    {msg}
                  </p>
                )}
              </div>
            )}
            {classificationHistory.length > 0 && (
              <details className="border-t border-border pt-3 text-xs">
                <summary className="cursor-pointer text-subtle">History ({classificationHistory.length})</summary>
                <ul className="mt-2 space-y-2">
                  {classificationHistory.map((h) => (
                    <li key={h._id}>
                      <span className="font-medium">{names.get(h.finalSubsectorSlug ?? h.subsectorSlug ?? '') ?? 'no fit'}</span> · {pct(h.confidence)} · {h.provider} ·{' '}
                      <span className="text-subtle">{h.status.replace('_', ' ')}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Card>

          <Card title="Watchlists" bodyClass="p-4">
            {watchlists.length === 0 ? (
              <p className="text-xs text-subtle">
                You have no watchlists.{' '}
                <Link className="text-accent underline" href="/watchlists">
                  Create one
                </Link>
              </p>
            ) : (
              <ul className="space-y-2">
                {watchlists.map((w) => (
                  <li key={w._id}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" checked={w.contains} onChange={() => toggleWatch(w._id, w.contains)} className="accent-[rgb(var(--accent))]" />
                      {w.name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {c.legalNames.length > 0 && (
            <Card title="Linked SEC entities" bodyClass="p-4 text-xs space-y-1">
              {c.legalNames.map((n) => (
                <div key={n}>{n}</div>
              ))}
              <div className="text-subtle">CIK {c.externalIds.secCiks.join(', ')}</div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
