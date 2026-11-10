'use client';

import { useEffect, useState } from 'react';

/**
 * Small dependency-free charts built from HTML, so bars can animate with CSS transitions.
 * Each bar is labelled for screen readers; hovering or focusing shows its value, and when
 * `onSelect` is given, clicking a bar selects it (drill-down).
 */

export interface BarDatum {
  label: string;
  value: number;
  secondary?: number;
}

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

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

  const max = Math.max(1, ...data.map((d) => d.value));
  const focus = hover ?? selected;
  const tip = focus !== null && data[focus] ? focus : null;
  const thin = data.length > 8;

  return (
    <figure className="w-full">
      {/* Value readout: shows the hovered (or selected) bar. Stays in place, so nothing is clipped. */}
      <div className="mb-2 flex h-5 items-baseline gap-1.5 text-xs" aria-live="polite">
        {tip !== null ? (
          <>
            <span className="font-semibold">{data[tip].label}</span>
            <span className="tabular font-semibold">{format(data[tip].value)}</span>
            {data[tip].secondary !== undefined && <span className="text-subtle">· {secondaryLabel(data[tip].secondary!)}</span>}
          </>
        ) : (
          <span className="text-subtle">Hover a bar for its value</span>
        )}
      </div>
      <div className="relative" style={{ height }} role="group" aria-label={ariaLabel} onMouseLeave={() => setHover(null)}>
        {/* gridlines */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-t border-fg/[0.07]" />
          ))}
        </div>
        <div className="absolute inset-0 flex items-end">
          {data.map((d, i) => {
            const h = ready ? Math.max((d.value / max) * 100, d.value > 0 ? 1.5 : 0) : 0;
            const dim = focus !== null && i !== hover && i !== selected;
            const isSel = selected === i;
            const label = `${d.label}: ${format(d.value)}${d.secondary !== undefined ? `, ${secondaryLabel(d.secondary)}` : ''}`;
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
      <div className="mt-1.5 flex text-[10px] text-subtle" aria-hidden="true">
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
