'use strict';

function renderReferrals() {
  const filterStatus = document.getElementById('filter-referral-status')?.value || '';
  const search = document.getElementById('global-search')?.value.toLowerCase() || '';

  const artists = Store.users.filter(u => u.role === 'artist');
  const withCode = artists.filter(a => a.referralCode);
  const noCode   = artists.filter(a => !a.referralCode);

  const signupsByCode = Store.users.filter(u => u.usedReferralCode);

  const statGen = document.getElementById('stat-referral-generated');
  const statUsed = document.getElementById('stat-referral-used');
  const statNo = document.getElementById('stat-referral-nocode');
  if (statGen) statGen.textContent = withCode.length;
  if (statUsed) statUsed.textContent = signupsByCode.length;
  if (statNo) statNo.textContent = noCode.length;

  updateBadge('referrals', withCode.length);

  let artistList = artists;
  if (filterStatus === 'has_code') artistList = withCode;
  if (filterStatus === 'no_code')  artistList = noCode;
  if (search) artistList = artistList.filter(a =>
    (a.displayName || a.name || '').toLowerCase().includes(search) ||
    (a.email || '').toLowerCase().includes(search) ||
    (a.referralCode || '').toLowerCase().includes(search)
  );

  document.getElementById('referrals-count').textContent =
    `${artistList.length} artist${artistList.length !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('referrals-tbody');
  if (!artistList.length) { tbody.innerHTML = emptyRow(8, 'No artists found'); }
  else {
    tbody.innerHTML = artistList.map((a, i) => {
      const codeUsedCount = signupsByCode.filter(u => u.usedReferralCode === a.referralCode).length;
      const isVerif = a.isVerified || a.verified;
      return `
      <tr>
        <td style="color:var(--gray)">${i + 1}</td>
        <td><div class="u-cell">
          ${a.profileImage
            ? `<img src="${esc(a.profileImage)}" class="u-av-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="u-av" style="display:none">${initials(a.displayName || a.name || a.email)}</div>`
            : `<div class="u-av">${initials(a.displayName || a.name || a.email)}</div>`
          }
          <div><div class="u-name">${esc(a.displayName || a.name || '—')}</div></div>
        </div></td>
        <td style="color:var(--gray)">${esc(a.email || '—')}</td>
        <td>
          ${a.referralCode
            ? `<code style="font-size:12px;font-weight:700;background:var(--red-light);color:var(--red);padding:3px 10px;border-radius:20px;letter-spacing:.5px">${esc(a.referralCode)}</code>`
            : `<span style="color:var(--gray);font-size:12px;font-style:italic">Not generated</span>`
          }
        </td>
        <td>${artistStatusBadge(a.artistStatus, isVerif)}</td>
        <td style="text-align:center">
          ${codeUsedCount > 0
            ? `<span class="badge badge-green">${codeUsedCount} signup${codeUsedCount !== 1 ? 's' : ''}</span>`
            : `<span style="color:var(--gray);font-size:12px">0</span>`
          }
        </td>
        <td style="color:var(--gray);white-space:nowrap">${ts(a.createdAt)}</td>
        <td>
          <button class="btn-ghost" onclick="viewReferralDetails('${safeJsStr(a.id)}')" title="View">👁</button>
          ${a.referralCode
            ? `<button class="btn-ghost btn-icon-del" onclick="revokeReferralCode('${safeJsStr(a.id)}')" title="Revoke Code">🚫</button>`
            : ''
          }
        </td>
      </tr>`;
    }).join('');
  }

  const signupTbody = document.getElementById('referral-signups-tbody');
  let signupList = signupsByCode;
  if (search) signupList = signupList.filter(u =>
    (u.displayName || u.name || '').toLowerCase().includes(search) ||
    (u.email || '').toLowerCase().includes(search) ||
    (u.usedReferralCode || '').toLowerCase().includes(search)
  );

  if (!signupList.length) {
    signupTbody.innerHTML = emptyRow(6, 'No artists signed up via referral yet');
  } else {
    signupTbody.innerHTML = signupList.map((u, i) => {
      const referrer = Store.users.find(a => a.referralCode === u.usedReferralCode);
      return `
      <tr>
        <td style="color:var(--gray)">${i + 1}</td>
        <td><div class="u-cell">
          ${u.profileImage
            ? `<img src="${esc(u.profileImage)}" class="u-av-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="u-av" style="display:none">${initials(u.displayName || u.name || u.email)}</div>`
            : `<div class="u-av">${initials(u.displayName || u.name || u.email)}</div>`
          }
          <div><div class="u-name">${esc(u.displayName || u.name || '—')}</div></div>
        </div></td>
        <td style="color:var(--gray)">${esc(u.email || '—')}</td>
        <td><code style="font-size:12px;font-weight:700;background:var(--red-light);color:var(--red);padding:3px 10px;border-radius:20px;letter-spacing:.5px">${esc(u.usedReferralCode)}</code></td>
        <td>
          ${referrer
            ? `<span style="font-weight:500">${esc(referrer.displayName || referrer.name || referrer.email || '—')}</span>`
            : `<span style="color:var(--gray);font-size:12px;font-style:italic">Unknown</span>`
          }
        </td>
        <td style="color:var(--gray);white-space:nowrap">${ts(u.createdAt)}</td>
      </tr>`;
    }).join('');
  }
}

window.viewReferralDetails = function(artistId) {
  const a = Store.users.find(x => x.id === artistId);
  if (!a) return;
  const signupsByCode = Store.users.filter(u => u.usedReferralCode && u.usedReferralCode === a.referralCode);
  const portCount = Store.portfolios.filter(p => p.artistId === artistId).length;

  openModal('Referral Code Details', `
    <div class="detail-av-row">
      ${a.profileImage
        ? `<img src="${esc(a.profileImage)}" class="detail-av-img" onerror="this.style.display='none'">`
        : `<div class="detail-av">${initials(a.displayName || a.name || a.email)}</div>`
      }
      <div>
        <div style="font-size:16px;font-weight:600">${esc(a.displayName || a.name || '—')}</div>
        <div style="color:var(--gray);font-size:13px">${esc(a.email || '—')}</div>
      </div>
    </div>

    <div class="detail-section">
      <h4>Referral Code</h4>
      ${a.referralCode
        ? `<div style="text-align:center;padding:16px;background:var(--red-light);border-radius:10px;margin-bottom:8px">
             <span style="font-family:monospace;font-size:22px;font-weight:800;color:var(--red);letter-spacing:2px">${esc(a.referralCode)}</span>
           </div>
           <div class="detail-row"><span class="detail-key">Status</span><span class="detail-val"><span class="badge badge-green">✓ Active</span></span></div>`
        : `<p style="color:var(--gray);font-size:13px">This artist has not generated a referral code yet.</p>`
      }
    </div>

    <div class="detail-section">
      <h4>Artist Info</h4>
      <div class="detail-row"><span class="detail-key">Verified</span><span class="detail-val">${(a.isVerified || a.verified) ? '✅ Yes' : '❌ No'}</span></div>
      <div class="detail-row"><span class="detail-key">Artist Type</span><span class="detail-val">${esc(a.artistType || a.specialty || '—')}</span></div>
      <div class="detail-row"><span class="detail-key">Portfolios</span><span class="detail-val">${portCount}</span></div>
      <div class="detail-row"><span class="detail-key">Joined</span><span class="detail-val">${ts(a.createdAt)}</span></div>
    </div>

    ${a.referralCode && signupsByCode.length ? `
    <div class="detail-section">
      <h4>Artists Who Signed Up Using This Code (${signupsByCode.length})</h4>
      ${signupsByCode.map(u => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--gray-xlight)">
          <div class="u-av" style="width:32px;height:32px;font-size:12px">${initials(u.displayName || u.name || u.email)}</div>
          <div>
            <div style="font-weight:500;font-size:13px">${esc(u.displayName || u.name || '—')}</div>
            <div style="font-size:12px;color:var(--gray)">${esc(u.email || '—')} • ${ts(u.createdAt)}</div>
          </div>
        </div>`).join('')}
    </div>` : a.referralCode ? `<p style="color:var(--gray);font-size:13px">No signups via this code yet.</p>` : ''}

    ${a.referralCode ? `
    <div style="margin-top:16px">
      <button class="btn btn-danger btn-sm" onclick="revokeReferralCode('${safeJsStr(a.id)}');closeModalForce()">🚫 Revoke Code</button>
    </div>` : ''}
  `);
};

window.revokeReferralCode = async function(artistId) {
  if (!confirm('Revoke this artist\'s referral code? This cannot be undone. Artists who already signed up with this code will NOT be affected.')) return;
  try {
    await db.collection('users').doc(artistId).update({ referralCode: firebase.firestore.FieldValue.delete() });
    const idx = Store.users.findIndex(u => u.id === artistId);
    if (idx !== -1) delete Store.users[idx].referralCode;
    toast('Referral code revoked ✓', 'success');
    renderReferrals();
  } catch (err) {
    handleError(err, 'revoke referral code');
  }
};
