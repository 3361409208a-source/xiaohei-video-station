import { NextResponse } from 'next/server';

export async function GET(request) {
  const baseUrl = 'https://xiaohei-video-station.vercel.app';
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

  try {
    // 1. 获取统计信息
    const infoRes = await fetch(`${API_URL}/api/sitemap-info`, { cache: 'no-store' });
    if (!infoRes.ok) throw new Error('Backend unreach');
    const info = await infoRes.json();
    const totalChunks = Math.ceil(info.total / 5000);

    // 2. 构造 Sitemap Index
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    for (let i = 0; i <= totalChunks; i++) {
      // 注意：这里生成的链接是 /api/sitemap-chunk/i 这种形式，
      // 我们随后会专门写处理这个分卷的逻辑
      xml += `  <sitemap>\n    <loc>${baseUrl}/api/sitemap-chunk?id=${i}</loc>\n  </sitemap>\n`;
    }
    xml += `</sitemapindex>`;

    return new NextResponse(xml, {
      headers: { 'Content-Type': 'application/xml' }
    });
  } catch (e) {
    // 兜底
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>${baseUrl}/</loc></url>\n</urlset>`;
    return new NextResponse(fallback, { headers: { 'Content-Type': 'application/xml' } });
  }
}
