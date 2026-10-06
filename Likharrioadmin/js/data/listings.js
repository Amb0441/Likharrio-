'use strict';

async function loadListings() {
  const snap = await db.collection('listings').orderBy('createdAt', 'desc').get();
  Store.listings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const active = Store.listings.filter(l => l.status !== 'sold').length;
  updateBadge('listings', Store.listings.length);
  document.getElementById('stat-listings-count').textContent = Store.listings.length;
  document.getElementById('stat-listings-active').textContent = `${active} active`;
  renderListings();
}

function renderListings() {
  const cat = document.getElementById('filter-listing-cat')?.value || '';
  const status = document.getElementById('filter-listing-status')?.value || '';
  const search = document.getElementById('global-search')?.value.toLowerCase() || '';

  let list = Store.listings;
  if (cat) list = list.filter(l => (l.category || '').toLowerCase() === cat.toLowerCase());
  if (status) list = list.filter(l => l.status === status);
  if (search) list = list.filter(l =>
    (l.title || '').toLowerCase().includes(search) ||
    (l.artistEmail || '').toLowerCase().includes(search) ||
    (l.category || '').toLowerCase().includes(search)
  );

  document.getElementById('listings-count').textContent = `${list.length} listing${list.length !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('listings-tbody');
  if (!list.length) { tbody.innerHTML = emptyRow(10, 'No listings found'); return; }

  tbody.innerHTML = list.map((l, i) => {
    const img = l.imageUrl || (l.images && l.images[0]);
    const statusCls = l.status === 'active' ? 'badge-green' : l.status === 'sold' ? 'badge-gray' : 'badge-amber';
    return `
    <tr>
      <td style="color:var(--gray)">${i + 1}</td>
      <td><div class="u-cell">${img ? `<img src="${esc(img)}" class="t-thumb" onerror="this.style.display='none'">` : '<div class="t-thumb-placeholder">🎨</div>'}
        <span style="font-weight:500">${esc(l.title || 'Untitled')}</span></div></td>
      <td style="color:var(--gray)">${esc(l.artistEmail || '—')}</td>
      <td><span class="badge badge-blue">${esc(l.category || '—')}</span></td>
      <td><strong>₱${(l.price || 0).toLocaleString()}</strong></td>
      <td>${l.currentQuantity !== undefined ? l.currentQuantity : '—'} / ${l.initialQuantity || 0}</td>
      <td>${l.soldCount || 0}</td>
      <td style="color:var(--gray)">👁 ${l.views || 0}</td>
      <td><span class="badge ${statusCls}">${esc(l.status || 'active')}</span></td>
      <td>
        <button class="btn-ghost" onclick="viewListing('${safeJsStr(l.id)}')" title="View">👁</button>
        <button class="btn-ghost btn-icon-del" onclick="deleteDoc('listings','${safeJsStr(l.id)}','listing')" title="Delete">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

window.viewListing = function(id) {
  const l = Store.listings.find(x => x.id === id);
  if (!l) return;
  const img = l.imageUrl || (l.images && l.images[0]);
  openModal('Listing Details', `
    ${img ? `<img src="${esc(img)}" class="detail-img" onerror="this.style.display='none'">` : ''}
    <div class="detail-section">
      <h4>Item Info</h4>
      <div class="detail-row"><span class="detail-key">Title</span><span class="detail-val">${esc(l.title || 'Untitled')}</span></div>
      <div class="detail-row"><span class="detail-key">Artist</span><span class="detail-val">${esc(l.artistEmail || '—')}</span></div>
      <div class="detail-row"><span class="detail-key">Category</span><span class="detail-val">${esc(l.category || '—')}</span></div>
      <div class="detail-row"><span class="detail-key">Price</span><span class="detail-val"><strong>₱${(l.price || 0).toLocaleString()}</strong></span></div>
      <div class="detail-row"><span class="detail-key">Status</span><span class="detail-val">${esc(l.status || 'active')}</span></div>
      <div class="detail-row"><span class="detail-key">Posted</span><span class="detail-val">${ts(l.createdAt)}</span></div>
    </div>
    <div class="detail-section">
      <h4>Inventory</h4>
      <div class="detail-row"><span class="detail-key">Initial Qty</span><span class="detail-val">${l.initialQuantity || 0}</span></div>
      <div class="detail-row"><span class="detail-key">Remaining</span><span class="detail-val">${l.currentQuantity !== undefined ? l.currentQuantity : '—'}</span></div>
      <div class="detail-row"><span class="detail-key">Sold</span><span class="detail-val">${l.soldCount || 0}</span></div>
    </div>
    <div class="detail-section">
      <h4>Engagement</h4>
      <div class="detail-row"><span class="detail-key">Views</span><span class="detail-val">👁 ${l.views || 0}</span></div>
      <div class="detail-row"><span class="detail-key">Saves</span><span class="detail-val">🔖 ${l.saves || 0}</span></div>
      <div class="detail-row"><span class="detail-key">Shares</span><span class="detail-val">📤 ${l.shares || 0}</span></div>
    </div>
    ${l.description ? `<div class="detail-section"><h4>Description</h4><p style="font-size:13px;color:var(--ink2);line-height:1.6">${esc(l.description)}</p></div>` : ''}
    ${l.images && l.images.length > 1 ? `<div class="detail-section"><h4>All Images</h4><div class="detail-imgs">${l.images.map(img => `<img src="${esc(img)}" onclick="window.open('${sanitizeUrl(esc(img))}','_blank')" onerror="this.style.display='none'">`).join('')}</div></div>` : ''}
    <div style="margin-top:16px">
      <button class="btn btn-danger btn-sm" onclick="deleteDoc('listings','${safeJsStr(l.id)}','listing');closeModalForce()">Delete Listing</button>
    </div>`);
};
