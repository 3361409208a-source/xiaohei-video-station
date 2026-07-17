import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
const INVITE_COOKIE = 'xh_invite_ok';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export async function POST(request) {
  try {
    const body = await request.json();
    const response = await fetch(`${API_URL}/api/invite/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    });
    const data = await response.json();

    if (data.ok) {
      const res = NextResponse.json(data);
      res.cookies.set(INVITE_COOKIE, '1', {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
      });
      return res;
    }

    return NextResponse.json(data, { status: 403 });
  } catch {
    return NextResponse.json({ ok: false, message: '验证服务暂不可用，请稍后重试' }, { status: 503 });
  }
}
