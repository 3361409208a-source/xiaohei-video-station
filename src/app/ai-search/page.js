'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ChevronLeft, Send, Flame, Sparkles, Loader2, ArrowRight
} from 'lucide-react';
import styles from './ai-search.module.css';
import { buildMoviePath } from '@/utils/movieUrl';

const hotSearches = [
  "高分科幻电影", "烧脑悬疑剧", "周星驰电影",
  "漫威全系列", "宫崎骏动漫"
];

export default function AiSearchPage() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // History of chat. { type: 'user' | 'ai', content: string, results?: array }
  const [chatHistory, setChatHistory] = useState([]);

  const handleSearch = async (queryToSearch) => {
    const q = (queryToSearch || input).trim();
    if (!q) return;

    // Add user message
    setChatHistory(prev => [...prev, { type: 'user', content: q }]);
    setInput('');
    setIsSearching(true);

    try {
      const res = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q })
      });
      const data = await res.json();
      
      if (data.error) {
        setChatHistory(prev => [...prev, { 
          type: 'ai', 
          content: data.error
        }]);
      } else {
        setChatHistory(prev => [...prev, { 
          type: 'ai', 
          content: '为你找到以下影片：',
          results: data.data || []
        }]);
      }
    } catch (err) {
      setChatHistory(prev => [...prev, { 
        type: 'ai', 
        content: '抱歉，连接 AI 服务失败，请重试。'
      }]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* 顶部导航 */}
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>
          <ChevronLeft size={28} />
        </button>
        <div className={styles.title}>AI 搜片</div>
      </header>

      {/* 聊天内容区 */}
      <div className={styles.chatArea}>
        {chatHistory.length === 0 ? (
          <div className={styles.welcomeArea}>
            <div className={styles.aiSphere}>AI</div>
            <h1 className={styles.welcomeTitle}>AI智能搜片引擎</h1>
            <p className={styles.welcomeSub}>用自然语言找到你想看的任何影片</p>
            
            <div className={styles.hotSearches}>
              <div className={styles.hotSearchHeader}>
                <span>热门搜索</span>
                <span className={styles.refreshBtn}><Sparkles size={14} /> 换一批</span>
              </div>
              <div className={styles.tags}>
                {hotSearches.map(tag => (
                  <div 
                    key={tag} 
                    className={styles.tag}
                    onClick={() => handleSearch(tag)}
                  >
                    <Flame size={14} className={styles.tagIcon} />
                    {tag}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          chatHistory.map((msg, idx) => (
            msg.type === 'user' ? (
              <div key={idx} className={styles.userMessage}>
                {msg.content}
              </div>
            ) : (
              <div key={idx} className={styles.aiMessage}>
                <div className={styles.aiGreeting}>
                  <Sparkles size={14} style={{ display: 'inline', marginRight: 4, color: '#00f0ff' }}/>
                  {msg.content}
                </div>
                {msg.results && msg.results.length > 0 && (
                  <div className={styles.resultList}>
                    {msg.results.map((item, i) => (
                      <Link key={i} href={buildMoviePath(item.title, item.vod_id || item.id || 0)} className={styles.resultItem}>
                        <div className={styles.posterWrapper}>
                          <img src={item.poster || item.pic || '/logo.png'} alt={item.title} className={styles.poster} onError={(e) => { e.currentTarget.src = '/logo.png'; }} />
                          <span className={styles.scoreBadge}>{item.db_score || 'N/A'}</span>
                        </div>
                        <div className={styles.info}>
                          <h3 className={styles.movieTitle}>{item.title}</h3>
                          <div className={styles.movieMeta}>
                            {item.year || '2026'} / {item.category} / {item.remarks || item.hd_status}
                          </div>
                          <div className={styles.movieStats}>
                            <div className={styles.statItem}>
                              <Flame size={12} className={styles.statIcon} />
                              {(Math.random() * 50 + 50).toFixed(1)}W
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', color: '#666' }}>
                          <ArrowRight size={16} />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
                {msg.results && msg.results.length === 0 && (
                  <div style={{ color: '#888', fontSize: 13, marginTop: 10 }}>未能找到完全匹配的结果，请换个描述试试。</div>
                )}
              </div>
            )
          ))
        )}
        
        {isSearching && (
          <div className={styles.loadingIndicator}>
            <Loader2 size={18} className="animate-spin" /> AI正在深度检索中...
          </div>
        )}
      </div>

      {/* 底部输入框 */}
      <div className={styles.inputContainer}>
        <div className={styles.inputWrapper}>
          <input 
            type="text" 
            className={styles.input} 
            placeholder="描述你想看的影片..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <button 
          className={styles.sendBtn} 
          disabled={!input.trim() || isSearching}
          onClick={() => handleSearch()}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
