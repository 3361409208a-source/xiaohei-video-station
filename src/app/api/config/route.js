import { NextResponse } from 'next/server';

export async function GET() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

  try {
    const response = await fetch(`${API_URL}/api/config`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(1500)
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ 
      site_name: '🐾 小黑搜影', 
      notice: '📢 防骗提醒：正在播放的视频中若出现任何广告水印，请务必提高警惕，切勿转账或参与，守护好您的财产安全！',
      footer: '© 2026 🐾 小黑搜影',
      theme: 'winxp'
    });
  }
}
