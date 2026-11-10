import { availableLlmProviders, config } from '../config';
import { badRequest } from '../lib/errors';
import { AnthropicProvider, GeminiProvider, OpenAIProvider } from './providers/llm';
import { HeuristicProvider } from './providers/heuristic';
import type { LlmProvider, ProviderName } from './types';

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
