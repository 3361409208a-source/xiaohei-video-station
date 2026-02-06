'use client';
import { useState, useEffect, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ReelsContent() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [config, setConfig] = useState({ site_name: '小黑搜影' });

  useEffect(() => {
    fetch('/api/config').then(res => res.json()).then(data => setConfig(data));
    fetchVideos(1);
  }, []);

  const fetchVideos = async (p) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/search?t=解说&pg=${p}`);
      const data = await res.json();
      if (Array.isArray(data)) setVideos(data);
    } catch (e) {}
    setLoading(false);
  };

  return (
    <div className="page-wrapper" style={{ background: '#f6f7f9', minHeight: '100vh' }}>
      <header className="site-header">
        <div className="container header-inner">
          <Link href="/" className="logo-area">
            <img src="/logo.png" alt="logo" className="logo-img" />
            <div className="logo-text">小黑<span>搜影</span></div>
          </Link>
          <nav className="nav-links">
            {['首页', '电影解说', '电影', '电视剧', '短剧', '动漫'].map(name => (
                <Link key={name} href={name === '首页' ? '/' : (name === '电影解说' ? '/reels' : `/channel/${name}`)} 
                        className={`nav-link ${name === '电影解说' ? 'active' : ''}`}>
                {name}
                </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="container" style={{ paddingTop: '80px', paddingBottom: '40px' }}>
        <div className="section-header">
          <h2 className="section-title">🎬 电影解说精选</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
             <button className="page-btn" onClick={() => { setPage(p => Math.max(1, p-1)); fetchVideos(Math.max(1, page-1)); }}>上一页</button>
             <button className="page-btn" onClick={() => { setPage(p => p+1); fetchVideos(page+1); }}>下一页</button>
          </div>
        </div>

        {loading ? (
            <div className="loading-con"><div className="spinner"></div></div>
        ) : (
            <div className="reels-grid">
                {videos.map(v => (
                    <Link key={v.id} href={`/reels/${encodeURIComponent(`${v.title}-${v.id}`)}?src=${encodeURIComponent(v.source)}`} className="reel-card">
                        <div className="reel-poster-wrap">
                            <img src={v.poster} alt={v.title} />
                            <div className="reel-play-icon">▶</div>
                        </div>
                        <div className="reel-card-info">
                            <h3 className="reel-card-title">{v.title.replace('[电影解说]', '')}</h3>
                            <p className="reel-card-meta">{v.year} · {v.source}</p>
                        </div>
                    </Link>
                ))}
            </div>
        )}
      </main>

      <style jsx>{`
        .reels-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; margin-top: 20px; }
        .reel-card { background: #fff; border-radius: 8px; overflow: hidden; text-decoration: none; transition: 0.3s; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .reel-card:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
        .reel-poster-wrap { position: relative; aspect-ratio: 16/9; overflow: hidden; background: #000; }
        .reel-poster-wrap img { width: 100%; height: 100%; object-fit: cover; }
        .reel-play-icon { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 30px; color: #fff; background: rgba(0,0,0,0.2); opacity: 0; transition: 0.3s; }
        .reel-card:hover .reel-play-icon { opacity: 1; }
        .reel-card-info { padding: 12px; }
        .reel-card-title { font-size: 15px; color: #18191c; margin-bottom: 5px; font-weight: 600; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .reel-card-meta { font-size: 12px; color: #9499a0; }
        .page-btn { background: #fff; border: 1px solid #e3e5e7; padding: 5px 15px; border-radius: 4px; cursor: pointer; font-size: 13px; }
        .page-btn:hover { background: #f1f2f3; }
      `}</style>
    </div>
  );
}

export default function ReelsPage() {
    return (
        <Suspense fallback={null}>
            <ReelsContent />
        </Suspense>
    )
}
