'use strict';

function renderArtists() {
  const filterStatus = document.getElementById('filter-artists-status')?.value || '';
  const search = document.getElementById('global-search')?.value.toLowerCase() || '';

  let list = Store.users.filter(u => u.role === 'artist');
  if (filterStatus === 'true') list = list.filter(u => u.isVerified || u.verified);
  if (filterStatus === 'false') list = list.filter(u => !u.isVerified && !u.verified);
  if (search) list = list.filter(u =>
    (u.displayName || '').toLowerCase().includes(search) ||
    (u.email || '').toLowerCase().includes(search)
  );

  document.getElementById('artists-count').textContent = `${list.length} artist${list.length !== 1 ? 's' : ''}`;

  const grid = document.getElementById('artists-grid');
  if (!list.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎨</div>No artists found</div>';
    return;
  }
  grid.innerHTML = list.map(a => {
    const portCount = a.portfolioCount ?? Store.portfolios.filter(p => p.artistId === a.id).length;
    const listCount = a.listingsCount ?? Store.listings.filter(l => l.artistId === a.id).length;
    const isVerif = a.isVerified || a.verified;
    const avatarHtml = a.profileImage
      ? `<img src="${esc(a.profileImage)}" class="at-avatar-img" alt="${esc(a.displayName || '')}" onerror="this.outerHTML='<div class=at-avatar>${initials(a.displayName || a.name || a.email)}</div>'">`
      : `<div class="at-avatar">${initials(a.displayName || a.name || a.email)}</div>`;
    return `
    <div class="artist-tile" onclick="viewUser('${safeJsStr(a.id)}')">
      ${avatarHtml}
      <div class="at-name">${esc(a.displayName || '—')}</div>
      <div class="at-sub">${esc(a.email || '—')}</div>
      <div class="at-stats">
        <span>🖼 ${portCount} portfolios</span>
        <span>🛍 ${listCount} listings</span>
      </div>
      <div class="at-badges">
        ${artistStatusBadge(a.artistStatus, isVerif)}
        ${a.specialty ? `<span class="badge badge-gray">${esc(a.specialty)}</span>` : ''}
      </div>
    </div>`;
  }).join('');
}
