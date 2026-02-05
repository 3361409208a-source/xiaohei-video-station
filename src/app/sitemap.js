export async function generateSitemaps() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://xiaohei-video-station-production.up.railway.app';
  
  try {
    const res = await fetch(`${API_URL}/api/sitemap-info`, { next: { revalidate: 3600 } });
    if (!res.ok) return [{ id: 0 }];
    const info = await res.json();
    const totalChunks = Math.ceil(info.total / 5000);
    const sitemaps = [{ id: 0 }];
    for (let i = 1; i <= totalChunks; i++) {
      sitemaps.push({ id: i });
    }
    return sitemaps;
  } catch (e) {
    return [{ id: 0 }];
  }
}

export default async function sitemap({ id }) {
  const baseUrl = 'https://xiaohei-video-station.vercel.app';
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://xiaohei-video-station-production.up.railway.app';

  try {
    const res = await fetch(`${API_URL}/api/sitemap-raw?chunk=${id}`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const movies = await res.json();

    return movies.map((movie) => ({
      url: `${baseUrl}/movie/${encodeURIComponent(`${movie.title}-${movie.id}`)}?src=${encodeURIComponent(movie.source || '默认')}`,
      lastModified: new Date(movie.update_time || Date.now()),
      changeFrequency: id === 0 ? 'daily' : 'weekly',
      priority: id === 0 ? 1.0 : 0.5,
    }));
  } catch (e) {
    return [];
  }
}
