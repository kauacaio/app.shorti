/* =====================================================
   app/init.js — Inicialização do ERP (DOMContentLoaded)
   ===================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  if (!$('ep-dashboard')) return;

  if (window._localMode) {
    const emailEl = $('user-email');
    if (emailEl) { emailEl.textContent = '🧪 Modo Local'; emailEl.style.color = '#F59E0B'; }
  } else if (window._sbClient) {
    try {
      const session = await SBAuth.getSession();
      if (!session) { window.location.replace('login.html'); return; }
      const emailEl = $('user-email');
      if (emailEl && session.user?.email) emailEl.textContent = session.user.email;
    } catch(e) {
      console.warn('[auth check]', e.message);
    }
  }

  $('erp').style.display = 'flex';
  if ($('tr-dt')) $('tr-dt').value = td();

  await initDB();
  renderAll();
  showExtPopup();

  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) closeMod(m.id); });
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = document.querySelector('.modal.on');
    if (open) closeMod(open.id);
  });
});
