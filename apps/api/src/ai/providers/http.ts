import { config } from '../../config';
import { LlmError, type ProviderName } from '../types';

/**
 * POST JSON to a fixed, first-party LLM endpoint with timeout and bounded retries on
 * 429/5xx. (These hosts are hard-coded, never user-supplied, so they do not need the
 * SSRF guard; API keys live only in server env and are never logged.)
 */
export async function postJson(
  provider: ProviderName,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  attempts = 3,
): Promise<any> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), config.LLM_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (res.ok) return await res.json();
      const text = (await res.text()).slice(0, 300);
      const retryable = res.status === 429 || res.status >= 500;
      lastErr = new LlmError(`${provider} HTTP ${res.status}: ${text}`, provider, retryable);
      if (!retryable) throw lastErr;
    } catch (err) {
      if (err instanceof LlmError && !err.retryable) throw err;
      lastErr = err;
      // A timeout means the model is slow, not flaky: retrying would only multiply the wait.
      if ((err as { name?: string })?.name === 'AbortError') {
        throw new LlmError(`${provider} timed out after ${Math.round(config.LLM_TIMEOUT_MS / 1000)}s`, provider, true);
      }
    } finally {
      clearTimeout(timer);
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** i));
  }
  throw lastErr instanceof LlmError ? lastErr : new LlmError(`${provider} request failed: ${String(lastErr)}`, provider, true);
}

/** Parse model text as JSON, tolerating a ```json fence. */
export function parseJsonText(provider: ProviderName, text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new LlmError(`${provider} returned non-JSON output`, provider);
  }
}
