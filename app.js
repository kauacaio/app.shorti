/* =====================================================
   app.js — Dados compartilhados + ERP
   ===================================================== */

const $ = id => document.getElementById(id);
const brl = v => 'R$ ' + (+v).toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+,)/g, '$1.');
const fdt = d => { if (!d) return '—'; const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; };
const td = () => new Date().toISOString().split('T')[0];
const cNm = { pele: 'Skincare', corpo: 'Corpo', maquiagem: 'Maquiagem', fragrancias: 'Fragrâncias' };
const stB = { Pendente: 'xb-gold', Confirmado: 'xb-blue', Enviado: 'xb-gray', Entregue: 'xb-green' };

const DB = {
  prods: [],
  clis:  [],
  peds:  [],
  trans: [],
  cart: [],
  nid: { p: 200, c: 200, ped: 2000, t: 200 },
  settings: {
    banner:    'Frete <em>GRÁTIS</em> em compras acima de R$ 150 · Consultoria personalizada inclusa em cada pedido',
    whatsapp:  '5511999999999',
    heroKicker:'Consultora Oficial Mary Kay',
    heroLines: ['Beleza que', 'transforma.', 'Cuidado que', 'permanece.'],
    heroSub:   'Produtos de alta performance para pele, corpo e bem-estar. Consultoria personalizada, feita para você.',
    heroProof: '+500 clientes · Avaliação 4.9/5',
    marquee:   'Skincare · Maquiagem · Corpo & Banho · Fragrâncias · Autocuidado · Mary Kay · Consultoria ·',
    benefits: [
      { title: 'Entrega para todo o Brasil',  desc: 'Rápido e com rastreamento' },
      { title: 'Parcelamento em até 12x',     desc: 'Sem juros no cartão' },
      { title: '100% Originais Mary Kay',     desc: 'Garantia de autenticidade' },
      { title: 'Consultoria personalizada',   desc: 'Atendimento exclusivo grátis' }
    ]
  }
};

/* ── Configurações persistidas ───────────────────── */
function loadSettings() {
  try {
    const raw = localStorage.getItem('mlb_settings');
    if (!raw) return;
    const saved = JSON.parse(raw);
    const s = DB.settings;
    if (saved.banner    !== undefined) s.banner    = saved.banner;
    if (saved.whatsapp  !== undefined) s.whatsapp  = saved.whatsapp;
    if (saved.heroKicker!== undefined) s.heroKicker= saved.heroKicker;
    if (saved.heroLines && Array.isArray(saved.heroLines)) s.heroLines = saved.heroLines;
    if (saved.heroSub   !== undefined) s.heroSub   = saved.heroSub;
    if (saved.heroProof !== undefined) s.heroProof = saved.heroProof;
    if (saved.marquee   !== undefined) s.marquee   = saved.marquee;
    if (saved.benefits  && Array.isArray(saved.benefits)) s.benefits  = saved.benefits;
  } catch(e) {}
}
loadSettings();

/* ── Supabase — sync helpers ─────────────────────── */
let _sbReady = false;

function sbSync(fn) {
  if (!_sbReady || typeof fn !== 'function') return;
  fn().catch(e => console.warn('[sb sync]', e.message));
}

async function initDB() {
  if (!window._sbClient) return;
  _sbReady = true;
  const safe = async fn => { try { return await fn(); } catch(e) { console.warn('[initDB]', e.message); return null; } };
  const [prods, clis, peds, trans, settings] = await Promise.all([
    safe(() => SBProds.list()),
    safe(() => SBClis.list()),
    safe(() => SBPeds.list()),
    safe(() => SBTrans.list()),
    safe(() => SBSettings.get())
  ]);
  if (prods)    { DB.prods = prods; if (prods.length) DB.nid.p   = Math.max(...prods.map(x => x.id)) + 1; }
  if (clis)     { DB.clis  = clis;  if (clis.length)  DB.nid.c   = Math.max(...clis.map(x => x.id))  + 1; }
  if (peds)     { DB.peds  = peds;  if (peds.length)  DB.nid.ped = Math.max(...peds.map(x => x.id))  + 1; }
  if (trans)    { DB.trans = trans; if (trans.length) DB.nid.t   = Math.max(...trans.map(x => x.id)) + 1; }
  if (settings) Object.assign(DB.settings, settings);
}

