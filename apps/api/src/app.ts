import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { ZodError } from 'zod';
import { config } from './config';
import { logger } from './logger';
import { HttpError } from './lib/errors';
import { authenticate, requireAuth } from './security/auth';
import { apiLimiter } from './security/rateLimit';
import { BlockedUrlError } from './security/safeFetch';
import { LlmError } from './ai/types';
import { authRouter } from './routes/auth';
import { companiesRouter } from './routes/companies';
import { fundingRouter } from './routes/funding';
import { sectorsRouter } from './routes/sectors';
import { reviewRouter } from './routes/review';
import { alertsRouter, watchlistsRouter } from './routes/watchlists';
import { briefsRouter } from './routes/briefs';
import { askRouter } from './routes/ask';
import { ingestRouter, metaRouter, usersRouter } from './routes/admin';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY_HOPS); // hops whose X-Forwarded-For we trust (see TRUST_PROXY_HOPS)

  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } }));
  app.use(
    cors({
      origin: config.CORS_ORIGINS.split(',').map((o) => o.trim()),
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    }),
  );
  if (config.NODE_ENV !== 'test') app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(authenticate);

  // CSRF defence-in-depth: state-changing requests must be JSON (a cross-site HTML form
  // cannot send application/json without a CORS preflight, which we refuse).
  app.use((req, res, next) => {
    if (['POST', 'PATCH', 'PUT'].includes(req.method) && req.headers['content-length'] !== '0' && !req.is('application/json') && req.body && Object.keys(req.body).length) {
      res.status(415).json({ error: { code: 'unsupported_media_type', message: 'Use application/json' } });
      return;
    }
    next();
  });

  const api = express.Router();
  api.use(apiLimiter());
  api.use('/', metaRouter); // /health is public
  api.use('/auth', authRouter);
  // Everything below requires a signed-in user; write routes additionally check roles.
  api.use('/companies', requireAuth, companiesRouter);
  api.use('/funding', requireAuth, fundingRouter);
  api.use('/sectors', requireAuth, sectorsRouter);
  api.use('/review', requireAuth, reviewRouter);
  api.use('/watchlists', requireAuth, watchlistsRouter);
  api.use('/alerts', requireAuth, alertsRouter);
  api.use('/briefs', requireAuth, briefsRouter);
  api.use('/ask', requireAuth, askRouter);
  api.use('/ingest', requireAuth, ingestRouter);
  api.use('/users', requireAuth, usersRouter);
  app.use('/api', api);

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } });
  });

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
      return;
    }
    if (err instanceof ZodError) {
      res.status(400).json({ error: { code: 'bad_request', message: 'Validation failed', details: err.issues } });
      return;
    }
    if (err instanceof LlmError) {
      // The model provider failed (bad model id, quota, outage). Say which, never leak the raw body.
      logger.warn({ err: err.message, provider: err.provider, path: req.path }, 'llm provider error');
      res.status(502).json({ error: { code: 'llm_unavailable', message: `The ${err.provider} model is unavailable right now. Try again, or pick another provider.` } });
      return;
    }
    if (err instanceof BlockedUrlError) {
      res.status(400).json({ error: { code: 'blocked_url', message: err.message } });
      return;
    }
    if ((err as { type?: string }).type === 'entity.parse.failed') {
      res.status(400).json({ error: { code: 'bad_request', message: 'Malformed JSON' } });
      return;
    }
    if ((err as { type?: string }).type === 'entity.too.large') {
      res.status(413).json({ error: { code: 'payload_too_large', message: 'Request body too large' } });
      return;
    }
    if ((err as { name?: string }).name === 'CastError') {
      res.status(400).json({ error: { code: 'bad_request', message: 'Invalid identifier' } });
      return;
    }
    logger.error({ err, path: req.path }, 'unhandled error');
    // Never leak stack traces or internal messages to clients.
    res.status(500).json({ error: { code: 'internal', message: 'Something went wrong' } });
  });

  return app;
}
