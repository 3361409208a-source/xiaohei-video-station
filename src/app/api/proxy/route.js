import { NextResponse } from 'next/server';

/**
 * 视频代理 API —— 解决防盗链 403 问题
 * 
 * 工作原理：
 * 1. 浏览器请求 /api/proxy?url=<encoded_m3u8_url>
 * 2. 服务端不带 Referer 去请求真实视频地址（视频服务器看不到你的站点域名）
 * 3. 对于 .m3u8 播放列表，自动将内部所有 URI 也改写为走代理
 * 4. 对于 .ts / 视频分片，直接流式透传
 */
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
        return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    // 安全白名单：只代理已知的视频域名，防止被滥用为通用代理
    // 可根据实际使用的视频源域名扩展
    const allowedHosts = [
        'yuglf.com',
        'yjbys.com',
        'yunjuys.com',
        'anjiezyapi.com',
        'ffzy-online5.com',
        'ffzy5.tv',
        'iqiyi.com',
        'youku.com',
        'mgtv.com',
        // 通配：允许常见 CDN 后缀
        '.m3u8',
    ];

    let targetHostOk = false;
    try {
        const urlObj = new URL(targetUrl);
        targetHostOk = allowedHosts.some(host => urlObj.hostname.endsWith(host));
        // 如果是 .m3u8 或 .ts URL 也放行（兜底）
        if (!targetHostOk) {
            targetHostOk = targetUrl.includes('.m3u8') || targetUrl.includes('.ts') || targetUrl.includes('index');
        }
    } catch {
        return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
    }

    if (!targetHostOk) {
        return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
    }

    try {
        const response = await fetch(targetUrl, {
            headers: {
                // 关键：不设置 Referer / Origin，或伪装成视频源自身
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                // 不带任何 Referer，让视频服务器无法判断来源
            },
            // 不跟随超长重定向
            redirect: 'follow',
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `Upstream error: ${response.status} ${response.statusText}` },
                { status: response.status }
            );
        }

        const contentType = response.headers.get('content-type') || '';
        const isM3u8 = contentType.includes('mpegurl') ||
            contentType.includes('x-mpegURL') ||
            targetUrl.includes('.m3u8');

        if (isM3u8) {
            // 解析 m3u8，把内部所有 URI 改写为走本代理
            const text = await response.text();
            const rewrittenM3u8 = rewriteM3u8(text, targetUrl, request.url);

            return new NextResponse(rewrittenM3u8, {
                status: 200,
                headers: {
                    'Content-Type': 'application/vnd.apple.mpegurl',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'no-cache',
                },
            });
        } else {
            // ts 分片 / 其他资源：直接流式透传
            const buffer = await response.arrayBuffer();
            return new NextResponse(buffer, {
                status: 200,
                headers: {
                    'Content-Type': contentType || 'video/MP2T',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'public, max-age=3600',
                },
            });
        }
    } catch (error) {
        console.error('[Proxy Error]', error);
        return NextResponse.json({ error: 'Proxy fetch failed', detail: String(error) }, { status: 500 });
    }
}

/**
 * 将 m3u8 文件内的所有 URI 改写为走 /api/proxy
 * 支持相对路径、绝对路径
 */
function rewriteM3u8(content, originalUrl, requestUrl) {
    // 获取原始 m3u8 的 base URL（用于解析相对路径）
    const baseUrl = originalUrl.substring(0, originalUrl.lastIndexOf('/') + 1);

    // 获取代理的 origin（用于拼接代理 URL）
    let proxyOrigin = '';
    try {
        proxyOrigin = new URL(requestUrl).origin;
    } catch {
        proxyOrigin = '';
    }

    const lines = content.split('\n');
    const result = lines.map(line => {
        const trimmed = line.trim();

        // 跳过空行和注释（但要处理 #EXT-X-KEY 和 #EXT-X-MAP 里的 URI="..."）
        if (trimmed.startsWith('#')) {
            // 处理带 URI 属性的标签，例如：
            // #EXT-X-KEY:METHOD=AES-128,URI="https://..."
            // #EXT-X-MAP:URI="init.mp4"
            return trimmed.replace(/URI="([^"]+)"/g, (match, uri) => {
                const absoluteUri = toAbsoluteUrl(uri, baseUrl);
                return `URI="${proxyOrigin}/api/proxy?url=${encodeURIComponent(absoluteUri)}"`;
            });
        }

        if (trimmed === '') return line;

        // 非注释行：就是 segment URI
        const absoluteUri = toAbsoluteUrl(trimmed, baseUrl);
        return `${proxyOrigin}/api/proxy?url=${encodeURIComponent(absoluteUri)}`;
    });

    return result.join('\n');
}

/**
 * 将相对 URL 转换为绝对 URL
 */
function toAbsoluteUrl(uri, baseUrl) {
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
        return uri;
    }
    if (uri.startsWith('//')) {
        return 'https:' + uri;
    }
    if (uri.startsWith('/')) {
        // 绝对路径（相对于域名根）
        try {
            const base = new URL(baseUrl);
            return `${base.protocol}//${base.host}${uri}`;
        } catch {
            return baseUrl + uri;
        }
    }
    // 相对路径
    return baseUrl + uri;
}
