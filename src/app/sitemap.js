import fs from 'fs';
import path from 'path';

export async function generateSitemaps() {
  const dataPath = path.join(process.cwd(), 'public', 'sitemap_data.json');
  
  if (!fs.existsSync(dataPath)) {
    return [{ id: 0 }];
  }

  try {
    const fileContent = fs.readFileSync(dataPath, 'utf8');
    const movies = JSON.parse(fileContent);
    // 每卷 5000 条
    const totalChunks = Math.ceil(movies.length / 5000);
    
    const sitemaps = [{ id: 0 }]; // id 0 总是作为最新更新卷
    for (let i = 1; i <= totalChunks; i++) {
      sitemaps.push({ id: i });
    }
    return sitemaps;
  } catch (e) {
    console.error("Error generating sitemaps list:", e);
    return [{ id: 0 }];
  }
}

export default async function sitemap({ id }) {
  const baseUrl = 'https://xiaohei-video-station.vercel.app';
  const dataPath = path.join(process.cwd(), 'public', 'sitemap_data.json');
  
  if (!fs.existsSync(dataPath)) {
    return [];
  }

  try {
    const fileContent = fs.readFileSync(dataPath, 'utf8');
    const allMovies = JSON.parse(fileContent);

    let movies = [];
    if (id === 0) {
      // 卷 0: 获取最新的 2000 条 (假设数据是按时间排序的，或者这里简单取前 2000)
      movies = allMovies.slice(0, 2000);
    } else {
      // 历史卷: 每卷 5000 条
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
    console.error(`Error generating sitemap ${id}:`, e);
    return [];
  }
}
