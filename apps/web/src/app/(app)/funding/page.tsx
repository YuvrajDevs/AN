'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, EmptyState, ErrorState, Logo, PageHeader, TableSkeleton } from '@/components/ui';
import { qs, useApi } from '@/lib/api';
import { date, ROUND_LABELS, usd } from '@/lib/format';
import type { TaxonomyNode } from '@/lib/types';

interface Round {
  _id: string;
  date: string;
  roundType: string;
  amountUsd: number | null;
  targetAmountUsd: number | null;
  extractedBy: string;
  confidence: number;
  companyId: { slug: string; name: string; logoUrl: string | null } | null;
}

export default function FundingPage() {
  const [sector, setSector] = useState('');
  const [roundType, setRoundType] = useState('');
  const params = { sector, roundType, limit: 100 };
  const { data, error, isLoading, mutate } = useApi<{ items: Round[] }>(`/funding${qs(params)}`);
  const { data: tax } = useApi<{ taxonomy: TaxonomyNode[] }>('/sectors');

  return (
    <>
      <PageHeader
        title="Funding rounds"
        subtitle="Every round traces to a stored primary source. Form D rounds report amount sold; round names and investors are not on the form."
        actions={
          <a href={`/api/funding/export.csv${qs({ sector })}`} download className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3.5 text-sm font-medium hover:bg-muted">
            Export CSV
          </a>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <select aria-label="Sector" className="input w-52" value={sector} onChange={(e) => setSector(e.target.value)}>
          <option value="">All sectors</option>
          {tax?.taxonomy.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
        <select aria-label="Round type" className="input w-52" value={roundType} onChange={(e) => setRoundType(e.target.value)}>
          <option value="">All round types</option>
          {Object.entries(ROUND_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="card overflow-hidden">
        {error ? (
          <ErrorState error={error} retry={() => mutate()} />
        ) : isLoading && !data ? (
          <TableSkeleton rows={10} cols={5} />
        ) : !data?.items.length ? (
          <EmptyState title="No rounds" body="No funding rounds match these filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Company</th>
                  <th className="th">Type</th>
                  <th className="th text-right">Amount</th>
                  <th className="th text-right">Offering size</th>
                  <th className="th">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((r) => (
                  <tr key={r._id} className="hover:bg-muted/60">
                    <td className="td tabular whitespace-nowrap text-subtle">{date(r.date)}</td>
                    <td className="td">
                      {r.companyId && (
                        <Link href={`/companies/${r.companyId.slug}`} className="flex items-center gap-2 font-medium hover:underline">
                          <Logo src={r.companyId.logoUrl} name={r.companyId.name} size={22} />
                          {r.companyId.name}
                        </Link>
                      )}
                    </td>
                    <td className="td">
                      <Badge tone="accent">{ROUND_LABELS[r.roundType] ?? r.roundType}</Badge>
                    </td>
                    <td className="td tabular text-right font-medium">{usd(r.amountUsd, 'undisclosed')}</td>
                    <td className="td tabular text-right text-subtle">{usd(r.targetAmountUsd)}</td>
                    <td className="td text-xs text-subtle">{r.extractedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
