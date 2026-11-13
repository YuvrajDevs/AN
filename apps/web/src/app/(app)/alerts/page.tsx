'use client';

import { groupBy } from '@/lib/group';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, EmptyState, ErrorState, Logo, PageHeader, TableSkeleton, cx } from '@/components/ui';
import { api, qs, useApi } from '@/lib/api';
import { date, relative, ROUND_LABELS, usd } from '@/lib/format';

interface AlertItem {
  _id: string;
  message: string;
  read: boolean;
  createdAt: string;
  webhookStatus: string | null;
  companyId: { slug: string; name: string; logoUrl: string | null } | null;
  fundingRoundId: { date: string; roundType: string; amountUsd: number | null } | null;
  watchlistId: { _id: string; name: string } | null;
}

export default function AlertsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, error, isLoading, mutate } = useApi<{ items: AlertItem[]; unread: number }>(`/alerts${qs({ unread: unreadOnly ? 'true' : undefined })}`);

  async function markAll() {
    await api('/alerts/read', { method: 'POST', json: { all: true } });
    mutate();
  }
  async function markOne(id: string) {
    await api('/alerts/read', { method: 'POST', json: { ids: [id] } });
    mutate();
  }

  return (
    <>
      <PageHeader
        title="Alerts"
        subtitle={data ? `${data.unread} unread` : 'New funding rounds matching your watchlists'}
        actions={
          <>
            <Button size="sm" variant={unreadOnly ? 'primary' : 'secondary'} aria-pressed={unreadOnly} onClick={() => setUnreadOnly((u) => !u)}>
              Unread only
            </Button>
            <Button size="sm" onClick={markAll} disabled={!data?.unread}>
              Mark all read
            </Button>
          </>
        }
      />
      <div className="card overflow-hidden">
        {error ? (
          <ErrorState error={error} retry={() => mutate()} />
        ) : isLoading && !data ? (
          <TableSkeleton rows={8} cols={3} />
        ) : !data?.items.length ? (
          <EmptyState
            icon="🔔"
            title={unreadOnly ? 'You are all caught up' : 'No alerts yet'}
            body="Alerts appear when a company or subsector on one of your watchlists files a new round."
            action={
              <Link href="/watchlists" className="text-body text-accent hover:underline">
                Manage watchlists →
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-border">
          {groupBy(data.items, (a) => a.watchlistId?._id ?? 'deleted', (a) => a.watchlistId?.name ?? 'Deleted watchlist').map(([id, { name: list, items }]) => (
          <section key={id} aria-label={list}>
          <h2 className="flex items-center justify-between bg-muted/50 px-4 py-2 text-caption font-medium text-subtle">
            <span>{list}</span>
            <span className="tabular">{items.length}</span>
          </h2>
          {/* Columns on wide screens: what happened, how much, when it was dated, when it arrived, then the action */}
          <div className="hidden grid-cols-[minmax(0,1fr)_120px_130px_100px_96px] gap-4 border-b border-border px-4 py-2 md:grid" aria-hidden="true">
            <span className="th !p-0 pl-[52px]">Company</span>
            <span className="th !p-0 text-right">Amount</span>
            <span className="th !p-0">Round dated</span>
            <span className="th !p-0">Received</span>
            <span />
          </div>
          <ul className="divide-y divide-border">
            {items.map((a) => {
              const round = a.fundingRoundId;
              const type = round ? ROUND_LABELS[round.roundType] ?? round.roundType : null;
              return (
                <li key={a._id} className={cx('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 md:grid-cols-[minmax(0,1fr)_120px_130px_100px_96px]', !a.read && 'bg-yellow/30')}>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={cx('h-2 w-2 shrink-0 rounded-full', a.read ? 'bg-transparent' : 'bg-accent')} aria-label={a.read ? undefined : 'Unread'} />
                    {a.companyId && <Logo src={a.companyId.logoUrl} name={a.companyId.name} />}
                    <div className="min-w-0">
                      <Link href={a.companyId ? `/companies/${a.companyId.slug}` : '#'} onClick={() => !a.read && markOne(a._id)} className="block truncate text-body-sm font-semibold hover:underline" title={a.message}>
                        {a.companyId?.name ?? a.message}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-caption text-subtle">
                        {type && <Badge>{type}</Badge>}
                        <span>SEC Form D</span>
                        {a.webhookStatus && <span>· webhook {a.webhookStatus}</span>}
                        <span className="md:hidden">· {date(round?.date)} · {relative(a.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <span className="tabular text-right text-heading font-semibold">{usd(round?.amountUsd)}</span>
                  <span className="tabular hidden text-body-sm md:block">{date(round?.date)}</span>
                  <span className="hidden text-body-sm text-subtle md:block">{relative(a.createdAt)}</span>
                  <span className="hidden justify-end md:flex">
                    {!a.read ? (
                      <Button size="sm" variant="ghost" onClick={() => markOne(a._id)}>Mark read</Button>
                    ) : a.companyId ? (
                      <Link href={`/companies/${a.companyId.slug}`} className="text-caption font-medium text-subtle hover:text-fg">View →</Link>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
          </section>
          ))}
          </div>
        )}
      </div>
    </>
  );
}
