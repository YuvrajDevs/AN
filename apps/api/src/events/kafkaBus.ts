import { Kafka, logLevel, type Consumer, type Producer } from 'kafkajs';
import { config } from '../config';
import { logger } from '../logger';
import { dlqTopic, makeEvent, runWithRetry, Topics, type EventBus, type Handler, type Topic } from './bus';

/**
 * Kafka / Redpanda transport.
 *  - Messages are keyed (e.g. "sec:<cik>") so all events for one entity land on one
 *    partition and are processed in order.
 *  - Producer is idempotent (no duplicates on producer retry).
 *  - Offsets are committed only after the handler (and its retries) finish, so a crash
 *    re-delivers instead of losing data. Failed messages go to "<topic>.dlq".
 */
export class KafkaEventBus implements EventBus {
  readonly kind = 'kafka' as const;
  private kafka: Kafka;
  private producer: Producer;
  private consumers: Consumer[] = [];
  private connected = false;

  constructor(brokers = config.KAFKA_BROKERS.split(',')) {
    this.kafka = new Kafka({
      clientId: config.KAFKA_CLIENT_ID,
      brokers,
      logLevel: logLevel.WARN,
      retry: { initialRetryTime: 300, retries: 10 },
    });
    this.producer = this.kafka.producer({ idempotent: true, maxInFlightRequests: 1, allowAutoTopicCreation: false });
  }

  async ensureTopics(): Promise<void> {
    const admin = this.kafka.admin();
    await admin.connect();
    const wanted = Object.values(Topics).flatMap((t) => [t, dlqTopic(t)]);
    const existing = new Set(await admin.listTopics());
    const missing = wanted.filter((t) => !existing.has(t));
    if (missing.length) {
      await admin.createTopics({
        topics: missing.map((topic) => ({ topic, numPartitions: topic.endsWith('.dlq') ? 1 : 6, replicationFactor: 1 })),
        waitForLeaders: true,
      });
      logger.info({ topics: missing }, 'created kafka topics');
    }
    await admin.disconnect();
  }

  private async connect() {
    if (this.connected) return;
    await this.ensureTopics();
    await this.producer.connect();
    this.connected = true;
  }

  async publish<T>(topic: Topic, key: string, type: string, payload: T): Promise<void> {
    await this.connect();
    const event = makeEvent(type, payload);
    await this.producer.send({
      topic,
      messages: [{ key, value: JSON.stringify(event), headers: { type } }],
    });
  }

  async subscribe<T>(topic: Topic, group: string, handler: Handler<T>): Promise<void> {
    await this.connect();
    const consumer = this.kafka.consumer({ groupId: `strata.${group}`, sessionTimeout: 30_000 });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: true });
    await consumer.run({
      autoCommit: true,
      eachMessage: async ({ message, partition }) => {
        if (!message.value) return;
        let event;
        try {
          event = JSON.parse(message.value.toString());
        } catch {
          logger.error({ topic, partition, offset: message.offset }, 'unparseable message; skipping');
          return;
        }
        await runWithRetry(handler, event, async (err) => {
          await this.producer.send({
            topic: dlqTopic(topic),
            messages: [{ key: message.key, value: message.value, headers: { error: err.message.slice(0, 500) } }],
          });
        });
      },
    });
    this.consumers.push(consumer);
  }

  async close(): Promise<void> {
    await Promise.all(this.consumers.map((c) => c.disconnect().catch(() => undefined)));
    if (this.connected) await this.producer.disconnect().catch(() => undefined);
  }
}
