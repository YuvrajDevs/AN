import { config } from '../config';
import { getBus, Topics } from '../events';
import { logger } from '../logger';
import { Company, IngestRun, Sector } from '../models';
import { enqueue, registerJobHandler } from '../queue/jobs';
import { classifyCompanyById } from '../services/classification';
import { deliverAlertsForRound } from '../services/alerts';
import { generateBrief } from '../services/briefs';
import { hasSecContact, runFormDConnector } from './connectors/secFormD';
import { runGithubConnector } from './connectors/github';
import { runRssConnector } from './connectors/rss';
import { runYcConnector } from './connectors/yc';
import { processRawRecord } from './processor';
import type { ConnectorContext, RawRecord } from './types';

/**
 *   connectors ──publish──▶ strata.ingest.raw ──▶ processor (normalise + upsert)
 *                                                    │
 *                     strata.company.created ◀───────┤──────▶ strata.funding.created
 *                               │                                      │
 *                     job: classify-company                 job: deliver-alerts
 */

export const CONNECTORS = ['yc', 'sec_form_d', 'rss', 'github'] as const;
export type ConnectorName = (typeof CONNECTORS)[number];

export function registerJobHandlers() {
  registerJobHandler('classify-company', (d) => classifyCompanyById(d.companyId, { provider: d.provider }));
  registerJobHandler('deliver-alerts', (d) => deliverAlertsForRound(d.fundingRoundId));
  registerJobHandler('generate-brief', (d) => generateBrief(d.briefId));
  registerJobHandler('run-connector', (d) => runConnector(d.connector, d.params ?? {}, d.triggeredBy ?? null));
}

/** Subscribe the stream consumers. Each consumer group gets every message once (at-least-once). */
export async function startConsumers() {
  const bus = getBus();
  await bus.subscribe<RawRecord>(Topics.ingestRaw, 'processor', async (e) => processRawRecord(e.payload));
  await bus.subscribe<{ companyId: string }>(Topics.companyCreated, 'classifier', async (e) => {
    await enqueue('classify-company', { companyId: e.payload.companyId }, { jobId: `classify-${e.payload.companyId}-${e.id}` });
  });
  await bus.subscribe<{ fundingRoundId: string }>(Topics.fundingCreated, 'alerts', async (e) => {
    await enqueue('deliver-alerts', { fundingRoundId: e.payload.fundingRoundId }, { jobId: `alerts-${e.payload.fundingRoundId}` });
  });
  logger.info({ bus: bus.kind }, 'ingestion consumers started');
}

export async function runConnector(connector: ConnectorName, params: Record<string, any>, triggeredBy: string | null = null) {
  const run = await IngestRun.create({ connector, params, triggeredBy });
  const bus = getBus();
  const warnings: string[] = [];
  const ctx: ConnectorContext = {
    publish: (r) => bus.publish(Topics.ingestRaw, r.key, `ingest.${r.connector}`, r),
    log: (msg, extra) => logger.info({ connector, ...extra }, msg),
    warn: (msg, extra) => {
      logger.warn({ connector, ...extra }, msg);
      if (warnings.length < 5) warnings.push(msg.slice(0, 300));
    },
  };
  try {
    if (connector === 'sec_form_d' && !hasSecContact()) {
      throw new Error('SEC_USER_AGENT must include a contact email (SEC fair-access policy), e.g. "Jane Doe jane@example.com"');
    }
    let result: { fetched: number; published: number; errors?: number };
    if (connector === 'yc') {
      const sectors = await Sector.find({ parentSlug: null, tracked: true }).lean();
      result = await runYcConnector(ctx, sectors.map((s) => ({ slug: s.slug, sourceTags: s.sourceTags ?? [] })), { limit: params.limit });
    } else if (connector === 'sec_form_d') {
      const filter: Record<string, unknown> = params.companySlugs?.length ? { slug: { $in: params.companySlugs } } : { status: { $ne: 'inactive' } };
      const companies = await Company.find(filter).select('slug name website legalNames').limit(params.limit ?? 1000).lean();
      result = await runFormDConnector(ctx, companies.map((c) => ({ slug: c.slug, name: c.name, website: c.website ?? null, aliases: c.legalNames })));
    } else if (connector === 'rss') {
      result = await runRssConnector(ctx, (params.feeds ?? []) as { url: string; companySlug?: string }[]);
    } else {
      result = await runGithubConnector(ctx, (params.targets ?? []) as { companySlug: string; org: string }[]);
    }
    const errors = result.errors ?? 0;
    run.counts = { fetched: result.fetched, published: result.published, errors } as any;
    // succeeded: no target failed · partial: some did · failed: every target failed.
    run.status = errors === 0 ? 'succeeded' : errors >= result.fetched && result.published === 0 ? 'failed' : 'partial';
    if (warnings.length) run.error = warnings.join(' · ').slice(0, 1000);
  } catch (err) {
    run.status = 'failed';
    run.error = (err as Error).message.slice(0, 1000);
    logger.error({ connector, err: run.error }, 'connector run failed');
  }
  run.finishedAt = new Date();
  await run.save();
  return run.toObject();
}

export function connectorSchedule() {
  return config.SCHEDULE_INGESTION
    ? [
        { connector: 'yc' as const, everyMs: 24 * 3600_000 },
        { connector: 'sec_form_d' as const, everyMs: 24 * 3600_000 },
      ]
    : [];
}
