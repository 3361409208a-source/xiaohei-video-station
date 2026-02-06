'use client';
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';

// --- 子组件：移动端单条解说刷片器 ---
function MobileReelItem({ video, isActive, toggleMoyu }) {
    const router = useRouter();
    const [detail, setDetail] = useState(null);
    const playerRef = useRef(null);
    const dp = useRef(null);

    useEffect(() => {
        if (isActive && !detail) {
            fetch(`/api/detail?id=${video.id}&src=${encodeURIComponent(video.source_name || video.source)}`)
                .then(res => res.json())
                .then(data => setDetail(data));
        }
    }, [isActive, video, detail]);

    useEffect(() => {
        if (isActive && detail?.episodes?.[0]?.url && typeof window !== 'undefined') {
            const videoUrl = detail.episodes[0].url;
            const isHls = videoUrl.includes('.m3u8');
            
            Promise.all([import('hls.js'), import('dplayer')]).then(([HlsModule, DPlayerModule]) => {
                const DPlayer = DPlayerModule.default;
                const Hls = HlsModule.default;

                const mobileHlsConfig = {
                    enableWorker: true,
                    maxBufferLength: 60,
                    maxMaxBufferLength: 120,
                    initialLiveManifestSize: 1,
                };

                if (dp.current) {
                    dp.current.destroy();
                }

                dp.current = new DPlayer({
                    container: playerRef.current,
                    autoplay: true,
                    theme: '#e11d48',
                    loop: true,
                    video: {
                        url: videoUrl,
                        type: 'customHls',
                        customType: {
                            customHls: function (videoElement) {
                                const hls = new Hls(mobileHlsConfig);
                                hls.loadSource(videoElement.src);
                                hls.attachMedia(videoElement);
                            }
                        }
                    }
                });
            });
        }
        return () => {
            if (dp.current) {
                dp.current.destroy();
                dp.current = null;
            }
        };
    }, [isActive, detail]);

    const handleMobilePlayOriginal = () => {
        const cleanT = video.title.replace('[电影解说]', '').replace('电影解说', '').trim();
        window.open(`/?q=${encodeURIComponent(cleanT)}`, '_blank');
    };

    return (
        <div className="mobile-reel-unit">
            <div className="player-area" onClick={() => dp.current?.toggle()}>
                <div ref={playerRef} style={{ width:'100%', height:'100%' }}></div>
                {!detail && isActive && <div className="loading-tip">🌚 信号接入中...</div>}
                {!isActive && (
                    <div className="poster-placeholder" style={{ backgroundImage: `url(${video.poster})` }}>
                        <div className="mask"></div>
                    </div>
                )}
            </div>

            <div className="ui-overlay">
                <div className="info-box">
                    <h3>{video.title.replace('[电影解说]', '')}</h3>
                    <p>{video.category} · {video.year || '2026'}</p>
                </div>
                <div className="side-actions">
                    <div className="m-btn" onClick={toggleMoyu}>
                        <div className="icon-circ">🐟</div>
                        <span>摸鱼</span>
                    </div>
                    <div className="m-btn" onClick={handleMobilePlayOriginal}>
                        <div className="icon-circ highlight">⚡</div>
                        <span>正片</span>
                    </div>
                    <Link href="/" className="m-btn">
                        <div className="icon-circ">🏠</div>
                        <span>首页</span>
                    </Link>
                </div>
            </div>
            <style jsx>{`
                .mobile-reel-unit { height: 100vh; width: 100vw; position: relative; background: #000; scroll-snap-align: start; overflow: hidden; }
                .player-area { width: 100%; height: 100%; position: relative; }
                .loading-tip { position: absolute; top: 40%; left: 50%; transform: translateX(-50%); color: #e11d48; font-weight: bold; }
                .poster-placeholder { width: 100%; height: 100%; background-size: cover; background-position: center; filter: blur(15px); }
                .mask { position: absolute; inset: 0; background: rgba(0,0,0,0.5); }
                .ui-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 50px 20px; display: flex; justify-content: space-between; align-items: flex-end; background: linear-gradient(transparent, rgba(0,0,0,0.95)); z-index: 10; pointer-events: none; }
                .info-box { max-width: 70%; color: #fff; }
                .info-box h3 { font-size: 20px; font-weight: 900; margin-bottom: 8px; text-shadow: 0 2px 10px #000; }
                .info-box p { font-size: 13px; opacity: 0.8; }
                .side-actions { display: flex; flex-direction: column; gap: 24px; pointer-events: auto; }
                .m-btn { display: flex; flex-direction: column; align-items: center; gap: 6px; color: #fff; text-decoration: none; cursor: pointer; }
                .icon-circ { width: 50px; height: 50px; border-radius: 50%; background: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; font-size: 22px; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); }
                .icon-circ.highlight { background: #e11d48; border-color: #e11d48; box-shadow: 0 0 20px rgba(225, 29, 72, 0.6); }
                .m-btn span { font-size: 11px; font-weight: 600; }
                :global(.dplayer-mobile-play-display) { display: none !important; }
                :global(.dplayer-paused .dplayer-mobile-play-display) { display: block !important; }
            `}</style>
        </div>
    );
}

