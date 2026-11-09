import { LlmError, type JsonRequest, type LlmProvider } from '../types';

/**
 * Deterministic, offline "provider". It does not generate free-form JSON; instead each
 * AI task (classify / extract / brief) has a rule-based implementation that is used when
 * this provider is selected. It lets the whole product run — and the eval run — with no
 * API key, and it is the baseline the LLM providers are measured against.
 */
export class HeuristicProvider implements LlmProvider {
  readonly name = 'heuristic' as const;
  readonly model = 'rules-v1';
  async generateJson<T>(_req: JsonRequest<T>): Promise<T> {
    throw new LlmError('heuristic provider has no free-form generation; call the task-specific implementation', this.name);
  }
}

/** Test double: returns queued responses in order. */
export class MockProvider implements LlmProvider {
  readonly name = 'mock' as const;
  readonly model = 'mock-1';
  readonly calls: JsonRequest<unknown>[] = [];
  constructor(private responses: unknown[] = []) {}
  queue(...r: unknown[]) {
    this.responses.push(...r);
  }
  async generateJson<T>(req: JsonRequest<T>): Promise<T> {
    this.calls.push(req as JsonRequest<unknown>);
    if (this.responses.length === 0) throw new LlmError('mock: no queued response', this.name);
    const next = this.responses.shift();
    if (next instanceof Error) throw next;
    const parsed = req.zod.safeParse(next);
    if (!parsed.success) throw new LlmError('mock output failed schema validation', this.name);
    return parsed.data;
  }
}
