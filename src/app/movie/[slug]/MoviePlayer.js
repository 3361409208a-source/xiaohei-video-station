'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import Recommendations from '@/components/Recommendations';
import AdSlot from '@/components/AdSlot';
import NoticeBar from '@/components/NoticeBar';
import { resolveAdsConfig } from '@/utils/resolveAdsConfig';
import { searchDedupKey } from '@/utils/searchHelpers';
import styles from './movie-player.module.css';

export default function MoviePlayer({ id, title, src, initialUrl }) {
  const [detail, setDetail] = useState(null);
  const [currentUrl, setCurrentUrl] = useState('');
  const [currentName, setCurrentName] = useState('');
  const [liveSources, setLiveSources] = useState([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [selectingSource, setSelectingSource] = useState(false);
  const [activeSourceKey, setActiveSourceKey] = useState('');
  const [showNotice, setShowNotice] = useState(true);
  const playerRef = useRef(null);
  const dpInstance = useRef(null);
  const handleSelectSourceRef = useRef(null);
  const [isDescCollapsed, setIsDescCollapsed] = useState(true);
  const [config, setConfig] = useState({ site_name: '小黑搜影', footer: '', ads: { enabled: false }, private_traffic: {} });
  const configSiteNameRef = useRef('小黑搜影');
  configSiteNameRef.current = config.site_name;
  const adsConfig = resolveAdsConfig(config.ads, config.private_traffic);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hideNotice = localStorage.getItem('hide_notice_bar') === 'true';
      if (hideNotice) setShowNotice(false);
    }
  }, []);

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch((err) => console.error('Config load failed', err));
  }, []);

  const stripHtml = (html) => {
    if (!html) return '';
    return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
  };

  const handleSelectSource = useCallback(async (item) => {
    const sName = item.source_name || item.source;
    const vodId = item.vod_id || item.id;
    if (!sName || !vodId) return;

    setSelectingSource(true);
    setActiveSourceKey(searchDedupKey(item));

    try {
      const res = await fetch(`/api/detail?id=${vodId}&src=${encodeURIComponent(sName)}`);
      const data = await res.json();

      if (!data || data.error || !data.episodes?.length) {
        alert('该线路暂时不可用，请换其他源');
        setActiveSourceKey('');
        return;
      }

      setDetail(data);
      document.title = `${data.title}在线免费观看 - ${configSiteNameRef.current}`;

      const matched = initialUrl
        ? data.episodes.find((episode) => episode.url === initialUrl)
        : null;
      const target = matched || data.episodes[0];
      setCurrentUrl(target.url);
      setCurrentName(target.name);
    } catch (err) {
      console.error('Select source failed', err);
      alert('加载线路失败，请换其他源');
      setActiveSourceKey('');
    } finally {
      setSelectingSource(false);
    }
  }, [initialUrl]);

  handleSelectSourceRef.current = handleSelectSource;

  useEffect(() => {
    setDetail(null);
    setCurrentUrl('');
    setCurrentName('');
    setLiveSources([]);
    setActiveSourceKey('');
  }, [id, title]);

  useEffect(() => {
    if (!title) return undefined;

    let cancelled = false;
    setLoadingSources(true);

    fetch(`/api/search?q=${encodeURIComponent(title)}&_ts=${Date.now()}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setLiveSources(list);
        document.title = `${title} - 选择播放源 - ${configSiteNameRef.current}`;

        if (src && list.length) {
          const match = list.find((item) => (item.source_name || item.source) === src);
          if (match) handleSelectSourceRef.current?.(match);
        }
      })
      .catch((err) => console.error('Live search failed', err))
      .finally(() => {
        if (!cancelled) setLoadingSources(false);
      });

    return () => {
      cancelled = true;
    };
  }, [title, src]);

  useEffect(() => {
    if (typeof window === 'undefined' || !currentUrl) return undefined;

    let disposed = false;

    Promise.all([import('hls.js'), import('dplayer')]).then(([HlsModule, DPlayerModule]) => {
      if (disposed) return;

      const Hls = HlsModule.default;
      const DPlayer = DPlayerModule.default;
      let triedProxy = false;

      const onPlayError = () => {
        alert('当前线路播放失败，请换其他源');
      };

      const buildHls = (url) => {
        const hls = new Hls();
        hls.loadSource(url);

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (!data.fatal) return;

          if (!triedProxy) {
            triedProxy = true;
            const proxiedUrl = `/api/proxy?url=${encodeURIComponent(currentUrl)}`;
            hls.destroy();
            const proxyHls = buildHls(proxiedUrl);
            proxyHls.attachMedia(dpInstance.current?.video || hls.media);
            if (dpInstance.current) dpInstance.current.hls = proxyHls;
          } else {
            hls.destroy();
            onPlayError();
          }
        });

        return hls;
      };

      if (dpInstance.current) {
        dpInstance.current.switchVideo({ url: currentUrl, type: 'hls' });
        dpInstance.current.play();
      } else {
        dpInstance.current = new DPlayer({
          container: playerRef.current,
          autoplay: true,
          theme: '#ec2d7a',
          video: { url: currentUrl, type: 'hls' },
          customType: {
            hls(video, player) {
              if (Hls.isSupported()) {
                const hls = buildHls(currentUrl);
                hls.attachMedia(video);
                player.hls = hls;
              } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = currentUrl;
                video.addEventListener('error', onPlayError);
              }
            },
          },
        });

        dpInstance.current.on('error', onPlayError);
      }
    });

    return () => {
      disposed = true;
      if (dpInstance.current) {
        dpInstance.current.destroy();
        dpInstance.current = null;
      }
    };
  }, [currentUrl]);

  const toggleMoyu = () => {
    if (dpInstance.current?.video) {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture();
      } else {
        dpInstance.current.video.requestPictureInPicture().catch(() => {
          alert('当前浏览器或视频源不支持摸鱼模式哦~');
        });
      }
    }
  };

  const displayTitle = detail?.title || title;
  const placeholderText = loadingSources
    ? '正在实时搜索可用线路...'
    : selectingSource
      ? '正在加载所选线路...'
      : '请先在上方选择播放源';

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className="logo-area">
            <img src="/logo.png" alt="logo" className="logo-img" />
            <div className="logo-text">小黑<span>搜影</span></div>
          </Link>
          <div className={styles.titleBar}>{displayTitle}</div>
          <Link href="/" className={styles.backLink}>← 返回</Link>
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

      <main className={styles.main}>
        <div className={styles.pageHead}>
          <div>
            <h1 className={styles.pageTitle}>{displayTitle}</h1>
            <p className={styles.pageHint}>
              {loadingSources ? '正在搜索各平台实时线路...' : '选择一条线路后即可开始播放'}
            </p>
          </div>
          {!loadingSources && liveSources.length > 0 && (
            <span className={styles.sourceBadge}>{liveSources.length} 条线路</span>
          )}
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            选择播放源
            <span>实时搜索，点击即加载</span>
          </h2>
          <div className={styles.sourceGrid}>
            {loadingSources && (
              <div className={styles.sourceHint}>搜索中，请稍候...</div>
            )}
            {!loadingSources && liveSources.length === 0 && (
              <div className={styles.sourceHint}>未找到可用线路，请返回首页搜索其他关键词</div>
            )}
            {liveSources.map((item) => {
              const key = searchDedupKey(item);
              const sName = item.source_name || item.source;
              const isActive = activeSourceKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectSource(item)}
                  disabled={selectingSource}
                  className={`${styles.sourceBtn} ${isActive ? styles.sourceBtnActive : ''}`}
                >
                  <span className={styles.sourceName}>{sName}</span>
                  <span className={styles.sourceTip}>{item.source_tip || item.category || '高清'}</span>
                  {item.remark && <span className={styles.sourceRemark}>{item.remark}</span>}
                </button>
              );
            })}
          </div>
        </section>

        <div className={styles.bodyGrid}>
          <div className={styles.primary}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                播放器
                {currentName && <span>当前：{currentName}</span>}
              </h2>
              {!currentUrl ? (
                <div className={styles.playerPlaceholder}>
                  <span className={styles.placeholderIcon}>▶</span>
                  <span>{placeholderText}</span>
                </div>
              ) : (
                <div ref={playerRef} className={styles.playerBox} />
              )}
            </section>

            {detail?.episodes?.length > 0 && (
              <section className={`${styles.section} ${styles.episodePanel}`}>
                <h2 className={styles.sectionTitle}>选集播放</h2>
                <div
                  className={`${styles.epGrid} ${detail.episodes.length > 20 ? styles.epGridScroll : ''}`}
                >
                  {detail.episodes.map((ep) => (
                    <button
                      key={ep.url}
                      type="button"
                      className={`${styles.epCard} ${currentUrl === ep.url ? styles.epCardActive : ''}`}
                      onClick={() => {
                        setCurrentUrl(ep.url);
                        setCurrentName(ep.name);
                      }}
                    >
                      {ep.name}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {detail && (
              <section className={styles.infoCard}>
                <div className={styles.infoHead}>
                  <h2 className={styles.infoTitle}>{detail.title}</h2>
                  <div className={styles.infoActions}>
                    {currentUrl && (
                      <button type="button" onClick={toggleMoyu} className={styles.moyuBtn}>
                        <span>🐟</span> 摸鱼模式
                      </button>
                    )}
                    {detail.remark && <span className={styles.remark}>{detail.remark}</span>}
                  </div>
                </div>

                <div className={styles.metaRow}>
                  {detail.year && <span className={styles.metaTag}>{detail.year}</span>}
                  {detail.area && <span className={styles.metaTag}>{detail.area}</span>}
                  {detail.category && <span className={styles.metaTag}>{detail.category}</span>}
                  {detail.source_name && (
                    <span className={`${styles.metaTag} ${styles.metaTagActive}`}>{detail.source_name}</span>
                  )}
                </div>

                <div className={styles.descBlock}>
                  {detail.actor && (
                    <p className={styles.actorLine}><strong>主演：</strong>{detail.actor}</p>
                  )}
                  <div className={styles.descDivider}>
                    <div className={`${styles.descText} ${isDescCollapsed ? styles.descCollapsed : ''}`}>
                      <strong>简介：</strong>{stripHtml(detail.description) || '暂无简介'}
                    </div>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setIsDescCollapsed(!isDescCollapsed)}
                      onKeyDown={(e) => e.key === 'Enter' && setIsDescCollapsed(!isDescCollapsed)}
                      className={styles.descToggle}
                    >
                      {isDescCollapsed ? '展开详情 ▾' : '收起详情 ▴'}
                    </div>
                  </div>
                </div>
              </section>
            )}

            <AdSlot slotId="player_below" adsConfig={adsConfig} />
          </div>

          <aside className={styles.aside}>
            <AdSlot slotId="player_sidebar" adsConfig={adsConfig} />
            {detail && (
              <Recommendations
                category={detail.category}
                currentId={detail.vod_id || id}
              />
            )}
          </aside>
        </div>
      </main>

      <footer className={styles.footer}>
        {config.footer || `© 2026 ${config.site_name}`}
      </footer>
    </div>
  );
}