// --- 主组件 ---
function PlayerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allVideos, setAllVideos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const [pcMainVideo, setPcMainVideo] = useState(null);
  const [pcRecs, setPcRecs] = useState([]);
  const [pcSearch, setPcSearch] = useState([]);
  const [switching, setSwitching] = useState(false);
  const [isDescCollapsed, setIsDescCollapsed] = useState(true);
  const playerRef = useRef(null);
  const dpInstance = useRef(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    const init = async () => {
        const rp = Math.floor(Math.random() * 15) + 1;
        const res = await fetch(`/api/search?t=解说&pg=${rp}&_ts=${Date.now()}`);
        const data = await res.json();
        if (data.length > 0) setAllVideos(data.slice(0, 15));
        setLoading(false);
    };
    init();
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 1. 同步 PC 状态（解决切换不刷页）
  const syncPcData = async (id, src) => {
    setSwitching(true);
    try {
        const res = await fetch(`/api/detail?id=${id}&src=${encodeURIComponent(src)}`);
        const data = await res.json();
        if (data && data.title) {
            setPcMainVideo(data);
            const cleanT = data.title.replace('[电影解说]','').replace('电影解说','').trim();
            fetch(`/api/search?q=${encodeURIComponent(cleanT)}`)
                .then(r => r.json())
                .then(sData => setPcSearch(sData.filter(i => !i.category.includes('解说'))));
        }
    } catch(e) {}
    setPcRecs(allVideos.filter(v => v.id !== id).slice(0, 6)); // 固定只展示 6 个
    setSwitching(false);
  };

  useEffect(() => {
    if (isMobile) return;
    const slug = params?.slug ? decodeURIComponent(params.slug) : null;
    const id = slug ? slug.split('-').pop() : searchParams.get('id');
    const src = searchParams.get('src');

    if (id) {
        syncPcData(id, src);
    } else if (allVideos.length > 0) {
        const first = allVideos[0];
        syncPcData(first.id, first.source_name || first.source);
    }
  }, [params, searchParams, isMobile, allVideos]);

  // 2. PC 播放器同步
  useEffect(() => {
    if (!isMobile && pcMainVideo?.episodes?.[0]?.url) {
        const url = pcMainVideo.episodes[0].url;
        const isHls = url.includes('.m3u8');
        Promise.all([import('hls.js'), import('dplayer')]).then(([HlsModule, DPlayerModule]) => {
            if (dpInstance.current) {
                dpInstance.current.switchVideo({ url, type: isHls ? 'hls' : 'normal' });
                dpInstance.current.play();
            } else if (playerRef.current) {
                dpInstance.current = new DPlayerModule.default({
                    container: playerRef.current,
                    autoplay: true,
                    theme: '#e11d48',
                    video: { url, type: isHls ? 'hls' : 'normal' }
                });
            }
        });
    }
  }, [pcMainVideo, isMobile]);

  // 3. PC 切换函数
  const handlePcSwitch = (v) => {
    const newSrc = v.source_name || v.source;
    const newSlug = encodeURIComponent(`${v.title}-${v.id}`);
    window.history.pushState(null, '', `/reels/${newSlug}?src=${encodeURIComponent(newSrc)}`);
    syncPcData(v.id, newSrc);
  };

  const handleRefreshSide = () => {
    const rp = Math.floor(Math.random() * 20) + 1;
    fetch(`/api/search?t=解说&pg=${rp}`)
        .then(res => res.json())
        .then(data => setPcRecs(data.slice(0, 6)));
  };

  const toggleMoyu = () => {
    const vid = dpInstance.current?.video || document.querySelector('video');
    if (vid) {
        if (document.pictureInPictureElement) document.exitPictureInPicture();
        else vid.requestPictureInPicture().catch(() => alert("不支持摸鱼模式"));
    }
  };

  if (loading) return <div className="full-loading">🌚 正在接入信号...</div>;

  if (isMobile) {
    return (
        <div className="mobile-scroller" onScroll={(e) => {
            const idx = Math.round(e.target.scrollTop / window.innerHeight);
            if (idx !== currentIndex) setCurrentIndex(idx);
        }}>
            {allVideos.map((v, i) => (
                <MobileReelItem key={v.id} video={v} isActive={i === currentIndex} toggleMoyu={toggleMoyu} />
            ))}
            <style jsx>{`
                .mobile-scroller { height: 100vh; width: 100vw; overflow-y: scroll; scroll-snap-type: y mandatory; background: #000; -webkit-overflow-scrolling: touch; }
                .full-loading { height: 100vh; background: #000; display: flex; align-items: center; justify-content: center; color: #e11d48; font-weight: bold; font-size: 20px; }
            `}</style>
        </div>
    );
  }

  return (
    <div className="pc-player-page">
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
      <main className="player-grid-wrapper">
        <div className="player-grid">
            <div className="left-zone">
                <div className="video-viewport">
                    <div ref={playerRef} style={{ width:'100%', height:'100%' }}></div>
                    {switching && <div className="overlay">🌚 正在秒切中...</div>}
                </div>
                <div className="meta-card">
                    <div className="title-row">
                        <div className="title-grp">
                            <h1>{pcMainVideo?.title.replace('[电影解说]','')}</h1>
                            <p>{pcMainVideo?.category} · {pcMainVideo?.year || '2026'}</p>
                        </div>
                        <div className="action-grp">
                            <button onClick={toggleMoyu} className="moyu-btn">🐟 摸鱼模式</button>
                            {pcSearch.length > 0 && (
                                <button onClick={() => handlePcSwitch(pcSearch[0])} className="premium-flash-btn">
                                    <span className="icon">⚡</span><span>观看完整正片</span><div className="btn-glow"></div>
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="desc-box">
                        <label>内 容 详 情</label>
                        <p className={isDescCollapsed ? 'line-1' : ''}>
                            {pcMainVideo?.description?.replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ') || '精彩内容正在赶来...'}
                        </p>
                        <div className="toggle" onClick={() => setIsDescCollapsed(!isDescCollapsed)}>
                            {isDescCollapsed ? '展开详情 ▾' : '收起详情 ▴'}
                        </div>
                    </div>
                    {pcSearch.length > 0 && (
                        <div className="related-films">
                            <h3>相关正片资源 ({pcSearch.length})</h3>
                            <div className="f-grid">
                                {pcSearch.map(f => (
                                    <div key={f.id} onClick={() => handlePcSwitch(f)} className="f-card">
                                        <img src={f.poster} />
                                        <div className="f-info">
                                            <div className="f-title">{f.title}</div>
                                            <div className="f-meta">{f.year} · {f.source_name || f.source}</div>
                                        </div>
                                        <div className="f-btn">立即播放</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className="right-sidebar">
                <div className="side-head">
                    <h3>精彩解说推荐</h3>
                    <button className="refresh-btn" onClick={handleRefreshSide}>🔄 换一批</button>
                </div>
                <div className="side-list">
                    {pcRecs.map(v => (
                        <div key={v.id} onClick={() => handlePcSwitch(v)} className={`side-item ${pcMainVideo?.title.includes(v.title) ? 'active' : ''}`}>
                            <div className="side-thumb"><img src={v.poster} /></div>
                            <div className="side-text"><h4>{v.title.replace('[电影解说]','')}</h4><p>{v.year} · {v.source}</p></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </main>
      <style jsx>{`
        .pc-player-page { background: var(--bg-main); min-height: 100vh; color: var(--text-main); }
        .player-grid-wrapper { max-width: 1600px; margin: 0 auto; padding: 30px 24px 80px; }
        .player-grid { display: grid; grid-template-columns: 1fr 420px; gap: 40px; align-items: start; }
        .video-viewport { background: #000; border-radius: 16px; overflow: hidden; aspect-ratio: 16/9; position: relative; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 30px 60px rgba(0,0,0,0.6); }
        .overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10; color: var(--primary); font-weight: bold; font-size: 20px; }
        .meta-card { margin-top: 30px; background: var(--bg-card); padding: 30px; border-radius: 16px; }
        .title-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
        .title-grp h1 { font-size: 24px; font-weight: 900; margin-bottom: 8px; }
        .title-grp p { color: var(--text-dim); font-size: 13px; }
        .action-grp { display: flex; gap: 15px; align-items: center; }
        .moyu-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #ccc; padding: 10px 18px; border-radius: 12px; font-weight: 600; cursor: pointer; transition: 0.3s; }
        .moyu-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .premium-flash-btn { border: none; cursor: pointer; position: relative; background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); color: #fff; padding: 12px 24px; border-radius: 12px; font-weight: 800; display: flex; align-items: center; gap: 10px; box-shadow: 0 10px 20px rgba(225,29,72,0.4); transition: 0.3s; }
        .btn-glow { position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent); }
        .premium-flash-btn:hover .btn-glow { left: 100%; transition: 0.8s; }
        .desc-box { border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px; margin-bottom: 30px; }
        .desc-box label { font-size: 11px; color: var(--primary); font-weight: 900; letter-spacing: 2px; margin-bottom: 12px; display: block; }
        .desc-box p { line-height: 1.8; color: #a1a1aa; font-size: 14px; }
        .desc-box p.line-1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
        .toggle { color: var(--primary); font-size: 12px; font-weight: 700; cursor: pointer; margin-top: 10px; text-align: center; }
        .related-films { margin-top: 40px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 30px; }
        .f-grid { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 20px; }
        .f-card { background: rgba(255,255,255,0.02); padding: 12px; border-radius: 12px; display: flex; align-items: center; gap: 15px; text-decoration: none; color: inherit; cursor: pointer; border: 1px solid transparent; transition: 0.3s; }
        .f-card:hover { background: rgba(225,29,72,0.05); border-color: rgba(225,29,72,0.2); transform: translateX(5px); }
        .f-card img { width: 50px; aspect-ratio: 2/3; border-radius: 4px; object-fit: cover; }
        .f-info { flex: 1; }
        .f-title { font-weight: 700; font-size: 14px; color: #fff; }
        .f-meta { font-size: 12px; color: var(--text-dim); }
        .f-btn { font-size: 11px; color: var(--primary); font-weight: 800; border: 1px solid var(--primary); padding: 4px 12px; border-radius: 100px; }
        .right-sidebar { width: 420px; }
        .side-head { border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
        .side-head h3 { font-size: 16px; font-weight: 800; }
        .refresh-btn { background: rgba(225, 29, 72, 0.1); border: 1px solid rgba(225, 29, 72, 0.2); color: var(--primary); padding: 5px 12px; border-radius: 100px; font-size: 11px; font-weight: 700; cursor: pointer; transition: 0.3s; }
        .refresh-btn:hover { background: var(--primary); color: #fff; }
        .side-list { display: flex; flex-direction: column; gap: 15px; }
        .side-item { display: flex; gap: 16px; cursor: pointer; padding: 10px; border-radius: 12px; transition: 0.3s; border: 1px solid transparent; }
        .side-item:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.05); transform: translateX(5px); }
        .side-item.active { background: rgba(225, 29, 72, 0.05); border-color: rgba(225, 29, 72, 0.1); }
        .side-thumb { width: 160px; aspect-ratio: 16/9; border-radius: 8px; overflow: hidden; background: #1a1a1a; flex-shrink: 0; }
        .side-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .side-text { flex: 1; min-width: 0; }
        .side-text h4 { font-size: 14px; font-weight: 700; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; color: #fff; }
        .side-text p { font-size: 11px; color: var(--text-dim); margin-top: 6px; }
      `}</style>
    </div>
  );
}

export default function GenericPlayerPage() {
  return (
    <Suspense fallback={null}>
      <PlayerContent />
    </Suspense>
  );
}