async function doLogout() {
  if (typeof SBAuth !== 'undefined') {
    try { await SBAuth.signOut(); } catch(e) {}
  }
  window.location.href = 'index.html';
}

function showToast(m) {
  const t = $('toast');
  t.textContent = m;
  t.classList.add('on');
  setTimeout(() => t.classList.remove('on'), 2600);
}

/* ── Navegação ERP ───────────────────────────────── */
function closeERP() {
  window.location.href = 'index.html';
}

function epage(id, el) {
  document.querySelectorAll('.erp-page').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('on'));
  const pg = $('ep-' + id);
  if (pg) pg.classList.add('on');
  if (el) el.classList.add('on');
  else document.querySelectorAll('.nav-link').forEach(l => { if (l.getAttribute('onclick')?.includes("'" + id + "'")) l.classList.add('on'); });
  const tt = { dashboard: 'Dashboard', pedidos: 'Pedidos', nvenda: 'Nova Venda', estoque: 'Estoque', clientes: 'Clientes', financeiro: 'Financeiro', catalogo: 'Catálogo', relatorios: 'Relatórios', loja: 'Configurar Loja' };
  $('etitle').textContent = tt[id] || id;
  if (id === 'financeiro') rFin();
  if (id === 'relatorios') rRel();
  if (id === 'nvenda') rNV();
  if (id === 'loja') rLoja();
}

function openMod(id) {
  if (id === 'mv') {
    const s1 = $('mvc'), s2 = $('mvp');
    if (s1) s1.innerHTML = DB.clis.map(c => `<option value="${c.id}">${c.nm}</option>`).join('');
    if (s2) { s2.innerHTML = DB.prods.map(p => `<option value="${p.id}">${p.em} ${p.nm} — ${brl(p.pr)}</option>`).join(''); mvUpd(); }
  }
  if (id === 'mp') {
    const currentId = parseInt($('pe-id')?.value) || 0;
    const pb = $('pe-bump');
    if (pb) pb.innerHTML = '<option value="">Nenhum</option>' +
      DB.prods.filter(p => p.id !== currentId).map(p => `<option value="${p.id}">${p.em} ${p.nm}</option>`).join('');
  }
  $(id).classList.add('on');
}

function closeMod(id) { $(id).classList.remove('on'); }

/* ── Render ERP ──────────────────────────────────── */
function renderAll() {
  rMet();
  rDashRec();
  rDashLow();
  rPeds();
  rEst();
  rClis();
  rKat();
  rFin();
  rNV();
  rLoja();
  setTimeout(rDashCharts, 50);
}

function rMet() {
  const rec = DB.trans.filter(t => t.tp === 'receita').reduce((a, b) => a + b.vl, 0);
  const est = DB.prods.reduce((a, b) => a + b.st, 0);
  $('mgrid').innerHTML = `
    <article class="summary-card"><div>Faturamento</div><div class="summary-value">${brl(rec)}</div><div class="summary-meta mup">↑ +12% este mês</div></article>
    <article class="summary-card"><div>Pedidos</div><div class="summary-value">${DB.peds.length}</div><div class="summary-meta mup">↑ +8% este mês</div></article>
    <article class="summary-card"><div>Clientes</div><div class="summary-value">${DB.clis.length}</div><div class="summary-meta">+3 novos este mês</div></article>
    <article class="summary-card"><div>Em estoque</div><div class="summary-value">${est}</div><div class="summary-meta">${DB.prods.filter(p => p.st <= 3).length} com estoque baixo</div></article>`;
}

function rDashRec() {
  $('dash-rec').innerHTML = `
    <table class="compact-table"><thead><tr><th>#</th><th>Cliente</th><th>Total</th><th>Status</th></tr></thead><tbody>${[...DB.peds].slice(-4).reverse().map(p => {
      const c = DB.clis.find(x => x.id === p.cid);
      return `<tr><td>#${p.id}</td><td>${c ? c.nm : '—'}</td><td>${brl(p.tot)}</td><td><span class="xb ${stB[p.st] || 'xb-gray'}">${p.st}</span></td></tr>`;
    }).join('')}</tbody></table>`;
}

function rDashLow() {
  const low = DB.prods.filter(p => p.st <= 5);
  $('dash-low').innerHTML = !low.length ? '<p class="small-note">✓ Todos os produtos OK</p>' : low.map(p => `<div class="lsi"><span>${p.em} ${p.nm}</span><span class="xb ${p.st === 0 ? 'xb-red' : 'xb-gold'}">${p.st} un.</span></div>`).join('');
}

function rPeds() {
  $('ptt').innerHTML = [...DB.peds].reverse().map(p => {
    const c = DB.clis.find(x => x.id === p.cid);
    return `<tr><td>#${p.id}</td><td>${c ? c.nm : '—'}</td><td>${fdt(p.dt)}</td><td>${p.prod} ×${p.q}</td><td>${brl(p.tot)}</td><td>${p.pag}</td><td><select class="fi small-select" onchange="updPS(${p.id}, this.value)">${['Pendente','Confirmado','Enviado','Entregue'].map(s => `<option ${s === p.st ? 'selected' : ''}>${s}</option>`).join('')}</select></td></tr>`;
  }).join('');
}

