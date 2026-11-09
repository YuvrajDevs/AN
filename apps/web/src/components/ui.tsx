'use client';

import Link from 'next/link';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import { pct } from '@/lib/format';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean }>(
  function Button({ variant = 'secondary', size = 'md', loading, className, children, disabled, ...props }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cx(
          'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
          variant === 'primary' && 'bg-accent text-accent-fg hover:bg-accent/90',
          variant === 'secondary' && 'border border-border bg-surface text-fg hover:bg-muted',
          variant === 'ghost' && 'text-subtle hover:bg-muted hover:text-fg',
          variant === 'danger' && 'border border-danger/30 bg-surface text-danger hover:bg-danger/10',
          className,
        )}
        {...props}
      >
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

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger'; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium',
        tone === 'neutral' && 'bg-muted text-subtle',
        tone === 'accent' && 'bg-accent/10 text-accent',
        tone === 'success' && 'bg-success/10 text-success',
        tone === 'warning' && 'bg-warning/10 text-warning',
        tone === 'danger' && 'bg-danger/10 text-danger',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-subtle">{children}</kbd>;
}

export function ConfidenceBadge({ value, state }: { value: number | null; state?: string }) {
  if (state === 'reviewed') return <Badge tone="success">✓ Reviewed</Badge>;
  if (value === null || value === undefined) return <Badge>Unclassified</Badge>;
  const tone = value >= 0.75 ? 'success' : value >= 0.5 ? 'warning' : 'danger';
  return (
    <Badge tone={tone} className="tabular">
      {pct(value)} {state === 'pending_review' ? '· review' : ''}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone = status === 'active' ? 'success' : status === 'acquired' ? 'accent' : status === 'public' ? 'accent' : 'neutral';
  return <Badge tone={tone}>{status}</Badge>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} aria-hidden="true" />;
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-3" role="status" aria-label="Loading">
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
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg text-subtle" aria-hidden="true">
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
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-danger/10 text-danger" aria-hidden="true">
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
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {crumbs && (
          <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1 text-xs text-subtle">
            {crumbs.map((c, i) => (
              <span key={c.href} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden="true">/</span>}
                <Link href={c.href} className="hover:text-fg">
                  {c.label}
                </Link>
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-subtle">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-subtle">{label}</div>
      <div className="tabular mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-subtle">{hint}</div>}
    </div>
  );
}

export function Logo({ src, name, size = 28 }: { src?: string | null; name: string; size?: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} loading="lazy" className="shrink-0 rounded-md border border-border bg-white object-contain" style={{ width: size, height: size }} />;
  }
  return (
    <div className="flex shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-subtle" style={{ width: size, height: size }} aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function Card({ title, actions, children, className, bodyClass }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cx('card', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {actions}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}
