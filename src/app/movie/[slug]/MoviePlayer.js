'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import Recommendations from '@/components/Recommendations';
import AdSlot from '@/components/AdSlot';
import NoticeBar from '@/components/NoticeBar';
import { resolveAdsConfig } from '@/utils/resolveAdsConfig';
import styles from './movie-player.module.css';

export default function MoviePlayer({ id, title, src, initialUrl }) {
  const [detail, setDetail] = useState(null);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [currentName, setCurrentName] = useState('');
  const [altSources, setAltSources] = useState([]);
  const [isSearchingAlt, setIsSearchingAlt] = useState(false);
  const [showNotice, setShowNotice] = useState(true);
  const [attemptedSources, setAttemptedSources] = useState([src]);
  const playerRef = useRef(null);
  const dpInstance = useRef(null);
  const [isDescCollapsed, setIsDescCollapsed] = useState(true);
  const [config, setConfig] = useState({ site_name: '小黑搜影', footer: '', ads: { enabled: false }, private_traffic: {} });
  const adsConfig = resolveAdsConfig(config.ads, config.private_traffic);

  // 当换源或换集时，重置已尝试的源
  useEffect(() => {
    setAttemptedSources([src]);
  }, [src, currentName]);

  // 从 localStorage 初始化公告显示状态
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hideNotice = localStorage.getItem('hide_notice_bar') === 'true';
      if (hideNotice) {
        setShowNotice(false);
      }
    }
  }, []);

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

  const handleSwitchSource = useCallback(async (alt) => {
    try {
      const sName = alt.source_name || alt.source;
      const res = await fetch(`/api/detail?id=${alt.vod_id || alt.id}&src=${encodeURIComponent(sName)}`);
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
  }, [currentName]);

  // 当主资源加载失败时，自动寻找替代资源
  const findAlternativeSources = useCallback(async (fallbackTitle, autoSwitch = true) => {
    const searchKeyword = detail?.title || fallbackTitle;
    if (!searchKeyword || isSearchingAlt) return;

    setIsSearchingAlt(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchKeyword)}`);
      const data = await res.json();
      const others = data.filter(item => {
        const sName = item.source_name || item.source;
        return sName !== src;
      });
      setAltSources(others);

      if (autoSwitch && others.length > 0) {
        const nextSource = others.find(item => {
          const sName = item.source_name || item.source;
          return !attemptedSources.includes(sName);
        });

        if (nextSource) {
          const nextSourceName = nextSource.source_name || nextSource.source;
          console.log(`自动切换至替代源: ${nextSourceName}`);
          setAttemptedSources(prev => [...prev, nextSourceName]);
          await handleSwitchSource(nextSource);
        } else {
          console.log("所有可用替代源均已尝试过播放，停止自动切换。");
        }
      }
    } catch (err) {
      console.error("Failed to find alt sources", err);
    }
    setIsSearchingAlt(false);
  }, [detail?.title, src, isSearchingAlt, attemptedSources, handleSwitchSource]);

  useEffect(() => {
    if (!id) return;

    const fetchDetail = async () => {
      try {
        const srcQuery = src ? `&src=${encodeURIComponent(src)}` : '';
        const res = await fetch(`/api/detail?id=${id}${srcQuery}`);
        const data = await res.json();

        // API 返回 null 表示数据库和实时源都找不到该资源
        if (!data) {
          console.warn('Detail not found, searching alternative sources...');
          findAlternativeSources(title, true); // 使用从 URL 提取的标题搜索
          return;
        }

        setDetail(data);
        if (data.source_name) {
          setAttemptedSources((prev) => (prev.includes(data.source_name) ? prev : [...prev, data.source_name]));
        }

        // 如果返回的是缓存数据且链接已经很久（比如2022），大概率无法播放，主动搜索替代源，但不自动切换
        if (data._from_cache) {
          console.log('Detect cache data, searching for fresh sources...');
          findAlternativeSources(data.title, false);
        }

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
        // 网络请求报错时尝试用标题搜索
        if (title) findAlternativeSources(title, true);
      }
    };

    fetchDetail();
  }, [id, src, initialUrl, config.site_name, title, findAlternativeSources, currentUrl]);

  useEffect(() => {
    if (typeof window !== 'undefined' && currentUrl) {
      Promise.all([
        import('hls.js'),
        import('dplayer')
      ]).then(([HlsModule, DPlayerModule]) => {
        const Hls = HlsModule.default;
        const DPlayer = DPlayerModule.default;

        // 智能播放：先直连，失败后再走 Next /api/proxy（带 SSRF 防护）
        let triedProxy = false;

        const buildHls = (url) => {
          const hls = new Hls();
          hls.loadSource(url);

          hls.on(Hls.Events.ERROR, (event, data) => {
            if (!data.fatal) return;

            if (!triedProxy) {
              triedProxy = true;
              // 始终走同源 Next 代理，避免打到无 SSRF 校验的 FastAPI /api/proxy
              const proxiedUrl = `/api/proxy?url=${encodeURIComponent(currentUrl)}`;
              console.log(`直连失败 (${data.details})，切换代理: ${proxiedUrl}`);
              hls.destroy();
              const proxyHls = buildHls(proxiedUrl);
              proxyHls.attachMedia(dpInstance.current?.video || hls.media);
              if (dpInstance.current) dpInstance.current.hls = proxyHls;
            } else {
              console.log('代理也失败，正在搜索替代资源...');
              hls.destroy();
              findAlternativeSources(detail?.title || title, true);
            }
          });

          return hls;
        };

        if (dpInstance.current) {
          // 切集：直接切换原始 URL，失败会触发上面的错误处理
          dpInstance.current.switchVideo({ url: currentUrl, type: 'hls' });
          dpInstance.current.play();
        } else {
          dpInstance.current = new DPlayer({
            container: playerRef.current,
            autoplay: true,
            theme: '#ec2d7a',
            video: { url: currentUrl, type: 'hls' },
            customType: {
              hls: function (video, player) {
                if (Hls.isSupported()) {
                  const hls = buildHls(currentUrl);
                  hls.attachMedia(video);
                  player.hls = hls;
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                  // Safari 原生 HLS
                  video.src = currentUrl;
                  video.addEventListener('error', () => findAlternativeSources(detail?.title || title, true));
                }
              },
            },
          });

          // DPlayer 原生错误事件（兜底）
          dpInstance.current.on('error', () => {
            if (!triedProxy) findAlternativeSources(detail?.title || title, true);
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
  }, [currentUrl, findAlternativeSources]);







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

          <div className={styles.titleBar}>
            {detail?.title ? detail.title : (
              <>
                <img src="/logo.gif" alt="loading" className={styles.loadingIcon} />
                <span>正在加载...</span>
              </>
            )}
          </div>

          <Link href="/" className={styles.backLink}>返回搜索</Link>
        </div>
      </header>

      <NoticeBar
        config={config}
        show={showNotice}
        onClose={() => {
          setShowNotice(false);
          if (typeof window !== 'undefined') {
            localStorage.setItem('hide_notice_bar', 'true');
          }
        }}
      />

      {detail?._from_cache && (
        <div className={styles.cacheWarn}>
          ⚠️ 检测到该线路记录较旧可能无法播放，系统正在为您寻找最新播放源...
        </div>
      )}

      <div className={`play-layout ${styles.playLayout}`}>
        <div className="player-main">
          <div ref={playerRef} className={styles.playerBox}></div>
          <AdSlot slotId="player_below" adsConfig={adsConfig} />
          {detail && (
            <div className={`movie-info-card ${styles.infoCard}`}>
              <div className={styles.infoHead}>
                <h1 className={styles.infoTitle}>{detail.title}</h1>
                <div className={styles.infoActions}>
                  <button onClick={toggleMoyu} className={styles.moyuBtn}>
                    <span>🐟</span> 摸鱼模式
                  </button>
                  {detail.remark && <span className={styles.remark}>{detail.remark}</span>}
                </div>
              </div>

              <div className={styles.metaRow}>
                {detail.year && <span>{detail.year}</span>}
                {detail.area && <span>{detail.area}</span>}
                {detail.category && <span>{detail.category}</span>}
              </div>

              <div className={styles.descBlock}>
                {detail.actor && <p className={styles.actorLine}><strong>主演：</strong>{detail.actor}</p>}

                <div className={styles.descDivider}>
                  <div className={`${styles.descText} ${isDescCollapsed ? styles.descCollapsed : ''}`}>
                    <strong>简介：</strong>{stripHtml(detail.description) || '暂无简介'}
                  </div>
                  <div
                    onClick={() => setIsDescCollapsed(!isDescCollapsed)}
                    className={styles.descToggle}
                  >
                    {isDescCollapsed ? '展开详情 ▾' : '收起详情 ▴'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="episode-sidebar">
          <AdSlot slotId="player_sidebar" adsConfig={adsConfig} />
          {altSources.length > 0 && (
            <div className={styles.altBox}>
              <div className={styles.altTitle}>🌚 发现可用替代路线：</div>
              <div className={styles.altBtns}>
                {altSources.map(alt => (
                  <button
                    key={alt.id}
                    onClick={() => handleSwitchSource(alt)}
                    className={styles.altBtn}
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
          {detail && (
            <Recommendations
              category={detail.category}
              currentId={detail.vod_id || id}
            />
          )}
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
