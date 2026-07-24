'use client';
import { useEffect } from 'react';
import { applySiteTheme, SITE_THEME_STORAGE_KEY } from '@/utils/siteTheme';

export default function ThemeInitializer() {
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const res = await fetch('/api/config', { cache: 'no-store' });
        const config = await res.json();
        applySiteTheme(config.theme);
      } catch (e) {
        console.error('Theme init failed', e);
      }
    };

    loadTheme();

    const handleStorage = (e) => {
      if (e.key === SITE_THEME_STORAGE_KEY) {
        applySiteTheme(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return null;
}
