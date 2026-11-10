'use client';

import { useState } from 'react';

/**
 * Small dependency-free SVG charts. Bars are labelled for screen readers via a visually
 * hidden data table; hovering or focusing a bar shows its value.
 */

export interface BarDatum {
  label: string;
  value: number;
  secondary?: number;
}

export function BarChart({
  data,
  format = (v) => String(v),
  height = 180,
  color = 'rgb(var(--accent))',
  ariaLabel,
}: {
  data: BarDatum[];
  format?: (v: number) => string;
  height?: number;
  color?: string;
  ariaLabel: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = 100 / Math.max(data.length, 1);
  return (
    <figure className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-full w-full overflow-visible" role="img" aria-label={ariaLabel}>
          {[0.25, 0.5, 0.75, 1].map((t) => (
            <line key={t} x1="0" x2="100" y1={height - t * (height - 4)} y2={height - t * (height - 4)} stroke="rgb(var(--border))" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
          ))}
          {data.map((d, i) => {
            const h = (d.value / max) * (height - 4);
            return (
              <rect
                key={d.label}
                x={i * barW + barW * 0.15}
                y={height - h}
                width={barW * 0.7}
                height={Math.max(h, d.value > 0 ? 1 : 0)}
                rx="0.6"
                fill={color}
                opacity={active === null || active === i ? 1 : 0.45}
                tabIndex={0}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                <title>{`${d.label}: ${format(d.value)}`}</title>
              </rect>
            );
          })}
        </svg>
        {active !== null && data[active] && (
          <div
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-xs shadow-sm"
            style={{ left: `${(active + 0.5) * barW}%` }}
          >
            <span className="font-medium">{data[active].label}</span> · <span className="tabular">{format(data[active].value)}</span>
            {data[active].secondary !== undefined && <span className="text-subtle"> · {data[active].secondary} rounds</span>}
          </div>
        )}
      </div>
      <div className="mt-1 flex text-[10px] text-subtle" aria-hidden="true">
        {data.map((d, i) => (
          <div key={d.label} className="truncate text-center" style={{ width: `${barW}%` }}>
            {data.length > 12 && i % 2 === 1 ? '' : d.label}
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th>{d.label}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function HBar({ value, max, color = 'rgb(var(--accent))' }: { value: number; max: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <div className="h-full rounded-full" style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%`, background: color }} />
    </div>
  );
}
