import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import MoviePlayer from './MoviePlayer';
import MovieJsonLd from '@/components/MovieJsonLd';
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

async function fetchMovieMeta(id, titleFromSlug) {
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL;
    if (API_URL) {
      const response = await fetch(`${API_URL}/api/detail/meta?id=${id}`, {
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const json = await response.json();
        if (json?.title) return json;
      }
    }
  } catch (error) {
    console.warn('Failed to fetch movie meta from backend:', error.message);
  }

  if (titleFromSlug) {
    return { vod_id: id, title: titleFromSlug };
  }
  return null;
}

export default async function MoviePage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const { id, titleFromSlug } = parseSlug(resolvedParams.slug);
  const requestedSrc = resolvedSearchParams.src || '';

  if (!id) {
    notFound();
  }

  const meta = await fetchMovieMeta(id, titleFromSlug);
  if (!meta?.title) {
    notFound();
  }

  const displayTitle = meta.title;
  const canonicalPath = buildMoviePath(displayTitle, meta.vod_id || id);
  const pageUrl = `${BASE_URL}${canonicalPath}`;

  return (
    <>
      <MovieJsonLd data={meta} pageUrl={pageUrl} />
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
          id={meta.vod_id || id}
          title={displayTitle}
          src={requestedSrc}
          initialUrl={resolvedSearchParams.url}
        />
      </Suspense>
    </>
  );
}

export async function generateMetadata({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const { id, titleFromSlug } = parseSlug(resolvedParams.slug);

  if (!id) {
    notFound();
  }

  const meta = await fetchMovieMeta(id, titleFromSlug);
  if (!meta?.title) {
    notFound();
  }

  const title = meta.title;
  const canonicalPath = buildMoviePath(title, meta.vod_id || id);
  const pageUrl = `${BASE_URL}${canonicalPath}`;
  const description = buildMovieDescription(meta);

  return {
    title: `${title}在线免费观看 - 小黑搜影`,
    description,
    keywords: buildMovieKeywords(meta),
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: `${title}在线免费观看`,
      description,
      type: 'video.movie',
      siteName: '小黑搜影',
      url: pageUrl,
      images: meta.poster ? [{ url: meta.poster }] : [],
    },
  };
}
