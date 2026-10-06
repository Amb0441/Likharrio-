'use strict';

async function loadVerifications() {
  const snap = await db.collection('verificationRequests').orderBy('submittedAt', 'desc').get();
  Store.verifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const pending = Store.verifications.filter(v => v.status === 'pending').length;
  updateBadge('verification', pending);
  document.getElementById('stat-verif').textContent = pending;
  renderVerifications();
  renderDashVerifPreview();
}

function renderVerifications() {
  const filterStatus = document.getElementById('filter-verif-status')?.value ?? 'pending';
  const search = document.getElementById('global-search')?.value.toLowerCase() || '';

  let list = Store.verifications;
  if (filterStatus) list = list.filter(v => v.status === filterStatus);
  if (search) list = list.filter(v =>
    (v.email || '').toLowerCase().includes(search) ||
    (v.uid || '').toLowerCase().includes(search)
  );

  document.getElementById('verif-count').textContent = `${list.length} request${list.length !== 1 ? 's' : ''}`;

  const container = document.getElementById('verif-list');
  if (!list.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✅</div>${filterStatus === 'pending' ? 'No pending verifications!' : 'No records found'}</div>`;
    return;
  }

  container.innerHTML = list.map(v => {
    const statusCls = { pending: 'status-pending', approved: 'status-approved', rejected: 'status-rejected' }[v.status] || '';
    const badgeEl = {
      pending: '<span class="badge badge-amber">Pending</span>',
      approved: '<span class="badge badge-green">Approved ✓</span>',
      rejected: '<span class="badge badge-red">Rejected</span>'
    }[v.status] || '';
    const samples = v.sampleUrls || [];
    const govId = v.govIdUrl;
    return `
    <div class="verif-card ${statusCls}">
      <div class="verif-head">
        <div class="verif-user">
          <div class="verif-av">${initials(v.email || v.uid)}</div>
          <div>
            <div class="verif-uname">${esc(v.email || v.uid || '—')}</div>
            <div class="verif-uemail">UID: ${esc(v.uid || v.id)}</div>
            <div class="verif-date">Submitted: ${ts(v.submittedAt)}</div>
          </div>
        </div>
        ${badgeEl}
      </div>
      <div class="verif-body">
        ${govId ? `<div class="verif-label">Government ID</div>
          <div class="verif-docs"><img src="${esc(govId)}" class="verif-doc-img" onclick="window.open('${sanitizeUrl(esc(govId))}','_blank')" onerror="this.style.display='none'" title="Click to view full size"></div>` : ''}
        ${v.selfieUrl ? `<div class="verif-label" style="margin-top:10px">🤳 Selfie with ID</div>
          <div class="verif-docs"><img src="${esc(v.selfieUrl)}" class="verif-doc-img verif-selfie-img" onclick="window.open('${sanitizeUrl(esc(v.selfieUrl))}','_blank')" onerror="this.style.display='none'" title="Click to view full size"></div>` : ''}
        ${samples.length ? `<div class="verif-label" style="margin-top:10px">Sample Artworks (${samples.length})</div>
          <div class="verif-docs">${samples.map(url => `<img src="${esc(url)}" class="verif-doc-img" onclick="window.open('${sanitizeUrl(esc(url))}','_blank')" onerror="this.style.display='none'">`).join('')}</div>` : ''}
        ${v.portfolioLink ? `<div class="verif-label">Portfolio Link</div><a href="${sanitizeUrl(esc(v.portfolioLink))}" target="_blank" rel="noopener noreferrer" style="font-size:13px;color:var(--blue)">${esc(v.portfolioLink)}</a>` : ''}
        ${v.artistStatement ? `<div class="verif-label" style="margin-top:10px">Artist Statement</div><div class="verif-statement">${esc(v.artistStatement)}</div>` : ''}
        ${v.rejectionReason ? `<div class="verif-label" style="margin-top:10px;color:var(--red)">Rejection Reason</div><div class="verif-statement" style="border-left:3px solid #ef4444">${esc(v.rejectionReason)}</div>` : ''}
      </div>
      ${v.status === 'pending' ? `
      <div class="verif-actions">
        <button class="btn btn-success" onclick="approveVerif('${safeJsStr(v.id)}','${safeJsStr(v.uid || '')}')">✓ Approve</button>
        <button class="btn btn-danger" onclick="rejectVerif('${safeJsStr(v.id)}')">✗ Reject</button>
      </div>` : ''}
    </div>`;
  }).join('');
}

window.approveVerif = async function(reqId, userId) {
  if (!confirm('Approve this artist verification?')) return;
  try {
    const batch = db.batch();
    batch.update(db.collection('verificationRequests').doc(reqId), {
      status: 'approved',
      approvedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    if (userId) {
      batch.update(db.collection('users').doc(userId), {
        isVerified: true,
        verified: true,
        artistStatus: 'approved',
        verifiedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    await batch.commit();

    if (userId) {
      try {
        await db.collection('notifications').add({
          userId: userId,
          type: 'verification',
          title: '🎉 Artist Verification Approved!',
          body: 'Congratulations! Your artist account has been verified. You can now list items and create content.',
          read: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch {}
    }

    toast('Artist approved and notified! ✓', 'success');
    await loadVerifications();
    await loadUsers();
    renderDashVerifPreview();
  } catch (err) {
    handleError(err, 'approve verification');
  }
};

window.rejectVerif = async function(reqId) {
  const reason = prompt('Rejection reason (will be shown to artist):');
  if (reason === null) return;

  const safeReason = (reason || 'Does not meet verification requirements')
    .trim()
    .replace(/[\x00-\x1F]/g, '')
    .substring(0, 500);

  try {
    const doc = Store.verifications.find(v => v.id === reqId);
    const userId = doc?.uid || '';

    await db.collection('verificationRequests').doc(reqId).update({
      status: 'rejected',
      rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
      rejectionReason: safeReason
    });

    if (userId) {
      await db.collection('users').doc(userId).update({ artistStatus: 'rejected' });
      try {
        await db.collection('notifications').add({
          userId: userId,
          type: 'verification',
          title: '❌ Verification Not Approved',
          body: reason ? `Your verification was not approved: ${reason}` : 'Your verification request was not approved. You may resubmit.',
          read: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch {}
    }

    toast('Verification rejected', 'success');
    await loadVerifications();
    await loadUsers();
    renderDashVerifPreview();
  } catch (err) {
    handleError(err, 'reject verification');
  }
};
