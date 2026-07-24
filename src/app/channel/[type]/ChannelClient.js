'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Film, Play } from 'lucide-react';
import LoadingGrid from '@/components/LoadingGrid';
import { buildMoviePath } from '@/utils/movieUrl';
import { buildPageItems, PAGE_SIZE } from '@/utils/pagination';

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
  const [pageMeta, setPageMeta] = useState({ total: 0, total_pages: 1 });
  const usedInitialRef = useRef(false);

  useEffect(() => {
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
    fetch('/api/config').then((res) => res.json()).then((data) => setConfig(data)).catch(() => {});
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
      return;
    }

    const fetchData = async () => {
      setLoading(true);
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

  useEffect(() => {
    const classTag = subCategory === '全部' ? '' : subCategory;
    const params = new URLSearchParams({ t: type });
    if (classTag) params.set('class_tag', classTag);

    fetch(`/api/search/count?${params.toString()}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        const totalPages = Math.max(1, Number(data.total_pages) || 1);
        setPageMeta({
          total: Number(data.total) || 0,
          total_pages: totalPages,
        });
      })
      .catch(() => {
        setPageMeta({ total: 0, total_pages: Math.max(page, 1) });
      });
  }, [type, subCategory, page]);

  const goToPage = (newPage) => {
    if (newPage < 1 || newPage > pageMeta.total_pages) return;
    router.push(`/channel/${encodeURIComponent(type)}?pg=${newPage}`, { scroll: false });
  };

  const displayResults = isMobile ? results.slice(0, 15) : results;
  const pageItems = buildPageItems(page, pageMeta.total_pages);
  const hasNextPage = page < pageMeta.total_pages && results.length >= PAGE_SIZE;

  return (
    <div className="page-wrapper">
      <header className="site-header">
        <div className="container header-inner">
          <Link href="/" className="logo-area" aria-label="小黑搜影首页">
            <img src="/logo.png" alt="" className="logo-img" />
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
          <div className="header-right"><span className="live-dot" />资源实时更新</div>
        </div>
      </header>

      <main className="container channel-main">
        <div className="section-header channel-heading">
          <div>
            <span className="section-kicker">EXPLORE CHANNEL</span>
            <h1 className="section-title">
              最新{type}{subCategory !== '全部' && ` · ${subCategory}`}
            </h1>
            <p className="section-description">聚合全网优质{type}内容，持续为你更新。</p>
          </div>
          <div className="page-indicator">第 <strong>{page}</strong> / {pageMeta.total_pages} 页</div>
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
                  <button
                    type="button"
                    key={cat}
                    className={`filter-item ${subCategory === cat ? 'active' : ''}`}
                    onClick={() => {
                      setSubCategory(cat);
                      router.push(`/channel/${encodeURIComponent(type)}?pg=1`, { scroll: false });
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
            {(subCategories.length > 8 || subCategories.some((c) => c.includes('伦理'))) && (
              <button
                type="button"
                onClick={() => setShowAllTags(!showAllTags)}
                className="filter-toggle"
              >
                {showAllTags ? <><ChevronUp size={16} /> 收起分类</> : <><ChevronDown size={16} /> 更多分类</>}
              </button>
            )}
          </div>
        )}

        {loading ? (
          <LoadingGrid label={`正在加载${type}频道`} />
        ) : (
          results.length > 0 ? <>
            <div className="movie-grid">
              {displayResults.map((item, idx) => {
                const itemId = item.vod_id || item.id;
                const isReel = item.category?.includes('解说') || item.title?.includes('解说');
                const targetHref = isReel
                  ? `/reels?id=${itemId}&src=${encodeURIComponent(item.source_name || item.source)}`
                  : buildMoviePath(item.title, itemId);

                return (
                  <Link key={`${itemId}-${idx}`} href={targetHref} className="movie-card" style={{ '--card-index': idx }}>
                    <div className="movie-poster-wrap">
                      <img
                        className="movie-poster-img"
                        src={item.poster || '/logo.png'}
                        alt={item.title}
                        loading={idx > 5 ? 'lazy' : 'eager'}
                        decoding="async"
                        onError={(e) => { e.currentTarget.src = '/logo.png'; }}
                      />
                      <div className="movie-poster-shade" />
                      <span className="movie-play"><Play size={18} fill="currentColor" /></span>
                      <div className="movie-quality-tag">{item.source_tip || '高清'}</div>
                    </div>
                    <div className="movie-info-name">{item.title}</div>
                    <div className="movie-info-meta">{item.year || '2026'} · {item.category || type}</div>
                  </Link>
                );
              })}
            </div>

            <div className="pagination">
              <button type="button" className="page-btn" disabled={page <= 1} onClick={() => goToPage(page - 1)}><ChevronLeft size={17} />上一页</button>
              <div className="page-numbers" role="navigation" aria-label="分页">
                {pageItems.map((item) => (
                  item.type === 'ellipsis' ? (
                    <span key={item.key} className="page-ellipsis">…</span>
                  ) : (
                    <button
                      key={item.value}
                      type="button"
                      className={`page-num ${page === item.value ? 'active' : ''}`}
                      onClick={() => goToPage(item.value)}
                      aria-current={page === item.value ? 'page' : undefined}
                    >
                      {item.value}
                    </button>
                  )
                ))}
              </div>
              <div className="page-info">共 {pageMeta.total > 0 ? pageMeta.total : '—'} 条</div>
              <button type="button" className="page-btn" disabled={!hasNextPage} onClick={() => goToPage(page + 1)}>下一页<ChevronRight size={17} /></button>
            </div>
          </> : (
            <div className="empty-state">
              <div className="empty-icon"><Film size={26} /></div>
              <h2>这个频道暂时没有内容</h2>
              <p>稍后再来看看，或者切换其他分类继续探索。</p>
              <Link href="/">返回首页</Link>
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
