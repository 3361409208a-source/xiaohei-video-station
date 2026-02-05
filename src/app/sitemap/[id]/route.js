import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// 字符转义函数，根治 XML 乱码/解析失败
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export async function GET(request, { params: paramsPromise }) {
  const params = await paramsPromise;
  const id = params.id.replace('.xml', '').replace('sitemap-', '');
  const baseUrl = 'https://xiaohei-video-station.vercel.app';
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://xiaohei-video-station-production.up.railway.app';

  const isNewChunk = id === '0';
  const revalidateTime = isNewChunk ? 3600 : 259200;

  try {
    const res = await fetch(`${API_URL}/api/sitemap-raw?chunk=${id}`, { 
      next: { revalidate: revalidateTime }
    });
    
    if (!res.ok) return new NextResponse('', { status: 404 });
    const movies = await res.json();

    // 重点：起始位置绝对不能有空格或换行
    let xml = `<?xml version="1.0" encoding="UTF-8"?>`;
    xml += `\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
    
    movies.forEach(m => {
      // 对标题进行 XML 安全转义
      const safeTitle = escapeXml(m.title);
      const url = `${baseUrl}/movie/${encodeURIComponent(`${m.title}-${m.id}`)}?src=${encodeURIComponent(m.source || '默认')}`;
      const date = m.update_time ? new Date(m.update_time).toISOString() : new Date().toISOString();
      
      xml += `\n  <url>`;
      xml += `\n    <loc>${url}</loc>`;
      xml += `\n    <lastmod>${date}</lastmod>`;
      xml += `\n    <changefreq>${isNewChunk ? 'hourly' : 'weekly'}</changefreq>`;
      xml += `\n    <priority>${isNewChunk ? '1.0' : '0.4'}</priority>`;
      xml += `\n  </url>`;
    });
    
    xml += `\n</urlset>`;

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
