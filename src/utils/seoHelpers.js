/**
 * SEO 文案与结构化数据辅助
 */

export function stripHtmlForSeo(html) {
  if (!html) return '';
  return String(html)
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildMovieDescription(data) {
  const title = data?.title || '本片';
  const meta = [data?.year, data?.category].filter(Boolean).join(' · ');
  const actorRaw = stripHtmlForSeo(data?.actor);
  const actor = actorRaw ? `主演：${actorRaw.slice(0, 36)}。` : '';
  const desc = stripHtmlForSeo(data?.description).slice(0, 90);
  const head = meta ? `${title}（${meta}）` : title;
  const tail = desc ? `${desc}…` : '支持多源在线播放，即点即播。';
  return `${head}高清在线免费观看。${actor}${tail}`;
}

export function buildMovieKeywords(data) {
  const title = data?.title || '';
  const extras = [data?.category, data?.year, data?.area].filter(Boolean);
  const base = [
    title,
    `${title}在线观看`,
    `${title}免费看`,
    `${title}高清`,
    `${title}在线播放`,
  ];
  return [...base, ...extras.map((x) => `${title}${x}`)].filter(Boolean).join(',');
}

export function buildMovieJsonLd(data, pageUrl) {
  const description = stripHtmlForSeo(data?.description).slice(0, 300);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    name: data?.title,
    url: pageUrl,
  };
  if (description) schema.description = description;
  if (data?.poster) schema.image = data.poster;
  if (data?.year) schema.datePublished = String(data.year);
  if (data?.category) schema.genre = data.category;
  const actorRaw = stripHtmlForSeo(data?.actor);
  if (actorRaw) {
    schema.actor = actorRaw.split(/[,，/]/).slice(0, 5).map((name) => ({
      '@type': 'Person',
      name: name.trim(),
    })).filter((a) => a.name);
  }
  return schema;
}

export const CHANNEL_SEO = {
  电影: {
    title: '最新电影在线免费观看',
    description: '小黑搜影电影频道，汇聚最新高清电影资源，支持在线免费观看，即点即播。',
  },
  电视剧: {
    title: '最新电视剧在线免费观看',
    description: '热门国产剧、港台剧、日韩剧在线免费观看，多源聚合，每日更新。',
  },
  短剧: {
    title: '热门短剧在线免费观看',
    description: '竖屏短剧、微短剧合集，免费在线追剧，连续播放。',
  },
  动漫: {
    title: '最新动漫在线免费观看',
    description: '日本番剧、国产动漫在线免费观看，高清流畅播放。',
  },
  综艺: {
    title: '最新综艺在线免费观看',
    description: '热门综艺节目、真人秀在线免费观看，多源更新。',
  },
  纪录片: {
    title: '纪录片在线免费观看',
    description: '自然、历史、人文纪录片在线免费观看，高清收录。',
  },
};

export function getChannelSeo(type) {
  return CHANNEL_SEO[type] || {
    title: `${type}在线免费观看`,
    description: `小黑搜影${type}频道，免费在线观看，多源聚合播放。`,
  };
}
