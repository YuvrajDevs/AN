import { connectDb, disconnectDb } from './db';
import { getBus } from './events';
import { logger } from './logger';
import { closeRedis } from './lib/redis';
import { connectorSchedule, registerJobHandlers, startConsumers } from './ingestion/pipeline';
import { closeJobs, scheduleRepeatable, startJobWorker } from './queue/jobs';

/**
 * Worker process: event-stream consumers (Kafka / Redis Streams) + BullMQ job worker.
 * Scale horizontally: Kafka consumer groups split partitions across replicas and BullMQ
 * workers compete for jobs.
 */
async function main() {
  await connectDb();
  registerJobHandlers();
  await startConsumers();
  startJobWorker(Number(process.env.WORKER_CONCURRENCY ?? 4));
  for (const s of connectorSchedule()) {
    await scheduleRepeatable('run-connector', { connector: s.connector, params: {} }, s.everyMs, `schedule:${s.connector}`);
  }
  logger.info('worker running');

  const shutdown = async () => {
    await closeJobs().catch(() => undefined);
    await getBus().close().catch(() => undefined);
    await closeRedis();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

main().catch((err) => {
  logger.fatal({ err }, 'worker failed to start');
  process.exit(1);
});
