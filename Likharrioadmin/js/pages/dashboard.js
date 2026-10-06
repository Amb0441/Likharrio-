'use strict';

function renderDashboard() {
  const tbody = document.getElementById('dash-activity-tbody');
  const recent = Store.users.filter(u => u.role !== 'admin').slice(0, 8);
  if (!recent.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="t-empty">No users yet</td></tr>';
    return;
  }
  tbody.innerHTML = recent.map(u => `
    <tr>
      <td><div class="u-cell">
        ${u.profileImage
          ? `<img src="${esc(u.profileImage)}" class="u-av-img" alt="" onerror="this.outerHTML='<div class=u-av>${initials(u.displayName || u.email)}</div>'">`
          : `<div class="u-av">${initials(u.displayName || u.email)}</div>`}
        <div><div class="u-name">${esc(u.displayName || u.name || '—')}</div></div>
      </div></td>
      <td style="color:var(--gray)">${esc(u.email || '—')}</td>
      <td>${roleBadge(u.role)}</td>
      <td style="color:var(--gray);white-space:nowrap">${ts(u.createdAt)}</td>
      <td>${artistStatusBadge(u.artistStatus, u.isVerified || u.verified)}</td>
    </tr>`).join('');
}

function renderDashVerifPreview() {
  const container = document.getElementById('dash-verif-list');
  const pending = Store.verifications.filter(v => v.status === 'pending').slice(0, 5);
  if (!pending.length) {
    container.innerHTML = '<p style="padding:12px 0;color:var(--gray);font-size:13px;">No pending verifications 🎉</p>';
    return;
  }
  container.innerHTML = pending.map(v => `
    <div class="dash-verif-item">
      <div class="dash-verif-left">
        <div class="dash-verif-av">${initials(v.email || v.uid)}</div>
        <div>
          <div class="dash-verif-name">${esc(v.email || v.uid || '—')}</div>
          <div class="dash-verif-email">${ts(v.submittedAt)}</div>
        </div>
      </div>
      <div class="dash-verif-actions">
        <button class="btn btn-sm btn-success" onclick="approveVerif('${safeJsStr(v.id)}','${safeJsStr(v.uid || '')}')">✓ Approve</button>
        <button class="btn btn-sm btn-danger" onclick="rejectVerif('${safeJsStr(v.id)}')">✗ Reject</button>
      </div>
    </div>`).join('');
}
