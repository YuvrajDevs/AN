'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Bell,
  Bookmark,
  Building2,
  ClipboardCheck,
  FileText,
  Layers,
  LayoutGrid,
  LogOut,
  Menu,
  Search,
  Settings2,
  TrendingUp,
  X,
  type LucideIcon,
} from 'lucide-react';
import { api, useApi } from '@/lib/api';
import { CommandPalette } from './CommandPalette';
import { useSession } from './session';
import { Kbd, cx } from './ui';

interface NavItem {
  href: string;
  label: string;
  key: string;
  icon: LucideIcon;
}

const GENERAL: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', key: 'd', icon: LayoutGrid },
  { href: '/companies', label: 'Companies', key: 'c', icon: Building2 },
  { href: '/funding', label: 'Funding', key: 'f', icon: TrendingUp },
  { href: '/sectors', label: 'Sectors', key: 's', icon: Layers },
];
const TOOLS: NavItem[] = [
  { href: '/review', label: 'Review queue', key: 'r', icon: ClipboardCheck },
  { href: '/briefs', label: 'Briefs', key: 'b', icon: FileText },
  { href: '/watchlists', label: 'Watchlists', key: 'w', icon: Bookmark },
  { href: '/alerts', label: 'Alerts', key: 'a', icon: Bell },
];
const ADMIN: NavItem = { href: '/admin', label: 'Admin', key: 'x', icon: Settings2 };
const ALL = [...GENERAL, ...TOOLS, ADMIN];

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx('flex items-center gap-2 text-[22px] font-semibold tracking-tight', className)}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        <rect x="3" y="4" width="18" height="4" rx="2" fill="rgb(var(--pink))" />
        <rect x="3" y="10" width="13" height="4" rx="2" fill="rgb(var(--yellow))" />
        <rect x="3" y="16" width="8" height="4" rx="2" fill="rgb(var(--sky))" />
      </svg>
      strata
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useSession();
  const [palette, setPalette] = useState(false);
  const [menu, setMenu] = useState(false);
  const { data: unread } = useApi<{ unread: number }>('/alerts/unread-count', { refreshInterval: 60_000 });
  const { data: queue } = useApi<{ total: number }>('/review?limit=1');
  const tools = user?.role === 'admin' ? [...TOOLS, ADMIN] : TOOLS;

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
        const item = ALL.find((n) => n.key === e.key);
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
    window.location.href = '/';
  }

  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const count = (href: string) => (href === '/alerts' ? unread?.unread : href === '/review' ? queue?.total : 0) || 0;

  const group = (title: string, items: NavItem[]) => (
    <div>
      <div className="mb-2 px-3 text-[11px] font-medium text-white/55">{title}</div>
      <ul className="space-y-0.5">
        {items.map((n) => {
          const on = active(n.href);
          const Icon = n.icon;
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={on ? 'page' : undefined}
                className={cx(
                  'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] transition-colors',
                  on ? 'text-pink' : 'text-white/85 hover:bg-white/10 hover:text-white',
                )}
              >
                {on && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-pink" aria-hidden="true" />}
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span className="flex-1">{n.label}</span>
                {count(n.href) > 0 && (
                  <span className={cx('rounded-full px-1.5 text-[10px] font-semibold text-ink', n.href === '/review' ? 'bg-yellow' : 'bg-pink')}>{count(n.href)}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );

  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-6">
      {group('General', GENERAL)}
      {group('Tools', tools)}
    </nav>
  );

  const initials = (user?.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen p-0 lg:grid lg:grid-cols-[236px_1fr] lg:gap-6 lg:p-3">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-full focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>

      <aside className="sticky top-3 hidden h-[calc(100vh-24px)] flex-col rounded-3xl bg-ink px-3 pb-4 pt-6 text-white lg:flex">
        <Link href="/dashboard" className="mb-8 flex justify-center text-white">
          <Wordmark />
        </Link>
        {nav}
        <div className="mt-auto space-y-1 pt-4">
          <div className="flex items-center gap-2.5 rounded-2xl bg-white/[0.07] px-3 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow text-[11px] font-semibold text-ink">{initials}</span>
            <span className="min-w-0 text-xs">
              <span className="block truncate font-medium">{user?.name ?? '…'}</span>
              <span className="block truncate capitalize text-white/60">{user?.role}</span>
            </span>
          </div>
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] text-white/85 hover:bg-white/10 hover:text-white">
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
            Log out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-ink px-4 text-white lg:hidden">
        <button onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-controls="mobile-nav" className="flex items-center gap-1.5 rounded-full px-2 py-1 text-sm hover:bg-white/10">
          {menu ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />} Menu
        </button>
        <Wordmark className="text-lg" />
        <button onClick={() => setPalette(true)} className="flex items-center gap-1.5 rounded-full px-2 py-1 text-sm hover:bg-white/10">
          <Search className="h-4 w-4" aria-hidden="true" /> Search
        </button>
      </header>
      {menu && (
        <div id="mobile-nav" className="sticky top-14 z-30 bg-ink px-3 pb-4 pt-2 text-white lg:hidden">
          {nav}
          <button onClick={logout} className="mt-4 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-white/85 hover:bg-white/10">
            <LogOut className="h-4 w-4" aria-hidden="true" /> Log out
          </button>
        </div>
      )}

      <div className="min-w-0 px-4 pb-10 sm:px-6 lg:px-2 lg:pr-4">
        <div className="mb-6 hidden items-center gap-3 pt-3 lg:flex">
          <button
            onClick={() => setPalette(true)}
            className="flex h-11 min-w-0 max-w-xl flex-1 items-center gap-3 rounded-full border border-border bg-surface pl-1.5 pr-4 text-left text-sm text-subtle hover:border-fg/40"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pink text-ink" aria-hidden="true">
              <Search className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="flex-1 truncate">Search companies, sectors, briefs…</span>
            <Kbd>⌘K</Kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/alerts" aria-label={`Alerts${unread?.unread ? `, ${unread.unread} unread` : ''}`} className="relative flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white hover:bg-ink/85">
              <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
              {!!unread?.unread && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-bg bg-pink" aria-hidden="true" />}
            </Link>
            <Link href="/watchlists" aria-label="Watchlists" className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white hover:bg-ink/85">
              <Bookmark className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
            </Link>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow text-xs font-semibold text-ink" title={user ? `${user.name} · ${user.role}` : undefined}>
              {initials}
            </span>
          </div>
        </div>
        <main id="main" className="mx-auto w-full max-w-[1280px] pt-6 lg:pt-0">
          {children}
        </main>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}
