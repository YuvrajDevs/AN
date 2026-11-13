export function usd(n?: number | null, empty = '—'): string {
  if (n === null || n === undefined || n === 0) return empty;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${n}`;
}

export function date(d?: string | Date | null, opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { timeZone: 'UTC', ...opts });
}

export function relative(d?: string | null) {
  if (!d) return '';
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return date(d);
}

export const ROUND_LABELS: Record<string, string> = {
  pre_seed: 'Pre-seed',
  seed: 'Seed',
  series_a: 'Series A',
  series_b: 'Series B',
  series_c: 'Series C',
  series_d_plus: 'Series D+',
  growth: 'Growth',
  accelerator: 'Accelerator',
  debt: 'Debt',
  grant: 'Grant',
  reg_d_offering: 'Reg D offering',
  undisclosed: 'Undisclosed',
};

export const SOURCE_LABELS: Record<string, string> = {
  sec_form_d: 'SEC Form D',
  yc_directory: 'YC directory',
  press_release: 'Press release',
  rss: 'RSS',
  github: 'GitHub',
  dataset: 'Dataset snapshot',
  manual: 'Analyst entry',
};

export function pct(n?: number | null) {
  if (n === null || n === undefined) return '—';
  return `${Math.round(n * 100)}%`;
}

/** Where a round's facts came from, in words an analyst recognises (the stored value is a pipeline id). */
const EXTRACTOR_LABELS: Record<string, string> = {
  'sec-form-d-parser': 'SEC Form D',
  'yc-directory': 'YC directory',
};
export function sourceLabel(extractedBy: string): string {
  if (EXTRACTOR_LABELS[extractedBy]) return EXTRACTOR_LABELS[extractedBy];
  if (extractedBy.startsWith('manual')) return 'Analyst entry';
  if (extractedBy.startsWith('llm:')) return 'Press (AI-extracted)';
  return 'Other source';
}
