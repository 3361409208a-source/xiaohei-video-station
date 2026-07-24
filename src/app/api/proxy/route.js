import { isSafeProxyUrl } from '@/utils/proxySafety';

const PROXY_TIMEOUT_MS = 15000;

/** CDN 防盗链：按上游 host 补 Referer 头 */
const REFERER_MAP = {
  'ffzy-online6.com': 'https://www.ffzy.tv/',
  'ffzyapi.com': 'https://www.ffzy.tv/',
  'zuidazym3u8.com': 'https://www.zuidazy.net/',
  'zuidazy.me': 'https://www.zuidazy.net/',
  'ijycnd.com': 'https://www.ijycnd.com/',
  'xluuss.com': 'https://www.xluuss.com/',
  'jisuzyv.com': 'https://www.jisuzyv.com/',
  'baofeng11.com': 'https://www.baofeng11.com/',
  'hongniuzy2.com': 'https://www.hongniuzy2.com/',
  'hhzyapi.com': 'https://www.hhzyapi.com/',
  'huyaapi.com': 'https://www.huyaapi.com/',
  'jszyapi.com': 'https://www.jszyapi.com/',
  'jyzyapi.com': 'https://www.jyzyapi.com/',
  'lziapi.com': 'https://www.lziapi.com/',
  'xinlangapi.com': 'https://www.xinlangapi.com/',
  'bfzyapi.com': 'https://www.bfzyapi.com/',
  'guangsuapi.com': 'https://www.guangsuapi.com/',
  'ukuapi.com': 'https://www.ukuapi.com/',
  'suoniapi.com': 'https://www.suoniapi.com/',
  'sdzyapi.com': 'https://www.sdzyapi.com/',
  'wujinapi.me': 'https://www.wujinapi.me/',
  'apibdzy.com': 'https://www.apibdzy.com/',
  'niuniuzy.me': 'https://www.niuniuzy.me/',
  'apiyhzy.com': 'https://www.apiyhzy.com/',
};

function pickReferer(url) {
  try {
    const host = new URL(url).hostname;
    // 尝试精确匹配；否则尝试匹配尾部（子域名情况）
    if (REFERER_MAP[host]) return REFERER_MAP[host];
    for (const [key, ref] of Object.entries(REFERER_MAP)) {
      if (host.endsWith('.' + key) || host === key) return ref;
    }
    // 通用兜底：用上游自己的 host
    return 'https://' + host + '/';
  } catch {
    return undefined;
  }
}

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
    const referer = pickReferer(url);
    if (referer) headers['Referer'] = referer;

    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    });
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
    }

    // ts / 媒体分片：流式转发，避免大文件整包缓冲
    return new Response(response.body, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': contentType || 'video/MP2T',
        'Cache-Control': 'public, max-age=3600',
      }
    });
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    console.error('Video proxy failed:', error);
    return new Response(
      timedOut ? 'Proxy timeout' : `Proxy failed: ${error.message}`,
      { status: timedOut ? 504 : 502 }
    );
  }
}
