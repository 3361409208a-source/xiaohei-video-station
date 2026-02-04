'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

export default function MoviePlayer({ id, src, initialUrl }) {
  const [detail, setDetail] = useState(null);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [currentName, setCurrentName] = useState('');
  const playerRef = useRef(null);
  const dpInstance = useRef(null);

  useEffect(() => {
    if (!id || !src) return;

    const fetchDetail = async () => {
      try {
        const res = await fetch(`/api/detail?id=${id}&src=${encodeURIComponent(src)}`);
        const data = await res.json();
        setDetail(data);

        // 更新页面标题
        if (data.title) {
          document.title = `${data.title}在线免费观看 - 小黑搜影`;
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
  }, [id, src, initialUrl]);

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
    <div style={{height:'100vh', display:'flex', flexDirection:'column'}}>
      <header className="site-header" style={{background: '#111'}}>
        <div className="container" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <Link href="/" className="logo">🐾 小黑搜影</Link>
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

      <div className="play-layout">
        <div className="player-main" ref={playerRef}></div>

        <div className="episode-sidebar">
          <div className="sidebar-title">选集播放</div>
          <div className="ep-grid">
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
    </div>
  );
}
