'use client';

import { useState } from 'react';
import { useCan, useSession } from '@/components/session';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, Stat, TableSkeleton } from '@/components/ui';
import { api, ApiError, useApi } from '@/lib/api';
import { relative } from '@/lib/format';
import type { Role } from '@/lib/types';

interface Meta {
  llm: { default: string; available: string[]; models: Record<string, string> };
  eventBus: string;
  reviewThreshold: number;
  jobs: Record<string, number> | null;
}
interface Health {
  status: string;
  mongo: boolean;
  redis: boolean | null;
  eventBus: string;
}
interface Run {
  _id: string;
  connector: string;
  status: 'running' | 'succeeded' | 'partial' | 'failed';
  counts: { fetched: number; published: number; errors: number };
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  params: Record<string, unknown>;
}
interface UserRow {
  _id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  lastLoginAt: string | null;
}

const CONNECTORS = [
  { id: 'yc', label: 'YC directory', help: 'Re-reads the public YC directory and upserts companies in tracked sectors.' },
  { id: 'sec_form_d', label: 'SEC Form D', help: 'Searches EDGAR for Form D filings. Leave slugs empty to scan every active company (slow: SEC asks for ≤10 req/s).' },
  { id: 'rss', label: 'RSS / press feed', help: 'Fetches a feed through the SSRF-safe client and extracts funding announcements.' },
  { id: 'github', label: 'GitHub org', help: 'Records public repo and star counts as a traction source.' },
] as const;

