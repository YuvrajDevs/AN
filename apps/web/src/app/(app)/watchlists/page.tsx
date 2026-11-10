'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, Logo, PageHeader, Skeleton } from '@/components/ui';
import { api, ApiError, useApi } from '@/lib/api';
import { usd } from '@/lib/format';
import type { TaxonomyNode } from '@/lib/types';

interface Watchlist {
  _id: string;
  name: string;
  sectorSlugs: string[];
  minAmountUsd: number | null;
  webhookUrl: string | null;
  companyIds: { _id: string; slug: string; name: string; logoUrl: string | null; metrics: { totalRaisedUsd: number } }[];
}

function WatchlistForm({ taxonomy, onDone, initial }: { taxonomy: TaxonomyNode[]; onDone: () => void; initial?: Watchlist }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [sectors, setSectors] = useState<string[]>(initial?.sectorSlugs ?? []);
  const [min, setMin] = useState(initial?.minAmountUsd ? String(initial.minAmountUsd / 1e6) : '');
  const [webhook, setWebhook] = useState(initial?.webhookUrl ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const json = { name, sectorSlugs: sectors, minAmountUsd: min ? Number(min) * 1e6 : null, webhookUrl: webhook || null };
      if (initial) await api(`/watchlists/${initial._id}`, { method: 'PATCH', json });
      else await api('/watchlists', { method: 'POST', json });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? (err.details as { message: string }[] | undefined)?.[0]?.message ?? err.message : 'Could not save watchlist');
    } finally {
      setSaving(false);
    }
  }

  const all = taxonomy.flatMap((s) => [{ slug: s.slug, name: s.name, root: true }, ...s.children.map((c) => ({ slug: c.slug, name: `${s.name} › ${c.name}`, root: false }))]);

  return (
    <form onSubmit={submit} className={`grid gap-3 sm:grid-cols-2 ${initial ? 'p-4' : 'card mb-6 p-4'}`} onKeyDown={(e) => e.key === 'Escape' && onDone()}>
      <div>
        <label className="label" htmlFor={`wl-name-${initial?._id ?? 'new'}`}>
          Name
        </label>
        <input id={`wl-name-${initial?._id ?? 'new'}`} className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </div>
      <div>
        <label className="label" htmlFor={`wl-min-${initial?._id ?? 'new'}`}>
          Minimum round size ($M, optional)
        </label>
        <input id={`wl-min-${initial?._id ?? 'new'}`} type="number" min="0" step="0.5" className="input" value={min} onChange={(e) => setMin(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <span className="label">Alert on any new round in</span>
        <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
          {all.map((s) => {
            const on = sectors.includes(s.slug);
            return (
              <button
                type="button"
                key={s.slug}
                aria-pressed={on}
                onClick={() => setSectors(on ? sectors.filter((x) => x !== s.slug) : [...sectors, s.slug])}
                className={`rounded-full border px-2.5 py-1 text-xs ${on ? 'border-transparent bg-pink font-medium text-ink' : 'border-border text-subtle hover:text-fg'} ${s.root ? 'font-semibold' : ''}`}
              >
                {s.name}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-subtle">Add individual companies from their profile page.</p>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor={`wl-hook-${initial?._id ?? 'new'}`}>
          Webhook URL (optional, https only — private and internal addresses are blocked)
        </label>
        <input id={`wl-hook-${initial?._id ?? 'new'}`} className="input" placeholder="https://hooks.example.com/…" value={webhook} onChange={(e) => setWebhook(e.target.value)} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger sm:col-span-2">
          {error}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" variant="primary" loading={saving}>
          {initial ? 'Save changes' : 'Create watchlist'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function WatchlistsPage() {
  const { data, error, mutate } = useApi<{ items: Watchlist[] }>('/watchlists');
  const { data: tax } = useApi<{ taxonomy: TaxonomyNode[] }>('/sectors');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const names = new Map<string, string>();
  tax?.taxonomy.forEach((s) => {
    names.set(s.slug, s.name);
    s.children.forEach((c) => names.set(c.slug, c.name));
  });

  async function remove(id: string) {
    if (!confirm('Delete this watchlist and its alerts?')) return;
    await api(`/watchlists/${id}`, { method: 'DELETE' });
    mutate();
  }

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  return (
    <>
      <PageHeader
        title="Watchlists"
        subtitle="Follow companies or whole subsectors. New rounds create alerts (and optional webhooks)."
        actions={
          !creating && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              New watchlist
            </Button>
          )
        }
      />
      {creating && tax && (
        <WatchlistForm
          taxonomy={tax.taxonomy}
          onDone={() => {
            setCreating(false);
            mutate();
          }}
        />
      )}
      {!data ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : data.items.length === 0 ? (
        <div className="card">
          <EmptyState title="No watchlists yet" body="Create one to get alerted when a company or subsector you follow files a new round." action={<Button onClick={() => setCreating(true)}>New watchlist</Button>} />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.items.map((w) => (
            <Card
              key={w._id}
              title={w.name}
              actions={
                <span className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(editing === w._id ? null : w._id)} aria-label={`Edit ${w.name}`}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(w._id)} aria-label={`Delete ${w.name}`}>
                    Delete
                  </Button>
                </span>
              }
              bodyClass={editing === w._id ? '' : 'p-4 space-y-3'}
            >
              {editing === w._id && tax ? (
                <WatchlistForm
                  taxonomy={tax.taxonomy}
                  initial={w}
                  onDone={() => {
                    setEditing(null);
                    mutate();
                  }}
                />
              ) : (
              <>
              <div className="flex flex-wrap gap-1.5">
                {w.sectorSlugs.map((s) => (
                  <Badge key={s} tone="accent">
                    {names.get(s) ?? s}
                  </Badge>
                ))}
                {w.minAmountUsd ? <Badge>≥ {usd(w.minAmountUsd)}</Badge> : null}
                {w.webhookUrl && <Badge tone="success">webhook</Badge>}
              </div>
              {w.companyIds.length === 0 ? (
                <p className="text-xs text-subtle">No individual companies — alerts come from the sectors above.</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {w.companyIds.map((c) => (
                    <li key={c._id}>
                      <Link href={`/companies/${c.slug}`} className="flex items-center gap-1.5 rounded-md border border-border px-1.5 py-1 text-xs hover:border-ink/30">
                        <Logo src={c.logoUrl} name={c.name} size={16} />
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              </>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
