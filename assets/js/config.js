(function configureApp() {
  'use strict';

  const defaults = {
    supabase: {
      url: 'https://ihngrqlfrfyrbvygrbjp.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlobmdycWxmcmZ5cmJ2eWdyYmpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNzg2OTEsImV4cCI6MjA5MTk1NDY5MX0.mKIYiQZ0qh_5yx-HACiF1wvZ6NOKdfsEF7Q-OPVtc30',
    },
  };

  const existingConfig = window.APP_CONFIG || {};
  const existingSupabase = existingConfig.supabase || {};
  const publicKey = String(
    existingSupabase.publicKey
    || existingSupabase.publishableKey
    || existingSupabase.anonKey
    || defaults.supabase.anonKey,
  ).trim();
  const supabaseConfig = Object.freeze({
    url: String(existingSupabase.url || defaults.supabase.url).trim().replace(/\/+$/, ''),
    publicKey,
    // Alias für bestehende Integrationen; beide Werte sind öffentliche Browser-Keys.
    anonKey: publicKey,
  });

  window.APP_CONFIG = Object.freeze({
    ...existingConfig,
    supabase: supabaseConfig,
  });

  // Legacy globals remain available for older module integrations.
  window.SUPABASE_URL = supabaseConfig.url;
  window.SUPABASE_ANON_KEY = supabaseConfig.publicKey;
})();
