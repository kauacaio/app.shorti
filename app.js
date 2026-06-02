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
  solics: [],
  cart: [],
  nid: { p: 200, c: 200, ped: 2000, t: 200, s: 100 },
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
  const [prods, clis, peds, trans, solics, settings] = await Promise.all([
    safe(() => SBProds.list()),
    safe(() => SBClis.list()),
    safe(() => SBPeds.list()),
    safe(() => SBTrans.list()),
    safe(() => SBSolics.list()),
    safe(() => SBSettings.get())
  ]);
  if (prods)    { DB.prods  = prods;  if (prods.length)  DB.nid.p   = Math.max(...prods.map(x => x.id))  + 1; }
  if (clis)     { DB.clis   = clis;   if (clis.length)   DB.nid.c   = Math.max(...clis.map(x => x.id))   + 1; }
  if (peds)     { DB.peds   = peds;   if (peds.length)   DB.nid.ped = Math.max(...peds.map(x => x.id))   + 1; }
  if (trans)    { DB.trans  = trans;  if (trans.length)  DB.nid.t   = Math.max(...trans.map(x => x.id))  + 1; }
  if (solics)   { DB.solics = solics; if (solics.length) DB.nid.s   = Math.max(...solics.map(x => x.id)) + 1; }
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
  const tt = { dashboard: 'Dashboard', receber: 'A Receber', historico: 'Histórico de Vendas', solicita: 'Solicitações', nvenda: 'Nova Venda', estoque: 'Estoque', clientes: 'Clientes', financeiro: 'Financeiro', catalogo: 'Catálogo', extrato: 'Extrato Mensal', relatorios: 'Relatórios', loja: 'Configurar Loja' };
  $('etitle').textContent = tt[id] || id;
  if (id === 'financeiro') rFin();
  if (id === 'relatorios') rRel();
  if (id === 'nvenda') rNV();
  if (id === 'loja') rLoja();
  if (id === 'receber')  rReceber();
  if (id === 'historico') rHistorico();
  if (id === 'solicita') rSolic();
  if (id === 'extrato')  rExtrato();
}

function openMod(id) {
  if (id === 'mv') {
    const s1 = $('mvc'), s2 = $('mvp');
    if (s1) s1.innerHTML = DB.clis.map(c => `<option value="${c.id}">${c.nm}</option>`).join('');
    if (s2) { s2.innerHTML = DB.prods.map(p => `<option value="${p.id}">${p.em} ${p.nm} — ${brl(p.pd ?? p.pr)}${p.pd ? ' 🏷' : ''}</option>`).join(''); mvUpd(); }
    if ($('mvdtpag')) $('mvdtpag').value = td();
    if ($('mvpg')) { $('mvpg').value = 'PIX'; mvPayChg('PIX'); }
    _mvCart = [];
    mvRenderCart();
  }
  if (id === 'mp') {
    const currentId = parseInt($('pe-id')?.value) || 0;
    const pb = $('pe-bump');
    if (pb) pb.innerHTML = '<option value="">Nenhum</option>' +
      DB.prods.filter(p => p.id !== currentId).map(p => `<option value="${p.id}">${p.em} ${p.nm}</option>`).join('');
  }
  $(id).classList.add('on');
  document.body.style.overflow = 'hidden';
}

function closeMod(id) {
  $(id).classList.remove('on');
  if (!document.querySelector('.modal.on')) document.body.style.overflow = '';
}

/* ── Render ERP ──────────────────────────────────── */
/* ── Extrato Mensal ──────────────────────────────── */
let _extY = 0, _extM = 0;

function _extInit() {
  if (_extY) return;
  // Default to last closed month (previous month)
  const prev = new Date();
  prev.setDate(1);
  prev.setMonth(prev.getMonth() - 1);
  _extY = prev.getFullYear();
  _extM = prev.getMonth() + 1;
}

function extNavMes(d) {
  _extM += d;
  if (_extM > 12) { _extM = 1;  _extY++; }
  if (_extM < 1)  { _extM = 12; _extY--; }
  const now = new Date();
  if (_extY > now.getFullYear() || (_extY === now.getFullYear() && _extM > now.getMonth() + 1)) {
    _extM -= d;
    if (_extM > 12) { _extM = 1;  _extY++; }
    if (_extM < 1)  { _extM = 12; _extY--; }
    return;
  }
  rExtrato();
}

