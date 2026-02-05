'use client';
import { useState, useEffect, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ChannelContent({ paramsPromise }) {
  const params = use(paramsPromise);
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const type = decodeURIComponent(params.type);
  const page = parseInt(searchParams.get('pg') || '1');
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({ site_name: '小黑搜影', notice: '', footer: '' });

  const categories = [
    { name: '首页', path: '/' },
    { name: '电影', path: '/channel/电影' },
    { name: '电视剧', path: '/channel/电视剧' },
    { name: '短剧', path: '/channel/短剧' },
    { name: '动漫', path: '/channel/动漫' },
    { name: '综艺', path: '/channel/综艺' },
    { name: '纪录片', path: '/channel/纪录片' }
  ];

  useEffect(() => {
    fetch('/api/config').then(res => res.json()).then(data => setConfig(data));
  }, []);

  useEffect(() => {
    setLoading(true);
    window.scrollTo(0, 0);
    
    // 采用 URL 驱动的分页，并强行打桩验证
    const fetchUrl = `/api/search?t=${encodeURIComponent(type)}&pg=${page}&cache_bust=${Date.now()}`;
    console.log('🌚 黑煤球正在请求:', fetchUrl);
    
    fetch(fetchUrl, {
      cache: 'no-store',
      headers: { 'Pragma': 'no-cache' }
    })
      .then(res => res.json())
      .then(data => {
        // 如果后端返回了调试信息或为空，说明逻辑通了
        setResults(data);
        setLoading(false);
      })
      .catch(() => {
        setResults([]);
        setLoading(false);
      });
  }, [type, page]);

  const handleSearch = () => {
    if (!query.trim()) return;
    window.location.href = `/?q=${encodeURIComponent(query)}`;
  };

  const changePage = (offset) => {
    const newPage = Math.max(1, page + offset);
    router.push(`/channel/${encodeURIComponent(type)}?pg=${newPage}`);
  };

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="site-header">
        <div className="container header-inner">
          <Link href="/" className="logo-area">
            <div className="logo-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"></path></svg>
            </div>
            <div className="logo-text">小黑<span>搜影</span></div>
          </Link>

          <nav className="nav-links">
            {categories.map(cat => (
              <Link key={cat.name} href={cat.path} className={`nav-link ${type === cat.name ? 'active' : ''}`}>
                {cat.name}
              </Link>
            ))}
          </nav>
          <div className="header-right"></div>
        </div>
      </header>

      <section className="hero-section" style={{ padding: '40px 0 20px' }}>
        <div className="container">
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
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()} 
                placeholder={`在 ${type} 频道中搜索...`} 
              />
              <button className="search-btn" onClick={handleSearch}>搜 索</button>
            </div>
          </div>
        </div>
      </section>

      <main className="container" style={{ flex: 1 }}>
        <div className="section-header">
          <div className="section-title">最新{type} <span style={{fontSize: '14px', color: '#ff4d4f'}}>(第 {page} 页)</span></div>
          <div className="view-all" style={{ opacity: 0.5 }}>本页已加载 {results.length} 部影片</div>
        </div>

        {loading ? (
          <div className="loading-con" style={{ minHeight: '300px' }}>
            <div className="spinner"></div>
            <div className="loading-text">黑煤球正在为你翻页...</div>
          </div>
        ) : (
          <>
            <div className="movie-grid">
              {results.map((item, idx) => (
                <Link key={`${item.id}-${item.source_name}-${idx}`} href={`/movie/${encodeURIComponent(`${item.title}-${item.id}`)}?src=${encodeURIComponent(item.source_name)}`} className="movie-card">
                  <div className="movie-poster-wrap">
                    <img className="movie-poster-img" src={item.poster} alt={item.title} onError={(e) => e.target.src = 'https://via.placeholder.com/400x600?text=No+Poster'} />
                    <div className="movie-quality-tag">{item.source_tip || '高清'}</div>
                  </div>
                  <div className="movie-info-name">{item.title}</div>
                  <div className="movie-info-meta">{item.year || '2024'} · {item.category || type}</div>
                </Link>
              ))}
            </div>

            {results.length > 0 ? (
              <div className="pagination">
                <button className="page-btn" disabled={page <= 1} onClick={() => changePage(-1)}>上一页</button>
                <div className="page-info">第 {page} 页</div>
                <button className="page-btn" onClick={() => changePage(1)}>下一页</button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '100px 0', opacity: 0.3 }}>
                <h3>该页暂无内容</h3>
                <p>可能是已经滑到底部了，或者服务器正在更新索引。</p>
                <button className="page-btn" onClick={() => router.push(`/channel/${type}?pg=1`)}>回到第 1 页</button>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="site-footer">
        <div className="container">{config.footer || `© 2026 ${config.site_name}`}</div>
      </footer>
    </div>
  );
}

export default function ChannelPage({ params: paramsPromise }) {
  return (
    <Suspense fallback={<div className="loading-con"><div className="spinner"></div></div>}>
      <ChannelContent paramsPromise={paramsPromise} />
    </Suspense>
  );
}
