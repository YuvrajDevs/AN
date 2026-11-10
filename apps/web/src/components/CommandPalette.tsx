'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { qs, useApi } from '@/lib/api';
import type { CompanyListItem } from '@/lib/types';
import { Kbd, Logo, Spinner, cx } from './ui';

const PAGES = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Companies', href: '/companies' },
  { label: 'Funding rounds', href: '/funding' },
  { label: 'Sectors & taxonomy', href: '/sectors' },
  { label: 'Review queue', href: '/review' },
  { label: 'Watchlists', href: '/watchlists' },
  { label: 'Alerts', href: '/alerts' },
  { label: 'Analyst briefs', href: '/briefs' },
];

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** ⌘K / Ctrl+K: jump to any company or page from the keyboard. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dq = useDebounced(q.trim(), 150);
  const { data, isLoading } = useApi<{ items: CompanyListItem[] }>(open && dq.length >= 2 ? `/companies${qs({ q: dq, pageSize: 8 })}` : null);

  const results = useMemo(() => {
    const pages = PAGES.filter((p) => !q || p.label.toLowerCase().includes(q.toLowerCase())).map((p) => ({ key: p.href, label: p.label, hint: 'Page', href: p.href, logo: null as string | null }));
    const companies = (data?.items ?? []).map((c) => ({ key: c.slug, label: c.name, hint: c.oneLiner, href: `/companies/${c.slug}`, logo: c.logoUrl }));
    return [...companies, ...pages].slice(0, 12);
  }, [data, q]);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);
  useEffect(() => setActive(0), [dq]);

  if (!open) return null;
  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          }
          if (e.key === 'Enter' && results[active]) go(results[active].href);
        }}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <span className="text-subtle" aria-hidden="true">
            ⌕
          </span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search companies or jump to a page…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={results[active] ? `pal-${results[active].key}` : undefined}
          />
          {isLoading && <Spinner className="h-4 w-4 text-subtle" />}
        </div>
        <ul id="palette-results" role="listbox" className="max-h-80 overflow-y-auto p-1">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-subtle">No matches</li>}
          {results.map((r, i) => (
            <li
              key={r.key}
              id={`pal-${r.key}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(r.href)}
              className={cx('flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2', i === active && 'bg-pink/60')}
            >
              {r.hint === 'Page' ? <span className="w-6 text-center text-subtle">→</span> : <Logo src={r.logo} name={r.label} size={24} />}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.label}</span>
                <span className="block truncate text-xs text-subtle">{r.hint}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-[11px] text-subtle">
          <span>
            <Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate
          </span>
          <span>
            <Kbd>↵</Kbd> open
          </span>
          <span>
            <Kbd>esc</Kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
