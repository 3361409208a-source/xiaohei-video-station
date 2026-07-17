'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { buildMoviePath } from '@/utils/movieUrl';

export default function ChannelClient({
  type,
  initialPage = 1,
  initialResults = [],
  initialSubCategories = [],
}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const page = parseInt(searchParams.get('pg') || String(initialPage), 10);

  const [results, setResults] = useState(initialResults);
  const [loading, setLoading] = useState(!initialResults.length);
  const [subCategory, setSubCategory] = useState('全部');
  const [subCategories, setSubCategories] = useState(
    initialSubCategories.length ? ['全部', ...initialSubCategories] : []
  );
  const [config, setConfig] = useState({ site_name: '小黑搜影', notice: '', footer: '' });
  const [isMobile, setIsMobile] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const usedInitialRef = useRef(false);

  useEffect(() => {
    setSubCategory('全部');
    if (!initialSubCategories.length) {
      fetch(`/api/categories?t=${encodeURIComponent(type)}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setSubCategories(['全部', ...data]);
          }
        })
        .catch(() => {});
    }
  }, [type, initialSubCategories.length]);

  useEffect(() => {
    fetch('/api/config').then((res) => res.json()).then((data) => setConfig(data));
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    usedInitialRef.current = false;
  }, [type]);

  useEffect(() => {
    if (
      page === initialPage &&
      subCategory === '全部' &&
      initialResults.length > 0 &&
      !usedInitialRef.current
    ) {
      usedInitialRef.current = true;
      setResults(initialResults);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      window.scrollTo(0, 0);
      try {
        const classTag = subCategory === '全部' ? '' : subCategory;
        const apiCall = `/api/search?t=${encodeURIComponent(type)}&class_tag=${encodeURIComponent(classTag)}&pg=${page}&_nocache=${Date.now()}`;
        const res = await fetch(apiCall, { cache: 'no-store' });
        const data = await res.json();
        if (Array.isArray(data)) setResults(data);
        else setResults([]);
      } catch {
        setResults([]);
      }
      setLoading(false);
    };
    fetchData();
  }, [type, page, subCategory, initialPage, initialResults]);

  const goToPage = (newPage) => {
    if (newPage < 1) return;
    router.push(`/channel/${encodeURIComponent(type)}?pg=${newPage}`);
  };

  const displayResults = isMobile ? results.slice(0, 15) : results;

  return (
    <div className="page-wrapper">
      <header className="site-header">
        <div className="container header-inner">
          <Link href="/" className="logo-area">
            <img src="/logo.png" alt="logo" className="logo-img" />
            <div className="logo-text">小黑<span>搜影</span></div>
          </Link>
          <nav className="nav-links">
            {['首页', '🔥 去看解说', '电影', '电视剧', '短剧', '动漫', '综艺', '纪录片'].map((name) => {
              const path = name === '首页' ? '/' : (name.includes('解说') ? '/reels' : `/channel/${name}`);
              return (
                <Link key={name} href={path} className={`nav-link ${type === name ? 'active' : ''} ${name.includes('解说') ? 'special-link' : ''}`}>
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
          <h1 className="section-title">
            最新{type}{subCategory !== '全部' && ` · ${subCategory}`}在线免费观看
          </h1>
          <div className="view-all" style={{ opacity: 0.5 }}>PAGE {page}</div>
        </div>

        {subCategories.length > 0 && (
          <div className="filter-bar-container" style={{ marginBottom: '2.5rem' }}>
            <div
              className="filter-bar-scroll-wrap"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.8rem',
                maxHeight: showAllTags ? 'none' : (isMobile ? '40px' : '48px'),
                overflow: 'hidden',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                paddingBottom: showAllTags ? '1rem' : '0',
              }}
            >
              {subCategories.map((cat) => {
                const isSensitive = cat.includes('伦理') || cat.includes('成人') || cat.includes('福利');
                if (!showAllTags && isSensitive) return null;

                return (
                  <div
                    key={cat}
                    className={`filter-item ${subCategory === cat ? 'active' : ''}`}
                    onClick={() => {
                      setSubCategory(cat);
                      router.push(`/channel/${encodeURIComponent(type)}?pg=1`);
                    }}
                  >
                    {cat}
                  </div>
                );
              })}
            </div>
            {(subCategories.length > 8 || subCategories.some((c) => c.includes('伦理'))) && (
              <div
                onClick={() => setShowAllTags(!showAllTags)}
                style={{
                  cursor: 'pointer',
                  color: '#38bdf8',
                  fontSize: '0.9rem',
                  marginTop: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: '500',
                  opacity: 0.8,
                }}
              >
                {showAllTags ? '收起分类 ↑' : '更多分类 (含隐藏) ↓'}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="loading-con">
            <div className="spinner"></div>
            <div className="loading-text">正在搬运精彩内容...</div>
          </div>
        ) : (
          <>
            <div className="movie-grid">
              {displayResults.map((item, idx) => {
                const itemId = item.vod_id || item.id;
                const isReel = item.category?.includes('解说') || item.title?.includes('解说');
                const targetHref = isReel
                  ? `/reels?id=${itemId}&src=${encodeURIComponent(item.source_name || item.source)}`
                  : buildMoviePath(item.title, itemId);

                return (
                  <Link key={`${itemId}-${idx}`} href={targetHref} className="movie-card">
                    <div className="movie-poster-wrap">
                      <img
                        className="movie-poster-img"
                        src={item.poster}
                        alt={item.title}
                        onError={(e) => { e.target.src = 'https://via.placeholder.com/400x600?text=No+Poster'; }}
                      />
                      <div className="movie-quality-tag">{item.source_tip || '高清'}</div>
                    </div>
                    <div className="movie-info-name">{item.title}</div>
                    <div className="movie-info-meta">{item.year || '2026'} · {item.category || type}</div>
                  </Link>
                );
              })}
            </div>

            <div className="pagination">
              <button type="button" className="page-btn" disabled={page <= 1} onClick={() => goToPage(page - 1)}>上一页</button>
              <div className="page-info">第 {page} 页</div>
              <button type="button" className="page-btn" disabled={results.length < (isMobile ? 15 : 30)} onClick={() => goToPage(page + 1)}>下一页</button>
            </div>
          </>
        )}
      </main>

      <footer className="site-footer">
        <div className="container">{config.footer || `© 2026 ${config.site_name}`}</div>
      </footer>
    </div>
  );
}