function updPS(id, st) {
  const p = DB.peds.find(x => x.id === id);
  if (p) { p.st = st; rPeds(); rDashRec(); showToast('Status atualizado'); sbSync(() => SBPeds.updateStatus(id, st)); }
}

function rEst() {
  $('ett').innerHTML = DB.prods.map(p => `
    <tr>
      <td>${p.em} <span class="cell-strong">${p.nm}</span></td>
      <td>${cNm[p.cat]}</td>
      <td>${brl(p.pr)}</td>
      <td><span class="xb ${p.st === 0 ? 'xb-red' : p.st <= 3 ? 'xb-gold' : 'xb-green'}">${p.st}</span></td>
      <td><span class="xb ${p.st === 0 ? 'xb-red' : p.st <= 5 ? 'xb-gold' : 'xb-green'}">${p.st === 0 ? 'Esgotado' : p.st <= 5 ? 'Baixo' : 'OK'}</span></td>
      <td class="table-actions"><button class="eb small" onclick="editP(${p.id})">Editar</button><input type="number" value="${p.st}" min="0" class="small-input" onchange="updSt(${p.id}, this.value)"></td>
    </tr>`).join('');
}

function updSt(id, v) {
  const p = DB.prods.find(x => x.id === id);
  if (p) { p.st = parseInt(v) || 0; rEst(); rDashLow(); rMet(); showToast('Estoque atualizado'); sbSync(() => SBProds.updateStock(id, p.st)); }
}

function rClis() {
  $('ctt').innerHTML = DB.clis.map(c => `
    <tr>
      <td>${c.nm}</td>
      <td>${c.tel}</td>
      <td>${c.em}</td>
      <td>${c.ci}/${c.es}</td>
      <td>${c.pe}</td>
      <td>${brl(c.gasto)}</td>
      <td>${fdt(c.ult)}</td>
    </tr>`).join('');
}

function rKat() {
  $('ktt').innerHTML = DB.prods.map(p => `
    <tr>
      <td class="emoji-cell">${p.img
        ? `<img src="${p.img}" style="width:36px;height:36px;object-fit:cover;border-radius:8px;display:block" onerror="this.outerHTML='${p.em}'">`
        : p.em}</td>
      <td class="cell-strong">${p.nm}</td>
      <td>${cNm[p.cat]}</td>
      <td>${brl(p.pr)}</td>
      <td>${p.pd ? brl(p.pd) : '—'}</td>
      <td>${p.dt ? `<span class="xb ${p.dt === 'new' ? 'xb-green' : 'xb-gold'}">${p.dt === 'new' ? 'Novo' : 'Promoção'}</span>` : '—'}</td>
      <td class="table-actions"><button class="eb small" onclick="editP(${p.id})">Editar</button><button class="eb small" onclick="delP(${p.id})">Excluir</button></td>
    </tr>`).join('');
}

function rFin() {
  const rec = DB.trans.filter(t => t.tp === 'receita').reduce((a, b) => a + b.vl, 0);
  const des = DB.trans.filter(t => t.tp === 'despesa').reduce((a, b) => a + b.vl, 0);
  $('f-r').textContent = brl(rec);
  $('f-d').textContent = brl(des);
  $('f-l').textContent = brl(rec - des);
  $('f-t').textContent = brl(DB.peds.length ? rec / DB.peds.length : 0);
  $('ftt').innerHTML = [...DB.trans].reverse().slice(0, 8).map(t => `
    <tr>
      <td>${fdt(t.dt)}</td>
      <td>${t.ds}</td>
      <td><span class="xb ${t.tp === 'receita' ? 'xb-green' : 'xb-red'}">${t.tp === 'receita' ? 'Receita' : 'Despesa'}</span></td>
      <td class="${t.tp === 'receita' ? 'revenue' : 'expense'}">${t.tp === 'receita' ? '+' : '-'} ${brl(t.vl)}</td>
    </tr>`).join('');
  rFlxChart();
}

