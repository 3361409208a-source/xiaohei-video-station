'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ReelsContent() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get('id');
  const initialSrc = searchParams.get('src');

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [originalMovie, setOriginalMovie] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [page, setPage] = useState(1);
  const containerRef = useRef(null);

  const fetchVideos = async (p = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/search?t=解说&pg=${p}&_ts=${Date.now()}`);
      const data = await res.json();
      
      let finalVideos = data;
      // 如果带了 id 进来，要把那个视频放到列表第一位
      if (initialId && p === 1) {
          try {
              const detailRes = await fetch(`/api/detail?id=${initialId}&src=${encodeURIComponent(initialSrc)}`);
              const detailData = await detailRes.json();
              if (detailData && detailData.title) {
                  const targetVideo = {
                      id: initialId,
                      title: detailData.title,
                      poster: detailData.poster,
                      source: initialSrc,
                      category: detailData.category,
                      update_time: "刚刚",
                      year: "2026"
                  };
                  finalVideos = [targetVideo, ...data.filter(v => v.id !== initialId)];
              }
          } catch(e) {}
      }

      setVideos(finalVideos);
      if (finalVideos.length > 0 && !isMobile) {
        setSelectedVideo(finalVideos[0]);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch reels:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    fetchVideos(1);
    return () => window.removeEventListener('resize', checkMobile);
  }, [initialId]);

  // 当选择的视频改变时，自动寻找正片
  useEffect(() => {
    if (selectedVideo) {
      const cleanTitle = selectedVideo.title.replace('[电影解说]', '').replace('电影解说', '').trim();
      fetch(`/api/search?q=${encodeURIComponent(cleanTitle)}`)
        .then(res => res.json())
        .then(data => {
          const original = data.find(item => !item.category.includes('解说') && !item.title.includes('解说'));
          setOriginalMovie(original);
        })
        .catch(() => setOriginalMovie(null));
    }
  }, [selectedVideo]);

  const handleScroll = () => {
    if (!containerRef.current || !isMobile) return;
    const index = Math.round(containerRef.current.scrollTop / window.innerHeight);
    setCurrentIndex(index);
  };

  const handleRefresh = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchVideos(nextPage);
  };

  if (loading && videos.length === 0) return <div className="loading-state">🌚 正在加载大片解说...</div>;

  // --- PC端：B站样式 (Player + Sidebar) ---
  if (!isMobile) {
    return (
      <div className="pc-reels-container">
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

        <main className="reels-main-layout">
          {/* 左侧：播放器 + 信息 */}
          <div className="player-section">
            <div className="main-player-wrap">
              {selectedVideo ? (
                <VideoFrame video={selectedVideo} />
              ) : (
                <div className="empty-player">请选择解说视频</div>
              )}
            </div>
            
            {selectedVideo && (
              <div className="video-details">
                <div className="detail-top">
                    <h1 className="v-title">{selectedVideo.title.replace('[电影解说]', '')}</h1>
                    {originalMovie ? (
                        <Link href={`/movie/${encodeURIComponent(`${originalMovie.title}-${originalMovie.id}`)}?src=${encodeURIComponent(originalMovie.source_name)}`} className="play-original-btn">
                            🎬 播正片
                        </Link>
                    ) : (
                        <span className="no-original">暂无正片</span>
                    )}
                </div>
                <div className="v-meta">
                  <span>发布时间：{selectedVideo.update_time}</span>
                  <span>分类：{selectedVideo.category}</span>
                  <span>来源：{selectedVideo.source}</span>
                </div>
              </div>
            )}
          </div>

          {/* 右侧：推荐列表 */}
          <div className="sidebar-section">
            <div className="sidebar-header">
              <h3>推荐解说</h3>
              <button className="refresh-btn" onClick={handleRefresh}>
                <span>🔄 换一批</span>
              </button>
            </div>
            <div className="rec-list">
              {videos.map(v => (
                <div key={v.id} 
                     className={`rec-item ${selectedVideo?.id === v.id ? 'active' : ''}`}
                     onClick={() => setSelectedVideo(v)}>
                  <div className="rec-poster">
                    <img src={v.poster} alt={v.title} />
                  </div>
                  <div className="rec-info">
                    <h4 className="rec-title">{v.title.replace('[电影解说]', '')}</h4>
                    <p className="rec-meta">{v.year} · {v.source}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        <style jsx>{`
          .pc-reels-container { background: #f6f7f9; min-height: 100vh; padding-top: 70px; }
          .reels-main-layout { display: flex; max-width: 1400px; margin: 0 auto; padding: 20px; gap: 20px; }
          
          .player-section { flex: 1; min-width: 0; }
          .main-player-wrap { background: #000; border-radius: 8px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2); aspect-ratio: 16/9; }
          .empty-player { height: 100%; display: flex; align-items: center; justify-content: center; color: #666; }
          
          .video-details { margin-top: 20px; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
          .detail-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
          .v-title { font-size: 22px; font-weight: 700; color: #18191c; }
          .play-original-btn { background: #fb7299; color: #fff; text-decoration: none; padding: 8px 20px; border-radius: 6px; font-weight: 600; transition: 0.3s; }
          .play-original-btn:hover { background: #fc8bab; transform: scale(1.05); }
          .no-original { color: #999; font-size: 14px; }
          .v-meta { color: #9499a0; font-size: 13px; display: flex; gap: 20px; }

          .sidebar-section { width: 350px; flex-shrink: 0; }
          .sidebar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
          .sidebar-header h3 { font-size: 16px; color: #18191c; }
          .refresh-btn { background: none; border: 1px solid #e3e5e7; padding: 4px 10px; border-radius: 4px; cursor: pointer; color: #61666d; font-size: 13px; transition: 0.3s; }
          .refresh-btn:hover { background: #e3e5e7; }

          .rec-list { display: flex; flex-direction: column; gap: 12px; max-height: calc(100vh - 150px); overflow-y: auto; padding-right: 5px; }
          .rec-item { display: flex; gap: 10px; cursor: pointer; border-radius: 6px; transition: 0.2s; padding: 5px; }
          .rec-item:hover { background: #e3e5e7; }
          .rec-item.active { background: #fff; box-shadow: 0 0 0 2px #fb7299; }
          .rec-poster { width: 140px; aspect-ratio: 16/9; border-radius: 4px; overflow: hidden; flex-shrink: 0; }
          .rec-poster img { width: 100%; height: 100%; object-fit: cover; }
          .rec-info { flex: 1; min-width: 0; }
          .rec-title { font-size: 14px; color: #18191c; font-weight: 500; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 5px; }
          .rec-meta { font-size: 12px; color: #9499a0; }
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
          <MobileOverlay video={video} />
        </div>
      ))}
      <style jsx>{`
        .mobile-reels-container { height: 100vh; overflow-y: scroll; scroll-snap-type: y mandatory; background: #000; color: #fff; }
        .mobile-reel-item { height: 100vh; width: 100%; scroll-snap-align: start; position: relative; }
        .loading-state { height: 100vh; display: flex; align-items: center; justify-content: center; background: #000; color: #fff; }
      `}</style>
    </div>
  );
}

function VideoFrame({ video }) {
    const [detail, setDetail] = useState(null);
    useEffect(() => {
        fetch(`/api/detail?id=${video.id}&src=${encodeURIComponent(video.source)}`)
          .then(res => res.json())
          .then(data => setDetail(data));
    }, [video]);

    const playUrl = detail?.episodes?.[0]?.url;

    return (
        <div style={{ width: '100%', height: '100%' }}>
            {playUrl ? (
                <iframe
                src={`https://p.cdn.it/player.html?url=${encodeURIComponent(playUrl)}`}
                style={{ width: '100%', height: '100%', border: 'none' }}
                allowFullScreen
                />
            ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justify-content: 'center', background: '#111' }}>
                    🌚 正在加载解说信号...
                </div>
            )}
        </div>
    );
}

function MobilePlayer({ video, active }) {
  const [detail, setDetail] = useState(null);
  useEffect(() => {
    if (active) {
      fetch(`/api/detail?id=${video.id}&src=${encodeURIComponent(video.source)}`)
        .then(res => res.json())
        .then(data => setDetail(data));
    }
  }, [active, video]);

  const playUrl = detail?.episodes?.[0]?.url;

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {active && playUrl ? (
        <iframe
          src={`https://p.cdn.it/player.html?url=${encodeURIComponent(playUrl)}`}
          style={{ width: '100%', height: '100%', border: 'none' }}
          allowFullScreen
        />
      ) : (
        <div style={{ width: '100%', height: '100%', backgroundImage: `url(${video.poster})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.5 }} />
      )}
    </div>
  );
}

function MobileOverlay({ video }) {
    const [original, setOriginal] = useState(null);
    useEffect(() => {
        const cleanTitle = video.title.replace('[电影解说]', '').replace('电影解说', '').trim();
        fetch(`/api/search?q=${encodeURIComponent(cleanTitle)}`)
          .then(res => res.json())
          .then(data => {
            const found = data.find(item => !item.category.includes('解说') && !item.title.includes('解说'));
            setOriginal(found);
          });
    }, [video]);

    return (
        <div className="m-overlay">
            <div className="m-info">
              <h3 className="m-title">{video.title.replace('[电影解说]', '')}</h3>
              <p className="m-meta">{video.category} · {video.year}</p>
            </div>
            
            <div className="m-actions">
              {original ? (
                  <Link href={`/movie/${encodeURIComponent(`${original.title}-${original.id}`)}?src=${encodeURIComponent(original.source_name)}`} className="m-btn">
                    <div className="m-icon">🎬</div>
                    <span>播正片</span>
                  </Link>
              ) : (
                  <div className="m-btn disabled">
                    <div className="m-icon">🚫</div>
                    <span>无正片</span>
                  </div>
              )}
              <Link href="/" className="m-btn">
                <div className="m-icon">🏠</div>
                <span>首页</span>
              </Link>
            </div>
            <style jsx>{`
                .m-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 40px 20px; background: linear-gradient(transparent, rgba(0,0,0,0.9)); display: flex; justify-content: space-between; align-items: flex-end; pointer-events: none; }
                .m-info { max-width: 70%; }
                .m-title { font-size: 18px; margin-bottom: 8px; font-weight: 600; }
                .m-meta { font-size: 14px; opacity: 0.7; }
                .m-actions { display: flex; flex-direction: column; gap: 20px; pointer-events: auto; }
                .m-btn { display: flex; flex-direction: column; align-items: center; gap: 5px; color: #fff; text-decoration: none; }
                .m-icon { width: 45px; height: 45px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; backdrop-filter: blur(10px); }
                .m-btn span { font-size: 12px; }
            `}</style>
        </div>
    );
}

export default function ReelsPage() {
    return (
        <Suspense fallback={<div className="loading-state">🌚 正在加载大片解说...</div>}>
            <ReelsContent />
        </Suspense>
    )
}
