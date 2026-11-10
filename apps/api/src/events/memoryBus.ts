import { logger } from '../logger';
import { dlqTopic, makeEvent, runWithRetry, type BusEvent, type EventBus, type Handler, type Topic } from './bus';

/** In-process bus for tests and the single-process demo. Delivery is async and at-least-once. */
export class MemoryEventBus implements EventBus {
  readonly kind = 'memory' as const;
  private handlers = new Map<string, Map<string, Handler<any>>>();
  private inflight = new Set<Promise<void>>();
  readonly deadLetters: { topic: string; event: BusEvent; error: string }[] = [];

  async publish<T>(topic: Topic, _key: string, type: string, payload: T): Promise<void> {
    const event = makeEvent(type, payload);
    const groups = this.handlers.get(topic);
    if (!groups) return;
    for (const handler of groups.values()) {
      const p = new Promise<void>((resolve) => setImmediate(resolve))
        .then(() =>
          runWithRetry(handler, event, async (err) => {
            this.deadLetters.push({ topic: dlqTopic(topic), event, error: err.message });
          }, 3, 5),
        )
        .catch((err) => logger.error({ err }, 'memory bus dispatch failed'))
        .finally(() => this.inflight.delete(p));
      this.inflight.add(p);
    }
  }

  async subscribe<T>(topic: Topic, group: string, handler: Handler<T>): Promise<void> {
    if (!this.handlers.has(topic)) this.handlers.set(topic, new Map());
    this.handlers.get(topic)!.set(group, handler as Handler<any>);
  }

  /** Resolve once every published event (and events they cascade into) has been handled. */
  async drain(): Promise<void> {
    while (this.inflight.size > 0) {
      await Promise.all([...this.inflight]);
    }
  }

  async close(): Promise<void> {
    await this.drain();
    this.handlers.clear();
  }
}
