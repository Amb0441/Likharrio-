'use strict';

async function loadNotifications() {
  const snap = await db.collection('notifications').orderBy('createdAt', 'desc').limit(500).get();
  Store.notifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  updateBadge('notifications', Store.notifications.length);
  document.getElementById('stat-notifs').textContent = Store.notifications.length;
  renderNotifications();
}

function renderNotifications() {
  const typeFilter = document.getElementById('filter-notif-type')?.value || '';
  const search = document.getElementById('global-search')?.value.toLowerCase() || '';

  let list = Store.notifications;
  if (typeFilter) list = list.filter(n => n.type === typeFilter);
  if (search) list = list.filter(n =>
    (n.title || '').toLowerCase().includes(search) ||
    (n.body || '').toLowerCase().includes(search) ||
    (n.userId || '').toLowerCase().includes(search)
  );

  document.getElementById('notifs-count').textContent = `${list.length} notification${list.length !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('notifs-tbody');
  if (!list.length) { tbody.innerHTML = emptyRow(8, 'No notifications found'); return; }

  const typeColors = {
    follow: 'badge-blue', like: 'badge-red', comment: 'badge-purple',
    sale: 'badge-green', listing: 'badge-amber', portfolio: 'badge-purple',
    event: 'badge-amber', message: 'badge-blue', verification: 'badge-green'
  };
  const typeIcons = {
    follow: '👤', like: '❤️', comment: '💬', sale: '💰',
    listing: '🛍', portfolio: '🖼', event: '📅', message: '✉️', verification: '✅'
  };

  tbody.innerHTML = list.slice(0, 200).map((n, i) => `
    <tr>
      <td style="color:var(--gray)">${i + 1}</td>
      <td><span class="badge ${typeColors[n.type] || 'badge-gray'}">${typeIcons[n.type] || '🔔'} ${esc(n.type || '—')}</span></td>
      <td style="font-weight:500;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(n.title || '—')}</td>
      <td style="color:var(--gray);font-size:12px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(n.userId || '—')}</td>
      <td style="color:var(--gray);font-size:12px">${esc(n.fromUserName || '—')}</td>
      <td>${n.read ? '<span class="badge badge-green">Read</span>' : '<span class="badge badge-amber">Unread</span>'}</td>
      <td style="color:var(--gray);white-space:nowrap">${ts(n.createdAt)}</td>
      <td>
        <button class="btn-ghost btn-icon-del" onclick="deleteDoc('notifications','${safeJsStr(n.id)}','notification')" title="Delete">🗑</button>
      </td>
    </tr>`).join('');
}
