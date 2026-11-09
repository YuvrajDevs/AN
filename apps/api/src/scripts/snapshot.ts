/**
 * Builds the committed seed dataset (data/seed/*.json) by running the real connectors
 * against live public sources — YC public directory + SEC EDGAR Form D — and capturing
 * the raw records they would publish to Kafka. `npm run seed` replays these records
 * through the same processor the workers use, so first run needs no network.
 *
 *   SEC_USER_AGENT="Your Name you@example.com" npm run snapshot -w apps/api
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { runFormDConnector } from '../ingestion/connectors/secFormD';
import { fetchYcDirectory, runYcConnector } from '../ingestion/connectors/yc';
import type { FormDRecord, RawRecord, YcCompanyRecord } from '../ingestion/types';
import { TAXONOMY } from '../seed/taxonomy';

const OUT = path.resolve(__dirname, '../../../../data/seed');

async function main() {
  const startedAt = new Date().toISOString();
  const yc: YcCompanyRecord[] = [];
  const all = await fetchYcDirectory();
  await runYcConnector(
    {
      publish: async (r: RawRecord) => {
        if (r.connector === 'yc') yc.push(r.data);
      },
      log: (m, e) => console.log(m, e ?? ''),
    },
    TAXONOMY.map((s) => ({ slug: s.slug, sourceTags: s.sourceTags })),
    { companies: all },
  );
  console.log(`YC: ${yc.length} companies across ${TAXONOMY.length} sectors`);

  const rejections: { companySlug: string; cik: string; reason: string }[] = existsSync(path.join(OUT, 'sec-form-d-rejections.json'))
    ? JSON.parse(readFileSync(path.join(OUT, 'sec-form-d-rejections.json'), 'utf8'))
    : [];
  const formD: FormDRecord[] = [];
  let i = 0;
  await runFormDConnector(
    {
      publish: async (r: RawRecord) => {
        if (r.connector === 'sec_form_d') formD.push(r.data);
      },
      log: (m, e) => {
        if (++i % 25 === 0 || m.includes('failed')) console.log(m, e ?? '');
      },
    },
    yc.map((c) => ({
      slug: c.slug,
      name: c.name,
      website: c.website,
      batchYear: c.batchDate ? new Date(c.batchDate).getUTCFullYear() : null,
      rejectedCiks: rejections.filter((r) => r.companySlug === c.slug).map((r) => r.cik),
    })),
  );
  console.log(`Form D: ${formD.length} filings linked to ${new Set(formD.map((f) => f.companySlug)).size} companies`);

  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, 'yc-companies.json'), JSON.stringify(yc, null, 1));
  writeFileSync(path.join(OUT, 'sec-form-d.json'), JSON.stringify(formD, null, 1));
  writeFileSync(
    path.join(OUT, 'manifest.json'),
    JSON.stringify(
      {
        generatedAt: startedAt,
        sources: {
          yc: { url: 'https://yc-oss.github.io/api/companies/all.json', note: 'Community JSON mirror of the public YC company directory', records: yc.length },
          secFormD: { url: 'https://efts.sec.gov/LATEST/search-index + https://www.sec.gov/Archives/edgar/data', records: formD.length },
        },
        sectors: TAXONOMY.map((s) => ({ slug: s.slug, sourceTags: s.sourceTags, companies: yc.filter((c) => c.sectors.includes(s.slug)).length })),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
