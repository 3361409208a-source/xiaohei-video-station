'use client';
import { useState, useEffect, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ChannelContent({ paramsPromise }) {
  const params = use(paramsPromise);
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const type = decodeURIComponent(params.type);
  // 1. 从 URL 严格读取页码，如果不带 pg 参数则默认为 1
  const pgFromUrl = searchParams.get('pg');
  const page = parseInt(pgFromUrl || '1');
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({ site_name: '小黑搜影', notice: '', footer: '' });

  useEffect(() => {
    fetch('/api/config').then(res => res.json()).then(data => setConfig(data));
  }, []);

  // 2. 核心：发起带页码的 API 请求
  useEffect(() => {
    setLoading(true);
    window.scrollTo(0, 0);
    
    // 🔥 增加 timestamp 防止任何形式的缓存
    const apiCall = `/api/search?t=${encodeURIComponent(type)}&pg=${page}&_v=${Date.now()}`;
    console.log('🌚 [大神核心监控] 当前请求 URL:', apiCall);

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
  }, [type, page]); // 只要页码或分类变了，必须重新 Fetch

  const handleSearch = () => {
    if (!query.trim()) return;
    window.location.href = `/?q=${encodeURIComponent(query)}`;
  };

  const changePage = (offset) => {
    const newPage = Math.max(1, page + offset);
    // 3. 通过 router.push 改变 URL 中的 pg 参数，这会触发上面的 useEffect
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
            {['首页', '电影', '电视剧', '短剧', '动漫', '综艺', '纪录片'].map(name => (
              <Link key={name} href={name === '首页' ? '/' : `/channel/${name}`} className={`nav-link ${type === name ? 'active' : ''}`}>
                {name}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="container" style={{ flex: 1 }}>
        <div className="section-header">
          <div className="section-title">最新{type} <span style={{color: '#ff4d4f'}}>(第 {page} 页)</span></div>
          <div className="view-all" style={{ opacity: 0.5 }}>后端已返回 {results.length} 部影片</div>
        </div>

        {loading ? (
          <div className="loading-con" style={{ minHeight: '300px' }}>
            <div className="spinner"></div>
            <div className="loading-text">黑煤球正在从第 {page} 页搬运资源...</div>
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
                <div className="page-info">当前第 {page} 页</div>
                <button className="page-btn" onClick={() => changePage(1)}>下一页</button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '100px 0', opacity: 0.3 }}>该页暂无内容，请点击上一页。</div>
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
