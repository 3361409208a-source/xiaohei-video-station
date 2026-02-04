'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function AdminClient({ initialStats }) {
  const [activeTab, setActiveTab] = useState('stats');
  const [movieCache, setMovieCache] = useState({}); // 缓存每个分类的数据
  const [currentMovies, setCurrentMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('电影');

  const categories = ['电影', '电视剧', '动漫', '综艺'];

  // 加载影片列表（带缓存）
  const loadMovieList = async (category) => {
    // 如果已有缓存，直接使用
    if (movieCache[category]) {
      setCurrentMovies(movieCache[category]);
      setSelectedCategory(category);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/search?t=${encodeURIComponent(category)}`);
      if (response.ok) {
        const movies = await response.json();
        // 按ID去重
        const uniqueMovies = new Map();
        movies.forEach(movie => {
          if (!uniqueMovies.has(movie.id)) {
            uniqueMovies.set(movie.id, movie);
          }
        });
        const movieList = Array.from(uniqueMovies.values());

        // 更新缓存
        setMovieCache(prev => ({...prev, [category]: movieList}));
        setCurrentMovies(movieList);
        setSelectedCategory(category);
      }
    } catch (error) {
      console.error('Failed to load movies:', error);
    }
    setLoading(false);
  };

  // 搜索影片
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const movies = await response.json();
        setSearchResults(movies);
      }
    } catch (error) {
      console.error('Search failed:', error);
    }
    setLoading(false);
  };

  return (
    <div style={{minHeight: '100vh', background: 'var(--bg-dark)', color: 'var(--text-main)'}}>
      <header className="site-header">
        <div className="container" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <Link href="/" className="logo">🐾 小黑搜影</Link>
          <h1 style={{fontSize: '1.2rem', margin: 0}}>管理后台</h1>
          <Link href="/" style={{color: '#ccc', textDecoration: 'none', fontSize: '0.9rem'}}>返回首页</Link>
        </div>
      </header>

      <main className="container" style={{paddingTop: '2rem'}}>
        {/* 标签页导航 */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '2rem',
          borderBottom: '2px solid rgba(255,255,255,0.1)'
        }}>
          <button
            onClick={() => setActiveTab('stats')}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'stats' ? 'var(--primary)' : 'var(--text-dim)',
              fontSize: '1rem',
              padding: '0.75rem 1.5rem',
              cursor: 'pointer',
              borderBottom: activeTab === 'stats' ? '2px solid var(--primary)' : 'none',
              marginBottom: '-2px'
            }}
          >
            📊 统计概览
          </button>
          <button
            onClick={() => {
              setActiveTab('list');
              if (currentMovies.length === 0) {
                loadMovieList(selectedCategory);
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'list' ? 'var(--primary)' : 'var(--text-dim)',
              fontSize: '1rem',
              padding: '0.75rem 1.5rem',
              cursor: 'pointer',
              borderBottom: activeTab === 'list' ? '2px solid var(--primary)' : 'none',
              marginBottom: '-2px'
            }}
          >
            📝 影片列表
          </button>
          <button
            onClick={() => setActiveTab('add')}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'add' ? 'var(--primary)' : 'var(--text-dim)',
              fontSize: '1rem',
              padding: '0.75rem 1.5rem',
              cursor: 'pointer',
              borderBottom: activeTab === 'add' ? '2px solid var(--primary)' : 'none',
              marginBottom: '-2px'
            }}
          >
            ➕ 搜索添加
          </button>
        </div>

        {/* 统计概览标签页 */}
        {activeTab === 'stats' && (
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            <h2 style={{marginTop: 0, color: 'var(--primary)'}}>影片收录统计</h2>

            {initialStats ? (
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                padding: '1.5rem',
                borderRadius: '8px',
                marginBottom: '2rem'
              }}>
                <div style={{fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '1rem'}}>
                  总计: {initialStats.total} 部影片
                </div>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem'}}>
                  {Object.entries(initialStats.categories).map(([category, count]) => (
                    <div key={category} style={{
                      background: 'rgba(255,255,255,0.05)',
                      padding: '1rem',
                      borderRadius: '6px'
                    }}>
                      <div style={{fontSize: '0.9rem', color: 'var(--text-dim)'}}>{category}</div>
                      <div style={{fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.5rem'}}>{count} 部</div>
                    </div>
                  ))}
                </div>
                <div style={{marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-dim)'}}>
                  最后更新: {initialStats.lastUpdate}
                </div>
                <div style={{marginTop: '0.5rem', fontSize: '0.85rem', color: '#4ade80'}}>
                  ✓ 页面打开时自动统计，数据缓存1小时
                </div>
              </div>
            ) : (
              <div style={{padding: '2rem', textAlign: 'center', color: 'var(--text-dim)'}}>
                无法获取统计数据，请检查后端API是否正常运行
              </div>
            )}
          </div>
        )}

        {/* 影片列表标签页 */}
        {activeTab === 'list' && (
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            padding: '2rem'
          }}>
            <h2 style={{marginTop: 0, color: 'var(--primary)'}}>影片列表</h2>

            {/* 分类选择 */}
            <div style={{display: 'flex', gap: '1rem', marginBottom: '1.5rem'}}>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    loadMovieList(cat);
                  }}
                  style={{
                    background: selectedCategory === cat ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{textAlign: 'center', padding: '3rem', color: 'var(--text-dim)'}}>
                加载中...
              </div>
            ) : (
              <div>
                <div style={{marginBottom: '1rem', color: 'var(--text-dim)'}}>
                  共 {currentMovies.length} 部影片
                  {movieCache[selectedCategory] && (
                    <span style={{marginLeft: '1rem', color: '#4ade80', fontSize: '0.85rem'}}>
                      ✓ 已缓存
                    </span>
                  )}
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: '1rem',
                  maxHeight: '600px',
                  overflowY: 'auto'
                }}>
                  {currentMovies.map(movie => (
                    <Link
                      key={`${movie.id}-${movie.source_name}`}
                      href={`/movie/${encodeURIComponent(`${movie.title}-${movie.id}`)}?src=${encodeURIComponent(movie.source_name)}`}
                      target="_blank"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        padding: '1rem',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        color: 'var(--text-main)',
                        transition: 'all 0.2s',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    >
                      <div style={{
                        fontSize: '0.9rem',
                        marginBottom: '0.5rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {movie.title}
                      </div>
                      <div style={{fontSize: '0.75rem', color: 'var(--text-dim)'}}>
                        {movie.source_tip} · {movie.episodes?.length || 0}集
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 搜索添加标签页 */}
        {activeTab === 'add' && (
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            <h2 style={{marginTop: 0, color: 'var(--primary)'}}>搜索影片</h2>

            <div style={{marginBottom: '2rem'}}>
              <div style={{display: 'flex', gap: '1rem'}}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="输入影片名称搜索..."
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '1rem'
                  }}
                />
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  style={{
                    background: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    padding: '0.75rem 2rem',
                    borderRadius: '8px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  {loading ? '搜索中...' : '搜索'}
                </button>
              </div>
            </div>

            {searchResults.length > 0 && (
              <div>
                <div style={{marginBottom: '1rem', color: 'var(--text-dim)'}}>
                  找到 {searchResults.length} 个结果
                </div>
                <div style={{display: 'grid', gap: '1rem'}}>
                  {searchResults.map(movie => (
                    <div
                      key={`${movie.id}-${movie.source_name}`}
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        padding: '1.5rem',
                        borderRadius: '8px',
                        display: 'flex',
                        gap: '1rem'
                      }}
                    >
                      <img
                        src={movie.poster}
                        alt={movie.title}
                        style={{
                          width: '80px',
                          height: '120px',
                          objectFit: 'cover',
                          borderRadius: '6px'
                        }}
                        onError={(e) => e.target.src = 'https://via.placeholder.com/80x120?text=No+Poster'}
                      />
                      <div style={{flex: 1}}>
                        <h3 style={{margin: '0 0 0.5rem 0', fontSize: '1.1rem'}}>{movie.title}</h3>
                        <div style={{fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '0.5rem'}}>
                          {movie.category} · {movie.source_tip} · {movie.episodes?.length || 0}集
                        </div>
                        <Link
                          href={`/movie/${encodeURIComponent(`${movie.title}-${movie.id}`)}?src=${encodeURIComponent(movie.source_name)}`}
                          target="_blank"
                          style={{
                            display: 'inline-block',
                            background: 'var(--primary)',
                            color: 'white',
                            padding: '0.5rem 1rem',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            fontSize: '0.9rem'
                          }}
                        >
                          查看详情
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
