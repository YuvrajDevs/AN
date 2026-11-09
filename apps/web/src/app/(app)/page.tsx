'use client';

import Link from 'next/link';
import { BarChart, HBar } from '@/components/charts';
import { Badge, Card, ErrorState, Logo, PageHeader, Skeleton, Stat, TableSkeleton } from '@/components/ui';
import { useApi } from '@/lib/api';
import { date, ROUND_LABELS, usd } from '@/lib/format';

interface Dashboard {
  totals: { companies: number; pendingReview: number; disclosedUsd: number; rounds: number };
  bySector: { slug: string; name: string; color: string | null; companies: number; disclosedUsd: number }[];
  quarterly: { period: string; rounds: number; disclosedUsd: number }[];
}
interface Recent {
  items: { _id: string; date: string; roundType: string; amountUsd: number | null; company: { slug: string; name: string; logoUrl: string | null } }[];
}

export default function DashboardPage() {
  const { data, error, mutate, isLoading } = useApi<Dashboard>('/dashboard');
  const recent = useApi<Recent>('/funding/recent');

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  const maxSector = Math.max(1, ...(data?.bySector ?? []).map((s) => s.companies));

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Tracked sectors, recent primary-source funding activity and work waiting for you." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isLoading || !data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[92px]" />)
        ) : (
          <>
            <Stat label="Companies tracked" value={data.totals.companies.toLocaleString()} hint={`${data.bySector.length} sectors`} />
            <Stat label="Funding rounds" value={data.totals.rounds.toLocaleString()} hint="Excludes accelerator entries" />
            <Stat label="Disclosed capital" value={usd(data.totals.disclosedUsd)} hint="Sum of Form D amounts sold" />
            <Stat
              label="Awaiting review"
              value={data.totals.pendingReview}
              hint={
                <Link href="/review" className="text-accent hover:underline">
                  Open review queue →
                </Link>
              }
            />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Disclosed funding by quarter" className="lg:col-span-2" bodyClass="p-4">
          {!data ? (
            <Skeleton className="h-[200px]" />
          ) : data.quarterly.length === 0 ? (
            <p className="py-12 text-center text-sm text-subtle">No dated rounds in the last four years.</p>
          ) : (
            <BarChart
              ariaLabel="Disclosed funding by quarter"
              data={data.quarterly.map((q) => ({ label: `${q.period.slice(5)} '${q.period.slice(2, 4)}`, value: q.disclosedUsd, secondary: q.rounds }))}
              format={(v) => usd(v, '$0')}
            />
          )}
        </Card>
        <Card title="Sectors" bodyClass="divide-y divide-border">
          {!data
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="m-4 h-10" />)
            : data.bySector.map((s) => (
                <Link key={s.slug} href={`/sectors/${s.slug}`} className="block px-4 py-3 hover:bg-muted">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.color ?? 'rgb(var(--accent))' }} aria-hidden="true" />
                      {s.name}
                    </span>
                    <span className="tabular text-xs text-subtle">
                      {s.companies} cos · {usd(s.disclosedUsd)}
                    </span>
                  </div>
                  <HBar value={s.companies} max={maxSector} color={s.color ?? undefined} />
                </Link>
              ))}
        </Card>
      </div>

      <Card
        className="mt-6"
        title="Latest funding (primary sources)"
        actions={
          <Link href="/funding" className="text-xs text-accent hover:underline">
            All rounds →
          </Link>
        }
      >
        {recent.error ? (
          <ErrorState error={recent.error} retry={() => recent.mutate()} />
        ) : !recent.data ? (
          <TableSkeleton rows={6} cols={4} />
        ) : (
          <ul className="divide-y divide-border">
            {recent.data.items.slice(0, 8).map((r) => (
              <li key={r._id}>
                <Link href={`/companies/${r.company.slug}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted">
                  <Logo src={r.company.logoUrl} name={r.company.name} />
                  <span className="min-w-0 flex-1 truncate font-medium">{r.company.name}</span>
                  <Badge>{ROUND_LABELS[r.roundType] ?? r.roundType}</Badge>
                  <span className="tabular w-20 text-right font-medium">{usd(r.amountUsd, 'undisclosed')}</span>
                  <span className="tabular hidden w-28 text-right text-xs text-subtle sm:block">{date(r.date)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
