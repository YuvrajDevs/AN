import { z } from 'zod';

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.string().default('info'),
  MONGO_URL: z.string().default('mongodb://localhost:27017/strata'),
  /** Empty → in-memory cache + rate limiting (single-process hosted demo). */
  REDIS_URL: z.string().optional().default(''),
  /** kafka | redis | memory — see docs/ARCHITECTURE.md ("Queue layer") */
  EVENT_BUS: z.enum(['kafka', 'redis', 'memory']).default('memory'),
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().default('strata'),
  /** Run ingestion consumers + job workers inside the API process (hosted demo mode). */
  INLINE_WORKER: bool.default(false),
  JWT_SECRET: z.string().min(16).default('dev-only-secret-change-me-please'),
  JWT_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 8),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  COOKIE_SECURE: bool.default(false),
  /** Allow self-service sign-up (new accounts are viewers). */
  ALLOW_SIGNUP: bool.default(true),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_PER_15M: z.coerce.number().int().positive().default(20),
  LLM_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(60),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  /** Provider used when a request does not name one. "heuristic" works with no API key. */
  LLM_DEFAULT_PROVIDER: z.enum(['openai', 'anthropic', 'gemini', 'heuristic']).default('heuristic'),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_MODEL: z.string().default('gpt-4.1-mini'),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-opus-5-5'),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  /** Classifications below this confidence go to the human review queue. */
  REVIEW_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.75),
  SEC_USER_AGENT: z.string().default(''),
  GITHUB_TOKEN: z.string().optional().default(''),
  /** Comma-separated hostnames exempt from the private-address block (local dev/tests only). */
  FETCH_ALLOW_HOSTS: z.string().default(''),
  /** Poll public sources on a schedule (worker only). */
  SCHEDULE_INGESTION: bool.default(false),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@strata.local'),
  SEED_ANALYST_EMAIL: z.string().email().default('analyst@strata.local'),
  SEED_PASSWORD: z.string().min(8).default('strata-demo-2026'),
});

export type Config = z.infer<typeof schema>;

function load(): Config {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // Fail fast with a readable message; never echo values (they may be secrets).
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid configuration: ${issues}`);
  }
  const cfg = parsed.data;
  if (cfg.NODE_ENV === 'production' && cfg.JWT_SECRET.startsWith('dev-only')) {
    throw new Error('JWT_SECRET must be set in production');
  }
  return cfg;
}

export const config: Config = load();

export function availableLlmProviders(): string[] {
  const list = ['heuristic'];
  if (config.OPENAI_API_KEY) list.push('openai');
  if (config.ANTHROPIC_API_KEY) list.push('anthropic');
  if (config.GEMINI_API_KEY) list.push('gemini');
  return list;
}
