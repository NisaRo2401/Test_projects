document.addEventListener('DOMContentLoaded', async () => {
  try {
    await auth.protectPage();
  } catch (error) {
    console.error('Seitenprotektion fehlgeschlagen:', error);
  }
});
