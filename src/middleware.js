import { NextResponse } from 'next/server';
import { INVITE_COOKIE, isInviteExemptPath } from '@/utils/inviteGate';

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (isInviteExemptPath(pathname)) {
    return NextResponse.next();
  }

  // 邀请码关闭时直接放行，避免每次翻页/切分类都走内部 fetch
  if (process.env.SITE_INVITE_GATE_ENABLED !== 'true') {
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
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
