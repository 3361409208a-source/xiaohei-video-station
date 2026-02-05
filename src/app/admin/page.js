import AdminClient from './AdminClient';
import fs from 'fs';
import path from 'path';

// 服务器端获取统计数据
async function getStats() {
  const dataPath = path.join(process.cwd(), 'public', 'sitemap_data.json');
  
  // 默认空统计
  const defaultStats = {
    total: 0,
    categories: { '电影': 0, '电视剧': 0, '动漫': 0, '综艺': 0 },
    lastUpdate: '从未同步'
  };

  if (!fs.existsSync(dataPath)) {
    return defaultStats;
  }

  try {
    const fileContent = fs.readFileSync(dataPath, 'utf8');
    const movies = JSON.parse(fileContent);
    const stats = fs.statSync(dataPath);

    const categoryStats = { '电影': 0, '电视剧': 0, '动漫': 0, '综艺': 0 };
    
    movies.forEach(movie => {
      // 简单匹配分类名称，如果不在四大类里则忽略或归类
      const cat = movie.category || '电影';
      if (categoryStats.hasOwnProperty(cat)) {
        categoryStats[cat]++;
      } else if (cat.includes('电影')) {
        categoryStats['电影']++;
      } else if (cat.includes('剧')) {
        categoryStats['电视剧']++;
      } else if (cat.includes('漫')) {
        categoryStats['动漫']++;
      } else if (cat.includes('综艺')) {
        categoryStats['综艺']++;
      }
    });

    return {
      total: movies.length,
      categories: categoryStats,
      lastUpdate: stats.mtime.toLocaleString('zh-CN')
    };
  } catch (error) {
    console.error('Failed to parse sitemap data for stats:', error);
    return defaultStats;
  }
}

export default async function AdminPage() {
  const stats = await getStats();
  return <AdminClient initialStats={stats} />;
}
