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

  useEffect(() => {
    fetch('/api/config').then(res => res.json()).then(data => setConfig(data));
  }, []);

  // 核心：监听 type 和 page 的变化，发起 API 请求并打印详细日志
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      window.scrollTo(0, 0);
      
      const apiCall = `/api/search?t=${encodeURIComponent(type)}&pg=${page}&_nocache=${Date.now()}`;
      console.log(`%c🚀 [REQUEST] 正在搬运第 ${page} 页数据...`, 'color: #38bdf8; font-weight: bold;');
      console.log(`%c🔗 URL: ${apiCall}`, 'color: #94a3b8;');

      try {
        const res = await fetch(apiCall, { cache: 'no-store' });
        const data = await res.json();
        
        if (Array.isArray(data)) {
          setResults(data);
          // 打印数据特征，方便在控制台肉眼验证
          console.log(`%c✅ [RESPONSE] 成功接收到 ${data.length} 条影片`, 'color: #10b981; font-weight: bold;');
          if (data.length > 0) {
            console.log('%c🔍 本页首批影片预览:', 'color: #f59e0b;');
            data.slice(0, 3).forEach((item, i) => {
              console.log(`   ${i+1}. [ID: ${item.id}] ${item.title}`);
            });
          }
        } else {
          setResults([]);
          console.warn('⚠️ [RESPONSE] 返回的数据不是数组格式');
        }
      } catch (error) {
        console.error('❌ [ERROR] 数据请求失败:', error);
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
          <div className="view-all" style={{ opacity: 0.5 }}>PAGE {page}</div>
        </div>

        {loading ? (
          <div className="loading-con">
            <div className="spinner"></div>
            <div className="loading-text">正在从全量库搬运第 {page} 页数据...</div>
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

            <div className="pagination">
              <button className="page-btn" disabled={page <= 1} onClick={() => goToPage(page - 1)}>上一页</button>
              <div className="page-info">第 {page} 页</div>
              <button className="page-btn" disabled={results.length < 30} onClick={() => goToPage(page + 1)}>下一页</button>
            </div>
            
            {results.length === 0 && (
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
