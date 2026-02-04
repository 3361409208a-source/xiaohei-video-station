// 动态生成sitemap，包含影片页面（限制数量避免服务器压力）
export default async function sitemap() {
  const baseUrl = 'https://xiaohei-video-station.vercel.app';
  // 在 Vercel 服务端执行时，NEXT_PUBLIC_ 变量也可以被服务器端代码读取
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // 基础页面：首页优先级最高 1.0
  const routes = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
      languages: {
        'zh-CN': `${baseUrl}`,
      },
    },
  ];

  // 如果配置了后台API，尝试获取影片列表
  if (API_URL) {
    try {
      // 通过分类获取影片（电影、电视剧、动漫、综艺）
      const categories = ['电影', '电视剧', '动漫', '综艺'];
      const MAX_MOVIES_PER_CATEGORY = 250; // 4个分类共1000部，达成1000部目标

      // 使用Map按影片ID去重
      const movieMap = new Map();

      for (const category of categories) {
        try {
          const response = await fetch(`${API_URL}/api/search?t=${encodeURIComponent(category)}`, {
            next: { revalidate: 3600 }, // 缓存1小时，保证新鲜度
            signal: AbortSignal.timeout(8000) // 采集站可能慢，给8秒宽限
          });

          if (response.ok) {
            const movies = await response.json();

            // 只取前N部影片
            const limitedMovies = movies.slice(0, MAX_MOVIES_PER_CATEGORY);

            limitedMovies.forEach((movie, index) => {
              if (movie.id && movie.source_name && movie.title) {
                if (!movieMap.has(movie.id)) {
                  const slug = `${movie.title}-${movie.id}`;
                  // 前20部认为是热门，优先级 0.9，其他 0.7
                  const priority = index < 20 ? 0.9 : 0.7;
                  
                  movieMap.set(movie.id, {
                    url: `${baseUrl}/movie/${encodeURIComponent(slug)}?src=${encodeURIComponent(movie.source_name)}`,
                    lastModified: new Date(),
                    changeFrequency: 'weekly',
                    priority: priority,
                    languages: {
                      'zh-CN': `${baseUrl}/movie/${encodeURIComponent(slug)}?src=${encodeURIComponent(movie.source_name)}`,
                    },
                  });
                }
              }
            });
          }
        } catch (error) {
          console.error(`Failed to fetch ${category} for sitemap:`, error);
        }
      }

      routes.push(...Array.from(movieMap.values()));
    } catch (error) {
      console.error('Failed to generate movie sitemap:', error);
    }
  }

  return routes;
}
