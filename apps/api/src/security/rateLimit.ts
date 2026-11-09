import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import type { Request } from 'express';
import { config } from '../config';
import { getRedis } from '../lib/redis';

function store(prefix: string): Partial<Options> {
  const redis = getRedis();
  if (!redis) return {}; // in-memory store (single process)
  return {
    store: new RedisStore({
      prefix: `rl:${prefix}:`,
      sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<RedisReply>,
    }),
  };
}

// Authenticated users are limited per account, anonymous clients per IP.
// ipKeyGenerator collapses IPv6 addresses to their /56 so one client cannot rotate addresses.
const ipKey = (req: Request) => `ip:${ipKeyGenerator(req.ip ?? '')}`;
const keyByUserOrIp = (req: Request) => (req.user ? `u:${req.user.id}` : ipKey(req));

const common: Partial<Options> = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many requests, please slow down.' } },
};

export const apiLimiter = () =>
  rateLimit({
    ...common,
    ...store('api'),
    windowMs: 60_000,
    limit: config.RATE_LIMIT_PER_MINUTE,
    keyGenerator: keyByUserOrIp,
    skip: () => config.NODE_ENV === 'test',
  });

/** Brute-force protection on login/sign-up: per IP, 15-minute window. */
export const authLimiter = () =>
  rateLimit({
    ...common,
    ...store('auth'),
    windowMs: 15 * 60_000,
    limit: config.AUTH_RATE_LIMIT_PER_15M,
    keyGenerator: ipKey,
    skipSuccessfulRequests: true,
  });

/** LLM calls cost money: a stricter hourly budget per user. */
export const llmLimiter = () =>
  rateLimit({
    ...common,
    ...store('llm'),
    windowMs: 60 * 60_000,
    limit: config.LLM_RATE_LIMIT_PER_HOUR,
    keyGenerator: keyByUserOrIp,
  });
