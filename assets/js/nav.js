// Injects a "← Dashboard" chip into every sub-app page.
document.addEventListener('DOMContentLoaded', () => {
  const base = window.APP_BASE_PATH || '';
  const href = base ? base + '/index.html' : 'index.html';

  const nav = document.createElement('nav');
  nav.className = 'app-nav';
  nav.innerHTML = `<a href="${href}">&#8592; Dashboard</a>`;

  // Inject CSS variables if the page doesn't already include them
  if (!document.querySelector('link[href*="variables.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = (base ? base + '/' : '') + 'assets/css/components.css';
    document.head.appendChild(link);
  }

  document.body.prepend(nav);
});
