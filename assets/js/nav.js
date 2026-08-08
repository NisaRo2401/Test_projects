// Injects a "← Dashboard" chip into every sub-app page.
document.addEventListener('DOMContentLoaded', () => {
  if (!document.body) return;

  const base = String(window.APP_BASE_PATH || '').replace(/\/$/, '');
  const href = base ? base + '/index.html' : 'index.html';

  const nav = document.createElement('nav');
  nav.className = 'app-nav';
  nav.setAttribute('aria-label', 'Hauptnavigation');

  const link = document.createElement('a');
  link.href = href;
  link.textContent = '← Dashboard';
  nav.appendChild(link);

  if (!document.querySelector('link[href*="components.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = (base ? base + '/' : '') + 'assets/css/components.css';
    document.head.appendChild(link);
  }

  if (!document.querySelector('.app-nav')) {
    document.body.prepend(nav);
  }
});
