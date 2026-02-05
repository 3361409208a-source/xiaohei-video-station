import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') || '0';
  const baseUrl = 'https://xiaohei-video-station.vercel.app';
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

  try {
    const res = await fetch(`${API_URL}/api/sitemap-raw?chunk=${id}`, { cache: 'no-store' });
    if (!res.ok) return new NextResponse('', { status: 404 });
    const movies = await res.json();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    movies.forEach(m => {
      const url = `${baseUrl}/movie/${encodeURIComponent(`${m.title}-${m.id}`)}?src=${encodeURIComponent(m.source || '默认')}`;
      xml += `  <url><loc>${url}</loc><changefreq>weekly</changefreq></url>\n`;
    });
    xml += `</urlset>`;

    return new NextResponse(xml, { headers: { 'Content-Type': 'application/xml' } });
  } catch (e) {
    return new NextResponse('', { status: 500 });
  }
}
