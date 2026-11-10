import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { forbidden, unauthorized } from '../lib/errors';
import type { Role } from '../models';

export const AUTH_COOKIE = 'strata_session';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

const ROLE_RANK: Record<Role, number> = { viewer: 0, analyst: 1, admin: 2 };

export function signToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name, role: user.role }, config.JWT_SECRET, {
    expiresIn: config.JWT_TTL_SECONDS,
    algorithm: 'HS256',
    issuer: 'strata',
  });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const p = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'], issuer: 'strata' }) as jwt.JwtPayload;
    if (!p.sub || !p.role) return null;
    return { id: String(p.sub), email: String(p.email), name: String(p.name), role: p.role as Role };
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true, // not readable from JS → XSS cannot steal the session
    sameSite: 'lax', // not sent on cross-site POSTs → CSRF protection together with JSON-only bodies
    secure: config.COOKIE_SECURE,
    maxAge: config.JWT_TTL_SECONDS * 1000,
    path: '/',
  });
}

/** Reads a session from the httpOnly cookie (browser) or an `Authorization: Bearer` header (API clients). */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : (req.cookies?.[AUTH_COOKIE] as string | undefined);
  if (token) {
    const user = verifyToken(token);
    if (user) req.user = user;
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  next();
}

export function requireRole(min: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (ROLE_RANK[req.user.role] < ROLE_RANK[min]) return next(forbidden(`Requires ${min} role`));
    next();
  };
}
