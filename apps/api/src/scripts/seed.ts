/**
 * Seeds a fresh database from the committed public-data snapshot (data/seed).
 *
 * Records are replayed through the SAME pipeline the workers run (ingest topic →
 * processor → company.created → classify job → funding.created → alerts), using the
 * in-memory bus, so the seed exercises production code paths without Kafka.
 *
 *   npm run seed                 # no-op if data already exists
 *   SEED_RESET=true npm run seed # drop and re-seed
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import mongoose, { Types } from 'mongoose';
import { config } from '../config';
import { connectDb, disconnectDb } from '../db';
import { setBus, Topics } from '../events';
import { MemoryEventBus } from '../events/memoryBus';
import { registerJobHandlers, startConsumers } from '../ingestion/pipeline';
import type { FormDRecord, YcCompanyRecord } from '../ingestion/types';
import { invalidate, CacheNs } from '../lib/cache';
import { closeRedis } from '../lib/redis';
import { Classification, Company, User, Watchlist } from '../models';
import { drainInlineJobs } from '../queue/jobs';
import { createBriefRecord, generateBrief } from '../services/briefs';
import { TAXONOMY } from '../seed/taxonomy';
import { seedTaxonomy } from '../seed/seedTaxonomy';

const DATA = process.env.SEED_DIR ?? path.resolve(__dirname, '../../../../data/seed');

function readJson<T>(file: string, fallback: T): T {
  const p = path.join(DATA, file);
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : fallback;
}

async function seedUsers() {
  const hash = await bcrypt.hash(config.SEED_PASSWORD, 12);
  const users = [
    { email: config.SEED_ADMIN_EMAIL, name: 'Ada Admin', role: 'admin' },
    { email: config.SEED_ANALYST_EMAIL, name: 'Ari Analyst', role: 'analyst' },
    { email: 'viewer@strata.local', name: 'Val Viewer', role: 'viewer' },
  ];
  for (const u of users) {
    await User.updateOne({ email: u.email }, { $setOnInsert: { ...u, passwordHash: hash } }, { upsert: true });
  }
  return User.findOne({ email: config.SEED_ANALYST_EMAIL }).lean();
}

interface ReviewSeed {
  reviewer: string;
  decisions: { slug: string; subsector: string | null; note?: string; notable?: boolean }[];
}

/** Applies the hand-checked analyst decisions (data/seed/reviews.json). */
async function applyReviews(reviews: ReviewSeed[], analystId: Types.ObjectId) {
  let applied = 0;
  for (const file of reviews) {
    for (const d of file.decisions) {
      const company = await Company.findOne({ slug: d.slug });
      if (!company) continue;
      const sectorSlug = company.classification?.sectorSlug ?? company.trackedSectors[0];
      const proposal = await Classification.findOne({ companyId: company._id, status: { $in: ['pending_review', 'auto_accepted'] } }).sort({ createdAt: -1 });
      const agrees = proposal?.subsectorSlug === d.subsector;
      if (proposal) {
        proposal.status = agrees ? 'accepted' : 'overridden';
        proposal.finalSubsectorSlug = d.subsector;
        proposal.decidedBy = analystId;
        proposal.decidedAt = new Date();
        proposal.reviewNote = d.note ?? `Hand-checked by ${file.reviewer}`;
        await proposal.save();
      }
      company.classification = {
        ...(company.classification as any)?.toObject?.(),
        sectorSlug,
        subsectorSlug: d.subsector,
        state: 'reviewed',
        confidence: 1,
        reviewedBy: analystId,
        rationale: d.note ?? company.classification?.rationale ?? '',
      } as any;
      if (d.notable) company.notable = true;
      await company.save();
      applied++;
    }
  }
  return applied;
}

async function main() {
  await connectDb();
  const reset = process.env.SEED_RESET === 'true' || process.argv.includes('--reset');
  if (reset) {
    await mongoose.connection.db!.dropDatabase();
    await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
    console.log('database dropped');
  } else if (await Company.estimatedDocumentCount()) {
    console.log('database already seeded; skipping (SEED_RESET=true to re-seed)');
    return;
  }

  const bus = new MemoryEventBus();
  setBus(bus);
  registerJobHandlers();
  await startConsumers();

  await seedTaxonomy();
  const analyst = await seedUsers();
  console.log('taxonomy and users ready');

  // Watchlists exist before funding is ingested, so the alert path runs for real.
  await Watchlist.create([
    { userId: analyst!._id, name: 'Legal AI — every new filing', sectorSlugs: ['legal-ai'] },
    { userId: analyst!._id, name: 'Payments rounds ≥ $10M', sectorSlugs: ['payments-infra'], minAmountUsd: 10_000_000 },
    { userId: analyst!._id, name: 'Carbon removal', sectorSlugs: ['climate-carbon'] },
  ]);

  const yc = readJson<YcCompanyRecord[]>('yc-companies.json', []);
  for (const r of yc) await bus.publish(Topics.ingestRaw, `yc:${r.slug}`, 'ingest.yc', { connector: 'yc', key: `yc:${r.slug}`, data: r });
  await bus.drain();
  await drainInlineJobs();
  console.log(`companies: ${await Company.countDocuments()}`);

  const formD = readJson<FormDRecord[]>('sec-form-d.json', []).sort((a, b) => a.filingDate.localeCompare(b.filingDate));
  for (const f of formD) {
    await bus.publish(Topics.ingestRaw, `sec:${f.cik}`, 'ingest.sec_form_d', { connector: 'sec_form_d', key: `sec:${f.accessionNumber}`, data: f });
    await bus.drain(); // in order: amendments after originals
  }
  await drainInlineJobs();
  await bus.drain();
  console.log(`form d filings applied: ${formD.length}`);

  const reviewed = await applyReviews(readJson<ReviewSeed[]>('reviews.json', []), analyst!._id as Types.ObjectId);
  console.log(`analyst reviews applied: ${reviewed}`);
  await invalidate(CacheNs.analytics, CacheNs.taxonomy);

  for (const s of TAXONOMY) {
    const brief = await createBriefRecord({ type: 'sector', slug: s.slug }, String(analyst!._id), 'heuristic');
    await generateBrief(String(brief._id));
  }
  const top = await Company.findOne({ trackedSectors: 'legal-ai' }).sort({ 'metrics.totalRaisedUsd': -1 }).lean();
  if (top) {
    const b = await createBriefRecord({ type: 'company', slug: top.slug }, String(analyst!._id), 'heuristic');
    await generateBrief(String(b._id));
  }
  console.log('briefs generated');
  console.log(`done. Sign in as ${config.SEED_ANALYST_EMAIL} / ${config.SEED_ADMIN_EMAIL} with SEED_PASSWORD.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeRedis();
    await disconnectDb();
  });
