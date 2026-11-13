import { describe, expect, it } from 'vitest';
import { usd, sourceLabel } from '../src/lib/format';
import { firstPerKey, groupBy } from '../src/lib/group';
import { axisLabel, niceMax } from '../src/lib/scale';

describe('niceMax', () => {
  it.each([
    [0, 1],
    [-5, 1],
    [Number.NaN, 1],
    [1, 1],
    [7, 10],
    [18, 20],
    [21, 25],
    [442_000_000, 500_000_000],
    [1_000_000_000, 1_000_000_000],
  ])('rounds %d up to %d', (input, expected) => {
    expect(niceMax(input)).toBe(expected);
  });

  it('never returns less than the input', () => {
    for (let v = 1; v < 100_000; v = Math.ceil(v * 1.37)) expect(niceMax(v)).toBeGreaterThanOrEqual(v);
  });
});

describe('axisLabel', () => {
  it('keeps short formatted labels', () => {
    expect(axisLabel(500_000_000, (v) => usd(v))).toBe('$500M');
  });
  it('falls back to a compact number when the format is too long for the scale column', () => {
    expect(axisLabel(50, (v) => `${v} companies`)).toBe('50');
    expect(axisLabel(2_500, (v) => `${v} offerings`)).toBe('2.5K');
    expect(axisLabel(1_200_000, (v) => `${v} offerings`)).toBe('1.2M');
  });
});

describe('sourceLabel', () => {
  it.each([
    ['sec-form-d-parser', 'SEC Form D'],
    ['yc-directory', 'YC directory'],
    ['manual', 'Analyst entry'],
    ['manual:analyst@strata.local', 'Analyst entry'],
    ['llm:gemini', 'Press (AI-extracted)'],
    ['something-new', 'Other source'],
  ])('labels %s as %s', (id, label) => {
    expect(sourceLabel(id)).toBe(label);
  });
});

describe('firstPerKey', () => {
  const rounds = [
    { co: 'legora', d: 4 },
    { co: 'kalinda', d: 3 },
    { co: 'legora', d: 2 },
    { co: 'legora', d: 1 },
  ];
  it('keeps the first item per key and counts the rest', () => {
    expect(firstPerKey(rounds, (r) => r.co)).toEqual([
      { item: { co: 'legora', d: 4 }, more: 2 },
      { item: { co: 'kalinda', d: 3 }, more: 0 },
    ]);
  });
  it('applies the limit after grouping', () => {
    expect(firstPerKey(rounds, (r) => r.co, 1)).toHaveLength(1);
  });
});

describe('groupBy', () => {
  it('keeps same-named groups apart when their keys differ', () => {
    const items = [
      { id: 'a', name: 'Legal AI' },
      { id: 'b', name: 'Legal AI' },
      { id: 'a', name: 'Legal AI' },
    ];
    const groups = groupBy(items, (i) => i.id, (i) => i.name);
    expect(groups.map(([k, g]) => [k, g.items.length])).toEqual([
      ['a', 2],
      ['b', 1],
    ]);
  });
});
