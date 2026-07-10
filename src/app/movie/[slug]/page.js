import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import MoviePlayer from './MoviePlayer';
import { getDetail } from '@/utils/backupService';
import { isValidDetailPayload } from '@/utils/searchHelpers';

const BASE_URL = 'https://www.xiaoheiv.top';

function parseSlug(slug) {
  const lastDashIndex = slug.lastIndexOf('-');
  const id = lastDashIndex !== -1 ? slug.substring(lastDashIndex + 1) : slug;
  const titleFromSlug =
    lastDashIndex !== -1 ? decodeURIComponent(slug.substring(0, lastDashIndex)) : '';
  return { id, titleFromSlug };
}

function isValidDetail(data) {
  return isValidDetailPayload(data);
}

async function fetchMovieDetail(id, src) {
  let data = null;

  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL;
    if (API_URL) {
      const response = await fetch(
        `${API_URL}/api/detail?id=${id}&src=${encodeURIComponent(src)}`,
        {
          next: { revalidate: 86400 },
          signal: AbortSignal.timeout(3000),
        }
      );

      if (response.ok) {
        const json = await response.json();
        if (isValidDetail(json)) data = json;
      }
    }
  } catch (error) {
    console.warn('Failed to fetch metadata from backend, trying backup service:', error.message);
  }

  if (!data) {
    try {
      const backup = await getDetail(id, src);
      if (isValidDetail(backup)) data = backup;
    } catch (error) {
      console.error('Backup service failed to fetch metadata:', error);
    }
  }

  return data;
}

export default async function MoviePage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const { id, titleFromSlug } = parseSlug(resolvedParams.slug);
  const src = resolvedSearchParams.src;

  if (!id || !src) {
    notFound();
  }

  const data = await fetchMovieDetail(id, src);
  if (!data) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div
          className="page-wrapper"
          style={{
            background: '#0a0a0a',
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div className="loading-con">
            <div className="spinner"></div>
            <div className="loading-text">正在为您准备精彩影片...</div>
          </div>
        </div>
      }
    >
      <MoviePlayer
        id={id}
        title={data.title || titleFromSlug}
        src={src}
        initialUrl={resolvedSearchParams.url}
      />
    </Suspense>
  );
}

export async function generateMetadata({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const { id } = parseSlug(resolvedParams.slug);
  const src = resolvedSearchParams.src;

  if (!id || !src) {
    notFound();
  }

  const data = await fetchMovieDetail(id, src);
  if (!data) {
    notFound();
  }

  const title = data.title;
  const canonicalPath = `/movie/${encodeURIComponent(`${title}-${data.vod_id || id}`)}?src=${encodeURIComponent(data.source_name || src)}`;

  return {
    title: `${title}在线免费观看 - 小黑搜影`,
    description: `${title}高清在线观看，免费播放。小黑搜影提供${title}的多个播放源，支持在线观看，无需下载，即点即播。`,
    keywords: `${title},${title}在线观看,${title}免费看,${title}高清,${title}在线播放,${title}免费观看`,
    alternates: {
      canonical: `${BASE_URL}${canonicalPath}`,
    },
    openGraph: {
      title: `${title}在线免费观看`,
      description: `${title}高清在线观看，免费播放`,
      type: 'video.movie',
      siteName: '小黑搜影',
      url: `${BASE_URL}${canonicalPath}`,
      images: data.poster ? [{ url: data.poster }] : [],
    },
  };
}
