'use client';
import { useState, useEffect, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ReelsContent() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchVideos(1);
  }, []);

  const fetchVideos = async (p) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/search?t=解说&pg=${p}&_ts=${Date.now()}`);
      const data = await res.json();
      if (Array.isArray(data)) setVideos(data);
    } catch (e) {}
    setLoading(false);
  };

  return (
    <div className="page-wrapper" style={{ background: 'var(--bg-main)', minHeight: '100vh' }}>
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

      <main className="container" style={{ paddingTop: '40px', paddingBottom: '60px' }}>
        <div className="section-header">
          <h2 className="section-title">🎬 电影解说频道</h2>
          <div style={{ display: 'flex', gap: '12px' }}>
             <button className="page-btn-custom" disabled={page<=1} onClick={() => { setPage(p => p-1); fetchVideos(page-1); }}>上一页</button>
             <button className="page-btn-custom" onClick={() => { setPage(p => p+1); fetchVideos(page+1); }}>下一页</button>
          </div>
        </div>

        {loading ? (
            <div className="loading-con"><div className="spinner"></div></div>
        ) : (
            <div className="reels-grid">
                {videos.map(v => (
                    <Link key={v.id} href={`/reels/${encodeURIComponent(`${v.title}-${v.id}`)}?src=${encodeURIComponent(v.source)}`} className="reel-card-styled">
                        <div className="thumb-wrap">
                            <img src={v.poster} alt={v.title} />
                            <div className="play-hint">
                                <div className="hint-icon">▶</div>
                            </div>
                        </div>
                        <div className="info-pane">
                            <h3>{v.title.replace('[电影解说]', '')}</h3>
                            <div className="meta-line">
                                <span className="year">{v.year}</span>
                                <span className="src">{v.source}</span>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        )}
      </main>

      <style jsx>{`
        .page-wrapper :global(a) { text-decoration: none !important; }
        .reels-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 30px; margin-top: 20px; }
        .reel-card-styled { background: var(--bg-card); border-radius: 16px; overflow: hidden; text-decoration: none; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); border: 1px solid rgba(255,255,255,0.05); }
        .reel-card-styled:hover { transform: translateY(-8px); border-color: var(--primary); box-shadow: 0 15px 30px rgba(0,0,0,0.4); }
        
        .thumb-wrap { position: relative; aspect-ratio: 16/9; overflow: hidden; background: #000; }
        .thumb-wrap img { width: 100%; height: 100%; object-fit: cover; transition: 0.5s; }
        .reel-card-styled:hover .thumb-wrap img { transform: scale(1.05); }
        
        .play-hint { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); opacity: 0; transition: 0.3s; }
        .reel-card-styled:hover .play-hint { opacity: 1; }
        .hint-icon { width: 50px; height: 50px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 20px; box-shadow: 0 0 20px rgba(225, 29, 72, 0.5); }
        
        .info-pane { padding: 16px; }
        .info-pane h3 { font-size: 16px; color: #fff; margin-bottom: 8px; font-weight: 700; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .meta-line { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-dim); }
        .meta-line .year { color: var(--primary); font-weight: 600; }

        .page-btn-custom { background: var(--bg-card); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 8px 20px; border-radius: 100px; cursor: pointer; font-size: 13px; font-weight: 600; transition: 0.2s; }
        .page-btn-custom:hover:not(:disabled) { background: var(--primary); border-color: var(--primary); }
        .page-btn-custom:disabled { opacity: 0.3; cursor: not-allowed; }

        @media (max-width: 768px) {
            .reels-grid { grid-template-columns: repeat(2, 1fr); gap: 15px; }
            .info-pane { padding: 12px; }
            .info-pane h3 { font-size: 14px; }
        }
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
