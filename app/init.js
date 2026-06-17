/* =====================================================
   app/init.js — Inicialização do ERP (DOMContentLoaded)
   ===================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  if (!$('ep-dashboard')) return;

  if (window._localMode) {
    const emailEl = $('user-email');
    if (emailEl) { emailEl.textContent = '🧪 Modo Local'; emailEl.style.color = '#F59E0B'; }
    window._tenant = await Tenants.getByOwner();
  } else if (window._sbClient) {
    try {
      const session = await SBAuth.getSession();
      if (!session) { window.location.replace('login.html'); return; }
      const emailEl = $('user-email');
      if (emailEl && session.user?.email) emailEl.textContent = session.user.email;
      window._userId = session.user?.id || null;

      const tenant = await Tenants.getByOwner();
      if (!tenant) { window.location.replace('onboarding.html'); return; }
      window._tenant = tenant;

      /* Bloqueio por biometria (desbloqueio local — ver app/biometria.js) */
      if (window._userId && typeof isBioEnrolled === 'function' && isBioEnrolled(window._userId)) {
        await showBioLock();
      }
    } catch(e) {
      console.warn('[auth check]', e.message);
    }
  }


  if (window._tenant?.nome) {
    const nome = window._tenant.nome;
    if ($('erp-workspace-name'))  $('erp-workspace-name').textContent  = nome;
    if ($('ext-popup-label'))     $('ext-popup-label').textContent     = 'Shorti · ' + nome;
    if ($('ext-doc-tenant-name')) $('ext-doc-tenant-name').textContent = nome;
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

  /* Mobile: rola o campo focado para o centro para não ficar atrás do teclado */
  document.addEventListener('focusin', e => {
    const el = e.target;
    if (!el.matches?.('input, textarea, select')) return;
    const box = el.closest('.modal-box');
    if (!box) return;
    setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
  });
});
