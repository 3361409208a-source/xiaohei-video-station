import { NextResponse } from 'next/server';
import { DEFAULT_SITE_THEME } from '@/utils/siteTheme';
import { readLocalSiteConfig } from '@/utils/localConfig';

function buildFallbackConfig() {
  const local = readLocalSiteConfig();
  return {
    site_name: local.site_name || '🐾 小黑搜影',
    notice: local.notice || '📢 防骗提醒：正在播放的视频中若出现任何广告水印，请务必提高警惕，切勿转账或参与，守护好您的财产安全！',
    footer: local.footer || '© 2026 🐾 小黑搜影',
    theme: local.theme || DEFAULT_SITE_THEME,
    ads: local.ads || { enabled: false, slots: {} },
    private_traffic: local.private_traffic || {
      enabled: false,
      message: '',
      telegram_url: '',
      group_url: '',
      wechat_hint: '',
    },
    invite: local.invite || {
      enabled: false,
      message: '本站现已开启邀请访问，请输入邀请码进入',
    },
  };
}

export async function GET() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

  try {
    const response = await fetch(`${API_URL}/api/config`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) {
      return NextResponse.json(buildFallbackConfig());
    }
    const data = await response.json();
    return NextResponse.json({
      ...data,
      theme: data.theme || DEFAULT_SITE_THEME,
    });
  } catch {
    return NextResponse.json(buildFallbackConfig());
  }
}
