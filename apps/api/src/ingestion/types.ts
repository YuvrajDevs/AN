/** A raw record as published to the ingest topic. Connectors never write to MongoDB directly. */
export type RawRecord =
  | { connector: 'yc'; key: string; data: YcCompanyRecord }
  | { connector: 'sec_form_d'; key: string; data: FormDRecord }
  | { connector: 'rss'; key: string; data: RssItemRecord }
  | { connector: 'github'; key: string; data: GithubOrgRecord };

export interface YcCompanyRecord {
  ycId: string;
  slug: string;
  name: string;
  website: string | null;
  oneLiner: string;
  description: string;
  logoUrl: string | null;
  teamSize: number | null;
  status: 'active' | 'acquired' | 'inactive' | 'public';
  batch: string | null;
  batchDate: string | null;
  location: string | null;
  tags: string[];
  industries: string[];
  /** Tracked sector slugs whose sourceTags matched this company. */
  sectors: string[];
  profileUrl: string;
  retrievedAt: string;
}

export interface FormDRecord {
  /** Strata company slug this filing was linked to. */
  companySlug: string;
  /** How the filing was linked: exact normalised name, name+suffix, or website stem. */
  matchMethod: 'exact_name' | 'name_with_suffix' | 'domain_stem';
  cik: string;
  entityName: string;
  accessionNumber: string;
  form: 'D' | 'D/A';
  filingDate: string;
  dateOfFirstSale: string | null;
  totalOfferingAmount: number | null;
  totalAmountSold: number | null;
  totalNumberAlreadyInvested: number | null;
  industryGroup: string | null;
  isEquity: boolean;
  previousAccessionNumber: string | null;
  yearOfInc: number | null;
  issuerCity: string | null;
  issuerState: string | null;
  url: string;
  indexUrl: string;
  retrievedAt: string;
}

export interface RssItemRecord {
  feedUrl: string;
  title: string;
  link: string;
  publishedAt: string | null;
  summary: string;
  /** Optional hint: the company whose feed this is. */
  companySlug: string | null;
}

export interface GithubOrgRecord {
  companySlug: string;
  org: string;
  publicRepos: number;
  totalStars: number;
  topRepos: { name: string; stars: number }[];
  url: string;
  retrievedAt: string;
}

export interface ConnectorContext {
  publish: (record: RawRecord) => Promise<void>;
  log: (msg: string, extra?: Record<string, unknown>) => void;
}
