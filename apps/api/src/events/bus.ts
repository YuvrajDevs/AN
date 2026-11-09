import { randomUUID } from 'node:crypto';
import { logger } from '../logger';

/**
 * Event backbone abstraction. Ingestion connectors publish raw records; workers consume
 * them, normalise, and write to MongoDB. Three interchangeable transports:
 *
 *   kafka  — Kafka/Redpanda (docker compose default): partitioned, replayable log.
 *   redis  — Redis Streams with consumer groups: same at-least-once semantics, no Kafka
 *            to run (hosted demo on a free Redis).
 *   memory — in-process (tests, single-process demo).
 *
 * Handlers must be idempotent: every transport is at-least-once. Records carry natural
 * dedupe keys (SEC accession number, YC slug, URL) and writes are upserts.
 */

export const Topics = {
  /** Raw records from connectors, keyed by "<connector>:<natural id>". */
  ingestRaw: 'strata.ingest.raw',
  /** Emitted after a new funding round is stored. Drives alerts. */
  fundingCreated: 'strata.funding.created',
  /** Emitted after a company is created; drives classification. */
  companyCreated: 'strata.company.created',
} as const;
export type Topic = (typeof Topics)[keyof typeof Topics];

export interface BusEvent<T = unknown> {
  id: string;
  type: string;
  occurredAt: string;
  payload: T;
}

export type Handler<T = unknown> = (event: BusEvent<T>) => Promise<void>;

export interface EventBus {
  readonly kind: 'kafka' | 'redis' | 'memory';
  publish<T>(topic: Topic, key: string, type: string, payload: T): Promise<void>;
  subscribe<T>(topic: Topic, group: string, handler: Handler<T>): Promise<void>;
  close(): Promise<void>;
}

export function makeEvent<T>(type: string, payload: T): BusEvent<T> {
  return { id: randomUUID(), type, occurredAt: new Date().toISOString(), payload };
}

export const dlqTopic = (topic: string) => `${topic}.dlq`;

/**
 * Runs a handler with bounded retries and exponential backoff. If it still fails, the
 * caller parks the message on a dead-letter topic so one poison record never blocks a
 * partition.
 */
export async function runWithRetry<T>(
  handler: Handler<T>,
  event: BusEvent<T>,
  onDeadLetter: (err: Error) => Promise<void>,
  attempts = 3,
  baseDelayMs = 200,
): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    try {
      await handler(event);
      return;
    } catch (err) {
      if (i === attempts) {
        logger.error({ err: (err as Error).message, eventId: event.id, type: event.type }, 'handler failed; dead-lettering');
        await onDeadLetter(err as Error);
        return;
      }
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** (i - 1)));
    }
  }
}
