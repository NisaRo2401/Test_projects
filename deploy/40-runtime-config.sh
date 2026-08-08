#!/bin/sh
set -eu

config_file='/usr/share/nginx/html/assets/js/config.js'
supabase_url="${SUPABASE_URL:-}"
supabase_public_key="${SUPABASE_PUBLISHABLE_KEY:-${SUPABASE_ANON_KEY:-}}"

if [ -z "$supabase_url" ] && [ -z "$supabase_public_key" ]; then
  exit 0
fi

if [ -z "$supabase_url" ] || [ -z "$supabase_public_key" ]; then
  echo >&2 'SUPABASE_URL und SUPABASE_PUBLISHABLE_KEY (oder SUPABASE_ANON_KEY) müssen gemeinsam gesetzt werden.'
  exit 1
fi

case "$supabase_url" in
  *[!A-Za-z0-9.:/_-]* | '')
    echo >&2 'SUPABASE_URL enthält ungültige Zeichen.'
    exit 1
    ;;
esac

case "$supabase_url" in
  https://*.supabase.co | http://localhost:* | http://127.0.0.1:*) ;;
  *)
    echo >&2 'SUPABASE_URL muss eine HTTPS-Supabase-URL oder eine lokale Entwicklungs-URL sein.'
    exit 1
    ;;
esac

case "$supabase_public_key" in
  *[!A-Za-z0-9._-]* | '')
    echo >&2 'Der öffentliche Supabase-Key enthält ungültige Zeichen.'
    exit 1
    ;;
esac

umask 027
cat > "$config_file" <<EOF
(function configureRuntime() {
  'use strict';
  const supabaseConfig = Object.freeze({
    url: '$supabase_url',
    publicKey: '$supabase_public_key',
    anonKey: '$supabase_public_key',
  });
  window.APP_CONFIG = Object.freeze({ supabase: supabaseConfig });
  window.SUPABASE_URL = supabaseConfig.url;
  window.SUPABASE_ANON_KEY = supabaseConfig.publicKey;
})();
EOF
