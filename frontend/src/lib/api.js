const ENV_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function apiUrl(pathname) {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const base =
    ENV_BASE ||
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '');
  if (!base) {
    return normalizedPath;
  }
  return `${base}${normalizedPath}`;
}
