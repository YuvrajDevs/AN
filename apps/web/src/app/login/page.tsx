'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api(`/auth/${mode}`, { method: 'POST', json: mode === 'login' ? { email, password } : { email, password, name } });
      const next = params.get('next');
      // Only allow same-site relative redirects (no open redirect).
      router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-sm font-bold text-accent-fg" aria-hidden="true">
            S
          </div>
          <div>
            <div className="text-base font-semibold">Strata</div>
            <div className="text-xs text-subtle">Startup &amp; sector intelligence</div>
          </div>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-6" noValidate>
          <h1 className="text-lg font-semibold">{mode === 'login' ? 'Sign in' : 'Create an account'}</h1>
          {mode === 'register' && (
            <div>
              <label htmlFor="name" className="label">
                Name
              </label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
            </div>
          )}
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus required />
          </div>
          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={8}
              required
            />
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" className="w-full" loading={loading}>
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
          <p className="text-center text-xs text-subtle">
            {mode === 'login' ? 'New here? ' : 'Have an account? '}
            <button type="button" className="font-medium text-accent hover:underline" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </form>
        <p className="mt-4 text-center text-xs text-subtle">
          Local demo: <span className="font-mono">analyst@strata.local</span> / <span className="font-mono">strata-demo-2026</span>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
