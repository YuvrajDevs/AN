'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cx } from '@/lib/styles';

const prefersReduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Calls back once, the first time the element scrolls into view. */
function useInView<T extends Element>(margin = '0px 0px -12% 0px') {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (prefersReduced() || !('IntersectionObserver' in window)) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin, seen]);
  return [ref, seen] as const;
}

/** Fades and lifts its content in when it first scrolls into view. `delay` staggers siblings (ms). */
export function Reveal({ children, delay = 0, className, as: Tag = 'div' }: { children: ReactNode; delay?: number; className?: string; as?: 'div' | 'section' | 'li' | 'figure' }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  return (
    <Tag
      ref={ref as never}
      className={cx('transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]', seen ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0', className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

/** Counts a number up from zero when it scrolls into view; renders the final value for reduced motion and SSR. */
export function CountUp({ to, decimals = 0, prefix = '', suffix = '' }: { to: number; decimals?: number; prefix?: string; suffix?: string }) {
  const [ref, seen] = useInView<HTMLSpanElement>();
  const [value, setValue] = useState<number | null>(null);
  useEffect(() => {
    if (!seen) return;
    if (prefersReduced()) {
      setValue(to);
      return;
    }
    const start = performance.now();
    const ms = 1100;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setValue(to * (1 - (1 - p) ** 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, to]);
  const shown = value ?? to;
  return (
    <span ref={ref} className="tabular">
      {prefix}
      {shown.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/** Thin reading-progress bar pinned to the top of the viewport. */
export function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const on = () => {
      const h = document.documentElement.scrollHeight - innerHeight;
      setP(h > 0 ? Math.min(1, scrollY / h) : 0);
    };
    on();
    addEventListener('scroll', on, { passive: true });
    addEventListener('resize', on);
    return () => {
      removeEventListener('scroll', on);
      removeEventListener('resize', on);
    };
  }, []);
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-[3px] bg-transparent" aria-hidden="true">
      <div className="h-full origin-left bg-ink" style={{ transform: `scaleX(${p})` }} />
    </div>
  );
}

/** Section index that highlights the section currently being read. */
export function SectionNav({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id);
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [items]);
  return (
    <nav aria-label="Case study sections" className="sticky top-8">
      <p className="mb-3 text-micro font-medium uppercase tracking-wide text-subtle">Contents</p>
      <ol className="space-y-0.5 border-l border-border">
        {items.map((i, n) => (
          <li key={i.id}>
            <a
              href={`#${i.id}`}
              aria-current={active === i.id ? 'true' : undefined}
              className={cx(
                '-ml-px flex gap-2 border-l-2 py-1 pl-3 text-caption',
                active === i.id ? 'border-ink font-semibold text-fg' : 'border-transparent text-subtle hover:text-fg',
              )}
            >
              <span className="tabular w-4 text-subtle">{String(n + 1).padStart(2, '0')}</span>
              {i.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Moves its child a few pixels against the scroll, for depth on hero mockups. Off for reduced motion. */
export function Parallax({ children, strength = 0.06, className, style }: { children: ReactNode; strength?: number; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (prefersReduced()) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const offset = (r.top + r.height / 2 - innerHeight / 2) * strength;
        el.style.transform = `translate3d(0, ${(-offset).toFixed(1)}px, 0)`;
      });
    };
    on();
    addEventListener('scroll', on, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('scroll', on);
    };
  }, [strength]);
  return (
    <div ref={ref} className={cx('will-change-transform', className)} style={style}>
      {children}
    </div>
  );
}

/** An SVG path that draws itself when it scrolls into view. */
export function DrawPath({ d, className, delay = 0 }: { d: string; className?: string; delay?: number }) {
  const [ref, seen] = useInView<SVGPathElement>();
  return (
    <path
      ref={ref}
      d={d}
      pathLength={1}
      className={className}
      fill="none"
      style={{ strokeDasharray: 1, strokeDashoffset: seen ? 0 : 1, transition: `stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1) ${delay}ms` }}
    />
  );
}
