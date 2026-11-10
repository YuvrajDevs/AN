import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config';
import { LlmError, type JsonRequest, type LlmProvider } from '../types';
import { parseJsonText, postJson } from './http';

function validated<T>(provider: LlmProvider, req: JsonRequest<T>, raw: unknown): T {
  const parsed = req.zod.safeParse(raw);
  if (!parsed.success) {
    throw new LlmError(`${provider.name} output failed schema validation: ${parsed.error.issues[0]?.message}`, provider.name);
  }
  return parsed.data;
}

/** OpenAI Chat Completions with strict JSON-schema structured output. */
export class OpenAIProvider implements LlmProvider {
  readonly name = 'openai' as const;
  constructor(
    private apiKey = config.OPENAI_API_KEY,
    readonly model = config.OPENAI_MODEL,
  ) {}

  async generateJson<T>(req: JsonRequest<T>): Promise<T> {
    const data = await postJson(
      this.name,
      'https://api.openai.com/v1/chat/completions',
      { authorization: `Bearer ${this.apiKey}` },
      {
        model: this.model,
        max_completion_tokens: req.maxTokens ?? 2000,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
        response_format: { type: 'json_schema', json_schema: { name: req.schemaName, schema: req.jsonSchema, strict: true } },
      },
    );
    const choice = data?.choices?.[0];
    if (choice?.message?.refusal) throw new LlmError('openai refused the request', this.name);
    return validated(this, req, parseJsonText(this.name, choice?.message?.content ?? ''));
  }
}

/** Anthropic Messages API (official SDK) with JSON-schema structured output. */
export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic' as const;
  private client: Anthropic;
  constructor(
    apiKey = config.ANTHROPIC_API_KEY,
    readonly model = config.ANTHROPIC_MODEL,
  ) {
    this.client = new Anthropic({ apiKey, timeout: config.LLM_TIMEOUT_MS, maxRetries: 2 });
  }

  async generateJson<T>(req: JsonRequest<T>): Promise<T> {
    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: req.maxTokens ?? 4000,
        system: req.system,
        messages: [{ role: 'user', content: req.user }],
        // Classification/extraction are simple, high-volume calls: low effort keeps cost down.
        output_config: { effort: 'low', format: { type: 'json_schema', schema: req.jsonSchema } },
      });
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) throw new LlmError('anthropic rate limited', this.name, true);
      if (err instanceof Anthropic.APIError) throw new LlmError(`anthropic API error ${err.status}`, this.name, (err.status ?? 0) >= 500);
      throw new LlmError(`anthropic request failed: ${(err as Error).message}`, this.name, true);
    }
    if (response.stop_reason === 'refusal') throw new LlmError('anthropic declined the request', this.name);
    if (response.stop_reason === 'max_tokens') throw new LlmError('anthropic output truncated (max_tokens)', this.name);
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return validated(this, req, parseJsonText(this.name, text));
  }
}

/** Google Gemini generateContent with a JSON response schema. */
export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini' as const;
  constructor(
    private apiKey = config.GEMINI_API_KEY,
    readonly model = config.GEMINI_MODEL,
  ) {}

  async generateJson<T>(req: JsonRequest<T>): Promise<T> {
    const data = await postJson(
      this.name,
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
      { 'x-goog-api-key': this.apiKey },
      {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: 'user', parts: [{ text: req.user }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: req.jsonSchema,
          // Thinking tokens count against this budget, so leave headroom above the answer size.
          maxOutputTokens: (req.maxTokens ?? 4000) + 4000,
          temperature: 0,
          ...(config.GEMINI_THINKING_LEVEL ? { thinkingConfig: { thinkingLevel: config.GEMINI_THINKING_LEVEL } } : {}),
        },
      },
    );
    const candidate = data?.candidates?.[0];
    if (!candidate || candidate.finishReason === 'SAFETY') throw new LlmError('gemini returned no usable candidate', this.name);
    const text = (candidate.content?.parts ?? []).filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text ?? '').join('');
    return validated(this, req, parseJsonText(this.name, text));
  }
}