function rNV() {
  const vc = $('vc'), vp = $('vp');
  if (vc) vc.innerHTML = DB.clis.map(c => `<option value="${c.id}">${c.nm}</option>`).join('');
  if (vp) { vp.innerHTML = DB.prods.map(p => `<option value="${p.id}">${p.em} ${p.nm} — ${brl(p.pr)}</option>`).join(''); vUpd(); }
}

function vUpd() {
  const p = DB.prods.find(x => x.id === parseInt($('vp')?.value));
  const q = parseInt($('vq')?.value) || 1;
  if ($('vt')) $('vt').textContent = p ? brl(p.pr * q) : 'R$ 0,00';
  const prev = $('vprev');
  if (!prev) return;
  if (!p) { prev.style.display = 'none'; return; }
  prev.style.display = 'flex';
  const img = $('vprev-img');
  if (img) { img.src = p.img || ''; img.style.display = p.img ? 'block' : 'none'; }
  if ($('vprev-nm')) $('vprev-nm').textContent = p.nm;
  if ($('vprev-pr')) $('vprev-pr').textContent = brl(p.pd || p.pr);
  const stEl = $('vprev-st');
  if (stEl) {
    stEl.textContent = p.st > 0 ? `${p.st} em estoque` : 'Esgotado';
    stEl.style.color = p.st > 5 ? '#16A34A' : p.st > 0 ? '#D97706' : '#DC2626';
  }
}

function saveV() {
  const pid = parseInt($('vp')?.value);
  const q = parseInt($('vq')?.value) || 1;
  const cid = parseInt($('vc')?.value);
  const pag = $('vpg')?.value;
  const p = DB.prods.find(x => x.id === pid);
  const c = DB.clis.find(x => x.id === cid);
  if (!p || !c) return;
  const tot = p.pr * q;
  const id = DB.nid.ped++;
  const ped = { id, cid, prod: p.nm, q, tot, pag, st: 'Confirmado', dt: td() };
  const tr  = { id: DB.nid.t++, tp: 'receita', ds: `Pedido #${id}`, vl: tot, dt: td() };
  DB.peds.push(ped);
  DB.trans.push(tr);
  c.gasto += tot;
  c.ult = td();
  p.st = Math.max(0, p.st - q);
  sbSync(() => SBPeds.upsert(ped));
  sbSync(() => SBTrans.upsert(tr));
  sbSync(() => SBClis.update(cid, { gasto: c.gasto, ult: c.ult }));
  sbSync(() => SBProds.updateStock(pid, p.st));
  renderAll();
  showToast(`Venda registrada — ${brl(tot)}`);
  const el = $('vhj');
  if (el) {
    const note = el.querySelector('.small-note');
    if (note) note.remove();
    el.insertAdjacentHTML('afterbegin', `<div class="history-item"><strong>#${id}</strong> · ${c.nm}<br>${p.em} ${p.nm} ×${q} · ${brl(tot)}</div>`);
  }
}

function mvUpd() {
  const p = DB.prods.find(x => x.id === parseInt($('mvp')?.value));
  const q = parseInt($('mvq')?.value) || 1;
  if ($('mvt')) $('mvt').textContent = p ? brl(p.pr * q) : 'R$ 0,00';
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
}
function selTrTp(btn, val) {
  if ($('tr-tp')) $('tr-tp').value = val;
  btn.closest('.pay-chips').querySelectorAll('.pay-chip').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
}

