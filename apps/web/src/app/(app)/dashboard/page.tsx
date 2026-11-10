'use client';

import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { BarChart } from '@/components/charts';
import { useSession } from '@/components/session';
import { Badge, ErrorState, Logo, Skeleton, TONE_BG, buttonClass, cx, sectorTone } from '@/components/ui';
import { Blob } from '@/components/decor';
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

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function DashboardPage() {
  const { user } = useSession();
  const { data, error, mutate, isLoading } = useApi<Dashboard>('/dashboard');
  const recent = useApi<Recent>('/funding/recent');

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  const first = user?.name?.split(' ')[0];
  const maxSector = Math.max(1, ...(data?.bySector ?? []).map((s) => s.companies));
  const lastQuarters = (data?.quarterly ?? []).slice(-10);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight sm:text-[38px]">
          {greeting()}
          {first ? `, ${first}` : ''}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-subtle">
          {data ? (
            <>
              Strata is tracking {data.totals.companies.toLocaleString()} startups across {data.bySector.length} sectors, with {data.totals.rounds} funding rounds taken from SEC filings.{' '}
              {data.totals.pendingReview > 0 ? `${data.totals.pendingReview} classifications are waiting for review.` : 'The review queue is clear.'}
            </>
          ) : (
            'Loading your workspace…'
          )}
        </p>
      </div>

      {isLoading || !data ? (
        <div className="grid gap-4 lg:grid-cols-5">
          <Skeleton className="h-[230px] lg:col-span-2" />
          <Skeleton className="h-[230px] lg:col-span-3" />
          <Skeleton className="h-[150px] lg:col-span-3" />
          <Skeleton className="h-[150px] lg:col-span-2" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          {/* Companies by sector */}
          <section className="pastel relative overflow-hidden bg-yellow p-5 lg:col-span-2" aria-labelledby="k-companies">
            <Blob shape="plus" className="-right-6 -top-6 h-32 w-32" />
            <h2 id="k-companies" className="text-[15px] font-semibold">
              Companies tracked
            </h2>
            <div className="tabular mt-2 text-[28px] font-semibold leading-none tracking-tight">{data.totals.companies.toLocaleString()}</div>
            <ul className="relative mt-5 space-y-3">
              {data.bySector.map((s) => (
                <li key={s.slug}>
                  <Link href={`/sectors/${s.slug}`} className="group block">
                    <span className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                      <span className="truncate font-medium group-hover:underline">{s.name}</span>
                      <span className="tabular font-semibold">{s.companies}</span>
                    </span>
                    <span className="block h-2.5 rounded-full bg-ink/10">
                      <span className="block h-full rounded-full bg-ink" style={{ width: `${Math.max(4, (s.companies / maxSector) * 100)}%` }} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="tabular mt-4 text-[11px] text-subtle">From the YC public directory · tap a sector for its landscape</div>
          </section>

          {/* Funding by quarter */}
          <section className="pastel relative overflow-hidden bg-pink p-5 lg:col-span-3" aria-labelledby="k-funding">
            <Blob shape="circle" className="-right-10 -top-10 h-40 w-40" />
            <div className="flex items-start justify-between gap-3">
              <h2 id="k-funding" className="text-[15px] font-semibold">
                Disclosed funding
              </h2>
              <Link href="/funding" className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white" aria-label="All funding rounds">
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="mt-3 flex gap-6">
              <div>
                <div className="tabular text-lg font-semibold leading-none">{usd(data.totals.disclosedUsd)}</div>
                <div className="mt-1 text-[11px] text-subtle">Form D amount sold</div>
              </div>
              <div>
                <div className="tabular text-lg font-semibold leading-none">{data.totals.rounds}</div>
                <div className="mt-1 text-[11px] text-subtle">Funding rounds</div>
              </div>
            </div>
            <div className="mt-4">
              {lastQuarters.length === 0 ? (
                <p className="py-10 text-center text-sm text-subtle">No dated rounds yet.</p>
              ) : (
                <BarChart
                  height={96}
                  ariaLabel="Disclosed funding by quarter"
                  color="rgb(var(--ink))"
                  data={lastQuarters.map((q) => ({ label: `${q.period.slice(5)} '${q.period.slice(2, 4)}`, value: q.disclosedUsd, secondary: q.rounds }))}
                  format={(v) => usd(v, '$0')}
                />
              )}
            </div>
          </section>

          {/* Sectors */}
          <section className="pastel relative overflow-hidden bg-sage p-5 lg:col-span-3" aria-labelledby="k-sectors">
            <Blob shape="tri" className="-bottom-8 right-6 h-32 w-32" />
            <h2 id="k-sectors" className="text-[15px] font-semibold">
              By sector
            </h2>
            <ul className="relative z-10 mt-3 grid gap-2 sm:grid-cols-3">
              {data.bySector.map((s) => (
                <li key={s.slug}>
                  <Link href={`/sectors/${s.slug}`} className="block rounded-2xl bg-paper/70 px-3.5 py-3 hover:bg-paper">
                    <span className="block text-[13px] font-semibold leading-snug">{s.name}</span>
                    <span className="tabular mt-0.5 block text-[11px] text-subtle">
                      {s.companies} companies · {usd(s.disclosedUsd, '$0')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Review queue */}
          <section className="pastel relative flex flex-col overflow-hidden bg-sky p-5 lg:col-span-2" aria-labelledby="k-review">
            <Blob shape="star" className="-bottom-8 -right-6 h-36 w-36" />
            <h2 id="k-review" className="text-[15px] font-semibold">
              Review queue
            </h2>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="tabular text-[28px] font-semibold leading-none">{data.totals.pendingReview}</span>
              <span className="text-[11px] text-subtle">low-confidence labels waiting</span>
            </div>
            <Link href="/review" className={cx(buttonClass('primary', 'sm'), 'relative z-10 mt-4 w-fit !bg-ink !text-white hover:!bg-ink/85')}>
              Open review queue <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </section>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3" aria-labelledby="latest">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="latest" className="text-lg font-semibold tracking-tight">
              Latest funding
            </h2>
            <Link href="/funding" className="text-xs font-medium text-subtle hover:text-fg">
              Show all →
            </Link>
          </div>
          {recent.error ? (
            <ErrorState error={recent.error} retry={() => recent.mutate()} />
          ) : !recent.data ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : (
            <ul className="space-y-2">
              {recent.data.items.slice(0, 7).map((r) => (
                <li key={r._id}>
                  <Link href={`/companies/${r.company.slug}`} className="flex items-center gap-3 rounded-2xl bg-muted px-3 py-2.5 transition-colors hover:bg-pink/50">
                    <Logo src={r.company.logoUrl} name={r.company.name} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{r.company.name}</span>
                      <span className="block truncate text-[11px] text-subtle">
                        {ROUND_LABELS[r.roundType] ?? r.roundType} · {date(r.date)}
                      </span>
                    </span>
                    <span className="tabular rounded-full bg-surface px-3 py-1 text-xs font-semibold">{usd(r.amountUsd, 'undisclosed')}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lg:col-span-2" aria-labelledby="where">
          <h2 id="where" className="mb-3 text-lg font-semibold tracking-tight">
            Where to start
          </h2>
          <div className="space-y-2">
            {[
              { href: '/sectors/legal-ai', title: 'Legal AI landscape', body: 'Market map by subsector, funding by year, notable companies.', tone: 'pink' as const },
              { href: '/companies', title: 'Search companies', body: 'Filter by sector, status, review state and funding. Export to CSV.', tone: 'yellow' as const },
              { href: '/briefs', title: 'Analyst briefs', body: 'Generated briefs where every claim cites a stored source.', tone: 'sky' as const },
              { href: '/review', title: 'Review classifications', body: 'Accept or override labels from the keyboard: j / k, a, 1–9.', tone: 'sage' as const },
            ].map((x) => (
              <Link key={x.href} href={x.href} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-surface px-3 py-3 hover:border-fg/30">
                <span className={cx('h-10 w-1.5 shrink-0 rounded-full', TONE_BG[x.tone])} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{x.title}</span>
                  <span className="block text-[12px] leading-snug text-subtle">{x.body}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
              </Link>
            ))}
          </div>
          {data && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {data.bySector.map((s, i) => (
                <Badge key={s.slug} tone={sectorTone(s.color, i)}>
                  {s.name}
                </Badge>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
