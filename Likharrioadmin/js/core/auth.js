// ═══════════════════════════════════════════════════════════
// LIKHARRIO ADMIN — AUTH GUARD
// Runs after firebase-config.js is loaded.
// ═══════════════════════════════════════════════════════════

window.currentAdminIsSuperAdmin = false;

let _verifiedRole = null;

window.verifySuperAdmin = async function() {
  try {
    const user = firebase.auth().currentUser;
    if (!user) return false;
    const snap = await db.collection('users').doc(user.uid).get();
    if (!snap.exists || snap.data().role !== 'admin') return false;
    const isSuper = !snap.data().isSubAdmin;
    _verifiedRole = isSuper ? 'super' : 'sub';
    window.currentAdminIsSuperAdmin = isSuper;
    return isSuper;
  } catch {
    return false;
  }
};

auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = 'login.html'; return; }
  try {
    const snap = await db.collection('users').doc(user.uid).get();
    const profile = snap.exists ? snap.data() : null;
    if (!profile || profile.role !== 'admin' || profile.suspended === true || profile.disabled === true) {
      alert('Access denied. Admin only.');
      auth.signOut(); window.location.href = 'login.html'; return;
    }
    const d = snap.data();
    const name = d.displayName || user.email.split('@')[0];

    const isSuperAdmin = !d.isSubAdmin;
    window.currentAdminIsSuperAdmin = isSuperAdmin;
    _verifiedRole = isSuperAdmin ? 'super' : 'sub';

    document.getElementById('sidebar-name').textContent = name;
    document.getElementById('sidebar-avatar').textContent = name[0].toUpperCase();

    const subAdminNavLink = document.querySelector('.nav-link[data-page="sub-admins"]');
    if (subAdminNavLink) {
      subAdminNavLink.style.display = isSuperAdmin ? '' : 'none';
    }

    const roleEl = document.querySelector('.admin-role');
    if (roleEl) roleEl.textContent = isSuperAdmin ? 'Super Admin' : 'Sub Admin';

    document.getElementById('settings-profile').innerHTML = `
      <div class="profile-row"><div class="profile-avatar-lg">${esc(name[0].toUpperCase())}</div>
      <div>
        <p class="profile-name">${esc(name)}</p>
        <p class="profile-email">${esc(user.email)}</p>
        <p class="profile-uid">UID: ${user.uid}</p>
        <p style="margin-top:6px">
          <span class="badge ${isSuperAdmin ? 'badge-red' : 'badge-blue'}">${isSuperAdmin ? '⭐ Super Admin' : '🔹 Sub Admin'}</span>
        </p>
      </div></div>`;
  } catch (e) { auth.signOut(); window.location.href = 'login.html'; }
});

function logout() {
  if (confirm('Logout?')) auth.signOut().then(() => window.location.href = 'login.html');
}
