import { buildMoviePath } from './movieUrl';

/**
 * 生成 sitemap 用 canonical 影片 URL（不含 ?src=）
 */
export function buildMovieSitemapUrl(m, baseUrl = 'https://www.xiaoheiv.top') {
  const vodId = m.vod_id ?? m.id;
  const path = buildMoviePath(m.title, vodId);
  return `${baseUrl}${path}`;
}
