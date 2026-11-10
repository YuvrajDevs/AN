export type Role = 'viewer' | 'analyst' | 'admin';
export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Classification {
  sectorSlug: string | null;
  subsectorSlug: string | null;
  confidence: number | null;
  state: 'unclassified' | 'auto' | 'pending_review' | 'reviewed';
  provider: string | null;
  model: string | null;
  rationale: string;
  classifiedAt: string | null;
}

export interface CompanyListItem {
  _id: string;
  slug: string;
  name: string;
  oneLiner: string;
  logoUrl: string | null;
  website: string | null;
  status: 'active' | 'acquired' | 'inactive' | 'public';
  teamSize: number | null;
  ycBatch: string | null;
  hq?: { country: string | null; city?: string | null };
  trackedSectors: string[];
  classification: Classification;
  metrics: { totalRaisedUsd: number; roundCount: number; lastRoundDate: string | null; lastRoundAmountUsd: number | null };
  notable: boolean;
}

export interface Company extends CompanyListItem {
  description: string;
  tags: string[];
  legalNames: string[];
  externalIds: { yc: string | null; secCiks: string[]; github: string | null };
  hq: { city: string | null; region: string | null; country: string | null };
}

export interface FundingRound {
  _id: string;
  date: string;
  roundType: string;
  amountUsd: number | null;
  targetAmountUsd: number | null;
  investors: string[];
  sourceIds: string[];
  extractedBy: string;
  confidence: number;
  notes: string;
}

export interface Source {
  _id: string;
  kind: string;
  url: string;
  title: string;
  publisher: string;
  publishedAt: string | null;
  excerpt: string;
}

export interface TaxonomyNode {
  slug: string;
  name: string;
  description: string;
  keywords: string[];
  parentSlug: string | null;
  tracked: boolean;
  sourceTags: string[];
  color: string | null;
  companyCount: number;
  children: TaxonomyNode[];
}

export interface ReviewItem {
  _id: string;
  sectorSlug: string;
  subsectorSlug: string | null;
  confidence: number;
  rationale: string;
  alternatives: { subsectorSlug: string; confidence: number }[];
  provider: string;
  model: string;
  company: Pick<Company, '_id' | 'slug' | 'name' | 'oneLiner' | 'description' | 'tags' | 'website' | 'logoUrl' | 'ycBatch'>;
}
