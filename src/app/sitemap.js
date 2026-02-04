// 强制重新部署并移除缓存逻辑，确保 Sitemap 实时抓取
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function sitemap() {
  const baseUrl = 'https://xiaohei-video-station.vercel.app';
  // 核心修复：确保在服务端运行时也能拿到环境变量
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://xiaohei-video-station-production.up.railway.app';

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
      // 这里的逻辑改为请求后端的“最新更新”接口，而不是按分类死磕（因为分类过滤在某些源上不生效）
      const movieMap = new Map();

      try {
        // 请求不带参数的 search 接口，获取全源最新 100+ 条数据
        const response = await fetch(`${API_URL}/api/search`, {
          next: { revalidate: 3600 },
          signal: AbortSignal.timeout(10000)
        });

        if (response.ok) {
          const movies = await response.json();
          movies.forEach((movie, index) => {
            if (movie.id && movie.source_name && movie.title) {
              const slug = `${movie.title}-${movie.id}`;
              const priority = index < 30 ? 0.9 : 0.7;
              movieMap.set(`${movie.id}-${movie.source_name}`, {
                url: `${baseUrl}/movie/${encodeURIComponent(slug)}?src=${encodeURIComponent(movie.source_name)}`,
                lastModified: new Date(),
                changeFrequency: 'weekly',
                priority: priority,
                languages: {
                  'zh-CN': `${baseUrl}/movie/${encodeURIComponent(slug)}?src=${encodeURIComponent(movie.source_name)}`,
                },
              });
            }
          });
        }
      } catch (e) {
        console.error("Sitemap direct fetch failed:", e);
      }

      // 如果全源抓取不够，再尝试各个分类的深度抓取
      const categories = ['电影', '电视剧', '动漫', '综艺'];
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
