import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const baseUrl = 'https://xiaohei-video-station.vercel.app';
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://xiaohei-video-station-production.up.railway.app';

  try {
    const infoRes = await fetch(`${API_URL}/api/sitemap-info`, { cache: 'no-store' });
    if (!infoRes.ok) throw new Error('Backend unreach');
    const info = await infoRes.json();
    const totalChunks = Math.ceil(info.total / 5000);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    // 修改为美化后的路径
    for (let i = 0; i <= totalChunks; i++) {
      xml += `  <sitemap>\n    <loc>${baseUrl}/sitemap-${i}.xml</loc>\n  </sitemap>\n`;
    }
    xml += `</sitemapindex>`;

    return new NextResponse(xml, {
      headers: { 'Content-Type': 'application/xml' }
    });
  } catch (e) {
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>${baseUrl}/</loc></url>\n</urlset>`;
    return new NextResponse(fallback, { headers: { 'Content-Type': 'application/xml' } });
  }
}
