export const DEFAULT_SITE_THEME = 'green';

export const SITE_THEME_STORAGE_KEY = 'site_theme';

export function normalizeSiteTheme(theme) {
  const value = (theme || '').trim();
  return value || DEFAULT_SITE_THEME;
}

export function applySiteTheme(theme) {
  const normalized = normalizeSiteTheme(theme);
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', normalized);
    try {
      localStorage.setItem(SITE_THEME_STORAGE_KEY, normalized);
    } catch {
      // ignore storage failures
    }
  }
  return normalized;
}
