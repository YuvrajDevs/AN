/** Class helpers and colour tokens. No React and no 'use client', so server and client components can both import them. */

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

export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const BTN_BASE = 'inline-flex shrink-0 items-center whitespace-nowrap justify-center gap-1.5 rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';
const BTN_VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent/85',
  secondary: 'border border-border bg-surface text-fg hover:bg-muted',
  ghost: 'text-subtle hover:bg-muted hover:text-fg',
  danger: 'border border-danger/30 bg-surface text-danger hover:bg-danger/10',
};
export function buttonClass(variant: Variant = 'secondary', size: 'sm' | 'md' = 'md', className?: string) {
  return cx(BTN_BASE, size === 'sm' ? 'h-8 px-3 text-caption' : 'h-9 px-4 text-body-sm', BTN_VARIANT[variant], className);
}
