import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, BookOpenCheck, Database, FileText, Github, Layers, ScanSearch, ShieldCheck, Sparkles } from 'lucide-react';
import { Wordmark } from '@/components/AppShell';
import { Badge, ConfidenceBadge, EmptyState, Skeleton, Stat, StatusBadge } from '@/components/ui';
import { TONE_BG, buttonClass, cx } from '@/lib/styles';
import { Ring, SplitBars } from '@/components/charts';
import { BrowserFrame, Callouts, PhoneFrame, SectionHead } from '@/components/case-study/frames';
import { CountUp, DrawPath, Parallax, Reveal, ScrollProgress, SectionNav } from '@/components/case-study/motion';

export const metadata: Metadata = {
  title: 'Case study: Strata',
  description: 'How Strata was designed and built: startup intelligence from public data, where every number traces to its source.',
};

const REPO = 'https://github.com/YuvrajDevs/AN';
const DEMO = '/login?next=%2Fdashboard';

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'problem', label: 'Problem' },
  { id: 'users', label: 'Users and needs' },
  { id: 'principles', label: 'Principles' },
  { id: 'structure', label: 'Structure and flow' },
  { id: 'decisions', label: 'Key decisions' },
  { id: 'walkthrough', label: 'The product' },
  { id: 'system', label: 'Design system' },
  { id: 'states', label: 'States and edge cases' },
  { id: 'access', label: 'Accessibility' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'retro', label: 'What went wrong' },
  { id: 'next', label: 'Next' },
];

const PAINS = [
  { pain: 'Startup databases are expensive, and their numbers cannot be checked.', response: 'Funding comes only from SEC Form D filings; every round links to its filing.' },
  { pain: 'Sector labels are opinions; a wrong one quietly distorts a market map.', response: 'Each label carries a confidence; anything below 0.75 waits for an analyst.' },
  { pain: 'AI summaries invent figures, and one bad number costs more trust than a short answer.', response: 'Claims must cite a stored source, and any number missing from that source is dropped.' },
  { pain: 'Answers arrive without the trail an analyst needs to defend them.', response: 'Sources are named in plain words, with three shown and the rest one click away.' },
];

const DECISIONS = [
  { chose: 'SEC Form D as the only funding source', over: 'paid startup databases', why: 'Anyone can check a filing. A number nobody can verify is worth less than a gap, so the UI says "Reg D offering" and never guesses a "Series A".' },
  { chose: 'A confidence threshold with a human review queue', over: 'fully automatic labels', why: 'Above 0.75 the model is far more accurate than its average, so people only see the uncertain 40% instead of everything.' },
  { chose: 'Drop any claim whose numbers are not in its source', over: 'letting the model write freely', why: 'Enforced in code, not asked for in a prompt. It catches the most damaging errors: amounts, counts and dates.' },
  { chose: 'Hybrid retrieval: meaning, keywords and names', over: 'vector search alone', why: 'Company names are exact; paraphrases are not. Keyword search alone found the right company 52% of the time; the hybrid found it every time.' },
  { chose: 'Charts that read without hovering', over: 'hover-only tooltips', why: 'A labelled scale, a total and the peak on every chart. Anything you can only learn by hovering is invisible on a phone and to a screen reader.' },
  { chose: 'Detail on request', over: 'everything open by default', why: 'The dashboard leads with what needs a decision. A quarter’s breakdown opens when an analyst picks it, not before.' },
];

