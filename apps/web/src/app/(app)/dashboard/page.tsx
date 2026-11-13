'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, ClipboardCheck, Lightbulb } from 'lucide-react';
import { BarChart, Ring, Sparkline, SplitBars } from '@/components/charts';
import { QuarterBreakdown } from '@/components/QuarterBreakdown';
import { useSession } from '@/components/session';
import { Card, ErrorState, Logo, Segmented, Skeleton, Stat, TONE_BG, buttonClass, cx, sectorTone } from '@/components/ui';
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

/** One row per company: its latest round, plus how many earlier rounds it has in the same recent window. */
function latestPerCompany(items: Recent['items'], limit: number) {
  const bySlug = new Map<string, { round: Recent['items'][number]; more: number }>();
  for (const r of items) {
    const seen = bySlug.get(r.company.slug);
    if (seen) seen.more += 1;
    else bySlug.set(r.company.slug, { round: r, more: 0 });
  }
  return [...bySlug.values()].slice(0, limit);
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

const quarterLabel = (p: string) => `${p.slice(5)} '${p.slice(2, 4)}`;
const share = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

/** Plain-language observations computed from the same aggregates the charts use. */
function insights(d: Dashboard) {
  const out: { text: React.ReactNode; href?: string }[] = [];
  const bySpend = [...d.bySector].sort((a, b) => b.disclosedUsd - a.disclosedUsd);
  const top = bySpend[0];
  if (top && d.totals.disclosedUsd) {
    out.push({
      text: (
        <>
          <b className="font-semibold">{top.name}</b> holds {share(top.disclosedUsd, d.totals.disclosedUsd)}% of disclosed capital ({usd(top.disclosedUsd)}) with {share(top.companies, d.totals.companies)}% of companies.
        </>
      ),
      href: `/sectors/${top.slug}`,
    });
  }
  const peak = [...d.quarterly].sort((a, b) => b.disclosedUsd - a.disclosedUsd)[0];
  if (peak?.disclosedUsd) {
    out.push({
      text: (
        <>
          Busiest quarter: <b className="font-semibold">{quarterLabel(peak.period)}</b>, {usd(peak.disclosedUsd)} sold across {peak.rounds} {peak.rounds === 1 ? 'offering' : 'offerings'}.
        </>
      ),
      href: '/funding',
    });
  }
  const recent = d.quarterly.slice(-4).reduce((s, q) => s + q.disclosedUsd, 0);
  const prior = d.quarterly.slice(-8, -4).reduce((s, q) => s + q.disclosedUsd, 0);
  if (prior > 0) {
    const delta = Math.round(((recent - prior) / prior) * 100);
    out.push({
      text: (
        <>
          Last four quarters: {usd(recent)}, <b className="font-semibold">{delta >= 0 ? `up ${delta}%` : `down ${Math.abs(delta)}%`}</b> on the four before.
        </>
      ),
    });
  }
  if (d.totals.pendingReview) {
    out.push({
      text: (
        <>
          <b className="font-semibold">{share(d.totals.pendingReview, d.totals.companies)}%</b> of companies have a label below 0.75 confidence and wait for an analyst.
        </>
      ),
      href: '/review',
    });
  }
  return out;
}

export default function DashboardPage() {
  const { user } = useSession();
  const { data, error, mutate } = useApi<Dashboard>('/dashboard');
  const recent = useApi<Recent>('/funding/recent');
  const [metric, setMetric] = useState<'usd' | 'rounds'>('usd');
  // null = closed (the default: the breakdown opens when an analyst picks a quarter), string = a picked quarter.
  const [picked, setPicked] = useState<string | null>(null);

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  const first = user?.name?.split(' ')[0];
  const maxSector = Math.max(1, ...(data?.bySector ?? []).map((s) => s.companies));
  const quarters = (data?.quarterly ?? []).slice(-12);
  const period = picked;
  const selectedIndex = period ? quarters.findIndex((q) => q.period === period) : -1;

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-display font-semibold tracking-tight">
            {greeting()}
            {first ? `, ${first}` : ''}
          </h1>
          <p className="mt-1 text-body-sm text-subtle">
            {data ? `${data.totals.companies} startups across ${data.bySector.length} sectors, funding from SEC Form D filings.` : 'Loading your workspace…'}
          </p>
        </div>
        <Link href="/review" className={buttonClass('primary')}>
          <ClipboardCheck className="h-4 w-4" aria-hidden="true" /> Review queue
          {!!data?.totals.pendingReview && <span className="rounded-full bg-yellow px-1.5 text-micro font-semibold text-ink">{data.totals.pendingReview}</span>}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {!data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[84px]" />)
        ) : (
          <>
            <Stat
              tone="yellow"
              label="Companies tracked"
              value={data.totals.companies.toLocaleString()}
              hint={`${data.bySector.length} sectors · YC directory`}
              visual={<SplitBars parts={data.bySector.map((x) => ({ key: x.slug, label: x.name.split(' ')[0], title: x.name, value: x.companies }))} />}
            />
            <Stat
              tone="pink"
              label="Disclosed capital"
              value={usd(data.totals.disclosedUsd)}
              hint="Form D amount sold"
              visual={quarters.length > 1 ? <Sparkline values={quarters.map((q) => q.disclosedUsd)} label={`Form D capital sold per quarter, last ${quarters.length} quarters`} /> : undefined}
            />
            <Stat
              tone="sky"
              label="Funding rounds"
              value={data.totals.rounds}
              hint="Primary-source filings"
              visual={quarters.length > 1 ? <Sparkline values={quarters.map((q) => q.rounds)} label={`Offerings per quarter, last ${quarters.length} quarters`} /> : undefined}
            />
            <Stat
              tone="sage"
              label="Awaiting review"
              value={data.totals.pendingReview}
              visual={<Ring value={data.totals.pendingReview} max={data.totals.companies} label="Share of companies awaiting review" />}
              hint={
                <Link href="/review" className="font-medium underline-offset-2 hover:underline">
                  Open queue →
                </Link>
              }
            />
          </>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Disclosed funding by quarter"
          bodyClass="px-4 pb-3 pt-3"
          actions={
            <Segmented
              label="Metric"
              value={metric}
              onChange={setMetric}
              options={[
                { value: 'usd', label: '$ sold' },
                { value: 'rounds', label: 'Offerings' },
              ]}
            />
          }
        >
          {!data ? (
            <Skeleton className="h-[160px]" />
          ) : quarters.length === 0 ? (
            <p className="py-12 text-center text-body text-subtle">No dated rounds yet.</p>
          ) : (
            <BarChart
              height={150}
              ariaLabel="Disclosed funding by quarter"
              data={quarters.map((q) => ({ label: quarterLabel(q.period), value: metric === 'usd' ? q.disclosedUsd : q.rounds, secondary: q.rounds }))}
              format={(v) => (metric === 'usd' ? usd(v, '$0') : `${v} offerings`)}
              secondaryLabel={(n) => `${n} ${n === 1 ? 'offering' : 'offerings'}`}
              selected={selectedIndex >= 0 ? selectedIndex : null}
              onSelect={(i) => setPicked(i === null ? null : quarters[i].period)}
            />
          )}
        </Card>

        <Card
          title={
            <span className="flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" /> Insights
            </span>
          }
          bodyClass="p-2"
        >
          {!data ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : (
            <ul className="space-y-1">
              {insights(data).map((x, i) => {
                const body = <span className="text-body-sm leading-snug">{x.text}</span>;
                return (
                  <li key={i}>
                    {x.href ? (
                      <Link href={x.href} className="group flex items-start gap-2 rounded-xl px-2.5 py-2 hover:bg-muted/60">
                        {body}
                        <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                      </Link>
                    ) : (
                      <div className="px-2.5 py-2">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="px-2.5 pb-1 pt-2 text-micro text-subtle">Computed from stored filings; refreshed when data changes.</p>
        </Card>
      </div>

      {period && (
        <div className="mt-4 animate-[fadeUp_350ms_cubic-bezier(0.22,1,0.36,1)]" key={period}>
          <QuarterBreakdown period={period} label={quarterLabel(period)} onClose={() => setPicked(null)} />
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Latest funding"
          actions={
            <Link href="/funding" className="text-caption font-medium text-subtle hover:text-fg">
              All rounds →
            </Link>
          }
        >
          {recent.error ? (
            <ErrorState error={recent.error} retry={() => recent.mutate()} />
          ) : !recent.data ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8" />
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {latestPerCompany(recent.data.items, 7).map(({ round: r, more }) => (
                <li key={r._id}>
                  <Link href={`/companies/${r.company.slug}`} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/50">
                    <Logo src={r.company.logoUrl} name={r.company.name} size={26} />
                    <span className="min-w-0 flex-1 truncate text-body-sm font-medium">
                      {r.company.name}
                      {more > 0 && <span className="ml-2 text-caption font-normal text-subtle">+{more} earlier {more === 1 ? 'round' : 'rounds'}</span>}
                    </span>
                    <span className="hidden text-caption text-subtle sm:block">{ROUND_LABELS[r.roundType] ?? r.roundType}</span>
                    <span className="tabular w-24 text-right text-caption text-subtle">{date(r.date)}</span>
                    <span className="tabular w-20 text-right text-body-sm font-semibold">{usd(r.amountUsd, '—')}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Sectors" bodyClass="divide-y divide-border/60">
          {!data
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="m-4 h-9" />)
            : data.bySector.map((s, i) => (
                <Link key={s.slug} href={`/sectors/${s.slug}`} className="group block px-4 py-3 hover:bg-muted/50">
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', TONE_BG[sectorTone(s.color, i)])} aria-hidden="true" />
                      <span className="truncate text-body-sm font-medium group-hover:underline">{s.name}</span>
                    </span>
                    <span className="tabular shrink-0 text-caption text-subtle">
                      {s.companies} · {usd(s.disclosedUsd, '$0')}
                    </span>
                  </span>
                  <span className="mt-2 block h-1.5 rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-fg" style={{ width: `${Math.max(3, (s.companies / maxSector) * 100)}%` }} />
                  </span>
                </Link>
              ))}
        </Card>
      </div>
    </>
  );
}
