'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, EmptyState, ErrorState, Logo, PageHeader, TableSkeleton, cx } from '@/components/ui';
import { api, qs, useApi } from '@/lib/api';
import { date, relative } from '@/lib/format';

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

/** Alerts grouped under the watchlist that raised them (by id, so same-named lists stay apart), in arrival order. */
function groupByWatchlist(items: AlertItem[]) {
  const groups = new Map<string, { name: string; items: AlertItem[] }>();
  for (const a of items) {
    const id = a.watchlistId?._id ?? 'deleted';
    const group = groups.get(id) ?? { name: a.watchlistId?.name ?? 'Deleted watchlist', items: [] };
    group.items.push(a);
    groups.set(id, group);
  }
  return [...groups.entries()];
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
          {groupByWatchlist(data.items).map(([id, { name: list, items }]) => (
          <section key={id} aria-label={list}>
          <h2 className="flex items-center justify-between bg-muted/50 px-4 py-2 text-caption font-medium text-subtle">
            <span>{list}</span>
            <span className="tabular">{items.length}</span>
          </h2>
          <ul className="divide-y divide-border">
            {items.map((a) => (
              <li key={a._id} className={cx('flex items-center gap-3 px-4 py-3', !a.read && 'bg-yellow/30')}>
                <span className={cx('h-2 w-2 shrink-0 rounded-full', a.read ? 'bg-transparent' : 'bg-accent')} aria-label={a.read ? undefined : 'Unread'} />
                {a.companyId && <Logo src={a.companyId.logoUrl} name={a.companyId.name} />}
                <div className="min-w-0 flex-1">
                  <Link href={a.companyId ? `/companies/${a.companyId.slug}` : '#'} onClick={() => !a.read && markOne(a._id)} className="font-medium hover:underline">
                    {a.message}
                  </Link>
                  <div className="text-caption text-subtle">
                    Round dated {date(a.fundingRoundId?.date)} · {relative(a.createdAt)}
                    {a.webhookStatus && <> · webhook {a.webhookStatus}</>}
                  </div>
                </div>
                {!a.read && (
                  <Button size="sm" variant="ghost" onClick={() => markOne(a._id)}>
                    Mark read
                  </Button>
                )}
              </li>
            ))}
          </ul>
          </section>
          ))}
          </div>
        )}
      </div>
    </>
  );
}