function rExtrato() {
  _extInit();
  const mnNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const mStr = `${_extY}-${String(_extM).padStart(2,'0')}`;
  const mesNm = `${mnNames[_extM - 1]} ${_extY}`;
  const nowRef = new Date();
  const isPreview = (_extY === nowRef.getFullYear() && _extM === nowRef.getMonth() + 1);

  if ($('ext-month-label')) {
    $('ext-month-label').innerHTML = isPreview
      ? `${mesNm} <span class="ext-preview-badge">Prévia</span>`
      : mesNm;
  }
  if ($('ext-subtitle')) {
    $('ext-subtitle').textContent = isPreview
      ? 'Prévia do mês atual — dados em tempo real'
      : 'Demonstrativo financeiro completo';
  }
  const noteEl = $('ext-preview-note');
  if (noteEl) noteEl.style.display = isPreview ? 'flex' : 'none';

  const pedsMes   = DB.peds.filter(p => p.dt?.startsWith(mStr));
  const transMes  = DB.trans.filter(t => t.dt?.startsWith(mStr));
  const recMes    = transMes.filter(t => t.tp === 'receita').reduce((a,b) => a+b.vl, 0);
  const desMes    = transMes.filter(t => t.tp === 'despesa').reduce((a,b) => a+b.vl, 0);
  const fatMes    = pedsMes.reduce((a,b) => a+b.tot, 0);
  const fiadoMes  = pedsMes.filter(p => p.pag === 'Fiado').reduce((a,b) => a+b.tot, 0);
  const lucro     = recMes - desMes;
  const pct       = fatMes > 0 ? Math.round((recMes / fatMes) * 100) : 0;
  const tkMed     = pedsMes.length ? fatMes / pedsMes.length : 0;

  /* KPIs */
  if ($('ext-kpis')) $('ext-kpis').innerHTML = `
    <div class="ext-kpi kpi-rose" data-icon="✦">
      <div class="ext-kpi-label">Faturamento</div>
      <div class="ext-kpi-value">${brl(fatMes)}</div>
      <div class="ext-kpi-sub" style="color:#C4897A">${pedsMes.length} pedido${pedsMes.length !== 1 ? 's' : ''}</div>
    </div>
    <div class="ext-kpi kpi-sage" data-icon="✓">
      <div class="ext-kpi-label">Recebido</div>
      <div class="ext-kpi-value">${brl(recMes)}</div>
      <div class="ext-kpi-sub" style="color:#6B9E7A">${pct}% do faturamento</div>
    </div>
    <div class="ext-kpi kpi-amber" data-icon="⏳">
      <div class="ext-kpi-label">A Receber</div>
      <div class="ext-kpi-value">${brl(fiadoMes)}</div>
      <div class="ext-kpi-sub" style="color:#D97706">${pedsMes.filter(p => p.pag==='Fiado').length} fiado${pedsMes.filter(p => p.pag==='Fiado').length !== 1 ? 's' : ''}</div>
    </div>
    <div class="ext-kpi kpi-slate" data-icon="◈">
      <div class="ext-kpi-label">Ticket Médio</div>
      <div class="ext-kpi-value">${brl(tkMed)}</div>
      <div class="ext-kpi-sub" style="color:${lucro >= 0 ? '#6B9E7A' : '#dc2626'}">Lucro ${brl(lucro)}</div>
    </div>`;

  /* Barra de progresso */
  if ($('ext-prog-pct'))  $('ext-prog-pct').textContent  = pct + '%';
  if ($('ext-prog-fill')) $('ext-prog-fill').style.width = pct + '%';
  if ($('ext-prog-rec'))  $('ext-prog-rec').textContent  = `${brl(recMes)} recebido`;
  if ($('ext-prog-pend')) $('ext-prog-pend').textContent = fiadoMes > 0 ? `${brl(fiadoMes)} a receber` : 'Tudo recebido ✓';

  /* Pedidos do mês */
  if ($('ext-ped-count')) $('ext-ped-count').textContent = `${pedsMes.length} pedido${pedsMes.length !== 1 ? 's' : ''}`;
  if ($('ext-peds-tb')) {
    if (!pedsMes.length) {
      $('ext-peds-tb').innerHTML = `<tr><td colspan="6" style="text-align:center;padding:22px;color:#94a3b8;font-size:13px">Nenhum pedido em ${mesNm}</td></tr>`;
    } else {
      $('ext-peds-tb').innerHTML = [...pedsMes].reverse().map(p => {
        const c = DB.clis.find(x => x.id === p.cid);
        const stCl = { Pendente:'xb-gold', Confirmado:'xb-blue', Enviado:'xb-gray', Entregue:'xb-green' };
        const pagCl = p.pag === 'Fiado' ? 'style="color:#d97706;font-weight:600"' : '';
        return `<tr>
          <td style="color:#94a3b8">#${p.id}</td>
          <td style="font-weight:500">${c ? c.nm : '—'}</td>
          <td>${p.prod}</td>
          <td style="font-weight:600">${brl(p.tot)}</td>
          <td ${pagCl}>${p.pag}</td>
          <td><span class="xb ${stCl[p.st]||'xb-gray'}">${p.st}</span></td>
        </tr>`;
      }).join('');
    }
  }

  /* Top clientes */
  if ($('ext-top-clis')) {
    const cliMap = {};
    pedsMes.forEach(p => { cliMap[p.cid] = (cliMap[p.cid] || 0) + p.tot; });
    const sorted = Object.entries(cliMap).sort((a,b) => b[1]-a[1]).slice(0,5);
    $('ext-top-clis').innerHTML = !sorted.length
      ? '<p style="font-size:13px;color:#94a3b8;padding:8px 0">Nenhum cliente este mês</p>'
      : sorted.map(([cid,tot],i) => {
          const c = DB.clis.find(x => x.id === parseInt(cid));
          return `<div class="ext-rank-item">
            <div class="ext-rank-pos ${i===0?'top1':''}">${i+1}</div>
            <div class="ext-rank-nm">${c ? c.nm : `#${cid}`}</div>
            <div class="ext-rank-val">${brl(tot)}</div>
          </div>`;
        }).join('');
  }

  /* Top produtos */
  if ($('ext-top-prods')) {
    const prodMap = {};
    pedsMes.forEach(p => {
      if (p.itens) p.itens.forEach(i => { prodMap[i.nm] = (prodMap[i.nm] || 0) + i.sub; });
      else prodMap[p.prod] = (prodMap[p.prod] || 0) + p.tot;
    });
    const sorted = Object.entries(prodMap).sort((a,b) => b[1]-a[1]).slice(0,5);
    $('ext-top-prods').innerHTML = !sorted.length
      ? '<p style="font-size:13px;color:#94a3b8;padding:8px 0">Nenhum produto este mês</p>'
      : sorted.map(([nm,tot],i) => `
          <div class="ext-rank-item">
            <div class="ext-rank-pos ${i===0?'top1':''}">${i+1}</div>
            <div class="ext-rank-nm">${nm}</div>
            <div class="ext-rank-val">${brl(tot)}</div>
          </div>`).join('');
  }

  /* Lançamentos financeiros */
  if ($('ext-trans-count')) $('ext-trans-count').textContent = `${transMes.length} lançamento${transMes.length !== 1 ? 's' : ''}`;
  if ($('ext-trans-tb')) {
    if (!transMes.length) {
      $('ext-trans-tb').innerHTML = `<tr><td colspan="4" style="text-align:center;padding:22px;color:#94a3b8;font-size:13px">Nenhum lançamento em ${mesNm}</td></tr>`;
    } else {
      $('ext-trans-tb').innerHTML = [...transMes].reverse().map(t => `
        <tr>
          <td style="color:#94a3b8">${fdt(t.dt)}</td>
          <td>${t.ds}</td>
          <td><span class="xb ${t.tp==='receita'?'xb-green':'xb-red'}">${t.tp==='receita'?'Receita':'Despesa'}</span></td>
          <td class="${t.tp==='receita'?'revenue':'expense'}" style="font-weight:600">${t.tp==='receita'?'+':'-'} ${brl(t.vl)}</td>
        </tr>`).join('');
    }
  }

  /* Rodapé */
  const now = new Date();
  const dtStr = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  if ($('ext-gen-dt'))    $('ext-gen-dt').textContent    = dtStr;
  if ($('ext-footer-mes')) $('ext-footer-mes').textContent = mesNm;
}

/* ── Banner dashboard ────────────────────────────── */
function initBanner() {
  // Banner references the last closed month (previous month)
  const prev = new Date();
  prev.setDate(1);
  prev.setMonth(prev.getMonth() - 1);
  const prevY = prev.getFullYear();
  const prevM = prev.getMonth() + 1;
  const key = `mlb_banner_${prevY}_${prevM}`;
  if (localStorage.getItem(key)) return;
  const mStr = `${prevY}-${String(prevM).padStart(2,'0')}`;
  const temDados = DB.peds.some(p => p.dt?.startsWith(mStr)) || DB.trans.some(t => t.dt?.startsWith(mStr));
  if (!temDados) return;
  const mnNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const el = $('dash-banner');
  if (!el) return;
  if ($('dash-banner-mes')) $('dash-banner-mes').textContent = `${mnNames[prevM - 1]} ${prevY}`;
  el.style.display = 'flex';
}

function dismissBanner() {
  const prev = new Date();
  prev.setDate(1);
  prev.setMonth(prev.getMonth() - 1);
  const key = `mlb_banner_${prev.getFullYear()}_${prev.getMonth() + 1}`;
  localStorage.setItem(key, '1');
  const el = $('dash-banner');
  if (el) { el.style.opacity = '0'; el.style.transform = 'translateY(-8px)'; el.style.transition = 'opacity .3s, transform .3s'; setTimeout(() => el.style.display = 'none', 300); }
}

/* ── Popup extrato fechado ───────────────────────── */
function showExtPopup() {
  const prev = new Date();
  prev.setDate(1);
  prev.setMonth(prev.getMonth() - 1);
  const prevY = prev.getFullYear();
  const prevM = prev.getMonth() + 1;
  const popKey = `mlb_popup_${prevY}_${prevM}`;
  if (localStorage.getItem(popKey)) return;
  const mStr = `${prevY}-${String(prevM).padStart(2,'0')}`;
  const pedsMes  = DB.peds.filter(p => p.dt?.startsWith(mStr));
  const transMes = DB.trans.filter(t => t.dt?.startsWith(mStr));
  if (!pedsMes.length && !transMes.length) return;
  const fat = pedsMes.reduce((a,b) => a + b.tot, 0);
  const rec = transMes.filter(t => t.tp === 'receita').reduce((a,b) => a + b.vl, 0);
  const mnNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const el = $('ext-popup');
  if (!el) return;
  if ($('ext-popup-month')) $('ext-popup-month').textContent = `${mnNames[prevM - 1]} ${prevY}`;
  if ($('ext-popup-stats')) $('ext-popup-stats').innerHTML = `
    <div class="ext-popup-stat">
      <div class="ext-popup-stat-lbl">Faturamento</div>
      <div class="ext-popup-stat-val">${brl(fat)}</div>
    </div>
    <div class="ext-popup-stat">
      <div class="ext-popup-stat-lbl">Pedidos</div>
      <div class="ext-popup-stat-val">${pedsMes.length}</div>
    </div>`;
  setTimeout(() => {
    el.style.display = 'block';
    el.classList.remove('closing');
  }, 700);
}

function dismissPopup() {
  const el = $('ext-popup');
  if (!el) return;
  el.classList.add('closing');
  setTimeout(() => { el.style.display = 'none'; el.classList.remove('closing'); }, 300);
  const prev = new Date();
  prev.setDate(1);
  prev.setMonth(prev.getMonth() - 1);
  localStorage.setItem(`mlb_popup_${prev.getFullYear()}_${prev.getMonth() + 1}`, '1');
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
  setTimeout(rDashCharts, 50);
}

function rMet() {
  const fat     = DB.peds.reduce((a, b) => a + b.tot, 0);
  const aReceber = DB.peds.filter(p => p.pag === 'Fiado').reduce((a, b) => a + b.tot, 0);
  const est     = DB.prods.reduce((a, b) => a + b.st, 0);
  $('mgrid').innerHTML = `
    <article class="summary-card"><div>Faturamento</div><div class="summary-value">${brl(fat)}</div><div class="summary-meta ${aReceber > 0 ? 'mdn' : 'mup'}">${aReceber > 0 ? `${brl(aReceber)} a receber` : '↑ todas as vendas'}</div></article>
    <article class="summary-card"><div>Pedidos</div><div class="summary-value">${DB.peds.length}</div><div class="summary-meta">${DB.peds.filter(p => p.pag === 'Fiado').length} fiado</div></article>
    <article class="summary-card"><div>Clientes</div><div class="summary-value">${DB.clis.length}</div><div class="summary-meta">cadastrados</div></article>
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

/* ── A Receber (vendas fiado) ────────────────────── */
function rReceber() {
  const el = $('rbtt');
  if (!el) return;
  const fiado = DB.peds.filter(p => p.pag === 'Fiado');
  const total   = fiado.reduce((a, b) => a + b.tot, 0);
  const vencido = fiado.filter(p => p.dtpag && p.dtpag < td()).reduce((a, b) => a + b.tot, 0);
  if ($('r-total'))   $('r-total').textContent   = brl(total);
  if ($('r-vencido')) $('r-vencido').textContent = brl(vencido);
  if ($('r-qtd'))     $('r-qtd').textContent     = fiado.length;
  if (!fiado.length) {
    el.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:28px;color:#71717A;font-size:13px">✓ Nenhum valor pendente no momento</td></tr>';
    return;
  }
  el.innerHTML = fiado.map(p => {
    const c = DB.clis.find(x => x.id === p.cid);
    const venc = p.dtpag && p.dtpag < td();
    return `<tr>
      <td>#${p.id}</td>
      <td>${c ? c.nm : '—'}</td>
      <td>${c ? c.tel : '—'}</td>
      <td>${p.prod} ×${p.q}</td>
      <td>${brl(p.tot)}</td>
      <td ${venc ? 'style="color:#DC2626;font-weight:600"' : ''}>${p.dtpag ? fdt(p.dtpag) : fdt(p.dt)}${venc ? ' ⚠' : ''}</td>
      <td class="table-actions"><button class="eb small" style="background:#18181B;color:#fff;border-color:#18181B" onclick="receberPed(${p.id})">✓ Receber</button></td>
    </tr>`;
  }).join('');
}

function receberPed(id) {
  const p = DB.peds.find(x => x.id === id);
  if (!p) return;
  const c = DB.clis.find(x => x.id === p.cid);
  askConfirm(`Confirmar recebimento de ${brl(p.tot)}${c ? ' de ' + c.nm : ''}?\n\nUm lançamento de receita será registrado no financeiro.`, () => {
    p.pag = 'Recebido';
    p.st  = 'Entregue';
    const t = { id: DB.nid.t++, tp: 'receita', ds: `Recebimento pedido #${p.id}`, vl: p.tot, dt: td() };
    DB.trans.push(t);
    rReceber();
    rFin();
    rMet();
    rDashRec();
    showToast('Pagamento registrado!');
    sbSync(() => SBPeds.upsert(p));
    sbSync(() => SBTrans.upsert(t));
  });
}

/* ── Histórico de Vendas ─────────────────────────── */
let _hvSt = '';

function rHistorico() { hvUpd(); }

function hvSt(el, st) {
  _hvSt = st;
  document.querySelectorAll('.hv-chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  hvUpd();
}

function hvClear() {
  _hvSt = '';
  if ($('hv-busca')) $('hv-busca').value = '';
  if ($('hv-de'))    $('hv-de').value    = '';
  if ($('hv-ate'))   $('hv-ate').value   = '';
  if ($('hv-pag'))   $('hv-pag').value   = '';
  document.querySelectorAll('.hv-chip').forEach((c, i) => c.classList.toggle('on', i === 0));
  hvUpd();
}

function hvUpd() {
  const busca = ($('hv-busca')?.value || '').toLowerCase().trim();
  const de    = $('hv-de')?.value    || '';
  const ate   = $('hv-ate')?.value   || '';
  const pag   = ($('hv-pag')?.value  || '').toLowerCase();

  let peds = [...DB.peds].reverse();

  if (busca) peds = peds.filter(p => {
    const c = DB.clis.find(x => x.id === p.cid);
    return (c?.nm || '').toLowerCase().includes(busca) || p.prod.toLowerCase().includes(busca);
  });
  if (de)    peds = peds.filter(p => p.dt >= de);
  if (ate)   peds = peds.filter(p => p.dt <= ate);
  if (pag)   peds = peds.filter(p => p.pag.toLowerCase().includes(pag));
  if (_hvSt) peds = peds.filter(p => p.st === _hvSt);

  const tot   = peds.reduce((a, b) => a + b.tot, 0);
  const tkMed = peds.length ? tot / peds.length : 0;
  const kpis  = $('hv-kpis');
  if (kpis) kpis.innerHTML = `
    <article class="summary-card"><div>Vendas</div><div class="summary-value">${peds.length}</div><div class="summary-meta">${peds.filter(p => p.pag === 'Fiado').length} fiado</div></article>
    <article class="summary-card"><div>Total</div><div class="summary-value">${brl(tot)}</div><div class="summary-meta">no filtro atual</div></article>
    <article class="summary-card"><div>Ticket médio</div><div class="summary-value">${brl(tkMed)}</div><div class="summary-meta">por pedido</div></article>`;

  const tb = $('hvtt');
  if (!tb) return;
  if (!peds.length) {
    tb.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:22px;color:#94a3b8;font-size:13px">Nenhuma venda encontrada</td></tr>`;
    return;
  }
  const stCl = { Pendente: 'xb-gold', Confirmado: 'xb-blue', Enviado: 'xb-gray', Entregue: 'xb-green' };
  tb.innerHTML = peds.map(p => {
    const c = DB.clis.find(x => x.id === p.cid);
    return `<tr>
      <td>#${p.id}</td>
      <td>${fdt(p.dt)}</td>
      <td>${c ? c.nm : '—'}</td>
      <td>${p.prod}</td>
      <td>${brl(p.tot)}</td>
      <td>${p.pag}</td>
      <td><span class="xb ${stCl[p.st] || 'xb-gray'}">${p.st}</span></td>
      <td><select class="fi small-select" onchange="updPS(${p.id}, this.value);hvUpd()">
        ${['Pendente','Confirmado','Enviado','Entregue'].map(x => `<option${x === p.st ? ' selected' : ''}>${x}</option>`).join('')}
      </select></td>
    </tr>`;
  }).join('');
}

/* ── Solicitações (pedidos para Mary Kay) ────────── */
function rSolic() {
  const el = $('stt');
  if (!el) return;
  const stColors = { Pendente: 'xb-gold', Solicitado: 'xb-blue', Recebido: 'xb-green' };
  if (!DB.solics.length) {
    el.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:28px;color:#71717A;font-size:13px">Nenhuma solicitação cadastrada. Clique em "+ Solicitação" para adicionar.</td></tr>';
    return;
  }
  el.innerHTML = [...DB.solics].reverse().map(s => `
    <tr>
      <td>#${s.id}</td>
      <td class="cell-strong">${s.nm}</td>
      <td>${s.q} un.</td>
      <td>${s.pr ? brl(s.pr) : '—'}</td>
      <td>${s.obs || '—'}</td>
      <td>${fdt(s.dt)}</td>
      <td style="display:flex;gap:6px;align-items:center">
        <select class="fi small-select" onchange="updSolicSt(${s.id}, this.value)">${['Pendente','Solicitado','Recebido'].map(x => `<option ${x === s.st ? 'selected' : ''}>${x}</option>`).join('')}</select>
        <button class="eb small" onclick="delSolic(${s.id})">Excluir</button>
      </td>
    </tr>`).join('');
}

function updSolicSt(id, st) {
  const s = DB.solics.find(x => x.id === id);
  if (s) { s.st = st; rSolic(); showToast('Status atualizado'); sbSync(() => SBSolics.updateStatus(id, st)); }
}

function delSolic(id) {
  askConfirm('Excluir esta solicitação?', () => {
    DB.solics = DB.solics.filter(x => x.id !== id);
    rSolic();
    showToast('Solicitação removida');
    sbSync(() => SBSolics.delete(id));
  });
}

function saveSolic() {
  const nm = $('sl-nm')?.value.trim();
  if (!nm) { showToast('Informe o produto'); return; }
  const q   = parseInt($('sl-q')?.value) || 1;
  const pr  = parseFloat($('sl-pr')?.value) || null;
  const obs = $('sl-obs')?.value.trim() || '';
  const s   = { id: DB.nid.s++, nm, q, pr, obs, st: 'Pendente', dt: td() };
  DB.solics.push(s);
  rSolic();
  closeMod('msolic');
  $('sl-nm').value = '';
  $('sl-q').value  = '1';
  $('sl-pr').value = '';
  $('sl-obs').value = '';
  showToast('Solicitação criada!');
  sbSync(() => SBSolics.upsert(s));
}

function updPS(id, st) {
  const p = DB.peds.find(x => x.id === id);
  if (p) { p.st = st; rReceber(); rDashRec(); showToast('Status atualizado'); sbSync(() => SBPeds.updateStatus(id, st)); }
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
      <td class="table-actions"><button class="eb small" onclick="editCli(${c.id})">Editar</button></td>
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
      <td>${p.pd ? `<span style="text-decoration:line-through;color:#94a3b8;font-size:11px">${brl(p.pr)}</span> <strong style="color:#16a34a">${brl(p.pd)}</strong>` : brl(p.pr)}</td>
      <td>${p.pd ? brl(p.pd) : '—'}</td>
      <td>${p.dt ? `<span class="xb ${p.dt === 'new' ? 'xb-green' : 'xb-gold'}">${p.dt === 'new' ? 'Novo' : 'Promoção'}</span>` : '—'}</td>
      <td class="table-actions"><button class="eb small" onclick="editP(${p.id})">Editar</button><button class="eb small" onclick="delP(${p.id})">Excluir</button></td>
    </tr>`).join('');
}

function rFin() {
  const rec    = DB.trans.filter(t => t.tp === 'receita').reduce((a, b) => a + b.vl, 0);
  const des    = DB.trans.filter(t => t.tp === 'despesa').reduce((a, b) => a + b.vl, 0);
  const fat    = DB.peds.reduce((a, b) => a + b.tot, 0);
  $('f-r').textContent = brl(rec);
  $('f-d').textContent = brl(des);
  $('f-l').textContent = brl(rec - des);
  $('f-t').textContent = brl(DB.peds.length ? fat / DB.peds.length : 0);
  $('ftt').innerHTML = [...DB.trans].reverse().slice(0, 8).map(t => `
    <tr>
      <td>${fdt(t.dt)}</td>
      <td>${t.ds}</td>
      <td><span class="xb ${t.tp === 'receita' ? 'xb-green' : 'xb-red'}">${t.tp === 'receita' ? 'Receita' : 'Despesa'}</span></td>
      <td class="${t.tp === 'receita' ? 'revenue' : 'expense'}">${t.tp === 'receita' ? '+' : '-'} ${brl(t.vl)}</td>
    </tr>`).join('');
  rFlxChart();
}

let _nvCart = [];
let _mvCart = [];

function rNV() {
  const vc = $('vc'), vp = $('vp');
  if (vc) vc.innerHTML = DB.clis.map(c => `<option value="${c.id}">${c.nm}</option>`).join('');
  if (vp) { vp.innerHTML = DB.prods.map(p => `<option value="${p.id}">${p.em} ${p.nm} — ${brl(p.pd ?? p.pr)}${p.pd ? ' 🏷' : ''}</option>`).join(''); vUpd(); }
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
        const itensStr = p.itens ? p.itens.map(i => `${i.em || ''} ${i.nm} ×${i.q}`).join(', ') : `${p.prod} ×${p.q}`;
        return `<div class="history-item"><strong>#${p.id}</strong> · ${c ? c.nm : '—'}<br>${itensStr} · ${brl(p.tot)}</div>`;
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
}

function nvRemItem(pid) {
  _nvCart = _nvCart.filter(x => x.pid !== pid);
  nvRenderCart();
}

function nvRenderCart() {
  const el = $('nv-cart');
  if (!el) return;
  if (!_nvCart.length) {
    el.innerHTML = '';
    if ($('vt')) $('vt').textContent = 'R$ 0,00';
    if ($('vt-sub')) $('vt-sub').textContent = '';
    return;
  }
  el.innerHTML = _nvCart.map(i => `
    <div class="nv-cart-item">
      <div class="nv-cart-body">
        <div class="nv-cart-nm">${i.em} ${i.nm}</div>
        <div class="nv-cart-meta">${i.q}× · ${brl(i.pr)} cada</div>
      </div>
      <div class="nv-cart-right">
        <span class="nv-cart-pr">${brl(i.sub)}</span>
        <button class="nv-cart-rm" onclick="nvRemItem(${i.pid})" type="button">✕</button>
      </div>
    </div>`).join('');
  const tot  = _nvCart.reduce((a, b) => a + b.sub, 0);
  const parc = parseInt($('vparc')?.value) || 1;
  if ($('vt')) $('vt').textContent = brl(tot);
  if ($('vt-sub')) $('vt-sub').textContent = parc > 1 ? `${parc}× de ${brl(tot / parc)}` : '';
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
        <div class="nv-cart-nm">${i.em} ${i.nm}</div>
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
  if ($('vprev-nm')) $('vprev-nm').textContent = p.nm;
  if ($('vprev-pr')) $('vprev-pr').textContent = brl(p.pd || p.pr);
  const stEl = $('vprev-st');
  if (stEl) {
    stEl.textContent = p.st > 0 ? `${p.st} em estoque` : 'Esgotado';
    stEl.style.color = p.st > 5 ? '#16A34A' : p.st > 0 ? '#D97706' : '#DC2626';
  }
}

function saveV() {
  if (!_nvCart.length) { showToast('Adicione ao menos um produto'); return; }
  const cid  = parseInt($('vc')?.value);
  const pag  = $('vpg')?.value;
  const parc = parseInt($('vparc')?.value) || 1;
  const dtpag = $('vdtpag')?.value || td();
  const c = DB.clis.find(x => x.id === cid);
  if (!c) { showToast('Selecione um cliente'); return; }
  const tot  = _nvCart.reduce((a, b) => a + b.sub, 0);
  const id   = DB.nid.ped++;
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
    const tr = { id: DB.nid.t++, tp: 'receita', ds: `Pedido #${id}`, vl: tot, dt: dtpag };
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
  renderAll();
  rReceber();
  showToast(`Venda registrada — ${brl(tot)}${parc > 1 ? ` · ${parc}× de ${brl(tot/parc)}` : ''}`);
  showCupom(ped, c, null);
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

function saveMV() {
  if (!_mvCart.length) { showToast('Adicione ao menos um produto'); return; }
  const cid   = parseInt($('mvc')?.value);
  const pag   = $('mvpg')?.value;
  const parc  = parseInt($('mvparc')?.value) || 1;
  const dtpag = $('mvdtpag')?.value || td();
  const c = DB.clis.find(x => x.id === cid);
  if (!c) { showToast('Selecione um cliente'); return; }
  const tot       = _mvCart.reduce((a, b) => a + b.sub, 0);
  const id        = DB.nid.ped++;
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
    const mtr = { id: DB.nid.t++, tp: 'receita', ds: `Pedido #${id}`, vl: tot, dt: dtpag };
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
let _cupomPed = null, _cupomCli = null, _cupomProd = null;

function showCupom(ped, cli, prod) {
  _cupomPed = ped; _cupomCli = cli; _cupomProd = prod;
  const inner = $('cupom-inner');
  if (!inner) return;

  const now = new Date();
  const hora = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  const parcNote = ped.parc > 1 ? `${ped.parc}× de ${brl(ped.tot / ped.parc)}` : '';
  const dtpagFmt = ped.dtpag ? fdt(ped.dtpag) : fdt(ped.dt);
  const isPending = ped.dtpag && ped.dtpag > td();
  const statusHtml = isPending
    ? `<span class="cupom-status cupom-status-pend">Aguardando pagamento</span>`
    : `<span class="cupom-status cupom-status-confirm">Pagamento confirmado</span>`;

  inner.innerHTML = `
    <span class="cupom-sym">✦</span>
    <div class="cupom-brand">Milena Lima <em>Beauty</em></div>
    <div class="cupom-consult">Consultora Oficial Mary Kay</div>
    <div class="cupom-divider"></div>

    <div class="cupom-mid">
      <div class="cupom-tag">Comprovante de Venda</div>
      <div class="cupom-num">#${String(ped.id).padStart(3,'0')}</div>
      <div class="cupom-datetime">${fdt(ped.dt)} · ${hora}</div>
    </div>

    <div class="cupom-divider-dashed"></div>
    <div class="cupom-section">
      <div class="cupom-row"><span class="cupom-lbl">Cliente</span><span class="cupom-val">${cli.nm}</span></div>
    </div>

    <div class="cupom-divider-dashed"></div>
    ${(() => {
      if (ped.itens && ped.itens.length) {
        return ped.itens.map((i, idx) => `
          <div class="cupom-prod-row">
            <div class="cupom-prod-nm">${i.em || ''} ${i.nm}</div>
            <div class="cupom-prod-meta">${i.q} unidade${i.q > 1 ? 's' : ''} &middot; ${brl(i.pr)} cada &middot; ${brl(i.sub)}</div>
          </div>${idx < ped.itens.length - 1 ? '<div class="cupom-divider-dashed" style="margin:4px 0"></div>' : ''}`).join('');
      }
      return `<div class="cupom-prod-row">
        <div class="cupom-prod-nm">${prod?.em || ''} ${ped.prod}</div>
        <div class="cupom-prod-meta">${ped.q} unidade${ped.q > 1 ? 's' : ''}${prod?.pr ? ' &middot; ' + brl(prod.pr) + ' cada' : ''}</div>
      </div>`;
    })()}

    <div class="cupom-divider-dashed"></div>
    <div class="cupom-section">
      <div class="cupom-row"><span class="cupom-lbl">Pagamento</span><span class="cupom-val">${ped.pag}</span></div>
      <div class="cupom-row"><span class="cupom-lbl">Data de pagamento</span><span class="cupom-val">${dtpagFmt}</span></div>
    </div>

    <div class="cupom-divider"></div>
    <div class="cupom-total-area">
      <span class="cupom-total-lbl">Total</span>
      <div style="text-align:right">
        <div class="cupom-total-val">${brl(ped.tot)}</div>
        ${parcNote ? `<div class="cupom-parc-note">${parcNote}</div>` : ''}
      </div>
    </div>
    <div style="text-align:right">${statusHtml}</div>

    <div class="cupom-thanks">
      <p class="cupom-thanks-msg">"Obrigada pela sua escolha.<br>Você merece o melhor!"</p>
      <p class="cupom-thanks-foot">milena.lima · Mary Kay · Qualquer dúvida, chame no WhatsApp 💗</p>
    </div>
  `;

  openMod('cupom');
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
  const p = DB.prods.find(x => x.id === id);
  askConfirm(`Excluir "${p?.nm || 'este produto'}"?\n\nEsta ação não pode ser desfeita.`, () => {
    DB.prods = DB.prods.filter(x => x.id !== id);
    renderAll();
    showToast('Produto excluído');
    sbSync(() => SBProds.delete(id));
  });
}

function newCli() {
  if ($('nc-id')) $('nc-id').value = '';
  if ($('mc-title')) $('mc-title').textContent = 'Novo Cliente';
  if ($('mc-save-btn')) $('mc-save-btn').textContent = 'Cadastrar cliente';
  ['nc-nm', 'nc-tel', 'nc-em', 'nc-ci', 'nc-es'].forEach(fid => { if ($(fid)) $(fid).value = ''; });
  if ($('nc-an')) $('nc-an').value = '';
  openMod('mc');
}

function editCli(id) {
  const c = DB.clis.find(x => x.id === id);
  if (!c) return;
  if ($('nc-id')) $('nc-id').value = c.id;
  if ($('nc-nm')) $('nc-nm').value = c.nm;
  if ($('nc-tel')) $('nc-tel').value = c.tel || '';
  if ($('nc-em')) $('nc-em').value = c.em || '';
  if ($('nc-ci')) $('nc-ci').value = c.ci || '';
  if ($('nc-es')) $('nc-es').value = c.es || '';
  if ($('nc-an')) $('nc-an').value = c.an || '';
  if ($('nc-pe')) $('nc-pe').value = c.pe || 'Normal';
  if ($('mc-title')) $('mc-title').textContent = 'Editar Cliente';
  if ($('mc-save-btn')) $('mc-save-btn').textContent = 'Salvar alterações';
  openMod('mc');
}

function saveCli() {
  const eid = $('nc-id')?.value;
  const nm  = $('nc-nm').value.trim();
  if (!nm) { showToast('Informe o nome'); return; }
  const fields = {
    nm, tel: $('nc-tel').value, em: $('nc-em').value,
    ci: $('nc-ci').value, es: $('nc-es').value,
    an: $('nc-an').value, pe: $('nc-pe').value
  };
  if (eid) {
    const c = DB.clis.find(x => x.id === parseInt(eid));
    if (c) { Object.assign(c, fields); sbSync(() => SBClis.upsert({ ...c })); }
  } else {
    const c = { id: DB.nid.c++, ...fields, gasto: 0, ult: '' };
    DB.clis.push(c);
    sbSync(() => SBClis.upsert(c));
  }
  rClis();
  rNV();
  closeMod('mc');
  showToast(eid ? 'Cliente atualizado' : 'Cliente cadastrado');
}

function editPed(id) {
  const p = DB.peds.find(x => x.id === id);
  if (!p) return;
  if ($('med-id')) $('med-id').value = p.id;
  const sel = $('med-c');
  if (sel) sel.innerHTML = DB.clis.map(c => `<option value="${c.id}"${c.id === p.cid ? ' selected' : ''}>${c.nm}</option>`).join('');
  const pagBase = p.pag ? p.pag.replace(/\s+\d+×$/, '') : 'PIX';
  if ($('med-pg')) $('med-pg').value = pagBase;
  if ($('med-parc')) $('med-parc').value = p.parc || 1;
  if ($('med-dtpag')) $('med-dtpag').value = p.dtpag || p.dt;
  if ($('med-tot')) $('med-tot').value = p.tot;
  if ($('med-st')) $('med-st').value = p.st;
  openMod('med');
}

function savePedEdit() {
  const id    = parseInt($('med-id')?.value);
  const p     = DB.peds.find(x => x.id === id);
  if (!p) return;
  const cid   = parseInt($('med-c')?.value);
  const pag   = $('med-pg')?.value;
  const parc  = parseInt($('med-parc')?.value) || 1;
  const dtpag = $('med-dtpag')?.value || p.dtpag;
  const tot   = parseFloat($('med-tot')?.value) || p.tot;
  const st    = $('med-st')?.value;
  const pagLabel = parc > 1 ? `${pag} ${parc}×` : pag;
  const oldCli = DB.clis.find(x => x.id === p.cid);
  const newCli = DB.clis.find(x => x.id === cid);
  if (p.cid !== cid) {
    if (oldCli) { oldCli.gasto = Math.max(0, (oldCli.gasto || 0) - p.tot); sbSync(() => SBClis.update(p.cid, { gasto: oldCli.gasto })); }
    if (newCli) { newCli.gasto = (newCli.gasto || 0) + tot; sbSync(() => SBClis.update(cid, { gasto: newCli.gasto })); }
  } else if (oldCli && tot !== p.tot) {
    oldCli.gasto = Math.max(0, (oldCli.gasto || 0) - p.tot + tot);
    sbSync(() => SBClis.update(p.cid, { gasto: oldCli.gasto }));
  }
  const wasfiado = p.pag === 'Fiado';
  const nowFiado = pag === 'Fiado';
  const tr = DB.trans.find(t => t.ds === `Pedido #${id}`);
  if (wasfiado && !nowFiado) {
    // Fiado → Pago: criar transação de receita
    const newTr = { id: DB.nid.t++, tp: 'receita', ds: `Pedido #${id}`, vl: tot, dt: dtpag };
    DB.trans.push(newTr);
    sbSync(() => SBTrans.upsert(newTr));
  } else if (!wasfiado && nowFiado && tr) {
    // Pago → Fiado: remover transação existente
    DB.trans = DB.trans.filter(t => t.ds !== `Pedido #${id}`);
    sbSync(() => _sbClient?.from('transactions').delete().eq('id', tr.id));
  } else if (tr) {
    // Pago → Pago: atualizar valor/data da transação existente
    tr.vl = tot; tr.dt = dtpag; sbSync(() => SBTrans.upsert(tr));
  }
  Object.assign(p, { cid, pag: pagLabel, parc, dtpag, tot, st });
  sbSync(() => SBPeds.upsert(p));
  renderAll();
  closeMod('med');
  showToast('Pedido atualizado');
}

function askConfirm(msg, onYes) {
  if ($('mconf-msg')) $('mconf-msg').textContent = msg;
  const ok = $('mconf-ok');
  if (ok) ok.onclick = () => { closeMod('mconf'); onYes(); };
  openMod('mconf');
}

function confirmV() {
  if (!_nvCart.length) { showToast('Adicione ao menos um produto'); return; }
  const cid = parseInt($('vc')?.value);
  const c = DB.clis.find(x => x.id === cid);
  if (!c) { showToast('Selecione um cliente'); return; }
  const tot = _nvCart.reduce((a, b) => a + b.sub, 0);
  const resumo = _nvCart.length === 1 ? _nvCart[0].nm : `${_nvCart.length} produtos`;
  askConfirm(`Registrar venda de ${brl(tot)} para ${c.nm}?\n\n${resumo}`, saveV);
}

function confirmMV() {
  if (!_mvCart.length) { showToast('Adicione ao menos um produto'); return; }
  const cid = parseInt($('mvc')?.value);
  const c = DB.clis.find(x => x.id === cid);
  if (!c) { showToast('Selecione um cliente'); return; }
  const tot = _mvCart.reduce((a, b) => a + b.sub, 0);
  const resumo = _mvCart.length === 1 ? _mvCart[0].nm : `${_mvCart.length} produtos`;
  askConfirm(`Confirmar venda de ${brl(tot)} para ${c.nm}?\n\n${resumo}`, saveMV);
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
    const data = ym.map(m => DB.peds.filter(p => p.dt?.startsWith(m)).reduce((a, b) => a + b.tot, 0));
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
        const fat = pedsMes.reduce((a, b) => a + b.tot, 0);
        const n   = new Set(pedsMes.map(p => p.cid)).size;
        const qtd = pedsMes.length;
        const [y, mo] = m.split('-');
        return `<tr><td>${mnNames[parseInt(mo) - 1]} ${y}</td><td>${qtd}</td><td>${brl(fat)}</td><td>${brl(qtd ? fat / qtd : 0)}</td><td>${n}</td><td><span class="xb ${fat > 0 ? 'xb-green' : 'xb-gray'}">${fat > 0 ? 'Com vendas' : 'Sem vendas'}</span></td></tr>`;
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
  initBanner();
  showExtPopup();

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
