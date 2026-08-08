document.addEventListener('DOMContentLoaded', async () => {
  try {
    const session = await auth.protectPage();
    if (session) {
      document.dispatchEvent(new CustomEvent('app:authenticated', { detail: { session } }));
    }
  } catch (error) {
    console.error('Seitenprotektion fehlgeschlagen:', error);
    if (!document.querySelector('.auth-error-screen')) {
      const panel = document.createElement('section');
      panel.className = 'auth-error-screen';
      panel.setAttribute('role', 'alert');

      const title = document.createElement('h1');
      title.textContent = 'Anmeldung nicht erreichbar';
      const message = document.createElement('p');
      message.textContent = 'Die Sitzung konnte nicht geprüft werden. Prüfe die Verbindung und versuche es erneut.';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'btn btn-primary';
      retry.textContent = 'Erneut versuchen';
      retry.addEventListener('click', () => window.location.reload());

      panel.append(title, message, retry);
      document.body.appendChild(panel);
    }
    document.dispatchEvent(new CustomEvent('app:auth-error', { detail: { error } }));
  }
});
