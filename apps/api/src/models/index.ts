import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/* ------------------------------------------------------------------ users */

export const ROLES = ['viewer', 'analyst', 'admin'] as const;
export type Role = (typeof ROLES)[number];

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'viewer' },
    lastLoginAt: Date,
  },
  { timestamps: true },
);
export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const User = model('User', userSchema);

/* --------------------------------------------------------------- taxonomy */

const sectorSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true, maxlength: 120 },
    /** null for a top-level sector; otherwise the parent node's slug. */
    parentSlug: { type: String, default: null, index: true },
    /** Ancestor slugs, root first. Lets us query a whole subtree with one index. */
    path: { type: [String], default: [], index: true },
    /** Definition shown to analysts and given verbatim to the classifier. */
    description: { type: String, default: '', maxlength: 2000 },
    /** Inclusion signals used by the offline heuristic classifier. */
    keywords: { type: [String], default: [] },
    order: { type: Number, default: 0 },
    /** Top-level sectors only: is this sector actively tracked by ingestion? */
    tracked: { type: Boolean, default: false },
    /** YC directory tags/industries that pull companies into this sector during ingestion. */
    sourceTags: { type: [String], default: [] },
    color: { type: String, default: null },
  },
  { timestamps: true },
);
export type SectorDoc = HydratedDocument<InferSchemaType<typeof sectorSchema>>;
export const Sector = model('Sector', sectorSchema);

/* --------------------------------------------------------------- sources */

export const SOURCE_KINDS = ['sec_form_d', 'yc_directory', 'press_release', 'rss', 'github', 'dataset', 'manual'] as const;

const sourceSchema = new Schema(
  {
    kind: { type: String, enum: SOURCE_KINDS, required: true },
    url: { type: String, required: true, unique: true },
    title: { type: String, required: true, maxlength: 500 },
    publisher: { type: String, default: '' },
    publishedAt: { type: Date, default: null },
    retrievedAt: { type: Date, default: () => new Date() },
    /** Bounded plain-text excerpt: the evidence a brief may cite. */
    excerpt: { type: String, default: '', maxlength: 8000 },
    contentHash: { type: String, default: null },
    companyIds: { type: [Schema.Types.ObjectId], ref: 'Company', default: [], index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);
sourceSchema.index({ kind: 1, publishedAt: -1 });
export type SourceDoc = HydratedDocument<InferSchemaType<typeof sourceSchema>>;
export const Source = model('Source', sourceSchema);

/* -------------------------------------------------------------- companies */

export const COMPANY_STATUSES = ['active', 'acquired', 'inactive', 'public'] as const;
export const CLASSIFICATION_STATES = ['unclassified', 'auto', 'pending_review', 'reviewed'] as const;

const classificationSnapshot = new Schema(
  {
    sectorSlug: { type: String, default: null },
    subsectorSlug: { type: String, default: null },
    confidence: { type: Number, default: null, min: 0, max: 1 },
    state: { type: String, enum: CLASSIFICATION_STATES, default: 'unclassified' },
    provider: { type: String, default: null },
    model: { type: String, default: null },
    rationale: { type: String, default: '' },
    classifiedAt: { type: Date, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: false },
);

const companySchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true, maxlength: 200 },
    /** Registered entity names seen in filings, used for record linkage. */
    legalNames: { type: [String], default: [] },
    website: { type: String, default: null },
    domain: { type: String, default: null, index: true },
    oneLiner: { type: String, default: '', maxlength: 300 },
    description: { type: String, default: '', maxlength: 5000 },
    logoUrl: { type: String, default: null },
    foundedYear: { type: Number, default: null },
    hq: {
      city: { type: String, default: null },
      region: { type: String, default: null },
      country: { type: String, default: null },
    },
    teamSize: { type: Number, default: null },
    status: { type: String, enum: COMPANY_STATUSES, default: 'active' },
    tags: { type: [String], default: [] },
    ycBatch: { type: String, default: null },
    ycBatchDate: { type: Date, default: null },
    externalIds: {
      yc: { type: String, default: null },
      secCiks: { type: [String], default: [] },
      github: { type: String, default: null },
    },
    /** Sectors the company was ingested for (from source tags) — not the classification. */
    trackedSectors: { type: [String], default: [], index: true },
    classification: { type: classificationSnapshot, default: () => ({}) },
    /** Denormalised from funding_rounds by recomputeCompanyMetrics(). */
    metrics: {
      totalRaisedUsd: { type: Number, default: 0 },
      roundCount: { type: Number, default: 0 },
      lastRoundDate: { type: Date, default: null },
      lastRoundAmountUsd: { type: Number, default: null },
    },
    notable: { type: Boolean, default: false },
  },
  { timestamps: true },
);
companySchema.index(
  { name: 'text', oneLiner: 'text', description: 'text', tags: 'text' },
  { weights: { name: 10, oneLiner: 4, tags: 3, description: 1 }, name: 'company_text' },
);
companySchema.index({ 'classification.sectorSlug': 1, 'classification.subsectorSlug': 1 });
companySchema.index({ 'classification.state': 1 });
// Needed for prefix search: $text may only sit inside $or when every clause is indexed.
companySchema.index({ name: 1 });
companySchema.index({ 'metrics.totalRaisedUsd': -1 });
companySchema.index({ 'externalIds.yc': 1 }, { sparse: true });
export type CompanyDoc = HydratedDocument<InferSchemaType<typeof companySchema>>;
export const Company = model('Company', companySchema);

