const cx = (...c: (string | undefined)[]) => c.filter(Boolean).join(' ');

/** Decorative shape in the corner of a pastel card. */
export function Blob({ shape, className }: { shape: 'circle' | 'star' | 'tri' | 'plus'; className?: string }) {
  const common = cx('pointer-events-none absolute opacity-[0.14]', className);
  if (shape === 'circle') return <div className={cx(common, 'rounded-full bg-ink')} aria-hidden="true" />;
  const d =
    shape === 'star'
      ? 'M50 0l11 30 31-9-19 26 27 17-32 4 3 32-21-24-21 24 3-32-32-4 27-17L8 21l31 9z'
      : shape === 'tri'
        ? 'M0 10h100L50 100z'
        : 'M35 0h30v35h35v30H65v35H35V65H0V35h35z';
  return (
    <svg viewBox="0 0 100 100" className={common} aria-hidden="true">
      <path d={d} fill="rgb(var(--ink))" />
    </svg>
  );
}
