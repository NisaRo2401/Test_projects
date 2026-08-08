import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const authSource = await readFile(resolve('assets/js/auth.js'), 'utf8');

function loadAuth({
  href = 'https://example.test/app/login.html',
  basePath = '',
  session = null,
} = {}) {
  const url = new URL(href);
  const redirects = [];
  const signUpCalls = [];
  const authClient = {
    auth: {
      async getSession() { return { data: { session }, error: null }; },
      async signOut() { return { error: null }; },
      async signUp(values) { signUpCalls.push(values); return { data: {}, error: null }; },
    },
  };
  const window = {
    APP_BASE_PATH: basePath,
    APP_CONFIG: {
      supabase: {
        url: 'https://project.supabase.co',
        anonKey: 'public-anon-key',
      },
    },
    location: {
      href: url.href,
      origin: url.origin,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      assign(value) { redirects.push({ method: 'assign', value }); },
      replace(value) { redirects.push({ method: 'replace', value }); },
    },
    supabase: {
      createClient() { return authClient; },
    },
  };
  const context = vm.createContext({ console, URL, URLSearchParams, window });
  new vm.Script(authSource, { filename: 'assets/js/auth.js' }).runInContext(context);
  return { auth: window.auth, redirects, signUpCalls };
}

test('Registrierungsbestätigung verwendet die aktuelle Anwendungs-URL', async () => {
  const { auth, signUpCalls } = loadAuth({
    href: 'https://projects.noxsolutions.de/login.html',
  });

  await auth.signUp('user@example.com', 'password123');

  assert.equal(signUpCalls[0].options.emailRedirectTo, 'https://projects.noxsolutions.de/login.html');
});

test('akzeptiert nur interne Rücksprungziele nach dem Login', () => {
  const safe = loadAuth({
    href: 'https://example.test/app/login.html?next=%2Fapp%2Fmodules%2Fsql-learner%2F',
  });
  assert.equal(safe.auth.getPostLoginUrl(), 'https://example.test/app/modules/sql-learner/');

  const external = loadAuth({
    href: 'https://example.test/app/login.html?next=https%3A%2F%2Fevil.test%2F',
  });
  assert.equal(external.auth.getPostLoginUrl(), 'https://example.test/app/index.html');
});

test('Seitenschutz bewahrt bei der Login-Weiterleitung den Modulpfad', async () => {
  const { auth, redirects } = loadAuth({
    href: 'https://example.test/app/modules/sql-learner/?level=2#editor',
    basePath: '../..',
  });

  const result = await auth.protectPage();
  assert.equal(result, null);
  assert.equal(redirects.length, 1);
  assert.equal(redirects[0].method, 'replace');

  const target = new URL(redirects[0].value);
  assert.equal(target.pathname, '/app/login.html');
  assert.equal(target.searchParams.get('next'), '/app/modules/sql-learner/?level=2#editor');
});

test('eine aktive Sitzung löst keine Login-Weiterleitung aus', async () => {
  const session = { user: { id: '123' } };
  const { auth, redirects } = loadAuth({ session });
  assert.deepEqual(await auth.protectPage(), session);
  assert.deepEqual(redirects, []);
});
