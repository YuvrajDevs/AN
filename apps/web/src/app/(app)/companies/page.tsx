'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Button, ConfidenceBadge, EmptyState, ErrorState, Kbd, Logo, PageHeader, StatusBadge, TableSkeleton } from '@/components/ui';
import { qs, useApi } from '@/lib/api';
import { usd } from '@/lib/format';
import type { CompanyListItem, TaxonomyNode } from '@/lib/types';

const SORTS = [
  { v: 'relevance', l: 'Relevance' },
  { v: 'raised', l: 'Disclosed funding' },
  { v: 'recent_round', l: 'Latest round' },
  { v: 'team', l: 'Team size' },
  { v: 'newest', l: 'Newest YC batch' },
  { v: 'name', l: 'Name' },
];

function CompaniesView() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const get = (k: string) => sp.get(k) ?? '';
  const [q, setQ] = useState(get('q'));
  const searchRef = useRef<HTMLInputElement>(null);
  const [cursor, setCursor] = useState(-1);

  const params = useMemo(
    () => ({
      q: get('q'),
      sector: get('sector'),
      subsector: get('subsector'),
      status: get('status'),
      state: get('state'),
      hasFunding: get('hasFunding'),
      sort: get('sort') || 'relevance',
      page: Number(get('page') || 1),
      pageSize: 25,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sp],
  );
  const { data, error, isLoading, mutate } = useApi<{ items: CompanyListItem[]; total: number }>(`/companies${qs(params)}`);
  const { data: tax } = useApi<{ taxonomy: TaxonomyNode[] }>('/sectors');
  const subsectorName = useMemo(() => {
    const m = new Map<string, string>();
    tax?.taxonomy.forEach((s) => s.children.forEach((c) => m.set(c.slug, c.name)));
    return m;
  }, [tax]);
  const sector = tax?.taxonomy.find((s) => s.slug === params.sector);

  function set(patch: Record<string, string | number | undefined>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === '') next.delete(k);
      else next.set(k, String(v));
    }
    if (!('page' in patch)) next.delete('page');
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  // Debounced search-as-you-type, kept in the URL so results are shareable.
  useEffect(() => {
    const t = setTimeout(() => {
      if (q !== get('q')) set({ q });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // j/k to move, Enter to open, "/" focuses search (page-level shortcut).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT';
      if (typing) {
        if (e.key === 'Escape') (e.target as HTMLElement).blur();
        return;
      }
      const items = data?.items ?? [];
      if (e.key === 'j') setCursor((c) => Math.min(c + 1, items.length - 1));
      if (e.key === 'k') setCursor((c) => Math.max(c - 1, 0));
      if (e.key === 'Enter' && items[cursor]) router.push(`/companies/${items[cursor].slug}`);
      if (e.key === 'f' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [data, cursor, router]);

  const pages = data ? Math.max(1, Math.ceil(data.total / params.pageSize)) : 1;
  const exportHref = `/api/companies/export.csv${qs({ ...params, page: undefined, pageSize: undefined, sort: undefined })}`;

  return (
    <>
      <PageHeader
        title="Companies"
        subtitle={data ? `${data.total.toLocaleString()} companies match` : 'Search and filter every tracked company'}
        actions={
          <a href={exportHref} className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3.5 text-sm font-medium hover:bg-muted" download>
            Export CSV
          </a>
        }
      />
      <div className="card mb-4 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="sm:col-span-2">
          <label htmlFor="q" className="label">
            Search <Kbd>f</Kbd>
          </label>
          <input id="q" ref={searchRef} className="input" placeholder="Name, product, keyword…" value={q} onChange={(e) => setQ(e.target.value)} type="search" />
        </div>
        <div>
          <label htmlFor="sector" className="label">
            Sector
          </label>
          <select id="sector" className="input" value={params.sector} onChange={(e) => set({ sector: e.target.value, subsector: undefined })}>
            <option value="">All sectors</option>
            {tax?.taxonomy.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="subsector" className="label">
            Subsector
          </label>
          <select id="subsector" className="input" value={params.subsector} disabled={!sector} onChange={(e) => set({ subsector: e.target.value })}>
            <option value="">{sector ? 'All subsectors' : 'Pick a sector first'}</option>
            {sector?.children.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="label">
            Status
          </label>
          <select id="status" className="input" value={params.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="">Any</option>
            <option value="active">Active</option>
            <option value="acquired">Acquired</option>
            <option value="inactive">Inactive</option>
            <option value="public">Public</option>
          </select>
        </div>
        <div>
          <label htmlFor="sort" className="label">
            Sort
          </label>
          <select id="sort" className="input" value={params.sort} onChange={(e) => set({ sort: e.target.value })}>
            {SORTS.map((s) => (
              <option key={s.v} value={s.v}>
                {s.l}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-6">
          {[
            { k: 'hasFunding', v: 'true', l: 'Has Form D funding' },
            { k: 'state', v: 'pending_review', l: 'Needs review' },
            { k: 'state', v: 'reviewed', l: 'Analyst-reviewed' },
          ].map((chip) => {
            const on = get(chip.k) === chip.v;
            return (
              <button
                key={chip.l}
                aria-pressed={on}
                onClick={() => set({ [chip.k]: on ? undefined : chip.v })}
                className={`rounded-full border px-2.5 py-1 text-xs ${on ? 'border-accent bg-accent/10 text-accent' : 'border-border text-subtle hover:text-fg'}`}
              >
                {chip.l}
              </button>
            );
          })}
          {sp.toString() && (
            <button
              className="ml-auto text-xs text-subtle hover:text-fg"
              onClick={() => {
                setQ('');
                router.replace(pathname);
              }}
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        {error ? (
          <ErrorState error={error} retry={() => mutate()} />
        ) : isLoading && !data ? (
          <TableSkeleton rows={10} cols={6} />
        ) : data && data.items.length === 0 ? (
          <EmptyState
            title="No companies match these filters"
            body="Try a broader search, or clear a filter."
            action={
              <Button
                size="sm"
                onClick={() => {
                  setQ('');
                  router.replace(pathname);
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="th">Company</th>
                  <th className="th">Subsector</th>
                  <th className="th">Classification</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Team</th>
                  <th className="th text-right">Disclosed</th>
                  <th className="th">YC</th>
                </tr>
              </thead>
              <tbody className={`divide-y divide-border ${isLoading ? 'opacity-60' : ''}`}>
                {data?.items.map((c, i) => (
                  <tr key={c._id} className={`hover:bg-muted/60 ${i === cursor ? 'bg-accent/5 outline outline-1 -outline-offset-1 outline-accent/40' : ''}`}>
                    <td className="td">
                      <Link href={`/companies/${c.slug}`} className="flex items-center gap-3">
                        <Logo src={c.logoUrl} name={c.name} />
                        <span className="min-w-0">
                          <span className="block font-medium hover:underline">
                            {c.name} {c.notable && <span title="Notable" aria-label="Notable">★</span>}
                          </span>
                          <span className="block max-w-xs truncate text-xs text-subtle">{c.oneLiner}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="td whitespace-nowrap text-subtle">{c.classification.subsectorSlug ? subsectorName.get(c.classification.subsectorSlug) ?? c.classification.subsectorSlug : '—'}</td>
                    <td className="td">
                      <ConfidenceBadge value={c.classification.confidence} state={c.classification.state} />
                    </td>
                    <td className="td">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="td tabular text-right">{c.teamSize ?? '—'}</td>
                    <td className="td tabular text-right font-medium">{usd(c.metrics.totalRaisedUsd)}</td>
                    <td className="td whitespace-nowrap text-subtle">{c.ycBatch ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > params.pageSize && (
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-subtle">
            <span>
              Page {params.page} of {pages} · <Kbd>j</Kbd>/<Kbd>k</Kbd> move · <Kbd>↵</Kbd> open
            </span>
            <span className="flex gap-2">
              <Button size="sm" disabled={params.page <= 1} onClick={() => set({ page: params.page - 1 })}>
                Previous
              </Button>
              <Button size="sm" disabled={params.page >= pages} onClick={() => set({ page: params.page + 1 })}>
                Next
              </Button>
            </span>
          </div>
        )}
      </div>
    </>
  );
}

export default function CompaniesPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={10} cols={6} />}>
      <CompaniesView />
    </Suspense>
  );
}
