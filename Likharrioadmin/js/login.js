// ═══════════════════════════════════════════════════════════
// LIKHARRIO ADMIN — LOGIN
// ═══════════════════════════════════════════════════════════

const loginForm    = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');
const loading      = document.getElementById('loading');

const LOCK_KEY = 'likharrio-admin-login-lock';
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

function readLock() {
  try {
    const raw = sessionStorage.getItem(LOCK_KEY);
    return raw ? JSON.parse(raw) : { attempts: 0, lockedUntil: 0 };
  } catch {
    return { attempts: 0, lockedUntil: 0 };
  }
}

function lockMessage() {
  const state = readLock();
  if (state.lockedUntil > Date.now()) {
    const minutes = Math.max(1, Math.ceil((state.lockedUntil - Date.now()) / 60000));
    return `Too many sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
  }
  return '';
}

function recordFailure() {
  const state = readLock();
  const attempts = (state.lockedUntil > Date.now() ? state.attempts : state.attempts + 1);
  sessionStorage.setItem(LOCK_KEY, JSON.stringify({
    attempts,
    lockedUntil: attempts >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0,
  }));
}

auth.onAuthStateChanged(async (user) => {
  if (!user) return;
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    const data = userDoc.exists ? userDoc.data() : null;
    const blocked = !data || data.role !== 'admin' || data.suspended === true || data.disabled === true;
    if (!blocked) {
      window.location.href = 'index.html';
    } else {
      showError('You do not have admin privileges. Please contact support.');
      auth.signOut();
    }
  } catch (error) {
    console.error('Error checking admin status:', error);
  }
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email    = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const locked = lockMessage();
  if (locked) {
    showError(locked);
    return;
  }

  hideError();
  showLoading();

  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const user = userCredential.user;

    const userDoc  = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists) throw new Error('User profile not found');

    const userData = userDoc.data();
    if (userData.role !== 'admin' || userData.suspended === true || userData.disabled === true) {
      await auth.signOut();
      throw new Error('Access denied. Admin privileges required.');
    }
    sessionStorage.removeItem(LOCK_KEY);

    window.location.href = 'index.html';

  } catch (error) {
    hideLoading();

    if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
      recordFailure();
    }
    const messages = {
      'auth/user-not-found': 'Incorrect email or password.',
      'auth/wrong-password': 'Incorrect email or password.',
      'auth/invalid-credential': 'Incorrect email or password.',
      'auth/invalid-email': 'Incorrect email or password.',
      'auth/too-many-requests': 'Too many failed attempts. Try again later.',
    };
    showError(lockMessage() || messages[error.code] || error.message || 'Failed to sign in. Please check your credentials.');
  }
});

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add('show');
}

function hideError() {
  errorMessage.classList.remove('show');
}

function showLoading() {
  loading.style.display = 'block';
  loginForm.querySelector('button').disabled = true;
}

function hideLoading() {
  loading.style.display = 'none';
  loginForm.querySelector('button').disabled = false;
}
