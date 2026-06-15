/* =====================================================
   app/vendas.js — Nova Venda (wizard), Modal MV,
   carrinho, pagamento, cupom fiscal, success screen
   ===================================================== */

let _nvCart = [];
let _mvCart = [];

/* ══════════════════════════════════════════════════════
   NOVA VENDA — WIZARD 3 ETAPAS
   ══════════════════════════════════════════════════════ */
let _nvStep = 1;
let _nvQuick = false;
let _nvForceLeave = false;

/* Verifica se há uma venda em andamento na tela Nova Venda */
function nvHasProgress() {
  if (_nvForceLeave) return false;
  if (!document.getElementById('ep-nvenda')?.classList.contains('on')) return false;
  return _nvCart.length > 0 || !!$('vc')?.value || _nvStep > 1;
}

/* Pergunta antes de saír da Nova Venda com dados não salvos */
function nvConfirmLeave(proceed) {
  askConfirm({
    title: 'Saír da venda?',
    msg: 'Você tem uma venda em andamento. Se saír agora, o cliente e os produtos selecionados serão perdidos.',
    type: 'danger',
    btnLabel: 'Saír sem salvar',
    altLabel: 'Continuar venda',
    onAlt: () => {},
  }, () => {
    _nvForceLeave = true;
    proceed();
    _nvForceLeave = false;
  });
}

