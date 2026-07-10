'use client';
import { useState, useEffect } from 'react';
import ThreeDashboard from '@/components/ThreeDashboard';
import { mapToMajorCategory } from '@/utils/categoryRules';
import styles from './admin.module.css';

export default function AdminClient({ initialStats }) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState('stats');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState('');

  const [collectorStatus, setCollectorStatus] = useState({ log: '', stats: { total: 0, size: '0 MB', last_modified: 'N/A' } });
  const [stats, setStats] = useState(initialStats || { total: 0, categories: { '电影': 0, '电视剧': 0, '动漫': 0, '综艺': 0 }, lastUpdate: 'N/A' });
  const [siteConfig, setSiteConfig] = useState({ site_name: '', notice: '', footer: '', theme: '' });
  const [sources, setSources] = useState([]);
  const [testResults, setTestResults] = useState({});
  const [trends, setTrends] = useState({});
  const [currentMovies, setCurrentMovies] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('电影');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const savedToken = sessionStorage.getItem('admin_token');
    if (!savedToken) return;

    fetch('/api/admin/stats', { headers: { 'x-admin-token': savedToken } })
      .then(res => {
        if (res.ok) {
          setToken(savedToken);
          setIsAuthorized(true);
        } else {
          sessionStorage.removeItem('admin_token');
        }
      })
      .catch(() => sessionStorage.removeItem('admin_token'));
  }, []);

  useEffect(() => {
    if (isAuthorized && token) {
      fetchConfig();
      fetchTrends();
      fetchStats();
    }
  }, [isAuthorized, token]);

  const handleLogin = async () => {
    const input = prompt("请输入管理密码：");
    if (!input) return;

    try {
      const res = await fetch('/api/admin/stats', {
        headers: { 'x-admin-token': input },
      });
      if (res.ok) {
        sessionStorage.setItem('admin_token', input);
        setToken(input);
        setIsAuthorized(true);
      } else {
        alert("密码错误！");
      }
    } catch {
      alert("登录失败，请稍后重试");
    }
  };

  const apiFetch = async (url, options = {}) => {
    const headers = {
      ...options.headers,
      'x-admin-token': token,
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      alert("登录失效，请重新登录");
      setIsAuthorized(false);
      return null;
    }
    return res;
  };

  const fetchStats = async () => {
    const res = await apiFetch('/api/admin/stats');
    if (res?.ok) setStats(await res.json());
  };

  const fetchCollectorStatus = async () => {
    setIsRefreshing(true);
    const res = await apiFetch('/api/admin/collector-status');
    if (res?.ok) setCollectorStatus(await res.json());
    setIsRefreshing(false);
  };

  const fetchConfig = async () => {
    const res = await apiFetch('/api/admin/config');
    if (res?.ok) setSiteConfig(await res.json());
  };

  const saveConfig = async () => {
    setLoading(true);
    const res = await apiFetch('/api/admin/config', {
      method: 'POST',
      body: JSON.stringify(siteConfig)
    });
    if (res?.ok) alert("配置保存成功！");
    setLoading(false);
  };

  const fetchSources = async () => {
    const res = await apiFetch('/api/admin/sources');
    if (res?.ok) setSources(await res.json());
  };

  const saveSources = async (newSources) => {
    const res = await apiFetch('/api/admin/sources', {
      method: 'POST',
      body: JSON.stringify(newSources)
    });
    if (res?.ok) {
      setSources(newSources);
      return true;
    }
    return false;
  };

  const fetchTrends = async () => {
    const res = await apiFetch('/api/admin/trends');
    if (res?.ok) setTrends(await res.json());
  };

  const testSource = async (idx, api) => {
    setTestResults(prev => ({ ...prev, [idx]: { loading: true } }));
    try {
      const res = await apiFetch('/api/admin/test-source', {
        method: 'POST',
        body: JSON.stringify({ api })
      });
      if (res?.ok) {
        const data = await res.json();
        setTestResults(prev => ({ ...prev, [idx]: { ...data, loading: false } }));
      } else {
        setTestResults(prev => ({ ...prev, [idx]: { status: 'error', message: '请求失败', loading: false } }));
      }
    } catch (e) {
      setTestResults(prev => ({ ...prev, [idx]: { status: 'error', message: e.message, loading: false } }));
    }
  };

  const loadMovieList = async (category) => {
    setLoading(true);
    // stats 里的 key 是 DB 子类（如「动作片」），需映射为大类 + class_tag
    const major = mapToMajorCategory(category);
    const qs = new URLSearchParams({ t: major });
    if (category && category !== major) qs.set('class_tag', category);
    const res = await apiFetch(`/api/search?${qs.toString()}`);
    if (res?.ok) setCurrentMovies(await res.json());
    setLoading(false);
  };

  if (!isAuthorized) {
    return (
      <div className={styles.loginPage}>
        <button onClick={handleLogin} className={styles.loginBtn}>
          🔒 进入黑金管理中枢
        </button>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>🌚 小黑搜影·管理中枢</div>
        <button onClick={() => { sessionStorage.clear(); location.reload(); }} className={styles.logoutBtn}>安全退出</button>
      </header>

      <main className={styles.main}>
        <div className={styles.tabs}>
          {['stats', 'config', 'sources', 'list', 'collector'].map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'config') fetchConfig();
                if (tab === 'sources') fetchSources();
                if (tab === 'collector') fetchCollectorStatus();
                if (tab === 'stats') { fetchTrends(); fetchStats(); }
              }}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            >
              {tab === 'stats' && '📊 统计/热词'}
              {tab === 'config' && '🔍 全局配置'}
              {tab === 'sources' && '📡 资源源站'}
              {tab === 'list' && '📝 影片库'}
              {tab === 'collector' && '⚙️ 采集动向'}
            </button>
          ))}
        </div>

        {activeTab === 'stats' && (
          <div className={styles.statsGrid}>
            <div className={styles.card}>
              <ThreeDashboard stats={stats} />
              <h3 className={styles.cardTitle}>收录统计</h3>
              <div className={styles.totalCount}>{stats?.total || 0} <span className={styles.totalUnit}>部影片</span></div>
              <div className={styles.catGrid}>
                {stats && Object.entries(stats.categories).map(([k, v]) => (
                  <div key={k} className={styles.catItem}>
                    <div className={styles.catLabel}>{k}</div>
                    <div className={styles.catValue}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.card}>
              <h3 className={styles.cardTitleWarn}>📈 搜索热词排行</h3>
              <div className={styles.trendList}>
                {Object.entries(trends).length > 0 ? Object.entries(trends).map(([word, count], i) => (
                  <div key={word} className={styles.trendRow}>
                    <span>{i + 1}. {word}</span>
                    <span className={styles.trendCount}>{count} 次</span>
                  </div>
                )) : <div className={styles.muted}>暂无搜索记录</div>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className={styles.formCard}>
            <h3 style={{ marginTop: 0 }}>全局配置</h3>
            <div className={styles.formStack}>
              <div>
                <label className={styles.label}>全站主题</label>
                <select
                  value={siteConfig.theme || ''}
                  onChange={e => {
                    setSiteConfig({ ...siteConfig, theme: e.target.value });
                    if (e.target.value) document.documentElement.setAttribute('data-theme', e.target.value);
                    else document.documentElement.removeAttribute('data-theme');
                  }}
                  className={styles.select}
                >
                  <option value="">经典黑粉 (Neon Pink)</option>
                  <option value="green">极客森林 (Emerald Tech)</option>
                  <option value="blue">深海之影 (Ocean Blue)</option>
                  <option value="gold">黑金尊享 (Midnight Gold)</option>
                  <option value="white">初雪之境 (Pure White)</option>
                </select>
              </div>
              <div>
                <label className={styles.label}>网站名称</label>
                <input value={siteConfig.site_name} onChange={e => setSiteConfig({ ...siteConfig, site_name: e.target.value })} className={styles.input} />
              </div>
              <div>
                <label className={styles.label}>全站公告</label>
                <textarea value={siteConfig.notice} onChange={e => setSiteConfig({ ...siteConfig, notice: e.target.value })} className={styles.textarea} />
              </div>
              <div>
                <label className={styles.label}>页脚文字</label>
                <input value={siteConfig.footer} onChange={e => setSiteConfig({ ...siteConfig, footer: e.target.value })} className={styles.input} />
              </div>
              <button onClick={saveConfig} disabled={loading} className={styles.primaryBtn}>{loading ? '保存中...' : '💾 保存配置'}</button>
            </div>
          </div>
        )}

        {activeTab === 'sources' && (
          <div className={styles.card}>
            <div className={styles.sectionHead}>
              <h3 style={{ margin: 0 }}>📡 资源源站管理</h3>
              <button onClick={() => {
                const name = prompt("源站名称:");
                const api = prompt("API 地址 (ac=detail):");
                if (name && api) saveSources([...sources, { name, api, tip: '新源', active: true }]);
              }} className={styles.successBtn}>➕ 新增源站</button>
            </div>
            <div className={styles.sourceList}>
              {sources.map((src, idx) => (
                <div key={idx} className={styles.sourceItem}>
                  <div className={styles.sourceMeta}>
                    <div className={styles.sourceName}>
                      {src.name}
                      <span className={src.active ? styles.badgeOn : styles.badgeOff}>{src.active ? '启用中' : '已停用'}</span>
                    </div>
                    <div className={styles.sourceApi}>{src.api}</div>
                    {testResults[idx] && (
                      <div className={`${styles.testResult} ${testResults[idx].status === 'success' ? styles.testOk : styles.testFail}`}>
                        {testResults[idx].loading ? '⚡ 正在探测连通性...' : (
                          <>
                            {testResults[idx].status === 'success' ? '✅ ' : '❌ '}
                            {testResults[idx].message} {testResults[idx].latency && `(${testResults[idx].latency})`}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className={styles.btnRow}>
                    <button onClick={() => testSource(idx, src.api)} className={`${styles.btnSm} ${styles.btnTest}`}>测试</button>
                    <button onClick={() => {
                      const newSources = [...sources];
                      newSources[idx].active = !newSources[idx].active;
                      saveSources(newSources);
                    }} className={`${styles.btnSm} ${src.active ? styles.btnDanger : styles.btnOk}`}>{src.active ? '停用' : '启用'}</button>
                    <button onClick={() => {
                      if (confirm("确定删除吗？")) {
                        const newSources = sources.filter((_, i) => i !== idx);
                        saveSources(newSources);
                      }
                    }} className={`${styles.btnSm} ${styles.btnGhost}`}>删除</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'list' && (
          <div className={styles.card}>
            <div className={styles.chipRow}>
              {Object.keys(stats?.categories || {}).map(cat => (
                <button
                  key={cat}
                  onClick={() => { setSelectedCategory(cat); loadMovieList(cat); }}
                  className={selectedCategory === cat ? styles.chipActive : styles.chip}
                >
                  {cat} ({stats.categories[cat]})
                </button>
              ))}
            </div>
            {loading ? <div className={styles.centerPad}>加载中...</div> : (
              <div className={styles.movieGrid}>
                {currentMovies.map(m => (
                  <div key={m.id} className={styles.movieCard}>
                    <div className={styles.movieTitle}>{m.title}</div>
                    <div className={styles.movieSource}>{m.source_name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'collector' && (
          <div className={styles.collectorGrid}>
            <div className={styles.collectorCard}>
              <h3>数据状态</h3>
              <div className={styles.statBox}>
                <div className={styles.statBoxLabel}>全量索引条数</div>
                <div className={styles.statBoxValue}>{collectorStatus.stats.total}</div>
              </div>
              <div className={styles.muted} style={{ fontSize: '0.9rem' }}>
                <div>📁 大小: {collectorStatus.stats.size}</div>
                <div style={{ marginTop: '0.4rem' }}>📅 同步: {collectorStatus.stats.last_modified}</div>
              </div>
              <button onClick={async () => {
                if (confirm("确定启动？")) {
                  const res = await apiFetch('/api/admin/trigger-collector', { method: 'POST' });
                  if (res?.ok) alert("已启动");
                }
              }} className={styles.dangerBtn}>🚀 启动全量采集</button>
              <button onClick={async () => {
                if (!confirm("将截断搜索热词至 Top 50 并对数据库执行 VACUUM，继续？")) return;
                const res = await apiFetch('/api/admin/cleanup', { method: 'POST' });
                if (res?.ok) {
                  const data = await res.json();
                  alert(`清理完成：保留热词 ${data.trends_kept} 条，VACUUM=${data.vacuumed}`);
                  fetchTrends();
                  fetchCollectorStatus();
                } else {
                  alert("清理失败");
                }
              }} className={styles.cleanupBtn}>🧹 数据清理</button>
            </div>
            <div className={styles.collectorCard}>
              <div className={styles.logHead}>
                <h3 style={{ margin: 0 }}>实时日志</h3>
                <button onClick={fetchCollectorStatus} className={styles.refreshBtn}>{isRefreshing ? '更新中...' : '🔄 刷新'}</button>
              </div>
              <pre className={styles.logPre}>{collectorStatus.log}</pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