export default function CaseStudy() {
  return (
    <div className="min-h-screen bg-bg">
      <ScrollProgress />

      {/* top bar */}
      <header className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-4 sm:px-8">
        <Link href="/" aria-label="Strata home">
          <Wordmark />
        </Link>
        <nav aria-label="Case study" className="flex items-center gap-2">
          <a href={REPO} target="_blank" rel="noopener noreferrer" className={buttonClass('ghost', 'sm', 'hidden sm:inline-flex')}>
            <Github className="h-3.5 w-3.5" aria-hidden="true" /> Source
          </a>
          <Link href={DEMO} className={buttonClass('primary', 'sm')}>
            Live demo <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </nav>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-[1240px] px-4 pb-20 pt-10 sm:px-8 lg:pt-16" aria-labelledby="cs-title">
        <Reveal>
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-caption font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" /> Case study · Product design and engineering
          </p>
        </Reveal>
        <Reveal delay={80}>
          <h1 id="cs-title" className="mt-5 max-w-4xl text-[38px] font-semibold leading-[1.05] tracking-tight sm:text-hero">
            Strata: startup intelligence <span className="relative whitespace-nowrap">you can check<span className="absolute inset-x-0 -bottom-1 h-2 rounded-full bg-pink/80 -z-10" aria-hidden="true" /></span>.
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="mt-5 max-w-2xl text-lead text-subtle">
            A workbench for analysts who map startup sectors. It tracks companies from public data, labels them with an AI model under human review, and
            answers questions in plain English, with every number traced to the filing or profile it came from.
          </p>
        </Reveal>

        <Reveal delay={220}>
          <dl className="mt-8 grid max-w-4xl grid-cols-2 gap-x-6 gap-y-4 border-y border-border py-5 sm:grid-cols-4">
            {[
              ['Role', 'Solo: product design, front end, back end, data'],
              ['Timeline', 'November 2026: build, then two UI passes'],
              ['Platform', 'Web, desktop first, works at 390px'],
              ['Output', 'Live demo, design system, 167 automated tests'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-micro font-medium uppercase tracking-wide text-subtle">{k}</dt>
                <dd className="mt-1 text-body-sm">{v}</dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <div className="relative mt-12">
          <Reveal delay={280}>
            <Parallax strength={0.04}>
              <BrowserFrame src="/case-study/dashboard.jpg" alt="Strata dashboard: KPI tiles with trends, quarterly funding chart, insights, latest funding and sectors" url="strata · dashboard" priority />
            </Parallax>
          </Reveal>
          <Parallax strength={-0.08} className="absolute -bottom-10 right-4 hidden w-[200px] lg:block xl:-right-6">
            <Reveal delay={480}>
              <PhoneFrame src="/case-study/m-dashboard.jpg" alt="Strata dashboard on a phone" />
            </Reveal>
          </Parallax>
        </div>
      </section>

      {/* body: contents rail + sections */}
      <div className="mx-auto grid max-w-[1240px] gap-12 px-4 pb-24 sm:px-8 lg:grid-cols-[180px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <SectionNav items={SECTIONS} />
        </aside>

        <main className="min-w-0 space-y-28">
          {/* 01 overview */}
          <section id="overview" className="scroll-mt-10">
            <SectionHead index="01" eyebrow="Overview" title="Market maps you can defend, line by line." />
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { tone: 'yellow' as const, title: 'The problem', body: 'Startup databases are costly and opaque. Analysts mapping a sector cannot see where a number came from, so they cannot defend it.' },
                { tone: 'pink' as const, title: 'The approach', body: 'Use only public, checkable sources. Let AI do the labelling and the drafting, and make code, not prompts, enforce that every claim cites its evidence.' },
                { tone: 'sage' as const, title: 'The outcome', body: 'A live product with a dashboard, sector landscapes, company provenance, a review queue, cited briefs and Ask Strata, backed by a documented design system.' },
              ].map((c, i) => (
                <Reveal key={c.title} delay={i * 90}>
                  <div className={cx('pastel h-full p-5', TONE_BG[c.tone])}>
                    <p className="text-body font-semibold">{c.title}</p>
                    <p className="mt-2 text-body-sm leading-relaxed text-ink/75">{c.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={120}>
              <ul className="mt-4 grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-surface md:grid-cols-5">
                {[
                  { v: <CountUp to={465} />, l: 'real YC companies across three sectors' },
                  { v: <><CountUp to={136} /> / 234</>, l: 'SEC filings kept after linkage checks' },
                  { v: <CountUp to={100} suffix="%" />, l: 'right company in the top five answers' },
                  { v: <CountUp to={87.8} decimals={1} suffix="%" />, l: 'AI label accuracy on 41 hand-labelled companies' },
                  { v: <CountUp to={167} />, l: 'automated tests, including accessibility scans' },
                ].map((m, i) => (
                  <li key={i} className="border-b border-r border-border/70 p-5 last:border-r-0 md:border-b-0">
                    <p className="text-stat font-semibold">{m.v}</p>
                    <p className="mt-1 text-caption text-subtle">{m.l}</p>
                  </li>
                ))}
              </ul>
            </Reveal>
          </section>

          {/* 02 problem */}
          <section id="problem" className="scroll-mt-10">
            <SectionHead
              index="02"
              eyebrow="Problem"
              title="Analysts repeat numbers they cannot trace."
              lead="Mapping a sector means deciding which companies belong, what they raised and who is growing. The tools that answer this sell data behind a paywall, and rarely show their working."
            />
            <Reveal>
              <blockquote className="rounded-2xl bg-ink p-7 text-paper sm:p-9">
                <p className="text-micro font-medium uppercase tracking-wide text-paper/60">How might we</p>
                <p className="mt-3 text-title font-medium sm:text-display">
                  help an analyst map a startup sector from public data, so that every company, label and number on the map can be traced to its source?
                </p>
              </blockquote>
            </Reveal>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                ['Public data only', 'YC directory, SEC EDGAR, press feeds and GitHub. No paid databases, no LinkedIn scraping.'],
                ['Free hosting and a capped AI quota', 'The free model tier allows about 20 requests per model per day, so every AI path needs an honest fallback.'],
                ['One person, one week', 'Design, front end, back end and data by one person, so scope had to earn its place.'],
                ['Trust over flash', 'For analysts, one invented figure undoes everything else, so correctness beats fluency in every trade-off.'],
              ].map(([t, b], i) => (
                <Reveal key={t} delay={i * 70}>
                  <div className="card h-full p-5">
                    <p className="text-body font-semibold">{t}</p>
                    <p className="mt-1 text-body-sm leading-relaxed text-subtle">{b}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* 03 users */}
          <section id="users" className="scroll-mt-10">
            <SectionHead
              index="03"
              eyebrow="Users and needs"
              title="Built for the person who has to defend the map."
              lead="The primary user is a market-research analyst or an investor mapping a sector, tracking new rounds and writing landscape briefs. This is a proto-persona drawn from the brief and the job, not from interviews; testing it with real analysts is the next step."
            />
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <Reveal>
                <div className="card h-full p-6">
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-yellow text-body font-semibold text-ink" aria-hidden="true">AA</span>
                    <div>
                      <p className="text-heading font-semibold">The sector analyst</p>
                      <p className="text-caption text-subtle">Proto-persona · assumption to validate</p>
                    </div>
                  </div>
                  <p className="mt-5 text-micro font-medium uppercase tracking-wide text-subtle">Jobs to be done</p>
                  <ul className="mt-2 space-y-2 text-body-sm">
                    {['See which subsectors are crowded and which are funded', 'Know when a tracked company files a new round', 'Answer a partner’s question with a source attached', 'Correct a wrong label once, and have it stick'].map((j) => (
                      <li key={j} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink" aria-hidden="true" />
                        {j}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
              <Reveal delay={100}>
                <div className="card h-full overflow-hidden">
                  <div className="grid grid-cols-2 border-b border-border bg-muted/50 px-5 py-2.5 text-micro font-medium uppercase tracking-wide text-subtle">
                    <span>Pain point</span>
                    <span>Design response</span>
                  </div>
                  <ul className="divide-y divide-border">
                    {PAINS.map((p) => (
                      <li key={p.pain} className="grid grid-cols-2 gap-6 px-5 py-4 text-body-sm">
                        <span className="text-subtle">{p.pain}</span>
                        <span>{p.response}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
          </section>

          {/* 04 principles */}
          <section id="principles" className="scroll-mt-10">
            <SectionHead index="04" eyebrow="Principles" title="Five rules every screen answers to." />
            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['Provenance is part of the interface', 'A number without a source is not shown as fact. Sources use words an analyst knows: “SEC Form D”, not a pipeline id.'],
                ['Readable without interaction', 'Charts carry a scale and a total. Anything you can only learn by hovering is a bug.'],
                ['Calm by default, loud on purpose', 'Paper and ink for structure; colour is spent on sector identity and on state that needs attention.'],
                ['The next decision first', 'Screens lead with what needs a person, then trends, then reference detail.'],
                ['Honest edges', 'Empty, loading, partial and failed states are designed, and say what happened in plain words.'],
              ].map(([t, b], i) => (
                <Reveal as="li" key={t} delay={i * 70}>
                  <div className="card h-full p-5">
                    <span className="tabular text-micro font-medium text-subtle">{String(i + 1).padStart(2, '0')}</span>
                    <p className="mt-2 text-body font-semibold">{t}</p>
                    <p className="mt-1 text-body-sm leading-relaxed text-subtle">{b}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </section>

          {/* 05 structure */}
          <section id="structure" className="scroll-mt-10">
            <SectionHead
              index="05"
              eyebrow="Structure and flow"
              title="Read the market in layers."
              lead="The name says it: a landscape is read from sector to subsector to company to round to source. Navigation follows the same path, and every layer links one step deeper."
            />
            <Reveal>
              <div className="card overflow-x-auto p-6">
                <svg viewBox="0 0 900 150" className="min-w-[640px]" role="img" aria-label="Core flow: Dashboard, Sector landscape, Company profile, Funding round, Source document">
                  {['Dashboard', 'Sector landscape', 'Company profile', 'Funding round', 'Source filing'].map((label, i) => {
                    const x = 20 + i * 176;
                    const fills = ['yellow', 'pink', 'sky', 'sage', 'paper'];
                    return (
                      <g key={label}>
                        {i > 0 && <DrawPath d={`M${x - 36},62 L${x - 4},62`} className="stroke-ink" delay={i * 160} />}
                        <rect x={x} y={30} width={140} height={64} rx={16} className="stroke-ink/20" fill={`rgb(var(--${fills[i]}))`} strokeWidth={1} />
                        <text x={x + 70} y={58} textAnchor="middle" className="fill-ink text-[13px] font-semibold">{label}</text>
                        <text x={x + 70} y={78} textAnchor="middle" className="fill-ink/60 text-[11px]">
                          {['what needs you', 'who is where', 'what is known', 'what was sold', 'where it says so'][i]}
                        </text>
                        <text x={x + 70} y={124} textAnchor="middle" className="fill-ink/45 text-[11px]">
                          {['/dashboard', '/sectors/…', '/companies/…', 'timeline', 'sec.gov'][i]}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </Reveal>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {[
                { title: 'General', items: ['Dashboard', 'Companies', 'Funding', 'Sectors'], note: 'Reading the market' },
                { title: 'Tools', items: ['Ask', 'Review queue', 'Briefs', 'Watchlists', 'Alerts'], note: 'Acting on it' },
              ].map((g, i) => (
                <Reveal key={g.title} delay={i * 90}>
                  <div className="card h-full p-5">
                    <p className="flex items-baseline justify-between text-body font-semibold">
                      {g.title} <span className="text-caption font-normal text-subtle">{g.note}</span>
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {g.items.map((x) => (
                        <Badge key={x}>{x}</Badge>
                      ))}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* 06 decisions */}
          <section id="decisions" className="scroll-mt-10">
            <SectionHead index="06" eyebrow="Key decisions" title="What was chosen, over what, and why." lead="Eighteen decisions are logged in the repository. These six shaped the product most." />
            <ol className="grid gap-4 md:grid-cols-2">
              {DECISIONS.map((d, i) => (
                <Reveal as="li" key={d.chose} delay={(i % 2) * 90}>
                  <div className="card h-full p-5">
                    <span className="tabular text-micro font-medium text-subtle">{String(i + 1).padStart(2, '0')}</span>
                    <p className="mt-2 text-body font-semibold">{d.chose}</p>
                    <p className="mt-0.5 text-caption text-subtle">over {d.over}</p>
                    <p className="mt-3 border-t border-dashed border-border pt-3 text-body-sm leading-relaxed">{d.why}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </section>

          {/* 07 walkthrough */}
          <section id="walkthrough" className="scroll-mt-10">
            <SectionHead index="07" eyebrow="The product" title="Six screens, one promise: show your working." />
            <div className="space-y-20">
              {[
                {
                  icon: Layers,
                  tone: 'yellow' as const,
                  name: 'Dashboard',
                  src: '/case-study/dashboard-drill.jpg',
                  alt: 'Dashboard with the Q1 2026 breakdown open below the quarterly funding chart',
                  points: [
                    { title: 'Tiles show shape, not just size', body: 'Each KPI carries a visual from the same data: a sector split, a trend, a review ring. A number with nothing behind it does not get a tile.' },
                    { title: 'Insights beside the trend', body: 'The written interpretation sits next to the chart it explains, so the eye does not travel.' },
                    { title: 'Breakdown on request', body: 'Selecting a quarter opens its rounds, each with its share of the quarter. Closed by default.' },
                  ],
                },
                {
                  icon: ScanSearch,
                  tone: 'pink' as const,
                  name: 'Sector landscape',
                  src: '/case-study/landscape-map.jpg',
                  alt: 'Legal AI market map: subsectors as cards with company chips, counts and capital',
                  points: [
                    { title: 'A market map that explains itself', body: 'A legend says what the bar, the numbers and a faded company mean, so nobody guesses.' },
                    { title: 'Every chip is a door', body: 'Each company opens its profile; each subsector opens a filtered table.' },
                    { title: 'Exports where analysts work', body: 'Companies and rounds export to CSV straight from the landscape.' },
                  ],
                },
                {
                  icon: Database,
                  tone: 'sky' as const,
                  name: 'Company provenance',
                  src: '/case-study/company-timeline.jpg',
                  alt: 'Company profile with a funding summary, a timeline of Form D offerings and the sources behind them',
                  points: [
                    { title: 'Summary, then the record', body: 'Total disclosed, rounds on record and the latest date sit above the timeline.' },
                    { title: 'Every round links to its filing', body: 'Form D offerings say "Reg D offering", never an invented round name, and open the SEC document.' },
                    { title: 'Sources without the wall', body: 'Three sources show by default and the rest are one click away.' },
                  ],
                },
                {
                  icon: ShieldCheck,
                  tone: 'sage' as const,
                  name: 'Review queue',
                  src: '/case-study/review.jpg',
                  alt: 'Review queue: list of low-confidence companies and the model proposal with subsector options',
                  points: [
                    { title: 'Lowest confidence first', body: 'The queue only holds labels below 0.75, ordered so the shakiest are seen first.' },
                    { title: 'Keyboard-first', body: 'j and k to move, number keys to choose, a to accept. Fast without being careless.' },
                    { title: 'One label at a time, on purpose', body: 'Batch-accepting would remove the human check the queue exists for, so it is not offered.' },
                  ],
                },
                {
                  icon: Sparkles,
                  tone: 'yellow' as const,
                  name: 'Ask Strata',
                  src: '/case-study/ask.jpg',
                  alt: 'Ask Strata answering which startups help lawyers review contracts, with cited sources',
                  points: [
                    { title: 'Every sentence cites', body: 'Markers link each claim to the passage it came from; hovering a marker highlights the source.' },
                    { title: 'The check is visible', body: 'The footer says how many claims passed the citation check and how retrieval ran.' },
                    { title: 'Says when it cannot answer', body: 'Out-of-scope questions are refused, and if the model is down the closest passages are shown, labelled as such.' },
                  ],
                },
                {
                  icon: FileText,
                  tone: 'pink' as const,
                  name: 'Analyst briefs',
                  src: '/case-study/brief.jpg',
                  alt: 'Sector brief with footnoted claims and a sources column',
                  points: [
                    { title: 'Footnotes, not vibes', body: 'Every claim is footnoted to a stored source shown alongside.' },
                    { title: 'Dropped claims stay visible', body: 'Claims that failed validation are listed, collapsed, so the filter is auditable.' },
                    { title: 'Model named', body: 'The brief says which model drafted it, and when.' },
                  ],
                },
              ].map((f, i) => (
                <article key={f.name}>
                  <Reveal className="mb-5 flex items-center gap-3">
                    <span className={cx('grid h-10 w-10 place-items-center rounded-xl text-ink', TONE_BG[f.tone])}>
                      <f.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="text-title font-semibold">
                      <span className="tabular mr-2 text-subtle">{String(i + 1).padStart(2, '0')}</span>
                      {f.name}
                    </h3>
                  </Reveal>
                  <Reveal>
                    <BrowserFrame src={f.src} alt={f.alt} url={`strata · ${f.name.toLowerCase()}`} />
                  </Reveal>
                  <Reveal delay={120} className="mt-6">
                    <Callouts items={f.points} layout="row" />
                  </Reveal>
                </article>
              ))}
            </div>
          </section>

          {/* 08 design system */}
          <section id="system" className="scroll-mt-10">
            <SectionHead
              index="08"
              eyebrow="Design system"
              title="One system, written down and enforced."
              lead="Everything below is rendered live from the app's own tokens and components, not pasted in as pictures."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <Reveal>
                <div className="card h-full p-6">
                  <p className="text-body font-semibold">Colour by role</p>
                  <ul className="mt-4 grid grid-cols-4 gap-3">
                    {[
                      ['bg', 'Paper', 'bg-bg border border-border'],
                      ['surface', 'Surface', 'bg-surface border border-border'],
                      ['ink', 'Ink', 'bg-ink'],
                      ['subtle', 'Subtle', 'bg-subtle'],
                      ['yellow', 'Yellow', 'bg-yellow'],
                      ['pink', 'Pink', 'bg-pink'],
                      ['sage', 'Sage', 'bg-sage'],
                      ['sky', 'Sky', 'bg-sky'],
                    ].map(([k, n, cls]) => (
                      <li key={k}>
                        <span className={cx('block h-12 rounded-xl', cls)} aria-hidden="true" />
                        <span className="mt-1.5 block text-caption font-medium">{n}</span>
                        <span className="block font-mono text-micro text-subtle">--{k}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-caption text-subtle">Pastels identify sectors and never signal state; success, warning and danger are never decorative.</p>
                </div>
              </Reveal>
              <Reveal delay={100}>
                <div className="card h-full p-6">
                  <p className="text-body font-semibold">Type by role</p>
                  <ul className="mt-4 space-y-2.5">
                    {[
                      ['text-display', 'Display', '26/32 · page titles'],
                      ['text-title', 'Title', '20/26 · panels'],
                      ['text-heading', 'Heading', '16/22 · sections'],
                      ['text-body', 'Body', '14/22 · reading'],
                      ['text-body-sm', 'Body small', '13/20 · dense UI'],
                      ['text-caption', 'Caption', '12/16 · meta'],
                      ['text-micro', 'Micro', '11/14 · labels'],
                    ].map(([cls, n, spec]) => (
                      <li key={cls} className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2 last:border-0">
                        <span className={cx(cls, 'font-semibold')}>{n}</span>
                        <span className="font-mono text-micro text-subtle">{spec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
              <Reveal>
                <div className="card h-full p-6">
                  <p className="text-body font-semibold">Space on a 4px base</p>
                  <ul className="mt-4 space-y-2">
                    {[
                      [4, 'inside small controls'],
                      [8, 'related items in a row'],
                      [12, 'dense groups'],
                      [16, 'card padding and gutters'],
                      [24, 'header to content'],
                      [32, 'between major sections'],
                    ].map(([px, use]) => (
                      <li key={px} className="grid grid-cols-[48px_1fr] items-center gap-3">
                        <span className="tabular text-caption text-subtle">{px}px</span>
                        <span className="flex items-center gap-3">
                          <span className="block h-3 rounded-sm bg-pink" style={{ width: (px as number) * 3 }} aria-hidden="true" />
                          <span className="text-caption">{use}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
              <Reveal delay={100}>
                <div className="card h-full p-6">
                  <p className="text-body font-semibold">Components</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className={buttonClass('primary', 'sm')}>Primary</span>
                    <span className={buttonClass('secondary', 'sm')}>Secondary</span>
                    <span className={buttonClass('ghost', 'sm')}>Ghost</span>
                    <Badge>Reg D offering</Badge>
                    <ConfidenceBadge value={0.59} />
                    <ConfidenceBadge value={0.9} state="reviewed" />
                    <StatusBadge status="active" />
                    <StatusBadge status="acquired" />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <Stat tone="yellow" label="Companies" value="102" hint="Median team of 7" visual={<SplitBars parts={[{ label: 'active', value: 82 }, { label: 'acquired', value: 11 }, { label: 'inactive', value: 9 }]} />} />
                    <Stat tone="pink" label="Classified" value="87/102" hint="Queue clear" visual={<Ring value={87} max={102} label="Share classified" />} />
                  </div>
                </div>
              </Reveal>
            </div>
            <Reveal>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {[
                  ['Shape', 'Full radius for controls, 16px cards, 12px nested items, 8px icon tiles.'],
                  ['Elevation', 'Flat. Cards separate by tone and hairline; shadows only for things that float.'],
                  ['Motion', '200ms colour changes, 700ms bar growth; all of it off under reduced motion.'],
                ].map(([t, b]) => (
                  <div key={t} className="card p-5">
                    <p className="text-body font-semibold">{t}</p>
                    <p className="mt-1 text-body-sm text-subtle">{b}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </section>

          {/* 09 states */}
          <section id="states" className="scroll-mt-10">
            <SectionHead
              index="09"
              eyebrow="States and edge cases"
              title="Designed for the moments things go sideways."
              lead="Each of these is a real component from the app, rendered here as it appears there."
            />
            <div className="grid gap-4 md:grid-cols-3">
              <Reveal>
                <div className="card h-full overflow-hidden">
                  <p className="border-b border-border px-4 py-2.5 text-caption font-medium text-subtle">Empty</p>
                  <EmptyState title="You are all caught up" body="Alerts appear when a company on one of your watchlists files a new round." />
                </div>
              </Reveal>
              <Reveal delay={90}>
                <div className="card h-full overflow-hidden">
                  <p className="border-b border-border px-4 py-2.5 text-caption font-medium text-subtle">Loading, shaped like the content</p>
                  <div className="space-y-2.5 p-5">
                    <Skeleton className="h-4 w-11/12" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="mt-4 h-12" />
                    <Skeleton className="h-12" />
                  </div>
                </div>
              </Reveal>
              <Reveal delay={180}>
                <div className="card h-full overflow-hidden">
                  <p className="border-b border-border px-4 py-2.5 text-caption font-medium text-subtle">Failure, with a way out</p>
                  {/* the app's ErrorState, minus role="alert": a specimen must not announce itself on load */}
                  <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-pink font-semibold text-ink" aria-hidden="true">!</div>
                    <p className="text-body font-semibold">Something went wrong</p>
                    <p className="mt-1 max-w-sm text-body text-subtle">We could not load this data.</p>
                    <span className={buttonClass('secondary', 'sm', 'mt-4')}>Try again</span>
                  </div>
                </div>
              </Reveal>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {[
                ['AI unavailable', 'Ask shows the closest passages, labelled “no model”; nothing is generated that could not be checked.'],
                ['No answer in the data', '“The dataset does not contain an answer to that”, plus how to ask a better question.'],
                ['Unsure label', 'Below 0.75 confidence, the label is marked for review and the company joins the queue.'],
                ['Unlinkable filing', 'A Form D that fails the name, entity or date checks is rejected with a written reason, never guessed.'],
                ['Long names and text', 'Truncation with the full value on hover; nothing pushes a phone layout sideways.'],
                ['Free quota exhausted', 'The model chain falls back, then to an offline classifier that is labelled as such.'],
              ].map(([t, b], i) => (
                <Reveal key={t} delay={(i % 3) * 80}>
                  <div className="card h-full p-5">
                    <p className="text-body font-semibold">{t}</p>
                    <p className="mt-1 text-body-sm leading-relaxed text-subtle">{b}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* 10 accessibility */}
          <section id="access" className="scroll-mt-10">
            <SectionHead index="10" eyebrow="Accessibility and responsive" title="Usable by keyboard, screen reader and thumb." />
            <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto]">
              <Reveal>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['WCAG AA, checked by machine', 'axe scans every page in CI, under both light and dark OS preferences.'],
                    ['Keyboard everywhere', 'Command palette on ⌘K, keyboard review, and a focus ring that never changes an element’s shape.'],
                    ['Charts that speak', 'Each bar is a labelled control with its value; readouts are live regions.'],
                    ['No sideways scroll at 390px', 'Tested on every page; tile visuals stack under their numbers on phones.'],
                    ['Numbers line up', 'Tabular numerals wherever figures are compared.'],
                    ['Motion is optional', 'Reduced-motion users get the same page, without the animation.'],
                  ].map(([t, b]) => (
                    <li key={t} className="card p-4">
                      <p className="text-body-sm font-semibold">{t}</p>
                      <p className="mt-1 text-caption leading-relaxed text-subtle">{b}</p>
                    </li>
                  ))}
                </ul>
              </Reveal>
              <div className="flex justify-center gap-4">
                {[
                  ['/case-study/m-company.jpg', 'Company profile on a phone'],
                  ['/case-study/m-ask.jpg', 'Ask Strata on a phone'],
                ].map(([src, alt], i) => (
                  <Reveal key={src} delay={i * 140}>
                    <PhoneFrame src={src} alt={alt} className={cx('w-[150px] sm:w-[190px]', i === 1 && 'mt-10')} />
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          {/* 11 evidence */}
          <section id="evidence" className="scroll-mt-10">
            <SectionHead index="11" eyebrow="Evidence" title="Measured, not asserted." lead="Every figure here comes from scripts in the repository and is reproducible." />
            <div className="grid gap-4 lg:grid-cols-2">
              <Reveal>
                <div className="card h-full overflow-hidden">
                  <p className="border-b border-border px-5 py-3 text-body-sm font-semibold">Finding the right company (25 questions)</p>
                  <table className="w-full text-body-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="th">Retriever</th>
                        <th className="th text-right">Top-5 hit rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {[
                        ['Keyword only', 52],
                        ['Meaning only (embeddings)', 100],
                        ['Hybrid, the default', 100],
                      ].map(([n, v]) => (
                        <tr key={n as string}>
                          <td className="td">{n}</td>
                          <td className="td">
                            <span className="flex items-center justify-end gap-3">
                              <span className="block h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                                <span className="block h-full rounded-full bg-ink" style={{ width: `${v}%` }} />
                              </span>
                              <span className="tabular w-10 text-right font-semibold">{v}%</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="px-5 py-3 text-caption text-subtle">21 paraphrases that avoid the company’s own words, plus 4 questions about named companies’ filings.</p>
                </div>
              </Reveal>
              <Reveal delay={100}>
                <div className="card h-full overflow-hidden">
                  <p className="border-b border-border px-5 py-3 text-body-sm font-semibold">Labelling Legal AI companies</p>
                  <table className="w-full text-body-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="th">Classifier</th>
                        <th className="th text-right">Accuracy</th>
                        <th className="th text-right">Auto-accepted, accurate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr>
                        <td className="td">Gemini (first 41 companies)</td>
                        <td className="td tabular text-right font-semibold">87.8%</td>
                        <td className="td tabular text-right">94.3%</td>
                      </tr>
                      <tr>
                        <td className="td">Offline keyword baseline (102)</td>
                        <td className="td tabular text-right font-semibold">75.5%</td>
                        <td className="td tabular text-right">91.0%</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="px-5 py-3 text-caption text-subtle">
                    Above the 0.75 threshold, labels are much more accurate than average; that is why the review queue exists. The held-out set is not scored yet.
                  </p>
                </div>
              </Reveal>
            </div>
            <Reveal>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Stat tone="sky" label="Automated tests" value="167" hint="110 API · 21 web · 36 end-to-end" />
                <Stat tone="sage" label="Filings linked" value="136 / 234" hint="each rejection has a written reason" visual={<Ring value={136} max={234} label="Share of candidate filings kept" />} />
                <Stat tone="yellow" label="Cited claims kept" value="11" hint="5 live questions; the out-of-scope one refused" />
              </div>
            </Reveal>
          </section>

          {/* 12 retro */}
          <section id="retro" className="scroll-mt-10">
            <SectionHead index="12" eyebrow="What went wrong" title="Honest about the gaps." />
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ['The free AI quota shaped the evaluation', 'About 20 requests per model per day stopped the Gemini run after 41 of 162 companies. The held-out score, the honest one, is still to come.'],
                ['The fallback left a long queue', 'Many labels come from the offline classifier at 30% confidence, so 189 wait for review. Re-running the AI classifier on them is the real fix.'],
                ['Form D only sees part of the market', 'It does not name rounds or investors, and many companies outside the US never file one. The product says so rather than filling the gap.'],
                ['First UI pass hid things behind hover', 'Charts needed hovering to read and the Ask screen spoke in pipeline terms. Two passes fixed both, and set the rules that prevent it now.'],
              ].map(([t, b], i) => (
                <Reveal key={t} delay={(i % 2) * 90}>
                  <div className="card h-full border-l-4 border-l-pink p-5">
                    <p className="text-body font-semibold">{t}</p>
                    <p className="mt-1 text-body-sm leading-relaxed text-subtle">{b}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* 13 next */}
          <section id="next" className="scroll-mt-10">
            <SectionHead index="13" eyebrow="Next" title="What I would do next." />
            <ol className="grid gap-4 md:grid-cols-3">
              {[
                ['Test with five analysts', 'Watch how they read the market map and the review queue before changing either.'],
                ['Score the held-out set', 'Finish the Gemini evaluation across days and publish the honest number.'],
                ['Clear the queue properly', 'Re-run the AI classifier on fallback labels, so people review only true uncertainty.'],
              ].map(([t, b], i) => (
                <Reveal as="li" key={t} delay={i * 90}>
                  <div className="card h-full p-5">
                    <span className="tabular text-micro font-medium text-subtle">{String(i + 1).padStart(2, '0')}</span>
                    <p className="mt-2 text-body font-semibold">{t}</p>
                    <p className="mt-1 text-body-sm leading-relaxed text-subtle">{b}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </section>

          {/* closing */}
          <Reveal>
            <section className="relative overflow-hidden rounded-2xl bg-ink p-8 text-paper sm:p-12" aria-labelledby="cta">
              <BookOpenCheck className="absolute -right-6 -top-6 h-40 w-40 text-paper/[0.06]" aria-hidden="true" />
              <h2 id="cta" className="text-display font-semibold sm:text-section">See it with real data.</h2>
              <p className="mt-3 max-w-xl text-body text-paper/70">The analyst account is ready. The first load can take a minute on free hosting.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={DEMO} className="inline-flex h-10 items-center gap-2 rounded-full bg-paper px-5 text-body-sm font-medium text-ink hover:bg-paper/90">
                  Try the live demo <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a href={REPO} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full border border-paper/25 px-5 text-body-sm font-medium text-paper hover:bg-paper/10">
                  Read the source <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </section>
          </Reveal>
        </main>
      </div>

      <footer className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-6 text-caption text-subtle sm:px-8">
        <span>Public data only. No paid databases or scraping.</span>
        <span>
          Designed and built by <span className="font-medium text-fg">Yuvraj Singh Shekhawat</span>
        </span>
      </footer>
    </div>
  );
}
