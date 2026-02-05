import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request, { params: paramsPromise }) {
  const params = await paramsPromise;
  const id = params.id.replace('.xml', '');
  const baseUrl = 'https://xiaohei-video-station.vercel.app';
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://xiaohei-video-station-production.up.railway.app';

  // 1. 根据分卷 ID 设置不同的缓存策略
  // 卷 0 (最新) 每小时刷新一次，历史卷每天刷新一次
  const revalidateTime = id === '0' ? 3600 : 86400;

  try {
    const res = await fetch(`${API_URL}/api/sitemap-raw?chunk=${id}`, { 
      next: { revalidate: revalidateTime } 
    });
    
    if (!res.ok) return new NextResponse('', { status: 404 });
    const movies = await res.json();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    
    movies.forEach(m => {
      const url = `${baseUrl}/movie/${encodeURIComponent(`${m.title}-${m.id}`)}?src=${encodeURIComponent(m.source || '默认')}`;
      const date = m.update_time ? new Date(m.update_time).toISOString() : new Date().toISOString();
      
      // 2. 核心逻辑：区分最新和老旧影片的权重与频率
      // 卷 0 为最新资源，给与最高优先级
      const frequency = id === '0' ? 'daily' : 'monthly';
      const priority = id === '0' ? '1.0' : '0.4';
      
      xml += `  <url>\n    <loc>${url}</loc>\n    <lastmod>${date}</lastmod>\n    <changefreq>${frequency}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;
    });
    
    xml += `</urlset>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml',
        // 告知 Vercel CDN 的缓存时间
        'Cache-Control': `public, s-maxage=${revalidateTime}, stale-while-revalidate=600`
      }
    });
  } catch (e) {
    return new NextResponse('', { status: 500 });
  }
}
