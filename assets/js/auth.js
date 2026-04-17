const SUPABASE_URL = 'https://ihngrqlfrfyrbvygrbjp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlobmdycWxmcmZ5cmJ2eWdyYmpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNzg2OTEsImV4cCI6MjA5MTk1NDY5MX0.mKIYiQZ0qh_5yx-HACiF1wvZ6NOKdfsEF7Q-OPVtc30';

let _client = null;

function getClient() {
  if (!_client) {
    _client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _client;
}

// Each page sets window.APP_BASE_PATH before loading this script.
// Root pages (index.html, login.html) use '' — module pages use '../..'.
function _rootPath(filename) {
  const base = window.APP_BASE_PATH;
  if (!base) return filename;
  return base + '/' + filename;
}

async function signIn(email, password) {
  const result = await getClient().auth.signInWithPassword({ email, password });
  if (!result.error && result.data?.user) {
    await getClient()
      .from('profiles')
      .update({ last_login: new Date().toISOString() })
      .eq('id', result.data.user.id);
  }
  return result;
}

async function signUp(email, password) {
  return getClient().auth.signUp({ email, password });
}

async function signOut() {
  await getClient().auth.signOut();
  window.location.href = _rootPath('login.html');
}

async function getSession() {
  const { data } = await getClient().auth.getSession();
  return data.session;
}

// Call on every protected page. Redirects to login if no active session.
async function protectPage() {
  const session = await getSession();
  if (!session) {
    window.location.href = _rootPath('login.html');
    return null;
  }
  return session;
}

// Call on login page. Redirects to dashboard if already logged in.
async function redirectIfAuthenticated() {
  const session = await getSession();
  if (session) {
    window.location.href = _rootPath('index.html');
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
  protectPage,
  redirectIfAuthenticated,
};
