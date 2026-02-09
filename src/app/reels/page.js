'use client';
import React, { useState, useEffect, useRef, Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';

// 视频详情缓存
const detailCache = new Map();

// --- 子组件：移动端单条解说刷片器 ---
function MobileReelItem({ video, isActive, preload = false }) {
    const router = useRouter();
    const [detail, setDetail] = useState(null);
    const [error, setError] = useState(null);
    const playerRef = useRef(null);
    const dp = useRef(null);

    // 激活或预加载时加载详情
    useEffect(() => {
        if ((isActive || preload) && !detail && !error) {
            const cacheKey = `${video.id}-${video.source_name || video.source}`;
            
            // 检查缓存
            if (detailCache.has(cacheKey)) {
                setDetail(detailCache.get(cacheKey));
                return;
            }

            fetch(`/api/detail?id=${video.id}&src=${encodeURIComponent(video.source_name || video.source)}`)
                .then(res => res.json())
                .then(data => {
                    if (data && data.title) {
                        detailCache.set(cacheKey, data);
                        setDetail(data);
                    } else {
                        setError('视频加载失败');
                    }
                })
                .catch(() => setError('网络错误'));
        }
    }, [isActive, preload, video, detail, error]);

    // 播放器逻辑
    useEffect(() => {
        if (isActive && detail?.episodes?.[0]?.url && typeof window !== 'undefined') {
            const videoUrl = detail.episodes[0].url;
            const isHls = videoUrl.includes('.m3u8');

            Promise.all([import('hls.js'), import('dplayer')]).then(([HlsModule, DPlayerModule]) => {
                const Hls = HlsModule.default;
                const DPlayer = DPlayerModule.default;

                // 销毁旧播放器
                if (dp.current) {
                    dp.current.destroy();
                    dp.current = null;
                }

                if (playerRef.current) {
                    // 检测是否需要 HLS.js（安卓等原生不支持 HLS 的浏览器）
                    const testVideo = document.createElement('video');
                    const needsHlsJs = isHls && !testVideo.canPlayType('application/vnd.apple.mpegurl');

                    dp.current = new DPlayer({
                        container: playerRef.current,
                        autoplay: true,
                        theme: '#e11d48',
                        loop: true,
                        video: {
                            url: videoUrl,
                            type: needsHlsJs ? 'customHls' : (isHls ? 'hls' : 'normal'),
                            customType: {
                                customHls: function (video, player) {
                                    if (Hls.isSupported()) {
                                        const hls = new Hls();
                                        hls.loadSource(video.src);
                                        hls.attachMedia(video);
                                        hls.on(Hls.Events.MANIFEST_PARSED, () => {
                                            video.play().catch(() => { });
                                        });
                                    }
                                }
                            }
                        }
                    });
                }
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
                <div ref={playerRef} style={{ width: '100%', height: '100%' }}></div>
                {!detail && isActive && !error && <div className="loading-tip">🌚 正在接入信号...</div>}
                {error && isActive && (
                    <div className="error-tip">
                        <div>😢 {error}</div>
                        <button onClick={(e) => {
                            e.stopPropagation();
                            setError(null);
                            setDetail(null);
                        }}>重试</button>
                    </div>
                )}
                {!isActive && (
                    <div className="poster-placeholder" style={{ backgroundImage: `url(${video.poster})` }}>
                        <div className="mask"></div>
                    </div>
                )}
            </div>

            <div className="ui-overlay">
                <div className="info-box">
                    <h3>{video.title.replace('[电影解说]', '')}</h3>
                    <p>{video.category} · {video.year}</p>
                </div>
                <div className="side-actions">
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
                .error-tip { position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%); color: #fff; text-align: center; z-index: 20; }
                .error-tip button { margin-top: 10px; padding: 8px 20px; background: #e11d48; border: none; border-radius: 8px; color: #fff; font-weight: bold; cursor: pointer; }
                .poster-placeholder { width: 100%; height: 100%; background-size: cover; background-position: center; filter: blur(10px); }
                .mask { position: absolute; inset: 0; background: rgba(0,0,0,0.4); }
                
                .ui-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 40px 20px; display: flex; justify-content: space-between; align-items: flex-end; background: linear-gradient(transparent, rgba(0,0,0,0.9)); z-index: 10; pointer-events: none; }
                .info-box { max-width: 70%; color: #fff; }
                .info-box h3 { font-size: 18px; font-weight: 800; margin-bottom: 8px; text-shadow: 0 2px 4px #000; }
                .info-box p { font-size: 13px; opacity: 0.8; }
                
                .side-actions { display: flex; flex-direction: column; gap: 20px; pointer-events: auto; }
                .m-btn { display: flex; flex-direction: column; align-items: center; gap: 6px; color: #fff; text-decoration: none; }
                .icon-circ { width: 50px; height: 50px; border-radius: 50%; background: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; font-size: 22px; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); }
                .icon-circ.highlight { background: #e11d48; border-color: #e11d48; box-shadow: 0 0 15px rgba(225, 29, 72, 0.5); }
                .m-btn span { font-size: 11px; font-weight: 600; }

                /* 强制隐藏 DPlayer 自带的中心播放按钮，除非是暂停状态 */
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
    const loadedRef = useRef(false); // 防止重复加载

    const [pcMainVideo, setPcMainVideo] = useState(null);
    const [pcRecs, setPcRecs] = useState([]);
    const [pcSearch, setPcSearch] = useState([]);
    const [switching, setSwitching] = useState(false);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const playerRef = useRef(null);
    const dpInstance = useRef(null);

    // 视频切换函数（带缓存）
    const switchVideo = useCallback((videoId, videoSrc, videoTitle) => {
        if (switching) {
            console.log('⚠️ 正在切换中，忽略点击');
            return;
        }
        
        const cacheKey = `${videoId}-${videoSrc}`;
        
        console.log('🎬 切换视频:', videoTitle, 'ID:', videoId);
        
        // 检查缓存
        if (detailCache.has(cacheKey)) {
            console.log('🚀 从缓存加载:', videoTitle);
            const data = detailCache.get(cacheKey);
            setPcMainVideo(data);
            setPcSearch([]);
            // 使用当前的 allVideos 更新推荐列表
            setPcRecs(prev => {
                const currentVideos = allVideos.length > 0 ? allVideos : prev;
                return currentVideos.filter(item => item.id !== videoId).slice(0, 6);
            });
            // 不更新URL，避免触发useEffect
            // window.history.pushState({}, '', `/reels/${encodeURIComponent(`${videoTitle}-${videoId}`)}?src=${encodeURIComponent(videoSrc)}`);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        
        setSwitching(true);
        console.log('📡 从API加载:', videoTitle);
        fetch(`/api/detail?id=${videoId}&src=${encodeURIComponent(videoSrc)}`)
            .then(r => r.json())
            .then(data => {
                console.log('✅ 加载成功:', data?.title);
                if (data && data.title) {
                    detailCache.set(cacheKey, data); // 缓存结果
                    setPcMainVideo(data);
                    setPcSearch([]);
                    setPcRecs(prev => {
                        const currentVideos = allVideos.length > 0 ? allVideos : prev;
                        return currentVideos.filter(item => item.id !== videoId).slice(0, 6);
                    });
                    // 不更新URL，避免触发useEffect
                    // window.history.pushState({}, '', `/reels/${encodeURIComponent(`${videoTitle}-${videoId}`)}?src=${encodeURIComponent(videoSrc)}`);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    console.error('❌ 无效的视频数据');
                }
                setSwitching(false);
            })
            .catch((error) => {
                console.error('❌ 加载失败:', error);
                setSwitching(false);
            });
    }, [switching]); // 移除 allVideos 依赖

    // 预加载推荐视频的详情（仅移动端需要，因为是顺序滚动）
    useEffect(() => {
        if (isMobile && allVideos.length > 0 && currentIndex >= 0) {
            // 移动端：预加载当前视频的上下相邻视频
            const preloadIndexes = [currentIndex - 1, currentIndex + 1].filter(i => i >= 0 && i < allVideos.length);
            preloadIndexes.forEach(i => {
                const v = allVideos[i];
                const cacheKey = `${v.id}-${v.source_name || v.source}`;
                if (!detailCache.has(cacheKey)) {
                    fetch(`/api/detail?id=${v.id}&src=${encodeURIComponent(v.source_name || v.source)}`)
                        .then(r => r.json())
                        .then(data => {
                            if (data && data.title) {
                                detailCache.set(cacheKey, data);
                                console.log('📦 预加载完成:', v.title);
                            }
                        })
                        .catch(() => {});
                }
            });
        }
    }, [currentIndex, allVideos.length, isMobile]); // 只依赖数组长度，不依赖整个数组

    useEffect(() => {
        if (loadedRef.current) return; // 防止重复加载
        loadedRef.current = true;
        
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        
        const init = async () => {
            try {
                // 先获取总数，然后随机选择页码
                const totalPages = 48; // 1439个视频 / 30 = 约48页
                const rp = Math.floor(Math.random() * totalPages) + 1;
                console.log(`🎲 随机加载第 ${rp} 页解说视频`);
                
                const res = await fetch(`/api/reels?pg=${rp}`);
                const data = await res.json();
                console.log(`📊 获取到 ${data.length} 个解说视频`);
                
                if (data.length === 0) {
                    console.error('❌ 没有获取到视频数据');
                    setLoading(false);
                    return;
                }
                
                // 打乱顺序，增加随机性
                const shuffled = data.sort(() => Math.random() - 0.5);
                const videoList = shuffled.slice(0, 20);
                setAllVideos(videoList);
                
                // 立即加载第一个视频（不等待setAllVideos完成）
                if (!isMobile && videoList.length > 0) {
                    const firstVideo = videoList[0];
                    const videoSrc = firstVideo.source_name || firstVideo.source || '量子高清';
                    const cacheKey = `${firstVideo.id}-${videoSrc}`;
                    
                    console.log(`🚀 立即加载首个视频: ${firstVideo.title}`);
                    
                    // 立即开始加载第一个视频
                    fetch(`/api/detail?id=${firstVideo.id}&src=${encodeURIComponent(videoSrc)}`)
                        .then(r => r.json())
                        .then(detailData => {
                            if (detailData && detailData.title) {
                                detailCache.set(cacheKey, detailData);
                                setPcMainVideo(detailData);
                                setPcRecs(videoList.slice(1, 7)); // 设置推荐列表
                                console.log(`✅ 首个视频加载完成: ${detailData.title}`);
                            }
                        })
                        .catch(err => console.error('❌ 首个视频加载失败:', err));
                }
                
                setLoading(false);
            } catch (error) {
                console.error('❌ 初始化失败:', error);
                setLoading(false);
            }
        };
        
        init();
        return () => window.removeEventListener('resize', checkMobile);
    }, [isMobile]);

    useEffect(() => {
        if (isMobile) return;
        
        // 只处理URL中有id的情况（用户直接访问特定视频）
        const slug = params?.slug ? decodeURIComponent(params.slug) : null;
        const id = slug ? slug.split('-').pop() : searchParams.get('id');
        const src = searchParams.get('src');
        
        // 如果没有id，说明是首次访问，已经在init中处理了
        if (!id) return;
        
        // 如果已经有正在播放的视频，且URL中的id与当前视频id相同，则不重新加载
        if (pcMainVideo && pcMainVideo.id === id) {
            console.log('⏭️ 跳过重复加载，当前已播放该视频');
            return;
        }
        
        // 加载URL指定的视频
        const loadPc = async () => {
            setSwitching(true);
            try {
                const videoSrc = src || '量子高清';
                const res = await fetch(`/api/detail?id=${id}&src=${encodeURIComponent(videoSrc)}`);
                const data = await res.json();
                if (data && data.title) {
                    setPcMainVideo(data);
                    setPcRecs(allVideos.filter(v => v.id !== id).slice(0, 6));
                } else {
                    console.error('Invalid video data received');
                }
            } catch (error) {
                console.error('Failed to load video:', error);
            } finally {
                setSwitching(false);
            }
        };
        loadPc();
    }, [params, searchParams, isMobile, allVideos]);

    useEffect(() => {
        if (!isMobile && pcMainVideo?.episodes?.[0]?.url) {
            const url = pcMainVideo.episodes[0].url;
            const isHls = url.includes('.m3u8');
            Promise.all([import('hls.js'), import('dplayer')]).then(([HlsModule, DPlayerModule]) => {
                if (dpInstance.current) {
                    // 已有播放器，直接切换视频
                    dpInstance.current.switchVideo({ url, type: isHls ? 'hls' : 'normal' });
                    dpInstance.current.play();
                } else if (playerRef.current) {
                    // 首次创建播放器
                    dpInstance.current = new DPlayerModule.default({ 
                        container: playerRef.current, 
                        autoplay: true, 
                        theme: '#e11d48',
                        preload: 'auto', // 预加载
                        video: { url, type: isHls ? 'hls' : 'normal' } 
                    });
                }
            });
        }
    }, [pcMainVideo, isMobile]);

    if (loading) return <div className="full-loading">🌚 正在接入信号...</div>;

    if (isMobile) {
        return (
            <div className="mobile-scroller" onScroll={(e) => {
                const idx = Math.round(e.target.scrollTop / window.innerHeight);
                if (idx !== currentIndex) setCurrentIndex(idx);
            }}>
                {allVideos.map((v, i) => (
                    <MobileReelItem 
                        key={v.id} 
                        video={v} 
                        isActive={i === currentIndex}
                        preload={Math.abs(i - currentIndex) === 1} // 预加载相邻视频
                    />
                ))}
                <style jsx>{`
                .mobile-scroller { height: 100vh; width: 100vw; overflow-y: scroll; scroll-snap-type: y mandatory; background: #000; -webkit-overflow-scrolling: touch; }
                .full-loading { height: 100vh; background: #000; display: flex; align-items: center; justify-content: center; color: #e11d48; font-weight: bold; }
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
                            <Link key={n} href={n === '首页' ? '/' : (n.includes('解说') ? '/reels' : `/channel/${n}`)} className={`nav-link ${n.includes('解说') ? 'special-link' : ''}`}>{n}</Link>
                        ))}
                    </nav>
                </div>
            </header>
            <main className="container player-grid">
                <div className="left-zone">
                    <div className="video-viewport">
                        <div ref={playerRef} style={{ width: '100%', height: '100%' }}></div>
                        {switching && <div className="overlay">🌚 正在秒切中...</div>}
                    </div>
                    <div className="meta-card">
                        <div className="title-row">
                            <div className="title-grp">
                                <h1>{pcMainVideo?.title.replace('[电影解说]', '')}</h1>
                                <p>{pcMainVideo?.category} · {pcMainVideo?.area || '全网'}</p>
                            </div>
                            <div className="action-grp">
                                <button onClick={() => {
                                    if (loadingSearch) return; // 防止重复点击
                                    const cleanT = pcMainVideo.title.replace('[电影解说]', '').replace('电影解说', '').trim();
                                    setLoadingSearch(true);
                                    setSwitching(true);
                                    fetch(`/api/search?q=${encodeURIComponent(cleanT)}`)
                                        .then(r => r.json())
                                        .then(sData => {
                                            const films = sData.filter(i => !i.category.includes('解说'));
                                            if (films.length > 0) {
                                                const film = films[0];
                                                fetch(`/api/detail?id=${film.id}&src=${encodeURIComponent(film.source_name || film.source)}`)
                                                    .then(r => r.json())
                                                    .then(d => {
                                                        if (d && d.title && d.episodes?.[0]?.url) {
                                                            setPcMainVideo(d);
                                                            setPcSearch(films);
                                                            if (dpInstance.current) {
                                                                dpInstance.current.switchVideo({ url: d.episodes[0].url, type: 'hls' });
                                                                setTimeout(() => dpInstance.current.play(), 100);
                                                            }
                                                        }
                                                        setLoadingSearch(false);
                                                        setSwitching(false);
                                                    })
                                                    .catch(() => {
                                                        setLoadingSearch(false);
                                                        setSwitching(false);
                                                    });
                                            } else {
                                                alert('未找到相关正片资源');
                                                setLoadingSearch(false);
                                                setSwitching(false);
                                            }
                                        })
                                        .catch(() => {
                                            alert('搜索失败，请重试');
                                            setLoadingSearch(false);
                                            setSwitching(false);
                                        });
                                }} className="premium-flash-btn" disabled={loadingSearch}>
                                    <span className="icon">{loadingSearch ? '⏳' : '⚡'}</span>
                                    <span>{loadingSearch ? '搜索中...' : '直接播放正片'}</span>
                                    <div className="btn-glow"></div>
                                </button>
                            </div>
                        </div>
                        <div className="desc-box">
                            <label>内 容 详 情</label>
                            <p>{pcMainVideo?.description?.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')}</p>
                        </div>
                        {pcSearch.length > 0 && (
                            <div className="related-films">
                                <h3>相关正片资源 ({pcSearch.length})</h3>
                                <div className="f-grid">
                                    {pcSearch.map(f => (
                                        <div key={f.id} onClick={() => {
                                            fetch(`/api/detail?id=${f.id}&src=${encodeURIComponent(f.source_name || f.source)}`)
                                                .then(r => r.json()).then(d => setPcMainVideo(d));
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }} className="f-card">
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
                        <h3>精彩解说</h3>
                        <button onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            // 换一批：重新获取随机页的视频
                            const totalPages = 48;
                            const rp = Math.floor(Math.random() * totalPages) + 1;
                            console.log(`🔄 换一批：加载第 ${rp} 页`);
                            
                            fetch(`/api/reels?pg=${rp}`)
                                .then(res => res.json())
                                .then(data => {
                                    const shuffled = data.sort(() => Math.random() - 0.5);
                                    const newVideos = shuffled.slice(0, 20);
                                    setAllVideos(newVideos);
                                    // 更新推荐列表
                                    const currentId = pcMainVideo?.id;
                                    setPcRecs(newVideos.filter(v => v.id !== currentId).slice(0, 6));
                                })
                                .catch(error => {
                                    console.error('换一批失败:', error);
                                });
                        }} type="button" className="refresh-btn">
                            🔄 换一批
                        </button>
                    </div>
                    <div className="side-list">
                        {pcRecs.length === 0 && !switching && (
                            // 骨架屏
                            <>
                                {[1,2,3,4,5,6].map(i => (
                                    <div key={i} className="side-item skeleton">
                                        <div className="side-thumb skeleton-box"></div>
                                        <div className="side-text">
                                            <div className="skeleton-line"></div>
                                            <div className="skeleton-line short"></div>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                        {pcRecs.map(v => (
                            <div key={v.id} onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const videoSrc = v.source_name || v.source || '量子高清';
                                console.log('👆 点击推荐视频:', v.title, 'ID:', v.id, 'Source:', videoSrc);
                                switchVideo(v.id, videoSrc, v.title);
                            }} className="side-item">
                                <div className="side-thumb"><img src={v.poster} /></div>
                                <div className="side-text"><h4>{v.title.replace('[电影解说]', '')}</h4><p>{v.year} · {v.source}</p></div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
            <style jsx>{`
        .pc-player-page { background: var(--bg-main); min-height: 100vh; color: var(--text-main); }
        .player-grid { display: grid; grid-template-columns: 1fr 350px; gap: 40px; padding: 30px 24px 80px; align-items: start; }
        .video-viewport { background: #000; border-radius: 16px; overflow: hidden; aspect-ratio: 16/9; position: relative; border: 1px solid rgba(255,255,255,0.05); }
        .overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10; color: var(--primary); font-weight: bold; }
        .meta-card { margin-top: 30px; background: var(--bg-card); padding: 30px; border-radius: 16px; }
        .title-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; gap: 20px; }
        .title-grp h1 { font-size: 24px; font-weight: 900; margin-bottom: 8px; }
        .title-grp p { color: var(--text-dim); font-size: 13px; }
        .action-grp { flex-shrink: 0; }
        .premium-flash-btn { border: none; cursor: pointer; position: relative; background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); color: #fff; padding: 12px 24px; border-radius: 12px; font-weight: 800; display: flex; align-items: center; gap: 10px; box-shadow: 0 10px 20px rgba(225,29,72,0.4); overflow: hidden; white-space: nowrap; }
        .premium-flash-btn .icon { font-size: 18px; }
        .btn-glow { position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent); }
        .premium-flash-btn:hover .btn-glow { left: 100%; transition: 0.8s; }
        .desc-box label { font-size: 11px; color: var(--primary); font-weight: 900; letter-spacing: 2px; margin-bottom: 12px; display: block; }
        .desc-box p { line-height: 1.8; color: #a1a1aa; font-size: 14px; }
        .related-films { margin-top: 40px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 30px; }
        .f-grid { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 20px; }
        .f-card { background: rgba(255,255,255,0.02); padding: 12px; border-radius: 12px; display: flex; align-items: center; gap: 15px; text-decoration: none; color: inherit; cursor: pointer; }
        .f-card img { width: 50px; aspect-ratio: 2/3; border-radius: 4px; object-fit: cover; }
        .f-info { flex: 1; }
        .f-title { font-weight: 700; font-size: 14px; }
        .f-meta { font-size: 12px; color: var(--text-dim); }
        .f-btn { font-size: 11px; color: var(--primary); font-weight: 800; border: 1px solid var(--primary); padding: 4px 12px; border-radius: 100px; }
        .right-sidebar { width: 350px; }
        .side-head { border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
        .side-head h3 { margin: 0; }
        .refresh-btn { background: rgba(225,29,72,0.1); border: 1px solid rgba(225,29,72,0.3); color: var(--primary); padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .refresh-btn:hover { background: rgba(225,29,72,0.2); transform: scale(1.05); }
        .side-list { display: flex; flex-direction: column; gap: 15px; }
        .side-item { display: flex; gap: 12px; text-decoration: none; color: inherit; cursor: pointer; transition: opacity 0.2s; }
        .side-item:hover { opacity: 0.7; }
        .side-thumb { width: 120px; aspect-ratio: 16/9; border-radius: 6px; overflow: hidden; background: #1a1a1a; }
        .side-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .side-text h4 { font-size: 13px; font-weight: 700; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .side-text p { font-size: 11px; color: var(--text-dim); }
        
        /* 骨架屏动画 */
        .skeleton { pointer-events: none; }
        .skeleton-box { background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
        .skeleton-line { height: 12px; background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 4px; margin-bottom: 8px; }
        .skeleton-line.short { width: 60%; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        
        /* 按钮禁用状态 */
        .premium-flash-btn:disabled { opacity: 0.6; cursor: not-allowed; }
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
