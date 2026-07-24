'use client';
import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowRight, Search, Play, Flame, 
  Smartphone, Tablet, Monitor, Tv,
  Film, Tv2, MonitorPlay, Ghost, Trophy, Star, History, Target, Wand2, Sparkles, Plus, Image as ImageIcon, RefreshCw
} from 'lucide-react';
import styles from './home.module.css';
import LoadingGrid from '@/components/LoadingGrid';
import { buildMoviePath } from '@/utils/movieUrl';

import MobileHomeContent from './MobileHomeContent';

export function DesktopHomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('全部');
  const [latestList, setLatestList] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [hotSearches, setHotSearches] = useState([]);
  const [reelsList, setReelsList] = useState([]);
  const [stats, setStats] = useState({ total: 105632, categories: {} });
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [filterActive, setFilterActive] = useState({ type: '全部', region: '全部', year: '全部' });

  // AI 观影助手交互状态
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);

  const handleAiSubmit = useCallback(async (inputPrompt) => {
    const p = (inputPrompt || aiInput).trim();
    if (!p || aiLoading) return;

    const userMsg = { role: 'user', content: p };
    setAiMessages(prev => [...prev, userMsg]);
    setAiInput('');
    setAiLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: p })
      });
      const data = await res.json();
      setAiMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer || '处理完成',
        movies: data.movies || []
      }]);
    } catch (e) {
      setAiMessages(prev => [...prev, {
        role: 'assistant',
        content: '抱歉，智能分析服务遇到了一点小状况，请重试。'
      }]);
    } finally {
      setAiLoading(false);
    }
  }, [aiInput, aiLoading]);

  // 1. 获取后端真实数据
  useEffect(() => {
    // 基础统计
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) setStats(data);
      })
      .catch(() => {});

    // 热门搜索词
    fetch('/api/trends?limit=10')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setHotSearches(data.map(item => typeof item === 'string' ? item : (item.keyword || item.title)).filter(Boolean));
        }
      })
      .catch(() => {});

    // 最新资源列表
    fetch('/api/latest')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setLatestList(data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // 解说短视频资源
    fetch('/api/reels')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setReelsList(data.slice(0, 4));
      })
      .catch(() => {});
  }, []);

  // 2. 搜索处理
  const handleSearch = useCallback(async (targetQ) => {
    const q = targetQ || query;
    if (!q.trim()) return;

    setLoading(true);
    setIsSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&_ts=${Date.now()}`);
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Search failed', err);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      handleSearch(q);
    }
  }, [searchParams, handleSearch]);

  const categoriesNav = [
    { name: '首页', path: '/', icon: <Sparkles size={16} /> },
    { name: '电影', path: '/channel/电影', icon: <Film size={16} /> },
    { name: '电视剧', path: '/channel/电视剧', icon: <Tv2 size={16} /> },
    { name: '短剧', path: '/channel/短剧', icon: <MonitorPlay size={16} /> },
    { name: '动漫', path: '/channel/动漫', icon: <Ghost size={16} /> },
    { name: '解说', path: '/reels', icon: <Wand2 size={16} /> },
    { name: '综艺', path: '/channel/综艺', icon: <Target size={16} /> },
    { name: '纪录片', path: '/channel/纪录片', icon: <History size={16} /> }
  ];

  // 用于渲染的数据列表
  const displayList = isSearching ? searchResults : latestList;
  
  // 主角英雄推荐位影片
  const heroMovie = displayList[0] || {
    title: '流浪地球 3',
    year: '2025',
    category: '科幻 / 冒险',
    description: '太阳危机即将降临，人类的选项只有一个',
    poster: 'https://image.tmdb.org/t/p/original/tD0h7wzW3Zc1yG1Xq608yIibC9K.jpg'
  };

  // 根据分类筛选最新上线
  const filteredLatest = displayList.filter(item => {
    if (activeCategory === '全部') return true;
    return item.category?.includes(activeCategory) || item.title?.includes(activeCategory);
  });

  const [searchMode, setSearchMode] = useState('normal');

  return (
    <div className={styles.layoutWrapper}>
      {/* 头部导航 */}
      <header className={styles.header}>
        <Link href="/" className={styles.logoArea} onClick={() => { setIsSearching(false); setQuery(''); }}>
          <img src="/logo.png" alt="logo" className={styles.logoImg} onError={(e) => { e.currentTarget.src = '/logo.png'; }} />
          <div>小黑<span>搜影</span></div>
        </Link>

        <nav className={styles.navLinks}>
          {categoriesNav.map(cat => (
            <Link key={cat.name} href={cat.path} className={`${styles.navLink} ${!isSearching && cat.name === '首页' ? styles.active : ''}`}>
              {cat.icon} {cat.name}
            </Link>
          ))}
        </nav>

        <div className={styles.headerRight}>
          <form className={styles.searchBar} onSubmit={(e) => { 
            e.preventDefault(); 
            if (searchMode === 'ai') {
              router.push(`/ai-search?q=${encodeURIComponent(query)}`);
            } else {
              handleSearch(query); 
            }
          }}>
            <div className={styles.searchModeSwitch}>
              <button 
                type="button" 
                className={`${styles.modeBtn} ${searchMode === 'normal' ? styles.activeMode : ''}`} 
                onClick={() => setSearchMode('normal')}
              >
                普通
              </button>
              <button 
                type="button" 
                className={`${styles.modeBtn} ${searchMode === 'ai' ? styles.activeAiMode : ''}`} 
                onClick={() => setSearchMode('ai')}
              >
                <Sparkles size={12} /> AI 搜片
              </button>
            </div>
            <input 
              type="text" 
              className={styles.searchInput} 
              placeholder={searchMode === 'ai' ? "用自然语言搜片，如：高分科幻解说..." : "搜影片、演员、类型..."} 
              value={query} 
              onChange={e => setQuery(e.target.value)} 
            />
            <button type="submit" className={styles.searchBtn}>
              {searchMode === 'ai' ? <Sparkles size={13} /> : <Search size={13} />}
              {searchMode === 'ai' ? 'AI 搜片' : '搜索'}
            </button>
          </form>
          <button className={styles.iconBtn} title="历史记录"><History size={18} /></button>
          <button className={styles.iconBtn} title="收藏"><Star size={18} /></button>
        </div>
      </header>

      {/* 主界面 3 列网格 */}
      <div className={styles.mainContainer}>
        {/* 左侧边栏 */}
        <aside>
          {/* 正在热播（取后端前8条真实数据） */}
          <div className={styles.glassCard}>
            <div className={styles.sectionTitle}>
              <span><Flame size={16} color="#ff4757" style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> 正在热播</span>
              <Link href="/channel/电影" className={styles.more}>更多 <ArrowRight size={14} /></Link>
            </div>
            {(latestList.length > 0 ? latestList.slice(0, 8) : Array(8).fill(null)).map((item, idx) => {
              if (!item) return null;
              const itemId = item.vod_id || item.id;
              const href = buildMoviePath(item.title, itemId);
              const score = (9.8 - idx * 0.1).toFixed(1);

              return (
                <Link key={idx} href={href} className={styles.trendingItem}>
                  <div className={`${styles.trendRank} ${idx < 3 ? styles[`top${idx + 1}`] : ''}`}>{idx + 1}</div>
                  <img 
                    src={item.poster || item.pic || item.vod_pic || '/logo.png'} 
                    alt={item.title} 
                    className={styles.trendThumb}
                    loading={idx < 3 ? 'eager' : 'lazy'}
                    decoding="async"
                    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/logo.png'; }}
                  />
                  <div className={styles.trendInfo}>
                    <div className={styles.trendName}>{item.title}</div>
                    <div className={styles.trendMeta}>{item.year || '2026'} {item.category || '影视'}</div>
                  </div>
                  <div className={styles.trendScore}>{score}</div>
                </Link>
              );
            })}
          </div>

          {/* 观看历史 */}
          <div className={styles.glassCard}>
            <div className={styles.sectionTitle}>观看历史 <span className={styles.more}>全部历史 <ArrowRight size={14} /></span></div>
            {latestList.slice(0, 2).map((item, i) => (
              <Link key={i} href={buildMoviePath(item.title, item.vod_id || item.id)} className={styles.historyItem} style={{ textDecoration: 'none', color: 'inherit' }}>
                <img 
                  src={item.poster || item.pic || '/logo.png'} 
                  alt={item.title} 
                  className={styles.historyThumb}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/logo.png'; }}
                />
                <div className={styles.historyInfo}>
                  <div className={styles.historyName}>{item.title}</div>
                  <div className={styles.historyProgress}>
                    <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: i === 0 ? '45%' : '12%' }} /></div>
                    <span>已看 {i === 0 ? '45%' : '12%'}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* 快捷入口 */}
          <div className={styles.glassCard}>
            <div className={styles.sectionTitle}>快捷入口</div>
            <div className={styles.quickLinksGrid}>
              <Link href="/channel/电影" className={styles.quickLink}><div className={styles.quickLinkIcon}><Film size={20} /></div>电影</Link>
              <Link href="/channel/电视剧" className={styles.quickLink}><div className={styles.quickLinkIcon}><Tv2 size={20} /></div>电视剧</Link>
              <Link href="/channel/短剧" className={styles.quickLink}><div className={styles.quickLinkIcon}><MonitorPlay size={20} /></div>短剧</Link>
              <Link href="/channel/动漫" className={styles.quickLink}><div className={styles.quickLinkIcon}><Ghost size={20} /></div>动漫</Link>
              <Link href="/channel/纪录片" className={styles.quickLink}><div className={styles.quickLinkIcon}><History size={20} /></div>纪录片</Link>
              <Link href="/channel/电影" className={styles.quickLink}><div className={styles.quickLinkIcon}><Target size={20} /></div>4K专区</Link>
              <Link href="/channel/电影" className={styles.quickLink}><div className={styles.quickLinkIcon}><Trophy size={20} /></div>排行榜</Link>
              <Link href="/channel/电影" className={styles.quickLink}><div className={styles.quickLinkIcon}><Star size={20} /></div>收藏夹</Link>
            </div>
          </div>

          {/* 标签筛选 */}
          <div className={styles.glassCard}>
            <div className={styles.sectionTitle}>标签筛选</div>
            <div className={styles.filterRow}>
              <span className={styles.filterLabel}>类型</span>
              <div className={styles.filterTags}>
                {['全部', '科幻', '动作', '爱情', '喜剧', '悬疑', '恐怖', '剧情'].map(tag => (
                  <span key={tag} className={`${styles.filterTag} ${filterActive.type === tag ? styles.active : ''}`} onClick={() => { setFilterActive({...filterActive, type: tag}); handleSearch(tag === '全部' ? '' : tag); }}>{tag}</span>
                ))}
              </div>
            </div>
            <div className={styles.filterRow}>
              <span className={styles.filterLabel}>地区</span>
              <div className={styles.filterTags}>
                {['全部', '内地', '香港', '台湾', '美国', '日本', '韩国'].map(tag => (
                  <span key={tag} className={`${styles.filterTag} ${filterActive.region === tag ? styles.active : ''}`} onClick={() => setFilterActive({...filterActive, region: tag})}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* 中间核心区 */}
        <main>
          {/* Hero大图横幅 */}
          <div className={styles.heroBanner} style={{ backgroundImage: `url(${heroMovie.poster || '/logo.png'})` }}>
            <div className={styles.heroOverlay}>
              <div className={styles.heroSubtitle}>{heroMovie.description || '全网超清资源 实时动态更新'}</div>
              <h1 className={styles.heroTitle}>{heroMovie.title}</h1>
              <div className={styles.heroTags}>
                <span className={styles.heroTag}>{heroMovie.year || '2026'}</span>
                <span className={styles.heroTag}>{heroMovie.category || '精选'}</span>
                <span className={styles.heroTag}>{heroMovie.source_name || '高清源'}</span>
              </div>
              <div className={styles.heroActions}>
                <Link href={buildMoviePath(heroMovie.title, heroMovie.vod_id || heroMovie.id)} className={styles.heroPlayBtn}>
                  <Play size={18} fill="currentColor" /> 立即播放
                </Link>
                <button className={styles.heroSecondaryBtn} title="加入稍后再看"><Target size={18} /></button>
                <button className={styles.heroSecondaryBtn} title="收藏"><Plus size={18} /></button>
              </div>
            </div>
          </div>

          {/* 5 个快捷功能聚合块 */}
          <div className={styles.actionButtonsRow}>
            <div className={styles.actionBtn} onClick={() => handleSearch('高分')}>
              <Sparkles className={styles.actionBtnIcon} color="#b53cff" />
              <div className={styles.actionBtnTitle}>AI 智能推荐</div>
              <div className={styles.actionBtnDesc}>为你发现好片</div>
            </div>
            <div className={styles.actionBtn} onClick={() => handleSearch('蓝光')}>
              <Search className={styles.actionBtnIcon} color="#00f0ff" />
              <div className={styles.actionBtnTitle}>全网聚合搜索</div>
              <div className={styles.actionBtnDesc}>10W+ 资源一键搜</div>
            </div>
            <div className={styles.actionBtn} onClick={() => router.push('/reels')}>
              <Wand2 className={styles.actionBtnIcon} color="#ff00ff" />
              <div className={styles.actionBtnTitle}>AI 解说生成</div>
              <div className={styles.actionBtnDesc}>智能生成解说视频</div>
            </div>
            <div className={styles.actionBtn} onClick={() => router.push('/channel/短剧')}>
              <MonitorPlay className={styles.actionBtnIcon} color="#ffa502" />
              <div className={styles.actionBtnTitle}>短剧畅快看</div>
              <div className={styles.actionBtnDesc}>全网短剧随心看</div>
            </div>
            <div className={styles.actionBtn} onClick={() => router.push('/channel/电影')}>
              <ImageIcon className={styles.actionBtnIcon} color="#00ffff" />
              <div className={styles.actionBtnTitle}>4K 蓝光专区</div>
              <div className={styles.actionBtnDesc}>极致视听体验</div>
            </div>
          </div>

          {/* AI 智能推荐 */}
          <div className={styles.glassCard}>
            <div className={styles.sectionTitle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                AI 智能推荐 <span style={{ fontSize: '12px', color: '#888', fontWeight: 'normal' }}>基于后端真实热门数据</span>
              </div>
              <span className={styles.more} onClick={() => handleSearch('热门')}>换一批 <RefreshCw size={12} style={{ marginLeft: '4px' }} /></span>
            </div>
            {loading ? (
              <LoadingGrid label="正在从后端加载资源..." />
            ) : (
              <div className={styles.movieGrid}>
                {displayList.slice(0, 5).map((item, i) => (
                  <Link key={i} href={buildMoviePath(item.title, item.vod_id || item.id)} className={styles.movieCard}>
                    <div className={styles.moviePoster}>
                      <img 
                        src={item.poster || item.pic || item.vod_pic || '/logo.png'} 
                        alt={item.title}
                        loading={i < 2 ? 'eager' : 'lazy'}
                        decoding="async"
                        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/logo.png'; }}
                      />
                      <span className={styles.movieBadge}>AI 推荐</span>
                      <span className={styles.movieScore}>{(9.8 - i * 0.2).toFixed(1)}</span>
                    </div>
                    <div className={styles.movieInfo}>
                      <div className={styles.movieTitle}>{item.title}</div>
                      <div className={styles.movieDesc}>{item.year || '2026'} · {item.category || '影视'}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* 最新上线 */}
          <div className={styles.glassCard}>
            <div className={styles.sectionTitle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {isSearching ? `“${query}”的搜索结果` : '最新上线'}
                <div className={styles.tabs}>
                  {['全部', '电影', '电视剧', '短剧', '动漫', '综艺'].map(cat => (
                    <div 
                      key={cat} 
                      className={`${styles.tab} ${activeCategory === cat ? styles.active : ''}`}
                      onClick={() => setActiveCategory(cat)}
                    >
                      {cat}
                    </div>
                  ))}
                </div>
              </div>
              <Link href="/channel/电影" className={styles.more}>更多 <ArrowRight size={14} /></Link>
            </div>
            {loading ? (
              <LoadingGrid label="加载中..." />
            ) : (
              <div className={styles.movieGrid}>
                {filteredLatest.slice(0, 10).map((item, i) => (
                  <Link key={i} href={buildMoviePath(item.title, item.vod_id || item.id)} className={styles.movieCard}>
                    <div className={styles.moviePoster}>
                      <img 
                        src={item.poster || item.pic || item.vod_pic || '/logo.png'} 
                        alt={item.title}
                        loading={i < 4 ? 'eager' : 'lazy'}
                        decoding="async"
                        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/logo.png'; }}
                      />
                      <span className={styles.movieBadge} style={{ background: '#ffa502' }}>NEW</span>
                      <span className={styles.movieScore}>{(9.6 - (i % 5) * 0.1).toFixed(1)}</span>
                    </div>
                    <div className={styles.movieInfo}>
                      <div className={styles.movieTitle}>{item.title}</div>
                      <div className={styles.movieDesc}>{item.year || '2026'} · {item.category || '影视'}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* AI 生成解说 */}
          <div className={styles.glassCard}>
            <div className={styles.sectionTitle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                AI 生成解说 <span style={{ fontSize: '12px', color: '#888', fontWeight: 'normal' }}>独家短视频解说</span>
              </div>
              <Link href="/reels" className={styles.more}>去解说频道 <ArrowRight size={14} /></Link>
            </div>
            <div className={styles.movieGrid} style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {(reelsList.length > 0 ? reelsList : displayList.slice(0, 4)).map((item, i) => (
                <Link key={i} href={`/reels?id=${item.vod_id || item.id}&src=${encodeURIComponent(item.source_name || '')}`} className={styles.movieCard}>
                  <div className={styles.moviePoster} style={{ paddingTop: '56.25%' }}>
                    <img 
                      src={item.poster || item.pic || '/logo.png'} 
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/logo.png'; }}
                    />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                      <Play size={32} color="rgba(255,255,255,0.9)" fill="rgba(255,255,255,0.9)" />
                    </div>
                    <span className={styles.movieScore} style={{ fontSize: '12px', color: '#fff', background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: '4px' }}>12:45</span>
                  </div>
                  <div className={styles.movieInfo}>
                    <div className={styles.movieTitle}>{item.title} 深度解说</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </main>

        {/* 右侧边栏 */}
        <aside>
          {/* 全网热搜 (真实后端数据) */}
          <div className={styles.glassCard}>
            <div className={styles.sectionTitle}>
              <span><Flame size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', color: '#00f0ff' }} /> 全网热搜</span>
              <span className={styles.more} onClick={() => handleSearch(hotSearches[0] || '热门')}>刷新 <RefreshCw size={12} style={{ marginLeft: '4px' }} /></span>
            </div>
            <div className={styles.hotSearchList}>
              {(hotSearches.length > 0 ? hotSearches : ['流浪地球3', '长安的荔枝', '执法者们', '楚山海', '新·驯龙高手', '临江仙', '环家侦探', '藏海传']).slice(0, 8).map((keyword, i) => (
                <div key={i} className={styles.hotSearchItem} style={{ cursor: 'pointer' }} onClick={() => { setQuery(keyword); handleSearch(keyword); }}>
                  <div className={`${styles.hotIndex} ${i < 3 ? styles.top3 : ''}`}>{i + 1}</div>
                  <div className={styles.hotTitle}>{keyword}</div>
                  <div className={styles.hotScore}><Flame size={12} fill="currentColor" /> {(120 - i * 11.2).toFixed(1)}w</div>
                </div>
              ))}
            </div>
          </div>

          {/* 今日观影数据 */}
          <div className={styles.glassCard}>
            <div className={styles.sectionTitle}>今日观影数据</div>
            <div className={styles.statsRow}>
              <div className={styles.statCol}>
                <span className={styles.statLabel}>今日新增</span>
                <span className={styles.statValue}>1287</span>
              </div>
              <div className={styles.statCol}>
                <span className={styles.statLabel}>今日播放</span>
                <span className={styles.statValue}>32.6w</span>
              </div>
              <div className={styles.statCol}>
                <span className={styles.statLabel}>收录资源</span>
                <span className={styles.statValue}>{stats.total ? stats.total.toLocaleString() : '402,611'}</span>
              </div>
            </div>
            <div className={styles.chartPlaceholder}></div>
          </div>

          {/* 跨平台观看 */}
          <div className={styles.glassCard}>
            <div className={styles.sectionTitle}>跨平台观看</div>
            <div className={styles.platformsRow}>
              <div><div className={styles.platformIcon}><Smartphone size={24} /></div><div className={styles.platformLabel}>手机</div></div>
              <div><div className={styles.platformIcon}><Tablet size={24} /></div><div className={styles.platformLabel}>平板</div></div>
              <div><div className={styles.platformIcon}><Monitor size={24} /></div><div className={styles.platformLabel}>电脑</div></div>
              <div><div className={styles.platformIcon}><Tv size={24} /></div><div className={styles.platformLabel}>电视</div></div>
            </div>
          </div>
        </aside>
      </div>

      {/* 页脚 */}
      <footer className={styles.footer}>
        <div className={styles.mainContainer} style={{ padding: '0 40px', width: '100%', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <img src="/logo.png" alt="logo" style={{ width: '24px' }} onError={(e) => { e.currentTarget.src = '/logo.png'; }} />
            <strong style={{ color: '#fff' }}>小黑搜影·AI 驱动的未来观影体验</strong>
          </div>
          <div className={styles.footerStats}>
            <div className={styles.footerStat}>
              <span className={styles.statLabel}>已收录资源</span>
              <span className={styles.footerStatValue}>{stats.total ? stats.total.toLocaleString() : '402,611+'}</span>
            </div>
            <div className={styles.footerStat}>
              <span className={styles.statLabel}>用户好评</span>
              <span className={styles.footerStatValue} style={{ color: '#b53cff' }}>99.9%</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!mounted) {
    return <div style={{ background: '#050508', minHeight: '100vh' }}></div>;
  }

  return (
    <Suspense fallback={<LoadingGrid label="正在加载资源" />}>
      {isMobile ? <MobileHomeContent /> : <DesktopHomeContent />}
    </Suspense>
  );
}
