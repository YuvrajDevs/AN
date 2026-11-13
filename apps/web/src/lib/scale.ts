/** Round a maximum up to a readable axis top: 1, 2, 2.5 or 5 times a power of ten. */
export function niceMax(max: number): number {
  if (!(max > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= max) return m * p;
  return 10 * p;
}

/** Scale labels must fit a narrow column: use the chart's own format when short ("$500M"), else a bare compact number. */
export function axisLabel(v: number, format: (v: number) => string): string {
  const f = format(v);
  if (f.length <= 6) return f;
  return v >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${+(v / 1e3).toFixed(1)}K` : String(+v.toFixed(1));
}
