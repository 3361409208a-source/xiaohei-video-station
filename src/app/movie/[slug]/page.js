import { Suspense } from 'react';
import MoviePlayer from './MoviePlayer';

export default async function MoviePage({ params, searchParams }) {
  // 从slug中提取ID: {title}-{id} 格式
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const slug = resolvedParams.slug;
  const lastDashIndex = slug.lastIndexOf('-');
  const id = lastDashIndex !== -1 ? slug.substring(lastDashIndex + 1) : slug;

  return (
    <Suspense fallback={
      <div className="page-wrapper" style={{background:'#0a0a0a', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center'}}>
        <div className="loading-con">
          <div className="spinner"></div>
          <div className="loading-text">正在为您准备精彩影片...</div>
        </div>
      </div>
    }>
      <MoviePlayer
        id={id}
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

  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL;
    if (!API_URL) {
      return {
        title: '影片播放 - 小黑搜影',
      };
    }

    const response = await fetch(`${API_URL}/api/detail?id=${id}&src=${encodeURIComponent(src)}`, {
      next: { revalidate: 86400 }, // 缓存24小时，减少API请求
      signal: AbortSignal.timeout(5000) // 5秒超时
    });

    if (!response.ok) {
      return {
        title: '影片播放 - 小黑搜影',
      };
    }

    const data = await response.json();
    const title = data.title || '未知影片';

    return {
      title: `${title}在线免费观看 - 小黑搜影`,
      description: `${title}高清在线观看，免费播放。小黑搜影提供${title}的多个播放源，支持在线观看，无需下载，即点即播。`,
      keywords: `${title},${title}在线观看,${title}免费看,${title}高清,${title}在线播放,${title}免费观看`,
      openGraph: {
        title: `${title}在线免费观看`,
        description: `${title}高清在线观看，免费播放`,
        type: 'video.movie',
        siteName: '小黑搜影',
        images: data.poster ? [{ url: data.poster }] : [],
      },
    };
  } catch (error) {
    console.error('Failed to generate metadata:', error);
    return {
      title: '影片播放 - 小黑搜影',
    };
  }
}
