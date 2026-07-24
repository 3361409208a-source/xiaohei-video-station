'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { buildMoviePath } from '@/utils/movieUrl';

function HomeContent() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('首页');
  const [config, setConfig] = useState({ site_name: '小黑搜影', notice: '', footer: '' });
  const [isMobile, setIsMobile] = useState(null);
  const [hotSearches, setHotSearches] = useState(['剑来', '小城大事']);

  const categories = [
    { name: '首页', path: '/', active: true },
    { name: '🔥 去看解说', path: '/reels' },
    { name: '电影', path: '/channel/电影' },
    { name: '电视剧', path: '/channel/电视剧' },
    { name: '短剧', path: '/channel/短剧' },
    { name: '动漫', path: '/channel/动漫' },
    { name: '综艺', path: '/channel/综艺' },
    { name: '纪录片', path: '/channel/纪录片' },
  ];

  useEffect(() => {
    fetch('/api/config').then(res => res.json()).then(data => setConfig(data)).catch(() => {});

    fetch('/api/trends')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setHotSearches(data.slice(0, 6).map(item => item.keyword || item).filter(Boolean));
        }
      })
      .catch(() => {});

    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSearch = async (q = '') => {
    const targetQ = q || query;
    if (!targetQ.trim()) return;

    setLoading(true);
    setActiveTab('搜索');
    if (typeof window !== 'undefined') window.scrollTo({ top: 300, behavior: 'smooth' });

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(targetQ)}&_ts=${Date.now()}`);
      const data = await response.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      handleSearch(q);
      return;
    }

    setActiveTab('首页');
    setLoading(true);
    fetch('/api/latest')
      .then(res => res.json())
      .then(data => {
        setResults(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [searchParams]);

  const displayResults = (isMobile === true && Array.isArray(results))
    ? results.slice(0, 18)
    : (Array.isArray(results) ? results : []);

  return (
    <div className="page-wrapper">
      <header className="site-header">
        <div className="container header-inner">
          <Link href="/" className="logo-area">
            <img src="/logo.png" alt="logo" className="logo-img" />
            <div className="logo-text">小黑<span>搜影</span></div>
          </Link>

          <nav className="nav-links">
            {categories.map(cat => (
              <Link
                key={cat.name}
                href={cat.path}
                className={`nav-link ${activeTab === '首页' && cat.name === '首页' ? 'active' : ''} ${cat.name.includes('解说') ? 'special-link' : ''}`}
              >
                {cat.name}
              </Link>
            ))}
          </nav>
          <div className="header-right"><span className="live-dot" />资源实时更新</div>
        </div>
      </header>

      <section className="hero-section">
        <div className="container">
          <h1 className="hero-title">发现属于你的 <span>精彩世界</span></h1>
          <div className="search-container">
            <div className="search-bar-wrapper">
              <div className="search-icon-left">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </div>
              <input
                type="text"
                className="search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
                placeholder="搜索电影、电视剧、动漫、演员..."
              />
              <button type="button" className="search-btn" onClick={() => handleSearch(query)}>搜 索</button>
            </div>
            <div className="hot-searches">
              <span className="hot-label">热门搜索:</span>
              {hotSearches.map(tag => (
                <span
                  key={tag}
                  className="hot-tag"
                  style={{ cursor: 'pointer' }}
                  onClick={() => { setQuery(tag); handleSearch(tag); }}
                >
                  {tag}
                </span>
              ))}
            </div>
            <Link href="/ai-search" className="ai-showcase-link">
              <Sparkles size={14} aria-hidden="true" />
              AI 搜片体验（展示版，暂不调用 AI 服务）
            </Link>
          </div>
        </div>
      </section>

      <main className="container" style={{ flex: 1 }}>
        {loading ? (
          <div className="loading-con">
            <img src="/logo.gif" alt="loading" style={{ width: '80px', height: '80px', borderRadius: '12px' }} />
            <div className="loading-text">正在加载最近更新...</div>
          </div>
        ) : (
          displayResults.length > 0 && (
            <>
              <div className="section-header">
                <div className="section-title">{activeTab === '搜索' ? `"${query}"的搜索结果` : '最近更新'}</div>
                {activeTab !== '搜索' && <Link href="/channel/电影" className="view-all">查看更多 ›</Link>}
              </div>
              <div className="movie-grid">
                {displayResults.map((item, idx) => {
                  const itemId = item.vod_id || item.id;
                  const category = item.category || '';
                  const isReel = category.includes('解说') || (item.title || '').includes('解说');
                  const targetHref = isReel
                    ? `/reels?id=${itemId}&src=${encodeURIComponent(item.source_name || item.source || '')}`
                    : buildMoviePath(item.title, itemId);

                  return (
                    <Link key={`${itemId}-${idx}`} href={targetHref} className="movie-card">
                      <div className="movie-poster-wrap">
                        <img
                          className="movie-poster-img"
                          src={item.poster}
                          alt={item.title}
                          onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/400x600?text=No+Poster'; }}
                        />
                        <div className="movie-quality-tag">{item.source_tip || '高清'}</div>
                      </div>
                      <div className="movie-info-name">{item.title}</div>
                      <div className="movie-info-meta">{item.year || '2026'} · {category || '影视'}</div>
                    </Link>
                  );
                })}
              </div>
            </>
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
    <Suspense fallback={
      <div className="page-loading-screen">
        <img src="/logo.gif" alt="loading" style={{ width: '80px', height: '80px', borderRadius: '12px' }} />
        <div className="loading-text">正在加载...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
