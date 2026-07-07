'use client';
import { useEffect } from 'react';

export default function ThemeInitializer() {
  useEffect(() => {
    // 每次进入页面，尝试从 API 加载最新的主题配置
    const loadTheme = async () => {
      try {
        const res = await fetch('/api/config');
        const config = await res.json();
        const theme = config.theme || 'winxp';
        document.documentElement.setAttribute('data-theme', theme);
      } catch (e) {
        console.error("Theme init failed", e);
      }
    };
    
    loadTheme();
    
    // 监听 storage 变化（针对后台修改后前台即时响应）
    const handleStorage = (e) => {
      if (e.key === 'site_theme') {
        document.documentElement.setAttribute('data-theme', e.newValue || 'winxp');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return null;
}
