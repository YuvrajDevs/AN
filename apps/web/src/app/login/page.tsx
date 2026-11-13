'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { api, ApiError, isTransient } from '@/lib/api';
import { Wordmark } from '@/components/AppShell';
import { Button, cx } from '@/components/ui';

/** Seeded demo accounts. The password is public: it is in the README and the seed. */
const DEMO = {
  analyst: { email: 'analyst@strata.local', label: 'Analyst', blurb: 'Review labels, edit the taxonomy, add rounds, generate briefs' },
  viewer: { email: 'viewer@strata.local', label: 'Viewer', blurb: 'Read-only: search, landscapes, export, watchlists' },
} as const;
const DEMO_PASSWORD = 'strata-demo-2026';
type Role = keyof typeof DEMO;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<Role>('analyst');
  const [email, setEmail] = useState<string>(DEMO.analyst.email);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    submitRef.current?.focus();
    fetch('/api/health', { cache: 'no-store' }).catch(() => undefined);
  }, []);

  function pick(r: Role) {
    setRole(r);
    setEmail(DEMO[r].email);
    setPassword(DEMO_PASSWORD);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // The free API host sleeps when idle; say so instead of looking stuck.
    const t = setTimeout(() => setSlow(true), 4000);
    try {
      // Retry through a cold start or restart of the free API host (up to ~90 s); never retry 4xx.
      const deadline = Date.now() + 90_000;
      for (;;) {
        try {
          await api('/auth/login', { method: 'POST', json: { email, password } });
          break;
        } catch (err) {
          if (!isTransient(err) || Date.now() > deadline) throw err;
          setSlow(true);
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
      const next = params.get('next');
      // Only allow same-site relative redirects (no open redirect).
      router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError && err.status < 500 ? err.message : 'The server did not respond. Please try again in a moment.');
      setLoading(false);
    } finally {
      clearTimeout(t);
      setSlow(false);
    }
  }

  return (
    <div className="grid min-h-screen gap-4 p-3 lg:grid-cols-[minmax(0,460px)_1fr]">
      <aside className="hidden flex-col justify-between rounded-2xl bg-ink p-8 text-white lg:flex">
        <Link href="/" className="w-fit">
          <Wordmark className="text-lg" />
        </Link>
        <div className="max-w-sm">
          <h2 className="text-display font-semibold leading-tight tracking-tight">Every number, traced to its source.</h2>
          <ul className="mt-5 space-y-2.5 text-body-sm text-white/80">
            {[
              '465 startups in Legal AI, Climate Tech and Payments',
              'Funding from 136 hand-checked SEC Form D filings',
              'LLM sector labels with a human review queue',
              'Briefs that drop any claim without a valid citation',
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-pink" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-micro text-white/50">Public data only: YC directory, SEC EDGAR, RSS, GitHub.</p>
      </aside>

      <main className="flex items-center justify-center px-2 py-10">
        <div className="w-full max-w-[400px]">
          <Link href="/" className="mb-8 inline-flex items-center gap-1.5 text-caption font-medium text-subtle hover:text-fg">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to overview
          </Link>
          <div className="mb-6 lg:hidden">
            <Wordmark className="text-lg" />
          </div>
          <h1 className="text-display font-semibold tracking-tight">Sign in</h1>
          <p className="mt-2 text-body text-subtle">The demo account is filled in. Pick a role and press sign in.</p>

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <fieldset>
              <legend className="label">Demo role</legend>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(DEMO) as Role[]).map((r) => (
                  <label
                    key={r}
                    className={cx(
                      'cursor-pointer rounded-xl border px-3 py-2.5 transition-colors',
                      role === r ? 'border-transparent bg-pink text-ink' : 'border-border bg-surface hover:border-fg/30',
                    )}
                  >
                    <input type="radio" name="role" value={r} checked={role === r} onChange={() => pick(r)} className="sr-only" />
                    <span className="block text-body font-semibold">{DEMO[r].label}</span>
                    <span className={cx('mt-0.5 block text-micro leading-snug', role === r ? 'text-ink/75' : 'text-subtle')}>{DEMO[r].blurb}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
            </div>
            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" minLength={8} required />
            </div>
            {error && (
              <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-body-sm text-danger">
                {error}
              </p>
            )}
            <Button ref={submitRef} type="submit" variant="primary" className="h-10 w-full" loading={loading}>
              Sign in {!loading && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            </Button>
            <p className="min-h-[1.25rem] text-center text-caption text-subtle" aria-live="polite">
              {slow ? 'Waking the free server. The first sign-in can take up to a minute…' : ''}
            </p>
          </form>
        </div>
      </main>
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
