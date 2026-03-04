'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

export default function MoviePlayer({ id, src, initialUrl }) {
  const [detail, setDetail] = useState(null);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [currentName, setCurrentName] = useState('');
  const [altSources, setAltSources] = useState([]);
  const [isSearchingAlt, setIsSearchingAlt] = useState(false);
  const playerRef = useRef(null);
  const dpInstance = useRef(null);
  const [isDescCollapsed, setIsDescCollapsed] = useState(true);
  const [config, setConfig] = useState({ site_name: '小黑搜影', footer: '' });

  // 过滤 HTML 标签的工具函数
  const stripHtml = (html) => {
    if (!html) return "";
    return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
  };

  useEffect(() => {
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

        if (data.title) {
          document.title = `${data.title}在线免费观看 - ${config.site_name}`;
        }

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
  }, [id, src, initialUrl, config.site_name]);

  // 当主资源加载失败时，自动寻找替代资源
  const findAlternativeSources = async () => {
    if (!detail?.title || isSearchingAlt) return;
    setIsSearchingAlt(true);
    try {
      // 搜索同名电影，排除当前失效的源
      const res = await fetch(`/api/search?q=${encodeURIComponent(detail.title)}`);
      const data = await res.json();
      const others = data.filter(item => item.source_name !== src);
      setAltSources(others);
    } catch (err) {
      console.error("Failed to find alt sources", err);
    }
    setIsSearchingAlt(false);
  };

  const handleSwitchSource = async (alt) => {
    try {
      const res = await fetch(`/api/detail?id=${alt.vod_id || alt.id}&src=${encodeURIComponent(alt.source_name)}`);
      const data = await res.json();
      // 尝试匹配相同集名，或者播第一集
      const targetEp = data.episodes.find(e => e.name === currentName) || data.episodes[0];
      if (targetEp) {
        setCurrentUrl(targetEp.url);
        // 更新当前页面的一些信息
        setDetail(prev => ({ ...prev, episodes: data.episodes }));
      }
    } catch (err) {
      console.error("Switch source failed", err);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && currentUrl) {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || '';
      const proxiedUrl = `${backendBase}/api/proxy?url=${encodeURIComponent(currentUrl)}`;

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
                      // .ts 分片也走后端代理（注意带上 backendBase）
                      if (!url.includes('/api/proxy')) {
                        xhr.open('GET', `${backendBase}/api/proxy?url=${encodeURIComponent(url)}`, true);
                      }
                    },
                  });
                  hls.loadSource(video.src);
                  hls.attachMedia(video);
                  player.hls = hls;

                  // 关键：监听 Hls.js 自身的错误事件
                  // DPlayer 的 on('error') 在 customType 模式下不会自动收到 Hls.js 错误
                  hls.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) {
                      console.log(`视频加载失败 (${data.type})，正在寻找替代资源...`);
                      // 先尝试 hls 恢复
                      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                        hls.startLoad(); // 网络错误先重试一次
                        setTimeout(() => {
                          // 重试后还是失败，搜索替代资源
                          if (data.fatal) findAlternativeSources();
                        }, 3000);
                      } else {
                        findAlternativeSources();
                      }
                    }
                  });
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                  // Safari 原生 HLS
                  video.src = video.src;
                  video.addEventListener('error', () => findAlternativeSources());
                }
              },
            },
          });

          // DPlayer 原生错误事件（兜底）
          dpInstance.current.on('error', () => {
            console.log('DPlayer 播放失败，正在寻找替代资源...');
            findAlternativeSources();
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



  // 摸鱼模式（画中画）
  const toggleMoyu = () => {
    if (dpInstance.current && dpInstance.current.video) {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture();
      } else {
        dpInstance.current.video.requestPictureInPicture().catch(err => {
          console.error("Moyu failed", err);
          alert("当前浏览器或视频源不支持摸鱼模式哦~");
        });
      }
    }
  };

  return (
    <div className="page-wrapper" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden', background: '#000' }}>
      <header className="site-header" style={{ background: '#111' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <Link href="/" className="logo-area">
            <img src="/logo.png" alt="logo" className="logo-img" />
            <div className="logo-text">小黑<span>搜影</span></div>
          </Link>

          <div style={{
            fontSize: '0.9rem',
            color: '#888',
            flex: 1,
            textAlign: 'center',
            padding: '0 15px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            {detail?.title ? detail.title : (
              <>
                <img src="/logo.gif" alt="loading" style={{ width: '24px', height: '24px', borderRadius: '4px' }} />
                <span>正在加载...</span>
              </>
            )}
          </div>

          <Link href="/" style={{ color: '#ccc', fontSize: '0.8rem', whiteSpace: 'nowrap', flexShrink: 0 }}>返回搜索</Link>
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
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    onClick={toggleMoyu}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#fff',
                      padding: '4px 12px',
                      borderRadius: '100px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <span>🐟</span> 摸鱼模式
                  </button>
                  {detail.remark && <span style={{ color: '#ec2d7a', fontSize: '0.85rem', fontWeight: '700' }}>{detail.remark}</span>}
                </div>
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
                      WebkitLineClamp: isDescCollapsed ? 1 : 'unset',
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      lineHeight: '1.6'
                    }}
                  >
                    <strong>简介：</strong>{stripHtml(detail.description) || '暂无简介'}
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
          {altSources.length > 0 && (
            <div className="alt-sources-box" style={{ marginBottom: '20px', padding: '15px', background: 'rgba(236, 45, 122, 0.1)', border: '1px solid #ec2d7a', borderRadius: '8px' }}>
              <div style={{ color: '#ec2d7a', fontSize: '0.9rem', marginBottom: '10px', fontWeight: 'bold' }}>🌚 发现可用替代路线：</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {altSources.map(alt => (
                  <button
                    key={alt.id}
                    onClick={() => handleSwitchSource(alt)}
                    style={{
                      background: '#ec2d7a',
                      color: '#fff',
                      border: 'none',
                      padding: '5px 12px',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    切换至：{alt.source_name} ({alt.source_tip})
                  </button>
                ))}
              </div>
            </div>
          )}
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
