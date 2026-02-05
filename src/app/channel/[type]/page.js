'use client';
import { useState, useEffect, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ChannelContent({ paramsPromise }) {
  const params = use(paramsPromise);
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const type = decodeURIComponent(params.type);
  // 核心核心核心：强制从 URL 的 pg 参数中读取页码，这是唯一真理
  const urlPg = searchParams.get('pg');
  const page = parseInt(urlPg || '1');
  
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
    
    // 加上时间戳和显式的 pg 参数，打死缓存
    const apiCall = `/api/search?t=${encodeURIComponent(type)}&pg=${page}&v=${Date.now()}`;
    console.log('🌚 [CLIENT DEBUG] 发起 API 请求:', apiCall);

    fetch(apiCall, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        setResults(data);
        setLoading(false);
      })
      .catch(() => {
        setResults([]);
        setLoading(false);
      });
  }, [type, page]); // 只要 type 或 URL 里的 page 变了，必触发请求

  const handleSearch = () => {
    if (!query.trim()) return;
    window.location.href = `/?q=${encodeURIComponent(query)}`;
  };

  const changePage = (offset) => {
    const newPage = Math.max(1, page + offset);
    // 改变 URL 路径是最高效的触发重新渲染的方式
    router.push(`/channel/${encodeURIComponent(type)}?pg=${newPage}`);
  };

  const forceRefresh = () => {
    window.location.reload();
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
        <div className="section-header" style={{ alignItems: 'flex-end' }}>
          <div>
            <div className="section-title">最新{type} <span style={{fontSize: '14px', color: '#ff4d4f', fontWeight: 'bold'}}>(第 {page} 页)</span></div>
            <div style={{ fontSize: '12px', opacity: 0.5, marginTop: '5px' }}>如果内容未更新，请尝试【暴力刷新】</div>
          </div>
          <button onClick={forceRefresh} style={{ 
            padding: '6px 12px', 
            fontSize: '12px', 
            backgroundColor: '#333', 
            color: '#eee', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}>暴力刷新数据</button>
        </div>

        {loading ? (
          <div className="loading-con" style={{ minHeight: '300px' }}>
            <div className="spinner"></div>
            <div className="loading-text">黑煤球正在从后端【第 {page} 页】搬运数据...</div>
          </div>
        ) : (
          <>
            <div className="movie-grid">
              {results.map((item, idx) => (
                <Link key={`${item.id}-${idx}`} href={`/movie/${encodeURIComponent(`${item.title}-${item.id}`)}?src=${encodeURIComponent(item.source_name)}`} className="movie-card">
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
                <p>可能是网络波动，请尝试【暴力刷新】</p>
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
