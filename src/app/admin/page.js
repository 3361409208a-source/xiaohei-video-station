import AdminClient from './AdminClient';

async function getStats() {
  const defaultStats = {
    total: 0,
    categories: { '电影': 0, '电视剧': 0, '动漫': 0, '综艺': 0 },
    lastUpdate: '从未同步'
  };

  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  if (!API_URL) return defaultStats;

  try {
    const res = await fetch(`${API_URL}/api/stats`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return defaultStats;
    const data = await res.json();
    return {
      total: data.total || 0,
      categories: data.categories || defaultStats.categories,
      lastUpdate: data.lastUpdate || defaultStats.lastUpdate,
    };
  } catch (error) {
    console.error('Failed to fetch admin initial stats:', error);
    return defaultStats;
  }
}

export default async function AdminPage() {
  const stats = await getStats();
  return <AdminClient initialStats={stats} />;
}
