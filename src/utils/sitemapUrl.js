/**
 * 生成与站内一致的影片 sitemap URL
 */
export function buildMovieSitemapUrl(m, baseUrl = 'https://www.xiaoheiv.top') {
  const vodId = m.vod_id ?? m.id;
  const sourceName = m.source_name || m.source || '默认';
  const slug = `${m.title}-${vodId}`;
  return `${baseUrl}/movie/${encodeURIComponent(slug)}?src=${encodeURIComponent(sourceName)}`;
}
