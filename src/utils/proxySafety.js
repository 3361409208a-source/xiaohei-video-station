/**
 * SSRF 防护：校验代理目标 URL 是否允许抓取
 */
export function isSafeProxyUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { ok: false, reason: 'Missing url' };
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'Invalid url' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Only http/https allowed' };
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (
    host === 'localhost' ||
    host === 'metadata.google.internal' ||
    host.endsWith('.localhost')
  ) {
    return { ok: false, reason: 'Blocked host' };
  }

  // IPv6 loopback / link-local
  if (host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) {
    return { ok: false, reason: 'Blocked IPv6 address' };
  }

  // IPv4 checks
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const parts = ipv4.slice(1).map(Number);
    if (parts.some((n) => n > 255)) {
      return { ok: false, reason: 'Invalid IP' };
    }
    const [a, b] = parts;
    if (a === 127 || a === 0 || a === 10 || a === 169 && b === 254) {
      return { ok: false, reason: 'Blocked private IP' };
    }
    if (a === 192 && b === 168) {
      return { ok: false, reason: 'Blocked private IP' };
    }
    if (a === 172 && b >= 16 && b <= 31) {
      return { ok: false, reason: 'Blocked private IP' };
    }
    // Carrier-grade NAT / link-local extras
    if (a === 100 && b >= 64 && b <= 127) {
      return { ok: false, reason: 'Blocked shared IP' };
    }
  }

  return { ok: true };
}
