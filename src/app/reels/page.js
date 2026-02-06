'use client';
import React, { useState, useEffect, useRef, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function PlayerContent({ paramsPromise }) {
  const router = useRouter();
  let slug = null;
  try {
    const params = use(paramsPromise);
    slug = params.slug ? decodeURIComponent(params.slug) : null;
  } catch(e) {}

  const searchParams = useSearchParams();
  const [currentId, setCurrentId] = useState(slug ? slug.split('-').pop() : searchParams.get('id'));
  const [currentSrc, setCurrentSrc] = useState(searchParams.get('src'));

  const [mainVideo, setMainVideo] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [originalMovie, setOriginalMovie] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  
  const playerRef = useRef(null);
  const dpInstance = useRef(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    fetchRecs();
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchRecs = () => {
    // 随机获取一页，保持新鲜感
    const randomPage = Math.floor(Math.random() * 20) + 1;
    fetch(`/api/search?t=解说&pg=${randomPage}&_ts=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        setRecommendations(data.slice(0, 6));
      });
  };

  useEffect(() => {
    const loadVideo = async () => {
      let tid = currentId;
      let tsrc = currentSrc;

      if (!tid) {
          // 如果没有 ID，随机选一个视频作为开场
          const randomPage = Math.floor(Math.random() * 10) + 1;
          const res = await fetch(`/api/search?t=解说&pg=${randomPage}&_ts=${Date.now()}`);
          const data = await res.json();
          if (data.length > 0) {
              const randomIdx = Math.floor(Math.random() * data.length);
              const target = data[randomIdx];
              tid = target.id;
              tsrc = target.source_name || target.source;
              setCurrentId(tid);
              setCurrentSrc(tsrc);
          }
      }

      setSwitching(true);
      try {
        const res = await fetch(`/api/detail?id=${tid}&src=${encodeURIComponent(tsrc)}`);
        const data = await res.json();
        if (data) {
            setMainVideo(data);
            const cleanTitle = data.title.replace('[电影解说]', '').replace('电影解说', '').trim();
            fetch(`/api/search?q=${encodeURIComponent(cleanTitle)}`)
              .then(r => r.json())
              .then(searchData => {
                const original = searchData.find(item => !item.category.includes('解说') && !item.title.includes('解说'));
                setOriginalMovie(original);
              });
        }
      } catch (e) {}
      setLoading(false);
      setSwitching(false);
    };

    loadVideo();
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
            dpInstance.current.play();
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
  }, [mainVideo]);

  const handleSwitch = (v) => {
    setCurrentId(v.id);
    setCurrentSrc(v.source_name || v.source);
    const newSlug = encodeURIComponent(`${v.title}-${v.id}`);
    window.history.pushState(null, '', `/reels/${newSlug}?src=${encodeURIComponent(v.source_name || v.source)}`);
  };

  if (loading && !mainVideo) return <div className="loading-screen-full">🌚 正在为您连接解说信号...</div>;

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
                {['首页', '🔥 去看解说', '电影', '电视剧', '短剧', '动漫'].map(name => (
                    <Link key={name} href={name === '首页' ? '/' : (name === '🔥 去看解说' ? '/reels' : `/channel/${name}`)} 
                          className={`nav-link ${name === '🔥 去看解说' ? 'special-link' : ''}`}>
                    {name}
                    </Link>
                ))}
            </nav>
            </div>
        </header>

        <main className="player-grid container">
          <div className="left-zone">
            <div className="video-viewport">
              <div ref={playerRef} style={{ width:'100%', height:'100%', display: (mainVideo?.episodes?.[0]?.url?.includes('.m3u8') || mainVideo?.episodes?.[0]?.url?.includes('.mp4')) ? 'block' : 'none' }}></div>
              {!(mainVideo?.episodes?.[0]?.url?.includes('.m3u8') || mainVideo?.episodes?.[0]?.url?.includes('.mp4')) && mainVideo?.episodes?.[0]?.url && (
                  <iframe src={mainVideo.episodes[0].url} style={{ width:'100%', height:'100%', border:'none' }} allowFullScreen />
              )}
              {switching && <div className="switching-overlay">🌚 正在秒切线路...</div>}
            </div>
            
            <div className="video-meta-box">
              <div className="title-row">
                <div className="title-text-group">
                   <h1 className="v-primary-title">{mainVideo?.title.replace('[电影解说]', '')}</h1>
                   <p className="v-subtitle">{mainVideo?.category} · {currentSrc}</p>
                </div>
                {originalMovie && (
                  <Link href={`/movie/${encodeURIComponent(`${originalMovie.title}-${originalMovie.id}`)}?src=${encodeURIComponent(originalMovie.source_name)}`} className="premium-play-btn">
                    <span className="icon">⚡</span>
                    <span className="text">观看完整正片</span>
                    <div className="btn-glow"></div>
                  </Link>
                )}
              </div>
              <div className="description-section">
                <div className="desc-label">解说详情</div>
                <p className="desc-content">{mainVideo?.description || '精彩内容正在赶来...'}</p>
              </div>
            </div>
          </div>

          <div className="right-sidebar">
            <div className="sticky-sidebar">
                <div className="sidebar-header-row">
                <h3>推荐解说</h3>
                <button className="btn-refresh" onClick={() => {
                    fetch(`/api/search?t=解说&pg=${Math.floor(Math.random()*30)+1}`)
                    .then(res => res.json())
                    .then(data => setRecommendations(data.slice(0, 6)));
                }}>🔄 换一批</button>
                </div>
                <div className="recommendation-column">
                {recommendations.map(v => (
                    <div key={v.id} onClick={() => handleSwitch(v)} className={`rec-card-mini ${currentId === v.id ? 'active' : ''}`}>
                    <div className="thumb"><img src={v.poster} alt="" /></div>
                    <div className="text-content">
                        <h4>{v.title.replace('[电影解说]', '')}</h4>
                        <p>{v.year} · {v.source}</p>
                    </div>
                    </div>
                ))}
                </div>
            </div>
          </div>
        </main>

        <style jsx>{`
          .dark-player-page { background: var(--bg-main); min-height: 100vh; color: var(--text-main); }
          .dark-player-page :global(a) { text-decoration: none !important; }
          .player-grid { display: grid; grid-template-columns: 1fr 350px; gap: 40px; padding-top: 30px; padding-bottom: 50px; align-items: start; }
          .left-zone { min-width: 0; }
          .video-viewport { background: #000; border-radius: 16px; overflow: hidden; aspect-ratio: 16/9; border: 1px solid rgba(255,255,255,0.05); position: relative; box-shadow: 0 30px 60px rgba(0,0,0,0.6); }
          .switching-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10; color: var(--primary); font-weight: 800; font-size: 20px; letter-spacing: 2px; }
          
          .video-meta-box { margin-top: 30px; background: var(--bg-card); padding: 30px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.03); }
          .title-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; gap: 30px; }
          .v-primary-title { font-size: 26px; font-weight: 900; color: #fff; line-height: 1.2; margin-bottom: 8px; }
          .v-subtitle { color: var(--text-dim); font-size: 14px; font-weight: 500; }
          
          .premium-play-btn { position: relative; background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); color: #fff !important; padding: 14px 28px; border-radius: 14px; font-weight: 800; display: flex; align-items: center; gap: 10px; transition: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); overflow: hidden; white-space: nowrap; box-shadow: 0 10px 25px rgba(225, 29, 72, 0.4); }
          .premium-play-btn:hover { transform: translateY(-3px) scale(1.02); box-shadow: 0 15px 35px rgba(225, 29, 72, 0.6); }
          .premium-play-btn .icon { font-size: 18px; }
          .btn-glow { position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent); transition: 0.5s; }
          .premium-play-btn:hover .btn-glow { left: 100%; transition: 0.8s; }

          .description-section { border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px; }
          .desc-label { font-size: 12px; color: var(--primary); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
          .desc-content { line-height: 1.8; color: #a1a1aa; font-size: 15px; }
          
          .right-sidebar { flex-shrink: 0; }
          .sticky-sidebar { position: sticky; top: 100px; }
          .sidebar-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px; }
          .sidebar-header-row h3 { font-size: 16px; font-weight: 800; letter-spacing: 0.5px; }
          .btn-refresh { background: rgba(225, 29, 72, 0.1); border: 1px solid rgba(225, 29, 72, 0.2); color: var(--primary); cursor: pointer; font-size: 11px; font-weight: 700; padding: 5px 12px; border-radius: 100px; transition: 0.3s; }
          .btn-refresh:hover { background: var(--primary); color: #fff; }
          
          .recommendation-column { display: flex; flex-direction: column; gap: 12px; }
          .rec-card-mini { display: flex; gap: 12px; cursor: pointer; padding: 10px; border-radius: 12px; transition: 0.3s; border: 1px solid transparent; align-items: flex-start; }
          .rec-card-mini:hover { background: rgba(255,255,255,0.03); transform: translateX(5px); }
          .rec-card-mini.active { background: rgba(225, 29, 72, 0.08); border-color: rgba(225, 29, 72, 0.15); }
          .thumb { width: 130px; aspect-ratio: 16/9; border-radius: 8px; overflow: hidden; background: #1a1a1a; flex-shrink: 0; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
          .thumb img { width: 100%; height: 100%; object-fit: cover; }
          .text-content h4 { font-size: 14px; color: #e4e4e7; margin-bottom: 5px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-weight: 700; }
          .text-content p { font-size: 11px; color: var(--text-dim); font-weight: 500; }

          .loading-screen-full { height: 100vh; background: var(--bg-main); display: flex; align-items: center; justify-content: center; color: var(--primary); font-weight: 900; font-size: 22px; letter-spacing: 1px; }

          @media (max-width: 1200px) { .player-grid { grid-template-columns: 1fr; } .right-sidebar { width: 100%; } .sticky-sidebar { position: static; } }
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
            <div style={{ width:'100%', height:'100%', backgroundImage: `url(${v.poster})`, backgroundSize: 'cover', backgroundPosition:'center', opacity:0.3, filter: 'blur(15px)' }} />
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>
                <div onClick={() => handleSwitch(v)} style={{ color:'#fff', cursor:'pointer', border:'none', padding:'15px 35px', borderRadius:'100px', background: 'var(--primary)', fontWeight:'800', boxShadow: '0 0 30px rgba(225,29,72,0.6)' }}>
                    点击滑入此条
                </div>
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
                  <Link href={`/movie/${encodeURIComponent(`${original.title}-${original.id}`)}?src=${encodeURIComponent(original.source_name)}`} className="m-btn-premium">
                    <div className="m-icon-inner">⚡</div><span>正片</span>
                  </Link>
              ) : null}
              <Link href="/" className="m-btn-normal"><div className="m-icon-inner">🏠</div><span>首页</span></Link>
            </div>
            <style jsx>{`
                .m-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 50px 20px; background: linear-gradient(transparent, rgba(0,0,0,0.98)); display: flex; justify-content: space-between; align-items: flex-end; z-index: 10; pointer-events: none; }
                .m-info { max-width: 70%; color: #fff; }
                .m-info h3 { font-size: 22px; font-weight: 900; margin-bottom: 10px; text-shadow: 0 2px 10px rgba(0,0,0,0.5); }
                .m-actions { display: flex; flex-direction: column; gap: 24px; pointer-events: auto; }
                .m-btn-premium, .m-btn-normal { display: flex; flex-direction: column; align-items: center; gap: 6px; color: #fff; text-decoration: none; }
                .m-icon-inner { width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; backdrop-filter: blur(10px); background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); }
                .m-btn-premium .m-icon-inner { background: var(--primary); border-color: var(--primary); box-shadow: 0 0 20px rgba(225, 29, 72, 0.6); }
                .m-btn-premium span { font-weight: 800; color: var(--primary); background: #fff; padding: 2px 8px; border-radius: 4px; transform: scale(0.8); }
                .m-btn-normal span { font-size: 11px; font-weight: 600; opacity: 0.8; }
            `}</style>
        </div>
    );
}

export default function GenericPlayerPage({ params }) {
  return (
    <Suspense fallback={<div style={{ height:'100vh', background:'#0a0a0a', display:'flex', alignItems:'center', justifyContent:'center', color:'#e11d48' }}>🌚 全速加载中...</div>}>
      <PlayerContent paramsPromise={params} />
    </Suspense>
  );
}
