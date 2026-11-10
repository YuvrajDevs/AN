'use client';

import useSWR, { type SWRConfiguration } from 'swr';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function parse(res: Response) {
  if (res.status === 204) return null;
  const text = await res.text();
  // A proxy in front of the API (e.g. during a cold start) can answer with HTML; keep the status.
  let body: { error?: { message?: string; code?: string; details?: unknown } } | null = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    if (res.ok) throw new ApiError(502, 'The server sent an unexpected response');
  }
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }
    throw new ApiError(res.status, body?.error?.message ?? (res.statusText || 'Request failed'), body?.error?.code, body?.error?.details);
  }
  return body;
}

/** True for failures worth retrying: network errors and 5xx (cold start, restart, proxy timeout). */
export function isTransient(err: unknown) {
  return !(err instanceof ApiError) || err.status >= 500;
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...rest,
    headers: { accept: 'application/json', ...(json !== undefined ? { 'content-type': 'application/json' } : {}), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  return parse(res) as Promise<T>;
}

export function useApi<T>(path: string | null, config?: SWRConfiguration<T>) {
  return useSWR<T>(path, (p: string) => api<T>(p), { revalidateOnFocus: false, keepPreviousData: true, ...config });
}

export function qs(params: Record<string, string | number | boolean | undefined | null | string[]>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    sp.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}
