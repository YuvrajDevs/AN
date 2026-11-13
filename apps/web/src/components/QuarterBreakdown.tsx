'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import { qs, useApi } from '@/lib/api';
import { date, ROUND_LABELS, usd } from '@/lib/format';
import { Card, ErrorState, Logo, Skeleton } from './ui';

interface Round {
  _id: string;
  date: string;
  roundType: string;
  amountUsd: number | null;
  targetAmountUsd: number | null;
  companyId: { slug: string; name: string; logoUrl: string | null } | null;
}

/** "2026-Q1" → UTC start and end of the quarter, matching the dashboard aggregation. */
export function quarterRange(period: string) {
  const [y, q] = [Number(period.slice(0, 4)), Number(period.slice(-1))];
  const from = new Date(Date.UTC(y, (q - 1) * 3, 1));
  const to = new Date(Date.UTC(y, q * 3, 1) - 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Every round inside one quarter, ranked by amount, with each round's share of the quarter. */
export function QuarterBreakdown({ period, label, onClose }: { period: string; label: string; onClose: () => void }) {
  const { from, to } = quarterRange(period);
  const { data, error, mutate } = useApi<{ items: Round[]; total: number }>(`/funding${qs({ from, to, limit: 200 })}`);

  const rows = [...(data?.items ?? [])].sort((a, b) => (b.amountUsd ?? -1) - (a.amountUsd ?? -1));
  const total = rows.reduce((s, r) => s + (r.amountUsd ?? 0), 0);
  const top = rows[0];
  const companies = new Set(rows.map((r) => r.companyId?.slug)).size;

  return (
    <Card
      title={`What makes up ${label}`}
      actions={
        <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-subtle transition-colors hover:bg-muted hover:text-fg" aria-label="Close breakdown">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      }
    >
      {error ? (
        <ErrorState error={error} retry={() => mutate()} />
      ) : !data ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-body-sm text-subtle">No rounds in this quarter.</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-b border-border/60 px-4 py-3 sm:grid-cols-4">
            {[
              ['Disclosed', usd(total, '$0')],
              ['Offerings', String(rows.length)],
              ['Companies', String(companies)],
              ['Largest share', top?.amountUsd && total ? `${top.companyId?.name ?? '—'} · ${Math.round((top.amountUsd / total) * 100)}%` : '—'],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-micro text-subtle">{k}</dt>
                <dd className="tabular truncate text-body-sm font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="th pl-4">Company</th>
                  <th className="th">Type</th>
                  <th className="th">First sale</th>
                  <th className="th text-right">Sold</th>
                  <th className="th text-right">Offering size</th>
                  <th className="th w-[22%] pr-4">Share of quarter</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((r) => {
                  const pct = total && r.amountUsd ? (r.amountUsd / total) * 100 : 0;
                  return (
                    <tr key={r._id} className="transition-colors duration-200 hover:bg-muted/50">
                      <td className="td pl-4">
                        {r.companyId ? (
                          <Link href={`/companies/${r.companyId.slug}`} className="flex items-center gap-2 font-medium hover:underline">
                            <Logo src={r.companyId.logoUrl} name={r.companyId.name} size={22} />
                            <span className="truncate">{r.companyId.name}</span>
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="td text-caption text-subtle">{ROUND_LABELS[r.roundType] ?? r.roundType}</td>
                      <td className="td tabular whitespace-nowrap text-caption text-subtle">{date(r.date)}</td>
                      <td className="td tabular text-right font-semibold">{usd(r.amountUsd, 'undisclosed')}</td>
                      <td className="td tabular text-right text-subtle">{usd(r.targetAmountUsd, '—')}</td>
                      <td className="td pr-4">
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <span className="block h-full rounded-full bg-fg transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
                          </span>
                          <span className="tabular w-9 text-right text-caption text-subtle">{pct ? `${Math.round(pct)}%` : '—'}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
