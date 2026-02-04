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
  try {
    const movieMap = new Map();

    // 1. 获取全源最新更新 (ac=detail 不带参数)
    try {
      const response = await fetch(`${API_URL}/api/search`, {
        next: { revalidate: 0 },
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
      console.error("Sitemap global fetch failed:", e);
    }

    // 2. 按分类深度获取 (每个分类取多页)
    const categories = ['电影', '电视剧', '动漫', '综艺'];
    for (const category of categories) {
      try {
        // 请求后端获取指定分类的数据
        const response = await fetch(`${API_URL}/api/search?t=${encodeURIComponent(category)}`, {
          next: { revalidate: 0 },
          signal: AbortSignal.timeout(10000)
        });

        if (response.ok) {
          const movies = await response.json();
          movies.forEach((movie, index) => {
            const key = `${movie.id}-${movie.source_name}`;
            if (!movieMap.has(key) && movie.id && movie.title) {
              const slug = `${movie.title}-${movie.id}`;
              movieMap.set(key, {
                url: `${baseUrl}/movie/${encodeURIComponent(slug)}?src=${encodeURIComponent(movie.source_name)}`,
                lastModified: new Date(),
                changefreq: 'weekly',
                priority: index < 20 ? 0.8 : 0.6,
                languages: {
                  'zh-CN': `${baseUrl}/movie/${encodeURIComponent(slug)}?src=${encodeURIComponent(movie.source_name)}`,
                },
              });
            }
          });
        }
      } catch (error) {
        console.error(`Sitemap fetch category ${category} failed:`, error);
      }
    }

    routes.push(...Array.from(movieMap.values()));
  } catch (error) {
    console.error('Failed to generate movie sitemap:', error);
  }

  return routes;
}
