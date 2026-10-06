'use strict';

async function loadSubAdmins() {
  try {
    const snap = await db.collection('users')
      .where('role', '==', 'admin')
      .get();
    const currentUid = firebase.auth().currentUser?.uid;
    Store.subAdmins = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => u.isSubAdmin === true && u.id !== currentUid)
      .sort((a, b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });
    updateBadge('sub-admins', Store.subAdmins.length);
    renderSubAdmins();
  } catch (err) {
    console.error('loadSubAdmins error:', err);
    handleError(err, 'load sub admins');
  }
}

function renderSubAdmins() {
  const filterStatus = document.getElementById('filter-subadmin-status')?.value || '';
  const search = document.getElementById('global-search')?.value.toLowerCase() || '';

  let list = Store.subAdmins;
  if (filterStatus === 'active')   list = list.filter(u => !u.disabled);
  if (filterStatus === 'disabled') list = list.filter(u => u.disabled);
  if (search) list = list.filter(u =>
    (u.displayName || '').toLowerCase().includes(search) ||
    (u.email || '').toLowerCase().includes(search)
  );

  document.getElementById('sub-admins-count').textContent =
    `${list.length} sub admin${list.length !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('sub-admins-tbody');
  if (!list.length) {
    tbody.innerHTML = emptyRow(6, 'No sub admins yet. Click "Add Sub Admin" to create one.');
    return;
  }

  tbody.innerHTML = list.map((u, i) => {
    const statusBadge = u.disabled
      ? '<span class="badge badge-gray">Disabled</span>'
      : '<span class="badge badge-green">Active</span>';
    return `
    <tr>
      <td style="color:var(--gray)">${i + 1}</td>
      <td><div class="u-cell">
        <div class="u-av" style="background:var(--gold);color:#1a1a2e">${initials(u.displayName || u.email)}</div>
        <div>
          <div class="u-name">${esc(u.displayName || '—')}</div>
          <div class="u-sub">${esc(u.email || u.id)}</div>
        </div>
      </div></td>
      <td style="color:var(--gray)">${esc(u.email || '—')}</td>
      <td style="color:var(--gray);white-space:nowrap">${ts(u.createdAt)}</td>
      <td>${statusBadge}</td>
      <td style="display:flex;gap:6px;align-items:center">
        <button class="btn-ghost" onclick="viewSubAdmin('${safeJsStr(u.id)}')" title="View">👁</button>
        ${u.disabled
          ? `<button class="btn btn-sm btn-success" onclick="toggleSubAdmin('${safeJsStr(u.id)}', false)">✓ Enable</button>`
          : `<button class="btn btn-sm btn-danger" onclick="toggleSubAdmin('${safeJsStr(u.id)}', true)">⊘ Disable</button>`
        }
        <button class="btn-ghost btn-icon-del" onclick="deleteSubAdmin('${safeJsStr(u.id)}','${esc(u.email || '')}')" title="Delete">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

window.openCreateSubAdminModal = function() {
  openModal('➕ Add Sub Admin', `
    <div class="subadmin-form">
      <div class="form-group-modal">
        <label>Full Name</label>
        <input type="text" id="sa-name" placeholder="e.g. Juan dela Cruz" class="modal-input" />
      </div>
      <div class="form-group-modal">
        <label>Email Address</label>
        <input type="email" id="sa-email" placeholder="subadmin@likharrio.com" class="modal-input" />
      </div>
      <div class="form-group-modal">
        <label>Role Note <span style="color:var(--gray);font-weight:400;font-size:11px">(optional)</span></label>
        <input type="text" id="sa-note" placeholder="e.g. Content Moderator" class="modal-input" />
      </div>
      <div id="sa-error" style="color:#ef4444;font-size:12px;margin-top:4px;display:none"></div>
      <p style="font-size:12px;color:var(--gray);line-height:1.6;margin-top:4px">
        ⚠️ This creates a sub-admin record in Firestore. To allow login, also create their Firebase Auth account manually in the Firebase Console or via your backend.
      </p>
      <div style="margin-top:14px;display:flex;gap:10px">
        <button class="btn btn-primary" id="sa-submit-btn" onclick="createSubAdmin()">Add Sub Admin</button>
        <button class="btn btn-secondary" onclick="closeModalForce()">Cancel</button>
      </div>
    </div>`);
};

window.createSubAdmin = async function() {
  const name  = document.getElementById('sa-name')?.value.trim();
  const email = document.getElementById('sa-email')?.value.trim();
  const note  = document.getElementById('sa-note')?.value.trim();
  const errEl = document.getElementById('sa-error');
  const btn   = document.getElementById('sa-submit-btn');

  const showErr = (msg) => { errEl.textContent = msg; errEl.style.display = 'block'; };
  errEl.style.display = 'none';

  if (!name)  { showErr('Please enter a full name.'); return; }
  if (!email || !email.includes('@')) { showErr('Please enter a valid email address.'); return; }

  const exists = Store.subAdmins.some(u => u.email?.toLowerCase() === email.toLowerCase());
  if (exists) { showErr('A sub admin with this email already exists.'); return; }

  btn.disabled = true;
  btn.textContent = 'Adding…';

  try {
    const currentUid = firebase.auth().currentUser?.uid;
    await db.collection('users').add({
      displayName: name,
      email: email,
      role: 'admin',
      isSubAdmin: true,
      disabled: false,
      note: note || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: currentUid || 'super-admin',
    });

    closeModalForce();
    toast(`Sub admin "${name}" added ✓`, 'success');
    await loadSubAdmins();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Add Sub Admin';
    showErr(err.message || 'Failed to add sub admin.');
  }
};

window.viewSubAdmin = function(id) {
  const u = Store.subAdmins.find(x => x.id === id);
  if (!u) return;
  openModal('Sub Admin Details', `
    <div class="detail-av-row">
      <div class="detail-av" style="background:var(--gold);color:#1a1a2e">${initials(u.displayName || u.email)}</div>
      <div>
        <div style="font-size:16px;font-weight:600">${esc(u.displayName || '—')}</div>
        <div style="color:var(--gray);font-size:13px">${esc(u.email || '—')}</div>
      </div>
    </div>
    <div class="detail-section">
      <h4>Account Info</h4>
      <div class="detail-row"><span class="detail-key">UID</span><code class="detail-val">${u.id}</code></div>
      <div class="detail-row"><span class="detail-key">Role</span><span class="detail-val"><span class="badge badge-red">admin</span></span></div>
      <div class="detail-row"><span class="detail-key">Status</span><span class="detail-val">${u.disabled ? '<span class="badge badge-gray">Disabled</span>' : '<span class="badge badge-green">Active</span>'}</span></div>
      ${u.note ? `<div class="detail-row"><span class="detail-key">Note</span><span class="detail-val">${esc(u.note)}</span></div>` : ''}
      <div class="detail-row"><span class="detail-key">Created</span><span class="detail-val">${ts(u.createdAt)}</span></div>
      ${u.createdBy ? `<div class="detail-row"><span class="detail-key">Created By</span><span class="detail-val">${esc(u.createdBy)}</span></div>` : ''}
    </div>
    <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
      ${u.disabled
        ? `<button class="btn btn-success btn-sm" onclick="toggleSubAdmin('${safeJsStr(u.id)}',false);closeModalForce()">✓ Enable Account</button>`
        : `<button class="btn btn-danger btn-sm" onclick="toggleSubAdmin('${safeJsStr(u.id)}',true);closeModalForce()">⊘ Disable Account</button>`
      }
      <button class="btn btn-secondary btn-sm" onclick="deleteSubAdmin('${safeJsStr(u.id)}','${esc(u.email || '')}');closeModalForce()">🗑 Delete</button>
    </div>`);
};

window.toggleSubAdmin = async function(id, disable) {
  const action = disable ? 'disable' : 'enable';
  if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} this sub admin?`)) return;
  try {
    await db.collection('users').doc(id).update({ disabled: disable });
    toast(`Sub admin ${action}d ✓`, 'success');
    await loadSubAdmins();
  } catch (err) {
    handleError(err, 'toggle sub admin');
  }
};

window.deleteSubAdmin = async function(id, email) {
  if (!confirm(`Permanently delete sub admin (${email || id})?\nThis cannot be undone.`)) return;
  try {
    await db.collection('users').doc(id).delete();
    toast('Sub admin deleted ✓', 'success');
    await loadSubAdmins();
  } catch (err) {
    handleError(err, 'delete sub admin');
  }
};
