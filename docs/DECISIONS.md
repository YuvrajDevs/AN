# Decisions log

Lightweight ADRs: what was decided, why, and what it costs. Newest last.

---

### 001 — Name: **Strata**
**Decision.** Call the product *Strata* (the repo is `AN`).
**Why.** A landscape is read in layers: sector → subsector → company → round → source. The name says that, is short, and doesn't tie the product to one sector.
**Alternatives.** *Arbor* (taxonomy tree), *Fieldnote*, *Landmark*.

### 002 — Monorepo with npm workspaces, one image for API and worker
**Decision.** `apps/api` (Express) and `apps/web` (Next.js) in one repo; the API and the worker are the same build with two entry points.
**Why.** One version of the models, connectors and services; atomic changes across UI and API; one Docker image to ship.
**Cost.** The worker image includes HTTP routes it never serves (a few hundred kB).

### 003 — MongoDB as the system of record, analytics as aggregation pipelines
**Decision.** Company-centric documents; rounds, sources and classifications in their own collections; landscape and dashboard analytics computed with `$facet`, `$group` and `$lookup` pipelines and cached.
**Why.** Profiles are read-heavy and naturally document-shaped; the source data is semi-structured (Form D XML, directory JSON, RSS); the job spec asked for MongoDB. Separate collections keep unbounded arrays out of company documents.
**Cost.** Cross-collection analytics need `$lookup`. We denormalise `Company.metrics` (totals, last round) on every round write so lists never join.

### 004 — Kafka (Redpanda) for facts, BullMQ for work
**Decision.** Connectors publish raw records to Kafka topics; processors consume them. Follow-up work (classify, alert, brief, connector runs) goes through BullMQ on Redis.
**Why.** Kafka gives a replayable log with consumer groups: a new consumer (for example, a search indexer) can be added without touching producers, and history can be reprocessed. BullMQ gives per-job retries, backoff, concurrency limits, deduplicating job ids and schedules: the things a log does badly.
**Alternatives.** Kafka for everything (awkward retries and scheduling); BullMQ for everything (no replay or fan-out to independent consumers).
**Choice of broker.** Redpanda: Kafka API, single binary, no ZooKeeper, starts in seconds in Compose.

### 005 — The event bus is an interface with three transports
**Decision.** `EventBus` with `kafka`, `redis` (Redis Streams consumer groups) and `memory` implementations, chosen by `EVENT_BUS`.
**Why.** The hosted demo must run on free tiers without Kafka (`EVENT_BUS=redis INLINE_WORKER=true` in one process). Tests and the seed run the real pipeline in memory.
**Cost.** We can only use features all three share (no Kafka transactions, no log compaction). That is fine because handlers are idempotent upserts.

### 006 — At-least-once delivery with idempotent handlers (not exactly-once)
**Decision.** Commit or ack after the handler finishes; every write is an upsert on a natural key (SEC accession number, YC id, URL, `(user, round)` for alerts).
**Why.** Simpler and portable across transports; replays are safe; crash recovery is just redelivery.
**Cost.** Handlers must stay idempotent. Tests replay the same records and assert no duplicates.

### 007 — Funding data from SEC Form D, with conservative record linkage
**Decision.** The free, primary-source funding signal is the Form D (Regulation D notice). Entity-to-company linking requires an exact, suffix or domain-stem name match, excludes fund/SPV vehicles, checks dates against the YC batch, and honours analyst rejections.
**Why.** The brief rules out scraping Crunchbase, PitchBook, Tracxn and LinkedIn. Form D is legally public, structured and timestamped. Precision beats recall: of 234 candidate filings in the snapshot, 98 were same-name collisions caught by the date rule or by one of 41 written hand rejections.
**Cost.** Form D does not name the round or the investors, and many companies (especially outside the US) never file one. The UI labels these rounds "Reg D offering" and says so; it never guesses a "Series A".

