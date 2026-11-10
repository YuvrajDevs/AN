import mongoose from 'mongoose';
import { config } from '../config';
import { connectDb } from '../db';
import { indexPassages, ragStatus } from '../services/rag';

/** Build or refresh the Ask (RAG) index: `npm run index` (add --force to re-embed everything). */
async function main() {
  await connectDb(config.MONGO_URL);
  const report = await indexPassages({ force: process.argv.includes('--force') });
  console.log(JSON.stringify({ report, status: await ragStatus() }, null, 2));
  await mongoose.disconnect();
}
main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
