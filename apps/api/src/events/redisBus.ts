import { hostname } from 'node:os';
import type { Redis } from 'ioredis';
import { logger } from '../logger';
import { getRedis, newRedisConnection } from '../lib/redis';
import { dlqTopic, makeEvent, runWithRetry, type BusEvent, type EventBus, type Handler, type Topic } from './bus';

const MAXLEN = 50_000;

/**
 * Redis Streams transport: XADD to publish, consumer groups (XREADGROUP + XACK) to
 * consume. Same at-least-once contract as Kafka, for deployments without a broker.
 * On start, a consumer first re-claims its own un-acked messages (crash recovery).
 */
export class RedisStreamEventBus implements EventBus {
  readonly kind = 'redis' as const;
  private readers: Redis[] = [];
  private stopped = false;
  private consumerName = `${hostname()}-${process.pid}`;

  private get redis(): Redis {
    const r = getRedis();
    if (!r) throw new Error('RedisStreamEventBus requires REDIS_URL');
    return r;
  }

  async publish<T>(topic: Topic, _key: string, type: string, payload: T): Promise<void> {
    const event = makeEvent(type, payload);
    await this.redis.xadd(topic, 'MAXLEN', '~', String(MAXLEN), '*', 'event', JSON.stringify(event));
  }

  async subscribe<T>(topic: Topic, group: string, handler: Handler<T>): Promise<void> {
    try {
      await this.redis.xgroup('CREATE', topic, group, '0', 'MKSTREAM');
    } catch (err) {
      if (!String((err as Error).message).includes('BUSYGROUP')) throw err;
    }
    const reader = newRedisConnection();
    this.readers.push(reader);

    const loop = async () => {
      let cursor = '0'; // first drain our pending entries list, then switch to new messages (">")
      while (!this.stopped) {
        try {
          const res = (await reader.xreadgroup(
            'GROUP', group, this.consumerName, 'COUNT', 20, 'BLOCK', 5000, 'STREAMS', topic, cursor,
          )) as [string, [string, string[]][]][] | null;
          const entries = res?.[0]?.[1] ?? [];
          if (cursor === '0' && entries.length === 0) cursor = '>';
          for (const [id, fields] of entries) {
            const raw = fields[fields.indexOf('event') + 1];
            const event = JSON.parse(raw) as BusEvent<T>;
            await runWithRetry(handler, event, async (err) => {
              await this.redis.xadd(dlqTopic(topic), '*', 'event', raw, 'error', err.message.slice(0, 500));
            });
            await this.redis.xack(topic, group, id);
          }
        } catch (err) {
          if (this.stopped) return;
          logger.warn({ err: (err as Error).message, topic }, 'stream read failed; retrying');
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    };
    void loop();
  }

  async close(): Promise<void> {
    this.stopped = true;
    await Promise.all(this.readers.map((r) => r.quit().catch(() => r.disconnect())));
  }
}
