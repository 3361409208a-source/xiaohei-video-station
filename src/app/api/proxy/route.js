import { isSafeProxyUrl } from '@/utils/proxySafety';
import { NextResponse } from 'next/server';

function rewriteM3u8(content, originalUrl, proxyBase) {
  const lastSlashIndex = originalUrl.lastIndexOf("/");
  const baseUrl = lastSlashIndex !== -1 ? originalUrl.substring(0, lastSlashIndex + 1) : originalUrl;
  const lines = content.split('\n');
  const newLines = lines.map(line => {
    const stripped = line.trim();
    if (!stripped) return line;

    if (stripped.startsWith("#")) {
      return stripped.replace(/URI="([^"]+)"/g, (match, uri) => {
        if (uri.startsWith('data:')) return match;
        const absUri = uri.startsWith("http") ? uri : baseUrl + uri;
        return `URI="${proxyBase}?url=${encodeURIComponent(absUri)}"`;
      });
    } else {
      const absUri = stripped.startsWith("http") ? stripped : baseUrl + stripped;
      return `${proxyBase}?url=${encodeURIComponent(absUri)}`;
    }
  });
  return newLines.join('\n');
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  const safety = isSafeProxyUrl(url);
  if (!safety.ok) {
    return new Response(safety.reason || 'Blocked url', { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const proxyBase = `${origin}/api/proxy`;

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    };

    const response = await fetch(url, { headers });
    if (!response.ok) {
      return new Response(`Upstream returned status ${response.status}`, { status: response.status });
    }

    const contentType = response.headers.get('Content-Type') || '';
    const isM3u8 = contentType.toLowerCase().includes('mpegurl') || url.split('?')[0].endsWith('.m3u8');

    if (isM3u8) {
      const text = await response.text();
      const rewritten = rewriteM3u8(text, url, proxyBase);
      return new Response(rewritten, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache',
        }
      });
    } else {
      return new Response(response.body, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': contentType || 'video/MP2T',
          'Cache-Control': 'public, max-age=3600',
        }
      });
    }
  } catch (error) {
    console.error('Video proxy failed:', error);
    return new Response(`Proxy failed: ${error.message}`, { status: 502 });
  }
}
