import { availableLlmProviders, config } from '../config';
import { badRequest } from '../lib/errors';
import { AnthropicProvider, GeminiProvider, OpenAIProvider } from './providers/llm';
import { HeuristicProvider } from './providers/heuristic';
import { LlmError, type LlmProvider, type ProviderName } from './types';

const cache = new Map<string, LlmProvider>();
let override: LlmProvider | null = null;

/** Tests inject a MockProvider here. */
export function setProviderOverride(p: LlmProvider | null) {
  override = p;
}

export function getProvider(name?: string | null): LlmProvider {
  if (override) return override;
  const wanted = (name || config.LLM_DEFAULT_PROVIDER) as ProviderName;
  if (!availableLlmProviders().includes(wanted)) {
    throw badRequest(`LLM provider "${wanted}" is not configured on this server`);
  }
  if (!cache.has(wanted)) {
    const p =
      wanted === 'openai'
        ? new OpenAIProvider()
        : wanted === 'anthropic'
          ? new AnthropicProvider()
          : wanted === 'gemini'
            ? new GeminiProvider()
            : new HeuristicProvider();
    cache.set(wanted, p);
  }
  return cache.get(wanted)!;
}

/**
 * Run an LLM task, and if the model provider fails (quota, outage) fall back to the offline
 * heuristic so the product keeps working. The caller records whichever provider answered,
 * so a fallback result is always labelled as heuristic, never passed off as the LLM.
 */
export async function withFallback<T>(provider: LlmProvider, task: (p: LlmProvider) => Promise<T>, allow = true): Promise<{ result: T; provider: LlmProvider }> {
  try {
    return { result: await task(provider), provider };
  } catch (err) {
    if (!allow || provider.name === 'heuristic' || override || !(err instanceof LlmError)) throw err;
    const heuristic = new HeuristicProvider();
    return { result: await task(heuristic), provider: heuristic };
  }
}

export function providerInfo() {
  return {
    default: config.LLM_DEFAULT_PROVIDER,
    available: availableLlmProviders(),
    models: {
      openai: config.OPENAI_MODEL,
      anthropic: config.ANTHROPIC_MODEL,
      gemini: config.GEMINI_MODEL,
      heuristic: 'rules-v1',
    },
  };
}
