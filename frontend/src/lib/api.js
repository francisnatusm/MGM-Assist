const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // If no backend URL is configured, show helpful error
  if (!API_BASE_URL) {
    console.error('❌ VITE_API_BASE_URL is not set! Add it in Vercel environment variables.');
    // Return empty URL to trigger fetch error with clear message
    return normalizedPath;
  }
  
  return `${API_BASE_URL}${normalizedPath}`;
}
