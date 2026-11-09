'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, useApi } from '@/lib/api';
import { CommandPalette } from './CommandPalette';
import { useSession } from './session';
import { Kbd, cx } from './ui';

const NAV = [
  { href: '/', label: 'Dashboard', key: 'd' },
  { href: '/companies', label: 'Companies', key: 'c' },
  { href: '/funding', label: 'Funding', key: 'f' },
  { href: '/sectors', label: 'Sectors', key: 's' },
  { href: '/review', label: 'Review queue', key: 'r' },
  { href: '/watchlists', label: 'Watchlists', key: 'w' },
  { href: '/alerts', label: 'Alerts', key: 'a' },
  { href: '/briefs', label: 'Briefs', key: 'b' },
];

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useSession();
  const [palette, setPalette] = useState(false);
  const [menu, setMenu] = useState(false);
  const { data: unread } = useApi<{ unread: number }>('/alerts/unread-count', { refreshInterval: 60_000 });
  const { data: queue } = useApi<{ total: number }>('/review?limit=1');

  useEffect(() => {
    let leader = false;
    let timer: ReturnType<typeof setTimeout>;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') {
        e.preventDefault();
        setPalette(true);
        return;
      }
      // "g then <key>" navigation, like Gmail/GitHub.
      if (leader) {
        const item = NAV.find((n) => n.key === e.key);
        leader = false;
        if (item) router.push(item.href);
        return;
      }
      if (e.key === 'g') {
        leader = true;
        clearTimeout(timer);
        timer = setTimeout(() => (leader = false), 1000);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  useEffect(() => setMenu(false), [pathname]);

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    window.location.href = '/login';
  }

  const active = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          aria-current={active(n.href) ? 'page' : undefined}
          className={cx(
            'group flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm',
            active(n.href) ? 'bg-muted font-medium text-fg' : 'text-subtle hover:bg-muted hover:text-fg',
          )}
        >
          <span>{n.label}</span>
          <span className="flex items-center gap-1">
            {n.href === '/alerts' && !!unread?.unread && <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-fg">{unread.unread}</span>}
            {n.href === '/review' && !!queue?.total && <span className="rounded-full bg-warning/15 px-1.5 text-[10px] font-semibold text-warning">{queue.total}</span>}
            <span className="hidden text-[10px] text-subtle opacity-0 group-hover:opacity-100 lg:inline">g {n.key}</span>
          </span>
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[220px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-surface px-3 py-4 lg:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 px-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-xs font-bold text-accent-fg" aria-hidden="true">
            S
          </div>
          <span className="text-sm font-semibold">Strata</span>
        </Link>
        <button
          onClick={() => setPalette(true)}
          className="mb-4 flex h-8 items-center justify-between rounded-md border border-border bg-bg px-2.5 text-xs text-subtle hover:border-accent/50"
        >
          <span>Search…</span>
          <Kbd>⌘K</Kbd>
        </button>
        {nav}
        <div className="mt-auto border-t border-border pt-3">
          <div className="px-2 text-xs">
            <div className="truncate font-medium">{user?.name ?? '…'}</div>
            <div className="truncate text-subtle">
              {user?.email} · {user?.role}
            </div>
          </div>
          <button onClick={logout} className="mt-2 w-full rounded-md px-2 py-1.5 text-left text-xs text-subtle hover:bg-muted hover:text-fg">
            Sign out
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
        <button onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-controls="mobile-nav" className="rounded-md px-2 py-1 text-sm hover:bg-muted">
          ☰ Menu
        </button>
        <span className="text-sm font-semibold">Strata</span>
        <button onClick={() => setPalette(true)} className="rounded-md px-2 py-1 text-sm hover:bg-muted" aria-label="Search">
          ⌕
        </button>
      </header>
      {menu && (
        <div id="mobile-nav" className="border-b border-border bg-surface p-3 lg:hidden">
          {nav}
          <button onClick={logout} className="mt-2 w-full rounded-md px-2.5 py-1.5 text-left text-sm text-subtle hover:bg-muted">
            Sign out
          </button>
        </div>
      )}

      <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}
