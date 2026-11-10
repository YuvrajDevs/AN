import mongoose from 'mongoose';
import { config } from '../config';
import { connectDb } from '../db';
import { ask, retrieve } from '../services/rag';

/**
 * Ask (RAG) evaluation against the live dataset.
 *
 * Retrieval: hand-written questions, mostly paraphrases that avoid the company's own words,
 * each with the company that should be retrieved. Hit@5 and MRR for semantic-only,
 * keyword-only and hybrid retrieval.
 * Answers (optional, --answers): a few questions through the full pipeline, counting claims
 * that passed or failed the citation check, plus an unanswerable question that must be refused.
 */

const CASES: { q: string; slug: string }[] = [
  { q: 'a law firm run by AI that represents consumers and plaintiffs', slug: 'blueshoe' },
  { q: 'software that writes patent applications', slug: 'solve-intelligence' },
  { q: 'due diligence on legal documents done automatically', slug: 'mage-legal' },
  { q: 'agents that handle the operations of a law practice', slug: 'praxis' },
  { q: 'automate filling in legal document templates', slug: 'lawyaw' },
  { q: 'assistant for intellectual property work', slug: 'edge' },
  { q: 'lab-grown dairy milk', slug: 'brown-foods' },
  { q: 'plant-based fish alternatives', slug: 'current-foods' },
  { q: 'satellite imaging of the planet with hyperspectral cameras', slug: 'wyvern' },
  { q: 'electric car chargers in India', slug: 'statiq' },
  { q: 'hardware that helps solar panels track the sun', slug: 'sunfolding' },
  { q: 'cheaper and faster direct air capture plants', slug: 'noya' },
  { q: 'software to manage solar power plants over their life', slug: 'raptor-maps' },
  { q: 'measure a company carbon footprint through an API', slug: 'canopi' },
  { q: 'fight chargebacks automatically', slug: 'disputeninja' },
  { q: 'card payments like Stripe for post-Soviet countries', slug: 'payze' },
  { q: 'convert between crypto and local currency in Latin America', slug: 'koywe' },
  { q: 'split a bill between friends when paying in a shop', slug: 'godutch' },
  { q: 'business-to-business payments in emerging markets', slug: 'waza' },
  { q: 'launch your own payment product as a service', slug: 'arcus' },
  { q: 'rent payments that follow a business cash flow', slug: 'rentflow' },
  { q: 'How much did Legora raise in its Form D filing?', slug: 'legora' },
  { q: 'Casetext Form D amount sold', slug: 'casetext' },
  { q: 'Advano funding from SEC filings', slug: 'advano' },
  { q: 'C16 Biosciences offering in 2023', slug: 'c16-biosciences' },
];

const MODES = {
  semantic: { dense: true, keyword: false, names: false },
  keyword: { dense: false, keyword: true, names: false },
  hybrid: { dense: true, keyword: true, names: true },
} as const;

async function main() {
  await connectDb(config.MONGO_URL);
  const out: Record<string, { hit1: number; hit5: number; mrr: number }> = {};
  const misses: string[] = [];
  for (const [name, use] of Object.entries(MODES)) {
    let h1 = 0, h5 = 0, mrr = 0;
    for (const c of CASES) {
      const r = await retrieve(c.q, 5, use);
      const rank = r.hits.findIndex((h) => h.companySlug === c.slug);
      if (rank === 0) h1++;
      if (rank >= 0) {
        h5++;
        mrr += 1 / (rank + 1);
      } else if (name === 'hybrid') misses.push(`${c.q} -> ${r.hits.map((h) => h.companySlug ?? h.kind).join(', ')}`);
    }
    out[name] = { hit1: +(h1 / CASES.length).toFixed(3), hit5: +(h5 / CASES.length).toFixed(3), mrr: +(mrr / CASES.length).toFixed(3) };
  }
  console.log(JSON.stringify({ cases: CASES.length, retrieval: out, hybridMisses: misses }, null, 2));

  if (process.argv.includes('--answers')) {
    const qs = [
      'Which startups help lawyers draft patents?',
      'How much did Legora raise in its Form D filing?',
      'Who is building direct air capture?',
      'How many Legal AI companies does Strata track?',
      'What is Apple stock price today?',
    ];
    let kept = 0, dropped = 0;
    const rows = [];
    for (const q of qs) {
      const a = await ask(q, 'gemini');
      kept += a.claims.length;
      dropped += a.rejected.length;
      rows.push({ q, answerable: a.answerable, mode: a.answerMode, model: a.model, claims: a.claims.map((c) => `${c.text} ${c.refs.join(',')}`), rejected: a.rejected });
    }
    console.log(JSON.stringify({ answers: rows, claimsKept: kept, claimsDropped: dropped }, null, 2));
  }
  await mongoose.disconnect();
}
main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
