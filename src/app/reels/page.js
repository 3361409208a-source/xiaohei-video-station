'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function ReelsPage() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef(null);

  useEffect(() => {
    const fetchReels = async () => {
      try {
        const res = await fetch('/api/search?t=解说&pg=1');
        const data = await res.json();
        setVideos(data);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch reels:', error);
      }
    };
    fetchReels();
  }, []);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const index = Math.round(containerRef.current.scrollTop / window.innerHeight);
    setCurrentIndex(index);
  };

  if (loading) return <div className="reels-loading">🌚 正在加载大片解说...</div>;

  return (
    <div className="reels-container" ref={containerRef} onScroll={handleScroll}>
      {videos.map((video, index) => (
        <div key={video.id} className="reel-item">
          <ReelPlayer video={video} active={index === currentIndex} />
          
          <div className="reel-overlay">
            <div className="reel-info">
              <h3 className="reel-title">{video.title.replace('[电影解说]', '').replace('电影解说', '')}</h3>
              <p className="reel-category">{video.category} · {video.year}</p>
            </div>
            
            <div className="reel-actions">
              <Link 
                href={`/?q=${encodeURIComponent(video.title.replace('[电影解说]', '').replace('电影解说', '').trim())}`}
                className="action-btn search-origin"
              >
                <div className="btn-icon">🔍</div>
                <span>搜正片</span>
              </Link>
              <Link href="/" className="action-btn back-home">
                 <div className="btn-icon">🏠</div>
                 <span>首页</span>
              </Link>
            </div>
          </div>
        </div>
      ))}

      <style jsx>{`
        .reels-container {
          height: 100vh;
          overflow-y: scroll;
          scroll-snap-type: y mandatory;
          background: #000;
          color: #fff;
        }
        .reel-item {
          height: 100vh;
          width: 100%;
          scroll-snap-align: start;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .reel-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 40px 20px;
          background: linear-gradient(transparent, rgba(0,0,0,0.8));
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          pointer-events: none;
        }
        .reel-info {
          max-width: 70%;
        }
        .reel-title {
          font-size: 20px;
          margin-bottom: 8px;
          text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }
        .reel-category {
          font-size: 14px;
          opacity: 0.8;
        }
        .reel-actions {
          display: flex;
          flex-direction: column;
          gap: 20px;
          pointer-events: auto;
        }
        .action-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          color: #fff;
          text-decoration: none;
        }
        .btn-icon {
          width: 50px;
          height: 50px;
          background: rgba(255,255,255,0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          backdrop-filter: blur(10px);
        }
        .action-btn span {
          font-size: 12px;
        }
        .reels-loading {
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #000;
          color: #fff;
          font-size: 18px;
        }
      `}</style>
    </div>
  );
}

function ReelPlayer({ video, active }) {
  const [detail, setDetail] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (active) {
      fetch(`/api/detail?id=${video.id}&src=${encodeURIComponent(video.source)}`)
        .then(res => res.json())
        .then(data => setDetail(data));
    }
  }, [active, video]);

  const m3u8Url = detail?.episodes?.[0]?.url;

  return (
    <div className="player-wrapper" style={{ width: '100%', height: '100%' }}>
      {active && m3u8Url ? (
        <iframe
          src={`https://p.cdn.it/player.html?url=${encodeURIComponent(m3u8Url)}`}
          style={{ width: '100%', height: '100%', border: 'none' }}
          allowFullScreen
        />
      ) : (
        <div className="poster-placeholder" style={{
          width: '100%', 
          height: '100%', 
          backgroundImage: `url(${video.poster})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(20px) brightness(0.5)'
        }} />
      )}
    </div>
  );
}
