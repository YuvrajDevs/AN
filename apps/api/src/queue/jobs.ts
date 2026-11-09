import { Queue, Worker, type JobsOptions } from 'bullmq';
import { config } from '../config';
import { logger } from '../logger';
import { newRedisConnection } from '../lib/redis';

/**
 * Background jobs (BullMQ on Redis): classification, alert delivery, brief generation and
 * connector runs. Kafka carries *facts* (what was ingested); BullMQ carries *work* (things
 * to do once, with retries, backoff, concurrency limits and a UI-visible state).
 *
 * Without Redis (tests / single-process demo) jobs run in-process, asynchronously, with
 * the same handlers — so behaviour is identical, only durability differs.
 */

export type JobName = 'classify-company' | 'deliver-alerts' | 'generate-brief' | 'run-connector';
export type JobHandler = (data: any) => Promise<unknown>;

const QUEUE = 'strata-jobs';
const handlers = new Map<JobName, JobHandler>();
let queue: Queue | null = null;
let worker: Worker | null = null;
const inflight = new Set<Promise<unknown>>();

const DEFAULT_OPTS: JobsOptions = {
  attempts: 4,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

export function registerJobHandler(name: JobName, handler: JobHandler) {
  handlers.set(name, handler);
}

function useRedis() {
  return Boolean(config.REDIS_URL) && config.NODE_ENV !== 'test';
}

function getQueue(): Queue {
  if (!queue) queue = new Queue(QUEUE, { connection: newRedisConnection(), defaultJobOptions: DEFAULT_OPTS });
  return queue;
}

/** Enqueue work. jobId makes enqueueing idempotent (e.g. one classification per company at a time). */
export async function enqueue(name: JobName, data: Record<string, unknown>, opts: JobsOptions = {}): Promise<void> {
  if (useRedis()) {
    await getQueue().add(name, data, opts);
    return;
  }
  const handler = handlers.get(name);
  if (!handler) {
    logger.warn({ name }, 'no handler registered for job; dropping (inline mode)');
    return;
  }
  const p: Promise<unknown> = new Promise((r) => setImmediate(r))
    .then(() => handler(data))
    .catch((err) => logger.error({ err: (err as Error).message, name }, 'inline job failed'))
    .finally(() => inflight.delete(p));
  inflight.add(p);
}

/** Tests / seed: wait for in-process jobs (and jobs they enqueue) to finish. */
export async function drainInlineJobs(): Promise<void> {
  while (inflight.size) await Promise.all([...inflight]);
}

export function startJobWorker(concurrency = 4): Worker | null {
  if (!useRedis()) return null;
  worker = new Worker(
    QUEUE,
    async (job) => {
      const handler = handlers.get(job.name as JobName);
      if (!handler) throw new Error(`No handler for job ${job.name}`);
      return handler(job.data);
    },
    { connection: newRedisConnection(), concurrency },
  );
  worker.on('failed', (job, err) => logger.warn({ job: job?.name, id: job?.id, attempts: job?.attemptsMade, err: err.message }, 'job failed'));
  return worker;
}

export async function jobCounts(): Promise<Record<string, number> | null> {
  if (!useRedis()) return { inline: inflight.size };
  return getQueue().getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
}

export async function scheduleRepeatable(name: JobName, data: Record<string, unknown>, everyMs: number, key: string) {
  if (!useRedis()) return;
  await getQueue().upsertJobScheduler(key, { every: everyMs }, { name, data, opts: DEFAULT_OPTS });
}

export async function closeJobs(): Promise<void> {
  await worker?.close();
  await queue?.close();
  worker = null;
  queue = null;
}
