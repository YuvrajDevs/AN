'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Blob } from '@/components/decor';
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

  useEffect(() => submitRef.current?.focus(), []);

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
      await api('/auth/login', { method: 'POST', json: { email, password } });
      const next = params.get('next');
      // Only allow same-site relative redirects (no open redirect).
      router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server');
      setLoading(false);
    } finally {
      clearTimeout(t);
      setSlow(false);
    }
  }

  return (
    <div className="grid min-h-screen gap-3 p-3 lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col overflow-hidden rounded-[32px] bg-ink p-10 text-white lg:flex">
        <Blob shape="star" className="-right-16 -top-16 h-72 w-72 !opacity-100 [&_path]:fill-[rgb(var(--pink))]" />
        <Blob shape="circle" className="-bottom-20 left-24 h-56 w-56 !bg-yellow !opacity-100" />
        <Blob shape="plus" className="bottom-10 right-10 h-24 w-24 !opacity-100 [&_path]:fill-[rgb(var(--sky))]" />
        <Link href="/" className="relative w-fit">
          <Wordmark />
        </Link>
        <div className="relative mt-auto max-w-md pb-24">
          <h2 className="text-[40px] font-semibold leading-[1.05] tracking-tight">Every number, traced to its source.</h2>
          <p className="mt-4 text-sm leading-relaxed text-white/75">
            465 startups across Legal AI, Climate Tech and Payments, with funding from SEC Form D filings and LLM sector labels checked by people.
          </p>
        </div>
      </aside>

      <main className="flex items-center justify-center px-2 py-10">
        <div className="w-full max-w-[400px]">
          <Link href="/" className="mb-10 inline-flex items-center gap-1.5 text-xs font-medium text-subtle hover:text-fg">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to overview
          </Link>
          <div className="mb-8 lg:hidden">
            <Wordmark />
          </div>
          <h1 className="text-[32px] font-semibold leading-tight tracking-tight">Sign in</h1>
          <p className="mt-2 text-sm text-subtle">The demo account is filled in. Pick a role and press sign in.</p>

          <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
            <fieldset>
              <legend className="label">Demo role</legend>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(DEMO) as Role[]).map((r) => (
                  <label
                    key={r}
                    className={cx(
                      'cursor-pointer rounded-2xl border p-3 transition-colors',
                      role === r ? 'border-transparent bg-pink text-ink' : 'border-border bg-surface hover:border-fg/30',
                    )}
                  >
                    <input type="radio" name="role" value={r} checked={role === r} onChange={() => pick(r)} className="sr-only" />
                    <span className="block text-sm font-semibold">{DEMO[r].label}</span>
                    <span className={cx('mt-0.5 block text-[11px] leading-snug', role === r ? 'text-ink/75' : 'text-subtle')}>{DEMO[r].blurb}</span>
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
              <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-2.5 text-sm text-danger">
                {error}
              </p>
            )}
            <Button ref={submitRef} type="submit" variant="primary" className="h-12 w-full text-[15px]" loading={loading}>
              Sign in {!loading && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            </Button>
            <p className="min-h-[1.25rem] text-center text-xs text-subtle" aria-live="polite">
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
