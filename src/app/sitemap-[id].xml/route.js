import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request, { params: paramsPromise }) {
  const params = await paramsPromise;
  // 提取 sitemap-1.xml 中的 1
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
      xml += `  <url><loc>${url}</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>\n`;
    });
    xml += `</urlset>`;

    return new NextResponse(xml, { headers: { 'Content-Type': 'application/xml' } });
  } catch (e) {
    return new NextResponse('', { status: 500 });
  }
}
