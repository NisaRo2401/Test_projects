import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

async function source(path) {
  return readFile(resolve(path), 'utf8');
}

test('Produktionscontainer ist versioniert und besitzt einen Healthcheck', async () => {
  const dockerfile = await source('Dockerfile');
  assert.match(dockerfile, /^FROM nginx:\d+\.\d+\.\d+-alpine$/m);
  assert.match(dockerfile, /EXPOSE 8080/);
  assert.match(dockerfile, /HEALTHCHECK[\s\S]+\/healthz/);
  assert.doesNotMatch(dockerfile, /COPY\s+\.\s+/);
});

test('Compose veröffentlicht den Webserver nur am lokalen Reverse-Proxy-Interface', async () => {
  const compose = await source('compose.yaml');
  assert.match(compose, /127\.0\.0\.1:\$\{APP_PORT:-8080\}:8080/);
  assert.match(compose, /restart:\s+unless-stopped/);
  assert.match(compose, /SUPABASE_PUBLISHABLE_KEY/);
});

test('Nginx setzt die erwarteten Schutzheader und CDN-Freigaben', async () => {
  const nginx = await source('deploy/nginx.conf');
  for (const expected of [
    'Content-Security-Policy',
    'Permissions-Policy',
    'Referrer-Policy',
    'X-Content-Type-Options',
    'X-Frame-Options',
    'https://cdn.jsdelivr.net',
    'https://cdnjs.cloudflare.com',
    'https://*.supabase.co',
  ]) {
    assert.match(nginx, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(nginx, /location = \/healthz/);
  assert.match(nginx, /location = \/assets\/js\/config\.js[\s\S]+expires -1/);
});

test('Docker-Kontext schließt Geheimnisse und Entwicklungsdaten aus', async () => {
  const dockerignore = await source('.dockerignore');
  for (const entry of ['.env', '.git', 'node_modules', 'tools', 'docs', 'tests']) {
    const escapedEntry = entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(dockerignore, new RegExp(`^${escapedEntry}\\s*$`, 'm'));
  }
});

test('Apache trennt die Projekt-Subdomain vom bestehenden Portfolio', async () => {
  const apache = await source('deploy/apache-projects.noxsolutions.de.conf');
  assert.match(apache, /ServerName projects\.noxsolutions\.de/);
  assert.match(apache, /ProxyPass \/ http:\/\/127\.0\.0\.1:8080\//);
  assert.match(apache, /ProxyPassReverse \/ http:\/\/127\.0\.0\.1:8080\//);
  assert.doesNotMatch(apache, /ServerName\s+noxsolutions\.de\s*$/m);
});