function saveMV() {
  const pid = parseInt($('mvp')?.value);
  const q = parseInt($('mvq')?.value) || 1;
  const cid = parseInt($('mvc')?.value);
  const pag = $('mvpg')?.value;
  const p = DB.prods.find(x => x.id === pid);
  const c = DB.clis.find(x => x.id === cid);
  if (!p || !c) return;
  const tot = p.pr * q;
  const id = DB.nid.ped++;
  const mped = { id, cid, prod: p.nm, q, tot, pag, st: 'Confirmado', dt: td() };
  const mtr  = { id: DB.nid.t++, tp: 'receita', ds: `Pedido #${id}`, vl: tot, dt: td() };
  DB.peds.push(mped);
  DB.trans.push(mtr);
  c.gasto += tot;
  c.ult = td();
  p.st = Math.max(0, p.st - q);
  sbSync(() => SBPeds.upsert(mped));
  sbSync(() => SBTrans.upsert(mtr));
  sbSync(() => SBClis.update(cid, { gasto: c.gasto, ult: c.ult }));
  sbSync(() => SBProds.updateStock(pid, p.st));
  renderAll();
  closeMod('mv');
  showToast(`Pedido #${id} criado — ${brl(tot)}`);
}

function saveProd() {
  const eid = $('pe-id')?.value;
  const featsRaw = $('pe-feats')?.value || '';
  const o = {
    em: $('pe-em').value || '💄',
    nm: $('pe-nm').value,
    cat: $('pe-cat').value,
    pr: parseFloat($('pe-pr').value) || 0,
    pd: $('pe-pd').value ? parseFloat($('pe-pd').value) : null,
    st: parseInt($('pe-st').value) || 0,
    dt: $('pe-dt').value,
    img: ($('pe-img')?.value || '').trim(),
    desc: ($('pe-desc')?.value || '').trim(),
    feats: featsRaw ? featsRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
    bump: $('pe-bump')?.value ? parseInt($('pe-bump').value) : null
  };
  if (!o.nm) { showToast('Informe o nome'); return; }
  let saved;
  if (eid) {
    const p = DB.prods.find(x => x.id === parseInt(eid));
    if (p) { Object.assign(p, o); saved = p; }
  } else {
    o.id = DB.nid.p++;
    DB.prods.push(o);
    saved = o;
  }
  renderAll();
  closeMod('mp');
  showToast('Produto salvo');
  if (saved) sbSync(() => SBProds.upsert(saved));
  $('pe-id').value = '';
  ['pe-nm', 'pe-em', 'pe-pr', 'pe-pd', 'pe-img', 'pe-desc', 'pe-feats'].forEach(id => { if ($(id)) $(id).value = ''; });
  $('pe-st').value = '0';
}

function editP(id) {
  const p = DB.prods.find(x => x.id === id);
  if (!p) return;
  $('pe-id').value = p.id;
  $('pe-em').value = p.em;
  $('pe-nm').value = p.nm;
  $('pe-cat').value = p.cat;
  $('pe-pr').value = p.pr;
  $('pe-pd').value = p.pd || '';
  $('pe-st').value = p.st;
  $('pe-dt').value = p.dt || '';
  if ($('pe-img')) $('pe-img').value = p.img || '';
  if ($('pe-desc')) $('pe-desc').value = p.desc || '';
  if ($('pe-feats')) $('pe-feats').value = (p.feats || []).join(', ');
  openMod('mp');
  if ($('pe-bump')) $('pe-bump').value = p.bump || '';
}

function delP(id) {
  if (!confirm('Excluir produto?')) return;
  DB.prods = DB.prods.filter(x => x.id !== id);
  renderAll();
  showToast('Produto excluído');
  sbSync(() => SBProds.delete(id));
}

function saveCli() {
  const o = {
    id: DB.nid.c++,
    nm: $('nc-nm').value,
    tel: $('nc-tel').value,
    em: $('nc-em').value,
    ci: $('nc-ci').value,
    es: $('nc-es').value,
    an: $('nc-an').value,
    pe: $('nc-pe').value,
    gasto: 0,
    ult: ''
  };
  if (!o.nm) { showToast('Informe o nome'); return; }
  DB.clis.push(o);
  rClis();
  rNV();
  closeMod('mc');
  showToast('Cliente cadastrado');
  sbSync(() => SBClis.upsert(o));
  ['nc-nm', 'nc-tel', 'nc-em', 'nc-ci', 'nc-es'].forEach(fid => { if ($(fid)) $(fid).value = ''; });
  if ($('nc-an')) $('nc-an').value = '';
}

function saveTr() {
  const o = {
    id: DB.nid.t++,
    tp: $('tr-tp').value,
    ds: $('tr-ds').value,
    vl: parseFloat($('tr-vl').value) || 0,
    dt: $('tr-dt').value || td()
  };
  if (!o.ds) { showToast('Informe a descrição'); return; }
  DB.trans.push(o);
  rFin();
  closeMod('mt');
  showToast('Lançamento salvo');
  sbSync(() => SBTrans.upsert(o));
  if ($('tr-ds')) $('tr-ds').value = '';
  if ($('tr-vl')) $('tr-vl').value = '';
  $('tr-dt').value = td();
}

