'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

export default function MoviePlayer({ id, src, initialUrl }) {
  const [detail, setDetail] = useState(null);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [currentName, setCurrentName] = useState('');
  const playerRef = useRef(null);
  const dpInstance = useRef(null);
  const [isDescCollapsed, setIsDescCollapsed] = useState(true);
  const [config, setConfig] = useState({ site_name: '小黑搜影', footer: '' });

  useEffect(() => {
    // 加载后台配置
    fetch('/api/config')
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(err => console.error("Config load failed", err));
  }, []);

  useEffect(() => {
    if (!id || !src) return;

    const fetchDetail = async () => {
      try {
        const res = await fetch(`/api/detail?id=${id}&src=${encodeURIComponent(src)}`);
        const data = await res.json();
        setDetail(data);

        // 更新页面标题，优先使用后台设置的站名
        if (data.title) {
          document.title = `${data.title}在线免费观看 - ${config.site_name}`;
        }

        if (!currentUrl && data.episodes && data.episodes.length > 0) {
          setCurrentUrl(data.episodes[0].url);
          setCurrentName(data.episodes[0].name);
        } else if (data.episodes) {
          const current = data.episodes.find(e => e.url === initialUrl);
          if(current) setCurrentName(current.name);
        }
      } catch (e) {
        console.error('Fetch detail failed:', e);
      }
    };

    fetchDetail();
  }, [id, src, initialUrl, config.site_name]);

  useEffect(() => {
    if (typeof window !== 'undefined' && currentUrl) {
      Promise.all([
        import('hls.js'),
        import('dplayer')
      ]).then(([HlsModule, DPlayerModule]) => {
        const Hls = HlsModule.default;
        const DPlayer = DPlayerModule.default;

        if (dpInstance.current) {
          dpInstance.current.switchVideo({ url: currentUrl, type: 'hls' });
          dpInstance.current.play();
        } else {
          dpInstance.current = new DPlayer({
            container: playerRef.current,
            autoplay: true,
            theme: '#ec2d7a',
            video: { url: currentUrl, type: 'hls' }
          });
        }
      });
    }

    return () => {
      if (dpInstance.current) {
        dpInstance.current.destroy();
        dpInstance.current = null;
      }
    };
  }, [currentUrl]);

  return (
    <div className="page-wrapper" style={{minHeight:'100vh', display:'flex', flexDirection:'column', overflowX: 'hidden', background: '#000'}}>
      <header className="site-header" style={{background: '#111'}}>
        <div className="container" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <Link href="/" className="logo">{config.site_name}</Link>
          <div style={{fontSize: '0.9rem', color: '#888'}}>{detail?.title || '正在加载...'}</div>
          <Link href="/" style={{color: '#ccc', textDecoration: 'none', fontSize: '0.8rem'}}>返回搜索</Link>
        </div>
      </header>

      <div className="broadcast-bar">
        <div className="broadcast-content">
          <span className="broadcast-icon">📢</span>
          <span>防骗提醒：正在播放的视频中若出现任何广告水印，请务必提高警惕，切勿转账或参与，守护好您的财产安全！</span>
        </div>
      </div>

      <div className="play-layout" style={{ flex: 1 }}>
        <div className="player-main">
          <div ref={playerRef} style={{ width: '100%', aspectRatio: '16/9' }}></div>
          {detail && (
            <div className="movie-info-card" style={{ padding: '15px', color: '#ccc', background: '#1a1a1a', marginTop: '10px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h1 style={{ color: '#fff', fontSize: '1.2rem', margin: '0 0 10px 0' }}>{detail.title}</h1>
                {detail.remark && <span style={{ color: '#ec2d7a', fontSize: '0.85rem', fontWeight: '700' }}>{detail.remark}</span>}
              </div>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px', fontSize: '0.8rem', opacity: 0.8 }}>
                {detail.year && <span>{detail.year}</span>}
                {detail.area && <span>{detail.area}</span>}
                {detail.category && <span>{detail.category}</span>}
              </div>

              <div style={{ fontSize: '0.85rem', lineHeight: '1.5' }}>
                {detail.actor && <p style={{ margin: '0 0 5px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><strong>主演：</strong>{detail.actor}</p>}
                
                <div style={{ borderTop: '1px solid #333', marginTop: '10px', paddingTop: '10px' }}>
                   <div 
                    style={{ 
                      color: '#999', 
                      display: '-webkit-box',
                      WebkitLineClamp: isDescCollapsed ? 2 : 'unset',
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      transition: 'all 0.3s'
                    }}
                   >
                     <strong>简介：</strong>{detail.description || '暂无简介'}
                   </div>
                   <div 
                    onClick={() => setIsDescCollapsed(!isDescCollapsed)}
                    style={{ color: 'var(--primary)', fontSize: '0.8rem', marginTop: '5px', textAlign: 'center', cursor: 'pointer' }}
                   >
                     {isDescCollapsed ? '展开详情 ▾' : '收起详情 ▴'}
                   </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="episode-sidebar">
          <div className="sidebar-title">选集播放</div>
          <div className={`ep-grid ${detail?.episodes?.length > 20 ? 'scroll-mode' : ''}`}>
            {detail?.episodes?.map((ep) => (
              <div
                key={ep.url}
                className={`ep-card ${currentUrl === ep.url ? 'active' : ''}`}
                onClick={() => {
                  setCurrentUrl(ep.url);
                  setCurrentName(ep.name);
                }}
              >
                {ep.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="site-footer">
        <div className="container">
          {config.footer || `© 2026 ${config.site_name}`}
        </div>
      </footer>
    </div>
  );
}
