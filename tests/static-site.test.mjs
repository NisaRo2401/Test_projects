import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function walk(directory, extension) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute, extension));
    if (entry.isFile() && extname(entry.name) === extension) files.push(absolute);
  }
  return files;
}

function stripQueryAndHash(value) {
  return value.split('#', 1)[0].split('?', 1)[0];
}

function localReferences(html) {
  const refs = [];
  const pattern = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(pattern)) {
    const value = match[1].trim();
    if (!value || value.startsWith('#') || /^(?:[a-z]+:)?\/\//i.test(value) || /^(?:data|mailto|tel):/i.test(value)) continue;
    refs.push(stripQueryAndHash(value));
  }
  return refs;
}

test('alle lokalen HTML-Ressourcen und Links existieren', async () => {
  const htmlFiles = await walk(root, '.html');
  assert.ok(htmlFiles.length >= 7, 'Es fehlen erwartete HTML-Einstiegspunkte.');

  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    for (const ref of localReferences(html)) {
      const target = resolve(dirname(file), ref);
      const relativeTarget = relative(root, target);
      assert.ok(relativeTarget !== '..' && !relativeTarget.startsWith(`..${sep}`), `${relative(root, file)} verweist außerhalb des Projekts: ${ref}`);
      await assert.doesNotReject(
        access(target, fsConstants.F_OK),
        `${relative(root, file)} enthält eine tote Referenz: ${ref}`,
      );
    }
  }
});

test('statische IDs sind innerhalb jeder Seite eindeutig', async () => {
  for (const file of await walk(root, '.html')) {
    const html = await readFile(file, 'utf8');
    const markup = html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
    const ids = [...markup.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(match => match[1]);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    assert.deepEqual([...new Set(duplicates)], [], `${relative(root, file)} enthält doppelte IDs.`);
  }
});

test('alle geschützten Module laden die Auth-Abhängigkeiten in sicherer Reihenfolge', async () => {
  const moduleRoot = join(root, 'modules');
  for (const file of await walk(moduleRoot, '.html')) {
    const html = await readFile(file, 'utf8');
    const configIndex = html.indexOf('assets/js/config.js');
    const clientIndex = html.indexOf('@supabase/supabase-js@');
    const authIndex = html.indexOf('assets/js/auth.js');
    const protectIndex = html.indexOf('assets/js/protect.js');
    assert.ok(configIndex >= 0, `${relative(root, file)} lädt config.js nicht.`);
    assert.ok(clientIndex > configIndex, `${relative(root, file)} lädt den Supabase-Client in falscher Reihenfolge.`);
    assert.ok(authIndex > clientIndex, `${relative(root, file)} lädt auth.js in falscher Reihenfolge.`);
    assert.ok(protectIndex > authIndex, `${relative(root, file)} lädt protect.js in falscher Reihenfolge.`);
  }
});

test('externe Laufzeitbibliotheken sind fest versioniert', async () => {
  for (const file of await walk(root, '.html')) {
    const html = await readFile(file, 'utf8');
    assert.doesNotMatch(html, /@supabase\/supabase-js@2\//, `${relative(root, file)} nutzt eine bewegliche Supabase-Version.`);
    assert.doesNotMatch(html, /sql\.js\/1\.10\.2\//, `${relative(root, file)} nutzt die alte SQL.js-Version.`);

    for (const match of html.matchAll(/<script\b([^>]*\bsrc=["']https:\/\/[^"']+["'][^>]*)><\/script>/gi)) {
      assert.match(match[1], /\bintegrity=["']sha384-[^"']+["']/i, `${relative(root, file)} lädt ein CDN-Skript ohne SRI.`);
      assert.match(match[1], /\bcrossorigin=["']anonymous["']/i, `${relative(root, file)} lädt ein CDN-Skript ohne CORS-Absicherung.`);
    }
  }
});

test('Frontend-Artefakte enthalten keine administrativen Supabase-Schlüssel', async () => {
  const frontendFiles = [
    ...await walk(join(root, 'assets'), '.js'),
    ...await walk(join(root, 'modules'), '.html'),
    join(root, 'index.html'),
    join(root, 'login.html'),
  ];
  for (const file of frontendFiles) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|sb_secret_)/, `${relative(root, file)} enthält einen administrativen Schlüssel.`);
  }
});

test('JavaScript-Dateien und Inline-Skripte sind syntaktisch gültig', async () => {
  for (const file of await walk(root, '.js')) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${relative(root, file)}: ${result.stderr}`);
  }

  for (const file of await walk(root, '.html')) {
    const html = await readFile(file, 'utf8');
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    for (const [, attributes, source] of scripts) {
      if (/\bsrc\s*=/i.test(attributes) || /\btype\s*=\s*["'](?:application\/json|module)["']/i.test(attributes)) continue;
      assert.doesNotThrow(
        () => new vm.Script(source, { filename: relative(root, file) }),
        `${relative(root, file)} enthält ungültiges Inline-JavaScript.`,
      );
    }
  }
});
