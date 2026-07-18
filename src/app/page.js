'use client';
import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowRight, Film, Play, Search, Sparkles, X } from 'lucide-react';
import AdSlot from '@/components/AdSlot';
import LoadingGrid from '@/components/LoadingGrid';
import { resolveAdsConfig } from '@/utils/resolveAdsConfig';
import { buildMoviePath } from '@/utils/movieUrl';

const FALLBACK_HOT = ['剑来', '小城大事'];
const ThreeDashboard = dynamic(() => import('@/components/ThreeDashboard'), {
  ssr: false,
  loading: () => <div className="ambient-backdrop" aria-hidden="true" />,
});

function HomeContent() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('首页');
  const [config, setConfig] = useState({ site_name: '小黑搜影', notice: '', footer: '', ads: { enabled: false }, private_traffic: {} });
  const [isMobile, setIsMobile] = useState(null); // null 表示尚未在客户端确定
  const [stats, setStats] = useState(null);
  const [hotSearches, setHotSearches] = useState(FALLBACK_HOT);
  const [searchError, setSearchError] = useState('');

  const adsConfig = resolveAdsConfig(config.ads, config.private_traffic);

  const categories = [
    { name: '首页', path: '/', active: true },
    { name: '🔥 去看解说', path: '/reels' },
    { name: '电影', path: '/channel/电影' },
    { name: '电视剧', path: '/channel/电视剧' },
    { name: '短剧', path: '/channel/短剧' },
    { name: '动漫', path: '/channel/动漫' },
    { name: '综艺', path: '/channel/综艺' },
    { name: '纪录片', path: '/channel/纪录片' }
  ];

  useEffect(() => {
    fetch('/api/config').then(res => res.json()).then(data => setConfig(data)).catch(() => {});
    fetch('/api/trends?limit=10')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length) {
          setHotSearches(data.map(item => item.keyword || item).filter(Boolean));
        }
      })
      .catch(() => setHotSearches(FALLBACK_HOT));
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        const filteredCats = {};
        Object.entries(data.categories || {}).forEach(([k, v]) => {
          if (!k.includes('伦理') && !k.includes('解说')) filteredCats[k] = v;
        });
        setStats({ ...data, categories: filteredCats });
      })
      .catch(() => {
        // 当接口请求失败（如无后端）时，进行默认数据兜底，使 3D 星空大屏正常显示
        setStats({
          total: 12840,
          categories: {
            '电影': 5820,
            '电视剧': 3240,
            '短剧': 1580,
            '动漫': 1220,
            '综艺': 660,
            '纪录片': 320
          }
        });
      });

    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSearch = useCallback(async (q) => {
    const targetQ = q || '';
    if (!targetQ.trim()) return;

    setLoading(true);
    setSearchError('');
    setActiveTab('搜索');
    if (typeof window !== 'undefined') window.scrollTo({ top: 300, behavior: 'smooth' });

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(targetQ)}&_ts=${Date.now()}`);
      if (!response.ok) throw new Error('Search request failed');
      const data = await response.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
      setSearchError('搜索暂时开小差了，请稍后再试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      handleSearch(q);
    } else {
      setLoading(true);
      fetch('/api/latest')
        .then(res => res.json())
        .then(data => {
          setResults(Array.isArray(data) ? data.slice(0, 12) : []);
          setLoading(false);
        })
        .catch(() => {
          setResults([]);
          setSearchError('内容加载失败，请刷新后重试');
          setLoading(false);
        });
    }
  }, [searchParams, handleSearch]);

  // isMobile 为 null 时（SSR/挂载前），默认展示全部，避免 hydration 不一致
  const displayResults = (isMobile === true && Array.isArray(results)) ? results.slice(0, 15) : (Array.isArray(results) ? results : []);

  return (
    <div className="page-wrapper">
      {isMobile === false && stats && <ThreeDashboard stats={stats} isBackground={true} />}
      <header className="site-header">
        <div className="container header-inner">
          <Link href="/" className="logo-area" aria-label="小黑搜影首页">
            <img src="/logo.png" alt="" className="logo-img" />
            <div className="logo-text">小黑<span>搜影</span></div>
          </Link>

          <nav className="nav-links">
            {categories.map(cat => (
              <Link key={cat.name} href={cat.path} className={`nav-link ${activeTab === '首页' && cat.name === '首页' ? 'active' : ''} ${cat.name.includes('解说') ? 'special-link' : ''}`}>
                {cat.name}
              </Link>
            ))}
          </nav>
          <div className="header-right">
            <span className="live-dot" />
            资源实时更新
          </div>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-glow hero-glow-one" aria-hidden="true" />
        <div className="hero-glow hero-glow-two" aria-hidden="true" />
        <div className="container">
          <div className="hero-eyebrow"><Sparkles size={15} /> 全网高清资源 · 即搜即看</div>
          <h1 className="hero-title">发现属于你的<br /><span>精彩世界</span></h1>
          <p className="hero-subtitle">聚合电影、剧集、动漫与综艺，用更轻松的方式找到下一部好片。</p>
          <div className="search-container">
            <form className="search-bar-wrapper" onSubmit={(event) => { event.preventDefault(); handleSearch(query); }}>
              <div className="search-icon-left">
                <Search size={20} aria-hidden="true" />
              </div>
              <input type="search" className="search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索片名、演员或类型..." aria-label="搜索影视内容" />
              {query && <button className="search-clear" type="button" onClick={() => setQuery('')} aria-label="清空搜索"><X size={17} /></button>}
              <button className="search-btn" type="submit">搜索 <ArrowRight size={17} /></button>
            </form>
            <div className="hot-searches">
              <span className="hot-label">正在热搜</span>
              {hotSearches.map(tag => (
                <button key={tag} type="button" className="hot-tag" onClick={() => { setQuery(tag); handleSearch(tag); }}>{tag}</button>
              ))}
            </div>
            <AdSlot slotId="home_below_search" adsConfig={adsConfig} />
          </div>
          <div className="hero-metrics" aria-label="站点内容概览">
            <div><Film size={17} /><strong>{stats?.total ? stats.total.toLocaleString() : '12,000+'}</strong><span>部精选内容</span></div>
            <span className="metric-divider" />
            <div><Play size={17} /><strong>6</strong><span>大内容频道</span></div>
            <span className="metric-divider" />
            <div><span className="metric-pulse" /><strong>24h</strong><span>持续更新</span></div>
          </div>
        </div>
      </section>

      <main className="container home-main">
        {loading ? (
          <LoadingGrid label={activeTab === '搜索' ? `正在搜索“${query}”` : '正在发现今日好片'} />
        ) : (
          displayResults.length > 0 ? (
            <>
              <div className="section-header">
                <div>
                  <span className="section-kicker">{activeTab === '搜索' ? `${displayResults.length} 个匹配结果` : 'TRENDING NOW'}</span>
                  <h2 className="section-title">{activeTab === '搜索' ? `“${query}”的搜索结果` : '今日热播推荐'}</h2>
                </div>
                {activeTab !== '搜索' && <Link href="/channel/电影" className="view-all">查看全部 <ArrowRight size={16} /></Link>}
              </div>
              <div className="movie-grid">
                {displayResults.map((item, idx) => {
                  // 兼容：实时搜索结果用 item.id，数据库结果用 item.vod_id
                  const itemId = item.vod_id || item.id;
                  const isReel = item.category?.includes('解说') || item.title?.includes('解说');
                  const targetHref = isReel
                    ? `/reels?id=${itemId}&src=${encodeURIComponent(item.source_name || item.source)}`
                    : buildMoviePath(item.title, itemId);

                  return (
                    <Link key={`${itemId}-${idx}`} href={targetHref} className="movie-card" style={{ '--card-index': idx }}>
                      <div className="movie-poster-wrap">
                        <img className="movie-poster-img" src={item.poster || '/logo.png'} alt={item.title} loading={idx > 5 ? 'lazy' : 'eager'} decoding="async" onError={(e) => { e.currentTarget.src = '/logo.png'; }} />
                        <div className="movie-poster-shade" />
                        <span className="movie-play"><Play size={18} fill="currentColor" /></span>
                        <div className="movie-quality-tag">{item.source_tip || '高清'}</div>
                      </div>
                      <div className="movie-info-name">{item.title}</div>
                      <div className="movie-info-meta">{item.year || '2026'} · {item.category || '影视'}</div>
                    </Link>
                  );
                })}

              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon"><Search size={26} /></div>
              <h2>{searchError || '没有找到相关内容'}</h2>
              <p>{searchError ? '检查网络后再试一次，精彩内容很快回来。' : '换一个片名、演员或更简短的关键词试试。'}</p>
              {activeTab === '搜索' && <button type="button" onClick={() => { setQuery(''); setActiveTab('首页'); window.location.href = '/'; }}>返回热门推荐</button>}
            </div>
          )
        )}
      </main>

      <footer className="site-footer">
        <div className="container">{config.footer || `© 2026 ${config.site_name}`}</div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingGrid label="正在准备精彩内容" />}>
      <HomeContent />
    </Suspense>
  );
}
