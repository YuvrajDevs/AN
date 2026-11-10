'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { BarChart, HBar } from '@/components/charts';
import { Badge, Card, ErrorState, Logo, PageHeader, Segmented, Skeleton, Stat, TONE_BG, TONES, cx } from '@/components/ui';
import { useApi } from '@/lib/api';
import { date, ROUND_LABELS, usd } from '@/lib/format';

interface MapCompany {
  slug: string;
  name: string;
  logoUrl: string | null;
  status: string;
  teamSize: number | null;
  totalRaisedUsd: number;
  ycBatch: string | null;
  state: string;
}
interface Landscape {
  sector: { slug: string; name: string; description: string; color: string | null };
  kpis: { companies: number; active: number; acquired: number; inactive: number; classified: number; pendingReview: number; totalDisclosedUsd: number; withDisclosedFunding: number; medianTeam: number | null; unclassified: number };
  marketMap: { slug: string; name: string; description: string; count: number; active: number; disclosedUsd: number; companies: MapCompany[] }[];
  cohorts: { year: number; companies: number }[];
  fundingByYear: { year: number; rounds: number; disclosedUsd: number; companies: number }[];
  recentRounds: { _id: string; date: string; roundType: string; amountUsd: number | null; company: { slug: string; name: string; logoUrl: string | null } }[];
  notable: { _id: string; slug: string; name: string; oneLiner: string; logoUrl: string | null; ycBatch: string | null; metrics: { totalRaisedUsd: number }; teamSize: number | null }[];
  generatedAt: string;
}

export default function LandscapePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data, error, mutate } = useApi<Landscape>(`/sectors/${slug}/landscape`);
  const [metric, setMetric] = useState<'usd' | 'rounds'>('usd');

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );

  const k = data.kpis;
  const maxCount = Math.max(1, ...data.marketMap.map((m) => m.count));
  const sortedMap = [...data.marketMap].sort((a, b) => b.count - a.count);

  return (
    <>
      <PageHeader
        crumbs={[{ href: '/sectors', label: 'Sectors' }]}
        title={`${data.sector.name} landscape`}
        subtitle={data.sector.description}
        actions={
          <>
            <a href={`/api/companies/export.csv?sector=${slug}`} download className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full border border-border bg-surface px-4 text-sm font-medium hover:bg-muted">
              Export companies
            </a>
            <a href={`/api/funding/export.csv?sector=${slug}`} download className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full border border-border bg-surface px-4 text-sm font-medium hover:bg-muted">
              Export rounds
            </a>
            <Link href={`/briefs?sector=${slug}`} className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-accent/90">
              Analyst brief
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat tone="yellow" label="Companies" value={k.companies} hint={`${k.active} active · ${k.acquired} acquired · ${k.inactive} inactive`} />
        <Stat tone="pink" label="Classified" value={`${k.classified}/${k.companies}`} hint={k.pendingReview ? <Link href="/review" className="font-medium underline-offset-2 hover:underline">{k.pendingReview} awaiting review →</Link> : 'Queue clear'} />
        <Stat tone="sage" label="Disclosed funding (Form D)" value={usd(k.totalDisclosedUsd)} hint={`${k.withDisclosedFunding} companies with filings`} />
        <Stat tone="sky" label="Median team size" value={k.medianTeam ? Math.round(k.medianTeam) : '—'} hint="Per YC directory" />
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold tracking-tight">Market map</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sortedMap.map((m, idx) => (
          <section key={m.slug} className={cx('pastel flex flex-col p-4', TONE_BG[TONES[idx % TONES.length]])} aria-labelledby={`mm-${m.slug}`}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <h3 id={`mm-${m.slug}`} className="font-semibold">
                <Link href={`/companies?sector=${slug}&subsector=${m.slug}`} className="hover:underline">
                  {m.name}
                </Link>
              </h3>
              <span className="tabular shrink-0 text-xs text-ink/70">
                {m.count} · {usd(m.disclosedUsd, '$0')}
              </span>
            </div>
            <HBar value={m.count} max={maxCount} color="rgb(var(--ink))" />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {m.companies.length === 0 && <span className="text-xs text-ink/70">No companies classified here yet.</span>}
              {m.companies.map((c) => (
                <Link
                  key={c.slug}
                  href={`/companies/${c.slug}`}
                  title={`${c.name}${c.ycBatch ? ` (${c.ycBatch})` : ''}${c.totalRaisedUsd ? ` · ${usd(c.totalRaisedUsd)}` : ''}`}
                  className={cx(
                    'flex items-center gap-1.5 rounded-full bg-paper/75 py-1 pl-1 pr-2.5 text-xs font-medium hover:bg-paper',
                    c.status !== 'active' && 'opacity-60',
                  )}
                >
                  <Logo src={c.logoUrl} name={c.name} size={16} />
                  <span className="max-w-[9rem] truncate">{c.name}</span>
                </Link>
              ))}
              {m.count > m.companies.length && (
                <Link href={`/companies?sector=${slug}&subsector=${m.slug}`} className="self-center rounded-full bg-ink px-2.5 py-1 text-xs font-medium text-white hover:bg-ink/85">
                  +{m.count - m.companies.length} more
                </Link>
              )}
            </div>
          </section>
        ))}
      </div>
      {k.unclassified > 0 && (
        <p className="mt-2 text-xs text-subtle">
          {k.unclassified} companies are not shown: out of scope for this taxonomy, or awaiting review.
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card
          title="Form D funding by year of first sale"
          bodyClass="p-4"
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
          {data.fundingByYear.length === 0 ? (
            <p className="py-12 text-center text-sm text-subtle">No Form D filings linked to this sector yet.</p>
          ) : (
            <BarChart
              ariaLabel="Funding by year"
                            data={data.fundingByYear.map((f) => ({ label: String(f.year), value: metric === 'usd' ? f.disclosedUsd : f.rounds, secondary: f.rounds }))}
              format={(v) => (metric === 'usd' ? usd(v, '$0') : `${v} offerings`)}
            />
          )}
        </Card>
        <Card title="New companies by YC batch year" bodyClass="p-4">
          <BarChart ariaLabel="Companies by YC batch year" data={data.cohorts.map((c) => ({ label: String(c.year).slice(2), value: c.companies }))} format={(v) => `${v} companies`} />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Notable companies">
          <ul className="divide-y divide-border">
            {data.notable.map((c) => (
              <li key={c._id}>
                <Link href={`/companies/${c.slug}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted">
                  <Logo src={c.logoUrl} name={c.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-subtle">{c.oneLiner}</span>
                  </span>
                  <span className="tabular text-right text-xs">
                    <span className="block font-medium">{usd(c.metrics.totalRaisedUsd)}</span>
                    <span className="text-subtle">{c.ycBatch}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Latest rounds">
          {data.recentRounds.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-subtle">No rounds yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.recentRounds.map((r) => (
                <li key={r._id}>
                  <Link href={`/companies/${r.company.slug}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted">
                    <Logo src={r.company.logoUrl} name={r.company.name} />
                    <span className="flex-1 truncate font-medium">{r.company.name}</span>
                    <Badge>{ROUND_LABELS[r.roundType]}</Badge>
                    <span className="tabular w-16 text-right font-medium">{usd(r.amountUsd, '—')}</span>
                    <span className="tabular hidden w-24 text-right text-xs text-subtle sm:block">{date(r.date)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <p className="mt-4 text-xs text-subtle">Computed {new Date(data.generatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} from stored sources; cached and refreshed when data changes.</p>
    </>
  );
}
