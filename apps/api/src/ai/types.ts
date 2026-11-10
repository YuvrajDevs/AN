import type { ZodType } from 'zod';

export type ProviderName = 'openai' | 'anthropic' | 'gemini' | 'heuristic' | 'mock';

export interface JsonRequest<T> {
  /** Stable instructions (cache-friendly: no timestamps or ids). */
  system: string;
  /** The variable part: the document / company / evidence pack. */
  user: string;
  /** JSON Schema sent to the provider's structured-output feature. */
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  /** Zod schema re-validates the provider output — we never trust it blindly. */
  zod: ZodType<T>;
  maxTokens?: number;
}

export interface LlmProvider {
  readonly name: ProviderName;
  readonly model: string;
  /** Returns validated JSON. Throws LlmError on transport, refusal or schema failure. */
  generateJson<T>(req: JsonRequest<T>): Promise<T>;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly provider: ProviderName,
    readonly retryable = false,
  ) {
    super(message);
  }
}

/** Input the classifier sees for one company. */
export interface CompanyForClassification {
  name: string;
  oneLiner?: string | null;
  description?: string | null;
  tags?: string[];
  website?: string | null;
}

export interface TaxonomyNodeForPrompt {
  slug: string;
  name: string;
  description: string;
  keywords: string[];
}

export interface ClassificationResult {
  /** null = no subsector fits (out of scope for this sector). */
  subsectorSlug: string | null;
  confidence: number;
  rationale: string;
  alternatives: { subsectorSlug: string; confidence: number }[];
}

export interface ExtractedRound {
  isFundingAnnouncement: boolean;
  companyName: string | null;
  amountUsd: number | null;
  roundType: string | null;
  investors: string[];
  announcedDate: string | null;
  /** Verbatim sentence from the document supporting the extraction. */
  evidenceQuote: string | null;
}
