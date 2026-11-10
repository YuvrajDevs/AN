'use client';

import { useEffect } from 'react';

/**
 * The free API host sleeps when idle. Pinging the health check as soon as a public page
 * loads starts the wake-up while the visitor is still reading, so sign-in is usually instant.
 */
export function WarmApi() {
  useEffect(() => {
    fetch('/api/health', { cache: 'no-store' }).catch(() => undefined);
  }, []);
  return null;
}
