import { NextResponse, type NextRequest } from 'next/server';

/** Redirect signed-out visitors to /login. The API still authorises every request itself. */
export function middleware(req: NextRequest) {
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
  matcher: ['/((?!login|api|_next|favicon.ico|robots.txt).*)'],
};
