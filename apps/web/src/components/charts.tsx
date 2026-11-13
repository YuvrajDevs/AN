'use client';

import { useEffect, useState } from 'react';

/**
 * Small dependency-free charts built from HTML, so bars can animate with CSS transitions.
 * Each bar is labelled for screen readers; hovering or focusing shows its value, and when
 * `onSelect` is given, clicking a bar selects it (drill-down).
 */

export interface BarDatum {
  label: string;
  /** Full name for the readout and screen readers when the axis label is abbreviated ('25 -> 2025). */
  title?: string;
  value: number;
  secondary?: number;
}

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** Scale labels must fit a narrow column: use the chart's own format when short ("$500M"), else a bare compact number. */
function axisLabel(v: number, format: (v: number) => string): string {
  const f = format(v);
  if (f.length <= 6) return f;
  return v >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${+(v / 1e3).toFixed(1)}K` : String(+v.toFixed(1));
}

/** Round a maximum up to a readable axis top: 1, 2, 2.5 or 5 times a power of ten. */
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= max) return m * p;
  return 10 * p;
}

export function BarChart({
  data,
  format = (v) => String(v),
  secondaryLabel = (n) => `${n} ${n === 1 ? 'round' : 'rounds'}`,
  height = 180,
  color = 'rgb(var(--fg))',
  ariaLabel,
  selected = null,
  onSelect,
}: {
  data: BarDatum[];
  format?: (v: number) => string;
  secondaryLabel?: (n: number) => string;
  height?: number;
  color?: string;
  ariaLabel: string;
  selected?: number | null;
  onSelect?: (index: number | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  // Grow bars from zero after mount, and re-animate smoothly when values change.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const top = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const ticks = [top, top / 2, 0];
  const total = data.reduce((a, d) => a + d.value, 0);
  const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0);
  const focus = hover ?? selected;
  const tip = focus !== null && data[focus] ? focus : null;
  const thin = data.length > 8;

  return (
    <figure className="w-full">
      {/* Value readout: shows the hovered (or selected) bar. Stays in place, so nothing is clipped. */}
      <div className="mb-2 flex h-5 items-baseline gap-1.5 text-caption" aria-live="polite">
        {tip !== null ? (
          <>
            <span className="font-semibold">{data[tip].title ?? data[tip].label}</span>
            <span className="tabular font-semibold">{format(data[tip].value)}</span>
            {data[tip].secondary !== undefined && <span className="text-subtle">· {secondaryLabel(data[tip].secondary!)}</span>}
          </>
        ) : data.length ? (
          <span className="text-subtle">
            Total <span className="tabular font-semibold text-fg">{format(total)}</span>
            {data[peak]?.value > 0 && (
              <>
                {' '}· peak <span className="font-semibold text-fg">{data[peak].title ?? data[peak].label}</span>
              </>
            )}
            {onSelect ? ' · select a bar for detail' : ''}
          </span>
        ) : null}
      </div>
      <div className="flex">
      {/* value scale: top, middle and zero, so bar heights can be read without hovering */}
      <div className="relative mr-2 w-10 shrink-0 text-right text-micro tabular text-subtle" style={{ height }} aria-hidden="true">
        {ticks.map((t, i) => (
          <span key={i} className="absolute right-0 -translate-y-1/2 whitespace-nowrap" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}>
            {t === 0 ? '0' : axisLabel(t, format)}
          </span>
        ))}
      </div>
      <div className="relative flex-1" style={{ height }} role="group" aria-label={ariaLabel} onMouseLeave={() => setHover(null)}>
        {/* gridlines at the scale ticks */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden="true">
          {ticks.map((_, i) => (
            <div key={i} className={i === ticks.length - 1 ? 'border-t border-fg/[0.18]' : 'border-t border-dashed border-fg/[0.09]'} />
          ))}
        </div>
        <div className="absolute inset-0 flex items-end">
          {data.map((d, i) => {
            const h = ready ? Math.max((d.value / top) * 100, d.value > 0 ? 1.5 : 0) : 0;
            const dim = focus !== null && i !== hover && i !== selected;
            const isSel = selected === i;
            const label = `${d.title ?? d.label}: ${format(d.value)}${d.secondary !== undefined ? `, ${secondaryLabel(d.secondary)}` : ''}`;
            const common = {
              onMouseEnter: () => setHover(i),
              onFocus: () => setHover(i),
              onBlur: () => setHover(null),
              style: {
                height: `${h}%`,
                width: data.length > 14 ? 'calc(100% - 4px)' : '70%',
                background: color,
                opacity: dim ? 0.28 : 1,
                transition: `height 700ms ${EASE} ${Math.min(i * 25, 300)}ms, opacity 250ms ease, transform 250ms ${EASE}`,
                transform: isSel ? 'scaleX(1.06)' : undefined,
              } as React.CSSProperties,
              className: 'relative min-w-[3px] rounded-t-[5px] rounded-b-[2px] outline-none focus-visible:ring-2 focus-visible:ring-fg/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
            };
            return (
              <div key={d.label} className="flex h-full flex-1 items-end justify-center">
                {onSelect ? (
                  <button type="button" aria-label={label} aria-pressed={isSel} onClick={() => onSelect(isSel ? null : i)} {...common} className={`${common.className} cursor-pointer`} />
                ) : (
                  <div tabIndex={0} role="img" aria-label={label} {...common} />
                )}
              </div>
            );
          })}
        </div>
      </div>
      </div>
      <div className="ml-12 mt-1.5 flex text-micro text-subtle" aria-hidden="true">
        {data.map((d, i) => (
          <div key={d.label} className={`whitespace-nowrap text-center transition-colors duration-200 ${selected === i ? 'font-semibold text-fg' : ''}`} style={{ width: `${100 / data.length}%` }}>
            {thin && i % 2 === 1 && selected !== i ? '' : d.label}
          </div>
        ))}
      </div>
    </figure>
  );
}

export function HBar({ value, max, color = 'rgb(var(--fg))' }: { value: number; max: number; color?: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <div className="h-full rounded-full" style={{ width: ready && max ? `${Math.max(2, (value / max) * 100)}%` : '0%', background: color, transition: `width 700ms ${EASE}` }} />
    </div>
  );
}

/* ---- KPI tile visuals: small, labelled, and drawn in ink so they read on any pastel ---- */

/** A trend line with a soft fill. The last point is marked, since "where are we now" is the question. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const w = 120, h = 44, pad = 3;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const pts = values.map((v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-11 w-full" role="img" aria-label={label}>
      {pts.length > 1 && <path d={`${line}L${last[0]},${h}L${pts[0][0]},${h}Z`} fill="rgb(var(--ink) / 0.08)" />}
      <path d={line} fill="none" stroke="rgb(var(--ink))" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      {last && <circle cx={last[0]} cy={last[1]} r="2.75" fill="rgb(var(--ink))" />}
    </svg>
  );
}

/** Share of a whole as a ring, with the percentage inside so it reads without hovering. */
export function Ring({ value, max, label }: { value: number; max: number; label: string }) {
  const r = 18, c = 2 * Math.PI * r;
  const share = max ? Math.min(1, value / max) : 0;
  return (
    <svg viewBox="0 0 48 48" className="ml-auto h-12 w-12" role="img" aria-label={`${label}: ${Math.round(share * 100)}%`}>
      <circle cx="24" cy="24" r={r} fill="none" stroke="rgb(var(--ink) / 0.12)" strokeWidth="5" />
      <circle cx="24" cy="24" r={r} fill="none" stroke="rgb(var(--ink))" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${share * c} ${c}`} transform="rotate(-90 24 24)" />
      <text x="24" y="27.5" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="rgb(var(--ink))">{Math.round(share * 100)}%</text>
    </svg>
  );
}

