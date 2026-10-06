'use strict';

function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

function sanitizeUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'ftp:') {
      return url;
    }
    return '';
  } catch { return ''; }
}

function safeJsStr(s) {
  if (!s) return '';
  return String(s).replace(/['\\]/g, '');
}

function handleError(err, context = 'perform this action') {
  console.error(`${context} failed:`, err);
  toast(`Failed to ${context}. Please try again.`, 'error');
}

function initials(s) {
  if (!s) return '?';
  const parts = s.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.substring(0, 2).toUpperCase();
}

function ts(t) {
  if (!t) return '—';
  try {
    const date = t.toDate ? t.toDate() : new Date(t);
    const now = new Date();
    const diff = now - date;
    const s = Math.floor(diff / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const dy = Math.floor(h / 24);
    if (s < 60) return 'just now';
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    if (dy < 30) return `${dy}d ago`;
    return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return '—'; }
}

function emptyRow(cols, msg) {
  return `<tr><td colspan="${cols}" class="t-empty">${msg}</td></tr>`;
}

function roleBadge(role) {
  const map = {
    admin: 'badge-red',
    artist: 'badge-blue',
    enthusiast: 'badge-green',
  };
  return `<span class="badge ${map[role] || 'badge-gray'}">${esc(role || 'user')}</span>`;
}

function artistStatusBadge(artistStatus, isVerified) {
  if (isVerified || artistStatus === 'approved') return '<span class="badge badge-green">Verified ✓</span>';
  if (artistStatus === 'pending') return '<span class="badge badge-amber">Pending Review</span>';
  if (artistStatus === 'rejected') return '<span class="badge badge-red">Rejected</span>';
  if (artistStatus === 'unsubmitted') return '<span class="badge badge-gray">Not Submitted</span>';
  return '<span class="badge badge-gray">—</span>';
}

function updateBadge(page, count) {
  const el = document.getElementById(`badge-${page}`);
  if (el) el.textContent = count > 0 ? count : '';
}
