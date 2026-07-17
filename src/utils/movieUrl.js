/**
 * 站内影片 URL：SEO 主链不带 src，播放时可带 src 参数
 */

export function buildMovieSlug(title, vodId) {
  return encodeURIComponent(`${title}-${vodId}`);
}

/** SEO canonical / 内链 */
export function buildMoviePath(title, vodId) {
  return `/movie/${buildMovieSlug(title, vodId)}`;
}

/** 带来源与集数参数的播放链（兼容旧链接） */
export function buildMoviePlayHref(title, vodId, sourceName, extra = {}) {
  const params = new URLSearchParams();
  if (sourceName) params.set('src', sourceName);
  if (extra.url) params.set('url', extra.url);
  const qs = params.toString();
  return `${buildMoviePath(title, vodId)}${qs ? `?${qs}` : ''}`;
}
