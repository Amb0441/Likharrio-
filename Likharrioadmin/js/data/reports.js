'use strict';

const REASON_LABELS = {
  inappropriate: 'Inappropriate Content',
  spam: 'Spam or Misleading',
  copyright: 'Copyright Violation',
  harassment: 'Harassment or Hate',
  fake: 'Fake or Scam',
  other: 'Other'
};
const REASON_ICONS = {
  inappropriate: '⚠️', spam: '📢', copyright: '🛡️',
  harassment: '🚫', fake: '❗', other: '•••'
};

function reporterInfo(uid) {
  if (!uid) return { name: 'Anonymous', email: '' };
  const u = Store.users.find(x => x.id === uid || x.uid === uid);
  if (!u) return { name: uid.substring(0, 8) + '…', email: '' };
  return {
    name: u.displayName || u.name || u.email?.split('@')[0] || 'User',
    email: u.email || ''
  };
}

function collectionForType(type) {
  if (type === 'artwork') return 'portfolios';
  if (type === 'listing') return 'listings';
  if (type === 'artist')  return 'users';
  return null;
}

async function loadReports() {
  try {
    const snap = await db.collection('reports').orderBy('createdAt', 'desc').get();
    Store.reports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    Store.reports = [];
  }
  const pending = Store.reports.filter(r => r.status !== 'resolved').length;
  updateBadge('reports', pending);
  renderReports();
}

