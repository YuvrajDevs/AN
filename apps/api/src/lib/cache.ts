import { config } from '../config';
import { logger } from '../logger';
import { getRedis } from './redis';

/**
 * Cache-aside helper for expensive aggregation results.
 *
 * Keys are namespaced by a "generation" number per namespace. Writes that change the
 * underlying data call `invalidate(ns)`, which bumps the generation — old keys are never
 * read again and simply expire by TTL. This avoids SCAN/DEL storms and is safe across
 * many API replicas. Without Redis, an in-process LRU-ish map is used.
 */

interface Entry {
  value: string;
  expires: number;
}
const memory = new Map<string, Entry>();
const memoryGen = new Map<string, number>();
const MAX_MEMORY_ENTRIES = 500;

async function generation(ns: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return memoryGen.get(ns) ?? 0;
  try {
    const v = await redis.get(`cache:gen:${ns}`);
    return v ? Number(v) : 0;
  } catch {
    return -1;
  }
}

export async function cached<T>(ns: string, key: string, compute: () => Promise<T>, ttlSeconds = config.CACHE_TTL_SECONDS): Promise<T> {
  const gen = await generation(ns);
  if (gen < 0) return compute(); // Redis unavailable: degrade to uncached, never fail the request.
  const fullKey = `cache:${ns}:${gen}:${key}`;
  const redis = getRedis();
  try {
    const hit = redis ? await redis.get(fullKey) : memoryGet(fullKey);
    if (hit) return JSON.parse(hit) as T;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'cache read failed');
  }
  const value = await compute();
  const serialized = JSON.stringify(value);
  try {
    if (redis) await redis.set(fullKey, serialized, 'EX', ttlSeconds);
    else memorySet(fullKey, serialized, ttlSeconds);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'cache write failed');
  }
  return value;
}

export async function invalidate(...namespaces: string[]): Promise<void> {
  const redis = getRedis();
  for (const ns of namespaces) {
    if (redis) {
      await redis.incr(`cache:gen:${ns}`).catch(() => undefined);
    } else {
      memoryGen.set(ns, (memoryGen.get(ns) ?? 0) + 1);
    }
  }
}

function memoryGet(key: string): string | null {
  const e = memory.get(key);
  if (!e) return null;
  if (e.expires < Date.now()) {
    memory.delete(key);
    return null;
  }
  return e.value;
}

function memorySet(key: string, value: string, ttl: number) {
  if (memory.size >= MAX_MEMORY_ENTRIES) {
    const oldest = memory.keys().next().value;
    if (oldest) memory.delete(oldest);
  }
  memory.set(key, { value, expires: Date.now() + ttl * 1000 });
}

/** Cache namespaces, invalidated by the writes that affect them. */
export const CacheNs = {
  analytics: 'analytics',
  taxonomy: 'taxonomy',
} as const;
