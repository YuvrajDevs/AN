import Image from 'next/image';
import type { ReactNode } from 'react';
import { cx } from '@/lib/styles';

/** A desktop browser window around a real screenshot of the app. */
export function BrowserFrame({ src, alt, url = 'strata · app', priority, className }: { src: string; alt: string; url?: string; priority?: boolean; className?: string }) {
  return (
    <div className={cx('overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_30px_60px_-30px_rgb(var(--ink)/0.35)]', className)}>
      <div className="flex items-center gap-2 border-b border-border/70 px-3.5 py-2.5">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-pink" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow" />
          <span className="h-2.5 w-2.5 rounded-full bg-sage" />
        </span>
        <span className="mx-auto truncate rounded-full bg-muted px-3 py-0.5 text-micro text-subtle">{url}</span>
        <span className="w-[42px]" aria-hidden="true" />
      </div>
      <Image src={src} alt={alt} width={1800} height={1125} priority={priority} sizes="(min-width: 1024px) 760px, 100vw" className="block h-auto w-full" />
    </div>
  );
}

/** A phone around a real mobile screenshot of the app. */
export function PhoneFrame({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div className={cx('rounded-[34px] border-[6px] border-ink bg-ink p-0 shadow-[0_30px_60px_-30px_rgb(var(--ink)/0.5)]', className)}>
      <div className="overflow-hidden rounded-[28px]">
        <Image src={src} alt={alt} width={780} height={1328} sizes="240px" className="block h-auto w-full" />
      </div>
    </div>
  );
}

/** Numbered annotations that sit beside a mockup, the way a design review would mark up a screen. */
export function Callouts({ items, layout = 'stack' }: { items: { title: string; body: ReactNode }[]; layout?: 'stack' | 'row' }) {
  return (
    <ol className={layout === 'row' ? 'grid gap-5 md:grid-cols-3' : 'space-y-4'}>
      {items.map((c, i) => (
        <li key={c.title} className="flex gap-3">
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-micro font-semibold text-paper">{i + 1}</span>
          <div>
            <p className="text-body font-semibold">{c.title}</p>
            <p className="mt-0.5 text-body-sm leading-relaxed text-subtle">{c.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Section heading: an index, an eyebrow and a title, used for every part of the study. */
export function SectionHead({ index, eyebrow, title, lead }: { index: string; eyebrow: string; title: ReactNode; lead?: ReactNode }) {
  return (
    <header className="mb-8 max-w-3xl">
      <p className="flex items-center gap-2 text-micro font-medium uppercase tracking-wide text-subtle">
        <span className="tabular">{index}</span>
        <span className="h-px w-6 bg-border" aria-hidden="true" />
        {eyebrow}
      </p>
      <h2 className="mt-3 text-display font-semibold sm:text-section">{title}</h2>
      {lead && <p className="mt-3 text-lead text-subtle">{lead}</p>}
    </header>
  );
}
