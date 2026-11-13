import Link from 'next/link';
import { WarmApi } from '@/components/WarmApi';
import { ArrowRight, Check, Database, FileText, Github, Layers, Search, ShieldCheck, Sparkles } from 'lucide-react';

const REPO = 'https://github.com/YuvrajDevs/AN';
const DEMO = '/login?next=%2Fdashboard';
const btn = 'inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-[14px] font-medium transition-colors';

function Mark() {
  return (
    <span className="flex items-center gap-2 text-lg font-semibold tracking-tight">
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <rect x="3" y="4" width="18" height="4" rx="2" fill="rgb(var(--pink))" />
        <rect x="3" y="10" width="13" height="4" rx="2" fill="rgb(var(--yellow))" />
        <rect x="3" y="16" width="8" height="4" rx="2" fill="rgb(var(--sky))" />
      </svg>
      strata
    </span>
  );
}

/** A compact, static rendering of the dashboard. Labels only, no invented figures beyond the seeded totals. */
function Preview() {
  const bars = [22, 30, 26, 41, 35, 52, 44, 63, 48, 100, 38, 71];
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_48px_-28px_rgb(22_21_19/0.35)]" aria-hidden="true">
      <div className="flex items-center gap-1.5 border-b border-border/70 px-3 py-2">
        {['bg-pink', 'bg-yellow', 'bg-sage'].map((c) => (
          <span key={c} className={`h-2 w-2 rounded-full ${c}`} />
        ))}
        <span className="ml-2 text-[10px] text-subtle">strata · dashboard</span>
      </div>
      <div className="flex">
        <div className="hidden w-[104px] shrink-0 space-y-1 bg-ink p-2.5 text-[10px] text-white/70 sm:block">
          <div className="mb-2 px-1.5 text-[11px] font-semibold text-white">strata</div>
          {['Dashboard', 'Companies', 'Funding', 'Sectors', 'Review', 'Briefs'].map((l, i) => (
            <div key={l} className={`rounded-md px-1.5 py-1 ${i === 0 ? 'bg-white/10 text-pink' : ''}`}>
              {l}
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-2.5 p-3">
          <div className="grid grid-cols-4 gap-2">
            {[
              ['bg-yellow', 'Companies', '465'],
              ['bg-pink', 'Filings', '136'],
              ['bg-sky', 'Sectors', '3'],
              ['bg-sage', 'To review', 'Queue'],
            ].map(([c, l, v]) => (
              <div key={l} className={`rounded-lg px-2 py-1.5 text-ink ${c}`}>
                <div className="text-[8.5px] opacity-70">{l}</div>
                <div className="text-[13px] font-semibold leading-tight">{v}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 rounded-lg border border-border/70 p-2">
              <div className="text-[9px] font-semibold text-fg">Disclosed funding by quarter</div>
              <div className="mt-2 flex h-16 items-end gap-[3px]">
                {bars.map((h, i) => (
                  <span key={i} className="flex-1 rounded-[2px] bg-fg" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
            <div className="space-y-1.5 rounded-lg border border-border/70 p-2">
              <div className="text-[9px] font-semibold text-fg">Sectors</div>
              {[
                ['Payments', 100],
                ['Climate', 78],
                ['Legal AI', 50],
              ].map(([n, w]) => (
                <div key={n}>
                  <div className="text-[8.5px] text-subtle">{n}</div>
                  <div className="h-1 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-fg" style={{ width: `${w}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="divide-y divide-border/60 rounded-lg border border-border/70">
            {['Legora', 'Kalinda', 'Kodex'].map((n) => (
              <div key={n} className="flex items-center gap-2 px-2 py-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[8px] font-semibold">{n[0]}</span>
                <span className="flex-1 text-[9.5px] font-medium text-fg">{n}</span>
                <span className="text-[8.5px] text-subtle">Reg D offering</span>
                <span className="rounded-full bg-sky px-1.5 text-[8px] font-medium text-ink">SEC</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const QUESTIONS = [
  { q: 'Which Legal AI subsectors are crowded, and which are funded?', a: 'Market map with company counts and Form D capital per subsector.' },
  { q: 'Who raised in Payments this year, and where is the filing?', a: 'Funding table filtered by sector, each row linked to its SEC document.' },
  { q: 'Who is working on carbon removal?', a: 'Ask in plain English. The answer comes from stored profiles and filings, every sentence cited.' },
];

const FEATURES = [
  { tone: 'bg-yellow', icon: Database, title: 'Primary-source funding', body: 'Rounds come from SEC Form D. A filing links to a company only when name, entity type and dates agree.' },
  { tone: 'bg-pink', icon: Sparkles, title: 'LLM labels, human review', body: 'Each company gets a subsector and a confidence. Below 0.75 it goes to a keyboard-driven queue.' },
  { tone: 'bg-sage', icon: FileText, title: 'Cited briefs and answers', body: 'Briefs and Ask Strata answers cite stored sources; any claim whose numbers are not in its source is dropped.' },
  { tone: 'bg-sky', icon: Layers, title: 'Sector landscapes', body: 'Market map, funding by year, YC cohorts and notable companies, exportable to CSV.' },
];

const PIPELINE = [
  ['Public sources', 'YC, SEC EDGAR, RSS, GitHub'],
  ['Kafka', 'Replayable event log'],
  ['MongoDB', 'Idempotent upserts'],
  ['LLM + review', 'BullMQ jobs'],
  ['Landscapes + Ask', 'Aggregations, vector search'],
];

const STACK = ['Node.js', 'Express', 'TypeScript', 'MongoDB', 'Kafka', 'Redis', 'BullMQ', 'Next.js', 'React', 'OpenAI', 'Anthropic', 'Gemini', 'Atlas Vector Search', 'Docker', 'Playwright'];

export default function Landing() {
  return (
    <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
      <WarmApi />
      <header className="flex h-16 items-center justify-between">
        <Mark />
        <nav aria-label="Landing" className="flex items-center gap-1">
          <a href="#how" className="hidden rounded-full px-3 py-1.5 text-body-sm text-subtle hover:text-fg sm:inline">
            How it works
          </a>
          <a href={REPO} target="_blank" rel="noopener noreferrer" className="hidden rounded-full px-3 py-1.5 text-body-sm text-subtle hover:text-fg sm:inline">
            GitHub
          </a>
          <Link href={DEMO} className="ml-1 inline-flex h-9 items-center rounded-full bg-fg px-4 text-body-sm font-medium text-bg hover:bg-fg/85">
            Sign in
          </Link>
        </nav>
      </header>

      <main>
        <section className="grid items-center gap-10 pb-14 pt-8 lg:grid-cols-[1fr_1.1fr] lg:pt-12">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-caption font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" /> Live demo on real public data
            </span>
            <h1 className="mt-4 text-[36px] font-semibold leading-[1.08] tracking-tight sm:text-[46px]">Startup intelligence you can check.</h1>
            <p className="mt-4 max-w-md text-lead leading-relaxed text-subtle">
              Track startups by sector, see funding taken from SEC filings, and read briefs where every claim cites its source.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link href={DEMO} className={`${btn} bg-fg text-bg hover:bg-fg/85`}>
                Try the live demo <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a href={REPO} target="_blank" rel="noopener noreferrer" className={`${btn} border border-border bg-surface hover:bg-muted`}>
                <Github className="h-4 w-4" aria-hidden="true" /> Source
              </a>
            </div>
            <ul className="mt-5 space-y-1.5 text-body-sm text-subtle">
              {['Demo account pre-filled, one click to sign in', 'No paid data: YC directory, SEC EDGAR, RSS, GitHub'].map((t) => (
                <li key={t} className="flex items-stretch gap-2">
                  <Check className="h-3.5 w-3.5 text-fg" aria-hidden="true" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <Preview />
        </section>

        <section aria-label="Key numbers" className="grid grid-cols-2 divide-border/70 rounded-2xl border border-border/70 bg-surface sm:grid-cols-4 sm:divide-x">
          {[
            ['465', 'Startups tracked'],
            ['136 / 234', 'SEC filings kept after checks'],
            ['3', 'Sectors mapped'],
            ['167', 'Automated tests in CI'],
          ].map(([v, l]) => (
            <div key={l} className="px-5 py-4">
              <div className="tabular text-title font-semibold tracking-tight">{v}</div>
              <div className="mt-0.5 text-caption text-subtle">{l}</div>
            </div>
          ))}
        </section>

        <section aria-labelledby="answers" className="pt-16">
          <h2 id="answers" className="text-display font-semibold tracking-tight">
            Questions it answers
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {QUESTIONS.map((x) => (
              <article key={x.q} className="rounded-2xl border border-border/70 bg-surface p-4">
                <Search className="h-4 w-4 text-subtle" aria-hidden="true" />
                <h3 className="mt-2.5 text-lead font-semibold leading-snug">{x.q}</h3>
                <p className="mt-1.5 text-body-sm leading-relaxed text-subtle">{x.a}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="features" className="pt-16">
          <h2 id="features" className="text-display font-semibold tracking-tight">
            Built to show its working
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <article key={f.title} className="rounded-2xl border border-border/70 bg-surface p-4">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-ink ${f.tone}`}>
                  <f.icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-lead font-semibold">{f.title}</h3>
                <p className="mt-1 text-body-sm leading-relaxed text-subtle">{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how" aria-labelledby="how-h" className="scroll-mt-6 pt-16">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <h2 id="how-h" className="text-display font-semibold tracking-tight">
              How it works
            </h2>
            <p className="max-w-md text-body-sm text-subtle">Every write is an upsert on a natural key, so replaying the log never duplicates data.</p>
          </div>
          <ol className="mt-5 grid gap-2 sm:grid-cols-5">
            {PIPELINE.map(([t, s], i) => (
              <li key={t} className="flex items-stretch gap-2">
                <div className="flex-1 rounded-xl border border-border/70 bg-surface px-3 py-2.5">
                  <div className="tabular text-micro text-subtle">0{i + 1}</div>
                  <div className="text-body-sm font-semibold">{t}</div>
                  <div className="text-micro text-subtle">{s}</div>
                </div>
                {i < PIPELINE.length - 1 && <ArrowRight className="hidden h-3.5 w-3.5 shrink-0 self-center text-subtle sm:block" aria-hidden="true" />}
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {STACK.map((s) => (
              <span key={s} className="rounded-full border border-border bg-surface px-2.5 py-1 text-caption">
                {s}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-16 flex flex-col gap-4 rounded-2xl bg-ink px-6 py-7 text-white sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <h2 className="text-title font-semibold tracking-tight">See it with real data</h2>
            <p className="mt-1 text-body-sm text-white/70">Legal AI, Climate Tech and Payments. The analyst account is ready; the first load may take a minute on free hosting.</p>
          </div>
          <Link href={DEMO} className={`${btn} bg-white text-ink hover:bg-white/85`}>
            Try the live demo <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      </main>

      <footer className="flex flex-col gap-2 py-8 text-caption text-subtle sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Public data only. No paid databases or scraping.
        </span>
        <span>
          Built by{' '}
          <a href="https://github.com/YuvrajDevs" target="_blank" rel="noopener noreferrer" className="font-medium text-fg hover:underline">
            Yuvraj Singh Shekhawat
          </a>
        </span>
      </footer>
    </div>
  );
}
