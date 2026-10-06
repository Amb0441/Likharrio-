'use strict';

// ═══════════════════════════════════════════════════════════
// LIKHARRIO ADMIN — APP BOOT
// ═══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  setupNav();
  loadAll();
});

async function loadAll() {
  try {
    await Promise.all([
      loadUsers(),
      loadPortfolios(),
      loadListings(),
      loadEvents(),
      loadVerifications(),
      loadReports(),
      loadSubAdmins(),
    ]);
    renderDashboard();
    renderSettingsCollections();
  } catch (err) {
    console.error('Load error:', err);
    toast('Some data failed to load', 'error');
  }
}

window.refreshAll = () => { toast('Refreshing…', 'info'); loadAll(); };
window.refreshCurrentPage = () => {
  const loaders = {
    dashboard: () => { loadAll(); },
    users: () => { loadUsers().then(() => { renderUsers(); updateBadge('users', Store.users.length); }); },
    artists: () => { renderArtists(); },
    portfolios: () => { loadPortfolios().then(renderPortfolios); },
    listings: () => { loadListings().then(renderListings); },
    events: () => { loadEvents().then(renderEvents); },
    verification: () => { loadVerifications().then(renderVerifications); },
    referrals: () => { renderReferrals(); },
    reports: () => { loadReports().then(renderReports); },
    settings: () => { renderSettingsCollections(); },
    'sub-admins': () => { loadSubAdmins(); }
  };
  const fn = loaders[currentPage];
  if (fn) { toast('Refreshing…', 'info'); fn(); }
};

// ═══════════════════════════════════════════════════════════
// GENERIC DELETE
// ═══════════════════════════════════════════════════════════
const ALLOWED_DELETE_COLLECTIONS = ['users', 'portfolios', 'listings', 'events', 'verificationRequests', 'notifications', 'reports'];

window.deleteDoc = async function(collection, id, label) {
  if (!ALLOWED_DELETE_COLLECTIONS.includes(collection)) {
    toast('Invalid collection specified.', 'error');
    return;
  }
  if (!confirm(`Delete this ${label}? This cannot be undone.`)) return;
  try {
    if (collection === 'users') {
      const [portSnap, listSnap, verifSnap, notifSnap] = await Promise.all([
        db.collection('portfolios').where('artistId', '==', id).get(),
        db.collection('listings').where('artistId', '==', id).get(),
        db.collection('verificationRequests').where('uid', '==', id).get(),
        db.collection('notifications').where('userId', '==', id).get(),
      ]);

      const batch = db.batch();
      portSnap.docs.forEach(d => batch.delete(d.ref));
      listSnap.docs.forEach(d => batch.delete(d.ref));
      verifSnap.docs.forEach(d => batch.delete(d.ref));
      notifSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(db.collection('users').doc(id));
      await batch.commit();

      toast('✓ User removed from Firestore. Auth account still exists.', 'success');
      setTimeout(() => {
        toast('⚠ Auth account NOT deleted. Delete it from Firebase Console:', 'info');
        setTimeout(() => toast('🔗 https://console.firebase.google.com/project/likharrio-82864/authentication/users', 'info'), 4000);
      }, 2000);
    } else {
      await db.collection(collection).doc(id).delete();
      toast(`${label.charAt(0).toUpperCase() + label.slice(1)} deleted`, 'success');
    }
    const reloaders = {
      users: () => loadUsers(),
      portfolios: () => loadPortfolios(),
      listings: () => loadListings(),
      events: () => loadEvents(),
      verificationRequests: () => loadVerifications(),
      notifications: () => loadNotifications(),
      reports: () => loadReports(),
    };
    if (reloaders[collection]) await reloaders[collection]();
    renderDashboard();
    renderSettingsCollections();
  } catch (err) {
    handleError(err, 'delete');
  }
};

// ═══════════════════════════════════════════════════════════
// GLOBAL SEARCH
// ═══════════════════════════════════════════════════════════
window.handleGlobalSearch = function(val) {
  const renderers = {
    users: renderUsers,
    artists: renderArtists,
    portfolios: renderPortfolios,
    listings: renderListings,
    events: renderEvents,
    verification: renderVerifications,
    referrals: renderReferrals,
    reports: renderReports,
    'sub-admins': renderSubAdmins,
  };
  const fn = renderers[currentPage];
  if (fn) fn();
};

console.log('✅ Likharrio Admin v2 loaded');
