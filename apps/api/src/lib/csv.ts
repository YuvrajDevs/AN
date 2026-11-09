/**
 * RFC 4180 CSV encoding with formula-injection protection: text cells that begin
 * with = + - @ (or tab/CR) are prefixed with a single quote so spreadsheet apps
 * treat them as text (OWASP "CSV injection"). Plain negative numbers are left alone.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s: string;
  if (value instanceof Date) s = value.toISOString();
  else if (Array.isArray(value)) s = value.join('; ');
  else s = String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(',') + '\r\n';
}
