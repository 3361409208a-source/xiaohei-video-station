'use client';
import { useEffect } from 'react';

export default function ThemeInitializer() {
  useEffect(() => {
    // 每次进入页面，尝试从 API 加载最新的主题配置
    const loadTheme = async () => {
      try {
        const res = await fetch('/api/config');
        const config = await res.json();
        if (config.theme) {
          document.documentElement.setAttribute('data-theme', config.theme);
        } else {
          document.documentElement.removeAttribute('data-theme');
        }
      } catch (e) {
        console.error("Theme init failed", e);
      }
    };
    
    loadTheme();
    
    // 监听 storage 变化（针对后台修改后前台即时响应）
    const handleStorage = (e) => {
      if (e.key === 'site_theme') {
        if (e.newValue) document.documentElement.setAttribute('data-theme', e.newValue);
        else document.documentElement.removeAttribute('data-theme');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return null;
}
