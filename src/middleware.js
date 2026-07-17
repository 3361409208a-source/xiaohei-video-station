import { NextResponse } from 'next/server';
import { INVITE_COOKIE, isInviteExemptPath } from '@/utils/inviteGate';

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (isInviteExemptPath(pathname)) {
    return NextResponse.next();
  }

  let inviteEnabled = false;
  try {
    const statusUrl = new URL('/api/invite/status', request.url);
    const res = await fetch(statusUrl, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      inviteEnabled = Boolean(data.enabled);
    }
  } catch {
    return NextResponse.next();
  }

  if (!inviteEnabled) {
    return NextResponse.next();
  }

  const hasInvite = request.cookies.get(INVITE_COOKIE)?.value === '1';
  if (hasInvite) {
    return NextResponse.next();
  }

  const gateUrl = request.nextUrl.clone();
  gateUrl.pathname = '/gate';
  const nextPath = pathname + request.nextUrl.search;
  if (nextPath && nextPath !== '/gate') {
    gateUrl.searchParams.set('next', nextPath);
  }
  return NextResponse.redirect(gateUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
