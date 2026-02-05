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
  
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({ site_name: '小黑搜影', notice: '', footer: '' });
  const [isMobile, setIsMobile] = useState(false);

  // 1. 基础配置与设备检测
  useEffect(() => {
    fetch('/api/config').then(res => res.json()).then(data => setConfig(data));
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 2. 核心：监听 type 和 page 的变化
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      window.scrollTo(0, 0);
      
      try {
        const apiCall = `/api/search?t=${encodeURIComponent(type)}&pg=${page}&_nocache=${Date.now()}`;
        console.log(`🌚 [DEBUG] 第 ${page} 页 URL: ${apiCall}`);

        const res = await fetch(apiCall, { cache: 'no-store' });
        const data = await res.json();
        
        if (Array.isArray(data)) {
          setResults(data);
          console.log(`✅ [RESPONSE] 收到 ${data.length} 条数据`);
        } else {
          setResults([]);
        }
      } catch (error) {
        console.error('Fetch error:', error);
        setResults([]);
      }
      setLoading(false);
    };

    fetchData();
  }, [type, page]);

  const goToPage = (newPage) => {
    if (newPage < 1) return;
    router.push(`/channel/${encodeURIComponent(type)}?pg=${newPage}`);
  };

  // 大哥指示：移动端最多展示 15 个
  const displayResults = isMobile ? results.slice(0, 15) : results;

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
            {['首页', '电影', '电视剧', '短剧', '动漫', '综艺', '纪录片'].map(name => {
              const path = name === '首页' ? '/' : `/channel/${name}`;
              return (
                <Link key={name} href={path} className={`nav-link ${type === name ? 'active' : ''}`}>
                  {name}
                </Link>
              );
            })}
          </nav>
          <div className="header-right"></div>
        </div>
      </header>

      <main className="container" style={{ flex: 1 }}>
        <div className="section-header">
          <div className="section-title">最新{type}</div>
          <div className="view-all" style={{ opacity: 0.5 }}>PAGE {page} {isMobile && '(MOBILE 15)'}</div>
        </div>

        {loading ? (
          <div className="loading-con">
            <div className="spinner"></div>
            <div className="loading-text">正在从全量库搬运第 {page} 页数据...</div>
          </div>
        ) : (
          <>
            <div className="movie-grid">
              {displayResults.map((item, idx) => (
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

            <div className="pagination">
              <button className="page-btn" disabled={page <= 1} onClick={() => goToPage(page - 1)}>上一页</button>
              <div className="page-info">第 {page} 页</div>
              <button className="page-btn" disabled={results.length < (isMobile ? 15 : 30)} onClick={() => goToPage(page + 1)}>下一页</button>
            </div>
            
            {displayResults.length === 0 && (
              <div style={{ textAlign: 'center', padding: '100px 0', opacity: 0.3 }}>该页暂无更多内容</div>
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
