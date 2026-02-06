'use client';
import { useState, useEffect, useRef, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function PlayerContent({ paramsPromise }) {
  const params = use(paramsPromise);
  const searchParams = useSearchParams();
  const slug = decodeURIComponent(params.slug);
  const currentId = slug.split('-').pop();
  const currentSrc = searchParams.get('src');

  const [mainVideo, setMainVideo] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [originalMovie, setOriginalMovie] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [loadingRecs, setLoadingRecs] = useState(true);
  const containerRef = useRef(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // 获取当前播放视频的详情
    fetch(`/api/detail?id=${currentId}&src=${encodeURIComponent(currentSrc)}`)
      .then(res => res.json())
      .then(data => {
        setMainVideo(data);
        // 自动寻找正片
        const cleanTitle = data.title.replace('[电影解说]', '').replace('电影解说', '').trim();
        fetch(`/api/search?q=${encodeURIComponent(cleanTitle)}`)
          .then(res => res.json())
          .then(searchData => {
            const original = searchData.find(item => !item.category.includes('解说') && !item.title.includes('解说'));
            setOriginalMovie(original);
          });
      });

    // 获取推荐列表
    fetch('/api/search?t=解说&pg=1')
      .then(res => res.json())
      .then(data => {
        setRecommendations(data.filter(v => v.id !== currentId));
        setLoadingRecs(false);
      });

    return () => window.removeEventListener('resize', checkMobile);
  }, [currentId, currentSrc]);

  // --- PC 端：B站播放页布局 ---
  if (!isMobile) {
    return (
      <div className="pc-player-page">
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

        <main className="player-layout">
          {/* 左侧：大播放器 */}
          <div className="left-content">
            <div className="main-player-box">
              {mainVideo?.episodes?.[0] ? (
                <iframe src={`https://p.cdn.it/player.html?url=${encodeURIComponent(mainVideo.episodes[0].url)}`} style={{ width:'100%', height:'100%', border:'none' }} allowFullScreen />
              ) : <div className="loading-player">正在准备解说资源...</div>}
            </div>
            
            <div className="video-info-card">
              <div className="info-header">
                <h1>{mainVideo?.title.replace('[电影解说]', '')}</h1>
                {originalMovie && (
                  <Link href={`/movie/${encodeURIComponent(`${originalMovie.title}-${originalMovie.id}`)}?src=${encodeURIComponent(originalMovie.source_name)}`} className="play-original-btn">
                    🎬 播正片
                  </Link>
                )}
              </div>
              <div className="info-meta">
                <span>分类：{mainVideo?.category}</span>
                <span>来源：{currentSrc}</span>
                <p className="desc">{mainVideo?.description}</p>
              </div>
            </div>
          </div>

          {/* 右侧：推荐列表 */}
          <div className="right-sidebar">
            <div className="sidebar-title">
              推荐解说
              <button className="refresh-mini" onClick={() => {
                setLoadingRecs(true);
                fetch(`/api/search?t=解说&pg=${Math.floor(Math.random()*10)+1}`)
                  .then(res => res.json())
                  .then(data => { setRecommendations(data); setLoadingRecs(false); });
              }}>🔄 换一批</button>
            </div>
            <div className="rec-list">
              {recommendations.map(v => (
                <Link key={v.id} href={`/reels/${encodeURIComponent(`${v.title}-${v.id}`)}?src=${encodeURIComponent(v.source)}`} className="rec-item">
                  <div className="rec-poster"><img src={v.poster} /></div>
                  <div className="rec-text">
                    <h4>{v.title.replace('[电影解说]', '')}</h4>
                    <p>{v.year} · {v.source}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </main>

        <style jsx>{`
          .pc-player-page { background: #f6f7f9; min-height: 100vh; padding-top: 70px; }
          .player-layout { display: flex; max-width: 1400px; margin: 0 auto; padding: 20px; gap: 20px; }
          .left-content { flex: 1; min-width: 0; }
          .main-player-box { background: #000; border-radius: 8px; overflow: hidden; aspect-ratio: 16/9; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
          .video-info-card { margin-top: 20px; background: #fff; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
          .info-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
          .info-header h1 { font-size: 24px; color: #18191c; font-weight: 700; }
          .play-original-btn { background: #fb7299; color: #fff; text-decoration: none; padding: 10px 25px; border-radius: 8px; font-weight: 600; transition: 0.3s; }
          .play-original-btn:hover { background: #fc8bab; transform: scale(1.05); }
          .info-meta { color: #9499a0; font-size: 14px; display: flex; flex-direction: column; gap: 10px; }
          .desc { color: #61666d; margin-top: 10px; line-height: 1.6; }
          
          .right-sidebar { width: 400px; flex-shrink: 0; }
          .sidebar-title { font-size: 16px; color: #18191c; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
          .refresh-mini { background: none; border: none; color: #00aeec; cursor: pointer; font-size: 13px; }
          .rec-list { display: flex; flex-direction: column; gap: 15px; }
          .rec-item { display: flex; gap: 12px; text-decoration: none; padding: 5px; border-radius: 6px; transition: 0.2s; }
          .rec-item:hover { background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
          .rec-poster { width: 160px; aspect-ratio: 16/9; border-radius: 4px; overflow: hidden; background: #000; flex-shrink: 0; }
          .rec-poster img { width: 100%; height: 100%; object-fit: cover; }
          .rec-text { flex: 1; min-width: 0; }
          .rec-text h4 { font-size: 14px; color: #18191c; margin-bottom: 5px; font-weight: 500; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
          .rec-text p { font-size: 12px; color: #9499a0; }
        `}</style>
      </div>
    );
  }

  // --- 移动端：抖音滑屏布局 ---
  return (
    <div className="mobile-feed-container" ref={containerRef} style={{ height: '100vh', overflowY: 'scroll', scrollSnapType: 'y mandatory', background: '#000' }}>
      {/* 当前播放 */}
      <div className="feed-item" style={{ height: '100vh', scrollSnapAlign: 'start', position: 'relative' }}>
          <iframe src={`https://p.cdn.it/player.html?url=${encodeURIComponent(mainVideo?.episodes?.[0]?.url || '')}`} style={{ width:'100%', height:'100%', border:'none' }} allowFullScreen />
          <MobileOverlay video={mainVideo} original={originalMovie} />
      </div>
      {/* 推荐后续 */}
      {recommendations.map(v => (
        <div key={v.id} className="feed-item" style={{ height: '100vh', scrollSnapAlign: 'start', position: 'relative' }}>
            <div style={{ width:'100%', height:'100%', backgroundImage: `url(${v.poster})`, backgroundSize: 'cover', backgroundPosition:'center', opacity:0.3 }} />
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>
                <Link href={`/reels/${encodeURIComponent(`${v.title}-${v.id}`)}?src=${encodeURIComponent(v.source)}`} style={{ color:'#fff', textDecoration:'none', border:'1px solid #fff', padding:'10px 20px', borderRadius:'20px' }}>
                    滑动加载此条
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
                  <Link href={`/movie/${encodeURIComponent(`${original.title}-${original.id}`)}?src=${encodeURIComponent(original.source_name)}`} className="m-btn">
                    <div className="m-icon">🎬</div><span>播正片</span>
                  </Link>
              ) : <div className="m-btn disabled"><div className="m-icon">🚫</div><span>无正片</span></div>}
              <Link href="/" className="m-btn"><div className="m-icon">🏠</div><span>首页</span></Link>
            </div>
            <style jsx>{`
                .m-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 40px 20px; background: linear-gradient(transparent, rgba(0,0,0,0.9)); display: flex; justify-content: space-between; align-items: flex-end; z-index: 10; pointer-events: none; }
                .m-info { max-width: 70%; color: #fff; }
                .m-actions { display: flex; flex-direction: column; gap: 20px; pointer-events: auto; }
                .m-btn { display: flex; flex-direction: column; align-items: center; gap: 5px; color: #fff; text-decoration: none; }
                .m-icon { width: 50px; height: 50px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; backdrop-filter: blur(10px); }
                .m-btn span { font-size: 12px; }
            `}</style>
        </div>
    );
}

export default function PlayerPage({ params: paramsPromise }) {
  return (
    <Suspense fallback={<div style={{ height:'100vh', background:'#000', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>🌚 全速加载中...</div>}>
      <PlayerContent paramsPromise={paramsPromise} />
    </Suspense>
  );
}
