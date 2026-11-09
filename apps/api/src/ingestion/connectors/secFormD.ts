import { XMLParser } from 'fast-xml-parser';
import { config } from '../../config';
import { hostnameOf, normalizeName } from '../../lib/text';
import type { ConnectorContext, FormDRecord } from '../types';

/**
 * SEC EDGAR Form D (Regulation D exempt offerings). Free, public, no key; SEC asks for a
 * descriptive User-Agent with contact details and ≤10 requests/second.
 *
 * Form D is the best free, primary-source funding signal for US-incorporated startups:
 * it reports the offering size and amount sold. It does NOT name the round (Seed/Series A)
 * or the investors, and many companies never file one — the landscape doc discusses this.
 */

const FTS_URL = 'https://efts.sec.gov/LATEST/search-index';
const ARCHIVES = 'https://www.sec.gov/Archives/edgar/data';
const MIN_INTERVAL_MS = 150;

let lastRequest = 0;
async function secFetch(url: string, fetchImpl: typeof fetch): Promise<Response> {
  const wait = lastRequest + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetchImpl(url, { headers: { 'user-agent': config.SEC_USER_AGENT, accept: 'application/json, application/xml' } });
    if (res.status !== 429 && res.status < 500) return res;
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
  throw new Error(`SEC request failed after retries: ${url}`);
}

export interface FtsHit {
  adsh: string;
  cik: string;
  entityName: string;
  form: string;
  fileDate: string;
  bizLocations: string[];
}

/** SEC's fair-access policy asks automated clients to identify themselves with a contact. */
export function hasSecContact(userAgent = config.SEC_USER_AGENT): boolean {
  return /\S+@\S+\.\S+/.test(userAgent);
}

export async function searchFormD(name: string, fetchImpl: typeof fetch = fetch): Promise<FtsHit[]> {
  const url = `${FTS_URL}?q=${encodeURIComponent(`"${name}"`)}&forms=D`;
  const res = await secFetch(url, fetchImpl);
  if (!res.ok) throw new Error(`EDGAR full-text search HTTP ${res.status}`);
  const body = (await res.json()) as { hits?: { hits?: { _id: string; _source: any }[] } };
  return (body.hits?.hits ?? []).map((h) => ({
    adsh: h._source.adsh ?? h._id.split(':')[0],
    cik: String(h._source.ciks?.[0] ?? '').replace(/^0+/, ''),
    entityName: String(h._source.display_names?.[0] ?? '').replace(/\s*\(CIK \d+\)\s*$/, '').replace(/\s*\([A-Z, ]+\)\s*$/, '').trim(),
    form: h._source.form ?? h._source.root_forms?.[0] ?? 'D',
    fileDate: h._source.file_date,
    bizLocations: h._source.biz_locations ?? [],
  }));
}

const FUND_LIKE = /\b(fund|spv|l\.?p\.?|a series of|partners|capital|ventures|holdings|trust|reit)\b/i;
const OK_SUFFIXES = ['technologies', 'technology', 'software', 'labs', 'ai', 'app', 'hq', 'io', 'legal', 'law', 'systems', 'platform'];

/**
 * Record linkage: is this EDGAR entity the same company? Conservative by design — a false
 * funding round is worse than a missing one. Fund/SPV vehicles are always rejected.
 */
export function matchEntity(
  companyName: string,
  website: string | null,
  entityName: string,
): FormDRecord['matchMethod'] | null {
  if (FUND_LIKE.test(entityName)) return null;
  const company = normalizeName(companyName);
  const entity = normalizeName(entityName);
  if (!company || !entity) return null;
  if (company === entity) return 'exact_name';
  if (entity.startsWith(`${company} `)) {
    const rest = entity.slice(company.length + 1).split(' ');
    if (rest.length === 1 && OK_SUFFIXES.includes(rest[0])) return 'name_with_suffix';
  }
  const host = hostnameOf(website);
  if (host) {
    const stem = host.split('.')[0].replace(/[^a-z0-9]/g, '');
    if (stem.length >= 5 && stem === entity.replace(/ /g, '')) return 'domain_stem';
  }
  return null;
}

/**
 * Date plausibility: a filing made long before the company joined YC, or by an entity
 * incorporated long before, is almost always a different company with the same name.
 */
export function plausibleFiling(f: { filingDate: string; yearOfInc: number | null }, batchYear?: number | null): boolean {
  if (!batchYear) return true;
  if (Number(f.filingDate.slice(0, 4)) < batchYear - 4) return false;
  if (f.yearOfInc && f.yearOfInc < batchYear - 6) return false;
  return true;
}

const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true });

function num(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null; // "Indefinite" -> null
}

