'use strict';

function renderSettingsCollections() {
  const cols = [
    ['users', Store.users.length],
    ['portfolios', Store.portfolios.length],
    ['listings', Store.listings.length],
    ['events', Store.events.length],
    ['verificationRequests', Store.verifications.length],
    ['reports', Store.reports.length],
  ];
  const el = document.getElementById('settings-collections');
  if (el) el.innerHTML = cols.map(([name, count]) =>
    `<div class="col-row"><span class="col-name">${name}</span><span class="col-count">${count} docs</span></div>`
  ).join('');
}
