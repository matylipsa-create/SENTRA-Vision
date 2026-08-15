export function registerServiceWorker() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        console.log('[SW] Registered', reg);
      }).catch((err) => {
        console.warn('[SW] Registration failed:', err);
      });
    });
  }
}
