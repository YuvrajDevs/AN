import { createApp } from './app';
import { config } from './config';
import { connectDb, disconnectDb } from './db';
import { getBus } from './events';
import { logger } from './logger';
import { closeRedis } from './lib/redis';
import { registerJobHandlers, startConsumers } from './ingestion/pipeline';
import { closeJobs, startJobWorker } from './queue/jobs';

async function main() {
  await connectDb();
  registerJobHandlers();
  if (config.INLINE_WORKER) {
    // Hosted-demo mode: one process runs API + consumers + job worker.
    await startConsumers();
    startJobWorker();
  }
  const server = createApp().listen(config.PORT, () => logger.info({ port: config.PORT, bus: config.EVENT_BUS }, 'api listening'));

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    server.close();
    await closeJobs().catch(() => undefined);
    await getBus().close().catch(() => undefined);
    await closeRedis();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'api failed to start');
  process.exit(1);
});
