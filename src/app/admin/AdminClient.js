'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminClient({ initialStats }) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState('stats');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState('');

  // 数据状态
  // 数据状态
  const [collectorStatus, setCollectorStatus] = useState({ log: '', stats: { total: 0, size: '0 MB', last_modified: 'N/A' } });
  const [stats, setStats] = useState(initialStats || { total: 0, categories: { '电影': 0, '电视剧': 0, '动漫': 0, '综艺': 0 }, lastUpdate: 'N/A' });
  const [siteConfig, setSiteConfig] = useState({ site_name: '', notice: '', footer: '', theme: '' });
  const [sources, setSources] = useState([]);
  const [testResults, setTestResults] = useState({}); // 存储各源站测试结果
  const [trends, setTrends] = useState({});
  const [currentMovies, setCurrentMovies] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('电影');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const savedToken = sessionStorage.getItem('admin_token');
    if (savedToken === '7897') {
      setIsAuthorized(true);
      setToken(savedToken);
    }
  }, []);

  useEffect(() => {
    if (isAuthorized && token) {
      fetchConfig();
      fetchTrends();
      fetchStats();
    }
  }, [isAuthorized, token]);

  const handleLogin = () => {
    const input = prompt("请输入管理密码：");
    if (input === '7897') {
      sessionStorage.setItem('admin_token', input);
      setToken(input);
      setIsAuthorized(true);
    } else {
      alert("密码错误！");
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

  // 1. 获取采集状态
  const fetchCollectorStatus = async () => {
    setIsRefreshing(true);
    const res = await apiFetch('/api/admin/collector-status');
    if (res?.ok) setCollectorStatus(await res.json());
    setIsRefreshing(false);
  };

  // 2. 获取全局配置
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

  // 3. 获取资源源
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

  // 4. 获取搜索热词
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

  // 5. 获取影片列表
  const loadMovieList = async (category) => {
    setLoading(true);
    const res = await apiFetch(`/api/search?t=${encodeURIComponent(category)}`);
    if (res?.ok) setCurrentMovies(await res.json());
    setLoading(false);
  };

  if (!isAuthorized) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
        <button onClick={handleLogin} style={{ padding: '1rem 2rem', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1.2rem' }}>
          🔒 进入黑金管理中枢
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui' }}>
      <header style={{ background: '#1e293b', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#38bdf8' }}>🌚 小黑搜影·管理中枢</div>
        <button onClick={() => { sessionStorage.clear(); location.reload(); }} style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #334155', padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>安全退出</button>
      </header>

      <main style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>
        {/* 导航栏 */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #334155' }}>
          {['stats', 'config', 'sources', 'list', 'collector'].map(tab => (
            <button key={tab} onClick={() => {
              setActiveTab(tab);
              if (tab === 'config') fetchConfig();
              if (tab === 'sources') fetchSources();
              if (tab === 'collector') fetchCollectorStatus();
              if (tab === 'stats') { fetchTrends(); fetchStats(); }
            }} style={{
              background: 'none', border: 'none', padding: '1rem', cursor: 'pointer', fontSize: '1rem',
              color: activeTab === tab ? '#38bdf8' : '#94a3b8',
              borderBottom: activeTab === tab ? '2px solid #38bdf8' : 'none',
              marginBottom: '-1px'
            }}>
              {tab === 'stats' && '📊 统计/热词'}
              {tab === 'config' && '🔍 全局配置'}
              {tab === 'sources' && '📡 资源源站'}
              {tab === 'list' && '📝 影片库'}
              {tab === 'collector' && '⚙️ 采集动向'}
            </button>
          ))}
        </div>

        {/* 统计与热词 */}
        {activeTab === 'stats' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div style={{ background: '#1e293b', padding: '2rem', borderRadius: '12px' }}>
              <h3 style={{ marginTop: 0, color: '#38bdf8' }}>收录统计</h3>
              <div style={{ fontSize: '3rem', fontWeight: 'bold' }}>{stats?.total || 0} <span style={{ fontSize: '1rem', color: '#94a3b8' }}>部影片</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem' }}>
                {stats && Object.entries(stats.categories).map(([k, v]) => (
                  <div key={k} style={{ background: '#334155', padding: '1rem', borderRadius: '8px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{k}</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: '#1e293b', padding: '2rem', borderRadius: '12px' }}>
              <h3 style={{ marginTop: 0, color: '#f59e0b' }}>📈 搜索热词排行</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {Object.entries(trends).length > 0 ? Object.entries(trends).map(([word, count], i) => (
                  <div key={word} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: '#334155', borderRadius: '4px' }}>
                    <span>{i + 1}. {word}</span>
                    <span style={{ color: '#f59e0b' }}>{count} 次</span>
                  </div>
                )) : <div style={{ color: '#94a3b8' }}>暂无搜索记录</div>}
              </div>
            </div>
          </div>
        )}

        {/* 全局配置 */}
        {activeTab === 'config' && (
          <div style={{ background: '#1e293b', padding: '2rem', borderRadius: '12px', maxWidth: '600px' }}>
            <h3 style={{ marginTop: 0 }}>全局配置</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>全站主题</label>
                <select
                  value={siteConfig.theme || ''}
                  onChange={e => {
                    setSiteConfig({ ...siteConfig, theme: e.target.value });
                    // 即时在本地预览效果
                    if (e.target.value) document.documentElement.setAttribute('data-theme', e.target.value);
                    else document.documentElement.removeAttribute('data-theme');
                  }}
                  style={{ width: '100%', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                >
                  <option value="">经典黑粉 (Neon Pink)</option>
                  <option value="green">极客森林 (Emerald Tech)</option>
                  <option value="blue">深海之影 (Ocean Blue)</option>
                  <option value="gold">黑金尊享 (Midnight Gold)</option>
                  <option value="white">初雪之境 (Pure White)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>网站名称</label>
                <input value={siteConfig.site_name} onChange={e => setSiteConfig({ ...siteConfig, site_name: e.target.value })} style={{ width: '100%', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>全站公告</label>
                <textarea value={siteConfig.notice} onChange={e => setSiteConfig({ ...siteConfig, notice: e.target.value })} style={{ width: '100%', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px', height: '100px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>页脚文字</label>
                <input value={siteConfig.footer} onChange={e => setSiteConfig({ ...siteConfig, footer: e.target.value })} style={{ width: '100%', padding: '0.8rem', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} />
              </div>
              <button onClick={saveConfig} disabled={loading} style={{ background: '#38bdf8', color: '#fff', padding: '1rem', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>{loading ? '保存中...' : '💾 保存配置'}</button>
            </div>
          </div>
        )}

        {/* 资源源站管理 */}
        {activeTab === 'sources' && (
          <div style={{ background: '#1e293b', padding: '2rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>📡 资源源站管理</h3>
              <button onClick={() => {
                const name = prompt("源站名称:");
                const api = prompt("API 地址 (ac=detail):");
                if (name && api) saveSources([...sources, { name, api, tip: '新源', active: true }]);
              }} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>➕ 新增源站</button>
            </div>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {sources.map((src, idx) => (
                <div key={idx} style={{ background: '#334155', padding: '1.5rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {src.name}
                      <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: src.active ? '#10b981' : '#ef4444', borderRadius: '4px' }}>{src.active ? '启用中' : '已停用'}</span>
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.4rem' }}>{src.api}</div>
                    {testResults[idx] && (
                      <div style={{ marginTop: '0.8rem', fontSize: '0.8rem', color: testResults[idx].status === 'success' ? '#10b981' : '#ef4444', background: 'rgba(0,0,0,0.2)', padding: '5px 10px', borderRadius: '4px', display: 'inline-block' }}>
                        {testResults[idx].loading ? '⚡ 正在探测连通性...' : (
                          <>
                            {testResults[idx].status === 'success' ? '✅ ' : '❌ '}
                            {testResults[idx].message} {testResults[idx].latency && `(${testResults[idx].latency})`}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => testSource(idx, src.api)} style={{ padding: '0.4rem 0.8rem', borderRadius: '4px', border: 'none', cursor: 'pointer', background: '#38bdf8', color: '#fff' }}>测试</button>
                    <button onClick={() => {
                      const newSources = [...sources];
                      newSources[idx].active = !newSources[idx].active;
                      saveSources(newSources);
                    }} style={{ padding: '0.4rem 0.8rem', borderRadius: '4px', border: 'none', cursor: 'pointer', background: src.active ? '#ef4444' : '#10b981', color: '#fff' }}>{src.active ? '停用' : '启用'}</button>
                    <button onClick={() => {
                      if (confirm("确定删除吗？")) {
                        const newSources = sources.filter((_, i) => i !== idx);
                        saveSources(newSources);
                      }
                    }} style={{ padding: '0.4rem 0.8rem', borderRadius: '4px', border: 'none', cursor: 'pointer', background: '#334155', color: '#f8fafc', border: '1px solid #475569' }}>删除</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 影片库列表 */}
        {activeTab === 'list' && (
          <div style={{ background: '#1e293b', padding: '2rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              {Object.keys(stats?.categories || {}).map(cat => (
                <button
                  key={cat}
                  onClick={() => { setSelectedCategory(cat); loadMovieList(cat); }}
                  style={{
                    background: selectedCategory === cat ? '#38bdf8' : '#334155',
                    border: 'none',
                    color: '#fff',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  {cat} ({stats.categories[cat]})
                </button>
              ))}
            </div>
            {loading ? <div style={{ textAlign: 'center', padding: '2rem' }}>加载中...</div> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
                {currentMovies.map(m => (
                  <div key={m.id} style={{ background: '#0f172a', padding: '0.8rem', borderRadius: '6px', fontSize: '0.8rem', overflow: 'hidden' }}>
                    <div style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{m.title}</div>
                    <div style={{ color: '#64748b', fontSize: '0.7rem' }}>{m.source_name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 采集动向 */}
        {activeTab === 'collector' && (
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem' }}>
            <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '12px' }}>
              <h3>数据状态</h3>
              <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>全量索引条数</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#38bdf8' }}>{collectorStatus.stats.total}</div>
              </div>
              <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
                <div>📁 大小: {collectorStatus.stats.size}</div>
                <div style={{ marginTop: '0.4rem' }}>📅 同步: {collectorStatus.stats.last_modified}</div>
              </div>
              <button onClick={async () => {
                if (confirm("确定启动？")) {
                  const res = await apiFetch('/api/admin/trigger-collector', { method: 'POST' });
                  if (res?.ok) alert("已启动");
                }
              }} style={{ width: '100%', marginTop: '1.5rem', padding: '1rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>🚀 启动全量采集</button>
            </div>
            <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>实时日志</h3>
                <button onClick={fetchCollectorStatus} style={{ background: '#334155', color: '#fff', border: 'none', padding: '0.4rem 1rem', borderRadius: '4px' }}>{isRefreshing ? '更新中...' : '🔄 刷新'}</button>
              </div>
              <pre style={{ height: '400px', overflowY: 'auto', background: '#000', color: '#4ade80', padding: '1rem', borderRadius: '8px', fontSize: '0.8rem' }}>{collectorStatus.log}</pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
