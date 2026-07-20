'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Search, Play, Film, Tv2, MonitorPlay, Ghost, Zap, 
  Home as HomeIcon, Trophy, Sparkles, Compass, User
} from 'lucide-react';
import styles from './mobile-home.module.css';
import { buildMoviePath } from '@/utils/movieUrl';
import LoadingGrid from '@/components/LoadingGrid';

export default function MobileHomeContent() {
  const router = useRouter();
  
  const [latestList, setLatestList] = useState([]);
  const [reelsList, setReelsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');

  useEffect(() => {
    // 获取最新资源 (用于 Hero Banner 和 正在热播)
    fetch('/api/latest')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setLatestList(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // 获取 AI 解说
    fetch('/api/reels')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setReelsList(data);
      })
      .catch(() => {});
  }, []);

  const heroMovie = latestList[0] || {
    title: '流浪地球 3',
    year: '2025',
    category: '科幻 / 冒险',
    poster: 'https://image.tmdb.org/t/p/original/tD0h7wzW3Zc1yG1Xq608yIibC9K.jpg',
    id: 'mock-1'
  };

  const navIcons = [
    { name: '电影', icon: <Film size={22} />, path: '/channel/电影', color: '#00f0ff' },
    { name: '电视剧', icon: <Tv2 size={22} />, path: '/channel/电视剧', color: '#b53cff' },
    { name: '短剧', icon: <MonitorPlay size={22} />, path: '/channel/短剧', color: '#ff00ff' },
    { name: '动漫', icon: <Ghost size={22} />, path: '/channel/动漫', color: '#00ffaa' },
    { name: '解说', icon: <Zap size={22} />, path: '/reels', color: '#ffaa00' },
    { name: '更多', icon: <Compass size={22} />, path: '/channel/全部', color: '#888' },
  ];

  return (
    <div className={styles.mobileLayout}>
      {/* 顶部固定导航 */}
      <header className={styles.header}>
        <div className={styles.logoArea}>
          <img src="/logo.png" alt="logo" className={styles.logoImg} onError={(e) => { e.currentTarget.src = '/logo.png'; }} />
          <span className={styles.logoText}>小黑搜影</span>
          <span className={styles.aiBadge}>AI</span>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.iconBtn}><Search size={20} color="#fff" /></button>
          <img src="/logo.png" alt="avatar" className={styles.avatar} style={{ filter: 'hue-rotate(180deg)' }} />
        </div>
      </header>

      <main className={styles.mainContent}>
        {/* 英雄横幅 Hero Banner */}
        <div className={styles.heroBanner}>
          <img src={heroMovie.poster || heroMovie.pic || '/logo.png'} alt={heroMovie.title} className={styles.heroImg} onError={(e) => { e.currentTarget.src = '/logo.png'; }} />
          <div className={styles.heroOverlay}>
            <h1 className={styles.heroTitle}>{heroMovie.title}</h1>
            <div className={styles.heroTags}>
              <span>{heroMovie.year || '2026'}</span>
              <span>{heroMovie.category}</span>
              <span className={styles.heroAiTag}><Sparkles size={12} /> AI 深度解构</span>
            </div>
            <Link href={buildMoviePath(heroMovie.title, heroMovie.vod_id || heroMovie.id)} className={styles.heroPlayBtn}>
              <Play size={16} fill="currentColor" /> 立即播放
            </Link>
          </div>
        </div>

        {/* 快捷导航金刚区 */}
        <div className={styles.quickNav}>
          {navIcons.map(nav => (
            <Link key={nav.name} href={nav.path} className={styles.navItem}>
              <div className={styles.navIconBox} style={{ boxShadow: `0 0 15px ${nav.color}40`, borderColor: `${nav.color}80` }}>
                <div style={{ color: nav.color }}>{nav.icon}</div>
              </div>
              <span className={styles.navName}>{nav.name}</span>
            </Link>
          ))}
        </div>

        {/* AI 智能推荐 Banner */}
        <div className={styles.aiRecommendBanner}>
          <div className={styles.aiContent}>
            <div className={styles.aiTitle}>AI 智能推荐</div>
            <div className={styles.aiDesc}>基于你的观影习惯生成</div>
            <button className={styles.aiActionBtn}>去看看</button>
          </div>
          <img src="/logo.png" alt="AI Robot" className={styles.aiRobotImg} style={{ filter: 'hue-rotate(240deg) brightness(1.5)' }} />
        </div>

        {/* 正在热播 (横向滑动) */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>正在热播</h2>
            <Link href="/channel/全部" className={styles.moreLink}>全部 &gt;</Link>
          </div>
          <div className={styles.scrollRow}>
            {loading ? <div style={{ color: '#888', padding: '20px' }}>加载中...</div> : latestList.slice(0, 8).map((item, idx) => (
              <Link key={idx} href={buildMoviePath(item.title, item.vod_id || item.id)} className={styles.movieCard}>
                <div className={styles.posterWrapper}>
                  <img src={item.poster || item.pic || '/logo.png'} alt={item.title} className={styles.poster} onError={(e) => { e.currentTarget.src = '/logo.png'; }} />
                  <span className={styles.badge} style={{ background: idx < 3 ? 'linear-gradient(90deg, #ff00ff, #b53cff)' : 'rgba(0,0,0,0.6)' }}>
                    {idx < 3 ? '热播' : '精选'}
                  </span>
                  <span className={styles.score}>{(9.6 - idx * 0.1).toFixed(1)}</span>
                </div>
                <div className={styles.movieTitle}>{item.title}</div>
                <div className={styles.movieSub}>{item.year || '2026'}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* AI 生成解说 (横向滑动) */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>AI 生成解说</h2>
            <span className={styles.sectionDesc}>AI自动生成精彩解说视频</span>
          </div>
          <div className={styles.scrollRow}>
            {(reelsList.length > 0 ? reelsList : latestList.slice(0, 4)).map((item, idx) => (
              <Link key={idx} href={`/reels?id=${item.vod_id || item.id}&src=${encodeURIComponent(item.source_name || '')}`} className={styles.reelCard}>
                <div className={styles.reelPosterWrapper}>
                  <img src={item.poster || item.pic || '/logo.png'} alt={item.title} className={styles.reelPoster} onError={(e) => { e.currentTarget.src = '/logo.png'; }} />
                  <div className={styles.playIconOverlay}><Play fill="rgba(255,255,255,0.9)" size={24} /></div>
                  <span className={styles.durationBadge}>12:45</span>
                  {idx === 0 && <span className={styles.badge} style={{ background: '#b53cff', left: '6px', right: 'auto' }}>NEW</span>}
                </div>
                <div className={styles.movieTitle}>{item.title} 深度解析</div>
              </Link>
            ))}
          </div>
        </section>
        
        {/* 底边距留白给 Bottom Bar */}
        <div style={{ height: '100px' }}></div>
      </main>

      {/* 底部导航栏 Bottom Tab Bar */}
      <nav className={styles.bottomTabBar}>
        <div className={`${styles.tabItem} ${activeTab === 'home' ? styles.activeTab : ''}`} onClick={() => setActiveTab('home')}>
          <HomeIcon size={24} />
          <span>首页</span>
        </div>
        <div className={`${styles.tabItem} ${activeTab === 'rank' ? styles.activeTab : ''}`} onClick={() => setActiveTab('rank')}>
          <Trophy size={24} />
          <span>排行</span>
        </div>
        
        {/* 中心突出的 AI 异形按钮 */}
        <div className={styles.centerAiTab}>
          <div className={styles.aiButtonOuter}>
            <div className={styles.aiButtonInner}>
              <Sparkles size={28} color="#fff" />
            </div>
          </div>
        </div>

        <div className={`${styles.tabItem} ${activeTab === 'discover' ? styles.activeTab : ''}`} onClick={() => setActiveTab('discover')}>
          <Compass size={24} />
          <span>发现</span>
        </div>
        <div className={`${styles.tabItem} ${activeTab === 'profile' ? styles.activeTab : ''}`} onClick={() => setActiveTab('profile')}>
          <User size={24} />
          <span>我的</span>
        </div>
      </nav>
    </div>
  );
}
