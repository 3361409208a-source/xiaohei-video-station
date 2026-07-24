import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import ChannelClient from './ChannelClient';
import { getChannelSeo } from '@/utils/seoHelpers';
import { buildMoviePath } from '@/utils/movieUrl';

const BASE_URL = 'https://www.xiaoheiv.top';
const VALID_TYPES = ['电影', '电视剧', '短剧', '动漫', '综艺', '纪录片'];

async function fetchChannelResults(type, classTag = '', page = 1) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
  try {
    const url = `${API_URL}/api/search?t=${encodeURIComponent(type)}&class_tag=${encodeURIComponent(classTag)}&pg=${page}`;
    const res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  } catch {
    // fallback empty
  }
  return [];
}

async function fetchSubCategories(type) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
  try {
    const res = await fetch(`${API_URL}/api/categories?t=${encodeURIComponent(type)}`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  } catch {
    // ignore
  }
  return [];
}

export async function generateMetadata({ params, searchParams }) {
  const { type: rawType } = await params;
  const type = decodeURIComponent(rawType);
  if (!VALID_TYPES.includes(type)) {
    return { title: '频道不存在 - 小黑搜影' };
  }

  const sp = await searchParams;
  const page = parseInt(sp?.pg || '1', 10);
  const seo = getChannelSeo(type);
  const pageSuffix = page > 1 ? ` - 第${page}页` : '';
  const channelPath = `/channel/${encodeURIComponent(type)}${page > 1 ? `?pg=${page}` : ''}`;

  return {
    title: `${seo.title}${pageSuffix} - 小黑搜影`,
    description: seo.description,
    keywords: `${type},${type}在线观看,${type}免费看,最新${type},小黑搜影`,
    alternates: {
      canonical: `${BASE_URL}${channelPath}`,
    },
    openGraph: {
      title: `${seo.title} - 小黑搜影`,
      description: seo.description,
      url: `${BASE_URL}${channelPath}`,
      siteName: '小黑搜影',
    },
  };
}

export default async function ChannelPage({ params, searchParams }) {
  const { type: rawType } = await params;
  const type = decodeURIComponent(rawType);

  if (!VALID_TYPES.includes(type)) {
    notFound();
  }

  const sp = await searchParams;
  const page = parseInt(sp?.pg || '1', 10);
  const [initialResults, subCategories] = await Promise.all([
    fetchChannelResults(type, '', page),
    fetchSubCategories(type),
  ]);

  return (
    <>
      <nav aria-label={`${type}影片索引`} className="seo-channel-links">
        <ul>
          {initialResults.slice(0, 40).map((item) => {
            const itemId = item.vod_id || item.id;
            return (
              <li key={`seo-${itemId}-${item.source_name || item.source}`}>
                <a href={buildMoviePath(item.title, itemId)}>{item.title}</a>
              </li>
            );
          })}
        </ul>
      </nav>
      <Suspense fallback={
        <div className="page-loading-screen">
          <div className="spinner"></div>
          <div className="loading-text">正在加载...</div>
        </div>
      }>
        <ChannelClient
          type={type}
          initialPage={page}
          initialResults={initialResults}
          initialSubCategories={subCategories}
        />
      </Suspense>
    </>
  );
}
