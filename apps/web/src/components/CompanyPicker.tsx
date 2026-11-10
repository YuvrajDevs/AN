'use client';

import { useEffect, useId, useState } from 'react';
import { qs, useApi } from '@/lib/api';
import type { CompanyListItem } from '@/lib/types';
import { Logo, cx } from './ui';

/** Search-as-you-type company picker. Shows names; reports the chosen company's slug. */
export function CompanyPicker({ id, value, onChange }: { id: string; value: string; onChange: (slug: string) => void }) {
  const listId = useId();
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [dq, setDq] = useState(text.trim());
  useEffect(() => {
    const t = setTimeout(() => setDq(text.trim()), 150);
    return () => clearTimeout(t);
  }, [text]);
  const { data } = useApi<{ items: CompanyListItem[] }>(dq.length >= 2 ? `/companies${qs({ q: dq, pageSize: 6 })}` : null);
  const items = data?.items ?? [];

  function choose(c: CompanyListItem) {
    setText(c.name);
    onChange(c.slug);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        id={id}
        className="input"
        value={text}
        placeholder="Search a company, e.g. Legora"
        autoComplete="off"
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-controls={listId}
        aria-activedescendant={open && items[active] ? `${listId}-${items[active].slug}` : undefined}
        onChange={(e) => {
          setText(e.target.value);
          onChange('');
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!open || items.length === 0) return;
          if (e.key === 'Escape') return setOpen(false);
          if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) return;
          e.preventDefault();
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, items.length - 1));
          else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
          else choose(items[active]);
        }}
      />
      {open && items.length > 0 && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 animate-[fadeUp_180ms_ease-out] overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-lg">
          {items.map((c, i) => (
            <li
              key={c.slug}
              id={`${listId}-${c.slug}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => (e.preventDefault(), choose(c))}
              className={cx('flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5', i === active && 'bg-pink/50')}
            >
              <Logo src={c.logoUrl} name={c.name} size={20} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{c.name}</span>
                <span className="block truncate text-[11px] text-subtle">{c.oneLiner}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
