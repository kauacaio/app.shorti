/* =====================================================
   app/ui.js — Navegação ERP, modais, renderAll, confirm
   ===================================================== */

function closeERP() {
  if (typeof nvHasProgress === 'function' && nvHasProgress()) {
    nvConfirmLeave(() => closeERP());
    return;
  }
  window.location.href = 'index.html';
}

function epage(id, el) {
  /* Pergunta antes de saír de uma venda em andamento */
  if (id !== 'nvenda' && typeof nvHasProgress === 'function' && nvHasProgress()) {
    nvConfirmLeave(() => epage(id, el));
    return;
  }
  /* Para câmera de consulta ao sair da página */
  if (id !== 'consulta' && _cqCamActive) _cqStopCamera();

  document.querySelectorAll('.erp-page').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('on'));
  const pg = $('ep-' + id);
  if (pg) pg.classList.add('on');
  if (el) el.classList.add('on');
  else document.querySelectorAll('.nav-link').forEach(l => { if (l.getAttribute('onclick')?.includes("'" + id + "'")) l.classList.add('on'); });
  const tt = { dashboard: 'Dashboard', receber: 'A Receber', historico: 'Histórico de Vendas', solicita: 'Solicitações', nvenda: 'Nova Venda', estoque: 'Estoque', clientes: 'Clientes', financeiro: 'Financeiro', catalogo: 'Catálogo', extrato: 'Extrato Mensal', relatorios: 'Relatórios', loja: 'Configurar Loja', consulta: 'Consultar Produto' };
  $('etitle').textContent = tt[id] || id;
  if ($('emh-ctx')) $('emh-ctx').textContent = tt[id] || id;
  const mhdr = document.querySelector('.erp-mob-header');
  if (mhdr) mhdr.classList.toggle('is-dash', id === 'dashboard');
  if (id === 'dashboard') rMet();
  if (id === 'financeiro') rFin();
  if (id === 'relatorios') rRel();
  if (id === 'nvenda') rNV();
  if (id === 'estoque')  rEst();
  if (id === 'clientes') rClis();
  if (id === 'catalogo') rKat();
  if (id === 'loja') rLoja();
  if (id === 'receber')  rReceber();
  if (id === 'historico') rHistorico();
  if (id === 'solicita') rSolic();
  if (id === 'extrato')  rExtrato();
  if (id === 'consulta') rCQ();
}

function openMod(id) {
  if (id === 'mv') {
    const s1 = $('mvc'), s2 = $('mvp');
    if (s1) s1.innerHTML = DB.clis.map(c => `<option value="${c.id}">${esc(c.nm)}</option>`).join('');
    if (s2) { s2.innerHTML = DB.prods.map(p => `<option value="${p.id}">${esc(p.em)} ${esc(p.nm)} — ${brl(p.pd ?? p.pr)}${p.pd ? ' 🏷' : ''}</option>`).join(''); mvUpd(); }
    if ($('mvdtpag')) $('mvdtpag').value = td();
    if ($('mvpg')) { $('mvpg').value = 'PIX'; mvPayChg('PIX'); }
    _mvCart = [];
    mvRenderCart();
  }
  if (id === 'mp') {
    const currentId = parseInt($('pe-id')?.value) || 0;
    const pb = $('pe-bump');
    if (pb) pb.innerHTML = '<option value="">Nenhum</option>' +
      DB.prods.filter(p => p.id !== currentId).map(p => `<option value="${p.id}">${esc(p.em)} ${esc(p.nm)}</option>`).join('');
    /* Novo produto: reset title + preview */
    if (!currentId) {
      if ($('mp-title')) $('mp-title').textContent = 'Novo Produto';
      if ($('mp-sub'))   $('mp-sub').textContent   = 'Preencha os dados abaixo';
      if ($('mp-preview-img')) { $('mp-preview-img').style.display = 'none'; $('mp-preview-img').src = ''; }
      if ($('mp-preview-em'))  { $('mp-preview-em').style.display = 'block'; $('mp-preview-em').textContent = '📦'; }
      if ($('mp-img-hint'))    $('mp-img-hint').textContent = '';
    }
    /* Wizard: sempre começa na etapa 1 no mobile */
    mpGoStep(1);
  }
  $(id).classList.add('on');
  document.body.style.overflow = 'hidden';
}

function closeMod(id) {
  $(id).classList.remove('on');
  if (!document.querySelector('.modal.on')) document.body.style.overflow = '';
}

function renderAll() {
  rMet();
  rDashRec();
  rDashLow();
  rReceber();
  rSolic();
  rEst();
  rClis();
  rKat();
  rFin();
  rNV();
  rLoja();
  genAutoNotifs();
  setTimeout(rDashCharts, 50);
}

/* askConfirm — type: 'danger' | 'warn' | 'info' */
function askConfirm(opts, onYes) {
  if (typeof opts === 'string') opts = { title:'Confirmar', msg: opts, type:'info', btnLabel:'Confirmar' };
  const { title='Confirmar', msg='', type='info', btnLabel='Confirmar', altLabel, onAlt } = opts;

  const iconEl  = $('mconf-icon');
  const wrapEl  = $('mconf-icon-wrap');
  const titleEl = $('mconf-title');
  const msgEl   = $('mconf-msg');
  const okBtn   = $('mconf-ok');
  const altBtn  = $('mconf-alt');

  const icons = {
    danger: `<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>`,
    warn:   `<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
    info:   `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`,
  };

  if (iconEl)  iconEl.innerHTML = icons[type] || icons.info;
  if (wrapEl)  wrapEl.className = `mconf-icon-wrap ${type}`;
  if (titleEl) titleEl.textContent = title;
  if (msgEl)   msgEl.innerHTML = msg;

  if (okBtn) {
    okBtn.className = `btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'}`;
    okBtn.textContent = btnLabel;
    okBtn.onclick = () => { closeMod('mconf'); onYes(); };
  }
  /* Botão alternativo (ex: "Fazer venda" junto com "Ver produto") */
  if (altBtn) {
    if (altLabel && typeof onAlt === 'function') {
      altBtn.style.display = '';
      altBtn.textContent = altLabel;
      altBtn.onclick = () => { closeMod('mconf'); onAlt(); };
    } else {
      altBtn.style.display = 'none';
    }
  }
  openMod('mconf');
}

/* Mostra modal quando produto já existe pelo barcode */
function showExistingProductModal(prod) {
  askConfirm({
    title: 'Produto já cadastrado',
    msg:   `<strong>${esc(prod.nm)}</strong> já usa este código de barras.<br>O que deseja fazer?`,
    type:  'warn',
    btnLabel: '✏️ Ver / Editar',
    altLabel: '🛒 Fazer venda',
    onAlt: () => {
      closeMod('mp');
      if (window.innerWidth <= 768) mobNav('nvenda'); else epage('nvenda', null);
      setTimeout(() => {
        const vp = $('vp');
        if (vp) { vp.value = prod.id; vUpd(); }
      }, 200);
    }
  }, () => { closeMod('mp'); editP(prod.id); });
}
