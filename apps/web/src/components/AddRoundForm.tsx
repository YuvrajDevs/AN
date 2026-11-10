'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { ROUND_LABELS } from '@/lib/format';
import { Button } from './ui';

/**
 * Analysts can record a round by hand, but only with a source: the API stores the
 * source so the round stays citable in briefs and exports, and fires the same
 * funding.created event as ingestion (so watchlist alerts work).
 */
export function AddRoundForm({ companySlug, onDone }: { companySlug: string; onDone: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [roundType, setRoundType] = useState('seed');
  const [amount, setAmount] = useState('');
  const [investors, setInvestors] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceExcerpt, setSourceExcerpt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/funding', {
        method: 'POST',
        json: {
          companySlug,
          date,
          roundType,
          amountUsd: amount ? Math.round(Number(amount) * 1e6) : null,
          investors: investors.split(',').map((s) => s.trim()).filter(Boolean),
          sourceUrl,
          sourceTitle,
          sourceExcerpt,
        },
      });
      onDone();
    } catch (err) {
      const d = err instanceof ApiError ? (err.details as { path: string; message: string }[] | undefined) : undefined;
      setError(d?.[0] ? `${d[0].path.replace('body.', '')}: ${d[0].message}` : err instanceof ApiError ? err.message : 'Could not save round');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 border-b border-border bg-muted/30 p-4 sm:grid-cols-2" onKeyDown={(e) => e.key === 'Escape' && onDone()}>
      <div>
        <label className="label" htmlFor="r-date">
          Date
        </label>
        <input id="r-date" type="date" className="input" value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="r-type">
          Round type
        </label>
        <select id="r-type" className="input" value={roundType} onChange={(e) => setRoundType(e.target.value)}>
          {Object.entries(ROUND_LABELS)
            .filter(([k]) => k !== 'reg_d_offering')
            .map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="r-amount">
          Amount ($M, blank if undisclosed)
        </label>
        <input id="r-amount" type="number" min="0" step="0.1" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="r-investors">
          Investors (comma-separated, lead first)
        </label>
        <input id="r-investors" className="input" value={investors} onChange={(e) => setInvestors(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="r-url">
          Source URL (required: every round must be citable)
        </label>
        <input id="r-url" type="url" className="input" placeholder="https://company.com/blog/series-a" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} required />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="r-title">
          Source title
        </label>
        <input id="r-title" className="input" value={sourceTitle} onChange={(e) => setSourceTitle(e.target.value)} required />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="r-excerpt">
          Evidence excerpt (the sentence that states the raise)
        </label>
        <textarea id="r-excerpt" className="input h-16 py-2" value={sourceExcerpt} onChange={(e) => setSourceExcerpt(e.target.value)} required />
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger sm:col-span-2">
          {error}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" variant="primary" size="sm" loading={saving}>
          Save round
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
