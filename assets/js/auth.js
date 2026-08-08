let _client = null;

function getClient() {
  if (!_client) {
    if (typeof window === 'undefined' || typeof window.supabase?.createClient !== 'function') {
      throw new TypeError('Supabase-Client konnte nicht geladen werden.');
    }

    const url = window.APP_CONFIG?.supabase?.url || window.SUPABASE_URL;
    const publicKey = window.APP_CONFIG?.supabase?.publicKey
      || window.APP_CONFIG?.supabase?.publishableKey
      || window.APP_CONFIG?.supabase?.anonKey
      || window.SUPABASE_ANON_KEY;

    if (!url || !publicKey) {
      throw new Error('Supabase-Konfiguration fehlt.');
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new TypeError('Die konfigurierte Supabase-URL ist ungültig.');
    }
    if (parsedUrl.protocol !== 'https:' && parsedUrl.hostname !== 'localhost') {
      throw new TypeError('Die Supabase-URL muss HTTPS verwenden.');
    }

    _client = window.supabase.createClient(parsedUrl.href.replace(/\/$/, ''), publicKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    });
  }
  return _client;
}

// Each page sets window.APP_BASE_PATH before loading this script.
// Root pages (index.html, login.html) use '' — module pages use '../..'.
function _rootPath(filename) {
  const base = String(window.APP_BASE_PATH || '').replace(/\/$/, '');
  if (!base) return filename;
  return base + '/' + filename;
}

function _fallbackUrl() {
  return new URL(_rootPath('index.html'), window.location.href);
}

function getPostLoginUrl() {
  const fallback = _fallbackUrl();
  const requestedPath = new URLSearchParams(window.location.search).get('next');
  if (!requestedPath) return fallback.href;

  try {
    const requestedUrl = new URL(requestedPath, window.location.origin);
    const appRoot = new URL('.', fallback);
    const loginUrl = new URL(_rootPath('login.html'), window.location.href);
    const isInsideApp = requestedUrl.pathname.startsWith(appRoot.pathname);
    const isLoginPage = requestedUrl.pathname === loginUrl.pathname;
    if (requestedUrl.origin === window.location.origin && isInsideApp && !isLoginPage) {
      return requestedUrl.href;
    }
  } catch {
    // Invalid targets intentionally fall back to the dashboard.
  }
  return fallback.href;
}

function isEmailConfirmationCallback() {
  const url = new URL(window.location.href);
  const type = url.searchParams.get('type');
  if (type === 'signup' || type === 'email') return true;

  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  const hashType = hashParams.get('type');
  return hashType === 'signup' || hashType === 'email';
}

async function signIn(email, password) {
  const result = await getClient().auth.signInWithPassword({ email, password });
  if (!result.error && result.data?.user) {
    const { error: profileError } = await getClient()
      .from('profiles')
      .update({ last_login: new Date().toISOString() })
      .eq('id', result.data.user.id);
    if (profileError) {
      console.warn('Der Anmeldezeitpunkt konnte nicht gespeichert werden.', profileError.message);
    }
  }
  return result;
}

async function signUp(email, password) {
  const emailRedirectUrl = new URL(_rootPath('login.html'), window.location.href);
  return getClient().auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: emailRedirectUrl.href,
    },
  });
}

async function signOut() {
  const { error } = await getClient().auth.signOut();
  if (error) throw error;
  window.location.assign(_rootPath('login.html'));
}

async function getSession() {
  const { data, error } = await getClient().auth.getSession();
  if (error) throw error;
  return data.session;
}

// Call on every protected page. Redirects to login if no active session.
async function protectPage() {
  const session = await getSession();
  if (!session) {
    const loginUrl = new URL(_rootPath('login.html'), window.location.href);
    const currentPath = window.location.pathname + window.location.search + window.location.hash;
    loginUrl.searchParams.set('next', currentPath);
    window.location.replace(loginUrl.href);
    return null;
  }
  return session;
}

// Call on login page. Redirects to dashboard if already logged in.
async function redirectIfAuthenticated() {
  const session = await getSession();
  if (session) {
    if (isEmailConfirmationCallback()) {
      await getClient().auth.signOut();
      if (window.history?.replaceState) {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.hash = '';
        cleanUrl.searchParams.delete('code');
        cleanUrl.searchParams.delete('type');
        cleanUrl.searchParams.delete('token_hash');
        window.history.replaceState({}, '', cleanUrl.href);
      }
      return null;
    }
    window.location.replace(getPostLoginUrl());
    return session;
  }
  return null;
}

window.auth = {
  getClient,
  signIn,
  signUp,
  signOut,
  getSession,
  getPostLoginUrl,
  isEmailConfirmationCallback,
  protectPage,
  redirectIfAuthenticated,
};
