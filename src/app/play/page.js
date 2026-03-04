'use client';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function PlayContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const src = searchParams.get('src');
  const initialUrl = searchParams.get('url');

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
        if (!currentUrl && data.episodes && data.episodes.length > 0) {
          setCurrentUrl(data.episodes[0].url);
          setCurrentName(data.episodes[0].name);
        } else if (data.episodes) {
          const current = data.episodes.find(e => e.url === initialUrl);
          if (current) setCurrentName(current.name);
        }
      } catch (e) {
        console.error('Fetch detail failed:', e);
      }
    };

    fetchDetail();
  }, [id, src, initialUrl]);

  useEffect(() => {
    if (typeof window !== 'undefined' && currentUrl) {
      // 将真实视频 URL 改为走后端服务器代理，绕过防盗链 403
      const backendBase = process.env.NEXT_PUBLIC_API_URL || '';
      const proxiedUrl = `${backendBase}/api/proxy?url=${encodeURIComponent(currentUrl)}`;
      // 动态导入 DPlayer 和 Hls
      Promise.all([
        import('hls.js'),
        import('dplayer')
      ]).then(([HlsModule, DPlayerModule]) => {
        const Hls = HlsModule.default;
        const DPlayer = DPlayerModule.default;

        if (dpInstance.current) {
          dpInstance.current.switchVideo({ url: proxiedUrl, type: 'hls' });
          dpInstance.current.play();
        } else {
          dpInstance.current = new DPlayer({
            container: playerRef.current,
            autoplay: true,
            theme: '#ec2d7a',
            video: { url: proxiedUrl, type: 'hls' },
            customType: {
              hls: function (video, player) {
                if (Hls.isSupported()) {
                  const hls = new Hls({
                    xhrSetup: function (xhr, url) {
                      if (!url.includes('/api/proxy')) {
                        xhr.open('GET', `/api/proxy?url=${encodeURIComponent(url)}`, true);
                      }
                    },
                  });
                  hls.loadSource(video.src);
                  hls.attachMedia(video);
                  player.hls = hls;
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                  video.src = video.src;
                }
              },
            },
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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="site-header" style={{ background: '#111' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" className="logo">🐾 小黑搜影</Link>
          <div style={{ fontSize: '0.9rem', color: '#888' }}>{detail?.title || '正在加载...'}</div>
          <Link href="/" style={{ color: '#ccc', textDecoration: 'none', fontSize: '0.8rem' }}>返回搜索</Link>
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

export default function Play() {
  return (
    <Suspense fallback={<div style={{ color: 'white', padding: '20px' }}>加载播放器中...</div>}>
      <PlayContent />
    </Suspense>
  );
}