function srch(id, q) { document.querySelectorAll('#' + id + ' tr').forEach(r => { r.style.display = r.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none'; }); }
function srchSt(s) { document.querySelectorAll('#ptt tr').forEach(r => { r.style.display = (!s || r.textContent.includes(s)) ? '' : 'none'; }); }

/* ── Gráficos ────────────────────────────────────── */
let _c = {};
function dc(id) { if (_c[id]) { _c[id].destroy(); delete _c[id]; } }
const ca = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { font: { family: 'Inter', size: 11, weight: '300' }, color: '#64748b' } } }, scales: { x: { ticks: { color: '#64748b', font: { size: 10, family: 'Inter', weight: '300' } }, grid: { color: '#e5e7eb', lineWidth: 1 } }, y: { ticks: { color: '#64748b', font: { size: 10, family: 'Inter', weight: '300' } }, grid: { color: '#e5e7eb', lineWidth: 1 } } } };

function _lastMonths(n) {
  const now = new Date(), ym = [], lb = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    ym.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
    lb.push(d.toLocaleString('pt-BR', { month: 'short' }).replace('.', ''));
  }
  return { ym, lb };
}

function rDashCharts() {
  dc('fat'); dc('cat');
  const cf = $('ch-fat'), cc = $('ch-cat');

  if (cf) {
    const { ym, lb } = _lastMonths(6);
    const data = ym.map(m => DB.trans.filter(t => t.tp === 'receita' && t.dt?.startsWith(m)).reduce((a, b) => a + b.vl, 0));
    _c.fat = new Chart(cf, { type: 'bar', data: { labels: lb, datasets: [{ data, backgroundColor: 'rgba(36,96,90,.95)', borderRadius: 6, label: 'R$' }] }, options: { ...ca } });
  }

  if (cc) {
    const cats = ['pele', 'maquiagem', 'corpo', 'fragrancias'];
    const catLabels = ['Skincare', 'Maquiagem', 'Corpo', 'Fragrâncias'];
    const catData = cats.map(cat => {
      const names = new Set(DB.prods.filter(p => p.cat === cat).map(p => p.nm));
      return DB.peds.filter(p => names.has(p.prod)).reduce((a, b) => a + b.q, 0);
    });
    const hasData = catData.some(v => v > 0);
    _c.cat = new Chart(cc, {
      type: 'doughnut',
      data: { labels: catLabels, datasets: [{ data: hasData ? catData : [1, 1, 1, 1], backgroundColor: ['#24605a', '#5f7d78', '#7aa99f', '#a9c3bd'], borderWidth: 0 }] },
      options: { ...ca, plugins: { legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 11, weight: '300' }, color: '#64748b' } } } }
    });
  }
}