/* --------------------------------------------------------- funding rounds */

export const ROUND_TYPES = [
  'pre_seed',
  'seed',
  'series_a',
  'series_b',
  'series_c',
  'series_d_plus',
  'growth',
  'accelerator',
  'debt',
  'grant',
  'reg_d_offering',
  'undisclosed',
] as const;
export type RoundType = (typeof ROUND_TYPES)[number];

const fundingRoundSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    companySlug: { type: String, required: true },
    date: { type: Date, required: true },
    roundType: { type: String, enum: ROUND_TYPES, default: 'undisclosed' },
    /** USD. null = undisclosed. */
    amountUsd: { type: Number, default: null, min: 0 },
    /** For Reg D offerings: total offering size reported on the Form D. */
    targetAmountUsd: { type: Number, default: null, min: 0 },
    investors: { type: [String], default: [] },
    sourceIds: { type: [Schema.Types.ObjectId], ref: 'Source', default: [] },
    /** Idempotency key: e.g. "sec:0002071663-25-000001", "yc:legora". Re-ingesting never duplicates. */
    dedupeKey: { type: String, required: true, unique: true },
    /** Other natural ids folded into this round (e.g. Form D/A amendment accession numbers). */
    aliases: { type: [String], default: [], index: true },
    /** Date of the newest document that set amountUsd (later amendments win). */
    asOf: { type: Date, default: null },
    extractedBy: { type: String, default: 'manual' },
    confidence: { type: Number, default: 1, min: 0, max: 1 },
    notes: { type: String, default: '' },
  },
  { timestamps: true },
);
fundingRoundSchema.index({ date: -1 });
fundingRoundSchema.index({ companyId: 1, date: -1 });
export type FundingRoundDoc = HydratedDocument<InferSchemaType<typeof fundingRoundSchema>>;
export const FundingRound = model('FundingRound', fundingRoundSchema);

/* ----------------------------------------------- classification decisions */

const classificationSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    sectorSlug: { type: String, required: true },
    subsectorSlug: { type: String, default: null },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    rationale: { type: String, default: '' },
    alternatives: {
      type: [{ subsectorSlug: String, confidence: Number, _id: false }],
      default: [],
    },
    provider: { type: String, required: true },
    model: { type: String, default: null },
    status: { type: String, enum: ['auto_accepted', 'pending_review', 'accepted', 'overridden', 'superseded'], required: true },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    finalSubsectorSlug: { type: String, default: null },
    reviewNote: { type: String, default: '', maxlength: 1000 },
  },
  { timestamps: true },
);
classificationSchema.index({ status: 1, confidence: 1 });
export const Classification = model('Classification', classificationSchema);

/* ---------------------------------------------------- watchlists & alerts */

const watchlistSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, maxlength: 120 },
    companyIds: { type: [Schema.Types.ObjectId], ref: 'Company', default: [], index: true },
    /** Alert on any new round in these taxonomy nodes (sector or subsector slugs). */
    sectorSlugs: { type: [String], default: [], index: true },
    minAmountUsd: { type: Number, default: null },
    /** Optional outbound webhook — fetched through the SSRF-safe client. */
    webhookUrl: { type: String, default: null },
  },
  { timestamps: true },
);
export const Watchlist = model('Watchlist', watchlistSchema);

const alertSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    watchlistId: { type: Schema.Types.ObjectId, ref: 'Watchlist', required: true },
    fundingRoundId: { type: Schema.Types.ObjectId, ref: 'FundingRound', required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    webhookStatus: { type: String, default: null },
  },
  { timestamps: true },
);
alertSchema.index({ userId: 1, read: 1, createdAt: -1 });
alertSchema.index({ userId: 1, fundingRoundId: 1 }, { unique: true });
export const Alert = model('Alert', alertSchema);

/* ----------------------------------------------------------------- briefs */

const claimSchema = new Schema(
  {
    text: { type: String, required: true },
    /** Every claim must cite at least one stored source. */
    sourceIds: { type: [Schema.Types.ObjectId], ref: 'Source', required: true },
  },
  { _id: false },
);

const briefSchema = new Schema(
  {
    title: { type: String, required: true },
    scope: {
      type: { type: String, enum: ['sector', 'company'], required: true },
      slug: { type: String, required: true },
    },
    status: { type: String, enum: ['queued', 'running', 'ready', 'failed'], default: 'queued' },
    provider: { type: String, default: null },
    model: { type: String, default: null },
    sections: {
      type: [{ heading: String, claims: [claimSchema], _id: false }],
      default: [],
    },
    /** Claims the model produced that failed citation validation (kept for audit, never shown as fact). */
    rejectedClaims: { type: [{ text: String, reason: String, _id: false }], default: [] },
    sourceIds: { type: [Schema.Types.ObjectId], ref: 'Source', default: [] },
    error: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);
export const Brief = model('Brief', briefSchema);

/* ----------------------------------------------------------- ingest runs */

const ingestRunSchema = new Schema(
  {
    connector: { type: String, required: true },
    params: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['running', 'succeeded', 'partial', 'failed'], default: 'running' },
    counts: {
      fetched: { type: Number, default: 0 },
      published: { type: Number, default: 0 },
      errors: { type: Number, default: 0 },
    },
    error: { type: String, default: null },
    finishedAt: { type: Date, default: null },
    triggeredBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);
export const IngestRun = model('IngestRun', ingestRunSchema);

export { Types };
