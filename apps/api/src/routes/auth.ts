import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { conflict, forbidden, unauthorized } from '../lib/errors';
import { User } from '../models';
import { AUTH_COOKIE, requireAuth, setSessionCookie, signToken, type AuthUser } from '../security/auth';
import { authLimiter } from '../security/rateLimit';
import { validate } from '../security/validate';

export const authRouter = Router();
const limiter = authLimiter();

const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

function toAuthUser(u: { _id: unknown; email: string; name: string; role: string }): AuthUser {
  return { id: String(u._id), email: u.email, name: u.name, role: u.role as AuthUser['role'] };
}

authRouter.post('/register', limiter, validate({ body: credentials.extend({ name: z.string().trim().min(1).max(120) }) }), async (req, res) => {
  if (!config.ALLOW_SIGNUP) throw forbidden('Sign-up is disabled on this server');
  if (await User.exists({ email: req.body.email })) throw conflict('An account with that email already exists');
  const user = await User.create({
    email: req.body.email,
    name: req.body.name,
    passwordHash: await bcrypt.hash(req.body.password, 12),
    role: 'viewer', // privilege is granted by an admin, never self-assigned
  });
  const authUser = toAuthUser(user);
  setSessionCookie(res, signToken(authUser));
  res.status(201).json({ user: authUser });
});

authRouter.post('/login', limiter, validate({ body: credentials }), async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  // Same error and similar timing for unknown email vs wrong password (no account enumeration).
  const ok = await bcrypt.compare(req.body.password, user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
  if (!user || !ok) throw unauthorized('Invalid email or password');
  user.lastLoginAt = new Date();
  await user.save();
  const authUser = toAuthUser(user);
  const token = signToken(authUser);
  setSessionCookie(res, token);
  res.json({ user: authUser, token });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { path: '/' });
  res.status(204).end();
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
