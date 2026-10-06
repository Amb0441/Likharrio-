'use strict';

function openModal(title, content) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = content;
  document.getElementById('modal').classList.add('open');
}

window.closeModal = function(e) {
  if (e.target === document.getElementById('modal')) closeModalForce();
};
window.closeModalForce = function() {
  document.getElementById('modal').classList.remove('open');
};
