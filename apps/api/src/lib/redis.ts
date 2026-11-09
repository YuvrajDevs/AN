import IORedis, { type Redis } from 'ioredis';
import { config } from '../config';
import { logger } from '../logger';

let client: Redis | null = null;

/** Shared Redis connection, or null when REDIS_URL is empty (single-process demo mode). */
export function getRedis(): Redis | null {
  if (!config.REDIS_URL) return null;
  if (!client) {
    client = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: true, lazyConnect: false });
    client.on('error', (err) => logger.warn({ err: err.message }, 'redis error'));
  }
  return client;
}

/** A fresh connection (BullMQ workers and blocking stream reads need their own). */
export function newRedisConnection(): Redis {
  if (!config.REDIS_URL) throw new Error('REDIS_URL is not configured');
  return new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => undefined);
    client = null;
  }
}
