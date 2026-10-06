'use strict';

async function loadPortfolios() {
  const snap = await db.collection('portfolios').orderBy('createdAt', 'desc').get();
  Store.portfolios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  updateBadge('portfolios', Store.portfolios.length);
  document.getElementById('stat-portfolios').textContent = Store.portfolios.length;
  renderPortfolios();
}

function renderPortfolios() {
  const cat = document.getElementById('filter-portfolio-cat')?.value || '';
  const search = document.getElementById('global-search')?.value.toLowerCase() || '';

  let list = Store.portfolios;
  if (cat) list = list.filter(p => (p.category || '').toLowerCase() === cat.toLowerCase());
  if (search) list = list.filter(p =>
    (p.title || '').toLowerCase().includes(search) ||
    (p.artistEmail || '').toLowerCase().includes(search)
  );

  document.getElementById('portfolios-count').textContent = `${list.length} portfolio${list.length !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('portfolios-tbody');
  if (!list.length) { tbody.innerHTML = emptyRow(9, 'No portfolios found'); return; }

  tbody.innerHTML = list.map((p, i) => `
    <tr>
      <td style="color:var(--gray)">${i + 1}</td>
      <td>${p.coverImage ? `<img src="${esc(p.coverImage)}" class="t-thumb" onerror="this.style.display='none'">` : '<div class="t-thumb-placeholder">🖼</div>'}</td>
      <td><span style="font-weight:500">${esc(p.title || 'Untitled')}</span></td>
      <td style="color:var(--gray)">${esc(p.artistEmail || '—')}</td>
      <td><span class="badge badge-blue">${esc(p.category || '—')}</span></td>
      <td>❤️ ${p.likes || 0}</td>
      <td>👁 ${p.views || 0}</td>
      <td style="color:var(--gray);white-space:nowrap">${ts(p.createdAt)}</td>
      <td>
        <button class="btn-ghost" onclick="viewPortfolio('${safeJsStr(p.id)}')" title="View">👁</button>
        <button class="btn-ghost btn-icon-del" onclick="deleteDoc('portfolios','${safeJsStr(p.id)}','portfolio')" title="Delete">🗑</button>
      </td>
    </tr>`).join('');
}

window.viewPortfolio = function(id) {
  const p = Store.portfolios.find(x => x.id === id);
  if (!p) return;
  openModal('Portfolio Details', `
    ${p.coverImage ? `<img src="${esc(p.coverImage)}" class="detail-img" onerror="this.style.display='none'">` : ''}
    <div class="detail-section">
      <h4>Info</h4>
      <div class="detail-row"><span class="detail-key">Title</span><span class="detail-val">${esc(p.title || 'Untitled')}</span></div>
      <div class="detail-row"><span class="detail-key">Artist</span><span class="detail-val">${esc(p.artistEmail || '—')}</span></div>
      <div class="detail-row"><span class="detail-key">Category</span><span class="detail-val">${esc(p.category || '—')}</span></div>
      <div class="detail-row"><span class="detail-key">Status</span><span class="detail-val">${esc(p.status || 'active')}</span></div>
      <div class="detail-row"><span class="detail-key">Posted</span><span class="detail-val">${ts(p.createdAt)}</span></div>
    </div>
    ${p.description ? `<div class="detail-section"><h4>Description</h4><p style="font-size:13px;color:var(--ink2);line-height:1.6">${esc(p.description)}</p></div>` : ''}
    ${p.tags && p.tags.length ? `<div class="detail-section"><h4>Tags</h4><div style="display:flex;gap:6px;flex-wrap:wrap">${p.tags.map(t => `<span class="badge badge-gray">${esc(t)}</span>`).join('')}</div></div>` : ''}
    <div class="detail-section">
      <h4>Stats</h4>
      <div class="detail-row"><span class="detail-key">Likes</span><span class="detail-val">❤️ ${p.likes || 0}</span></div>
      <div class="detail-row"><span class="detail-key">Views</span><span class="detail-val">👁 ${p.views || 0}</span></div>
    </div>
    ${p.images && p.images.length > 1 ? `<div class="detail-section"><h4>All Images (${p.images.length})</h4><div class="detail-imgs">${p.images.map(img => `<img src="${esc(img)}" onclick="window.open('${sanitizeUrl(esc(img))}','_blank')" onerror="this.style.display='none'">`).join('')}</div></div>` : ''}
    <div style="margin-top:16px">
      <button class="btn btn-danger btn-sm" onclick="deleteDoc('portfolios','${safeJsStr(p.id)}','portfolio');closeModalForce()">Delete Portfolio</button>
    </div>`);
};
