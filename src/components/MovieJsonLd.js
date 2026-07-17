import { buildMovieJsonLd } from '@/utils/seoHelpers';

export default function MovieJsonLd({ data, pageUrl }) {
  if (!data?.title || !pageUrl) return null;
  const jsonLd = buildMovieJsonLd(data, pageUrl);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
