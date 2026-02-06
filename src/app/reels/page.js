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
  const scrollTimeoutRef = useRef(null);

  // 状态管理
  const [currentId, setCurrentId] = useState(null);
  const [currentSrc, setCurrentSrc] = useState(null);
  const [mainVideo, setMainVideo] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [preFetchedUrls, setPreFetchedUrls] = useState({}); // 预加载的播放地址池
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [isDescCollapsed, setIsDescCollapsed] = useState(true);

  // 1. 初始化环境与推荐列表
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // 预加载一波推荐
    const rp = Math.floor(Math.random() * 20) + 1;
    fetch(`/api/search?t=解说&pg=${rp}&_ts=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
          const recs = data.slice(0, 15);
          setRecommendations(recs);
          // 启动预加载：默默抓取前 3 个推荐位的播放地址
          recs.slice(0, 3).forEach(v => preFetchDetail(v.id, v.source_name || v.source));
      });

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 预加载工具函数
  const preFetchDetail = async (id, src) => {
    if (preFetchedUrls[id]) return;
    try {
        const res = await fetch(`/api/detail?id=${id}&src=${encodeURIComponent(src)}`);
        const data = await res.json();
        if (data?.episodes?.[0]?.url) {
            setPreFetchedUrls(prev => ({ ...prev, [id]: data.episodes[0].url }));
        }
    } catch(e) {}
  };

  // 2. 核心：同步 URL 与状态
  useEffect(() => {
    const slug = params?.slug ? decodeURIComponent(params.slug) : null;
    const id = slug ? slug.split('-').pop() : searchParams.get('id');
    const src = searchParams.get('src');
    
    if (id && id !== currentId) setCurrentId(id);
    if (src && src !== currentSrc) setCurrentSrc(src);
    
    if (!id && !isFetchingRef.current) {
        fetch('/api/search?t=解说&pg=1')
          .then(res => res.json())
          .then(data => {
            if (data.length > 0) {
              const target = data[Math.floor(Math.random() * 5)] || data[0];
              router.replace(`/reels/${encodeURIComponent(`${target.title}-${target.id}`)}?src=${encodeURIComponent(target.source)}`);
            }
          });
    }
  }, [params, searchParams, currentId, currentSrc]);

  // 3. 加载详情
  useEffect(() => {
    if (!currentId || !currentSrc) return;
    
    const loadDetail = async () => {
      setSwitching(true);
      try {
        const res = await fetch(`/api/detail?id=${currentId}&src=${encodeURIComponent(currentSrc)}`);
        const data = await res.json();
        if (data && data.title) {
            setMainVideo(data);
            const cleanT = data.title.replace('[电影解说]', '').replace('电影解说', '').trim();
            fetch(`/api/search?q=${encodeURIComponent(cleanT)}`)
              .then(r => r.json())
              .then(sData => {
                  setSearchResults(sData.filter(i => !i.category.includes('解说') && !i.title.includes('解setSearchResults')));
                  setSearchResults(sData.filter(i => !i.category.includes('解说') && !i.title.includes('解说')));
              });
            
            // 加载当前后，顺便预加载下一条
            const currentIdx = recommendations.findIndex(v => v.id === currentId);
            if (currentIdx !== -1 && recommendations[currentIdx+1]) {
                const next = recommendations[currentIdx+1];
                preFetchDetail(next.id, next.source_name || next.source);
            }
        }
      } catch (e) {}
      setLoading(false);
      setSwitching(false);
    };
    loadDetail();
  }, [currentId, currentSrc]);

  // 4. 播放器渲染
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

  const handleSwitch = (v) => {
    const newSrc = v.source_name || v.source;
    const newSlug = encodeURIComponent(`${v.title}-${v.id}`);
    window.history.pushState(null, '', `/reels/${newSlug}?src=${encodeURIComponent(newSrc)}`);
    setCurrentId(v.id);
    setCurrentSrc(newSrc);
  };

  const playOriginal = (film) => {
    const newSrc = film.source_name || film.source;
    const newSlug = encodeURIComponent(`${film.title}-${film.id}`);
    window.history.pushState(null, '', `/reels/${newSlug}?src=${encodeURIComponent(newSrc)}`);
    setCurrentId(film.id);
    setCurrentSrc(newSrc);
    if (!isMobile) window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleMoyu = () => {
    if (dpInstance.current?.video) {
        if (document.pictureInPictureElement) document.exitPictureInPicture();
        else dpInstance.current.video.requestPictureInPicture().catch(() => alert("不支持摸鱼模式"));
    }
  };

  // 移动端滚动防抖切换
  const handleMobileScroll = () => {
    if (!containerRef.current || !isMobile) return;
    
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    
    scrollTimeoutRef.current = setTimeout(() => {
        const index = Math.round(containerRef.current.scrollTop / window.innerHeight);
        if (index > 0 && recommendations[index-1]) {
            const target = recommendations[index-1];
            if (target.id !== currentId) handleSwitch(target);
        }
    }, 150); // 150ms 停稳后再加载，防止滑动过程中疯狂请求
  };

  if (loading && !mainVideo) return <div className="loading-full">🌚 正在为您连接信号...</div>;

  return (
    <div className={isMobile ? "mobile-reels-page" : "pc-player-page"}>
      {!isMobile && (
        <>
          <header className="site-header">
            <div className="container header-inner">
              <Link href="/" className="logo-area">
                <img src="/logo.png" alt="logo" className="logo-img" />
                <div className="logo-text">小黑<span>搜影</span></div>
              </Link>
              <nav className="nav-links">
                {['首页', '🔥 去看解说', '电影', '电视剧', '短剧', '动漫'].map(n => (
                  <Link key={n} href={n==='首页'?'/':(n.includes('解说')?'/reels':`/channel/${n}`)} 
                        className={`nav-link ${n.includes('解说')?'special-link':''}`}>{n}</Link>
                ))}
              </nav>
            </div>
          </header>
          <main className="container player-grid">
            <div className="left-zone">
              <div className="video-viewport">
                <div ref={playerRef} style={{ width:'100%', height:'100%' }}></div>
                {switching && <div className="player-overlay">🌚 正在切片中...</div>}
              </div>
              <div className="meta-card">
                <div className="title-row">
                  <div className="title-grp">
                    <h1>{mainVideo?.title?.replace('[电影解说]','')}</h1>
                    <p>{mainVideo?.category} · {currentSrc}</p>
                  </div>
                  <div className="action-grp">
                    <button onClick={toggleMoyu} className="moyu-btn">🐟 摸鱼模式</button>
                    <div className="original-btn-placeholder">
                        {searchResults.length > 0 && (
                        <button onClick={() => playOriginal(searchResults[0])} className="premium-flash-btn">
                            <span className="icon">⚡</span><span>观看正片</span><div className="btn-glow"></div>
                        </button>
                        )}
                    </div>
                  </div>
                </div>
                <div className="desc-box">
                  <label>内 容 详 情</label>
                  <p className={isDescCollapsed ? 'line-1' : ''}>
                    {mainVideo?.description?.replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ') || '暂无简介'}
                  </p>
                  <div className="toggle" onClick={() => setIsDescCollapsed(!isDescCollapsed)}>
                    {isDescCollapsed ? '展开详情 ▾' : '收起详情 ▴'}
                  </div>
                </div>
                {searchResults.length > 0 && (
                  <div className="alt-resources">
                    <h3>相关正片资源 ({searchResults.length})</h3>
                    <div className="res-list">
                      {searchResults.map(f => (
                        <div key={f.id} className="res-card" onClick={() => playOriginal(f)}>
                          <img src={f.poster} />
                          <div className="res-info">
                            <div className="res-title">{f.title}</div>
                            <div className="res-meta">{f.year} · {f.source_name || f.source}</div>
                          </div>
                          <div className="res-btn">立即播放</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="right-sidebar">
              <div className="sticky-box">
                <div className="side-head"><h3>推荐解说</h3><button onClick={() => {
                  fetch(`/api/search?t=解说&pg=${Math.floor(Math.random()*20)+1}`).then(r=>r.json()).then(d=>setRecommendations(d.slice(0,6)));
                }}>🔄 换一批</button></div>
                <div className="side-list">
                  {recommendations.map(v => (
                    <div key={v.id} onClick={() => handleSwitch(v)} className={`side-item ${currentId===v.id?'active':''}`}>
                      <div className="side-thumb"><img src={v.poster} /></div>
                      <div className="side-text"><h4>{v.title.replace('[电影解说]','')}</h4><p>{v.year} · {v.source}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>
        </>
      )}

      {/* --- 移动布局 --- */}
      {isMobile && (
        <div className="mobile-scroll-box" ref={containerRef} onScroll={handleMobileScroll}>
          <div className="m-snap-item">
            <div className="player-host-mobile">
                <div ref={playerRef} style={{ width:'100%', height:'100%' }}></div>
                {switching && <div className="m-tip">正在秒切...</div>}
            </div>
            <div className="m-overlay">
              <div className="m-info">
                <h3>{mainVideo?.title?.replace('[电影解说]','')}</h3>
                <p>{mainVideo?.category} · {mainVideo?.year}</p>
              </div>
              <div className="m-actions">
                <div onClick={toggleMoyu} className="m-btn"><div>🐟</div><span>摸鱼</span></div>
                {searchResults.length > 0 && <div onClick={() => playOriginal(searchResults[0])} className="m-btn highlight"><div>⚡</div><span>正片</span></div>}
                <Link href="/" className="m-btn"><div>🏠</div><span>首页</span></Link>
              </div>
            </div>
          </div>
          {recommendations.map(v => (
            <div key={v.id} className="m-snap-item">
              <div className="m-placeholder" style={{ backgroundImage: `url(${v.poster})` }}>
                <div className="m-mask"></div>
                <div className="m-loading">🌚 智能加载中...</div>
              </div>
              <div className="m-overlay mini">
                <div className="m-info"><h3>{v.title.replace('[电影解说]','')}</h3></div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .pc-player-page { background: var(--bg-main); min-height: 100vh; color: var(--text-main); }
        .player-grid { display: grid; grid-template-columns: 1fr 350px; gap: 40px; padding: 30px 24px 80px; align-items: start; }
        .video-viewport { background: #000; border-radius: 16px; overflow: hidden; aspect-ratio: 16/9; position: relative; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 30px 60px rgba(0,0,0,0.5); }
        .player-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10; color: var(--primary); font-weight: 800; font-size: 20px; }
        
        .meta-card { margin-top: 30px; background: var(--bg-card); padding: 30px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.03); }
        .title-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
        .title-grp h1 { font-size: 24px; font-weight: 900; margin-bottom: 8px; }
        .title-grp p { color: var(--text-dim); font-size: 13px; }
        .action-grp { display: flex; gap: 15px; align-items: center; }
        
        .moyu-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #ccc; padding: 10px 18px; border-radius: 12px; font-weight: 600; cursor: pointer; transition: 0.3s; }
        .moyu-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
        
        .premium-flash-btn { border: none; cursor: pointer; position: relative; background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); color: #fff; padding: 12px 24px; border-radius: 12px; font-weight: 800; display: flex; align-items: center; gap: 10px; transition: 0.3s; box-shadow: 0 10px 20px rgba(225,29,72,0.4); }
        .premium-flash-btn:hover { transform: translateY(-3px); box-shadow: 0 15px 30px rgba(225,29,72,0.6); }
        .btn-glow { position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent); transition: 0.5s; }
        .premium-flash-btn:hover .btn-glow { left: 100%; transition: 0.8s; }

        .desc-box { border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px; margin-bottom: 30px; }
        .desc-box label { font-size: 11px; color: var(--primary); font-weight: 900; letter-spacing: 2px; margin-bottom: 12px; display: block; }
        .desc-box p { line-height: 1.8; color: #a1a1aa; font-size: 14px; }
        .desc-box p.line-1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
        .toggle { color: var(--primary); font-size: 12px; font-weight: 700; cursor: pointer; margin-top: 10px; text-align: center; }

        .alt-resources { border-top: 1px solid rgba(255,255,255,0.05); padding-top: 25px; }
        .alt-resources h3 { font-size: 16px; font-weight: 800; margin-bottom: 20px; }
        .res-list { display: grid; grid-template-columns: 1fr; gap: 12px; }
        .res-card { background: rgba(255,255,255,0.02); padding: 12px; border-radius: 12px; display: flex; align-items: center; gap: 15px; cursor: pointer; transition: 0.3s; border: 1px solid transparent; }
        .res-card:hover { background: rgba(225,29,72,0.05); border-color: rgba(225,29,72,0.2); transform: translateX(5px); }
        .res-card img { width: 50px; aspect-ratio: 2/3; border-radius: 4px; object-fit: cover; }
        .res-info { flex: 1; }
        .res-title { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
        .res-meta { font-size: 12px; color: var(--text-dim); }
        .res-btn { font-size: 11px; color: var(--primary); font-weight: 800; border: 1px solid var(--primary); padding: 3px 10px; border-radius: 100px; }

        .right-sidebar { width: 350px; }
        .sticky-box { position: sticky; top: 100px; }
        .side-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px; }
        .side-head h3 { font-size: 15px; font-weight: 800; }
        .side-head button { background: rgba(225,29,72,0.1); border: 1px solid rgba(225,29,72,0.2); color: var(--primary); padding: 5px 12px; border-radius: 100px; font-size: 11px; font-weight: 700; cursor: pointer; }
        .side-list { display: flex; flex-direction: column; gap: 12px; }
        .side-item { display: flex; gap: 12px; cursor: pointer; padding: 10px; border-radius: 12px; transition: 0.2s; align-items: flex-start; }
        .side-item:hover { background: rgba(255,255,255,0.03); transform: translateX(5px); }
        .side-item.active { background: rgba(225, 29, 72, 0.05); border: 1px solid rgba(225, 29, 72, 0.1); }
        .side-thumb { width: 120px; aspect-ratio: 16/9; border-radius: 6px; overflow: hidden; background: #1a1a1a; }
        .side-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .side-text h4 { font-size: 13px; font-weight: 700; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .side-text p { font-size: 11px; color: var(--text-dim); margin-top: 4px; }

        .loading-full { height: 100vh; background: #000; display: flex; align-items: center; justify-content: center; color: var(--primary); font-weight: 900; font-size: 22px; }

        .mobile-scroll-box { height: 100vh; overflow-y: scroll; scroll-snap-type: y mandatory; background: #000; -webkit-overflow-scrolling: touch; }
        .m-snap-item { height: 100vh; width: 100%; scroll-snap-align: start; position: relative; }
        .m-tip { position: absolute; top: 20%; left: 50%; transform: translateX(-50%); color: var(--primary); font-weight: bold; z-index: 5; text-shadow: 0 0 10px rgba(0,0,0,0.8); }
        .m-placeholder { width: 100%; height: 100%; background-size: cover; background-position: center; position: relative; }
        .m-mask { position: absolute; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(20px); }
        .m-loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #fff; opacity: 0.5; font-size: 14px; }
        
        .m-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 50px 20px; background: linear-gradient(transparent, rgba(0,0,0,0.98)); display: flex; justify-content: space-between; align-items: flex-end; z-index: 10; pointer-events: none; }
        .m-info { max-width: 70%; color: #fff; }
        .m-info h3 { font-size: 20px; font-weight: 900; margin-bottom: 8px; }
        .m-actions { display: flex; flex-direction: column; gap: 24px; pointer-events: auto; }
        .m-btn { display: flex; flex-direction: column; align-items: center; gap: 6px; color: #fff; cursor: pointer; text-decoration: none; }
        .m-btn div { width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(10px); }
        .m-btn.highlight div { background: var(--primary); border-color: var(--primary); box-shadow: 0 0 20px rgba(225,29,72,0.6); }
        .m-btn span { font-size: 11px; font-weight: 600; opacity: 0.8; }
      `}</style>
    </div>
  );
}

function MobileOverlay({ video, searchResults, playOriginal, toggleMoyu }) {
    return (
        <div className="m-overlay">
            <div className="m-info">
              <h3>{video?.title?.replace('[电影解说]', '')}</h3>
              <p>{video?.category} · {video?.year}</p>
            </div>
            <div className="m-actions">
              <div onClick={toggleMoyu} className="m-btn"><div>🐟</div><span>摸鱼</span></div>
              {searchResults.length > 0 && <div onClick={() => playOriginal(searchResults[0])} className="m-btn highlight"><div>⚡</div><span>正片</span></div>}
              <Link href="/" className="m-btn"><div>🏠</div><span>首页</span></Link>
            </div>
        </div>
    );
}

export default function GenericPlayerPage() {
  return (
    <Suspense fallback={<div className="loading-full">🌚 全速加载中...</div>}>
      <PlayerContent />
    </Suspense>
  );
}