function rFlxChart() {
  dc('flx');
  const c = $('ch-flx');
  if (!c) return;
  const { ym, lb } = _lastMonths(6);
  const rec = ym.map(m => DB.trans.filter(t => t.tp === 'receita' && t.dt?.startsWith(m)).reduce((a, b) => a + b.vl, 0));
  const des = ym.map(m => DB.trans.filter(t => t.tp === 'despesa' && t.dt?.startsWith(m)).reduce((a, b) => a + b.vl, 0));
  _c.flx = new Chart(c, { type: 'line', data: { labels: lb, datasets: [
    { label: 'Receita', data: rec, borderColor: '#24605a', backgroundColor: 'rgba(36,96,90,.16)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 4 },
    { label: 'Despesa', data: des, borderColor: '#d45d5d', backgroundColor: 'rgba(212,93,93,.14)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 4 }
  ] }, options: { ...ca } });
}

function rRel() {
  setTimeout(() => {
    dc('top'); dc('dia');
    const c1 = $('ch-top'), c2 = $('ch-dia');
    const mnNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

    if (c1) {
      const counts = {};
      DB.peds.forEach(p => { counts[p.prod] = (counts[p.prod] || 0) + p.q; });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (sorted.length) {
        _c.top = new Chart(c1, { type: 'bar', data: { labels: sorted.map(([nm]) => nm.length > 18 ? nm.slice(0, 16) + '…' : nm), datasets: [{ label: 'Vendas', data: sorted.map(([, v]) => v), backgroundColor: '#24605a', borderRadius: 6 }] }, options: { ...ca, indexAxis: 'y' } });
      }
    }

    if (c2) {
      const days = [0, 0, 0, 0, 0, 0, 0];
      DB.peds.forEach(p => { if (p.dt) days[new Date(p.dt + 'T12:00:00').getDay()]++; });
      _c.dia = new Chart(c2, { type: 'bar', data: { labels: ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'], datasets: [{ label: 'Pedidos', data: days, backgroundColor: '#5f7d78', borderRadius: 6 }] }, options: { ...ca } });
    }

    const { ym } = _lastMonths(6);
    if ($('ratt')) {
      $('ratt').innerHTML = ym.map(m => {
        const pedsMes = DB.peds.filter(p => p.dt?.startsWith(m));
        const r = DB.trans.filter(t => t.tp === 'receita' && t.dt?.startsWith(m)).reduce((a, b) => a + b.vl, 0);
        const n = new Set(pedsMes.map(p => p.cid)).size;
        const qtd = pedsMes.length;
        const [y, mo] = m.split('-');
        return `<tr><td>${mnNames[parseInt(mo) - 1]} ${y}</td><td>${qtd}</td><td>${brl(r)}</td><td>${brl(qtd ? r / qtd : 0)}</td><td>${n}</td><td><span class="xb ${r > 0 ? 'xb-green' : 'xb-gray'}">${r > 0 ? 'Com vendas' : 'Sem vendas'}</span></td></tr>`;
      }).join('');
    }
  }, 80);
}

/* ── Configurações da loja ───────────────────────── */
function rLoja() {
  const s = DB.settings;
  const v = (id, val) => { if ($(id)) $(id).value = val; };
  v('ls-banner',  s.banner.replace(/<[^>]+>/g, ''));
  v('ls-wa',      s.whatsapp);
  v('ls-kicker',  s.heroKicker);
  v('ls-hl1',     s.heroLines[0] || '');
  v('ls-hl2',     s.heroLines[1] || '');
  v('ls-hl3',     s.heroLines[2] || '');
  v('ls-hl4',     s.heroLines[3] || '');
  v('ls-sub',     s.heroSub);
  v('ls-proof',   s.heroProof);
  v('ls-marquee', s.marquee);
  const bg = $('ls-benefits-grid');
  if (bg) bg.innerHTML = s.benefits.map((b, i) => `
    <label class="form-label">Benefício ${i + 1} — Título<input type="text" class="input-field" id="ls-bt${i}" value="${b.title.replace(/"/g,'&quot;')}"></label>
    <label class="form-label">Benefício ${i + 1} — Descrição<input type="text" class="input-field" id="ls-bd${i}" value="${b.desc.replace(/"/g,'&quot;')}"></label>
  `).join('');
}

function saveLojaSettings() {
  const g = id => $(id)?.value?.trim() || '';
  const s = DB.settings;
  const raw = g('ls-banner');
  s.banner    = raw.includes('<em>') ? raw : raw.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s.whatsapp  = g('ls-wa').replace(/\D/g, '');
  s.heroKicker= g('ls-kicker');
  s.heroLines = [g('ls-hl1'), g('ls-hl2'), g('ls-hl3'), g('ls-hl4')];
  s.heroSub   = g('ls-sub');
  s.heroProof = g('ls-proof');
  s.marquee   = g('ls-marquee');
  s.benefits  = s.benefits.map((_, i) => ({ title: g('ls-bt' + i), desc: g('ls-bd' + i) }));
  try { localStorage.setItem('mlb_settings', JSON.stringify(s)); } catch(e) {}
  sbSync(() => SBSettings.set(s));
  showToast('Configurações salvas — atualize a loja para ver');
}

/* ── Init (ERP page) ─────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  if (!$('ep-dashboard')) return;

  // Verificar sessão Supabase (só se configurado)
  if (window._sbClient) {
    try {
      const session = await SBAuth.getSession();
      if (!session) { window.location.replace('login.html'); return; }
      // Exibir email do usuário na sidebar
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

  // Fechar modal clicando no backdrop
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) closeMod(m.id); });
  });

  // Fechar modal com ESC
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = document.querySelector('.modal.on');
    if (open) closeMod(open.id);
  });
});
