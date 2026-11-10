import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, Database, FileText, Github, Layers, Quote, ShieldCheck, Sparkles } from 'lucide-react';
import { Blob } from '@/components/decor';

const REPO = 'https://github.com/YuvrajDevs/AN';

const pill = 'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors';

function Mark() {
  return (
    <span className="flex items-center gap-2 text-[22px] font-semibold tracking-tight">
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        <rect x="3" y="4" width="18" height="4" rx="2" fill="rgb(var(--pink))" />
        <rect x="3" y="10" width="13" height="4" rx="2" fill="rgb(var(--yellow))" />
        <rect x="3" y="16" width="8" height="4" rx="2" fill="rgb(var(--sky))" />
      </svg>
      strata
    </span>
  );
}

/** Static product collage: the same cards the dashboard shows, with the seeded numbers. */
function Preview() {
  const bars = [38, 52, 30, 66, 48, 80, 58, 92, 70, 100];
  return (
    <div className="relative rounded-[32px] border border-border/70 bg-surface p-3 shadow-[0_30px_60px_-30px_rgb(22_21_19/0.35)]" aria-hidden="true">
      <div className="flex gap-3">
        <div className="hidden w-[120px] shrink-0 flex-col gap-2 rounded-3xl bg-ink p-3 text-white sm:flex">
          <div className="mb-2 px-1 text-sm font-semibold">strata</div>
          {['Dashboard', 'Companies', 'Funding', 'Sectors', 'Review', 'Briefs'].map((l, i) => (
            <div key={l} className={`rounded-lg px-2 py-1 text-[10px] ${i === 0 ? 'text-pink' : 'text-white/75'}`}>
              {l}
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-3 p-1">
          <div className="text-[17px] font-semibold tracking-tight text-fg">Good morning, Ana</div>
          <div className="grid grid-cols-5 gap-2.5">
            <div className="pastel relative col-span-2 overflow-hidden bg-yellow p-3">
              <Blob shape="plus" className="-right-3 -top-3 h-14 w-14" />
              <div className="text-[10px] font-semibold">Companies tracked</div>
              <div className="mt-1 text-xl font-semibold">465</div>
              <div className="mt-2 flex h-14 items-end gap-2">
                {[60, 100, 45].map((h) => (
                  <span key={h} className="w-3.5 rounded-full bg-ink" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
            <div className="pastel relative col-span-3 overflow-hidden bg-pink p-3">
              <Blob shape="circle" className="-right-5 -top-5 h-20 w-20" />
              <div className="text-[10px] font-semibold">Disclosed funding</div>
              <div className="mt-1 text-xl font-semibold">136 filings</div>
              <div className="mt-2 flex h-12 items-end gap-1">
                {bars.map((h, i) => (
                  <span key={i} className="flex-1 rounded-sm bg-ink" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
            <div className="pastel relative col-span-3 overflow-hidden bg-sage p-3">
              <div className="text-[10px] font-semibold">By sector</div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {['Legal AI', 'Climate', 'Payments'].map((s) => (
                  <div key={s} className="rounded-xl bg-paper/70 px-2 py-1.5 text-[9px] font-semibold">
                    {s}
                  </div>
                ))}
              </div>
            </div>
            <div className="pastel relative col-span-2 overflow-hidden bg-sky p-3">
              <Blob shape="star" className="-bottom-4 -right-4 h-16 w-16" />
              <div className="text-[10px] font-semibold">Review queue</div>
              <div className="mt-1 text-xl font-semibold">Keyboard</div>
              <div className="mt-1 text-[9px]">j / k · a · 1–9</div>
            </div>
          </div>
          <div className="space-y-1.5">
            {[
              ['Legora', 'Legal AI', 'Form D'],
              ['GoCardless', 'Payments', 'Form D'],
              ['Ironclad', 'Legal AI', 'Form D'],
            ].map(([n, t, a]) => (
              <div key={n} className="flex items-center gap-2 rounded-xl bg-muted px-2.5 py-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow text-[9px] font-semibold text-ink">{n[0]}</span>
                <span className="flex-1 text-[10px] font-semibold text-fg">
                  {n} <span className="font-normal text-subtle">· {t}</span>
                </span>
                <span className="rounded-full bg-surface px-2 py-0.5 text-[9px] font-semibold text-fg">{a}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* floating cited-claim chip */}
      <div className="absolute -bottom-6 -left-4 hidden max-w-[260px] rounded-2xl border border-border bg-surface p-3 shadow-lg sm:block">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-fg">
          <Quote className="h-3 w-3" /> Brief claim
        </div>
        <p className="mt-1 text-[10px] leading-snug text-subtle">
          Every number in a brief must appear in the source it cites, or the claim is dropped.<sup className="ml-0.5 rounded bg-pink px-1 text-ink">[2]</sup>
        </p>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    tone: 'bg-yellow',
    icon: Database,
    title: 'Funding from primary sources',
    body: 'Rounds come from SEC Form D filings. A filing is linked to a company only when names, entity type and dates agree: 136 of 234 candidates kept, every rejection written down.',
    shape: 'plus' as const,
  },
  {
    tone: 'bg-pink',
    icon: Sparkles,
    title: 'LLM classification, human review',
    body: 'OpenAI, Anthropic or Gemini sort each company into an editable taxonomy with a confidence score. Anything under 0.75 goes to a keyboard-driven review queue.',
    shape: 'circle' as const,
  },
  {
    tone: 'bg-sage',
    icon: FileText,
    title: 'Briefs where every claim cites a source',
    body: 'Analyst briefs only see numbered stored sources. Claims without a valid citation, or with numbers not found in the source, are dropped before you see them.',
    shape: 'tri' as const,
  },
  {
    tone: 'bg-sky',
    icon: Layers,
    title: 'Sector landscapes',
    body: 'A market map per sector, Form D funding by year, YC cohort trends, notable companies and the latest rounds, all exportable to CSV.',
    shape: 'star' as const,
  },
];

const PIPELINE = [
  { label: 'Public sources', sub: 'YC · SEC EDGAR · RSS · GitHub' },
  { label: 'Kafka', sub: 'replayable event log' },
  { label: 'MongoDB', sub: 'idempotent upserts' },
  { label: 'LLM + review', sub: 'BullMQ jobs' },
  { label: 'Landscapes & briefs', sub: 'Redis-cached aggregations' },
];

const STACK = ['Node.js 22', 'Express 5', 'TypeScript', 'MongoDB 7', 'Redpanda (Kafka)', 'Redis', 'BullMQ', 'Next.js 15', 'React 19', 'OpenAI · Anthropic · Gemini', 'Docker', 'Playwright'];

export default function Landing() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <Mark />
        <nav aria-label="Landing" className="flex items-center gap-1 sm:gap-2">
          <a href="#how" className="hidden rounded-full px-3 py-2 text-sm text-subtle hover:text-fg sm:inline">
            How it works
          </a>
          <a href={REPO} target="_blank" rel="noopener noreferrer" className="hidden rounded-full px-3 py-2 text-sm text-subtle hover:text-fg sm:inline">
            GitHub
          </a>
          <Link href="/login?next=%2Fdashboard" className={`${pill} h-10 bg-fg px-5 text-sm text-bg hover:bg-fg/85`}>
            Sign in
          </Link>
        </nav>
      </header>

      <main>
        <section className="grid items-center gap-12 pb-20 pt-10 lg:grid-cols-[1fr_1.05fr] lg:pt-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-pink px-3 py-1 text-xs font-medium text-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden="true" /> Live demo · real public data
            </span>
            <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight sm:text-[56px]">
              Startup &amp; sector intelligence you can check.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-subtle">
              Strata tracks startups by sector, takes their funding from SEC filings, classifies them with LLMs and a human review queue, and writes briefs in which every claim cites a stored source.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/login?next=%2Fdashboard" className={`${pill} h-12 bg-fg px-6 text-[15px] text-bg hover:bg-fg/85`}>
                Open the live demo <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a href={REPO} target="_blank" rel="noopener noreferrer" className={`${pill} h-12 border border-border bg-surface px-6 text-[15px] hover:bg-muted`}>
                <Github className="h-4 w-4" aria-hidden="true" /> Source code
              </a>
            </div>
            <p className="mt-4 text-xs text-subtle">One click: the demo account is filled in for you. Free hosting, so the first load can take up to a minute.</p>
          </div>
          <Preview />
        </section>

        <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['465', 'startups tracked'],
            ['136', 'SEC filings verified by hand'],
            ['3', 'sectors mapped'],
            ['129', 'automated tests in CI'],
          ].map(([v, l]) => (
            <div key={l} className="rounded-3xl border border-border/70 bg-surface px-5 py-4">
              <div className="tabular text-[28px] font-semibold tracking-tight">{v}</div>
              <div className="text-xs text-subtle">{l}</div>
            </div>
          ))}
        </section>

        <section aria-labelledby="features" className="pt-20">
          <h2 id="features" className="max-w-xl text-[30px] font-semibold leading-tight tracking-tight sm:text-[36px]">
            Built for analysts who need to show their working.
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <article key={f.title} className={`pastel relative overflow-hidden p-6 ${f.tone}`}>
                <Blob shape={f.shape} className="-bottom-10 -right-8 h-40 w-40" />
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white">
                  <f.icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{f.title}</h3>
                <p className="relative mt-2 max-w-md text-sm leading-relaxed text-ink/75">{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how" aria-labelledby="how-h" className="scroll-mt-6 pt-20">
          <h2 id="how-h" className="text-[30px] font-semibold tracking-tight sm:text-[36px]">
            How it works
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-subtle">
            Connectors only publish raw records. Every write is an upsert on a natural key, such as the SEC accession number, so replaying the log never duplicates data.
          </p>
          <ol className="mt-8 grid gap-3 md:grid-cols-5">
            {PIPELINE.map((p, i) => (
              <li key={p.label} className="relative rounded-3xl border border-border/70 bg-surface p-4">
                <span className="tabular text-[11px] font-medium text-subtle">0{i + 1}</span>
                <div className="mt-1 font-semibold">{p.label}</div>
                <div className="mt-0.5 text-xs text-subtle">{p.sub}</div>
                {i < PIPELINE.length - 1 && (
                  <ArrowRight className="absolute -right-[13px] top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 rounded-full bg-bg p-0.5 text-subtle md:block" aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              'SSRF-safe fetching, zod validation on every route, rate limits and httpOnly sessions',
              'Event bus runs on Kafka, Redis Streams or in memory: the same code, chosen by config',
              'Classification eval on 162 hand-labelled companies; heuristic baseline runs with no API key',
            ].map((t) => (
              <p key={t} className="flex gap-2 text-sm leading-relaxed text-subtle">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-fg" aria-hidden="true" />
                {t}
              </p>
            ))}
          </div>
        </section>

        <section aria-labelledby="stack" className="pt-20">
          <h2 id="stack" className="text-sm font-semibold">
            Stack
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {STACK.map((s) => (
              <li key={s} className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium">
                {s}
              </li>
            ))}
          </ul>
        </section>

        <section className="relative mt-20 overflow-hidden rounded-[32px] bg-ink px-6 py-12 text-white sm:px-12">
          <Blob shape="star" className="-right-10 -top-10 h-56 w-56 !opacity-100 [&_path]:fill-[rgb(var(--pink))]" />
          <Blob shape="circle" className="-bottom-16 right-40 h-40 w-40 !bg-yellow !opacity-100" />
          <div className="relative max-w-lg">
            <h2 className="text-[30px] font-semibold leading-tight tracking-tight sm:text-[36px]">See it with real data.</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/75">
              Sign in as an analyst to explore the Legal AI, Climate Tech and Payments landscapes, review classifications and read cited briefs.
            </p>
            <Link href="/login?next=%2Fdashboard" className={`${pill} mt-6 h-12 bg-white px-6 text-[15px] text-ink hover:bg-white/85`}>
              Open the live demo <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="flex flex-col items-start justify-between gap-3 py-10 text-xs text-subtle sm:flex-row sm:items-center">
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Public data only: YC directory, SEC EDGAR, RSS and GitHub. No paid databases or scraping.
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