export function parseFormDXml(xml: string): Omit<FormDRecord, 'companySlug' | 'matchMethod' | 'url' | 'indexUrl' | 'retrievedAt' | 'filingDate' | 'accessionNumber'> {
  const doc = parser.parse(xml)?.edgarSubmission;
  if (!doc) throw new Error('Not a Form D primary document');
  const issuer = doc.primaryIssuer ?? {};
  const offering = doc.offeringData ?? {};
  const amend = offering.typeOfFiling?.newOrAmendment ?? {};
  const firstSale = offering.typeOfFiling?.dateOfFirstSale?.value;
  return {
    cik: String(issuer.cik ?? '').replace(/^0+/, ''),
    entityName: String(issuer.entityName ?? '').trim(),
    form: String(doc.submissionType ?? 'D') === 'D/A' ? 'D/A' : 'D',
    dateOfFirstSale: /^\d{4}-\d{2}-\d{2}$/.test(String(firstSale ?? '')) ? String(firstSale) : null,
    totalOfferingAmount: num(offering.offeringSalesAmounts?.totalOfferingAmount),
    totalAmountSold: num(offering.offeringSalesAmounts?.totalAmountSold),
    totalNumberAlreadyInvested: num(offering.investors?.totalNumberAlreadyInvested),
    industryGroup: offering.industryGroup?.industryGroupType ?? null,
    isEquity: String(offering.typesOfSecuritiesOffered?.isEquityType ?? '') === 'true',
    previousAccessionNumber: amend.previousAccessionNumber ? String(amend.previousAccessionNumber) : null,
    yearOfInc: num(issuer.yearOfInc?.value),
    issuerCity: issuer.issuerAddress?.city ?? null,
    issuerState: issuer.issuerAddress?.stateOrCountry ?? null,
  };
}

export function filingUrls(cik: string, accession: string) {
  const folder = `${ARCHIVES}/${Number(cik)}/${accession.replace(/-/g, '')}`;
  return { url: `${folder}/primary_doc.xml`, indexUrl: `${folder}/${accession}-index.htm` };
}

export interface FormDTarget {
  slug: string;
  name: string;
  website: string | null;
  /** Other names to search for (e.g. legal names seen elsewhere). */
  aliases?: string[];
  /** Year the company joined YC (if known), for date plausibility checks. */
  batchYear?: number | null;
  /** CIKs an analyst rejected for this company. */
  rejectedCiks?: string[];
}

export async function collectFormDForCompany(target: FormDTarget, fetchImpl: typeof fetch = fetch): Promise<FormDRecord[]> {
  const names = [...new Set([target.name, ...(target.aliases ?? [])])];
  const seen = new Set<string>();
  const out: FormDRecord[] = [];
  for (const name of names) {
    const hits = await searchFormD(name, fetchImpl);
    for (const hit of hits) {
      if (seen.has(hit.adsh)) continue;
      seen.add(hit.adsh);
      const matchMethod = matchEntity(target.name, target.website, hit.entityName);
      if (!matchMethod) continue;
      const { url, indexUrl } = filingUrls(hit.cik, hit.adsh);
      const res = await secFetch(url, fetchImpl);
      if (!res.ok) {
        throw new Error(
          `SEC returned HTTP ${res.status} for ${hit.adsh}${res.status === 403 ? ' (SEC requires SEC_USER_AGENT with a contact email)' : ''}`,
        );
      }
      const parsed = parseFormDXml(await res.text());
      if (target.rejectedCiks?.includes(parsed.cik)) continue;
      if (!plausibleFiling({ filingDate: hit.fileDate, yearOfInc: parsed.yearOfInc }, target.batchYear)) continue;
      out.push({
        ...parsed,
        companySlug: target.slug,
        matchMethod,
        accessionNumber: hit.adsh,
        filingDate: hit.fileDate,
        url,
        indexUrl,
        retrievedAt: new Date().toISOString(),
      });
    }
  }
  return out;
}

export async function runFormDConnector(
  ctx: ConnectorContext,
  targets: FormDTarget[],
  fetchImpl: typeof fetch = fetch,
): Promise<{ fetched: number; published: number; errors: number }> {
  let published = 0;
  let errors = 0;
  for (const t of targets) {
    try {
      const filings = await collectFormDForCompany(t, fetchImpl);
      for (const f of filings) {
        // Key by issuer so all filings for one company are ordered on one partition.
        await ctx.publish({ connector: 'sec_form_d', key: `sec:${f.cik}:${f.accessionNumber}`, data: f });
        published++;
      }
    } catch (err) {
      errors++;
      ctx.warn(`${t.slug}: ${(err as Error).message}`, { company: t.slug });
    }
  }
  ctx.log('form d connector finished', { targets: targets.length, published, errors });
  return { fetched: targets.length, published, errors };
}
