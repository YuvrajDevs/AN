import { NextResponse, type NextRequest } from 'next/server';

/**
 * The landing page (/) and /login are public. Everything else redirects signed-out
 * visitors to /login. The API still authorises every request itself.
 */
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === '/') return NextResponse.next();
  const hasSession = req.cookies.has('strata_session');
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!login|api|_next|favicon.ico|icon.svg|robots.txt).*)'],
};
