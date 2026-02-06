'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function ReelsPage() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    fetch('/api/search?t=解说&pg=1')
      .then(res => res.json())
      .then(data => {
        setVideos(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleScroll = () => {
    if (!containerRef.current || !isMobile) return;
    const index = Math.round(containerRef.current.scrollTop / window.innerHeight);
    setCurrentIndex(index);
  };

  if (loading) return <div className="loading-state">🌚 正在搬运精彩解说...</div>;

  // --- PC端：B站样式 (Grid Layout) ---
  if (!isMobile) {
    return (
      <div className="pc-reels-page">
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

        <main className="container pc-grid-container">
          <div className="section-header">
            <h2 className="section-title">热门电影解说</h2>
          </div>
          <div className="reels-grid">
            {videos.map(video => (
              <div key={video.id} className="pc-reel-card">
                <Link href={`/movie/${encodeURIComponent(`${video.title}-${video.id}`)}?src=${encodeURIComponent(video.source)}`} className="poster-link">
                  <div className="poster-wrap">
                    <img src={video.poster} alt={video.title} />
                    <div className="play-overlay">▶</div>
                  </div>
                </Link>
                <div className="pc-reel-info">
                  <h3 className="video-title">{video.title.replace('[电影解说]', '')}</h3>
                  <div className="video-meta">
                    <span>{video.year} · {video.category}</span>
                    <Link href={`/?q=${encodeURIComponent(video.title.replace('[电影解说]', '').replace('电影解说', '').trim())}`} className="pc-search-btn">
                      🔍 搜正片
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>

        <style jsx>{`
          .pc-reels-page { background: #f4f4f4; min-height: 100vh; padding-top: 80px; }
          .pc-grid-container { padding: 20px; }
          .reels-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 25px; margin-top: 20px; }
          .pc-reel-card { background: #fff; border-radius: 12px; overflow: hidden; transition: transform 0.3s; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .pc-reel-card:hover { transform: translateY(-5px); }
          .poster-wrap { position: relative; aspect-ratio: 16/9; overflow: hidden; background: #000; }
          .poster-wrap img { width: 100%; height: 100%; object-fit: cover; }
          .play-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 40px; color: #fff; opacity: 0; transition: 0.3s; }
          .pc-reel-card:hover .play-overlay { opacity: 1; }
          .pc-reel-info { padding: 15px; }
          .video-title { font-size: 16px; margin-bottom: 10px; font-weight: 600; color: #222; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .video-meta { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #666; }
          .pc-search-btn { color: #00aeec; text-decoration: none; font-weight: 600; border: 1px solid #00aeec; padding: 2px 8px; border-radius: 4px; transition: 0.3s; }
          .pc-search-btn:hover { background: #00aeec; color: #fff; }
        `}</style>
      </div>
    );
  }

  // --- Mobile端：TikTok样式 (Vertical Scroll) ---
  return (
    <div className="mobile-reels-container" ref={containerRef} onScroll={handleScroll}>
      {videos.map((video, index) => (
        <div key={video.id} className="mobile-reel-item">
          <MobilePlayer video={video} active={index === currentIndex} />
          
          <div className="mobile-overlay">
            <div className="mobile-info">
              <h3 className="m-title">{video.title.replace('[电影解说]', '')}</h3>
              <p className="m-meta">{video.category} · {video.year}</p>
            </div>
            
            <div className="m-actions">
              <Link href={`/?q=${encodeURIComponent(video.title.replace('[电影解说]', '').replace('电影解说', '').trim())}`} className="m-action-btn">
                <div className="m-icon">🔍</div>
                <span>搜正片</span>
              </Link>
              <Link href="/" className="m-action-btn">
                <div className="m-icon">🏠</div>
                <span>首页</span>
              </Link>
            </div>
          </div>
        </div>
      ))}

      <style jsx>{`
        .mobile-reels-container { height: 100vh; overflow-y: scroll; scroll-snap-type: y mandatory; background: #000; color: #fff; }
        .mobile-reel-item { height: 100vh; width: 100%; scroll-snap-align: start; position: relative; }
        .mobile-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 40px 20px; background: linear-gradient(transparent, rgba(0,0,0,0.9)); display: flex; justify-content: space-between; align-items: flex-end; pointer-events: none; z-index: 10; }
        .mobile-info { max-width: 70%; }
        .m-title { font-size: 18px; margin-bottom: 8px; font-weight: 600; }
        .m-meta { font-size: 14px; opacity: 0.7; }
        .m-actions { display: flex; flex-direction: column; gap: 20px; pointer-events: auto; }
        .m-action-btn { display: flex; flex-direction: column; align-items: center; gap: 5px; color: #fff; text-decoration: none; }
        .m-icon { width: 45px; height: 45px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; backdrop-filter: blur(10px); }
        .m-action-btn span { font-size: 12px; }
        .loading-state { height: 100vh; display: flex; align-items: center; justify-content: center; background: #000; color: #fff; }
      `}</style>
    </div>
  );
}

function MobilePlayer({ video, active }) {
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (active) {
      fetch(`/api/detail?id=${video.id}&src=${encodeURIComponent(video.source)}`)
        .then(res => res.json())
        .then(data => setDetail(data))
        .catch(() => {});
    }
  }, [active, video]);

  const playUrl = detail?.episodes?.[0]?.url;

  return (
    <div className="player-host" style={{ width: '100%', height: '100%', background: '#000' }}>
      {active && playUrl ? (
        <iframe
          src={`https://p.cdn.it/player.html?url=${encodeURIComponent(playUrl)}`}
          style={{ width: '100%', height: '100%', border: 'none' }}
          allowFullScreen
        />
      ) : (
        <div style={{
          width: '100%', height: '100%', 
          backgroundImage: `url(${video.poster})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          opacity: 0.5
        }} />
      )}
    </div>
  );
}
