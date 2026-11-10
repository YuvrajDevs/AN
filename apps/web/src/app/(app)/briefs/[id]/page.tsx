'use client';

import Link from 'next/link';
import { use, useMemo, useState } from 'react';
import { Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton, Spinner } from '@/components/ui';
import { useApi } from '@/lib/api';
import { date, SOURCE_LABELS } from '@/lib/format';
import type { Source } from '@/lib/types';

interface Brief {
  _id: string;
  title: string;
  scope: { type: string; slug: string };
  status: 'queued' | 'running' | 'ready' | 'failed';
  provider: string;
  model: string;
  createdAt: string;
  error: string | null;
  sections: { heading: string; claims: { text: string; sourceIds: string[] }[] }[];
  rejectedClaims: { text: string; reason: string }[];
  sourceIds: Source[];
}

export default function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, mutate } = useApi<{ brief: Brief }>(`/briefs/${id}`, {
    refreshInterval: (d) => (d && ['queued', 'running'].includes(d.brief.status) ? 1500 : 0),
  });
  const [focus, setFocus] = useState<string | null>(null);

  // Number sources in order of first citation, like footnotes.
  const order = useMemo(() => {
    const m = new Map<string, number>();
    data?.brief.sections.forEach((s) => s.claims.forEach((c) => c.sourceIds.forEach((sid) => !m.has(sid) && m.set(sid, m.size + 1))));
    return m;
  }, [data]);

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <Skeleton className="h-96" />;
  const b = data.brief;
  const sources = [...b.sourceIds].sort((a, z) => (order.get(a._id) ?? 99) - (order.get(z._id) ?? 99));

  return (
    <>
      <PageHeader
        crumbs={[{ href: '/briefs', label: 'Briefs' }]}
        title={b.title}
        subtitle={
          <>
            Drafted by {b.provider} ({b.model}) · {date(b.createdAt)} ·{' '}
            <Link className="text-accent hover:underline" href={b.scope.type === 'sector' ? `/sectors/${b.scope.slug}` : `/companies/${b.scope.slug}`}>
              open {b.scope.type}
            </Link>
          </>
        }
        actions={<Badge tone={b.status === 'ready' ? 'success' : b.status === 'failed' ? 'danger' : 'warning'}>{b.status}</Badge>}
      />
      {b.status === 'queued' || b.status === 'running' ? (
        <div className="card flex items-center justify-center gap-3 py-16 text-sm text-subtle" role="status">
          <Spinner /> Building the evidence pack and drafting… claims are checked against sources before they appear.
        </div>
      ) : b.status === 'failed' ? (
        <div className="card">
          <EmptyState icon="!" title="Brief failed" body={b.error ?? 'Unknown error'} />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <article className="card space-y-6 p-6">
            {b.sections.map((s) => (
              <section key={s.heading}>
                <h2 className="mb-2 text-base font-semibold">{s.heading}</h2>
                <ul className="space-y-2">
                  {s.claims.map((c, i) => (
                    <li key={i} className="text-sm leading-relaxed">
                      {c.text}{' '}
                      {c.sourceIds.map((sid) => (
                        <a
                          key={sid}
                          href={`#src-${sid}`}
                          onMouseEnter={() => setFocus(sid)}
                          onMouseLeave={() => setFocus(null)}
                          onFocus={() => setFocus(sid)}
                          onBlur={() => setFocus(null)}
                          className="ml-0.5 rounded bg-pink px-1 align-super text-[10px] font-semibold text-ink hover:bg-pink/70"
                          aria-label={`Source ${order.get(sid)}`}
                        >
                          {order.get(sid)}
                        </a>
                      ))}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {b.rejectedClaims.length > 0 && (
              <details className="rounded-md border border-dashed border-border p-3 text-xs">
                <summary className="cursor-pointer text-subtle">{b.rejectedClaims.length} draft claims were dropped by citation validation</summary>
                <ul className="mt-2 space-y-1">
                  {b.rejectedClaims.map((r, i) => (
                    <li key={i}>
                      <span className="line-through">{r.text}</span> — <span className="text-danger">{r.reason}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </article>
          <Card title={`Sources (${sources.length})`} className="h-fit lg:sticky lg:top-6">
            <ol className="divide-y divide-border">
              {sources.map((s) => (
                <li key={s._id} id={`src-${s._id}`} className={`px-4 py-3 text-xs transition-colors ${focus === s._id ? 'bg-pink/50' : ''}`}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-semibold text-accent">[{order.get(s._id)}]</span>
                    <Badge>{SOURCE_LABELS[s.kind] ?? s.kind}</Badge>
                  </div>
                  {s.url.startsWith('http') ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium hover:underline">
                      {s.title} ↗
                    </a>
                  ) : (
                    <span className="font-medium">{s.title}</span>
                  )}
                  <p className="mt-1 line-clamp-4 text-subtle">{s.excerpt}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      )}
    </>
  );
}
