'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import Recommendations from '@/components/Recommendations';
import AdSlot from '@/components/AdSlot';
import NoticeBar from '@/components/NoticeBar';
import { resolveAdsConfig } from '@/utils/resolveAdsConfig';
import { searchDedupKey } from '@/utils/searchHelpers';
import {
  getPreferredSource,
  setPreferredSource,
  recordSourceSuccess,
  recordSourceFailure,
  getSourceScore,
  sortSourcesByHealth,
  pickProbeCandidates,
  raceFirstPlayable,
} from '@/utils/sourceHealth';
import styles from './movie-player.module.css';

const toProxyUrl = (url) => `/api/proxy?url=${encodeURIComponent(url)}`;

const HLS_CONFIG = {
  enableWorker: true,
  maxBufferLength: 30,
  fragLoadingMaxRetry: 4,
  levelLoadingMaxRetry: 3,
  manifestLoadingMaxRetry: 3,
  fragLoadingRetryDelay: 800,
  manifestLoadingRetryDelay: 800,
};

export default function MoviePlayer({ id, title, src, initialUrl }) {
  const [detail, setDetail] = useState(null);
  const [currentUrl, setCurrentUrl] = useState('');
  const [currentName, setCurrentName] = useState('');
  const [liveSources, setLiveSources] = useState([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [selectingSource, setSelectingSource] = useState(false);
  const [activeSourceKey, setActiveSourceKey] = useState('');
  const [playStatus, setPlayStatus] = useState('');
  const [switchingLine, setSwitchingLine] = useState(false);
  const [showNotice, setShowNotice] = useState(true);
  const playerRef = useRef(null);
  const dpInstance = useRef(null);
  const hlsInstance = useRef(null);
  const handleSelectSourceRef = useRef(null);
  const liveSourcesRef = useRef([]);
  const activeSourceKeyRef = useRef('');
  const activeSourceNameRef = useRef('');
  const titleRef = useRef(title);
  const triedSourceKeysRef = useRef(new Set());
  const autoSwitchingRef = useRef(false);
  const currentUrlRef = useRef('');
  const [isDescCollapsed, setIsDescCollapsed] = useState(true);
  const [config, setConfig] = useState({ site_name: '小黑搜影', footer: '', ads: { enabled: false }, private_traffic: {} });
  const configSiteNameRef = useRef('小黑搜影');
  configSiteNameRef.current = config.site_name;
  titleRef.current = title;
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

  const destroyPlayer = useCallback(() => {
    if (hlsInstance.current) {
      try { hlsInstance.current.destroy(); } catch (_) { /* ignore */ }
      hlsInstance.current = null;
    }
    if (dpInstance.current) {
      try { dpInstance.current.destroy(); } catch (_) { /* ignore */ }
      dpInstance.current = null;
    }
  }, []);

  const handleSelectSource = useCallback(async (item, {
    auto = false,
    preloadedDetail = null,
    preloadedEpisode = null,
  } = {}) => {
    const sName = item.source_name || item.source;
    const vodId = item.vod_id || item.id;
    if (!sName || !vodId) return false;

    const key = searchDedupKey(item);
    setSelectingSource(true);
    setSwitchingLine(true);
    setActiveSourceKey(key);
    activeSourceKeyRef.current = key;
    activeSourceNameRef.current = sName;
    if (auto) {
      setPlayStatus(`正在切换线路：${sName}`);
    }

    try {
      let data = preloadedDetail;
      if (!data) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
        const res = await fetch(`/api/detail?id=${vodId}&src=${encodeURIComponent(sName)}`, {
          signal: controller.signal,
        });
        clearTimeout(timer);
        data = await res.json();
      }

      if (!data || data.error || !data.episodes?.length) {
        recordSourceFailure(sName, 'fail');
        if (!auto) {
          alert('该线路暂时不可用，请换其他源');
          setActiveSourceKey('');
          activeSourceKeyRef.current = '';
          activeSourceNameRef.current = '';
        }
        setPlayStatus(auto ? `线路「${sName}」不可用，继续尝试...` : '');
        return false;
      }

      setDetail(data);
      document.title = `${data.title}在线免费观看 - ${configSiteNameRef.current}`;

      const matched = initialUrl
        ? data.episodes.find((episode) => episode.url === initialUrl)
        : null;
      const target = matched || preloadedEpisode || data.episodes[0];
      currentUrlRef.current = target.url;
      setCurrentUrl(target.url);
      setCurrentName(target.name);
      setPlayStatus(auto ? `已切换至「${sName}」` : '');
      return true;
    } catch (err) {
      console.error('Select source failed', err);
      recordSourceFailure(sName, err?.name === 'AbortError' ? 'timeout' : 'fail');
      if (!auto) {
        alert('加载线路失败，请换其他源');
        setActiveSourceKey('');
        activeSourceKeyRef.current = '';
        activeSourceNameRef.current = '';
      }
      setPlayStatus(auto ? `线路「${sName}」加载失败，继续尝试...` : '');
      return false;
    } finally {
      setSelectingSource(false);
      setSwitchingLine(false);
    }
  }, [initialUrl]);

  handleSelectSourceRef.current = handleSelectSource;

  const tryNextSource = useCallback(async () => {
    if (autoSwitchingRef.current) return;
    autoSwitchingRef.current = true;

    const sources = liveSourcesRef.current;
    const currentKey = activeSourceKeyRef.current;
    if (currentKey) triedSourceKeysRef.current.add(currentKey);

    const remaining = sources.filter((item) => !triedSourceKeysRef.current.has(searchDedupKey(item)));
    if (!remaining.length) {
      setPlayStatus('所有线路均播放失败，请稍后再试或换关键词搜索');
      alert('当前线路播放失败，请换其他源');
      autoSwitchingRef.current = false;
      return;
    }

    setPlayStatus('正在探测下一条可用线路...');
    const candidates = pickProbeCandidates(remaining, { topN: 3 });
    const probed = await raceFirstPlayable(candidates, { timeoutMs: 6500 });

    if (probed) {
      const ok = await handleSelectSourceRef.current?.(probed.item, {
        auto: true,
        preloadedDetail: probed.detail,
        preloadedEpisode: probed.episode,
      });
      autoSwitchingRef.current = false;
      if (!ok) {
        triedSourceKeysRef.current.add(searchDedupKey(probed.item));
        tryNextSource();
      }
      return;
    }

    const next = remaining[0];
    const ok = await handleSelectSourceRef.current?.(next, { auto: true });
    autoSwitchingRef.current = false;
    if (!ok) {
      triedSourceKeysRef.current.add(searchDedupKey(next));
      tryNextSource();
    }
  }, []);

  useEffect(() => {
    setDetail(null);
    setCurrentUrl('');
    setCurrentName('');
    setLiveSources([]);
    setActiveSourceKey('');
    setPlayStatus('');
    liveSourcesRef.current = [];
    activeSourceKeyRef.current = '';
    activeSourceNameRef.current = '';
    triedSourceKeysRef.current = new Set();
    currentUrlRef.current = '';
    destroyPlayer();
  }, [id, title, destroyPlayer]);

  useEffect(() => {
    if (!title) return undefined;

    let cancelled = false;
    setLoadingSources(true);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    // 并行发起：quick 用于早返回探活，full 用于补全源列表
    const doQuick = fetch(`/api/search/quick?q=${encodeURIComponent(title)}&limit=5`, {
      signal: controller.signal,
    }).then((r) => r.json()).then((data) => (Array.isArray(data) ? data : []))
      .catch(() => []);

    const doFull = fetch(`/api/search?q=${encodeURIComponent(title)}&_ts=${Date.now()}`, {
      signal: controller.signal,
    }).then((r) => r.json()).then((data) => (Array.isArray(data) ? data : []))
      .catch(() => []);

    Promise.all([doQuick, doFull]).then(async ([quick, full]) => {
      if (cancelled) return;

      const remembered = getPreferredSource(title);
      const preferredName = src || '';
      document.title = `${title} - 选择播放源 - ${configSiteNameRef.current}`;

      // 先用 full 渲染按钮列表
      if (full.length) {
        const sortedFull = sortSourcesByHealth(full, {
          preferredName,
          rememberedName: remembered,
        });
        setLiveSources(sortedFull);
        liveSourcesRef.current = sortedFull;
      }

      // 用 quick 探活开播
      const probeList = quick.length
        ? sortSourcesByHealth(quick, { preferredName, rememberedName: remembered })
        : [];
      if (probeList.length) {
        setPlayStatus(
          remembered
            ? `优先探测上次可用线路「${remembered}」...`
            : '正在探测可用线路...',
        );
        const candidates = pickProbeCandidates(probeList, {
          preferredName,
          rememberedName: remembered,
          topN: 3,
        });
        const probed = await raceFirstPlayable(candidates, { timeoutMs: 6500 });
        if (cancelled) return;

        if (probed) {
          await handleSelectSourceRef.current?.(probed.item, {
            auto: true,
            preloadedDetail: probed.detail,
            preloadedEpisode: probed.episode,
          });
          return;
        }
      }

      // quick 探活失败时退回到 full 第一条
      if (full.length) {
        const sortedFull = sortSourcesByHealth(full, {
          preferredName,
          rememberedName: remembered,
        });
        if (!liveSourcesRef.current.length) {
          setLiveSources(sortedFull);
          liveSourcesRef.current = sortedFull;
        }
        await handleSelectSourceRef.current?.(sortedFull[0], { auto: true });
      }
    }).catch((err) => {
      if (err?.name !== 'AbortError') console.error('Live search failed', err);
    }).finally(() => {
      clearTimeout(timer);
      if (!cancelled) setLoadingSources(false);
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [title, src]);

  useEffect(() => {
    if (typeof window === 'undefined' || !currentUrl) return undefined;

    let disposed = false;
    let started = false;
    currentUrlRef.current = currentUrl;
    const playUrl = toProxyUrl(currentUrl);

    const failOver = (reason) => {
      if (disposed || autoSwitchingRef.current) return;
      const name = activeSourceNameRef.current;
      if (name) {
        recordSourceFailure(name, /超时/.test(reason || '') ? 'timeout' : 'fail');
      }
      setPlayStatus(reason || '播放失败，正在自动切换线路...');
      tryNextSource();
    };

    const attachHls = (Hls, video, player, url) => {
      if (hlsInstance.current) {
        try { hlsInstance.current.destroy(); } catch (_) { /* ignore */ }
        hlsInstance.current = null;
      }

      const hls = new Hls(HLS_CONFIG);
      hlsInstance.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      player.hls = hls;
      let networkRetries = 0;
      let mediaRetries = 0;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!disposed) {
          started = true;
          networkRetries = 0;
          mediaRetries = 0;
          const name = activeSourceNameRef.current;
          if (name) {
            recordSourceSuccess(name);
            setPreferredSource(titleRef.current, name);
          }
          setPlayStatus('');
          try {
            video.play?.().catch(() => {});
            player.play?.();
          } catch (_) { /* ignore autoplay block */ }
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (disposed) return;

        const status = data?.response?.code || data?.response?.status || 0;
        const hardFail = status === 403 || status === 404 || status === 410 || status === 502 || status === 504;

        if (hardFail) {
          failOver(`线路不可用(${status})，正在自动切换...`);
          return;
        }

        if (!data.fatal) return;

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < 1) {
          networkRetries += 1;
          try {
            hls.startLoad();
            return;
          } catch (_) { /* fall through */ }
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetries < 2) {
          mediaRetries += 1;
          try {
            hls.recoverMediaError();
            return;
          } catch (_) { /* fall through */ }
        }

        failOver('播放失败，正在自动切换线路...');
      });

      return hls;
    };

    const watchdog = setTimeout(() => {
      if (!disposed && !started) {
        failOver('线路响应超时，正在自动切换...');
      }
    }, 8000);

    Promise.all([import('hls.js'), import('dplayer')]).then(([HlsModule, DPlayerModule]) => {
      if (disposed || currentUrlRef.current !== currentUrl) return;

      const Hls = HlsModule.default;
      const DPlayer = DPlayerModule.default;

      const onNativeError = () => {
        failOver('播放失败，正在自动切换线路...');
      };

      if (dpInstance.current?.video) {
        const video = dpInstance.current.video;
        if (Hls.isSupported()) {
          attachHls(Hls, video, dpInstance.current, playUrl);
          dpInstance.current.play();
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = playUrl;
          video.addEventListener('error', onNativeError);
        }
        return;
      }

      dpInstance.current = new DPlayer({
        container: playerRef.current,
        autoplay: true,
        theme: '#ec2d7a',
        video: { url: playUrl, type: 'hls' },
        customType: {
          hls(video, player) {
            if (Hls.isSupported()) {
              attachHls(Hls, video, player, playUrl);
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
              video.src = playUrl;
              video.addEventListener('error', onNativeError);
            }
          },
        },
      });

      dpInstance.current.on('error', onNativeError);
    });

    return () => {
      disposed = true;
      clearTimeout(watchdog);
    };
  }, [currentUrl, tryNextSource]);

  useEffect(() => () => destroyPlayer(), [destroyPlayer]);

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
      : playStatus || '请先在上方选择播放源';

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
              {loadingSources
                ? '正在搜索各平台实时线路...'
                : playStatus || '已按可用度智能选源，也可手动切换'}
            </p>
          </div>
          {!loadingSources && liveSources.length > 0 && (
            <span className={styles.sourceBadge}>{liveSources.length} 条线路</span>
          )}
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            选择播放源
            <span>智能排序 · 探活开播 · 失败自动换线</span>
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
              const score = getSourceScore(sName);
              const isBad = score < -6;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    triedSourceKeysRef.current = new Set();
                    handleSelectSource(item);
                  }}
                  disabled={selectingSource}
                  className={`${styles.sourceBtn} ${isActive ? styles.sourceBtnActive : ''} ${isBad ? styles.sourceBtnBad : ''}`}
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
                <div className={styles.playerWrap}>
                  <div ref={playerRef} className={styles.playerBox} />
                  {switchingLine && <div className={styles.playerSwitchOverlay} />}
                  {playStatus && (
                    <div className={styles.playStatus}>{playStatus}</div>
                  )}
                </div>
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
                        setPlayStatus('');
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
