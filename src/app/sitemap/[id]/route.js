import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request, { params: paramsPromise }) {
  const params = await paramsPromise;
  // 如果访问的是 /sitemap/0.xml，id 会是 0.xml
  const id = params.id.replace('.xml', '');
  const baseUrl = 'https://xiaohei-video-station.vercel.app';
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://xiaohei-video-station-production.up.railway.app';

  try {
    const res = await fetch(`${API_URL}/api/sitemap-raw?chunk=${id}`, { cache: 'no-store' });
    if (!res.ok) return new NextResponse('', { status: 404 });
    const movies = await res.json();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    movies.forEach(m => {
      const url = `${baseUrl}/movie/${encodeURIComponent(`${m.title}-${m.id}`)}?src=${encodeURIComponent(m.source || '默认')}`;
      const date = m.update_time ? new Date(m.update_time).toISOString() : new Date().toISOString();
      xml += `  <url>\n    <loc>${url}</loc>\n    <lastmod>${date}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.5</priority>\n  </url>\n`;
    });
    xml += `</urlset>`;

    return new NextResponse(xml, { headers: { 'Content-Type': 'application/xml' } });
  } catch (e) {
    return new NextResponse('', { status: 500 });
  }
}
