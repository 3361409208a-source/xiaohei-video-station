'use client';
import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function Play() {
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
        const res = await fetch(`http://127.0.0.1:8000/api/detail?id=${id}&src=${encodeURIComponent(src)}`);
        const data = await res.json();
        setDetail(data);
        if (!currentUrl && data.episodes.length > 0) {
          setCurrentUrl(data.episodes[0].url);
          setCurrentName(data.episodes[0].name);
        } else {
            const current = data.episodes.find(e => e.url === initialUrl);
            if(current) setCurrentName(current.name);
        }
      } catch (e) {
        console.error('Fetch detail failed:', e);
      }
    };

    fetchDetail();
  }, [id, src]);

  useEffect(() => {
    if (typeof window !== 'undefined' && currentUrl) {
      import('hls.js').then((Hls) => {
        import('dplayer').then((DPlayer) => {
          if (dpInstance.current) {
            dpInstance.current.switchVideo({ url: currentUrl, type: 'hls' });
            dpInstance.current.play();
          } else {
            dpInstance.current = new DPlayer.default({
              container: playerRef.current,
              autoplay: true,
              theme: '#ec2d7a',
              video: { url: currentUrl, type: 'hls' }
            });
          }
        });
      });
    }
  }, [currentUrl]);

  return (
    <div style={{height:'100vh', display:'flex', flexDirection:'column'}}>
      <header className="site-header" style={{background: '#111'}}>
        <div className="container" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <Link href="/" className="logo">🐾 小黑搜影</Link>
          <div style={{fontSize: '0.9rem', color: '#888'}}>{detail?.title || '正在加载...'}</div>
          <Link href="/" style={{color: '#ccc', text-decoration: 'none', fontSize: '0.8rem'}}>返回搜索</Link>
        </div>
      </header>

      <div className="play-layout">
        <div className="player-main" ref={playerRef}></div>
        
        <div className="episode-sidebar">
          <div className="sidebar-title">选集播放</div>
          <div className="ep-grid">
            {detail?.episodes.map((ep) => (
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
