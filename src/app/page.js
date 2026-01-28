'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('全部');

  const categories = [
    { name: '🎬 电影', key: '电影' },
    { name: '📺 电视剧', key: '电视剧' },
    { name: '🎋 动漫', key: '动漫' },
    { name: '🎡 综艺', key: '综艺' }
  ];

  const handleSearch = async (q = '', type = null) => {
    const targetQ = q || query;
    if (!targetQ.trim() && !type) return;
    
    setLoading(true);
    setResults([]);
    try {
      let url = `http://127.0.0.1:8000/api/search?`;
      if (type) {
          url += `t=${encodeURIComponent(type)}`;
          setQuery(''); // 切换频道时清空搜索框
      } else {
          url += `q=${encodeURIComponent(targetQ)}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Search failed:', error);
    }
    setLoading(false);
  };

  // 默认加载一些内容
  useEffect(() => {
      const loadInit = async () => {
          setLoading(true);
          try {
            const res = await fetch('http://127.0.0.1:8000/api/recommend');
            const data = await res.json();
            setResults(data);
          } catch(e) {}
          setLoading(false);
      };
      loadInit();
  }, []);

  return (
    <div>
      <header className="site-header">
        <div className="container" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <Link href="/" className="logo" onClick={() => window.location.reload()}>🐾 小黑搜影</Link>
          <div className="nav-tabs">
              {categories.map(cat => (
                  <span 
                    key={cat.key} 
                    className={`nav-tab-item ${activeTab === cat.key ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab(cat.key);
                        handleSearch('', cat.key);
                    }}
                  >
                      {cat.name}
                  </span>
              ))}
          </div>
        </div>
      </header>

      <section className="search-box-area" style={{padding: '2rem 0 1rem'}}>
        <div className="container">
          <div className="search-input-wrapper">
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="搜索电影、电视剧、动漫、演员..." 
            />
            <button onClick={() => {setActiveTab('搜索'); handleSearch();}}>搜 索</button>
          </div>
        </div>
      </section>

      <main className="container">
        <div style={{margin: '1rem 0 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem'}}>
            <h2 style={{fontSize:'1.2rem', margin:0, color:'var(--text-dim)'}}>
                {activeTab === '全部' ? '✨ 今日精选' : `🍿 当前频道: ${activeTab}`}
            </h2>
        </div>

        {loading && (
          <div id="loading">
            <div className="spinner"></div>
          </div>
        )}

        <div className="results-grid">
          {results.map((item) => (
            <Link 
              key={`${item.id}-${item.source_name}`}
              href={`/play?id=${item.id}&src=${encodeURIComponent(item.source_name)}&url=${encodeURIComponent(item.episodes[0]?.url || '')}`}
              className="movie-item"
            >
              <div className="poster-con">
                <img 
                  className="movie-poster" 
                  src={item.poster} 
                  alt={item.title}
                  onError={(e) => e.target.src = 'https://via.placeholder.com/200x300?text=No+Poster'}
                />
                <div className="movie-badge">{item.source_tip}</div>
              </div>
              <div className="movie-name">{item.title}</div>
            </Link>
          ))}
        </div>
        
        {!loading && results.length === 0 && (
          <div style={{textAlign:'center', opacity:0.5, padding:'5rem'}}>暂无内容，请尝试其他关键词</div>
        )}
      </main>

      <style jsx>{`
        .nav-tabs { display: flex; gap: 25px; }
        .nav-tab-item { 
            font-size: 0.95rem; 
            color: var(--text-dim); 
            cursor: pointer; 
            transition: all 0.3s;
            position: relative;
            padding: 5px 0;
        }
        .nav-tab-item:hover { color: var(--primary); }
        .nav-tab-item.active { color: var(--primary); font-weight: 700; }
        .nav-tab-item.active::after {
            content: '';
            position: absolute;
            bottom: -2px; left: 0; right: 0;
            height: 2px; background: var(--primary);
            border-radius: 2px;
        }
        @media (max-width: 768px) {
            .nav-tabs { display: none; }
        }
      `}</style>
    </div>
  );
}
