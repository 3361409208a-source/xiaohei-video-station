import { NextResponse } from 'next/server';
import { readLocalSiteConfig } from '@/utils/localConfig';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export async function GET() {
  const local = readLocalSiteConfig();
  const localInvite = local.invite || {};

  if (!localInvite.enabled) {
    return NextResponse.json({
      enabled: false,
      message: localInvite.message || '本站现已开启邀请访问，请输入邀请码进入',
    });
  }

  try {
    const response = await fetch(`${API_URL}/api/invite/status`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(1500),
    });
    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        enabled: Boolean(data.enabled),
        message: data.message || localInvite.message || '本站现已开启邀请访问，请输入邀请码进入',
      });
    }
  } catch {
    // fall through
  }

  return NextResponse.json({
    enabled: Boolean(localInvite.enabled),
    message: localInvite.message || '本站现已开启邀请访问，请输入邀请码进入',
  });
}