function RunForm({ onQueued }: { onQueued: () => void }) {
  const [connector, setConnector] = useState<(typeof CONNECTORS)[number]['id']>('sec_form_d');
  const [slugs, setSlugs] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [org, setOrg] = useState('');
  const [limit, setLimit] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const list = slugs.split(',').map((s) => s.trim()).filter(Boolean);
    const params =
      connector === 'yc'
        ? limit ? { limit: Number(limit) } : {}
        : connector === 'sec_form_d'
          ? { ...(list.length ? { companySlugs: list } : {}), ...(limit ? { limit: Number(limit) } : {}) }
          : connector === 'rss'
            ? { feeds: [{ url: feedUrl, ...(list[0] ? { companySlug: list[0] } : {}) }] }
            : { targets: [{ org, companySlug: list[0] ?? '' }] };
    try {
      await api('/ingest/runs', { method: 'POST', json: { connector, params } });
      setMsg({ ok: true, text: 'Queued. The worker picks it up and publishes records to the event bus.' });
      onQueued();
    } catch (err) {
      const details = err instanceof ApiError ? (err.details as { path: string; message: string }[] | undefined) : undefined;
      setMsg({ ok: false, text: details?.[0] ? `${details[0].path}: ${details[0].message}` : err instanceof ApiError ? err.message : 'Could not queue run' });
    } finally {
      setBusy(false);
    }
  }

  const help = CONNECTORS.find((c) => c.id === connector)!.help;
  return (
    <form onSubmit={submit} className="space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="run-connector">
            Connector
          </label>
          <select id="run-connector" className="input" value={connector} onChange={(e) => setConnector(e.target.value as typeof connector)}>
            {CONNECTORS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        {(connector === 'yc' || connector === 'sec_form_d') && (
          <div>
            <label className="label" htmlFor="run-limit">
              Limit (optional)
            </label>
            <input id="run-limit" type="number" min="1" className="input" value={limit} onChange={(e) => setLimit(e.target.value)} />
          </div>
        )}
        {connector === 'rss' && (
          <div>
            <label className="label" htmlFor="run-feed">
              Feed URL
            </label>
            <input id="run-feed" className="input" type="url" required placeholder="https://example.com/feed.xml" value={feedUrl} onChange={(e) => setFeedUrl(e.target.value)} />
          </div>
        )}
        {connector === 'github' && (
          <div>
            <label className="label" htmlFor="run-org">
              GitHub organisation
            </label>
            <input id="run-org" className="input" required pattern="[A-Za-z0-9-]{1,39}" value={org} onChange={(e) => setOrg(e.target.value)} />
          </div>
        )}
        {connector !== 'yc' && (
          <div className="sm:col-span-2">
            <label className="label" htmlFor="run-slugs">
              {connector === 'sec_form_d' ? 'Company slugs (comma-separated, optional)' : 'Company slug'}
            </label>
            <input
              id="run-slugs"
              className="input"
              required={connector === 'github'}
              placeholder={connector === 'sec_form_d' ? 'legora, ironclad' : 'legora'}
              value={slugs}
              onChange={(e) => setSlugs(e.target.value)}
            />
          </div>
        )}
      </div>
      <p className="text-xs text-subtle">{help}</p>
      {msg && (
        <p role={msg.ok ? 'status' : 'alert'} className={`rounded-md px-3 py-2 text-sm ${msg.ok ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
          {msg.text}
        </p>
      )}
      <Button type="submit" variant="primary" loading={busy}>
        Run connector
      </Button>
    </form>
  );
}

function Users() {
  const { user } = useSession();
  const { data, error, mutate } = useApi<{ items: UserRow[] }>('/users');
  const [err, setErr] = useState<string | null>(null);

  async function setRole(id: string, role: Role) {
    setErr(null);
    try {
      await api(`/users/${id}`, { method: 'PATCH', json: { role } });
      mutate();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not change role');
    }
  }

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data) return <TableSkeleton rows={3} cols={4} />;
  return (
    <>
      {err && (
        <p role="alert" className="mx-4 mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {err}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="th">User</th>
              <th className="th">Role</th>
              <th className="th">Last sign-in</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.items.map((u) => (
              <tr key={u._id}>
                <td className="td">
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-subtle">{u.email}</div>
                </td>
                <td className="td">
                  <select
                    aria-label={`Role for ${u.email}`}
                    className="input h-8 w-32"
                    value={u.role}
                    disabled={u._id === user?.id}
                    title={u._id === user?.id ? 'You cannot change your own role' : undefined}
                    onChange={(e) => setRole(u._id, e.target.value as Role)}
                  >
                    <option value="viewer">viewer</option>
                    <option value="analyst">analyst</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="td text-xs text-subtle">{u.lastLoginAt ? relative(u.lastLoginAt) : 'never'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function AdminPage() {
  const isAdmin = useCan('admin');
  const { loading } = useSession();
  const { data: meta } = useApi<Meta>('/meta', { refreshInterval: 5000 });
  const { data: health } = useApi<Health>('/health', { refreshInterval: 10_000 });
  const runs = useApi<{ items: Run[] }>('/ingest/runs', {
    refreshInterval: (d) => (d?.items.some((r) => r.status === 'running') ? 2000 : 10_000),
  });

  if (!loading && !isAdmin)
    return (
      <div className="card">
        <EmptyState icon="🔒" title="Admins only" body="The admin console manages ingestion and user roles. Ask an admin for access." />
      </div>
    );

  const jobs = meta?.jobs ?? {};
  return (
    <>
      <PageHeader title="Admin" subtitle="System status, ingestion runs and user roles." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {!meta || !health ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[92px]" />)
        ) : (
          <>
            <Stat
              label="Services"
              value={
                <span className={`text-base ${health.status === 'ok' ? 'text-success' : 'text-danger'}`}>
                  <span aria-hidden="true">● </span>
                  {health.status === 'ok' ? 'Healthy' : 'Degraded'}
                </span>
              }
              hint={`MongoDB ${health.mongo ? 'up' : 'down'} · Redis ${health.redis === null ? 'not configured' : health.redis ? 'up' : 'down'}`}
            />
            <Stat label="Event bus" value={<span className="text-base">{meta.eventBus}</span>} hint="kafka · redis · memory" />
            <Stat
              label="Job queue"
              value={<span className="tabular text-base">{(jobs.active ?? 0) + (jobs.waiting ?? 0)} pending</span>}
              hint={jobs.completed !== undefined ? `${jobs.completed} completed · ${jobs.failed ?? 0} failed` : 'in-process (no Redis)'}
            />
            <Stat label="LLM providers" value={<span className="text-base">{meta.llm.available.join(', ')}</span>} hint={`default: ${meta.llm.default} · review below ${meta.reviewThreshold}`} />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <Card title="Run a connector">
          <RunForm onQueued={() => runs.mutate()} />
        </Card>
        <Card title="Ingestion runs" actions={<span className="text-xs text-subtle">auto-refreshing</span>}>
          {runs.error ? (
            <ErrorState error={runs.error} retry={() => runs.mutate()} />
          ) : !runs.data ? (
            <TableSkeleton rows={5} cols={4} />
          ) : runs.data.items.length === 0 ? (
            <EmptyState title="No runs yet" body="The seed loads a snapshot without calling sources. Run a connector to fetch live data." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="th">Connector</th>
                    <th className="th">Status</th>
                    <th className="th text-right">Fetched</th>
                    <th className="th text-right">Published</th>
                    <th className="th text-right">Errors</th>
                    <th className="th">Started</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {runs.data.items.map((r) => (
                    <tr key={r._id}>
                      <td className="td font-medium">{CONNECTORS.find((c) => c.id === r.connector)?.label ?? r.connector}</td>
                      <td className="td">
                        <Badge tone={r.status === 'succeeded' ? 'success' : r.status === 'failed' ? 'danger' : 'warning'}>{r.status}</Badge>
                        {r.error && <div className="mt-1 max-w-sm whitespace-normal break-words text-xs text-danger">{r.error}</div>}
                      </td>
                      <td className="td tabular text-right">{r.counts.fetched}</td>
                      <td className="td tabular text-right">{r.counts.published}</td>
                      <td className="td tabular text-right">{r.counts.errors}</td>
                      <td className="td text-xs text-subtle">{relative(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card title="Users & roles" className="mt-6">
        <Users />
      </Card>
    </>
  );
}
