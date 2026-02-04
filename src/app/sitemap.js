// 动态生成sitemap，包含影片页面（限制数量避免服务器压力）
export default async function sitemap() {
  const baseUrl = 'https://xiaohei-video-station.vercel.app';
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // 基础页面
  const routes = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
  ];

  // 如果配置了后台API，尝试获取影片列表
  if (API_URL) {
    try {
      // 通过分类获取影片（电影、电视剧、动漫、综艺）
      const categories = ['电影', '电视剧', '动漫', '综艺'];
      const movieUrls = [];
      const MAX_MOVIES_PER_CATEGORY = 200; // 限制每个分类最多200部，避免压力过大

      // 使用Map按影片ID去重（同一影片可能在多个资源站）
      const movieMap = new Map();

      for (const category of categories) {
        try {
          const response = await fetch(`${API_URL}/api/search?t=${encodeURIComponent(category)}`, {
            next: { revalidate: 86400 }, // 缓存24小时，减少API请求
            signal: AbortSignal.timeout(5000) // 5秒超时
          });

          if (response.ok) {
            const movies = await response.json();

            // 只取前N部影片，避免sitemap过大
            const limitedMovies = movies.slice(0, MAX_MOVIES_PER_CATEGORY);

            limitedMovies.forEach(movie => {
              if (movie.id && movie.source_name && movie.title) {
                // 按影片ID去重，同一影片只保留第一个遇到的资源站
                if (!movieMap.has(movie.id)) {
                  // 生成SEO友好的slug: {title}-{id}
                  const slug = `${movie.title}-${movie.id}`;
                  movieMap.set(movie.id, {
                    url: `${baseUrl}/movie/${encodeURIComponent(slug)}?src=${encodeURIComponent(movie.source_name)}`,
                    lastModified: new Date(),
                    changeFrequency: 'weekly',
                    priority: 0.8,
                  });
                }
              }
            });
          }
        } catch (error) {
          console.error(`Failed to fetch ${category}:`, error);
          // 失败时继续处理其他分类
        }
      }

      // 将去重后的影片添加到sitemap
      routes.push(...Array.from(movieMap.values()));
    } catch (error) {
      console.error('Failed to generate movie sitemap:', error);
    }
  }

  return routes;
}
