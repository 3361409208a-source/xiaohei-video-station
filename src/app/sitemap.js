export async function generateSitemaps() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://xiaohei-video-station-production.up.railway.app';
  
  try {
    const res = await fetch(`${API_URL}/api/sitemap-raw`, { next: { revalidate: 3600 } });
    if (!res.ok) return [{ id: 0 }];
    
    const movies = await res.json();
    const totalChunks = Math.ceil(movies.length / 5000);
    
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
    const res = await fetch(`${API_URL}/api/sitemap-raw`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    
    const allMovies = await res.json();

    let movies = [];
    if (id === 0) {
      movies = allMovies.slice(0, 2000);
    } else {
      const start = (id - 1) * 5000;
      movies = allMovies.slice(start, start + 5000);
    }

    return movies.map((movie) => ({
      url: `${baseUrl}/movie/${encodeURIComponent(`${movie.title}-${movie.id}`)}?src=${encodeURIComponent(movie.source)}`,
      lastModified: new Date(movie.update_time || Date.now()),
      changeFrequency: id === 0 ? 'daily' : 'weekly',
      priority: id === 0 ? 1.0 : 0.5,
    }));
  } catch (e) {
    return [];
  }
}
