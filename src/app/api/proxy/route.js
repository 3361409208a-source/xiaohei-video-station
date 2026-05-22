import { NextResponse } from 'next/server';

function rewriteM3u8(content, originalUrl, proxyBase) {
  const lastSlashIndex = originalUrl.lastIndexOf("/");
  const baseUrl = lastSlashIndex !== -1 ? originalUrl.substring(0, lastSlashIndex + 1) : originalUrl;
  const lines = content.split('\n');
  const newLines = lines.map(line => {
    const stripped = line.trim();
    if (!stripped) return line;

    if (stripped.startsWith("#")) {
      // 匹配 URI="..." 标签并改写
      return stripped.replace(/URI="([^"]+)"/g, (match, uri) => {
        // 排除可能已经被改写过或者无需改写的空路径
        if (uri.startsWith('data:')) return match;
        const absUri = uri.startsWith("http") ? uri : baseUrl + uri;
        return `URI="${proxyBase}?url=${encodeURIComponent(absUri)}"`;
      });
    } else {
      // 视频分片链接
      const absUri = stripped.startsWith("http") ? stripped : baseUrl + stripped;
      return `${proxyBase}?url=${encodeURIComponent(absUri)}`;
    }
  });
  return newLines.join('\n');
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  
  if (!url) {
    return new Response('Missing url parameter', { status: 400 });
  }

  // 构造本地代理自身的基准 URL
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
      // 透传 ts 分片等二进制媒体流
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
