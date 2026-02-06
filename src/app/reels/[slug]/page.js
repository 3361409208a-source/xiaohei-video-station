'use client';
import React, { useState, useEffect, useRef, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function PlayerContent({ paramsPromise }) {
  let slug = null;
  try {
    const params = use(paramsPromise);
    slug = params.slug ? decodeURIComponent(params.slug) : null;
  } catch(e) {}

  const searchParams = useSearchParams();
  const currentId = slug ? slug.split('-').pop() : searchParams.get('id');
  const currentSrc = searchParams.get('src');

  const [mainVideo, setMainVideo] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [originalMovie, setOriginalMovie] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(true);
  const playerRef = useRef(null);
  const dpInstance = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const initPlayer = async () => {
      setLoading(true);
      try {
        let targetVideo = null;
        if (currentId && currentSrc) {
            const res = await fetch(`/api/detail?id=${currentId}&src=${encodeURIComponent(currentSrc)}`);
            targetVideo = await res.json();
            if (targetVideo) {
                targetVideo.source_name = currentSrc;
                targetVideo.id = currentId;
            }
        } else {
            const res = await fetch('/api/search?t=解说&pg=1');
            const data = await res.json();
            if (data.length > 0) {
                const first = data[0];
                const detailRes = await fetch(`/api/detail?id=${first.id}&src=${encodeURIComponent(first.source_name || first.source)}`);
                targetVideo = await detailRes.json();
                targetVideo.source_name = first.source_name || first.source;
                targetVideo.id = first.id;
            }
        }

        if (targetVideo) {
            setMainVideo(targetVideo);
            const cleanTitle = targetVideo.title.replace('[电影解说]', '').replace('电影解说', '').trim();
            fetch(`/api/search?q=${encodeURIComponent(cleanTitle)}`)
              .then(res => res.json())
              .then(searchData => {
                const original = searchData.find(item => !item.category.includes('解说') && !item.title.includes('解说'));
                setOriginalMovie(original);
              });
        }

        fetch('/api/search?t=解说&pg=1')
          .then(res => res.json())
          .then(data => {
            setRecommendations(data.filter(v => v.id !== (currentId || (targetVideo?.id))).slice(0, 6));
          });

      } catch (e) {
          console.error("Init player failed", e);
      }
      setLoading(false);
    };

    initPlayer();
    return () => window.removeEventListener('resize', checkMobile);
  }, [currentId, currentSrc]);

  useEffect(() => {
    if (typeof window !== 'undefined' && mainVideo?.episodes?.[0]?.url) {
      const videoUrl = mainVideo.episodes[0].url;
      
      if (videoUrl.includes('.m3u8') || videoUrl.includes('.mp4')) {
        Promise.all([
          import('hls.js'),
          import('dplayer')
        ]).then(([HlsModule, DPlayerModule]) => {
          const Hls = HlsModule.default;
          const DPlayer = DPlayerModule.default;

          if (dpInstance.current) {
            dpInstance.current.switchVideo({ url: videoUrl, type: 'hls' });
          } else if (playerRef.current) {
            dpInstance.current = new DPlayer({
              container: playerRef.current,
              autoplay: true,
              theme: '#e11d48',
              video: { url: videoUrl, type: 'hls' }
            });
          }
        });
      }
    }

    return () => {
      if (dpInstance.current) {
        dpInstance.current.destroy();
        dpInstance.current = null;
      }
    };
  }, [mainVideo, isMobile]);

  if (loading && !mainVideo) return <div className="loading-screen-full">🌚 正在连接解说信号...</div>;

  if (!isMobile) {
    return (
      <div className="dark-player-page">
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

        <main className="player-grid container">
          <div className="left-zone">
            <div className="video-viewport">
              {mainVideo?.episodes?.[0]?.url ? (
                mainVideo.episodes[0].url.includes('.m3u8') || mainVideo.episodes[0].url.includes('.mp4') ? (
                  <div ref={playerRef} style={{ width:'100%', height:'100%' }}></div>
                ) : (
                  <iframe src={mainVideo.episodes[0].url} style={{ width:'100%', height:'100%', border:'none' }} allowFullScreen />
                )
              ) : <div className="no-signal">信号丢失，请尝试换线</div>}
            </div>
            
            <div className="video-meta-box">
              <div className="title-row">
                <h1>{mainVideo?.title.replace('[电影解说]', '')}</h1>
                {originalMovie && (
                  <Link href={`/movie/${encodeURIComponent(`${originalMovie.title}-${originalMovie.id}`)}?src=${encodeURIComponent(originalMovie.source_name)}`} className="btn-play-original">
                    🎬 播完整正片
                  </Link>
                )}
              </div>
              <div className="meta-info-list">
                <span className="tag">{mainVideo?.category}</span>
                <span className="source-tag">来源：{currentSrc || mainVideo?.source_name}</span>
                <div className="description-text">
                    <strong>解说简介：</strong>
                    {mainVideo?.description || '暂无内容简介'}
                </div>
              </div>
            </div>
          </div>

          <div className="right-sidebar">
            <div className="sidebar-header-row">
              <h3>推荐解说</h3>
              <button className="btn-refresh" onClick={() => {
                fetch(`/api/search?t=解说&pg=${Math.floor(Math.random()*15)+1}`)
                  .then(res => res.json())
                  .then(data => setRecommendations(data.slice(0, 6)));
              }}>🔄 换一批</button>
            </div>
            <div className="recommendation-column">
              {recommendations.map(v => (
                <Link key={v.id} href={`/reels/${encodeURIComponent(`${v.title}-${v.id}`)}?src=${encodeURIComponent(v.source)}`} className="rec-card-mini">
                  <div className="thumb"><img src={v.poster} alt="" /></div>
                  <div className="text-content">
                    <h4>{v.title.replace('[电影解说]', '')}</h4>
                    <p>{v.year} · {v.source}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </main>

        <style jsx>{`
          .dark-player-page { background: var(--bg-main); min-height: 100vh; color: var(--text-main); }
          .dark-player-page :global(a) { text-decoration: none !important; }
          .player-grid { display: grid; grid-template-columns: 1fr 350px; gap: 30px; padding-top: 30px; padding-bottom: 50px; }
          .left-zone { min-width: 0; }
          .video-viewport { background: #000; border-radius: 12px; overflow: hidden; aspect-ratio: 16/9; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
          .no-signal { height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-dim); }
          
          .video-meta-box { margin-top: 24px; background: var(--bg-card); padding: 24px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); }
          .title-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; gap: 20px; }
          .title-row h1 { font-size: 24px; font-weight: 800; color: #fff; line-height: 1.3; }
          .btn-play-original { background: var(--primary); color: #fff !important; padding: 10px 24px; border-radius: 10px; font-weight: 700; transition: all 0.3s; box-shadow: 0 4px 15px rgba(225, 29, 72, 0.3); white-space: nowrap; flex-shrink: 0; }
          .btn-play-original:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(225, 29, 72, 0.5); opacity: 1; }
          
          .meta-info-list { display: flex; flex-direction: column; gap: 12px; color: var(--text-dim); font-size: 14px; }
          .tag { color: var(--primary); font-weight: 700; background: rgba(225, 29, 72, 0.1); padding: 2px 8px; border-radius: 4px; align-self: flex-start; }
          .description-text { margin-top: 10px; line-height: 1.7; color: #a1a1aa; border-top: 1px solid rgba(255,255,255,0.05); paddingTop: 15px; }
          
          .right-sidebar { flex-shrink: 0; }
          .sidebar-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 15px; }
          .sidebar-header-row h3 { font-size: 16px; font-weight: 700; }
          .btn-refresh { background: none; border: 1px solid var(--primary); color: var(--primary); cursor: pointer; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px; transition: 0.3s; }
          .btn-refresh:hover { background: var(--primary); color: #fff; }
          
          .recommendation-column { display: flex; flex-direction: column; gap: 12px; }
          .rec-card-mini { display: flex; gap: 12px; text-decoration: none !important; padding: 6px; border-radius: 10px; transition: 0.2s; border: 1px solid transparent; align-items: flex-start; }
          .rec-card-mini:hover { background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.05); }
          .thumb { width: 140px; aspect-ratio: 16/9; border-radius: 6px; overflow: hidden; background: #1a1a1a; flex-shrink: 0; position: relative; }
          .thumb img { width: 100%; height: 100%; object-fit: cover; }
          .text-content { flex: 1; min-width: 0; padding-top: 2px; }
          .text-content h4 { font-size: 14px; color: #e4e4e7; margin-bottom: 6px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-weight: 600; }
          .text-content p { font-size: 12px; color: var(--text-dim); }

          .loading-screen-full { height: 100vh; background: var(--bg-main); display: flex; align-items: center; justify-content: center; color: var(--primary); font-weight: 700; font-size: 20px; }

          @media (max-width: 1200px) { .player-grid { grid-template-columns: 1fr; } .right-sidebar { width: 100%; } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="mobile-feed-container" ref={containerRef} style={{ height: '100vh', overflowY: 'scroll', scrollSnapType: 'y mandatory', background: '#000' }}>
      <div className="feed-item" style={{ height: '100vh', scrollSnapAlign: 'start', position: 'relative' }}>
          <iframe src={`https://p.cdn.it/player.html?url=${encodeURIComponent(mainVideo?.episodes?.[0]?.url || '')}`} style={{ width:'100%', height:'100%', border:'none' }} allowFullScreen />
          <MobileOverlay video={mainVideo} original={originalMovie} />
      </div>
      {recommendations.map(v => (
        <div key={v.id} className="feed-item" style={{ height: '100vh', scrollSnapAlign: 'start', position: 'relative' }}>
            <div style={{ width:'100%', height:'100%', backgroundImage: `url(${v.poster})`, backgroundSize: 'cover', backgroundPosition:'center', opacity:0.3, filter: 'blur(10px)' }} />
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyConten:'center', color:'#fff' }}>
                <Link href={`/reels/${encodeURIComponent(`${v.title}-${v.id}`)}?src=${encodeURIComponent(v.source)}`} style={{ color:'#fff', textDecoration:'none', border:'1px solid var(--primary)', padding:'12px 30px', borderRadius:'100px', background: 'rgba(225, 29, 72, 0.2)', backdropFilter:'blur(5px)' }}>
                    点击滑入此条
                </Link>
            </div>
        </div>
      ))}
    </div>
  );
}

function MobileOverlay({ video, original }) {
    return (
        <div className="m-overlay">
            <div className="m-info">
              <h3>{video?.title.replace('[电影解说]', '')}</h3>
              <p>{video?.category} · {video?.year}</p>
            </div>
            <div className="m-actions">
              {original ? (
                  <Link href={`/movie/${encodeURIComponent(`${original.title}-${original.id}`)}?src=${encodeURIComponent(original.source_name)}`} className="m-btn highlight">
                    <div className="m-icon">🎬</div><span>正片</span>
                  </Link>
              ) : null}
              <Link href="/" className="m-btn"><div className="m-icon">🏠</div><span>首页</span></Link>
            </div>
            <style jsx>{`
                .m-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 40px 20px; background: linear-gradient(transparent, rgba(0,0,0,0.95)); display: flex; justify-content: space-between; align-items: flex-end; z-index: 10; pointer-events: none; }
                .m-info { max-width: 70%; color: #fff; }
                .m-actions { display: flex; flex-direction: column; gap: 20px; pointer-events: auto; }
                .m-btn { display: flex; flex-direction: column; align-items: center; gap: 5px; color: #fff; text-decoration: none; }
                .m-icon { width: 50px; height: 50px; background: rgba(255,255,255,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); }
                .m-btn.highlight .m-icon { background: var(--primary); border-color: var(--primary); }
                .m-btn span { font-size: 11px; font-weight: 600; }
            `}</style>
        </div>
    );
}

export default function PlayerPage({ params }) {
  return (
    <Suspense fallback={<div style={{ height:'100vh', background:'#0a0a0a', display:'flex', alignItems:'center', justifyConten:'center', color:'#e11d48' }}>🌚 全速加载中...</div>}>
      <PlayerContent paramsPromise={params} />
    </Suspense>
  );
}
