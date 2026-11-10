'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useCan } from '@/components/session';
import { Badge, Button, Card, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import { api, ApiError, useApi } from '@/lib/api';
import type { TaxonomyNode } from '@/lib/types';

function NodeEditor({ node, onDone, parentSlug }: { node?: TaxonomyNode; parentSlug?: string | null; onDone: () => void }) {
  const [name, setName] = useState(node?.name ?? '');
  const [description, setDescription] = useState(node?.description ?? '');
  const [keywords, setKeywords] = useState((node?.keywords ?? []).join(', '));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = { name, description, keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean) };
    try {
      if (node) await api(`/sectors/${node.slug}`, { method: 'PATCH', json: body });
      else await api('/sectors', { method: 'POST', json: { ...body, parentSlug: parentSlug ?? null, tracked: !parentSlug } });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? (err.details as { message: string }[] | undefined)?.[0]?.message ?? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-md border border-ink/30 bg-yellow/30 p-3" onKeyDown={(e) => e.key === 'Escape' && onDone()}>
      <div>
        <label className="label" htmlFor={`n-${node?.slug ?? 'new'}`}>
          Name
        </label>
        <input id={`n-${node?.slug ?? 'new'}`} className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus required minLength={2} />
      </div>
      <div>
        <label className="label" htmlFor={`d-${node?.slug ?? 'new'}`}>
          Definition <span className="font-normal">(shown to the LLM classifier verbatim)</span>
        </label>
        <textarea id={`d-${node?.slug ?? 'new'}`} className="input h-20 py-2" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor={`k-${node?.slug ?? 'new'}`}>
          Keywords <span className="font-normal">(comma-separated; used by the offline classifier)</span>
        </label>
        <input id={`k-${node?.slug ?? 'new'}`} className="input" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary" loading={saving}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function SectorsPage() {
  const { data, error, mutate } = useApi<{ taxonomy: TaxonomyNode[] }>('/sectors');
  const canEdit = useCan('analyst');
  const canDelete = useCan('admin');
  const [editing, setEditing] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function remove(slug: string) {
    if (!confirm(`Delete "${slug}"? This cannot be undone.`)) return;
    setActionError(null);
    try {
      await api(`/sectors/${slug}`, { method: 'DELETE' });
      mutate();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Delete failed');
    }
  }

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  const done = () => {
    setEditing(null);
    mutate();
  };

  return (
    <>
      <PageHeader
        title="Sectors & taxonomy"
        subtitle="Each tracked sector is split into subsectors. Definitions drive LLM classification; changes apply to the next classification run."
        actions={
          canEdit && (
            <Button variant="primary" onClick={() => setEditing('new-sector')}>
              New sector
            </Button>
          )
        }
      />
      {actionError && (
        <p role="alert" className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {actionError}
        </p>
      )}
      {editing === 'new-sector' && (
        <div className="mb-4">
          <NodeEditor onDone={done} parentSlug={null} />
        </div>
      )}
      <div className="space-y-6">
        {!data
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64" />)
          : data.taxonomy.map((s) => (
              <Card
                key={s.slug}
                title={
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color ?? 'rgb(var(--accent))' }} aria-hidden="true" />
                    {s.name}
                    {s.tracked && <Badge tone="success">tracked</Badge>}
                    <span className="text-xs font-normal text-subtle">{s.companyCount} classified</span>
                  </span>
                }
                actions={
                  <div className="flex gap-2">
                    <Link href={`/sectors/${s.slug}`} className="inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full bg-accent px-3 text-xs font-medium text-accent-fg hover:bg-accent/90">
                      Landscape →
                    </Link>
                    {canEdit && (
                      <Button size="sm" onClick={() => setEditing(`add:${s.slug}`)}>
                        Add subsector
                      </Button>
                    )}
                  </div>
                }
              >
                <p className="border-b border-border px-4 py-2 text-xs text-subtle">
                  {s.description} {s.sourceTags.length > 0 && <>Ingested from YC tags: {s.sourceTags.join(', ')}.</>}
                </p>
                {editing === `add:${s.slug}` && (
                  <div className="p-4">
                    <NodeEditor parentSlug={s.slug} onDone={done} />
                  </div>
                )}
                <ul className="divide-y divide-border">
                  {s.children.map((c) => (
                    <li key={c.slug} className="px-4 py-3">
                      {editing === c.slug ? (
                        <NodeEditor node={c} onDone={done} />
                      ) : (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Link href={`/companies?sector=${s.slug}&subsector=${c.slug}`} className="font-medium hover:underline">
                                {c.name}
                              </Link>
                              <span className="tabular text-xs text-subtle">{c.companyCount}</span>
                            </div>
                            <p className="mt-0.5 text-xs text-subtle">{c.description}</p>
                          </div>
                          {canEdit && (
                            <div className="flex shrink-0 gap-1">
                              <Button size="sm" variant="ghost" onClick={() => setEditing(c.slug)}>
                                Edit
                              </Button>
                              {canDelete && (
                                <Button size="sm" variant="ghost" onClick={() => remove(c.slug)}>
                                  Delete
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
      </div>
    </>
  );
}
