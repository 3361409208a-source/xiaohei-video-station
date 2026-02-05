import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request, { params: paramsPromise }) {
  const params = await paramsPromise;
  // 支持 0, 0.xml, sitemap-0.xml 等各种提取方式
  const id = params.id.replace('.xml', '').replace('sitemap-', '');
  
  const baseUrl = 'https://xiaohei-video-station.vercel.app';
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://xiaohei-video-station-production.up.railway.app';

  // 卷 0 (最新) 每小时刷新，历史卷每三天刷新
  const isNewChunk = id === '0';
  const revalidateTime = isNewChunk ? 3600 : 259200;

  try {
    const res = await fetch(`${API_URL}/api/sitemap-raw?chunk=${id}`, { 
      next: { revalidate: revalidateTime },
      headers: { 'Accept': 'application/json' }
    });
    
    if (!res.ok) return new NextResponse('', { status: 404 });
    const movies = await res.json();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    
    movies.forEach(m => {
      const url = `${baseUrl}/movie/${encodeURIComponent(`${m.title}-${m.id}`)}?src=${encodeURIComponent(m.source || '默认')}`;
      const date = m.update_time ? new Date(m.update_time).toISOString() : new Date().toISOString();
      const frequency = isNewChunk ? 'hourly' : 'weekly';
      const priority = isNewChunk ? '1.0' : '0.4';
      
      xml += `  <url>\n    <loc>${url}</loc>\n    <lastmod>${date}</lastmod>\n    <changefreq>${frequency}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;
    });
    
    xml += `</urlset>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'X-Robots-Tag': 'noindex', // 分卷本身不需要被搜索，搜索结果页才需要
        'Cache-Control': `public, s-maxage=${revalidateTime}, stale-while-revalidate=600`
      }
    });
  } catch (e) {
    return new NextResponse('', { status: 500 });
  }
}