function renderReports() {
  const filterStatus = document.getElementById('filter-report-status')?.value || '';
  const filterType   = document.getElementById('filter-report-type')?.value   || '';
  const filterReason = document.getElementById('filter-report-reason')?.value || '';
  const search = document.getElementById('global-search')?.value.toLowerCase() || '';

  let list = Store.reports;
  if (filterStatus === 'pending')  list = list.filter(r => r.status !== 'resolved');
  if (filterStatus === 'resolved') list = list.filter(r => r.status === 'resolved');
  if (filterType)   list = list.filter(r => r.targetType === filterType);
  if (filterReason) list = list.filter(r => r.reason === filterReason);
  if (search) list = list.filter(r =>
    (r.targetTitle || '').toLowerCase().includes(search) ||
    (r.reason || '').toLowerCase().includes(search) ||
    (r.reportedBy || '').toLowerCase().includes(search) ||
    (r.description || '').toLowerCase().includes(search)
  );

  document.getElementById('reports-count').textContent = `${list.length} report${list.length !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('reports-tbody');
  if (!list.length) {
    tbody.innerHTML = emptyRow(8, Store.reports.length === 0 ? 'No reports have been filed 👍' : 'No reports match filter');
    return;
  }

  tbody.innerHTML = list.map((r, i) => {
    const img      = r.targetImage || '';
    const reporter = reporterInfo(r.reportedBy);
    const typeColor = { artwork: 'badge-purple', listing: 'badge-blue', artist: 'badge-green' }[r.targetType] || 'badge-gray';
    const statusBadge = r.status === 'resolved'
      ? '<span class="badge badge-green">✓ Resolved</span>'
      : '<span class="badge badge-red">⚠ Under Review</span>';

    return `
    <tr style="cursor:pointer" onclick="viewReport('${r.id}')">
      <td style="color:var(--gray)">${i + 1}</td>
      <td>
        <div class="u-cell">
          <div class="u-av" style="font-size:11px;background:var(--blue)">${initials(reporter.name)}</div>
          <div>
            <div class="u-name">${esc(reporter.name)}</div>
            ${reporter.email ? `<div class="u-sub">${esc(reporter.email)}</div>` : ''}
          </div>
        </div>
      </td>
      <td>
        <div class="u-cell">
          ${img
            ? `<img src="${esc(img)}" class="t-thumb" style="flex-shrink:0" onerror="this.style.display='none'">`
            : `<div class="t-thumb-placeholder">${r.targetType === 'artist' ? '👤' : r.targetType === 'listing' ? '🛍' : '🖼'}</div>`}
          <div>
            <div class="u-name">${esc(r.targetTitle || '(no title)')}</div>
            <div class="u-sub" style="font-size:10px">${esc(r.targetId || '')}</div>
          </div>
        </div>
      </td>
      <td><span class="badge ${typeColor}">${esc(r.targetType || '—')}</span></td>
      <td>${REASON_ICONS[r.reason] || '•'} ${esc(REASON_LABELS[r.reason] || r.reason || '—')}</td>
      <td style="color:var(--gray);white-space:nowrap">${ts(r.createdAt)}</td>
      <td>${statusBadge}</td>
      <td onclick="event.stopPropagation()" style="display:flex;gap:6px;align-items:center;white-space:nowrap">
        <button class="btn-ghost" onclick="viewReport('${safeJsStr(r.id)}')" title="View">👁</button>
        ${r.status !== 'resolved'
          ? `<button class="btn btn-sm btn-success" onclick="resolveReport('${safeJsStr(r.id)}',event)">✓</button>`
          : ''}
        <button class="btn-ghost btn-icon-del" onclick="event.stopPropagation();deleteDoc('reports','${safeJsStr(r.id)}','report')" title="Delete">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

window.resolveReport = async function(id, event) {
  if (event) event.stopPropagation();
  if (!confirm('Mark this report as resolved?')) return;
  try {
    await db.collection('reports').doc(id).update({
      status: 'resolved',
      resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    toast('Report marked as resolved ✓', 'success');
    await loadReports();
  } catch (err) {
    handleError(err, 'resolve report');
  }
};

window.dismissReport = async function(id) {
  if (!confirm('Dismiss this report? The reported content will NOT be deleted.')) return;
  try {
    await db.collection('reports').doc(id).update({
      status: 'resolved',
      resolvedNote: 'Dismissed — no action taken',
      resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    toast('Report dismissed', 'info');
    closeModalForce();
    await loadReports();
  } catch (err) {
    handleError(err, 'dismiss report');
  }
};

window.deleteReportedContent = async function(reportId, targetType, targetId) {
  const colName = collectionForType(targetType);
  if (!colName) { toast('Cannot delete this content type', 'error'); return; }
  const label = targetType === 'artist' ? 'user account' : targetType;
  if (!confirm(`DELETE the reported ${label} permanently?\nThis also resolves the report.\n⚠ This CANNOT be undone.`)) return;
  try {
    const batch = db.batch();
    batch.delete(db.collection(colName).doc(targetId));
    batch.update(db.collection('reports').doc(reportId), {
      status: 'resolved',
      resolvedNote: 'Content deleted by admin',
      resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await batch.commit();
    toast(`${label.charAt(0).toUpperCase() + label.slice(1)} deleted and report resolved ✓`, 'success');
    closeModalForce();
    await Promise.all([loadReports(), loadUsers(), loadPortfolios(), loadListings()]);
    renderDashboard();
  } catch (err) {
    handleError(err, 'delete reported content');
  }
};

window.viewReport = function(id) {
  const r = Store.reports.find(x => x.id === id);
  if (!r) return;
  const img      = r.targetImage || '';
  const reporter = reporterInfo(r.reportedBy);
  const typeColor = { artwork: 'badge-purple', listing: 'badge-blue', artist: 'badge-green' }[r.targetType] || 'badge-gray';
  const colName   = collectionForType(r.targetType);

  let contentExtra = '';
  if (r.targetType === 'artwork') {
    const p = Store.portfolios.find(x => x.id === r.targetId);
    if (p) contentExtra = `
      <div class="detail-row"><span class="detail-key">Artist</span><span class="detail-val">${esc(p.artistEmail || '—')}</span></div>
      <div class="detail-row"><span class="detail-key">Category</span><span class="detail-val">${esc(p.category || '—')}</span></div>
      <div class="detail-row"><span class="detail-key">Engagement</span><span class="detail-val">❤️ ${p.likes||0} &nbsp;&nbsp; 👁 ${p.views||0}</span></div>`;
  } else if (r.targetType === 'listing') {
    const l = Store.listings.find(x => x.id === r.targetId);
    if (l) contentExtra = `
      <div class="detail-row"><span class="detail-key">Artist</span><span class="detail-val">${esc(l.artistEmail || '—')}</span></div>
      <div class="detail-row"><span class="detail-key">Price</span><span class="detail-val"><strong>₱${(l.price||0).toLocaleString()}</strong></span></div>
      <div class="detail-row"><span class="detail-key">Status</span><span class="detail-val">${esc(l.status || 'active')}</span></div>`;
  } else if (r.targetType === 'artist') {
    const u = Store.users.find(x => x.id === r.targetId);
    if (u) contentExtra = `
      <div class="detail-row"><span class="detail-key">Email</span><span class="detail-val">${esc(u.email || '—')}</span></div>
      <div class="detail-row"><span class="detail-key">Role</span><span class="detail-val">${roleBadge(u.role)}</span></div>
      <div class="detail-row"><span class="detail-key">Verified</span><span class="detail-val">${(u.isVerified||u.verified) ? '✅ Yes' : '❌ No'}</span></div>`;
  }

  openModal('🚩 Report Details', `
    ${img ? `
    <div style="position:relative;margin-bottom:16px;border-radius:12px;overflow:hidden;max-height:220px;background:#000">
      <img src="${esc(img)}" style="width:100%;object-fit:cover;cursor:pointer;display:block;opacity:.95"
           onclick="window.open('${sanitizeUrl(esc(img))}','_blank')"
           onerror="this.parentElement.style.display='none'"
           title="Click to open full image">
      <div style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,.55);color:#fff;font-size:10px;padding:3px 9px;border-radius:10px">🔍 Click to enlarge</div>
    </div>` : `<div style="padding:20px;text-align:center;background:var(--gray-xlight);border-radius:12px;margin-bottom:16px;color:var(--gray)">${r.targetType === 'artist' ? '👤' : r.targetType === 'listing' ? '🛍' : '🖼'} No image saved</div>`}

    <div class="detail-section">
      <h4>Reported Content</h4>
      <div class="detail-row"><span class="detail-key">Title</span><span class="detail-val" style="font-weight:600">${esc(r.targetTitle || '(no title)')}</span></div>
      <div class="detail-row"><span class="detail-key">Type</span><span class="detail-val"><span class="badge ${typeColor}">${esc(r.targetType || '—')}</span></span></div>
      <div class="detail-row"><span class="detail-key">ID</span><code class="detail-val" style="font-size:10px;word-break:break-all">${esc(r.targetId || '—')}</code></div>
      ${contentExtra}
    </div>

    <div class="detail-section">
      <h4>Report Details</h4>
      <div class="detail-row"><span class="detail-key">Reason</span><span class="detail-val">${REASON_ICONS[r.reason] || ''} <strong>${esc(REASON_LABELS[r.reason] || r.reason || '—')}</strong></span></div>
      ${r.description ? `<div class="detail-row"><span class="detail-key">Description</span><span class="detail-val" style="line-height:1.6;white-space:pre-wrap">${esc(r.description)}</span></div>` : ''}
      <div class="detail-row"><span class="detail-key">Filed</span><span class="detail-val">${ts(r.createdAt)}</span></div>
    </div>

    <div class="detail-section">
      <h4>Reporter</h4>
      <div class="detail-row"><span class="detail-key">Name</span><span class="detail-val">${esc(reporter.name)}</span></div>
      ${reporter.email ? `<div class="detail-row"><span class="detail-key">Email</span><span class="detail-val">${esc(reporter.email)}</span></div>` : ''}
      <div class="detail-row"><span class="detail-key">UID</span><code class="detail-val" style="font-size:10px">${esc(r.reportedBy || '—')}</code></div>
    </div>

    <div class="detail-section">
      <h4>Status</h4>
      <div class="detail-row"><span class="detail-key">Current</span><span class="detail-val">
        ${r.status === 'resolved'
          ? '<span class="badge badge-green">✓ Resolved</span>'
          : '<span class="badge badge-red">⚠ Under Review</span>'}
      </span></div>
      ${r.resolvedAt ? `<div class="detail-row"><span class="detail-key">Resolved At</span><span class="detail-val">${ts(r.resolvedAt)}</span></div>` : ''}
      ${r.resolvedNote ? `<div class="detail-row"><span class="detail-key">Note</span><span class="detail-val">${esc(r.resolvedNote)}</span></div>` : ''}
    </div>

    <div style="margin-top:20px;display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid var(--gray-xlight);padding-top:16px">
      ${r.status !== 'resolved' ? `
        <button class="btn btn-success btn-sm" onclick="resolveReport('${safeJsStr(r.id)}');closeModalForce()">✓ Mark Resolved</button>
        <button class="btn btn-secondary btn-sm" onclick="dismissReport('${safeJsStr(r.id)}')">↩ Dismiss</button>` : ''}
      ${colName ? `<button class="btn btn-danger btn-sm" onclick="deleteReportedContent('${safeJsStr(r.id)}','${safeJsStr(r.targetType)}','${safeJsStr(r.targetId)}')">🗑 Delete ${esc(r.targetType)}</button>` : ''}
      <button class="btn btn-secondary btn-sm" onclick="deleteDoc('reports','${safeJsStr(r.id)}','report');closeModalForce()">✕ Remove Report</button>
    </div>`);
};
