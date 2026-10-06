'use strict';

function setupNav() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(link.dataset.page);
    });
  });
}

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.page === page);
  });
  document.querySelectorAll('.page').forEach(p => {
    p.classList.toggle('active', p.id === `page-${page}`);
  });
  const titles = {
    dashboard: 'Dashboard', users: 'Users', artists: 'Artists',
    portfolios: 'Portfolios', listings: 'Marketplace Listings',
    events: 'Events', verification: 'Verification Requests',
    reports: 'Reports', settings: 'Settings'
  };
  document.getElementById('page-title').textContent = titles[page] || page;
  document.getElementById('global-search').value = '';
}

window.navigateTo = navigateTo;

window.toggleSidebar = function() {
  document.getElementById('sidebar').style.transform =
    document.getElementById('sidebar').style.transform === 'translateX(0px)' ? '' : 'translateX(0px)';
};
