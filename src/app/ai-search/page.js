'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ChevronLeft, Send, Flame, Sparkles, ArrowRight
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
  // History of chat. { type: 'user' | 'ai', content: string, results?: array }
  const [chatHistory, setChatHistory] = useState([]);

  const handleSearch = (queryToSearch) => {
    const q = (queryToSearch || input).trim();
    if (!q) return;

    setChatHistory(prev => [...prev, { type: 'user', content: q }]);
    setInput('');
    setChatHistory(prev => [...prev, {
      type: 'ai',
      content: '当前为 AI 搜片展示模式，暂未接入 AI 检索。请返回首页使用普通搜索查找影片。',
    }]);
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
            <p className={styles.welcomeSub}>展示版界面 · 暂不调用 AI 服务，请使用首页搜索</p>
            
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
          disabled={!input.trim()}
          onClick={() => handleSearch()}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
