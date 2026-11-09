import type { NextFunction, Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { z, type ZodTypeAny } from 'zod';
import { badRequest } from '../lib/errors';

/**
 * Validates and replaces req.body / req.query / req.params with the parsed value.
 * Parsed output only contains declared keys, so operator injection such as
 * `{"email": {"$gt": ""}}` never reaches Mongo (strings are required, unknown keys stripped).
 */
export function validate(schemas: { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny }) {
  return (req: Request, _res: Response, next: NextFunction) => {
    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) {
        return next(
          badRequest(
            'Validation failed',
            result.error.issues.map((i) => ({ path: [part, ...i.path].join('.'), message: i.message })),
          ),
        );
      }
      // Express 5 exposes req.query via a getter; define the parsed value on the request instead.
      Object.defineProperty(req, part, { value: result.data, writable: true, configurable: true, enumerable: true });
    }
    next();
  };
}

export const objectId = z.string().refine((v) => isValidObjectId(v) && /^[a-f0-9]{24}$/i.test(v), 'Invalid id');
export const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/, 'Invalid slug');
export const csvList = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : v.split(',')).map((s) => s.trim()).filter(Boolean))
  .pipe(z.array(z.string().max(80)).max(50));
