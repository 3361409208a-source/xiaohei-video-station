import AdminClient from './AdminClient';

// 服务器端获取统计数据
async function getStats() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  if (!API_URL) {
    return null;
  }

  try {
    const categories = ['电影', '电视剧', '动漫', '综艺'];
    let totalMovies = 0;
    const categoryStats = {};

    for (const category of categories) {
      try {
        const response = await fetch(`${API_URL}/api/search?t=${encodeURIComponent(category)}`, {
          next: { revalidate: 3600 }, // 缓存1小时
          signal: AbortSignal.timeout(10000) // 10秒超时
        });

        if (response.ok) {
          const movies = await response.json();
          // 按ID去重
          const uniqueMovies = new Map();
          movies.forEach(movie => {
            if (!uniqueMovies.has(movie.id)) {
              uniqueMovies.set(movie.id, movie);
            }
          });
          categoryStats[category] = uniqueMovies.size;
          totalMovies += uniqueMovies.size;
        } else {
          categoryStats[category] = 0;
        }
      } catch (error) {
        console.error(`Failed to fetch ${category}:`, error);
        categoryStats[category] = 0;
      }
    }

    return {
      total: totalMovies,
      categories: categoryStats,
      lastUpdate: new Date().toLocaleString('zh-CN')
    };
  } catch (error) {
    console.error('Failed to get stats:', error);
    return null;
  }
}

export default async function AdminPage() {
  const stats = await getStats();

  return <AdminClient initialStats={stats} />;
}
