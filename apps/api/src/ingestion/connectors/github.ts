import { config } from '../../config';
import type { ConnectorContext, GithubOrgRecord } from '../types';

/**
 * GitHub organisation traction signal (public repos + stars). Uses the REST API;
 * GITHUB_TOKEN is optional (raises the rate limit from 60 to 5,000 requests/hour).
 */
export async function fetchGithubOrg(org: string, fetchImpl: typeof fetch = fetch): Promise<Omit<GithubOrgRecord, 'companySlug'>> {
  if (!/^[A-Za-z0-9-]{1,39}$/.test(org)) throw new Error('Invalid GitHub org name');
  const headers: Record<string, string> = { accept: 'application/vnd.github+json', 'user-agent': 'strata-ingest' };
  if (config.GITHUB_TOKEN) headers.authorization = `Bearer ${config.GITHUB_TOKEN}`;
  const res = await fetchImpl(`https://api.github.com/orgs/${org}/repos?per_page=100&type=public&sort=updated`, { headers });
  if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`);
  const repos = (await res.json()) as { name: string; stargazers_count: number; fork: boolean }[];
  const own = repos.filter((r) => !r.fork);
  const top = [...own].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 5);
  return {
    org,
    publicRepos: own.length,
    totalStars: own.reduce((s, r) => s + r.stargazers_count, 0),
    topRepos: top.map((r) => ({ name: r.name, stars: r.stargazers_count })),
    url: `https://github.com/${org}`,
    retrievedAt: new Date().toISOString(),
  };
}

export async function runGithubConnector(
  ctx: ConnectorContext,
  targets: { companySlug: string; org: string }[],
  fetchImpl: typeof fetch = fetch,
) {
  let published = 0;
  let errors = 0;
  for (const t of targets) {
    try {
      const data = await fetchGithubOrg(t.org, fetchImpl);
      await ctx.publish({ connector: 'github', key: `github:${t.org.toLowerCase()}`, data: { ...data, companySlug: t.companySlug } });
      published++;
    } catch (err) {
      errors++;
      ctx.warn(`${t.org}: ${(err as Error).message}`, { org: t.org });
    }
  }
  return { fetched: targets.length, published, errors };
}
