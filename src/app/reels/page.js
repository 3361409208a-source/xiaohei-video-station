'use client';
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';

function PlayerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const playerRef = useRef(null);
  const dpInstance = useRef(null);
  const containerRef = useRef(null);
  const isFetchingRef = useRef(false);

  const getUrlData = () => {
    const slug = params?.slug ? decodeURIComponent(params.slug) : null;
    const idFromSlug = slug ? slug.split('-').pop() : null;
    return {
        id: idFromSlug || searchParams.get('id'),
        src: searchParams.get('src')
    };
  };

  const [currentId, setCurrentId] = useState(getUrlData().id);
  const [currentSrc, setCurrentSrc] = useState(getUrlData().src);
  const [mainVideo, setMainVideo] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [isDescCollapsed, setIsDescCollapsed] = useState(true);

  // 初始化推荐列表
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    const randomPage = Math.floor(Math.random() * 15) + 1;
    fetch(`/api/search?t=解说&pg=${randomPage}&_ts=${Date.now()}`)
      .then(res => res.json())
      .then(data => setRecommendations(data.slice(0, 10))); // 增加推荐数量，方便滑动

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 监听 URL 变化
  useEffect(() => {
    const { id, src } = getUrlData();
    if (id && id !== currentId) setCurrentId(id);
    if (src && src !== currentSrc) setCurrentSrc(src);
  }, [params, searchParams]);

  // 加载主视频数据
  useEffect(() => {
    const loadVideo = async () => {
      if (isFetchingRef.current) return;
      if (!currentId) {
          const res = await fetch('/api/search?t=解说&pg=1');
          const data = await res.json();
          if (data && data.length > 0) {
              const target = data[0];
              router.replace(`/reels/${encodeURIComponent(`${target.title}-${target.id}`)}?src=${encodeURIComponent(target.source_name || target.source)}`);
          }
          return;
      }

      isFetchingRef.current = true;
      setSwitching(true);
      try {
        const res = await fetch(`/api/detail?id=${currentId}&src=${encodeURIComponent(currentSrc)}`);
        const data = await res.json();
        if (data && data.title) {
            setMainVideo(data);
            const cleanTitle = data.title.replace('[电影解说]', '').replace('电影解说', '').trim();
            const sRes = await fetch(`/api/search?q=${encodeURIComponent(cleanTitle)}`);
            const sData = await sRes.json();
            setSearchResults(sData.filter(item => !item.category.includes('解说') && !item.title.includes('解说')));
        }
      } catch (e) {}
      setLoading(false);
      setSwitching(false);
      isFetchingRef.current = false;
    };
    loadVideo();
  }, [currentId, currentSrc]);

  // 播放器渲染逻辑
  useEffect(() => {
    if (typeof window !== 'undefined' && mainVideo?.episodes?.[0]?.url) {
      const videoUrl = mainVideo.episodes[0].url;
      const isHls = videoUrl.includes('.m3u8');
      
      Promise.all([import('hls.js'), import('dplayer')]).then(([HlsModule, DPlayerModule]) => {
        const DPlayer = DPlayerModule.default;
        if (dpInstance.current) {
            dpInstance.current.switchVideo({ url: videoUrl, type: isHls ? 'hls' : 'normal' });
            dpInstance.current.play();
        } else if (playerRef.current) {
            dpInstance.current = new DPlayer({
                container: playerRef.current,
                autoplay: true,
                theme: '#e11d48',
                loop: true,
                video: { url: videoUrl, type: isHls ? 'hls' : 'normal' }
            });
        }
      });
    }
  }, [mainVideo]);

  // 移动端：监听滚动切换
  const handleMobileScroll = () => {
    if (!containerRef.current || !isMobile) return;
    const scrollTop = containerRef.current.scrollTop;
    const height = window.innerHeight;
    const index = Math.round(scrollTop / height);
    
    if (index > 0 && recommendations[index - 1]) {
        const target = recommendations[index - 1];
        if (target.id !== currentId) {
            handleSwitch(target);
        }
    } else if (index === 0 && mainVideo && currentId !== getUrlData().id) {
        // 回到顶部首个
    }
  };

  const handleSwitch = (v) => {
    const newSrc = v.source_name || v.source;
    const newSlug = encodeURIComponent(`${v.title}-${v.id}`);
    window.history.pushState(null, '', `/reels/${newSlug}?src=${encodeURIComponent(newSrc)}`);
    setCurrentId(v.id);
    setCurrentSrc(newSrc);
  };

  const playFilmDirectly = (film) => {
    const newSrc = film.source_name || film.source;
    const newSlug = encodeURIComponent(`${film.title}-${film.id}`);
    router.push(`/reels/${newSlug}?src=${encodeURIComponent(newSrc)}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const stripHtml = (html) => {
    if (!html) return "";
    return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
  };

  const toggleMoyu = () => {
    if (dpInstance.current && dpInstance.current.video) {
        if (document.pictureInPictureElement) {
            document.exitPictureInPicture();
        } else {
            dpInstance.current.video.requestPictureInPicture().catch(() => alert("不支持摸鱼模式"));
        }
    }
  };

  if (loading && !mainVideo) return <div className="loading-screen-full">🌚 正在连接解说信号...</div>;

  return (
    <div className={isMobile ? "mobile-reels-page" : "dark-player-page"}>
      {/* PC 端 */}
      {!isMobile && (
        <>
          <header className="site-header">
            <div className="container header-inner">
              <Link href="/" className="logo-area">
                <img src="/logo.png" alt="logo" className="logo-img" />
                <div className="logo-text">小黑<span>搜影</span></div>
              </Link>
              <nav className="nav-links">
                {['首页', '🔥 去看解说', '电影', '电视剧', '短剧', '动漫'].map(name => (
                  <Link key={name} href={name === '首页' ? '/' : (name.includes('解说') ? '/reels' : `/channel/${name}`)} className={`nav-link ${name.includes('解说') ? 'special-link' : ''}`}>{name}</Link>
                ))}
              </nav>
            </div>
          </header>
          <main className="player-grid container">
            <div className="left-zone">
              <div className="video-viewport">
                <div ref={playerRef} style={{ width:'100%', height:'100%' }}></div>
                {switching && <div className="switching-overlay">🌚 正在秒切中...</div>}
              </div>
              <div className="video-meta-box">
                <div className="title-row">
                  <div className="title-text-group">
                    <h1 className="v-primary-title">{mainVideo?.title.replace('[电影解说]', '')}</h1>
                    <p className="v-subtitle">{mainVideo?.category} · {currentSrc}</p>
                  </div>
                  <div className="action-button-group">
                    <button onClick={toggleMoyu} className="moyu-action-btn">🐟 摸鱼模式</button>
                    <div className="premium-btn-container" style={{ minWidth: '160px' }}>
                      {searchResults.length > 0 && (
                        <button onClick={() => playFilmDirectly(searchResults[0])} className="premium-play-btn">
                          <span className="icon">⚡</span><span className="text">观看正片</span><div className="btn-glow"></div>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="description-section">
                  <div className="desc-label">内 容 详 情</div>
                  <p className={`desc-content ${isDescCollapsed ? 'collapsed' : ''}`}>{stripHtml(mainVideo?.description)}</p>
                  <div className="toggle-btn" onClick={() => setIsDescCollapsed(!isDescCollapsed)}>{isDescCollapsed ? '展开详情 ▾' : '收起详情 ▴'}</div>
                </div>
                {searchResults.length > 0 && (
                  <div className="search-results-list">
                    <div className="results-header">相关正片资源 ({searchResults.length})</div>
                    <div className="results-grid">
                      {searchResults.map(film => (
                        <div key={film.id} className="result-card" onClick={() => playFilmDirectly(film)}>
                          <div className="result-thumb"><img src={film.poster} /></div>
                          <div className="result-info">
                            <div className="result-title">{film.title}</div>
                            <div className="result-meta">{film.year} · {film.source_name || film.source}</div>
                          </div>
                          <div className="play-btn-mini">立即播放</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="right-sidebar">
              <div className="sticky-sidebar">
                <div className="sidebar-header-row">
                  <h3>推荐解说</h3>
                  <button className="btn-refresh" onClick={() => {
                    const rp = Math.floor(Math.random()*20)+1;
                    fetch(`/api/search?t=解说&pg=${rp}`).then(res => res.json()).then(data => setRecommendations(data.slice(0, 6)));
                  }}>🔄 换一批</button>
                </div>
                <div className="recommendation-column">
                  {recommendations.map(v => (
                    <div key={v.id} onClick={() => handleSwitch(v)} className={`rec-card-mini ${currentId === v.id ? 'active' : ''}`}>
                      <div className="thumb"><img src={v.poster} alt="" /></div>
                      <div className="text-content"><h4>{v.title.replace('[电影解说]', '')}</h4><p>{v.year} · {v.source}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>
        </>
      )}

      {/* 移动端：极致性能 抖音滑屏 */}
      {isMobile && (
        <div className="mobile-reels-scroll-container" ref={containerRef} onScroll={handleMobileScroll}>
          {/* 1. 当前主播放器屏 */}
          <div className="reel-view-snap">
            <div className="player-host-mobile">
                <div ref={playerRef} style={{ width:'100%', height:'100%' }}></div>
                {switching && <div className="mobile-loading-tip">正在秒切...</div>}
            </div>
            <MobileOverlay video={mainVideo} searchResults={searchResults} playFilmDirectly={playFilmDirectly} toggleMoyu={toggleMoyu} />
          </div>
          
          {/* 2. 预加载占位屏 */}
          {recommendations.map((v) => (
            <div key={v.id} className="reel-view-snap">
              <div className="reel-placeholder" style={{ backgroundImage: `url(${v.poster})` }}>
                <div className="blur-overlay"></div>
                <div className="loading-center">🌚 准备加载下一条...</div>
              </div>
              <div className="m-overlay mini-overlay">
                <div className="m-info"><h3>{v.title.replace('[电影解说]', '')}</h3></div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .dark-player-page { background: var(--bg-main); min-height: 100vh; color: var(--text-main); }
        .dark-player-page :global(a) { text-decoration: none !important; }
        .player-grid { display: grid; grid-template-columns: 1fr 350px; gap: 40px; padding-top: 30px; padding-bottom: 50px; align-items: start; }
        .left-zone { min-width: 0; }
        .video-viewport { background: #000; border-radius: 16px; overflow: hidden; aspect-ratio: 16/9; border: 1px solid rgba(255,255,255,0.05); position: relative; box-shadow: 0 30px 60px rgba(0,0,0,0.6); }
        .switching-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10; color: var(--primary); font-weight: 800; font-size: 20px; }
        .video-meta-box { margin-top: 30px; background: var(--bg-card); padding: 30px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.03); }
        .title-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; gap: 30px; }
        .v-primary-title { font-size: 24px; font-weight: 900; color: #fff; line-height: 1.2; margin-bottom: 8px; }
        .v-subtitle { color: var(--text-dim); font-size: 13px; }
        .action-button-group { display: flex; gap: 15px; align-items: center; }
        .moyu-action-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #ccc; padding: 10px 18px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: 0.3s; }
        .premium-play-btn { border:none; cursor:pointer; position: relative; background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); color: #fff !important; padding: 12px 24px; border-radius: 12px; font-weight: 800; display: flex; align-items: center; gap: 10px; transition: 0.3s; white-space: nowrap; width: 100%; justify-content: center; }
        .premium-play-btn:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(225,29,72,0.4); }
        .btn-glow { position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent); transition: 0.5s; }
        .description-section { border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px; margin-bottom: 30px; position: relative; }
        .desc-label { font-size: 11px; color: var(--primary); font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; }
        .desc-content { line-height: 1.8; color: #a1a1aa; font-size: 14px; }
        .desc-content.collapsed { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
        .toggle-btn { color: var(--primary); font-size: 12px; font-weight: 700; cursor: pointer; margin-top: 8px; text-align: center; }
        .search-results-list { border-top: 2px solid rgba(225, 29, 72, 0.1); padding-top: 25px; }
        .results-header { font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 15px; }
        .results-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
        .result-card { background: rgba(255,255,255,0.015); padding: 10px; border-radius: 10px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: 0.2s; }
        .result-card:hover { background: rgba(225,29,72,0.05); transform: translateX(5px); }
        .result-thumb { width: 50px; aspect-ratio: 2/3; border-radius: 4px; overflow: hidden; flex-shrink: 0; }
        .result-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .result-info { flex: 1; }
        .result-title { color: #fff; font-size: 14px; font-weight: 600; margin-bottom: 3px; }
        .result-meta { font-size: 11px; color: var(--text-dim); }
        .play-btn-mini { font-size: 11px; color: var(--primary); font-weight: 800; border: 1px solid var(--primary); padding: 3px 10px; border-radius: 100px; }
        .right-sidebar { flex-shrink: 0; width: 350px; }
        .sticky-sidebar { position: sticky; top: 100px; }
        .sidebar-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px; }
        .sidebar-header-row h3 { font-size: 15px; font-weight: 800; }
        .btn-refresh { background: rgba(225, 29, 72, 0.1); border: 1px solid rgba(225, 29, 72, 0.2); color: var(--primary); cursor: pointer; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 100px; }
        .recommendation-column { display: flex; flex-direction: column; gap: 10px; }
        .rec-card-mini { display: flex; gap: 10px; cursor: pointer; padding: 8px; border-radius: 10px; transition: 0.2s; align-items: flex-start; }
        .rec-card-mini:hover { background: rgba(255,255,255,0.03); transform: translateX(3px); }
        .rec-card-mini.active { background: rgba(225, 29, 72, 0.05); border: 1px solid rgba(225, 29, 72, 0.1); }
        .thumb { width: 120px; aspect-ratio: 16/9; border-radius: 6px; overflow: hidden; background: #1a1a1a; flex-shrink: 0; }
        .thumb img { width: 100%; height: 100%; object-fit: cover; }
        .text-content h4 { font-size: 13px; color: #e4e4e7; margin-bottom: 4px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-weight: 700; }
        .text-content p { font-size: 11px; color: var(--text-dim); }
        .loading-screen-full { height: 100vh; background: var(--bg-main); display: flex; align-items: center; justify-content: center; color: var(--primary); font-weight: 900; font-size: 22px; }

        /* 移动端核心样式 */
        .mobile-reels-scroll-container { height: 100vh; overflow-y: scroll; scroll-snap-type: y mandatory; background: #000; -webkit-overflow-scrolling: touch; scroll-behavior: smooth; }
        .reel-view-snap { height: 100vh; width: 100%; scroll-snap-align: start; position: relative; overflow: hidden; }
        .player-host-mobile { width: 100%; height: 100%; position: relative; z-index: 1; }
        .mobile-loading-tip { position: absolute; top: 20%; left: 50%; transform: translateX(-50%); color: var(--primary); font-weight: bold; z-index: 5; }
        .reel-placeholder { width: 100%; height: 100%; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; position: relative; }
        .blur-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(20px); }
        .loading-center { position: relative; z-index: 2; color: #fff; font-size: 14px; opacity: 0.6; }

        .m-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 50px 20px; background: linear-gradient(transparent, rgba(0,0,0,0.98)); display: flex; justify-content: space-between; align-items: flex-end; z-index: 10; pointer-events: none; }
        .mini-overlay { padding: 80px 20px 40px; }
        .m-info { max-width: 70%; color: #fff; }
        .m-info h3 { font-size: 20px; font-weight: 900; margin-bottom: 8px; }
        .m-actions { display: flex; flex-direction: column; gap: 24px; pointer-events: auto; }
        .m-btn-premium, .m-btn-normal { display: flex; flex-direction: column; align-items: center; gap: 6px; color: #fff; text-decoration: none; cursor: pointer; }
        .m-icon-inner { width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; backdrop-filter: blur(10px); background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); }
        .m-btn-premium .m-icon-inner { background: var(--primary); border-color: var(--primary); box-shadow: 0 0 20px rgba(225, 29, 72, 0.6); }
        .m-btn-premium span { font-weight: 800; color: var(--primary); background: #fff; padding: 2px 8px; border-radius: 4px; transform: scale(0.8); }
        .m-btn-normal span { font-size: 11px; font-weight: 600; opacity: 0.8; }

        @media (max-width: 1200px) { .player-grid { grid-template-columns: 1fr; } .right-sidebar { width: 100%; } .sticky-sidebar { position: static; } }
      `}</style>
    </div>
  );
}

function MobileOverlay({ video, searchResults, playFilmDirectly, toggleMoyu }) {
    return (
        <div className="m-overlay">
            <div className="m-info">
              <h3>{video?.title.replace('[电影解说]', '')}</h3>
              <p>{video?.category} · {video?.year}</p>
            </div>
            <div className="m-actions">
              <div onClick={toggleMoyu} className="m-btn-normal">
                <div className="m-icon-inner">🐟</div><span>摸鱼</span>
              </div>
              {searchResults.length > 0 ? (
                  <div onClick={() => playFilmDirectly(searchResults[0])} className="m-btn-premium">
                    <div className="m-icon-inner">⚡</div><span>正片</span>
                  </div>
              ) : null}
              <Link href="/" className="m-btn-normal"><div className="m-icon-inner">🏠</div><span>首页</span></Link>
            </div>
        </div>
    );
}

export default function GenericPlayerPage() {
  return (
    <Suspense fallback={<div style={{ height:'100vh', background:'#0a0a0a', display:'flex', alignItems:'center', justifyContent:'center', color:'#e11d48' }}>🌚 全速加载中...</div>}>
      <PlayerContent />
    </Suspense>
  );
}
