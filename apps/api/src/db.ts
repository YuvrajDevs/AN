import mongoose from 'mongoose';
import { config } from './config';
import { logger } from './logger';

mongoose.set('strictQuery', true);
// Operator injection ({"$gt": ""}) is prevented at the edge: every request is parsed by a
// zod schema that only admits primitives where filters expect them (security/validate.ts).

export async function connectDb(url = config.MONGO_URL): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await mongoose.connect(url, { serverSelectionTimeoutMS: 5000, maxPoolSize: 20 });
      await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
      logger.info('mongo connected');
      return;
    } catch (err) {
      if (attempt >= 10) throw err;
      logger.warn({ attempt, err: (err as Error).message }, 'mongo not ready, retrying');
      await new Promise((r) => setTimeout(r, Math.min(1000 * attempt, 5000)));
    }
  }
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
