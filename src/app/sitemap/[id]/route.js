import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request, { params: paramsPromise }) {
  const params = await paramsPromise;
  // 兼容性处理：去除可能存在的 .xml 后缀
  const id = params.id.replace('.xml', '');
  const baseUrl = 'https://xiaohei-video-station.vercel.app';
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://xiaohei-video-station-production.up.railway.app';

  // --- 1. 差异化刷新策略 (根据大神要求更新) ---
  // 卷 0 (最新) 每小时刷新一次 (3600s)
  // 历史卷 每三天刷新一次 (259200s)
  const isNewChunk = id === '0';
  const revalidateTime = isNewChunk ? 3600 : 259200;

  try {
    const res = await fetch(`${API_URL}/api/sitemap-raw?chunk=${id}`, { 
      next: { revalidate: revalidateTime },
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      }
    });
    
    if (!res.ok) return new NextResponse('', { status: 404 });
    const movies = await res.json();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    
    movies.forEach(m => {
      const url = `${baseUrl}/movie/${encodeURIComponent(`${m.title}-${m.id}`)}?src=${encodeURIComponent(m.source || '默认')}`;
      const date = m.update_time ? new Date(m.update_time).toISOString() : new Date().toISOString();
      
      // 差异化权重
      const frequency = isNewChunk ? 'hourly' : 'weekly';
      const priority = isNewChunk ? '1.0' : '0.4';
      
      xml += `  <url>\n    <loc>${url}</loc>\n    <lastmod>${date}</lastmod>\n    <changefreq>${frequency}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;
    });
    
    xml += `</urlset>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': `public, s-maxage=${revalidateTime}, stale-while-revalidate=600`
      }
    });
  } catch (e) {
    return new NextResponse('', { status: 500 });
  }
}
