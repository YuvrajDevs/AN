'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCan } from '@/components/session';
import { Badge, Button, ConfidenceBadge, EmptyState, ErrorState, Kbd, Logo, PageHeader, TableSkeleton, cx } from '@/components/ui';
import { api, ApiError, qs, useApi } from '@/lib/api';
import { pct } from '@/lib/format';
import type { ReviewItem, TaxonomyNode } from '@/lib/types';

/**
 * Human-in-the-loop review. Keyboard first:
 *   j / k  move   ·   a  accept   ·   1-9  override with subsector N   ·   0  mark out of scope
 */
export default function ReviewPage() {
  const [sector, setSector] = useState('');
  const { data, error, mutate, isLoading } = useApi<{ items: ReviewItem[]; total: number }>(`/review${qs({ sector, limit: 50 })}`);
  const { data: tax } = useApi<{ taxonomy: TaxonomyNode[] }>('/sectors');
  const canDecide = useCan('analyst');
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const items = data?.items ?? [];
  const current = items[index];
  const options = useMemo(() => tax?.taxonomy.find((s) => s.slug === current?.sectorSlug)?.children ?? [], [tax, current]);
  const names = useMemo(() => {
    const m = new Map<string, string>();
    tax?.taxonomy.forEach((s) => s.children.forEach((c) => m.set(c.slug, c.name)));
    return m;
  }, [tax]);

  useEffect(() => {
    if (index >= items.length && items.length) setIndex(items.length - 1);
  }, [items.length, index]);

  const decide = useCallback(
    async (action: 'accept' | 'override', subsectorSlug?: string | null) => {
      if (!current || busy || !canDecide) return;
      setBusy(true);
      try {
        await api(`/review/${current._id}/decision`, { method: 'POST', json: { action, subsectorSlug } });
        setToast(`${current.company.name} → ${action === 'accept' ? names.get(current.subsectorSlug ?? '') : subsectorSlug ? names.get(subsectorSlug) : 'out of scope'}`);
        // Optimistic: drop the item locally, then revalidate.
        await mutate((d) => (d ? { items: d.items.filter((i) => i._id !== current._id), total: d.total - 1 } : d), { revalidate: true });
      } catch (err) {
        setToast(err instanceof ApiError ? err.message : 'Could not save decision');
      } finally {
        setBusy(false);
      }
    },
    [current, busy, canDecide, mutate, names],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName) || e.metaKey || e.ctrlKey) return;
      if (e.key === 'j') setIndex((i) => Math.min(i + 1, items.length - 1));
      else if (e.key === 'k') setIndex((i) => Math.max(i - 1, 0));
      else if (e.key === 'a' && current) {
        if (current.subsectorSlug) decide('accept');
        else decide('override', null);
      }
      else if (e.key === '0') decide('override', null);
      else if (/^[1-9]$/.test(e.key)) {
        const opt = options[Number(e.key) - 1];
        if (opt) decide('override', opt.slug);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items.length, current, options, decide]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <>
      <PageHeader
        title="Review queue"
        subtitle="Classifications below the confidence threshold wait here for an analyst. Lowest confidence first."
        actions={
          <select aria-label="Sector" className="input w-48" value={sector} onChange={(e) => (setSector(e.target.value), setIndex(0))}>
            <option value="">All sectors</option>
            {tax?.taxonomy.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        }
      />
      {!canDecide && <p className="mb-4 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">You have viewer access: decisions require the analyst role.</p>}
      {error ? (
        <ErrorState error={error} retry={() => mutate()} />
      ) : isLoading && !data ? (
        <TableSkeleton rows={8} cols={3} />
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState icon="✓" title="Queue is clear" body="Every classification is either confident enough to auto-accept or has been reviewed." action={<Link href="/companies" className="text-sm text-accent hover:underline">Browse companies →</Link>} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
          <div className="card max-h-[70vh] overflow-y-auto">
            <div className="sticky top-0 border-b border-border bg-surface px-3 py-2 text-xs text-subtle">
              {data?.total} pending · <Kbd>j</Kbd>/<Kbd>k</Kbd>
            </div>
            <ul aria-label="Pending items">
              {items.map((it, i) => (
                <li key={it._id}>
                  <button onClick={() => setIndex(i)} aria-current={i === index ? 'true' : undefined} className={cx('flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left', i === index ? 'bg-pink/50' : 'hover:bg-muted')}>
                    <Logo src={it.company.logoUrl} name={it.company.name} size={22} />
                    <span className="min-w-0 flex-1 truncate text-sm">{it.company.name}</span>
                    <span className="tabular text-xs text-subtle">{pct(it.confidence)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {current && (
            <div className="card p-5">
              <div className="flex items-start gap-3">
                <Logo src={current.company.logoUrl} name={current.company.name} size={40} />
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold">
                    <Link href={`/companies/${current.company.slug}`} className="hover:underline">
                      {current.company.name}
                    </Link>
                  </h2>
                  <p className="text-sm text-subtle">{current.company.oneLiner}</p>
                </div>
                {current.company.ycBatch && <Badge>{current.company.ycBatch}</Badge>}
              </div>
              <p tabIndex={0} aria-label="Company description" className="mt-4 max-h-40 overflow-y-auto whitespace-pre-line rounded-lg text-sm leading-relaxed">{current.company.description || 'No description.'}</p>
              {current.company.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {current.company.tags.map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>
              )}

              <div className="mt-5 rounded-md border border-border bg-bg p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-subtle">Model proposal</span>
                  <span className="font-semibold">{current.subsectorSlug ? names.get(current.subsectorSlug) : 'No subsector fits'}</span>
                  <ConfidenceBadge value={current.confidence} />
                  <span className="text-xs text-subtle">
                    {current.provider} · {current.model}
                  </span>
                </div>
                <p className="mt-2 text-sm">{current.rationale}</p>
                {current.alternatives.length > 0 && (
                  <p className="mt-1 text-xs text-subtle">
                    Alternatives: {current.alternatives.map((a) => `${names.get(a.subsectorSlug)} (${pct(a.confidence)})`).join(', ')}
                  </p>
                )}
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center gap-2">
                  {/* "No subsector fits" is a proposal too: accepting it confirms the company is out of scope. */}
                  <Button variant="primary" disabled={!canDecide} loading={busy} onClick={() => (current.subsectorSlug ? void decide('accept') : void decide('override', null))}>
                    {current.subsectorSlug ? 'Accept' : 'Accept: out of scope'} <Kbd>a</Kbd>
                  </Button>
                  <span className="text-xs text-subtle">or choose the right subsector:</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {options.map((o, i) => (
                    <button
                      key={o.slug}
                      disabled={busy || !canDecide}
                      onClick={() => decide('override', o.slug)}
                      className={cx(
                        'flex items-start gap-2 rounded-md border px-3 py-2 text-left text-sm disabled:opacity-50',
                        o.slug === current.subsectorSlug ? 'border-ink/30 bg-yellow/30' : 'border-border hover:bg-muted',
                      )}
                    >
                      <Kbd>{i + 1}</Kbd>
                      <span>
                        <span className="block font-medium">{o.name}</span>
                        <span className="line-clamp-2 text-xs text-subtle">{o.description}</span>
                      </span>
                    </button>
                  ))}
                  <button disabled={busy || !canDecide} onClick={() => decide('override', null)} className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50">
                    <Kbd>0</Kbd> Out of scope for this sector
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {toast && (
        <div role="status" className="fixed bottom-4 right-4 z-40 animate-[fadeUp_240ms_cubic-bezier(0.22,1,0.36,1)] rounded-full bg-ink px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