### 008 — YC participation recorded with an undisclosed amount
**Decision.** Joining YC is stored as an `accelerator` round with `amountUsd = null`.
**Why.** YC's standard deal has changed several times; writing a number we cannot cite from the stored source would break the citation rule (009).

### 009 — Briefs: every claim must cite, and numbers must appear in the cited source
**Decision.** The LLM sees only an evidence pack of stored sources. Claims without a citation, with an unknown citation, or with a number that is not in the cited excerpts are dropped and kept for audit. Aggregates are written first to a citable "dataset snapshot" source.
**Why.** "Every claim cited to a stored source" has to be enforced by code, not asked for in a prompt. The numeric check catches the most damaging hallucinations (amounts, counts, dates).
**Cost.** The model cannot do arithmetic in the brief. Totals must come from the snapshot source. Some true but differently formatted numbers get dropped (for example "eighty million" vs "$80.0M").

### 010 — Confidence threshold and a human review queue
**Decision.** Classifications at or above 0.75 confidence are auto-accepted; the rest wait for an analyst. Analyst decisions are final and never overwritten by automatic re-runs.
**Why.** The eval shows the trade-off: auto-accepted labels are far more accurate than the average label. The threshold is configurable per deployment.

### 011 — An offline heuristic "provider"
**Decision.** A deterministic keyword classifier, rule-based extractor and template brief writer sit behind the same interface as OpenAI, Anthropic and Gemini.
**Why.** The app, the seed, the tests, CI and the eval all run without API keys or cost, and the baseline makes LLM gains measurable.
**Cost.** Its keywords need maintenance; its accuracy on held-out sectors is modest (67%), which is the point of comparing it.

### 012 — Structured output per provider, plus zod re-validation
**Decision.** OpenAI `json_schema` (strict), Anthropic `output_config.format` via the official SDK, Gemini `responseJsonSchema`; all outputs are re-validated with zod, and task-specific guards follow (unknown slugs, evidence quotes).
**Why.** Native structured output reduces malformed JSON; re-validation handles refusals, truncation and provider drift in one place.

### 013 — Session in an httpOnly cookie, browser talks only to the Next.js origin
**Decision.** Next.js rewrites `/api/*` to the Express API. The JWT lives in an `httpOnly`, `SameSite=Lax` cookie. Bearer tokens are supported for API clients.
**Why.** No token in JS-readable storage (XSS cannot exfiltrate it), no CORS in the browser path, and secrets stay server-side.
**Cost.** Stateless JWTs cannot be revoked before they expire (8 h). A deny-list in Redis is the next step if needed.

### 014 — SSRF guard as a dedicated client, not a URL regex
**Decision.** `safeFetch` resolves DNS, rejects any non-public address, pins the socket to the vetted address, and re-checks every redirect.
**Why.** Regex/hostname allow-lists are bypassed by DNS rebinding, decimal or IPv6-mapped IPs, and redirects. User-supplied URLs (feeds, webhooks) are the main SSRF surface.

### 015 — Generational cache invalidation
**Decision.** Cache keys embed a per-namespace generation number; writes `INCR` it.
**Why.** O(1) invalidation that is correct across replicas; no key scans. Old entries expire by TTL.

### 016 — MongoDB text search now, Elastic later
**Decision.** A weighted text index plus a prefix index on `name`.
**Why.** Enough for thousands of companies with zero extra infrastructure. The `company.*` events make an Elasticsearch or Atlas Search indexer an additive change (a new consumer group).

### 017 — Dependency-free SVG charts
**Decision.** Small hand-written SVG bar charts with an accessible data-table fallback.
**Why.** Two chart types did not justify a 100 kB charting library; full control over theming, focus and screen-reader output.

### 018 — Seed from a committed snapshot of real public data
**Decision.** `npm run snapshot` runs the real connectors once and commits the raw records (`data/seed`); `npm run seed` replays them through the pipeline.
**Why.** First run is full, deterministic and offline; and the seed exercises the production code path instead of inserting fixtures directly.
**Cost.** The snapshot ages; re-run `snapshot` (and the hand review of new Form D matches) to refresh it.
