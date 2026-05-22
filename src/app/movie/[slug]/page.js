import { Suspense } from 'react';
import MoviePlayer from './MoviePlayer';
import { getDetail } from '@/utils/backupService';

export default async function MoviePage({ params, searchParams }) {
  // 从slug中提取ID: {title}-{id} 格式
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const slug = resolvedParams.slug;
  const lastDashIndex = slug.lastIndexOf('-');
  const id = lastDashIndex !== -1 ? slug.substring(lastDashIndex + 1) : slug;
  const titleFromSlug = lastDashIndex !== -1 ? decodeURIComponent(slug.substring(0, lastDashIndex)) : "";

  return (
    <Suspense fallback={
      <div className="page-wrapper" style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-con">
          <div className="spinner"></div>
          <div className="loading-text">正在为您准备精彩影片...</div>
        </div>
      </div>
    }>
      <MoviePlayer
        id={id}
        title={titleFromSlug}
        src={resolvedSearchParams.src}
        initialUrl={resolvedSearchParams.url}
      />
    </Suspense>

  );
}

// 动态生成metadata用于SEO
export async function generateMetadata({ params, searchParams }) {
  // 从slug中提取ID: {title}-{id} 格式
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const slug = resolvedParams.slug;
  const lastDashIndex = slug.lastIndexOf('-');
  const id = lastDashIndex !== -1 ? slug.substring(lastDashIndex + 1) : slug;
  const src = resolvedSearchParams.src;

  if (!id || !src) {
    return {
      title: '影片播放 - 小黑搜影',
    };
  }

  let data = null;

  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL;
    if (API_URL) {
      const response = await fetch(`${API_URL}/api/detail?id=${id}&src=${encodeURIComponent(src)}`, {
        next: { revalidate: 86400 }, // 缓存24小时，减少API请求
        signal: AbortSignal.timeout(2000) // 2秒超时
      });

      if (response.ok) {
        data = await response.json();
      }
    }
  } catch (error) {
    console.warn('Failed to fetch metadata from backend, trying backup service:', error.message);
  }

  // 降级使用本地中转服务抓取详情
  if (!data) {
    try {
      data = await getDetail(id, src);
    } catch (error) {
      console.error('Backup service failed to fetch metadata:', error);
    }
  }

  const title = data?.title || '未知影片';

  return {
    title: `${title}在线免费观看 - 小黑搜影`,
    description: `${title}高清在线观看，免费播放。小黑搜影提供${title}的多个播放源，支持在线观看，无需下载，即点即播。`,
    keywords: `${title},${title}在线观看,${title}免费看,${title}高清,${title}在线播放,${title}免费观看`,
    openGraph: {
      title: `${title}在线免费观看`,
      description: `${title}高清在线观看，免费播放`,
      type: 'video.movie',
      siteName: '小黑搜影',
      images: data?.poster ? [{ url: data.poster }] : [],
    },
  };
}
