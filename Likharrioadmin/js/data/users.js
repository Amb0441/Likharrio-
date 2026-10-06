'use strict';

async function loadUsers() {
  const snap = await db.collection('users').orderBy('createdAt', 'desc').get();
  const privateSnaps = await Promise.all(
    snap.docs.map((userDoc) => userDoc.ref.collection('private').doc('account').get())
  );
  const privateByUser = {};
  privateSnaps.forEach((docSnap) => {
    if (!docSnap.exists) return;
    const userId = docSnap.ref.parent.parent && docSnap.ref.parent.parent.id;
    if (userId) privateByUser[userId] = docSnap.data();
  });
  Store.users = snap.docs.map(d => ({ id: d.id, ...d.data(), ...(privateByUser[d.id] || {}) }));
  const nonAdmins = Store.users.filter(u => u.role !== 'admin');
  const artists = Store.users.filter(u => u.role === 'artist').length;
  updateBadge('users', nonAdmins.length);
  updateBadge('artists', artists);
  document.getElementById('stat-users').textContent = nonAdmins.length;
  document.getElementById('stat-users-artists').textContent = `${artists} artists`;
  renderUsers();
  renderArtists();
}

function renderUsers() {
  const role = document.getElementById('filter-users-role')?.value || '';
  const status = document.getElementById('filter-users-status')?.value || '';
  const search = document.getElementById('global-search')?.value.toLowerCase() || '';

  let list = Store.users.filter(u => u.role !== 'admin');
  if (role) list = list.filter(u => u.role === role);
  if (status === 'verified') list = list.filter(u => u.isVerified || u.verified);
  if (status === 'unverified') list = list.filter(u => !u.isVerified && !u.verified);
  if (search) list = list.filter(u =>
    (u.displayName || '').toLowerCase().includes(search) ||
    (u.email || '').toLowerCase().includes(search) ||
    (u.role || '').toLowerCase().includes(search)
  );

  document.getElementById('users-count').textContent = `${list.length} user${list.length !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('users-tbody');
  if (!list.length) { tbody.innerHTML = emptyRow(7, 'No users found'); return; }

  tbody.innerHTML = list.map((u, i) => {
    const statusHtml = u.role === 'artist'
      ? artistStatusBadge(u.artistStatus, u.isVerified || u.verified)
      : (u.emailVerified ? '<span class="badge badge-green">Email Verified ✓</span>' : '<span class="badge badge-gray">Email Not Verified</span>');
    return `
    <tr>
      <td style="color:var(--gray)">${i + 1}</td>
      <td><div class="u-cell">
        ${u.profileImage
          ? `<img src="${esc(u.profileImage)}" class="u-av-img" alt="" onerror="this.outerHTML='<div class=u-av>${initials(u.displayName || u.name || u.email)}</div>'">`
          : `<div class="u-av">${initials(u.displayName || u.name || u.email)}</div>`}
        <div><div class="u-name">${esc(u.displayName || u.name || '—')}</div><div class="u-sub">${esc(u.uid || u.id || '')}</div></div>
      </div></td>
      <td style="color:var(--gray)">${esc(u.email || '—')}</td>
      <td>${roleBadge(u.role)}</td>
      <td>${statusHtml}</td>
      <td style="color:var(--gray);white-space:nowrap">${ts(u.createdAt)}</td>
      <td>
        <button class="btn-ghost" onclick="viewUser('${safeJsStr(u.id)}')" title="View">👁</button>
        <button class="btn-ghost btn-icon-del" onclick="deleteDoc('users','${safeJsStr(u.id)}','user')" title="Delete">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

window.viewUser = function(id) {
  const u = Store.users.find(x => x.id === id);
  if (!u) return;
  const portfolios = u.portfolioCount ?? Store.portfolios.filter(p => p.artistId === id).length;
  const listings = u.listingsCount ?? Store.listings.filter(l => l.artistId === id).length;
  openModal('User Details', `
    <div class="detail-av-row">
      ${u.profileImage
        ? `<img src="${esc(u.profileImage)}" class="detail-av-img" onerror="this.style.display='none'">`
        : `<div class="detail-av">${initials(u.displayName || u.name || u.email)}</div>`
      }
      <div>
        <div style="font-size:16px;font-weight:600">${esc(u.displayName || '—')}</div>
        <div style="color:var(--gray);font-size:13px">${esc(u.email || '—')}</div>
      </div>
    </div>
    <div class="detail-section">
      <h4>Account</h4>
      <div class="detail-row"><span class="detail-key">UID</span><code class="detail-val">${u.id}</code></div>
      <div class="detail-row"><span class="detail-key">Role</span><span class="detail-val">${roleBadge(u.role)}</span></div>
      ${u.role === 'artist'
        ? `<div class="detail-row"><span class="detail-key">Artist Status</span><span class="detail-val">${artistStatusBadge(u.artistStatus, u.isVerified || u.verified)}</span></div>`
        : `<div class="detail-row"><span class="detail-key">Email Verified</span><span class="detail-val">${u.emailVerified ? '✅ Yes' : '❌ No'}</span></div>`}
      <div class="detail-row"><span class="detail-key">Joined</span><span class="detail-val">${ts(u.createdAt)}</span></div>
    </div>
    ${u.specialty ? `<div class="detail-section"><h4>Artist Info</h4><div class="detail-row"><span class="detail-key">Specialty</span><span class="detail-val">${esc(u.specialty)}</span></div>${u.bio ? `<div class="detail-row"><span class="detail-key">Bio</span><span class="detail-val">${esc(u.bio)}</span></div>` : ''}</div>` : ''}
    <div class="detail-section">
      <h4>Activity</h4>
      <div class="detail-row"><span class="detail-key">Portfolios</span><span class="detail-val">${portfolios}</span></div>
      <div class="detail-row"><span class="detail-key">Listings</span><span class="detail-val">${listings}</span></div>
      <div class="detail-row"><span class="detail-key">Followers</span><span class="detail-val">${u.followersCount || 0}</span></div>
    </div>
    <div style="margin-top:16px;display:flex;gap:8px;">
      <button class="btn btn-danger btn-sm" onclick="deleteDoc('users','${safeJsStr(u.id)}','user');closeModalForce()">Delete User</button>
    </div>`);
};
