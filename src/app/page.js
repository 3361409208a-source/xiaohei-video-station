'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResults([]);
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Search failed:', error);
    }
    setLoading(false);
  };

  return (
    <div>
      <header className="site-header">
        <div className="container">
          <Link href="/" className="logo">🐾 小黑搜影 Next</Link>
        </div>
      </header>

      <section className="search-box-area">
        <div className="container">
          <div className="search-input-wrapper">
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="搜索全网高清资源..." 
            />
            <button onClick={handleSearch} disabled={loading}>
                {loading ? '搜索中...' : '搜 索'}
            </button>
          </div>
        </div>
      </section>

      <main className="container">
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
        
        {!loading && results.length === 0 && query && (
          <div style={{textAlign:'center', opacity:0.5, padding:'5rem'}}>未找到相关资源</div>
        )}
      </main>
    </div>
  );
}
