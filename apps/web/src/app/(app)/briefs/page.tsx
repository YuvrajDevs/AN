'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { CompanyPicker } from '@/components/CompanyPicker';
import { useCan } from '@/components/session';
import { Badge, Button, EmptyState, ErrorState, PageHeader, TableSkeleton } from '@/components/ui';
import { api, ApiError, useApi } from '@/lib/api';
import { relative } from '@/lib/format';
import type { TaxonomyNode } from '@/lib/types';

interface BriefRow {
  _id: string;
  title: string;
  scope: { type: 'sector' | 'company'; slug: string };
  status: 'queued' | 'running' | 'ready' | 'failed';
  provider: string;
  model: string;
  createdAt: string;
  error: string | null;
}

function BriefsView() {
  const sp = useSearchParams();
  const router = useRouter();
  const { data, error, mutate } = useApi<{ items: BriefRow[] }>('/briefs', {
    refreshInterval: (d) => (d?.items.some((b) => b.status === 'queued' || b.status === 'running') ? 2000 : 0),
  });
  const { data: tax } = useApi<{ taxonomy: TaxonomyNode[] }>('/sectors');
  const { data: meta } = useApi<{ llm: { available: string[]; default: string } }>('/meta');
  const canCreate = useCan('analyst');
  const [scopeType, setScopeType] = useState<'sector' | 'company'>(sp.get('company') ? 'company' : 'sector');
  const [slug, setSlug] = useState(sp.get('company') ?? sp.get('sector') ?? '');
  const [provider, setProvider] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ brief: { _id: string } }>('/briefs', { method: 'POST', json: { scope: { type: scopeType, slug }, provider: provider || undefined } });
      await mutate();
      router.push(`/briefs/${r.brief._id}`);
    } catch (error) {
      setErr(error instanceof ApiError ? error.message : 'Could not start brief');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Analyst briefs" subtitle="LLM-drafted, but every claim must cite a stored source — uncited or unsupported claims are dropped before you see them." />
      {canCreate && (
        <form onSubmit={create} className="card mb-6 flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="label" htmlFor="b-type">
              Scope
            </label>
            <select id="b-type" className="input w-32" value={scopeType} onChange={(e) => (setScopeType(e.target.value as 'sector' | 'company'), setSlug(''))}>
              <option value="sector">Sector</option>
              <option value="company">Company</option>
            </select>
          </div>
          <div className="min-w-[14rem] flex-1">
            <label className="label" htmlFor="b-slug">
              {scopeType === 'sector' ? 'Sector' : 'Company'}
            </label>
            {scopeType === 'sector' ? (
              <select id="b-slug" className="input" value={slug} onChange={(e) => setSlug(e.target.value)} required>
                <option value="">Choose…</option>
                {tax?.taxonomy.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <CompanyPicker id="b-slug" value={slug} onChange={setSlug} />
            )}
          </div>
          <div>
            <label className="label" htmlFor="b-provider">
              Model provider
            </label>
            <select id="b-provider" className="input w-40" value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="">Default ({meta?.llm.default ?? '…'})</option>
              {meta?.llm.available.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="primary" loading={busy} disabled={!slug}>
            Generate brief
          </Button>
          {err && (
            <p role="alert" className="w-full text-body text-danger">
              {err}
            </p>
          )}
        </form>
      )}
      <div className="card overflow-hidden">
        {error ? (
          <ErrorState error={error} retry={() => mutate()} />
        ) : !data ? (
          <TableSkeleton rows={5} cols={4} />
        ) : data.items.length === 0 ? (
          <EmptyState title="No briefs yet" body="Generate a sector or company brief above." />
        ) : (
          <ul className="divide-y divide-border">
            {data.items.map((b) => (
              <li key={b._id}>
                <Link href={`/briefs/${b._id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{b.title}</span>
                    <span className="block text-caption text-subtle">
                      {b.scope.type} · {b.provider} ({b.model}) · {relative(b.createdAt)}
                    </span>
                  </span>
                  {b.status !== 'ready' && <Badge tone={b.status === 'failed' ? 'danger' : 'warning'}>{b.status === 'failed' ? 'failed' : 'drafting…'}</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export default function BriefsPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={5} cols={4} />}>
      <BriefsView />
    </Suspense>
  );
}
