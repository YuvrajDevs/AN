'use client';

import Link from 'next/link';
import { forwardRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import { pct } from '@/lib/format';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export type Tone = 'yellow' | 'pink' | 'sage' | 'sky';
export const TONES: Tone[] = ['yellow', 'pink', 'sage', 'sky'];
export const TONE_BG: Record<Tone, string> = { yellow: 'bg-yellow', pink: 'bg-pink', sage: 'bg-sage', sky: 'bg-sky' };

/** Stable pastel for a sector, from its seed colour (indigo → pink, emerald → sage, amber → yellow). */
export function sectorTone(color?: string | null, index = 0): Tone {
  const c = (color ?? '').toLowerCase();
  if (c === '#4f46e5') return 'pink';
  if (c === '#059669') return 'sage';
  if (c === '#d97706') return 'yellow';
  return TONES[index % TONES.length];
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const BTN_BASE = 'inline-flex shrink-0 items-center whitespace-nowrap justify-center gap-1.5 rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';
const BTN_VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent/85',
  secondary: 'border border-border bg-surface text-fg hover:bg-muted',
  ghost: 'text-subtle hover:bg-muted hover:text-fg',
  danger: 'border border-danger/30 bg-surface text-danger hover:bg-danger/10',
};
export function buttonClass(variant: Variant = 'secondary', size: 'sm' | 'md' = 'md', className?: string) {
  return cx(BTN_BASE, size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-[13px]', BTN_VARIANT[variant], className);
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean }>(
  function Button({ variant = 'secondary', size = 'md', loading, className, children, disabled, ...props }, ref) {
    return (
      <button ref={ref} disabled={disabled || loading} className={buttonClass(variant, size, className)} {...props}>
        {loading && <Spinner className="h-3.5 w-3.5" />}
        {children}
      </button>
    );
  },
);

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={cx('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | Tone; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium',
        tone === 'neutral' && 'bg-muted text-subtle',
        tone === 'accent' && 'bg-sky text-ink',
        tone === 'success' && 'bg-success/15 text-success',
        tone === 'warning' && 'bg-warning/15 text-warning',
        tone === 'danger' && 'bg-danger/10 text-danger',
        (tone === 'yellow' || tone === 'pink' || tone === 'sage' || tone === 'sky') && `${TONE_BG[tone]} text-ink`,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] opacity-70">{children}</kbd>;
}

export function ConfidenceBadge({ value, state }: { value: number | null; state?: string }) {
  if (state === 'reviewed') return <Badge tone="sage">✓ Reviewed</Badge>;
  if (value === null || value === undefined) return <Badge>Unclassified</Badge>;
  const tone = value >= 0.75 ? 'success' : value >= 0.5 ? 'warning' : 'danger';
  return (
    <Badge tone={tone} className="tabular">
      {pct(value)} {state === 'pending_review' ? '· review' : ''}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone = status === 'active' ? 'sage' : status === 'acquired' ? 'sky' : status === 'public' ? 'yellow' : 'neutral';
  return <Badge tone={tone}>{status}</Badge>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} aria-hidden="true" />;
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cx('h-5', c === 0 ? 'w-1/3' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, body, action, icon = '◇' }: { title: string; body?: ReactNode; action?: ReactNode; icon?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-muted text-base text-subtle" aria-hidden="true">
        {icon}
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-subtle">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const msg = error instanceof ApiError ? error.message : 'We could not load this data.';
  const status = error instanceof ApiError ? error.status : null;
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-pink font-semibold text-ink" aria-hidden="true">
        !
      </div>
      <h3 className="text-sm font-semibold">{status === 404 ? 'Not found' : status === 429 ? 'Slow down' : 'Something went wrong'}</h3>
      <p className="mt-1 max-w-sm text-sm text-subtle">{msg}</p>
      {retry && (
        <Button className="mt-4" size="sm" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, crumbs }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; crumbs?: { href: string; label: string }[] }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {crumbs && (
          <nav aria-label="Breadcrumb" className="mb-1.5 flex flex-wrap items-center gap-1 text-xs text-subtle">
            {crumbs.map((c, i) => (
              <span key={c.href} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden="true">/</span>}
                <Link href={c.href} className="rounded-full px-1 hover:text-fg">
                  {c.label}
                </Link>
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-2xl font-semibold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-subtle">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** KPI tile. With a tone it becomes a pastel card, as on the dashboard. */
export function Stat({ label, value, hint, tone, children }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone; children?: ReactNode }) {
  return (
    <div className={cx('flex flex-col px-4 py-3.5', tone ? cx('pastel', TONE_BG[tone]) : 'card')}>
      <div className="text-xs font-medium text-subtle">{label}</div>
      <div className="tabular mt-1 text-[22px] font-semibold leading-tight tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] leading-snug text-subtle">{hint}</div>}
      {children}
    </div>
  );
}

export function Logo({ src, name, size = 28 }: { src?: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      // External logos from the YC directory; next/image optimisation is disabled for remote hosts.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="shrink-0 rounded-full border border-border bg-white object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div className="flex shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-subtle" style={{ width: size, height: size }} aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function Card({ title, actions, children, className, bodyClass }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cx('card overflow-hidden', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
          <h2 className="text-[13px] font-semibold">{title}</h2>
          {actions}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

/** Pill segmented control (Today / Week / Month style). */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-full bg-muted p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={o.value}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx('rounded-full px-2.5 py-0.5 font-medium', value === o.value ? 'bg-fg text-bg' : 'text-subtle hover:text-fg')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
