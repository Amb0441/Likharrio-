'use strict';

async function loadEvents() {
  const snap = await db.collection('events').orderBy('createdAt', 'desc').get();
  Store.events = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const now = new Date();
  const upcoming = Store.events.filter(ev => {
    const d = ev.date?.toDate ? ev.date.toDate() : ev.eventDate?.toDate ? ev.eventDate.toDate() : null;
    return d && d > now;
  }).length;
  updateBadge('events', Store.events.length);
  document.getElementById('stat-events-count').textContent = Store.events.length;
  document.getElementById('stat-events-upcoming').textContent = `${upcoming} upcoming`;
  renderEvents();
}

function getEventDate(ev) {
  const t = ev.date || ev.eventDate;
  if (!t) return null;
  try { return t.toDate ? t.toDate() : new Date(t); } catch { return null; }
}

function renderEvents() {
  const filterStatus = document.getElementById('filter-event-status')?.value || '';
  const search = document.getElementById('global-search')?.value.toLowerCase() || '';
  const now = new Date();

  let list = Store.events;
  if (filterStatus === 'upcoming') list = list.filter(ev => {
    const d = getEventDate(ev);
    return d && d > now;
  });
  if (filterStatus === 'past') list = list.filter(ev => {
    const d = getEventDate(ev);
    return !d || d <= now;
  });
  if (search) list = list.filter(ev =>
    (ev.title || '').toLowerCase().includes(search) ||
    (ev.organizerEmail || ev.organizerName || '').toLowerCase().includes(search) ||
    (ev.location || ev.locationName || '').toLowerCase().includes(search)
  );

  document.getElementById('events-count').textContent = `${list.length} event${list.length !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('events-tbody');
  if (!list.length) { tbody.innerHTML = emptyRow(7, 'No events found'); return; }

  tbody.innerHTML = list.map((ev, i) => {
    const evDate = getEventDate(ev);
    const isUpcoming = evDate && evDate > now;
    const attendees = ev.attendeesCount || (ev.attendees && ev.attendees.length) || 0;
    return `
    <tr>
      <td style="color:var(--gray)">${i + 1}</td>
      <td><span style="font-weight:500">${esc(ev.title || 'Untitled')}</span></td>
      <td style="color:var(--gray)">${esc(ev.organizerName || ev.organizerEmail || '—')}</td>
      <td style="color:var(--gray)">${esc(ev.location || ev.locationName || '—')}</td>
      <td style="white-space:nowrap">${evDate ? evDate.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
      <td><span class="badge ${isUpcoming ? 'badge-green' : 'badge-gray'}">${isUpcoming ? 'Upcoming' : 'Past'}</span></td>
      <td>
        <button class="btn-ghost" onclick="viewEvent('${safeJsStr(ev.id)}')" title="View">👁</button>
        <button class="btn-ghost btn-icon-del" onclick="deleteDoc('events','${safeJsStr(ev.id)}','event')" title="Delete">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

window.viewEvent = function(id) {
  const ev = Store.events.find(x => x.id === id);
  if (!ev) return;
  const evDate = getEventDate(ev);
  const attendeeList = Array.isArray(ev.attendees) ? ev.attendees : [];
  const attendeeCount = ev.attendeesCount || attendeeList.length || 0;

  function renderAttendeesHTML() {
    if (!attendeeList.length) return '<p style="color:var(--gray);font-size:13px;padding:8px 0">No attendees recorded.</p>';
    return `<div id="attendee-list" style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
      ${attendeeList.map((uid, idx) => {
        const u = Store.users.find(x => x.id === uid || x.uid === uid);
        const name = u ? (u.displayName || u.name || u.email || uid) : uid;
        const email = u ? (u.email || '') : '';
        return `<div id="attendee-row-${idx}" style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:var(--surface2,#f8f8fa);border-radius:8px;gap:8px">
          <div style="display:flex;align-items:center;gap:8px;min-width:0">
            <div class="u-av" style="flex-shrink:0;font-size:11px">${initials(name)}</div>
            <div style="min-width:0">
              <div class="u-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</div>
              ${email ? `<div class="u-sub">${esc(email)}</div>` : `<div class="u-sub" style="font-size:10px">${esc(uid)}</div>`}
            </div>
          </div>
          <button class="btn btn-danger btn-sm" style="flex-shrink:0" onclick="removeAttendee('${safeJsStr(ev.id)}','${safeJsStr(uid)}',${idx})">✕ Remove</button>
        </div>`;
      }).join('')}
    </div>`;
  }

  openModal('Event Details', `
    ${ev.imageUrl ? `<img src="${esc(ev.imageUrl)}" class="detail-img" onerror="this.style.display='none'">` : ''}
    <div class="detail-section">
      <h4>Event Info</h4>
      <div class="detail-row"><span class="detail-key">Title</span><span class="detail-val">${esc(ev.title || 'Untitled')}</span></div>
      <div class="detail-row"><span class="detail-key">Organizer</span><span class="detail-val">${esc(ev.organizerName || ev.organizerEmail || '—')}</span></div>
      <div class="detail-row"><span class="detail-key">Location</span><span class="detail-val">${esc(ev.location || ev.locationName || '—')}</span></div>
      <div class="detail-row"><span class="detail-key">Date</span><span class="detail-val">${evDate ? evDate.toLocaleDateString('en-PH', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) : '—'}</span></div>
      <div class="detail-row"><span class="detail-key">Status</span><span class="detail-val">${evDate && evDate > new Date() ? '<span class="badge badge-green">Upcoming</span>' : '<span class="badge badge-gray">Past</span>'}</span></div>
      <div class="detail-row"><span class="detail-key">Attendees</span><span class="detail-val" id="event-attendee-count-label">👥 ${attendeeCount}</span></div>
      <div class="detail-row"><span class="detail-key">Created</span><span class="detail-val">${ts(ev.createdAt)}</span></div>
    </div>
    ${ev.description ? `<div class="detail-section"><h4>Description</h4><p style="font-size:13px;color:var(--ink2);line-height:1.6">${esc(ev.description)}</p></div>` : ''}
    ${ev.latitude && ev.longitude ? `<div class="detail-section"><h4>Coordinates</h4><div class="detail-row"><span class="detail-key">Lat, Lng</span><span class="detail-val">${ev.latitude}, ${ev.longitude}</span></div></div>` : ''}
    <div class="detail-section">
      <h4>Attendees <span id="attendee-section-count" style="font-weight:400;font-size:12px;color:var(--gray)">(${attendeeList.length})</span></h4>
      <div id="attendee-section-body">${renderAttendeesHTML()}</div>
    </div>
    <div style="margin-top:16px">
      <button class="btn btn-danger btn-sm" onclick="deleteDoc('events','${safeJsStr(ev.id)}','event');closeModalForce()">Delete Event</button>
    </div>`);
};

window.removeAttendee = async function(eventId, uid, idx) {
  const ev = Store.events.find(x => x.id === eventId);
  if (!ev) return;
  const u = Store.users.find(x => x.id === uid || x.uid === uid);
  const label = u ? (u.displayName || u.email || uid) : uid;
  if (!confirm(`Remove "${label}" from this event?`)) return;

  try {
    await db.collection('events').doc(eventId).update({
      attendees: firebase.firestore.FieldValue.arrayRemove(uid),
      attendeesCount: firebase.firestore.FieldValue.increment(-1)
    });

    if (Array.isArray(ev.attendees)) {
      ev.attendees = ev.attendees.filter(a => a !== uid);
    }
    if (typeof ev.attendeesCount === 'number') ev.attendeesCount = Math.max(0, ev.attendeesCount - 1);

    const row = document.getElementById(`attendee-row-${idx}`);
    if (row) {
      row.style.transition = 'opacity 0.25s';
      row.style.opacity = '0';
      setTimeout(() => row.remove(), 260);
    }
    const countLabel = document.getElementById('event-attendee-count-label');
    if (countLabel) countLabel.textContent = `👥 ${ev.attendees ? ev.attendees.length : 0}`;
    const sectionCount = document.getElementById('attendee-section-count');
    if (sectionCount) sectionCount.textContent = `(${ev.attendees ? ev.attendees.length : 0})`;

    toast(`Attendee removed ✓`, 'success');
    renderEvents();
  } catch (err) {
    handleError(err, 'remove attendee');
  }
};