function setQuickSaleMode(active) {
  _nvQuick = !!active;
  const labels = [
    { id: 'nv-ind-1', text: active ? 'Produto' : 'Cliente' },
    { id: 'nv-ind-2', text: active ? 'Cliente' : 'Produtos' },
    { id: 'nv-ind-3', text: 'Pagamento' },
  ];
  labels.forEach(item => {
    const el = $(item.id);
    if (el) {
      const span = el.querySelector('span');
      if (span) span.textContent = item.text;
    }
  });
  const btnS1 = $('nv-btn-s1');
  if (btnS1) {
    btnS1.innerHTML = active
      ? `Continuar com cliente
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`
      : `Continuar com produtos
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
  }
}

function nvGoStep(step) {
  if (step > _nvStep) {
    if (_nvStep === 1) {
      if (_nvQuick) {
        if (!_nvCart.length) { showToast('Adicione ao menos um produto'); return; }
      } else {
        if (!$('vc')?.value) { showToast('Selecione um cliente para continuar'); return; }
      }
    }
    if (_nvStep === 2) {
      if (_nvQuick) {
        if (!$('vc')?.value) { showToast('Selecione um cliente para continuar'); return; }
      } else {
        if (!_nvCart.length) { showToast('Adicione ao menos um produto'); return; }
      }
    }
  }

  _nvStep = step;
  const panelStep = _nvQuick ? (step === 1 ? 2 : step === 2 ? 1 : 3) : step;

  [1,2,3].forEach(n => {
    const p = $(`nv-s${n}`);
    if (p) p.classList.toggle('on', n === panelStep);
  });

  [1,2,3].forEach(n => {
    const ind = $(`nv-ind-${n}`);
    if (!ind) return;
    ind.classList.toggle('active', n === step);
    ind.classList.toggle('done',   n < step);
  });
  [1,2].forEach(n => {
    const ln = $(`nv-line-${n}`);
    if (ln) ln.classList.toggle('done', n < step);
  });

  const lbl = $('nv-step-label');
  if (lbl) {
    const labels = _nvQuick
      ? { 1: 'Produto', 2: 'Cliente', 3: 'Pagamento' }
      : { 1: 'Cliente', 2: 'Produtos', 3: 'Pagamento' };
    lbl.textContent = labels[step];
  }

  if (step === 3) nvBuildSummary();

  const ec = document.querySelector('.erp-content');
  if (ec) ec.scrollTop = 0;
}

function nvBuildSummary() {
  const cid  = parseInt($('vc')?.value) || 0;
  const cli  = DB.clis.find(x => x.id === cid);
  const tot  = _nvCart.reduce((a,b) => a+b.sub, 0);
  const parc = parseInt($('vparc')?.value) || 1;

  if ($('vt-r')) $('vt-r').textContent = brl(tot);
  if ($('vt'))   $('vt').textContent   = brl(tot);
  if ($('vt-sub')) $('vt-sub').textContent = parc > 1 ? `${parc}× de ${brl(tot/parc)}` : '';

  const ini = esc(cli ? cli.nm.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase() : '?');
  let html = `<div class="nv-res-cli">
    <div class="cli-ava" style="width:34px;height:34px;font-size:12px">${ini}</div>
    <div>
      <div style="font-size:13.5px;font-weight:600;color:var(--tx)">${esc(cli?.nm||'—')}</div>
      <div style="font-size:11.5px;color:var(--tx-m)">${esc(cli?.tel||'')}</div>
    </div>
  </div>`;

  html += _nvCart.map(i => `
    <div class="nv-res-item">
      <span class="nv-res-nm">${esc(i.em||'')} ${esc(i.nm)} ×${i.q}</span>
      <span class="nv-res-val">${brl(i.sub)}</span>
    </div>`).join('');

  if ($('nv-resumo-body')) $('nv-resumo-body').innerHTML = html;

  const ts2 = $('nv-total-s2');
  if (ts2) ts2.style.display = _nvCart.length ? 'flex' : 'none';
}

/* ── Client picker ── */
function renderCliPicker() {
  const el    = $('cli-picker');
  if (!el) return;
  const busca = ($('nv-cli-busca')?.value || '').toLowerCase().trim();
  const selId = parseInt($('vc')?.value) || 0;
  let clis = DB.clis;
  if (busca) clis = clis.filter(c =>
    c.nm.toLowerCase().includes(busca) ||
    (c.tel||'').includes(busca) ||
    (c.em||'').toLowerCase().includes(busca)
  );

  if (!clis.length) {
    el.innerHTML = `<div class="cli-empty">Nenhum cliente encontrado.<br><a href="#" onclick="newCli()" style="color:var(--gl)">+ Criar novo cliente</a></div>`;
    return;
  }

  const checkSvg = `<svg class="cli-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

  el.innerHTML = clis.map(c => {
    const ini = esc(c.nm.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase());
    const sel = c.id === selId ? ' sel' : '';
    const meta = esc([c.tel, c.em].filter(Boolean)[0] || 'Sem contato');
    return `<div class="cli-row${sel}" onclick="selectCliWiz(${c.id})">
      <div class="cli-ava">${ini}</div>
      <div class="cli-info">
        <div class="cli-nm">${esc(c.nm)}</div>
        <div class="cli-meta">${meta}</div>
      </div>
      ${checkSvg}
    </div>`;
  }).join('');
}

function selectCliWiz(id) {
  if ($('vc')) $('vc').value = id;
  renderCliPicker();
}

/* ── Product picker para Nova Venda ── */
function renderProdPicker() {
  const el  = $('prod-picker');
  if (!el) return;
  const busca = ($('v-busca')?.value || '').toLowerCase().trim();
  let prods = DB.prods;
  if (busca) prods = prods.filter(p =>
    p.nm.toLowerCase().includes(busca) ||
    (p.em || '').includes(busca) ||
    (p.bc || '').includes(busca)
  );

  if (!prods.length) {
    el.innerHTML = `<div class="pp-empty">Nenhum produto encontrado</div>`;
    return;
  }

  const selectedId = parseInt($('vp')?.value) || 0;
  el.innerHTML = prods.map(p => {
    const preco = p.pd ?? p.pr;
    const sel   = p.id === selectedId ? ' pp-card-sel' : '';
    const stCls = p.st === 0 ? 'xb-red' : p.st <= 3 ? 'xb-gold' : 'xb-green';
    return `<div class="pp-card${sel}" onclick="selectProd(${p.id})" title="${esc(p.nm)}">
      <svg class="pp-check" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      <div class="pp-thumb">${p.img ? `<img src="${esc(p.img)}" onerror="this.outerHTML='${esc(p.em||'📦')}'">` : (p.em||'📦')}</div>
      <div class="pp-info">
        <div class="pp-nm">${esc(p.nm)}</div>
        <div class="pp-pr">${brl(preco)}${p.pd?'<span class="pp-promo"> 🏷</span>':''}</div>
      </div>
      <span class="xb ${stCls} pp-st">${p.st}</span>
    </div>`;
  }).join('');
}

function selectProd(id) {
  const vp = $('vp');
  if (vp) { vp.value = id; vUpd(); }
  renderProdPicker();
  if ($('v-busca')) $('v-busca').value = '';
  if ($('vq'))      $('vq').value = 1;
}

function rNV() {
  setQuickSaleMode(false);
  const vc = $('vc'), vp = $('vp');
  if (vc) vc.innerHTML =
    `<option value="">—</option>` +
    DB.clis.map(c => `<option value="${c.id}">${esc(c.nm)}</option>`).join('');
  if (vp) vp.innerHTML =
    `<option value="">—</option>` +
    DB.prods.map(p => `<option value="${p.id}">${esc(p.em)} ${esc(p.nm)}</option>`).join('');

  _nvStep = 1;
  nvGoStep(1);
  if ($('nv-cli-busca')) $('nv-cli-busca').value = '';
  if ($('v-busca'))      $('v-busca').value = '';
  renderCliPicker();
  renderProdPicker();

  const prev = $('vprev'); if (prev) prev.style.display = 'none';
  if ($('vdtpag')) $('vdtpag').value = td();
  _nvCart = [];
  nvRenderCart();
  const vhj = $('vhj');
  if (vhj) {
    const hoje = DB.peds.filter(p => p.dt === td()).reverse();
    if (!hoje.length) {
      vhj.innerHTML = '<p class="small-note">Nenhuma venda hoje.</p>';
    } else {
      vhj.innerHTML = hoje.map(p => {
        const c = DB.clis.find(x => x.id === p.cid);
        const itensStr = esc(p.itens ? p.itens.map(i => `${i.em || ''} ${i.nm} ×${i.q}`).join(', ') : `${p.prod} ×${p.q}`);
        return `<div class="history-item"><strong>#${p.id}</strong> · ${c ? esc(c.nm) : '—'}<br>${itensStr} · ${brl(p.tot)}</div>`;
      }).join('');
    }
  }
}

/* ── Carrinho Nova Venda ─────────────────────────── */
function nvAddItem() {
  const pid = parseInt($('vp')?.value);
  const q   = parseInt($('vq')?.value) || 1;
  if (!pid || !q) return;
  const p = DB.prods.find(x => x.id === pid);
  if (!p) return;
  if (p.st === 0) { showToast(`⚠ ${p.nm} está sem estoque`); return; }
  const ex = _nvCart.find(x => x.pid === pid);
  const preco = p.pd ?? p.pr;
  if (ex) { ex.q += q; ex.sub = ex.pr * ex.q; }
  else _nvCart.push({ pid, nm: p.nm, em: p.em || '', q, pr: preco, sub: preco * q });
  if ($('vq')) $('vq').value = 1;
  vUpd();
  nvRenderCart();
  const btn = document.querySelector('.nv-add-btn');
  if (btn) { btn.textContent = '✓ Adicionado!'; setTimeout(() => { btn.textContent = '＋ Adicionar produto ao pedido'; }, 900); }

  /* Fecha a prévia do produto e desmarca a seleção */
  const prev = $('vprev'); if (prev) prev.style.display = 'none';
  if ($('vp')) $('vp').value = '';
  renderProdPicker();
}

function nvRemItem(pid) {
  _nvCart = _nvCart.filter(x => x.pid !== pid);
  nvRenderCart();
}

function nvRenderCart() {
  const el = $('nv-cart');
  if (!el) return;
  const empty = $('nv-cart-empty');
  if (empty) empty.style.display = _nvCart.length ? 'none' : 'flex';
  const btnS2 = $('nv-btn-s2');
  if (btnS2) btnS2.classList.toggle('btn-success', _nvCart.length > 0);
  if (!_nvCart.length) {
    el.innerHTML = '';
    if ($('vt')) $('vt').textContent = 'R$ 0,00';
    if ($('vt-sub')) $('vt-sub').textContent = '';
    return;
  }
  el.innerHTML = _nvCart.map(i => `
    <div class="nv-cart-item">
      <div class="nv-cart-thumb">${esc(i.em || '📦')}</div>
      <div class="nv-cart-body">
        <div class="nv-cart-nm">${esc(i.nm)}</div>
        <div class="nv-cart-meta">${i.q}× · ${brl(i.pr)} cada</div>
      </div>
      <div class="nv-cart-right">
        <span class="nv-cart-pr">${brl(i.sub)}</span>
        <button class="nv-cart-rm" onclick="nvRemItem(${i.pid})" type="button">✕</button>
      </div>
    </div>`).join('');
  const tot  = _nvCart.reduce((a, b) => a + b.sub, 0);
  const parc = parseInt($('vparc')?.value) || 1;
  if ($('vt'))    $('vt').textContent    = brl(tot);
  if ($('vt-r'))  $('vt-r').textContent  = brl(tot);
  if ($('vt-sub')) $('vt-sub').textContent = parc > 1 ? `${parc}× de ${brl(tot/parc)}` : '';
  const ts2 = $('nv-total-s2');
  if (ts2) ts2.style.display = _nvCart.length ? 'flex' : 'none';
}

/* ── Carrinho Modal mv ───────────────────────────── */
function mvAddItem() {
  const pid = parseInt($('mvp')?.value);
  const q   = parseInt($('mvq')?.value) || 1;
  if (!pid || !q) return;
  const p = DB.prods.find(x => x.id === pid);
  if (!p) return;
  if (p.st === 0) { showToast(`⚠ ${p.nm} está sem estoque`); return; }
  const ex = _mvCart.find(x => x.pid === pid);
  const mpreco = p.pd ?? p.pr;
  if (ex) { ex.q += q; ex.sub = ex.pr * ex.q; }
  else _mvCart.push({ pid, nm: p.nm, em: p.em || '', q, pr: mpreco, sub: mpreco * q });
  if ($('mvq')) $('mvq').value = 1;
  mvRenderCart();
}

function mvRemItem(pid) {
  _mvCart = _mvCart.filter(x => x.pid !== pid);
  mvRenderCart();
}

function mvRenderCart() {
  const el = $('mv-cart');
  if (!el) return;
  if (!_mvCart.length) { el.innerHTML = ''; if ($('mvt')) $('mvt').textContent = 'R$ 0,00'; return; }
  el.innerHTML = _mvCart.map(i => `
    <div class="nv-cart-item">
      <div class="nv-cart-body">
        <div class="nv-cart-nm">${esc(i.em)} ${esc(i.nm)}</div>
        <div class="nv-cart-meta">${i.q}× · ${brl(i.pr)} cada</div>
      </div>
      <div class="nv-cart-right">
        <span class="nv-cart-pr">${brl(i.sub)}</span>
        <button class="nv-cart-rm" onclick="mvRemItem(${i.pid})" type="button">✕</button>
      </div>
    </div>`).join('');
  const tot = _mvCart.reduce((a, b) => a + b.sub, 0);
  if ($('mvt')) $('mvt').textContent = brl(tot);
}

function vUpd() {
  const p = DB.prods.find(x => x.id === parseInt($('vp')?.value));
  const prev = $('vprev');
  if (!prev) return;
  if (!p) { prev.style.display = 'none'; return; }
  prev.style.display = 'flex';
  const img = $('vprev-img');
  if (img) { img.src = p.img || ''; img.style.display = p.img ? 'block' : 'none'; }
  const em = $('vprev-em');
  if (em) em.textContent = p.img ? '' : (p.em || '📦');
  if ($('vprev-nm')) $('vprev-nm').textContent = p.nm;
  if ($('vprev-pr')) $('vprev-pr').textContent = brl(p.pd || p.pr);
  const stEl = $('vprev-st');
  if (stEl) {
    stEl.textContent = p.st > 0 ? `${p.st} em estoque` : 'Esgotado';
    stEl.style.color = p.st > 5 ? '#16A34A' : p.st > 0 ? '#D97706' : '#DC2626';
  }
}

async function saveV() {
  if (!_nvCart.length) { showToast('Adicione ao menos um produto'); return; }
  const cid  = parseInt($('vc')?.value);
  const pag  = $('vpg')?.value;
  const parc = parseInt($('vparc')?.value) || 1;
  const dtpag = $('vdtpag')?.value || td();
  const c = DB.clis.find(x => x.id === cid);
  if (!c) { showToast('Selecione um cliente'); return; }
  const tot  = _nvCart.reduce((a, b) => a + b.sub, 0);
  const id   = await nextId('ped');
  const pagLabel = parc > 1 ? `${pag} ${parc}×` : pag;
  const isPending = dtpag > td();
  const itens = _nvCart.map(i => ({ pid: i.pid, nm: i.nm, em: i.em, q: i.q, pr: i.pr, sub: i.sub }));
  const prodLabel = itens.length === 1 ? itens[0].nm : `${itens.length} produtos`;
  const isFiado = pag === 'Fiado';
  const ped = { id, cid, itens, prod: prodLabel, q: itens.reduce((a,b)=>a+b.q,0), tot, pag: pagLabel, parc, dtpag, st: isFiado ? 'Pendente' : (isPending ? 'Pendente' : 'Confirmado'), dt: td() };
  DB.peds.push(ped);
  c.gasto += tot;
  c.ult = td();
  if (!isFiado) {
    const tr = { id: await nextId('t'), tp: 'receita', ds: `Pedido #${id}`, vl: tot, dt: dtpag };
    DB.trans.push(tr);
    sbSync(() => SBTrans.upsert(tr));
  }
  itens.forEach(item => {
    const p = DB.prods.find(x => x.id === item.pid);
    if (p) { p.st = Math.max(0, p.st - item.q); sbSync(() => SBProds.updateStock(item.pid, p.st)); }
  });
  sbSync(() => SBPeds.upsert(ped));
  sbSync(() => SBClis.update(cid, { gasto: c.gasto, ult: c.ult }));
  _nvCart = [];
  nvRenderCart();
  setQuickSaleMode(false);
  renderAll();
  rReceber();
  showSaleSuccess(ped, c, tot, parc);
}

/* ══════════════════════════════════════════════════════
   ANIMAÇÃO DE SUCESSO — VENDA REGISTRADA
   ══════════════════════════════════════════════════════ */
let _lastSalePed = null, _lastSaleCli = null;

function showSaleSuccess(ped, cli, tot, parc) {
  _lastSalePed = ped;
  _lastSaleCli = cli;

  playBeep('sale');
  const el = $('sale-success');
  if (!el) { showCupom(ped, cli, null); return; }

  const nm  = $('ss-client');
  const amt = $('ss-total');
  const sub = $('ss-sub');
  if (nm)  nm.textContent  = cli?.nm || '—';
  if (amt) amt.textContent = brl(tot);
  if (sub) sub.textContent = parc > 1 ? `${parc}× de ${brl(tot/parc)}` : '';

  el.querySelectorAll('.ss-coin,.ss-vault,.ss-ring,.ss-particle,.ss-check-badge').forEach(e => {
    e.style.animation = 'none'; void e.offsetWidth; e.style.animation = '';
  });

  el.classList.add('on');
  document.body.style.overflow = 'hidden';
}

function closeSaleSuccess() {
  const el = $('sale-success');
  if (el) el.classList.remove('on');
  document.body.style.overflow = '';
}

function ssCupom() {
  closeSaleSuccess();
  if (_lastSalePed && _lastSaleCli) showCupom(_lastSalePed, _lastSaleCli, null);
}

function ssNovaVenda() {
  closeSaleSuccess();
  _nvCart = [];
  rNV();
  if (window.innerWidth <= 768) mobNav('nvenda');
}

function mvUpd() {
  const p = DB.prods.find(x => x.id === parseInt($('mvp')?.value));
  const prev = $('mvprev');
  if (!prev) return;
  if (!p) { prev.classList.remove('on'); return; }
  prev.classList.add('on');
  const img = $('mvprev-img');
  if (img) { img.src = p.img || ''; img.style.display = p.img ? 'block' : 'none'; }
  if ($('mvprev-nm')) $('mvprev-nm').textContent = p.nm;
  if ($('mvprev-meta')) $('mvprev-meta').textContent = `${brl(p.pd || p.pr)} · ${p.st > 0 ? p.st + ' em estoque' : 'Esgotado'}`;
}

function adjVq(d) {
  const el = $('vq');
  if (!el) return;
  el.value = Math.max(1, (parseInt(el.value) || 1) + d);
  vUpd();
}
function selPay(btn, val) {
  if ($('vpg')) $('vpg').value = val;
  btn.closest('.pay-chips').querySelectorAll('.pay-chip').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  const ps = $('vparc-section');
  if (ps) {
    ps.classList.toggle('on', val === 'Cartão de Crédito');
    if (val !== 'Cartão de Crédito') {
      if ($('vparc')) $('vparc').value = '1';
      ps.querySelectorAll('.pay-chip').forEach((b, i) => b.classList.toggle('on', i === 0));
    }
  }
  nvRenderCart();
}
function selParc(btn, val) {
  if ($('vparc')) $('vparc').value = val;
  btn.closest('.pay-chips').querySelectorAll('.pay-chip').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  nvRenderCart();
}
function selMvParc(btn, val) {
  if ($('mvparc')) $('mvparc').value = val;
  btn.closest('.pay-chips').querySelectorAll('.pay-chip').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
}
function mvPayChg(val) {
  const ps = $('mvparc-section');
  if (!ps) return;
  ps.classList.toggle('on', val === 'Cartão de Crédito');
  if (val !== 'Cartão de Crédito') {
    if ($('mvparc')) $('mvparc').value = '1';
    ps.querySelectorAll('.pay-chip').forEach((b, i) => b.classList.toggle('on', i === 0));
  }
}
function selMvPay(btn, val) {
  if ($('mvpg')) $('mvpg').value = val;
  btn.closest('.pay-chips').querySelectorAll('.pay-chip').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  mvPayChg(val);
}
function selTrTp(btn, val) {
  if ($('tr-tp')) $('tr-tp').value = val;
  btn.closest('.pay-chips').querySelectorAll('.pay-chip').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
}

async function saveMV() {
  if (!_mvCart.length) { showToast('Adicione ao menos um produto'); return; }
  const cid   = parseInt($('mvc')?.value);
  const pag   = $('mvpg')?.value;
  const parc  = parseInt($('mvparc')?.value) || 1;
  const dtpag = $('mvdtpag')?.value || td();
  const c = DB.clis.find(x => x.id === cid);
  if (!c) { showToast('Selecione um cliente'); return; }
  const tot       = _mvCart.reduce((a, b) => a + b.sub, 0);
  const id        = await nextId('ped');
  const pagLabel  = parc > 1 ? `${pag} ${parc}×` : pag;
  const isPending = dtpag > td();
  const itens     = _mvCart.map(i => ({ pid: i.pid, nm: i.nm, em: i.em, q: i.q, pr: i.pr, sub: i.sub }));
  const prodLabel = itens.length === 1 ? itens[0].nm : `${itens.length} produtos`;
  const isFiado = pag === 'Fiado';
  const mped = { id, cid, itens, prod: prodLabel, q: itens.reduce((a,b)=>a+b.q,0), tot, pag: pagLabel, parc, dtpag, st: isFiado ? 'Pendente' : (isPending ? 'Pendente' : 'Confirmado'), dt: td() };
  DB.peds.push(mped);
  c.gasto += tot;
  c.ult = td();
  if (!isFiado) {
    const mtr = { id: await nextId('t'), tp: 'receita', ds: `Pedido #${id}`, vl: tot, dt: dtpag };
    DB.trans.push(mtr);
    sbSync(() => SBTrans.upsert(mtr));
  }
  itens.forEach(item => {
    const p = DB.prods.find(x => x.id === item.pid);
    if (p) { p.st = Math.max(0, p.st - item.q); sbSync(() => SBProds.updateStock(item.pid, p.st)); }
  });
  sbSync(() => SBPeds.upsert(mped));
  sbSync(() => SBClis.update(cid, { gasto: c.gasto, ult: c.ult }));
  _mvCart = [];
  renderAll();
  rReceber();
  closeMod('mv');
  showToast(`Pedido #${id} criado — ${brl(tot)}${parc > 1 ? ` · ${parc}× de ${brl(tot/parc)}` : ''}`);
  showCupom(mped, c, null);
}

/* ── Cupom Fiscal ────────────────────────────────── */
let _cupomPed = null, _cupomCli = null, _cupomProd = null, _cupomPixPayload = '';

function showCupom(ped, cli, prod) {
  _cupomPed = ped; _cupomCli = cli; _cupomProd = prod;
  const inner = $('cupom-inner');
  if (!inner) return;

  const now    = new Date();
  const hora   = now.toTimeString().slice(0,5);
  const numPed = String(ped.id).padStart(6, '0');
  const dtpagFmt = fdt(ped.dtpag || ped.dt);
  const isPending = ped.dtpag && ped.dtpag > td();
  const wRaw = (DB.settings?.whatsapp || '').replace(/\D/g, '');
  const wFmt = wRaw.length >= 11
    ? `(${wRaw.slice(0,2)}) ${wRaw.slice(2,7)}-${wRaw.slice(7)}`
    : wRaw;

  const itensHtml = ped.itens && ped.itens.length
    ? ped.itens.map((i, idx) => `
        <div class="cpt-item">
          <div class="cpt-item-nm">${i.em ? esc(i.em) + ' ' : ''}${esc(i.nm)}</div>
          <div class="cpt-item-det">
            <span>${i.q} un × ${brl(i.pr)}</span>
            <span class="cpt-item-sub">${brl(i.sub)}</span>
          </div>
        </div>${idx < ped.itens.length - 1 ? '<div class="cpt-sep-thin"></div>' : ''}`).join('')
    : `<div class="cpt-item">
        <div class="cpt-item-nm">${esc(ped.prod)}</div>
        <div class="cpt-item-det">
          <span>${ped.q} un${prod?.pr ? ' × ' + brl(prod.pr) : ''}</span>
          <span class="cpt-item-sub">${brl(ped.tot)}</span>
        </div>
      </div>`;

  const parcHtml = ped.parc > 1
    ? `<div class="cpt-row"><span>Parcelas</span><span>${ped.parc}× de ${brl(ped.tot / ped.parc)}</span></div>` : '';

  /* ── Pix: QR code + carnê de pagamento (se houver chave configurada) ── */
  const pixKey = (DB.settings?.pix || '').trim();
  let pixHtml = '';
  _cupomPixPayload = '';
  if (pixKey) {
    if (ped.parc > 1) {
      const parcVal = ped.tot / ped.parc;
      _cupomPixPayload = buildPixPayload(pixKey, parcVal, `PED${numPed}P1`);
      const baseDt = ped.dtpag || ped.dt;
      const logoSvg = `<svg viewBox="0 0 22 22" fill="none" width="10" height="10">
              <rect x="3"  y="13" width="4" height="6"  rx="1.5" fill="white" opacity=".55"/>
              <rect x="9"  y="8"  width="4" height="11" rx="1.5" fill="white" opacity=".78"/>
              <rect x="15" y="3"  width="4" height="16" rx="1.5" fill="white"/>
            </svg>`;
      const carneHtml = Array.from({ length: ped.parc }, (_, i) => `
      <div class="cpt-carne-item">
        ${i > 0 ? '<div class="cpt-carne-cut">✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>' : ''}
        <div class="cpt-carne-hd">
          <div class="cpt-carne-brand"><span class="cpt-carne-icon">${logoSvg}</span>Shorti.</div>
          <div class="cpt-carne-num">Parcela ${i + 1}/${ped.parc}</div>
        </div>
        <div class="cpt-carne-body">
          <div>
            <div class="cpt-carne-cli">${esc(cli.nm)}</div>
            <div class="cpt-carne-due">Vencimento ${fdt(addDays(baseDt, i * 30))}</div>
          </div>
          <div class="cpt-carne-val">${brl(parcVal)}</div>
        </div>
      </div>`).join('');
      pixHtml = `
    <div class="cpt-sep-dashed"></div>
    <div class="cpt-pix">
      <div class="cpt-itens-hd">PAGAR PARCELA COM PIX</div>
      <div class="cpt-pix-body">
        <div class="cpt-pix-qr"><canvas id="cpt-pix-qr"></canvas><img id="cpt-pix-img" alt="QR Pix" style="display:none"></div>
        <div class="cpt-pix-info">
          <div class="cpt-pix-val">${brl(parcVal)}<span class="cpt-pix-val-sub"> / parcela</span></div>
          <div class="cpt-pix-key">Chave Pix: ${pixKey}</div>
        </div>
      </div>
      <button class="cpt-pix-copy" type="button" onclick="copyPixCode(_cupomPixPayload, this)">📋 Copiar código Pix</button>
    </div>
    <div class="cpt-sep-solid"></div>
    <div class="cpt-doc-hd">
      <span class="cpt-doc-title">CARNÊ DE PAGAMENTO</span>
      <div class="cpt-doc-meta"><span>Pedido Nº ${numPed}</span><span>${ped.parc}× de ${brl(parcVal)}</span></div>
    </div>
    <div class="cpt-carne">${carneHtml}</div>
    <div class="cpt-carne-foot">✂ Recorte cada parcela na linha pontilhada</div>`;
    } else {
      _cupomPixPayload = buildPixPayload(pixKey, ped.tot, `PED${numPed}`);
      pixHtml = `
    <div class="cpt-sep-dashed"></div>
    <div class="cpt-pix">
      <div class="cpt-itens-hd">PAGAR COM PIX</div>
      <div class="cpt-pix-body">
        <div class="cpt-pix-qr"><canvas id="cpt-pix-qr"></canvas><img id="cpt-pix-img" alt="QR Pix" style="display:none"></div>
        <div class="cpt-pix-info">
          <div class="cpt-pix-val">${brl(ped.tot)}</div>
          <div class="cpt-pix-key">Chave Pix: ${pixKey}</div>
        </div>
      </div>
      <button class="cpt-pix-copy" type="button" onclick="copyPixCode(_cupomPixPayload, this)">📋 Copiar código Pix</button>
    </div>`;
    }
  }

  inner.innerHTML = `<div class="cpt-sheet">
    <div class="cpt-header">
      <div class="cpt-logo-row">
        <div class="cpt-logo-icon">
          <svg viewBox="0 0 22 22" fill="none" width="14" height="14">
            <rect x="3"  y="13" width="4" height="6"  rx="1.5" fill="white" opacity=".55"/>
            <rect x="9"  y="8"  width="4" height="11" rx="1.5" fill="white" opacity=".78"/>
            <rect x="15" y="3"  width="4" height="16" rx="1.5" fill="white"/>
          </svg>
        </div>
        <span class="cpt-logo-text">Shorti<span>.</span></span>
      </div>
      <div class="cpt-brand">Milena Lima Beauty</div>
      <div class="cpt-consult">Consultora Oficial Mary Kay</div>
      ${wFmt ? `<div class="cpt-contact">${wFmt}</div>` : ''}
    </div>
    <div class="cpt-sep-solid"></div>
    <div class="cpt-doc-hd">
      <span class="cpt-doc-title">COMPROVANTE DE VENDA</span>
      <div class="cpt-doc-meta">
        <span>Pedido Nº ${numPed}</span>
        <span>${fdt(ped.dt)} ${hora}</span>
      </div>
    </div>
    <div class="cpt-sep-dashed"></div>
    <div class="cpt-cli-row">
      <span class="cpt-field-lbl">CLIENTE</span>
      <span class="cpt-field-val">${esc(cli.nm)}</span>
    </div>
    <div class="cpt-sep-dashed"></div>
    <div class="cpt-itens-hd">ITENS</div>
    ${itensHtml}
    <div class="cpt-sep-dashed"></div>
    <div class="cpt-totais">
      <div class="cpt-row cpt-row-total"><span>TOTAL</span><span>${brl(ped.tot)}</span></div>
    </div>
    <div class="cpt-sep-dashed"></div>
    <div class="cpt-pgto">
      <div class="cpt-row"><span>Pagamento</span><span>${ped.pag}</span></div>
      ${parcHtml}
      <div class="cpt-row"><span>Data de pagamento</span><span>${dtpagFmt}</span></div>
    </div>
    <div class="cpt-sep-solid"></div>
    <div class="cpt-status ${isPending ? 'cpt-status-pend' : 'cpt-status-ok'}">
      ${isPending ? '⏳  AGUARDANDO PAGAMENTO' : '✓  PAGAMENTO CONFIRMADO'}
    </div>
    ${pixHtml}
    <div class="cpt-sep-solid"></div>
    <div class="cpt-footer">
      <div class="cpt-footer-msg">Obrigada pela confiança.</div>
      <div class="cpt-footer-nd">Documento sem valor fiscal</div>
    </div>
  </div>`;

  openMod('cupom');

  if (_cupomPixPayload) {
    renderPixQR($('cpt-pix-qr'), $('cpt-pix-img'), _cupomPixPayload);
  }

  if ($('cupom-btn-carne')) $('cupom-btn-carne').style.display = ped.parc > 1 ? '' : 'none';
}

/* Abre uma janela de impressão com o carnê de pagamento —
   capa com a marca + parcelas em folhas de 3 (economiza papel) */
function printCarne() {
  const ped = _cupomPed, cli = _cupomCli;
  if (!ped || ped.parc <= 1) return;

  const numPed   = String(ped.id).padStart(6, '0');
  const parcVal  = ped.tot / ped.parc;
  const pixKey   = (DB.settings?.pix || '').trim();
  const baseDt   = ped.dtpag || ped.dt;
  const lastDue  = addDays(baseDt, (ped.parc - 1) * 30);
  const logoSvg  = `<svg viewBox="0 0 22 22" fill="none" width="18" height="18">
        <rect x="3"  y="13" width="4" height="6"  rx="1.5" fill="white" opacity=".55"/>
        <rect x="9"  y="8"  width="4" height="11" rx="1.5" fill="white" opacity=".78"/>
        <rect x="15" y="3"  width="4" height="16" rx="1.5" fill="white"/>
      </svg>`;
  const logoSvgSm = `<svg viewBox="0 0 22 22" fill="none" width="13" height="13">
        <rect x="3"  y="13" width="4" height="6"  rx="1.5" fill="white" opacity=".55"/>
        <rect x="9"  y="8"  width="4" height="11" rx="1.5" fill="white" opacity=".78"/>
        <rect x="15" y="3"  width="4" height="16" rx="1.5" fill="white"/>
      </svg>`;

  /* ── Capa ─────────────────────────────────────── */
  const cover = `
  <section class="cn-cover">
    <div class="cn-cover-top">
      <div class="cn-brand"><span class="cn-logo">${logoSvg}</span>Shorti<span class="cn-dot">.</span></div>
      <div class="cn-cover-store">Milena Lima Beauty</div>
      <div class="cn-cover-consult">Consultora Oficial Mary Kay</div>
    </div>
    <div class="cn-cover-body">
      <div class="cn-cover-title">Carnê de<br>Pagamento</div>
      <div class="cn-cover-card">
        <div class="cn-cover-row"><span>Cliente</span><b>${esc(cli.nm)}</b></div>
        <div class="cn-cover-row"><span>Pedido</span><b>Nº ${numPed}</b></div>
        <div class="cn-cover-row"><span>Valor total</span><b>${brl(ped.tot)}</b></div>
        <div class="cn-cover-row"><span>Parcelas</span><b>${ped.parc}× de ${brl(parcVal)}</b></div>
        <div class="cn-cover-row"><span>1ª parcela</span><b>${fdt(baseDt)}</b></div>
        <div class="cn-cover-row"><span>Última parcela</span><b>${fdt(lastDue)}</b></div>
      </div>
      ${pixKey ? `<div class="cn-cover-pix">💗 Pague cada parcela via Pix, usando a chave abaixo, ou em mãos com a consultora.<br><b>Chave Pix:</b> ${pixKey}</div>` : ''}
      <div class="cn-cover-foot">Obrigada pela confiança · Documento sem valor fiscal</div>
    </div>
  </section>`;

  /* ── Canhotos / parcelas — 3 por folha ───────────── */
  const slips = Array.from({ length: ped.parc }, (_, i) => {
    const due = addDays(baseDt, i * 30);
    const payload = pixKey ? buildPixPayload(pixKey, parcVal, `PED${numPed}P${i + 1}`) : '';
    const qrHtml = payload ? `<img class="cn-qr" src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=6&data=${encodeURIComponent(payload)}" alt="QR Pix">` : '';
    return `
      <div class="cn-slip">
        <div class="cn-slip-main">
          <div class="cn-slip-brand"><span class="cn-slip-logo">${logoSvgSm}</span>Shorti<span class="cn-dot">.</span><span class="cn-slip-store">Milena Lima Beauty</span></div>
          <div class="cn-slip-lbl">Cliente</div>
          <div class="cn-slip-cli">${esc(cli.nm)}</div>
          <div class="cn-slip-meta">
            <span>Pedido Nº ${numPed}</span>
            <span>Parcela ${i + 1} de ${ped.parc}</span>
            <span>Vencimento <b>${fdt(due)}</b></span>
          </div>
          <div class="cn-slip-sign">Recebido por _______________________ em ____ /____ /______</div>
        </div>
        <div class="cn-slip-val">
          <div class="cn-slip-val-lbl">Valor</div>
          <div class="cn-slip-val-num">${brl(parcVal)}</div>
          ${qrHtml}
          ${pixKey ? `<div class="cn-slip-pix-lbl">Pague com Pix</div><div class="cn-slip-key">${pixKey}</div>` : ''}
        </div>
      </div>`;
  });

  const CUT = `<div class="cn-cut">✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>`;
  const pages = [];
  for (let i = 0; i < slips.length; i += 3) {
    const group = slips.slice(i, i + 3);
    pages.push(`<section class="cn-page">${group.join(CUT)}</section>`);
  }

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Carnê — Pedido ${numPed}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: 'Inter', system-ui, sans-serif; color: #0F172A; margin: 0; }
  .cn-dot { color: #8FA6F2; }

  /* Capa */
  .cn-cover { page-break-after: always; width: 210mm; height: 297mm; display: flex; flex-direction: column; }
  .cn-cover-top { background: #1B44B8; color: #fff; padding: 26mm 18mm 22mm; }
  .cn-brand { display: flex; align-items: center; gap: 9px; font-size: 22px; font-weight: 800; letter-spacing: -.01em; }
  .cn-logo { width: 32px; height: 32px; border-radius: 8px; background: rgba(255,255,255,.16); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .cn-cover-store { font-size: 15px; font-weight: 700; margin-top: 14px; }
  .cn-cover-consult { font-size: 10.5px; letter-spacing: .2em; text-transform: uppercase; opacity: .75; margin-top: 4px; }
  .cn-cover-body { flex: 1; display: flex; flex-direction: column; padding: 20mm 18mm; }
  .cn-cover-title { font-size: 40px; font-weight: 800; line-height: 1.1; color: #0F172A; margin-bottom: 28px; }
  .cn-cover-card { border: 1px solid #E2E8F0; border-radius: 16px; padding: 22px 24px; }
  .cn-cover-row { display: flex; justify-content: space-between; align-items: baseline; padding: 9px 0; border-bottom: 1px dashed #E2E8F0; font-size: 13.5px; color: #334155; }
  .cn-cover-row:last-child { border-bottom: none; }
  .cn-cover-row span { color: #94A3B8; text-transform: uppercase; font-size: 10px; font-weight: 700; letter-spacing: .12em; }
  .cn-cover-row b { font-weight: 800; font-size: 15px; color: #0F172A; }
  .cn-cover-pix { margin-top: 22px; font-size: 12px; color: #475569; line-height: 1.7; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 14px 16px; }
  .cn-cover-foot { margin-top: auto; text-align: center; font-size: 10px; color: #94A3B8; letter-spacing: .08em; text-transform: uppercase; padding-top: 24px; }

  /* Folhas de parcelas — 3 por página */
  .cn-page { page-break-after: always; width: 210mm; height: 297mm; padding: 14mm 16mm; display: flex; flex-direction: column; }
  .cn-page:last-child { page-break-after: auto; }
  .cn-cut { text-align: center; font-size: 10px; color: #CBD5E1; letter-spacing: .14em; white-space: nowrap; overflow: hidden; flex: 0 0 auto; padding: 4px 0; }
  .cn-slip { flex: 1 1 0; min-height: 0; display: flex; border: 1px solid #E2E8F0; border-radius: 14px; overflow: hidden; }
  .cn-slip-main { flex: 1; min-width: 0; padding: 0 26px; display: flex; flex-direction: column; justify-content: center; gap: 7px; }
  .cn-slip-brand { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 800; color: #1B44B8; }
  .cn-slip-logo { width: 18px; height: 18px; border-radius: 5px; background: #1B44B8; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .cn-slip-store { font-size: 10.5px; font-weight: 600; color: #94A3B8; margin-left: 4px; }
  .cn-slip-lbl { font-size: 9.5px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #94A3B8; margin-top: 8px; }
  .cn-slip-cli { font-size: 20px; font-weight: 800; color: #0F172A; }
  .cn-slip-meta { display: flex; flex-wrap: wrap; gap: 5px 16px; font-size: 11.5px; color: #64748B; }
  .cn-slip-meta b { color: #0F172A; }
  .cn-slip-sign { font-size: 11px; color: #CBD5E1; margin-top: 12px; letter-spacing: .02em; }
  .cn-slip-val { flex: 0 0 170px; background: #F8FAFC; border-left: 1px dashed #CBD5E1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px; padding: 16px; }
  .cn-slip-val-lbl { font-size: 9.5px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #94A3B8; }
  .cn-slip-val-num { font-size: 26px; font-weight: 800; color: #1B44B8; white-space: nowrap; }
  .cn-qr { width: 84px; height: 84px; display: block; }
  .cn-slip-pix-lbl { font-size: 9px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #94A3B8; margin-top: 2px; }
  .cn-slip-key { font-size: 8.5px; color: #94A3B8; word-break: break-all; text-align: center; max-width: 145px; }
</style>
</head><body>${cover}${pages.join('')}</body></html>`;

  const w = window.open('', '_blank');
  if (!w) { showToast('Permita pop-ups para gerar o carnê'); return; }
  w.document.write(html);
  w.document.close();
  w.onload = () => w.print();
}

function whatsappCupom() {
  if (!_cupomPed || !_cupomCli) return;
  const ped = _cupomPed, cli = _cupomCli;
  const parcNote = ped.parc > 1 ? `\n✦ Parcelas: ${ped.parc}× de ${brl(ped.tot / ped.parc)}` : '';
  const dtpagFmt = ped.dtpag ? fdt(ped.dtpag) : fdt(ped.dt);
  const phone = (cli.tel || '').replace(/\D/g,'');
  const prodLines = ped.itens && ped.itens.length
    ? ped.itens.map(i => `   • ${i.em || ''} ${i.nm} ×${i.q} — ${brl(i.sub)}`).join('\n')
    : `   • ${ped.prod} ×${ped.q}`;
  const msg =
    `✨ *Milena Lima Beauty*\n_Consultora Oficial Mary Kay_\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `*Comprovante de Venda · #${String(ped.id).padStart(3,'0')}*\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `👤 *Cliente:* ${cli.nm}\n` +
    `📦 *Produtos:*\n${prodLines}\n` +
    `💰 *Total:* ${brl(ped.tot)}${parcNote}\n` +
    `💳 *Pagamento:* ${ped.pag}\n` +
    `📅 *Data pgto:* ${dtpagFmt}\n\n` +
    `_Obrigada pela sua compra! Qualquer dúvida, estou aqui_ 💗`;
  const num = phone || (DB.settings?.whatsapp || '').replace(/\D/g,'');
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
}

/* Gerar cupom a partir do histórico de vendas */
function gerarCupomPedido(id) {
  const p = DB.peds.find(x => x.id === id);
  if (!p) return;
  const c = DB.clis.find(x => x.id === p.cid);
  showCupom(p, c || { nm: '—', tel: '' }, null);
}

function confirmV() {
  if (!_nvCart.length) { showToast('Adicione ao menos um produto'); return; }
  const cid = parseInt($('vc')?.value);
  const c = DB.clis.find(x => x.id === cid);
  if (!c) { showToast('Selecione um cliente'); return; }
  const tot = _nvCart.reduce((a, b) => a + b.sub, 0);
  const resumo = _nvCart.length === 1 ? esc(_nvCart[0].nm) : `${_nvCart.length} produtos`;
  askConfirm(`Registrar venda de ${brl(tot)} para ${esc(c.nm)}?\n\n${resumo}`, saveV);
}

function confirmMV() {
  if (!_mvCart.length) { showToast('Adicione ao menos um produto'); return; }
  const cid = parseInt($('mvc')?.value);
  const c = DB.clis.find(x => x.id === cid);
  if (!c) { showToast('Selecione um cliente'); return; }
  const tot = _mvCart.reduce((a, b) => a + b.sub, 0);
  const resumo = _mvCart.length === 1 ? esc(_mvCart[0].nm) : `${_mvCart.length} produtos`;
  askConfirm(`Confirmar venda de ${brl(tot)} para ${esc(c.nm)}?\n\n${resumo}`, saveMV);
}
