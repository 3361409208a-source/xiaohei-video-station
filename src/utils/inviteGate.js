export const INVITE_COOKIE = 'xh_invite_ok';

export function isInviteExemptPath(pathname) {
  return (
    pathname.startsWith('/gate') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    /\.(ico|png|jpg|jpeg|gif|svg|webp|js|css|woff2?)$/i.test(pathname)
  );
}

export function normalizeInviteCode(code) {
  return String(code || '').trim();
}

export function isValidInviteCode(code, allowedCodes) {
  const normalized = normalizeInviteCode(code);
  if (!normalized) return false;
  const codes = (allowedCodes || []).map((c) => String(c).trim()).filter(Boolean);
  return codes.includes(normalized);
}