/** A labelled split: each part gets a row with its count and a bar, so the breakdown reads at a glance. */
export function SplitBars({ parts }: { parts: { label: string; value: number }[] }) {
  const max = Math.max(1, ...parts.map((p) => p.value));
  return (
    <ul className="space-y-1 text-micro" aria-label="Breakdown">
      {parts.map((p) => (
        <li key={p.label} className="grid grid-cols-[1fr_auto] items-center gap-x-2">
          <span className="block h-1.5 rounded-full bg-ink/10">
            <span className="block h-full rounded-full bg-ink" style={{ width: `${Math.max(4, (p.value / max) * 100)}%` }} />
          </span>
          <span className="tabular whitespace-nowrap text-ink/70">
            <span className="font-semibold text-ink">{p.value}</span> {p.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Sizes side by side, largest first: for "how is this spread", not for a trend over time. */
export function MiniBars({ values, label }: { values: { name: string; value: number }[]; label: string }) {
  const max = Math.max(1, ...values.map((v) => v.value));
  return (
    <div className="flex h-11 items-end gap-[3px]" role="img" aria-label={`${label}: ${values.map((v) => `${v.name} ${v.value}`).join(', ')}`}>
      {values.map((v) => (
        <span key={v.name} title={`${v.name}: ${v.value}`} className="flex-1 rounded-t-[3px] rounded-b-[1px] bg-ink" style={{ height: `${Math.max(8, (v.value / max) * 100)}%`, opacity: 0.35 + 0.65 * (v.value / max) }} />
      ))}
    </div>
  );
}
