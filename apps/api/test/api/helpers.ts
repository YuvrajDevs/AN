import bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../../src/app';
import { connectDb } from '../../src/db';
import { setBus } from '../../src/events';
import { MemoryEventBus } from '../../src/events/memoryBus';
import { registerJobHandlers, startConsumers } from '../../src/ingestion/pipeline';
import { User } from '../../src/models';
import { drainInlineJobs } from '../../src/queue/jobs';
import { seedTaxonomy } from '../../src/seed/seedTaxonomy';

export const PASSWORD = 'correct-horse-battery';

export async function startTestEnv() {
  // MONGO_URL_TEST lets CI use a service container instead of downloading mongod.
  const mongod = process.env.MONGO_URL_TEST ? null : await MongoMemoryServer.create();
  const base = process.env.MONGO_URL_TEST ?? mongod!.getUri();
  const dbName = `strata_test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  const url = base.includes('?') ? base.replace('/?', `/${dbName}?`) : `${base.replace(/\/$/, '')}/${dbName}`;
  await connectDb(url);
  const bus = new MemoryEventBus();
  setBus(bus);
  registerJobHandlers();
  await startConsumers();
  await seedTaxonomy();
  const hash = await bcrypt.hash(PASSWORD, 4);
  await User.create([
    { email: 'admin@test.dev', name: 'Admin', role: 'admin', passwordHash: hash },
    { email: 'analyst@test.dev', name: 'Analyst', role: 'analyst', passwordHash: hash },
    { email: 'viewer@test.dev', name: 'Viewer', role: 'viewer', passwordHash: hash },
  ]);
  const app = createApp();
  return {
    app,
    bus,
    async settle() {
      for (let i = 0; i < 5; i++) {
        await bus.drain();
        await drainInlineJobs();
      }
    },
    async login(email: string) {
      const agent = request.agent(app);
      const res = await agent.post('/api/auth/login').send({ email, password: PASSWORD });
      if (res.status !== 200) throw new Error(`login failed: ${res.status}`);
      return agent;
    },
    async stop() {
      await mongoose.connection.dropDatabase().catch(() => undefined);
      await mongoose.disconnect();
      await mongod?.stop();
    },
  };
}
export type TestEnv = Awaited<ReturnType<typeof startTestEnv>>;
