import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import MoviePlayer from './MoviePlayer';
import MovieJsonLd from '@/components/MovieJsonLd';
import { getDetail } from '@/utils/backupService';
import { isValidDetailPayload } from '@/utils/searchHelpers';
import { buildMovieDescription, buildMovieKeywords } from '@/utils/seoHelpers';
import { buildMoviePath } from '@/utils/movieUrl';

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
  const srcQuery = src ? `&src=${encodeURIComponent(src)}` : '';

  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL;
    if (API_URL) {
      const response = await fetch(`${API_URL}/api/detail?id=${id}${srcQuery}`, {
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const json = await response.json();
        if (isValidDetail(json)) data = json;
      }
    }
  } catch (error) {
    console.warn('Failed to fetch metadata from backend, trying backup service:', error.message);
  }

  if (!data && src) {
    try {
      const backup = await getDetail(id, src);
      if (isValidDetail(backup)) data = backup;
    } catch (error) {
      console.error('Backup service failed to fetch metadata:', error);
    }
  }

  return data;
}

function resolvePlaybackSrc(requestedSrc, data) {
  return requestedSrc || data?.source_name || data?.source || '';
}

export default async function MoviePage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const { id, titleFromSlug } = parseSlug(resolvedParams.slug);
  const requestedSrc = resolvedSearchParams.src || '';

  if (!id) {
    notFound();
  }

  const data = await fetchMovieDetail(id, requestedSrc || undefined);
  if (!data) {
    notFound();
  }

  const playbackSrc = resolvePlaybackSrc(requestedSrc, data);
  const canonicalPath = buildMoviePath(data.title, data.vod_id || id);
  const pageUrl = `${BASE_URL}${canonicalPath}`;

  return (
    <>
      <MovieJsonLd data={data} pageUrl={pageUrl} />
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
          id={data.vod_id || id}
          title={data.title || titleFromSlug}
          src={playbackSrc}
          initialUrl={resolvedSearchParams.url}
        />
      </Suspense>
    </>
  );
}

export async function generateMetadata({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const { id } = parseSlug(resolvedParams.slug);
  const requestedSrc = resolvedSearchParams.src || '';

  if (!id) {
    notFound();
  }

  const data = await fetchMovieDetail(id, requestedSrc || undefined);
  if (!data) {
    notFound();
  }

  const title = data.title;
  const canonicalPath = buildMoviePath(title, data.vod_id || id);
  const pageUrl = `${BASE_URL}${canonicalPath}`;
  const description = buildMovieDescription(data);

  return {
    title: `${title}在线免费观看 - 小黑搜影`,
    description,
    keywords: buildMovieKeywords(data),
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: `${title}在线免费观看`,
      description,
      type: 'video.movie',
      siteName: '小黑搜影',
      url: pageUrl,
      images: data.poster ? [{ url: data.poster }] : [],
    },
  };
}
