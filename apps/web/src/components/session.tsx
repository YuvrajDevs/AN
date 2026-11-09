'use client';

import { createContext, useContext } from 'react';
import type { Role, User } from '@/lib/types';
import { useApi } from '@/lib/api';

const SessionCtx = createContext<{ user: User | null; loading: boolean }>({ user: null, loading: true });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useApi<{ user: User }>('/auth/me');
  return <SessionCtx.Provider value={{ user: data?.user ?? null, loading: isLoading }}>{children}</SessionCtx.Provider>;
}

export function useSession() {
  return useContext(SessionCtx);
}

const RANK: Record<Role, number> = { viewer: 0, analyst: 1, admin: 2 };
export function useCan(min: Role) {
  const { user } = useSession();
  return user ? RANK[user.role] >= RANK[min] : false;
}
