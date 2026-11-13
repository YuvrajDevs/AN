/** One entry per key, in first-seen order, with how many later items shared that key. */
export function firstPerKey<T>(items: T[], key: (item: T) => string, limit = Infinity): { item: T; more: number }[] {
  const seen = new Map<string, { item: T; more: number }>();
  for (const item of items) {
    const k = key(item);
    const entry = seen.get(k);
    if (entry) entry.more += 1;
    else seen.set(k, { item, more: 0 });
  }
  return [...seen.values()].slice(0, limit);
}

/** Items grouped by key in first-seen order; each group keeps a display name. */
export function groupBy<T>(items: T[], key: (item: T) => string, name: (item: T) => string): [string, { name: string; items: T[] }][] {
  const groups = new Map<string, { name: string; items: T[] }>();
  for (const item of items) {
    const k = key(item);
    const group = groups.get(k) ?? { name: name(item), items: [] };
    group.items.push(item);
    groups.set(k, group);
  }
  return [...groups.entries()];
}
