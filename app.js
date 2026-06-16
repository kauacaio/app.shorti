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

function initRealtimeOrders() {
  if (!window._sbClient || window._localMode) return;
  window._sbClient
    .channel('realtime-orders')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
      const r   = payload.new;
      const ped = { id: r.id, cid: r.cid, prod: r.prod, q: r.q, tot: Number(r.tot), pag: r.pag, parc: r.parc || 1, dtpag: r.dtpag || r.dt, itens: r.itens || null, st: r.st, dt: r.dt };
      if (DB.peds.find(p => p.id === ped.id)) return;
      DB.peds.push(ped);
      if (ped.id >= DB.nid.ped) DB.nid.ped = ped.id + 1;
      if (typeof genAutoNotifs === 'function') genAutoNotifs();
      rMet();
      rReceber();
      rDashRec();
    })
    .subscribe();
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
  if (typeof genAutoNotifs === 'function') genAutoNotifs();
}

/* Greeting com nome real do usuário logado */
async function rGreeting() {
  const h     = new Date().getHours();
  const greet = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const emoji = h < 12 ? '☀️' : h < 18 ? '👋' : '🌙';

  /* Tenta pegar o nome do usuário logado via Supabase */
  let nome = 'você';
  try {
    if (typeof SBAuth !== 'undefined') {
      const session = await SBAuth.getSession();
      if (session?.user) {
        const meta = session.user.user_metadata || {};
        nome = meta.full_name || meta.name ||
               (session.user.email ? session.user.email.split('@')[0] : 'você');
        /* Capitaliza primeira letra */
        nome = nome.charAt(0).toUpperCase() + nome.slice(1);
      }
    }
  } catch(e) {}

  /* Fallback: usa nome das configurações da loja */
  if (nome === 'você' && DB.settings?.heroKicker) {
    nome = DB.settings.heroKicker.replace('Consultora Oficial Mary Kay','').replace('Consultora','').trim().split(' ')[0] || 'você';
  }

  const dias  = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const now   = new Date();
  const hi    = $('dash-hello');
  const dt    = $('dash-date');
  if (hi) hi.textContent = `${greet}, ${nome}! ${emoji}`;
  if (dt) dt.textContent = `${dias[now.getDay()]}, ${now.getDate()} de ${meses[now.getMonth()]} de ${now.getFullYear()}`;
}

function rMet() {
  rGreeting();
  rDashAttention();

  /* Mês atual vs mês anterior */
  const now  = new Date();
  const curM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const prvM = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`;

  const pedsCur  = DB.peds.filter(p => p.dt?.startsWith(curM));
  const pedsPrv  = DB.peds.filter(p => p.dt?.startsWith(prvM));
  const fatCur   = pedsCur.reduce((a,b) => a+b.tot, 0);
  const fatPrv   = pedsPrv.reduce((a,b) => a+b.tot, 0);
  const fatPct   = fatPrv > 0 ? Math.round(((fatCur-fatPrv)/fatPrv)*100) : null;

  const fiados   = DB.peds.filter(p => p.pag === 'Fiado');
  const aRec     = fiados.reduce((a,b) => a+b.tot, 0);

  const est      = DB.prods.reduce((a,b) => a+b.st, 0);
  const baixo    = DB.prods.filter(p => p.st <= 3).length;

  /* Novos clientes este mês */
  const novosCli = DB.clis.filter(c => c.ult?.startsWith(curM)).length;

  /* Trend badge */
  function trend(pct) {
    if (pct === null) return `<span class="mc-trend mc-trend-neu">Novo mês</span>`;
    if (pct > 0)  return `<span class="mc-trend mc-trend-up">↑ ${pct}% vs mês anterior</span>`;
    if (pct < 0)  return `<span class="mc-trend mc-trend-dn">↓ ${Math.abs(pct)}% vs mês anterior</span>`;
    return `<span class="mc-trend mc-trend-neu">= igual ao mês anterior</span>`;
  }

  const iconFat = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`;
  const iconPed = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>`;
  const iconCli = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>`;
  const iconRec = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M14.5 10a2.5 2.5 0 00-5 0c0 1.38 1.12 2.5 2.5 2.5s2.5 1.12 2.5 2.5a2.5 2.5 0 01-5 0"/></svg>`;

  $('mgrid').innerHTML = `
    <article class="mc mc-green" onclick="epage('extrato',null)" style="cursor:pointer">
      <div class="mc-top">
        <span class="mc-label">Faturamento este mês</span>
        <div class="mc-icon mc-icon-green">${iconFat}</div>
      </div>
      <div class="mc-value">${brl(fatCur)}</div>
      <div class="mc-meta">${trend(fatPct)}</div>
    </article>
    <article class="mc mc-blue" onclick="epage('historico',null)" style="cursor:pointer">
      <div class="mc-top">
        <span class="mc-label">Pedidos este mês</span>
        <div class="mc-icon mc-icon-blue">${iconPed}</div>
      </div>
      <div class="mc-value">${pedsCur.length}</div>
      <div class="mc-meta">
        ${pedsPrv.length > 0
          ? trend(Math.round(((pedsCur.length - pedsPrv.length)/pedsPrv.length)*100))
          : `<span class="mc-trend mc-trend-neu">${DB.peds.length} no total</span>`}
      </div>
    </article>
    <article class="mc mc-violet" onclick="epage('clientes',null)" style="cursor:pointer">
      <div class="mc-top">
        <span class="mc-label">Clientes</span>
        <div class="mc-icon mc-icon-violet">${iconCli}</div>
      </div>
      <div class="mc-value">${DB.clis.length}</div>
      <div class="mc-meta">
        ${novosCli > 0
          ? `<span class="mc-trend mc-trend-up">+${novosCli} novos este mês</span>`
          : `<span class="mc-trend mc-trend-neu">cadastrados</span>`}
      </div>
    </article>
    <article class="mc mc-orange" onclick="epage('receber',null)" style="cursor:pointer">
      <div class="mc-top">
        <span class="mc-label">A receber (fiado)</span>
        <div class="mc-icon mc-icon-orange">${iconRec}</div>
      </div>
      <div class="mc-value">${brl(aRec)}</div>
      <div class="mc-meta">
        ${fiados.length > 0
          ? `<span class="mc-trend mc-trend-dn">${fiados.length} venda${fiados.length>1?'s':''} pendente${fiados.length>1?'s':''}</span>`
          : `<span class="mc-trend mc-trend-up">Tudo recebido ✓</span>`}
      </div>
    </article>`;
}

/* ── Atividade recente — lista paginada ── */
let _recPage = 0;
const REC_PER_PAGE = 5;

function rDashRec(page) {
  if (page !== undefined) _recPage = page;
  const el = $('dash-rec');
  if (!el) return;

  const todos = [...DB.peds].reverse();
  if (!todos.length) {
    el.innerHTML = '<p class="small-note" style="padding:20px 0;text-align:center;color:var(--tx-s)">Nenhum pedido ainda. <a href="#" onclick="openMod(\'mv\')" style="color:var(--gl)">Registrar primeira venda →</a></p>';
    return;
  }

  const total   = todos.length;
  const pages   = Math.ceil(total / REC_PER_PAGE);
  _recPage      = Math.max(0, Math.min(_recPage, pages - 1));
  const slice   = todos.slice(_recPage * REC_PER_PAGE, (_recPage + 1) * REC_PER_PAGE);

  const stCls = { Pendente:'xb-gold', Confirmado:'xb-blue', Enviado:'xb-gray', Entregue:'xb-green' };
  const avatarColors = ['--blue-bg,--blue','--violet-bg,--violet','--green-bg,--green','--orange-bg,--orange'];

  const rows = slice.map((p, idx) => {
    const c   = DB.clis.find(x => x.id === p.cid);
    const nm  = c ? c.nm : '—';
    const ini = nm.split(' ').filter(Boolean).map(w => w[0]).slice(0,2).join('').toUpperCase();
    const prod = p.itens && p.itens.length > 1
      ? `${p.itens[0].nm} +${p.itens.length - 1}`
      : (p.itens?.[0]?.nm || p.prod);
    const [bg, fg] = avatarColors[idx % avatarColors.length].split(',');
    return `<div class="order-item" onclick="editPed(${p.id})">
      <div class="order-avatar" style="background:var(${bg});color:var(${fg})">${ini}</div>
      <div class="order-info">
        <div class="order-name">${nm}</div>
        <div class="order-product">${prod} · ${fdt(p.dt)}</div>
      </div>
      <div class="order-right">
        <div class="order-value">${brl(p.tot)}</div>
        <span class="xb ${stCls[p.st]||'xb-gray'}">${p.st}</span>
      </div>
    </div>`;
  }).join('');

  const from = _recPage * REC_PER_PAGE + 1;
  const to   = Math.min(from + REC_PER_PAGE - 1, total);

  const pagination = pages <= 1 ? '' : `
    <div class="list-pagination">
      <span class="lp-info">${from}–${to} de ${total}</span>
      <div class="lp-btns">
        <button class="lp-btn" onclick="rDashRec(${_recPage - 1})" ${_recPage === 0 ? 'disabled' : ''}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button class="lp-btn" onclick="rDashRec(${_recPage + 1})" ${_recPage >= pages - 1 ? 'disabled' : ''}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>`;

  el.innerHTML = rows + pagination;
}

/* ── Precisa de atenção — compacto, limpo ── */
let _atnPage = 0;
const ATN_PER_PAGE = 4;

function rDashAttention(page) {
  if (page !== undefined) _atnPage = page;
  const el = $('dash-attention');
  if (!el) return;

  const vencidos = DB.peds.filter(p => p.pag === 'Fiado' && p.dtpag && p.dtpag < td());
  const critico  = DB.prods.filter(p => p.st <= 2);

  /* Estado vazio — minimalista */
  if (!vencidos.length && !critico.length) {
    el.innerHTML = `
      <div class="atn-empty">
        <div class="atn-empty-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <div class="atn-empty-title">Tudo em dia</div>
        <div class="atn-empty-sub">Sem pendências no momento.</div>
      </div>`;
    return;
  }

  /* Monta lista unificada — fiados primeiro, depois estoque */
  const items = [
    ...vencidos.map(p => ({ tipo: 'fiado', p })),
    ...critico.map(p  => ({ tipo: 'estoque', p }))
  ];

  const total = items.length;
  const pages = Math.ceil(total / ATN_PER_PAGE);
  _atnPage = Math.max(0, Math.min(_atnPage, pages - 1));
  const slice = items.slice(_atnPage * ATN_PER_PAGE, (_atnPage + 1) * ATN_PER_PAGE);

  const rows = slice.map(({ tipo, p }) => {
    if (tipo === 'fiado') {
      const c    = DB.clis.find(x => x.id === p.cid);
      const nm   = c?.nm || '—';
      const dias = Math.round((new Date() - new Date(p.dtpag + 'T12:00')) / 86400000);
      return `
        <div class="atn-row">
          <div class="atn-dot atn-dot-red"></div>
          <div class="atn-row-info">
            <span class="atn-row-name">${nm}</span>
            <span class="atn-row-sub">há ${dias} dia${dias!==1?'s':''}</span>
          </div>
          <span class="atn-row-val">${brl(p.tot)}</span>
          <button class="atn-row-btn atn-row-btn-red" onclick="event.stopPropagation();receberPed(${p.id})">Receber</button>
        </div>`;
    } else {
      return `
        <div class="atn-row" onclick="epage('estoque',null)">
          <div class="atn-dot atn-dot-orange"></div>
          <div class="atn-row-info">
            <span class="atn-row-name">${p.em || ''} ${p.nm}</span>
            <span class="atn-row-sub">${p.st === 0 ? 'Esgotado' : `${p.st} un. restante${p.st!==1?'s':''}`}</span>
          </div>
          <button class="atn-row-btn atn-row-btn-orange" onclick="event.stopPropagation();openMod('msolic')">Solicitar</button>
        </div>`;
    }
  }).join('');

  const from = _atnPage * ATN_PER_PAGE + 1;
  const to   = Math.min(from + ATN_PER_PAGE - 1, total);
  const pagination = pages <= 1 ? '' : `
    <div class="list-pagination">
      <span class="lp-info">${from}–${to} de ${total}</span>
      <div class="lp-btns">
        <button class="lp-btn" onclick="rDashAttention(${_atnPage-1})" ${_atnPage===0?'disabled':''}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button class="lp-btn" onclick="rDashAttention(${_atnPage+1})" ${_atnPage>=pages-1?'disabled':''}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>`;

  el.innerHTML = rows + pagination;
}

/* rDashLow — mantida para compatibilidade com outras páginas */
function rDashLow() {
  const low = DB.prods.filter(p => p.st <= 5);
  if (!$('dash-low')) return;
  if (!low.length) { $('dash-low').innerHTML = '<p class="small-note" style="padding:16px 0">✓ Todos os produtos OK</p>'; return; }
  $('dash-low').innerHTML = low.map(p => {
    const pct = Math.min(100, Math.round((p.st/10)*100));
    const barCls = p.st===0?'stock-bar-out':p.st<=2?'stock-bar-low':'stock-bar-ok';
    return `<div class="stock-item">
      <div class="stock-emoji">${p.em||'📦'}</div>
      <div class="stock-info">
        <div class="stock-name">${p.nm}</div>
        <div class="stock-bar-wrap"><div class="stock-bar-fill ${barCls}" style="width:${pct}%"></div></div>
      </div>
      <span class="xb ${p.st===0?'xb-red':'xb-gold'}">${p.st} un.</span>
    </div>`;
  }).join('');
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
      <td style="color:var(--tx-m);font-size:12.5px">#${p.id}</td>
      <td>${fdt(p.dt)}</td>
      <td style="font-weight:500">${c ? c.nm : '—'}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.prod}</td>
      <td style="font-weight:600">${brl(p.tot)}</td>
      <td style="color:var(--tx-m)">${p.pag}</td>
      <td><span class="xb ${stCl[p.st] || 'xb-gray'}">${p.st}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          <select class="fi small-select" onchange="updPS(${p.id}, this.value);hvUpd()">
            ${['Pendente','Confirmado','Enviado','Entregue'].map(x => `<option${x === p.st ? ' selected' : ''}>${x}</option>`).join('')}
          </select>
          <button class="cupom-row-btn" onclick="gerarCupomPedido(${p.id})" title="Gerar cupom fiscal">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Cupom
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ── Solicitações (pedidos para Mary Kay) ────────── */
let _solicFtr = '';

function solcFtr(btn, val) {
  _solicFtr = val;
  document.querySelectorAll('.solic-fc').forEach(b => b.classList.toggle('on', b === btn));
  rSolic();
}

function rSolic() {
  const el = $('stt');
  if (!el) return;

  const busca = ($('solic-busca')?.value || '').toLowerCase().trim();
  let items = [...DB.solics].reverse();
  if (_solicFtr) items = items.filter(s => s.st === _solicFtr);
  if (busca)     items = items.filter(s => s.nm.toLowerCase().includes(busca) || (s.obs||'').toLowerCase().includes(busca));

  const stXb = { Pendente: 'xb-gold', Solicitado: 'xb-blue', Recebido: 'xb-green' };

  if (!items.length) {
    el.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:#94A3B8;font-size:13px">
      ${busca || _solicFtr ? 'Nenhum resultado encontrado.' : 'Nenhuma solicitação ainda. Clique em <strong>+ Solicitação</strong> para adicionar.'}
    </td></tr>`;
    return;
  }

  el.innerHTML = items.map(s => `
    <tr>
      <td style="color:#94A3B8;font-size:12px">#${String(s.id).padStart(3,'0')}</td>
      <td class="cell-strong">${s.nm}</td>
      <td>${s.q} un.</td>
      <td>${s.pr ? brl(s.pr) : '—'}</td>
      <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.obs || '—'}</td>
      <td>${fdt(s.dt)}</td>
      <td><span class="xb ${stXb[s.st] || 'xb-gray'}">${s.st}</span></td>
      <td class="table-actions">
        <button class="eb small" onclick="editSolic(${s.id})">Editar</button>
        <button class="eb small" onclick="delSolic(${s.id})">Excluir</button>
      </td>
    </tr>`).join('');
}

function newSolic() {
  if ($('sl-id'))    $('sl-id').value = '';
  if ($('sl-nm'))    $('sl-nm').value = '';
  if ($('sl-q'))     $('sl-q').value  = '1';
  if ($('sl-pr'))    $('sl-pr').value = '';
  if ($('sl-obs'))   $('sl-obs').value = '';
  if ($('sl-st'))    $('sl-st').value = 'Pendente';
  const row = $('sl-status-row'); if (row) row.style.display = 'none';
  slSetSt(null, 'Pendente');
  if ($('msolic-title'))    $('msolic-title').textContent    = 'Nova Solicitação';
  if ($('msolic-save-btn')) $('msolic-save-btn').textContent = 'Criar solicitação';
  openMod('msolic');
}

function editSolic(id) {
  const s = DB.solics.find(x => x.id === id);
  if (!s) return;
  if ($('sl-id'))  $('sl-id').value  = s.id;
  if ($('sl-nm'))  $('sl-nm').value  = s.nm;
  if ($('sl-q'))   $('sl-q').value   = s.q;
  if ($('sl-pr'))  $('sl-pr').value  = s.pr || '';
  if ($('sl-obs')) $('sl-obs').value = s.obs || '';
  if ($('sl-st'))  $('sl-st').value  = s.st;
  const row = $('sl-status-row'); if (row) row.style.display = 'flex';
  slSetSt(null, s.st);
  if ($('msolic-title'))    $('msolic-title').textContent    = 'Editar Solicitação';
  if ($('msolic-save-btn')) $('msolic-save-btn').textContent = 'Salvar alterações';
  openMod('msolic');
}

function slSetSt(btn, val) {
  if ($('sl-st')) $('sl-st').value = val;
  document.querySelectorAll('#sl-status-row .pay-chip').forEach(b => {
    b.classList.toggle('on', b.textContent.trim().includes(val));
  });
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
  const eid = $('sl-id')?.value;
  const q   = parseInt($('sl-q')?.value)   || 1;
  const pr  = parseFloat($('sl-pr')?.value) || null;
  const obs = $('sl-obs')?.value.trim()    || '';
  const st  = $('sl-st')?.value            || 'Pendente';

  if (eid) {
    const s = DB.solics.find(x => x.id === parseInt(eid));
    if (s) { Object.assign(s, { nm, q, pr, obs, st }); sbSync(() => SBSolics.upsert(s)); }
    showToast('Solicitação atualizada ✓');
  } else {
    const s = { id: DB.nid.s++, nm, q, pr, obs, st: 'Pendente', dt: td() };
    DB.solics.push(s);
    sbSync(() => SBSolics.upsert(s));
    showToast('Solicitação criada ✓');
  }
  rSolic();
  closeMod('msolic');
}

function updPS(id, st) {
  const p = DB.peds.find(x => x.id === id);
  if (p) { p.st = st; rReceber(); rDashRec(); showToast('Status atualizado'); sbSync(() => SBPeds.updateStatus(id, st)); }
}

/* ── Estoque — estado dos filtros ── */
let _estCat = '', _estSt = '';

function estCat(el, cat) {
  _estCat = cat;
  document.querySelectorAll('.est-cat-chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  rEst();
}
function estSt(el, st) {
  _estSt = st;
  document.querySelectorAll('.est-st-chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  rEst();
}

function rEst() {
  const el = $('est-list');
  if (!el) {
    /* compatibilidade: se vier da renderAll sem o novo HTML */
    if ($('ett')) $('ett').innerHTML = DB.prods.map(p =>
      `<tr><td>${p.em} <span class="cell-strong">${p.nm}</span></td><td>${cNm[p.cat]}</td><td>${brl(p.pr)}</td>
       <td><span class="xb ${p.st===0?'xb-red':p.st<=3?'xb-gold':'xb-green'}">${p.st}</span></td>
       <td><span class="xb ${p.st===0?'xb-red':p.st<=5?'xb-gold':'xb-green'}">${p.st===0?'Esgotado':p.st<=5?'Baixo':'OK'}</span></td>
       <td class="table-actions"><button class="eb small" onclick="editP(${p.id})">Editar</button>
       <input type="number" value="${p.st}" min="0" class="small-input" onchange="updSt(${p.id},this.value)"></td></tr>`
    ).join('');
    return;
  }

  const busca = ($('est-busca')?.value || '').toLowerCase();

  /* Mobile: mostra lista só quando há busca ativa */
  const section = $('ep-estoque');
  if (section) section.classList.toggle('est-search-active', busca.length > 0);

  let prods   = [...DB.prods];
  if (busca)             prods = prods.filter(p => p.nm.toLowerCase().includes(busca) || (p.em||'').includes(busca));
  if (_estCat)           prods = prods.filter(p => p.cat === _estCat);
  if (_estSt === 'ok')       prods = prods.filter(p => p.st > 5);
  if (_estSt === 'baixo')    prods = prods.filter(p => p.st > 0 && p.st <= 5);
  if (_estSt === 'esgotado') prods = prods.filter(p => p.st === 0);

  if (!prods.length) {
    el.innerHTML = '<div class="est-empty">Nenhum produto encontrado.</div>';
    return;
  }

  /* Agrupar por categoria */
  const catOrder = ['pele','maquiagem','corpo','fragrancias'];
  const groups   = {};
  prods.forEach(p => { if (!groups[p.cat]) groups[p.cat] = []; groups[p.cat].push(p); });

  let html = '';
  catOrder.forEach(cat => {
    if (!groups[cat]) return;
    const list = groups[cat];
    html += `<div class="est-group-hd">
      <span class="est-group-name">${cNm[cat] || cat}</span>
      <span class="xb xb-gray">${list.length} produto${list.length!==1?'s':''}</span>
    </div>`;
    html += list.map(p => {
      const stCls = p.st === 0 ? 'xb-red' : p.st <= 5 ? 'xb-gold' : 'xb-green';
      const stLbl = p.st === 0 ? 'Esgotado' : p.st <= 5 ? 'Baixo' : 'OK';
      const dotClr= p.st === 0 ? '#EF4444' : p.st <= 5 ? '#D97706' : '#059669';
      const thumb = p.img
        ? `<div class="est-thumb"><img src="${p.img}" alt="${p.nm}"></div>`
        : `<div class="est-thumb">${p.em || '📦'}</div>`;
      return `<div class="est-row" onclick="showProdDetail(${p.id})">
        ${thumb}
        <div class="est-row-info">
          <div class="est-row-nm">${p.nm}${p.pd ? ` <span class="est-promo-tag">🏷 ${brl(p.pd)}</span>` : ''}</div>
          <div class="est-row-meta">${cNm[p.cat] || p.cat} · ${brl(p.pr)}</div>
        </div>
        <div class="est-row-right">
          <div class="est-qty-badge" style="color:${dotClr}">
            <span class="est-qty-dot" style="background:${dotClr}"></span>
            ${p.st} un.
          </div>
          <span class="xb ${stCls}">${stLbl}</span>
        </div>
      </div>`;
    }).join('');
  });

  el.innerHTML = html;
}

/* ── Métricas de estoque ── */
function showEstMetrics() {
  const total  = DB.prods.length;
  const units  = DB.prods.reduce((a,b) => a+b.st, 0);
  const valor  = DB.prods.reduce((a,b) => a+(b.pd||b.pr)*b.st, 0);
  const ok     = DB.prods.filter(p => p.st > 5).length;
  const baixo  = DB.prods.filter(p => p.st > 0 && p.st <= 5).length;
  const zero   = DB.prods.filter(p => p.st === 0).length;

  /* Top vendidos */
  const sold = {};
  DB.peds.forEach(p => {
    if (p.itens) p.itens.forEach(i => { sold[i.nm] = (sold[i.nm]||0)+i.q; });
    else sold[p.prod] = (sold[p.prod]||0)+p.q;
  });
  const top = Object.entries(sold).sort((a,b)=>b[1]-a[1]).slice(0,5);

  $('estq-mc').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:18px">
      <div class="mc mc-blue"  style="padding:14px;gap:6px">
        <div class="mc-label">Produtos</div>
        <div class="mc-value" style="font-size:22px">${total}</div>
      </div>
      <div class="mc mc-green" style="padding:14px;gap:6px">
        <div class="mc-label">Unidades</div>
        <div class="mc-value" style="font-size:22px">${units}</div>
      </div>
      <div class="mc mc-violet" style="padding:14px;gap:6px">
        <div class="mc-label">Valor em estoque</div>
        <div class="mc-value" style="font-size:16px">${brl(valor)}</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">
      <span class="xb xb-green" style="padding:6px 14px;font-size:12px">✓ OK: ${ok}</span>
      <span class="xb xb-gold"  style="padding:6px 14px;font-size:12px">↓ Baixo: ${baixo}</span>
      <span class="xb xb-red"   style="padding:6px 14px;font-size:12px">✕ Esgotado: ${zero}</span>
    </div>
    ${top.length ? `
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--tx-s);margin-bottom:10px">Mais vendidos</div>
      ${top.map(([nm,q],i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #F3F4F6">
          <span style="font-size:13px;color:var(--tx);font-weight:500">${i+1}. ${nm}</span>
          <span style="font-size:12.5px;font-weight:600;color:var(--tx-m)">${q} un. vendidas</span>
        </div>`).join('')}
    ` : ''}`;
  openMod('mestq');
}

/* ── Detalhe do produto ── */
let _curProd = null;
function showProdDetail(id) {
  _curProd = id;
  const p = DB.prods.find(x => x.id === id);
  if (!p) return;

  const peds = DB.peds.filter(ped =>
    ped.itens ? ped.itens.some(i => i.nm === p.nm) : ped.prod === p.nm
  );
  const totalQ = peds.reduce((a, ped) =>
    a + (ped.itens ? ped.itens.filter(i=>i.nm===p.nm).reduce((s,i)=>s+i.q,0) : ped.q), 0
  );

  const maxSt  = Math.max(p.st+3, 10);
  const pct    = p.st===0 ? 0 : Math.min(100, Math.round((p.st/maxSt)*100));
  const barClr = p.st===0 ? 'var(--err)' : p.st<=5 ? 'var(--warn)' : 'var(--green)';
  const stMsg  = p.st===0 ? 'Esgotado' : p.st<=5 ? 'Estoque baixo' : 'Estoque saudável';

  $('prod-drawer-title').textContent = p.nm;
  $('prod-del-btn').onclick  = () => { closeProdDetail(); delP(id); };
  $('prod-edit-btn').onclick = () => { closeProdDetail(); editP(id); };

  $('prod-drawer-body').innerHTML = `
    <!-- Cabeçalho do produto -->
    <div style="display:flex;align-items:center;gap:14px;padding-bottom:18px;border-bottom:1px solid #F3F4F6;margin-bottom:18px">
      <div style="width:54px;height:54px;border-radius:14px;background:#F9FAFB;display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;overflow:hidden">
        ${p.img ? `<img src="${p.img}" style="width:100%;height:100%;object-fit:cover">` : (p.em||'📦')}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:15px;font-weight:700;color:var(--tx)">${p.nm}</div>
        <div style="font-size:12.5px;color:var(--tx-m);margin-top:2px">${cNm[p.cat]||p.cat}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
          <span style="font-size:14px;font-weight:700;color:var(--tx)">${brl(p.pr)}</span>
          ${p.pd?`<span style="font-size:12px;color:var(--green);font-weight:600">🏷 ${brl(p.pd)}</span>`:''}
        </div>
      </div>
    </div>

    <!-- Gauge do estoque -->
    <div style="margin-bottom:18px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:13px;font-weight:600;color:var(--tx)">Estoque atual</span>
        <span style="font-size:15px;font-weight:700;color:var(--tx)">${p.st} un.</span>
      </div>
      <div style="height:8px;background:#F3F4F6;border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${barClr};border-radius:4px;transition:width .4s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px">
        <span style="font-size:12px;color:var(--tx-m)">${stMsg}</span>
        <button class="eb" onclick="openMod('msolic')" style="font-size:11.5px">+ Solicitar reposição</button>
      </div>
    </div>

    <!-- Stats -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px">
      <div style="background:#F9FAFB;border-radius:10px;padding:14px">
        <div style="font-size:11.5px;color:var(--tx-m);margin-bottom:4px">Unidades vendidas</div>
        <div style="font-size:22px;font-weight:700;color:var(--tx);letter-spacing:-.04em">${totalQ}</div>
      </div>
      <div style="background:#F9FAFB;border-radius:10px;padding:14px">
        <div style="font-size:11.5px;color:var(--tx-m);margin-bottom:4px">Pedidos incluindo</div>
        <div style="font-size:22px;font-weight:700;color:var(--tx);letter-spacing:-.04em">${peds.length}</div>
      </div>
    </div>

    ${p.desc ? `<div style="font-size:13px;color:var(--tx-m);line-height:1.6;padding:12px 14px;background:#F9FAFB;border-radius:10px;margin-bottom:18px">${p.desc}</div>` : ''}

    <!-- Últimos pedidos -->
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--tx-s);margin-bottom:10px">Últimos pedidos</div>
    ${peds.length ? [...peds].slice(-5).reverse().map(ped => {
      const c = DB.clis.find(x => x.id === ped.cid);
      const stCls = {Pendente:'xb-gold',Confirmado:'xb-blue',Enviado:'xb-gray',Entregue:'xb-green'};
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #F3F4F6">
        <div>
          <div style="font-size:13px;font-weight:500;color:var(--tx)">${c?.nm||'—'}</div>
          <div style="font-size:11.5px;color:var(--tx-m)">${fdt(ped.dt)}</div>
        </div>
        <span class="xb ${stCls[ped.st]||'xb-gray'}">${ped.st}</span>
      </div>`;
    }).join('')
    : `<p style="font-size:13px;color:var(--tx-m);text-align:center;padding:16px 0">Nenhum pedido com este produto.</p>`}
  `;

  $('prod-backdrop').classList.add('on');
  $('prod-drawer').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeProdDetail() {
  $('prod-backdrop').classList.remove('on');
  $('prod-drawer').classList.remove('open');
  document.body.style.overflow = '';
}

function updSt(id, v) {
  const p = DB.prods.find(x => x.id === id);
  if (p) { p.st = parseInt(v) || 0; rEst(); rDashLow(); rMet(); showToast('Estoque atualizado'); sbSync(() => SBProds.updateStock(id, p.st)); }
}

/* Paleta de cores para avatar (determinística pelo nome) */
function _cliColor(nm) {
  const palette = ['#2563EB','#7C3AED','#059669','#D97706','#DC2626','#0891B2','#9333EA','#16A34A'];
  let h = 0; for (let i = 0; i < nm.length; i++) h = nm.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

function rClis() {
  const busca = ($('cli-busca')?.value || '').toLowerCase().trim();
  let clis = [...DB.clis];
  if (busca) clis = clis.filter(c =>
    c.nm.toLowerCase().includes(busca) ||
    (c.tel||'').includes(busca) ||
    (c.em||'').toLowerCase().includes(busca)
  );
  clis.sort((a,b) => b.gasto - a.gasto);

  if (!clis.length) {
    $('ctt').innerHTML = `<tr><td colspan="7" style="text-align:center;padding:28px;color:#94A3B8;font-size:13px">${busca ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}</td></tr>`;
    return;
  }

  $('ctt').innerHTML = clis.map(c => {
    const ini   = c.nm.trim()[0]?.toUpperCase() || '?';
    const color = _cliColor(c.nm);
    const tel   = c.tel ? `<a href="tel:${c.tel}" onclick="event.stopPropagation()" style="color:inherit">${c.tel}</a>` : '—';
    return `<tr style="cursor:pointer" onclick="openCliProfile(${c.id})">
      <td>
        <div class="cli-row-name">
          <span class="cli-avatar" style="background:${color}">${ini}</span>
          <div>
            <div class="cli-row-nm">${c.nm}</div>
            ${c.em ? `<div class="cli-row-sub">${c.em}</div>` : ''}
          </div>
        </div>
      </td>
      <td>${tel}</td>
      <td>${c.ci ? `${c.ci}${c.es ? '/' + c.es : ''}` : '—'}</td>
      <td>${c.pe || '—'}</td>
      <td style="font-weight:600">${brl(c.gasto)}</td>
      <td>${fdt(c.ult)}</td>
      <td class="table-actions" onclick="event.stopPropagation()">
        <button class="eb small" onclick="openCliProfile(${c.id})">Ver perfil</button>
        <button class="eb small" onclick="editCli(${c.id})">Editar</button>
      </td>
    </tr>`;
  }).join('');
}

/* ── Modal perfil largo ───────────────────────────── */
let _mcpId = null;

function openCliProfile(id) {
  const c = DB.clis.find(x => x.id === id);
  if (!c) return;
  _mcpId = id;

  /* Avatar + Hero */
  const color = _cliColor(c.nm);
  const ini   = c.nm.trim()[0]?.toUpperCase() || '?';
  const av = $('mcp-avatar-big');
  if (av) { av.textContent = ini; av.style.background = color; }

  /* Hero background sutil baseado na cor */
  const hero = $('mcp-hero');
  if (hero) hero.style.background = `linear-gradient(135deg, ${color}12 0%, ${color}06 100%)`;

  /* Nome + subtítulo no hero */
  if ($('mcp-nm'))       $('mcp-nm').textContent      = c.nm;
  const locStr = [c.ci, c.es].filter(Boolean).join('/');
  if ($('mcp-hero-sub')) $('mcp-hero-sub').textContent = [locStr, c.pe].filter(Boolean).join(' · ') || 'Cliente';

  /* Detalhes de contato na sidebar */
  const mkRow = (svg, val) => `<div class="mcp-info-row">${svg}<span class="mcp-info-val">${val}</span></div>`;
  const phoneIco = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.45 19.79 19.79 0 0 1 1.58 4.81 2 2 0 0 1 3.56 2.63h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.2A16 16 0 0 0 13.8 16.1l.9-.89a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.42 17.5z"/></svg>`;
  const emailIco = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`;
  const locIco   = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
  const bthIco   = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  const infoRows = [
    c.tel ? mkRow(phoneIco, c.tel) : '',
    c.em  ? mkRow(emailIco, c.em)  : '',
    locStr ? mkRow(locIco, locStr)  : '',
    c.an  ? mkRow(bthIco, fdt(c.an)) : '',
  ].filter(Boolean).join('');
  if ($('mcp-info')) $('mcp-info').innerHTML = infoRows || `<span style="font-size:12px;color:#94A3B8">Sem contato cadastrado</span>`;

  /* Stats no hero */
  const peds  = DB.peds.filter(p => p.cid === id);
  const tkMed = peds.length ? c.gasto / peds.length : 0;
  if ($('mcp-stats')) $('mcp-stats').innerHTML = `
    <div class="mcp-stat"><div class="mcp-stat-val">${brl(c.gasto)}</div><div class="mcp-stat-lbl">Total gasto</div></div>
    <div class="mcp-stat"><div class="mcp-stat-val">${peds.length}</div><div class="mcp-stat-lbl">Pedidos</div></div>
    <div class="mcp-stat"><div class="mcp-stat-val">${brl(tkMed)}</div><div class="mcp-stat-lbl">Ticket médio</div></div>
    <div class="mcp-stat"><div class="mcp-stat-val">${fdt(c.ult)}</div><div class="mcp-stat-lbl">Último pedido</div></div>`;

  /* Tags */
  const tags = [c.pe ? { t: c.pe, skin: true } : null, { t: peds.length ? 'Ativa' : 'Sem compras', skin: false }].filter(Boolean);
  if ($('mcp-tags')) $('mcp-tags').innerHTML = tags.map(({ t, skin }) =>
    `<span class="mcp-tag${skin ? ' mcp-tag-skin' : ''}">${t}</span>`
  ).join('');

  /* Histórico */
  const stCl = { Pendente:'xb-gold', Confirmado:'xb-blue', Enviado:'xb-gray', Entregue:'xb-green', Recebido:'xb-green' };
  const histEl = $('mcp-hist-list');
  if (histEl) {
    if (!peds.length) {
      histEl.innerHTML = `<div class="mcp-hist-empty">Nenhuma compra registrada ainda.</div>`;
    } else {
      const sorted = [...peds].sort((a,b) => (b.dt||'').localeCompare(a.dt||''));
      histEl.innerHTML = sorted.map(p => {
        const prodNm = p.itens?.length ? p.itens.map(i => i.nm).join(', ') : (p.prod || '—');
        const pagCls = p.pag === 'Fiado' ? 'color:#D97706;font-weight:600' : '';
        return `<div class="mcp-hist-row">
          <span class="mcp-hist-date">${fdt(p.dt)}</span>
          <span class="mcp-hist-prod" title="${prodNm}">${prodNm}</span>
          <span class="mcp-hist-val">${brl(p.tot)}</span>
          <span class="mcp-hist-pag" style="${pagCls}">${p.pag||'—'}</span>
          <span class="mcp-hist-st"><span class="xb ${stCl[p.st]||'xb-gray'}">${p.st||'—'}</span></span>
        </div>`;
      }).join('');
    }
  }
  if ($('mcp-hist-count')) $('mcp-hist-count').textContent = peds.length ? `${peds.length} pedido${peds.length !== 1 ? 's' : ''}` : '';

  /* Sumário */
  const fiado = peds.filter(p => p.pag === 'Fiado').reduce((a,b) => a+b.tot, 0);
  if ($('mcp-hist-summary')) $('mcp-hist-summary').innerHTML = fiado > 0
    ? `<span>Total gasto: <strong>${brl(c.gasto)}</strong></span><span class="mcp-hist-fiado">⚠ Fiado em aberto: ${brl(fiado)}</span>`
    : `<span>Total gasto: <strong>${brl(c.gasto)}</strong></span><span>Ticket médio: <strong>${brl(tkMed)}</strong></span>`;

  /* Botões de ação */
  const editBtn = $('mcp-edit-btn');
  const delBtn  = $('mcp-del-btn');
  const saleBtn = $('mcp-sale-btn');
  if (editBtn) editBtn.onclick = () => { closeMod('mcp'); editCli(id); };
  if (delBtn)  delBtn.onclick  = () => { closeMod('mcp'); delCli(id); };
  if (saleBtn) saleBtn.onclick = () => { closeMod('mcp'); if (window.innerWidth <= 768) mobNav('nvenda'); else epage('nvenda', null); };

  openMod('mcp');
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

/* ══════════════════════════════════════════════════════
   NOVA VENDA — WIZARD 3 ETAPAS
   ══════════════════════════════════════════════════════ */
let _nvStep = 1;
let _nvQuick = false;

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
  /* Validação antes de avançar */
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

  /* Mostra/oculta painéis */
  [1,2,3].forEach(n => {
    const p = $(`nv-s${n}`);
    if (p) p.classList.toggle('on', n === panelStep);
  });

  /* Atualiza indicadores */
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

  /* Ao entrar na etapa 3: monta o resumo */
  if (step === 3) nvBuildSummary();

  /* Scroll to top */
  const ec = document.querySelector('.erp-content');
  if (ec) ec.scrollTop = 0;
}

/* Monta o resumo na etapa 3 */
function nvBuildSummary() {
  const cid  = parseInt($('vc')?.value) || 0;
  const cli  = DB.clis.find(x => x.id === cid);
  const tot  = _nvCart.reduce((a,b) => a+b.sub, 0);
  const parc = parseInt($('vparc')?.value) || 1;

  /* Atualiza o total do resumo */
  if ($('vt-r')) $('vt-r').textContent = brl(tot);
  if ($('vt'))   $('vt').textContent   = brl(tot);
  if ($('vt-sub')) $('vt-sub').textContent = parc > 1 ? `${parc}× de ${brl(tot/parc)}` : '';

  /* Cliente */
  const ini = cli ? cli.nm.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase() : '?';
  let html = `<div class="nv-res-cli">
    <div class="cli-ava" style="width:34px;height:34px;font-size:12px">${ini}</div>
    <div>
      <div style="font-size:13.5px;font-weight:600;color:var(--tx)">${cli?.nm||'—'}</div>
      <div style="font-size:11.5px;color:var(--tx-m)">${cli?.tel||''}</div>
    </div>
  </div>`;

  /* Produtos */
  html += _nvCart.map(i => `
    <div class="nv-res-item">
      <span class="nv-res-nm">${i.em||''} ${i.nm} ×${i.q}</span>
      <span class="nv-res-val">${brl(i.sub)}</span>
    </div>`).join('');

  if ($('nv-resumo-body')) $('nv-resumo-body').innerHTML = html;

  /* Mostra total parcial na etapa 2 */
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
    const ini = c.nm.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
    const sel = c.id === selId ? ' sel' : '';
    const meta = [c.tel, c.em].filter(Boolean)[0] || 'Sem contato';
    return `<div class="cli-row${sel}" onclick="selectCliWiz(${c.id})">
      <div class="cli-ava">${ini}</div>
      <div class="cli-info">
        <div class="cli-nm">${c.nm}</div>
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
    return `<div class="pp-card${sel}" onclick="selectProd(${p.id})" title="${p.nm}">
      <div class="pp-thumb">${p.img ? `<img src="${p.img}" onerror="this.outerHTML='${p.em||'📦'}'">` : (p.em||'📦')}</div>
      <div class="pp-info">
        <div class="pp-nm">${p.nm}</div>
        <div class="pp-pr">${brl(preco)}${p.pd?'<span class="pp-promo"> 🏷</span>':''}</div>
      </div>
      <span class="xb ${stCls} pp-st">${p.st}</span>
    </div>`;
  }).join('');
}

function selectProd(id) {
  const vp = $('vp');
  if (vp) { vp.value = id; vUpd(); }
  renderProdPicker(); /* re-render to highlight selection */
  if ($('v-busca')) $('v-busca').value = '';
  if ($('vq'))      $('vq').value = 1;
}

function rNV() {
  setQuickSaleMode(false);
  const vc = $('vc'), vp = $('vp');
  /* sem pré-seleção */
  if (vc) vc.innerHTML =
    `<option value="">—</option>` +
    DB.clis.map(c => `<option value="${c.id}">${c.nm}</option>`).join('');
  if (vp) vp.innerHTML =
    `<option value="">—</option>` +
    DB.prods.map(p => `<option value="${p.id}">${p.em} ${p.nm}</option>`).join('');

  /* Reinicia no passo 1 */
  _nvStep = 1;
  nvGoStep(1);
  if ($('nv-cli-busca')) $('nv-cli-busca').value = '';
  if ($('v-busca'))      $('v-busca').value = '';
  renderCliPicker();
  renderProdPicker();

  /* Limpa preview */
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
  if ($('vt'))    $('vt').textContent    = brl(tot);
  if ($('vt-r'))  $('vt-r').textContent  = brl(tot);
  if ($('vt-sub')) $('vt-sub').textContent = parc > 1 ? `${parc}× de ${brl(tot/parc)}` : '';
  /* Mostra total parcial */
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
  setQuickSaleMode(false);
  renderAll();
  rReceber();
  /* Animação de sucesso em vez do toast direto */
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

  /* Preenche dados */
  const nm  = $('ss-client');
  const amt = $('ss-total');
  const sub = $('ss-sub');
  if (nm)  nm.textContent  = cli?.nm || '—';
  if (amt) amt.textContent = brl(tot);
  if (sub) sub.textContent = parc > 1 ? `${parc}× de ${brl(tot/parc)}` : '';

  /* Reseta todas as animações para re-executar corretamente */
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

  const now    = new Date();
  const hora   = now.toTimeString().slice(0,5);
  const numPed = String(ped.id).padStart(6, '0');
  const dtpagFmt = fdt(ped.dtpag || ped.dt);
  const isPending = ped.dtpag && ped.dtpag > td();
  const wRaw = (DB.settings?.whatsapp || '').replace(/\D/g, '');
  const wFmt = wRaw.length >= 11
    ? `(${wRaw.slice(0,2)}) ${wRaw.slice(2,7)}-${wRaw.slice(7)}`
    : wRaw;

  /* Itens */
  const itensHtml = ped.itens && ped.itens.length
    ? ped.itens.map((i, idx) => `
        <div class="cpt-item">
          <div class="cpt-item-nm">${i.em ? i.em + ' ' : ''}${i.nm}</div>
          <div class="cpt-item-det">
            <span>${i.q} un × ${brl(i.pr)}</span>
            <span class="cpt-item-sub">${brl(i.sub)}</span>
          </div>
        </div>${idx < ped.itens.length - 1 ? '<div class="cpt-sep-thin"></div>' : ''}`).join('')
    : `<div class="cpt-item">
        <div class="cpt-item-nm">${ped.prod}</div>
        <div class="cpt-item-det">
          <span>${ped.q} un${prod?.pr ? ' × ' + brl(prod.pr) : ''}</span>
          <span class="cpt-item-sub">${brl(ped.tot)}</span>
        </div>
      </div>`;

  const parcHtml = ped.parc > 1
    ? `<div class="cpt-row"><span>Parcelas</span><span>${ped.parc}× de ${brl(ped.tot / ped.parc)}</span></div>` : '';

  inner.innerHTML = `<div class="cpt-sheet">

    <div class="cpt-header">
      <div class="cpt-logo">✦</div>
      <div class="cpt-brand">Milena Lima <em>Beauty</em></div>
      <div class="cpt-consult">Consultora Oficial Mary Kay</div>
      ${wFmt ? `<div class="cpt-contact">📲 ${wFmt}</div>` : ''}
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
      <span class="cpt-field-val">${cli.nm}</span>
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

    <div class="cpt-sep-solid"></div>

    <div class="cpt-footer">
      <div class="cpt-footer-msg">"Obrigada pela sua escolha!<br>Você merece o melhor 💗"</div>
      <div class="cpt-footer-nd">Documento sem valor fiscal</div>
    </div>

  </div>`;

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

/* ── Wizard de produto (mobile) ──────────────────────── */
let _mpStep = 1;

function mpGoStep(n) {
  _mpStep = n;
  /* Painéis */
  document.querySelectorAll('.mp-step-panel').forEach(el => {
    el.classList.toggle('mp-step-on', parseInt(el.dataset.step) === n);
  });
  /* Dots */
  document.querySelectorAll('.mp-dot').forEach(el => {
    const s = parseInt(el.dataset.step);
    el.classList.toggle('active', s === n);
    el.classList.toggle('done',   s < n);
  });
  /* Label */
  const lbls = { 1:'Dados do produto', 2:'Preço & Estoque', 3:'Extras & Foto' };
  const lbl = $('mp-wiz-label');
  if (lbl) lbl.textContent = lbls[n] || '';
  /* Botões de navegação */
  const prev = $('mp-prev-btn'), next = $('mp-next-btn');
  if (prev) prev.style.display = n === 1 ? 'none' : '';
  if (next) next.textContent = n === 3 ? 'Salvar produto' : 'Próximo';
}

function mpNext() {
  if (_mpStep === 1) {
    const nm = ($('pe-nm')?.value || '').trim();
    if (!nm) { showToast('Informe o nome do produto'); $('pe-nm')?.focus(); return; }
  }
  if (_mpStep === 3) { confirmSaveProd(); return; }
  mpGoStep(_mpStep + 1);
}

function mpPrev() {
  if (_mpStep > 1) mpGoStep(_mpStep - 1);
}

/* Sincroniza campo mobile → campo desktop (ambos usam o mesmo dado ao salvar) */
function mpSyncField(fromId, toId) {
  const from = $(fromId), to = $(toId);
  if (from && to) to.value = from.value;
}

/* Atualiza preview da imagem/emoji no modal de produto */
function mpPreviewUpdate() {
  const url  = ($('pe-img')?.value || '').trim();
  const em   = $('pe-em')?.value || '📦';
  const img  = $('mp-preview-img');
  const emEl = $('mp-preview-em');
  const hint = $('mp-img-hint');
  if (url) {
    if (img) {
      img.src = url;
      img.onload  = () => { img.style.display = 'block'; if (emEl) emEl.style.display = 'none'; if (hint) hint.textContent = '✓ Imagem carregada'; if (hint) hint.style.color = 'var(--green)'; };
      img.onerror = () => { img.style.display = 'none'; if (emEl) emEl.style.display = 'block'; if (hint) hint.textContent = '⚠ URL inválida ou inacessível'; if (hint) hint.style.color = 'var(--warn)'; };
    }
  } else {
    if (img)  { img.style.display = 'none'; img.src = ''; }
    if (emEl) { emEl.style.display = 'block'; emEl.textContent = em || '📦'; }
    if (hint) { hint.textContent = ''; }
  }
  if (emEl && !url) emEl.textContent = em || '📦';
}

/* Salvar produto — pede confirmação se for edição */
function confirmSaveProd() {
  const nm = $('pe-nm')?.value?.trim();
  if (!nm) { showToast('Informe o nome do produto'); return; }
  const eid = $('pe-id')?.value;
  if (eid) {
    askConfirm({
      title: 'Salvar alterações?',
      msg: `As mudanças em <strong>${nm}</strong> serão salvas permanentemente.`,
      type: 'info',
      btnLabel: 'Salvar'
    }, saveProd);
  } else {
    saveProd(); /* novo produto: salva direto */
  }
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
    bump: $('pe-bump')?.value ? parseInt($('pe-bump').value) : null,
    bc: ($('pe-bc')?.value || '').replace(/\D/g,'') || null,
  };
  if (!o.nm) { showToast('Informe o nome'); return; }
  /* Bloqueia barcode duplicado em novos produtos */
  if (!eid && o.bc) {
    const dup = DB.prods.find(p => p.bc && p.bc === o.bc);
    if (dup) { showExistingProductModal(dup); return; }
  }
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
  showToast(eid ? 'Produto atualizado ✓' : 'Produto criado ✓');
  if (saved) sbSync(() => SBProds.upsert(saved));
  $('pe-id').value = '';
  ['pe-nm','pe-em','pe-pr','pe-pd','pe-img','pe-desc','pe-feats','pe-bc'].forEach(i => { if ($(i)) $(i).value = ''; });
  $('pe-st').value = '0';
  if ($('pe-em-m'))  $('pe-em-m').value  = '';
  if ($('pe-img-m')) $('pe-img-m').value = '';
}

function editP(id) {
  const p = DB.prods.find(x => x.id === id);
  if (!p) return;
  $('pe-id').value = p.id;
  $('pe-em').value  = p.em;
  $('pe-nm').value  = p.nm;
  $('pe-cat').value = p.cat;
  $('pe-pr').value  = p.pr;
  $('pe-pd').value  = p.pd || '';
  $('pe-st').value  = p.st;
  $('pe-dt').value  = p.dt || '';
  if ($('pe-img'))   $('pe-img').value   = p.img   || '';
  if ($('pe-desc'))  $('pe-desc').value  = p.desc  || '';
  if ($('pe-feats')) $('pe-feats').value = (p.feats||[]).join(', ');
  if ($('pe-bump'))  $('pe-bump').value  = p.bump  || '';
  if ($('pe-bc'))    $('pe-bc').value    = p.bc    || '';
  /* Campos espelho mobile */
  if ($('pe-em-m'))  $('pe-em-m').value  = p.em    || '';
  if ($('pe-img-m')) $('pe-img-m').value = p.img   || '';
  /* Atualiza título e preview */
  if ($('mp-title')) $('mp-title').textContent = 'Editar Produto';
  if ($('mp-sub'))   $('mp-sub').textContent   = `Editando: ${p.nm}`;
  setTimeout(mpPreviewUpdate, 50);
  openMod('mp');
}

function delP(id) {
  const p = DB.prods.find(x => x.id === id);
  if (!p) return;
  askConfirm({
    title: 'Excluir produto?',
    msg: `Tem certeza que deseja excluir <strong>${p.nm}</strong>? Esta ação <strong>não pode ser desfeita</strong>.`,
    type: 'danger',
    btnLabel: 'Excluir produto'
  }, () => {
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

function delCli(id) {
  const c = DB.clis.find(x => x.id === id);
  if (!c) return;
  askConfirm({ title: 'Excluir cliente?', msg: `<strong>${c.nm}</strong> será removido permanentemente.`, type: 'danger', btnLabel: 'Excluir' }, () => {
    DB.clis = DB.clis.filter(x => x.id !== id);
    rClis(); rNV();
    showToast('Cliente excluído');
    sbSync(() => SBClis.delete(id));
  });
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
    msg:   `<strong>${prod.nm}</strong> já usa este código de barras.<br>O que deseja fazer?`,
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

/* ══ CONSULTAR PRODUTO ══════════════════════════════════
   Reutiliza _phoneChannel/_phoneConnected/_phoneSid
   ══════════════════════════════════════════════════════ */
let _cqScanner=null,_cqCamActive=false,_cqScanCooldown=false;

function openCQ(){ epage('consulta', null); }

async function rCQ(){
  _cqScanCooldown=false;
  /* Para câmera anterior antes de qualquer coisa */
  await _cqStopCamera();
  ['cq-product-card','cq-search-results'].forEach(id=>{if($(id))$(id).style.display='none';});
  if($('cq-search'))$('cq-search').value='';
  if($('cq-clear'))$('cq-clear').style.display='none';
  if($('cq-placeholder'))$('cq-placeholder').style.display='flex';
  const mob=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)||window.innerWidth<=768;
  if(mob){
    if($('cq-camera-wrap'))$('cq-camera-wrap').style.display='block';
    if($('cq-qr-wrap'))$('cq-qr-wrap').style.display='none';
    /* Aguarda dois frames para o layout ser computado antes de iniciar a câmera */
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    await _cqStartCamera();
  } else {
    if($('cq-camera-wrap'))$('cq-camera-wrap').style.display='none';
    if($('cq-qr-wrap'))$('cq-qr-wrap').style.display='flex';
    await _cqSetupQR();
  }
}

async function _cqStartCamera(){
  const reader=$('cq-reader');
  if(!reader||typeof Html5Qrcode==='undefined'){showToast('Scanner indisponível');return;}
  if(!(location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname))){showToast('Câmera requer HTTPS');return;}
  /* Limpa DOM residual de sessões anteriores */
  reader.innerHTML='';
  /* Garante que o elemento tem dimensões antes de iniciar */
  if(!reader.offsetWidth||!reader.offsetHeight){
    await new Promise(r=>setTimeout(r,120));
  }
  try{
    _cqScanner=new Html5Qrcode('cq-reader');
    const cfg={fps:15,experimentalFeatures:{useBarCodeDetectorIfSupported:true}};
    if(typeof Html5QrcodeSupportedFormats!=='undefined')
      cfg.formatsToSupport=[Html5QrcodeSupportedFormats.EAN_13,Html5QrcodeSupportedFormats.EAN_8,Html5QrcodeSupportedFormats.CODE_128,Html5QrcodeSupportedFormats.UPC_A];
    let ok=false;
    for(const f of['environment','user']){try{await _cqScanner.start({facingMode:f},cfg,_cqOnScan,()=>{});ok=true;break;}catch(e){}}
    if(ok)_cqCamActive=true;else throw new Error('no camera');
  }catch(e){
    _cqCamActive=false;
    const msg=(e?.message||'').toLowerCase();
    showToast(msg.includes('permission')||msg.includes('notallowed')?'Permissão de câmera negada':'Câmera indisponível');
  }
}

async function _cqStopCamera(){
  _cqCamActive=false;
  if(_cqScanner){
    try{await _cqScanner.stop();}catch(e){}
    try{_cqScanner.clear();}catch(e){}
    _cqScanner=null;
  }
  /* Limpa o reader para não deixar DOM residual */
  const reader=$('cq-reader');
  if(reader)reader.innerHTML='';
}

async function _cqSetupQR(){
  /* Celular já conectado — reusa canal existente */
  if(_phoneConnected&&_phoneChannel){
    _cqFlipConnected();
    _phoneChannel.on('broadcast',{event:'barcode'},({payload})=>{if(payload?.code&&$('ep-consulta')?.classList.contains('on'))_cqOnScan(payload.code);});
    return;
  }
  /* Sessão QR já existe (aguardando celular) */
  if(_phoneSid&&_phoneChannel&&_phoneQrUrl){
    await _cqRenderQR(_phoneQrUrl);
    _phoneChannel
      .on('broadcast',{event:'phone-connected'},()=>{_phoneConnected=true;_phoneSetStatus('connected','📱 Celular conectado');_cqFlipConnected();})
      .on('broadcast',{event:'barcode'},({payload})=>{if(payload?.code&&$('ep-consulta')?.classList.contains('on'))_cqOnScan(payload.code);});
    return;
  }
  /* Sem Supabase */
  if(!window._sbClient||window._sbClient._local){
    const w=$('cq-qr-wrap');
    if(w)w.innerHTML=`<div class="cq-no-phone"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg><p>Use a busca para localizar produtos.<br><small>Scanner por celular requer Supabase.</small></p></div>`;
    return;
  }
  /* Cria nova sessão usando as mesmas vars do togglePhoneScanner */
  _phoneSid=[...Array(14)].map(()=>Math.random().toString(36)[2]).join('');
  _phoneConnected=false;
  let base;try{const r=await fetch('http://localhost:3001/api/tunnel');base=(await r.json()).url||null;}catch(e){base=null;}
  if(!base){const h=await _getLocalIP()||location.hostname;base=`https://${h}:${location.port}`;}
  _phoneQrUrl=`${base}/mobile-scan.html?s=${_phoneSid}`;
  await _cqRenderQR(_phoneQrUrl);
  _phoneChannel=window._sbClient.channel(`erp-scan-${_phoneSid}`,{config:{broadcast:{self:false}}});
  _phoneChannel
    .on('broadcast',{event:'phone-connected'},()=>{_phoneConnected=true;_phoneSetStatus('connected','📱 Celular conectado');_cqFlipConnected();})
    .on('broadcast',{event:'barcode'},({payload})=>{if(payload?.code){if($('ep-consulta')?.classList.contains('on'))_cqOnScan(payload.code);else onScanResult(payload.code);}})
    .subscribe();
}

async function _cqRenderQR(url){
  const c=$('cq-qr-canvas'),i=$('cq-qr-img');
  if(window.QRCode&&c){try{await QRCode.toCanvas(c,url,{width:180,margin:1,color:{dark:'#111',light:'#fff'}});c.style.display='block';if(i)i.style.display='none';return;}catch(e){}}
  if(i){i.src=`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(url)}`;i.style.display='block';if(c)c.style.display='none';}
}

function _cqFlipConnected(){
  const w=$('cq-state-waiting'),c=$('cq-state-connected');
  if(w){w.style.transition='opacity .22s';w.style.opacity='0';setTimeout(()=>{w.style.display='none';},230);}
  if(c){c.style.display='flex';requestAnimationFrame(()=>c.classList.add('visible'));}
}

function _cqOnScan(code){
  if(_cqScanCooldown)return;
  _cqScanCooldown=true;
  playBeep('scan');
  const clean=code.replace(/\D/g,'');
  const prod=DB.prods.find(p=>p.bc&&p.bc.replace(/\D/g,'')=== clean);
  if(prod)cqShowProduct(prod);
  else{showToast('Código não cadastrado: '+clean);if($('cq-search')){$('cq-search').value=clean;cqSearch();}}
  setTimeout(()=>{_cqScanCooldown=false;},2000);
}

function cqSearch(){
  const q=($('cq-search')?.value||'').trim();
  if($('cq-clear'))$('cq-clear').style.display=q?'flex':'none';
  if(!q){if($('cq-search-results'))$('cq-search-results').style.display='none';return;}
  const ql=q.toLowerCase();
  const res=DB.prods.filter(p=>p.nm.toLowerCase().includes(ql)||(p.bc||'').includes(q)||(p.cat||'').toLowerCase().includes(ql)).slice(0,10);
  const el=$('cq-search-results');if(!el)return;
  el.innerHTML=!res.length
    ?`<div class="cq-no-results">Nenhum resultado para "<strong>${q}</strong>"</div>`
    :res.map(p=>`<div class="cq-rr" onclick="cqShowProduct(DB.prods.find(x=>x.id===${p.id}))">
        <span class="cq-rr-em">${p.em||'📦'}</span>
        <div class="cq-rr-info">
          <span class="cq-rr-nm">${p.nm}</span>
          <span class="cq-rr-pr">${brl(p.pd??p.pr)}${p.pd?` <del style="opacity:.4;font-size:11px">${brl(p.pr)}</del>`:''}</span>
        </div>
        <span class="cq-rr-st${p.st===0?' zero':p.st<=3?' low':''}">${p.st} un.</span></div>`).join('');
  el.style.display='block';
  if($('cq-product-card'))$('cq-product-card').style.display='none';
  if($('cq-placeholder'))$('cq-placeholder').style.display='none';
}
function cqClearSearch(){if($('cq-search'))$('cq-search').value='';if($('cq-clear'))$('cq-clear').style.display='none';if($('cq-search-results'))$('cq-search-results').style.display='none';}

function cqShowProduct(p){
  if(!p)return;
  if($('cq-search-results'))$('cq-search-results').style.display='none';
  if($('cq-placeholder'))$('cq-placeholder').style.display='none';
  const el=$('cq-product-card');if(!el)return;
  const sc=p.st===0?'var(--err)':p.st<=3?'#D97706':'var(--ok)';
  const sl=p.st===0?'Sem estoque':p.st<=3?`Baixo — ${p.st} un.`:`${p.st} un. em estoque`;
  const thumb=p.img?`<img src="${p.img}" class="cq-pi-img" alt="">`:`<div class="cq-pi-em">${p.em||'📦'}</div>`;
  el.innerHTML=`<div class="cq-prod">
    <div class="cq-prod-top">${thumb}
      <div class="cq-prod-info">
        <div class="cq-prod-nm">${p.nm}</div>
        ${p.cat?`<div class="cq-prod-cat">${p.cat}</div>`:''}
        <div class="cq-prod-price"><span class="cq-price-val">${brl(p.pd??p.pr)}</span>${p.pd?`<del class="cq-price-old">${brl(p.pr)}</del>`:''}</div>
        <div class="cq-prod-stock" style="color:${sc}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          ${sl}</div>
        ${p.bc?`<div class="cq-prod-bc">EAN ${p.bc}</div>`:''}
      </div>
    </div>
    ${p.desc?`<p class="cq-prod-desc">${p.desc}</p>`:''}
    ${p.feats?.length?`<div class="cq-prod-feats">${p.feats.map(f=>`<span class="cq-feat">${f}</span>`).join('')}</div>`:''}
    <div class="cq-prod-actions">
      <button class="btn btn-outline cq-act-btn" onclick="cqEdit(${p.id})">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Editar
      </button>
      <button class="btn btn-primary cq-act-btn" onclick="cqSell(${p.id})"${p.st===0?' disabled':''}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>Vender
      </button>
    </div></div>`;
  el.style.display='block';
}
function cqEdit(id){_cqStopCamera();setTimeout(()=>editP(id),80);}
function cqSell(id){const p=DB.prods.find(x=>x.id===id);if(!p)return;_cqStopCamera();const mob=window.innerWidth<=768;setTimeout(()=>{if(mob)mobNav('nvenda');else epage('nvenda',null);setTimeout(()=>{const vp=$('vp');if(vp){vp.value=id;vUpd();nvAddItem();}},150);},80);}

/* ══════════════════════════════════════════════════════
   SCANNER DE CÓDIGO DE BARRAS — EAN-13
   ══════════════════════════════════════════════════════ */
let _scanner    = null;
let _scanMode   = 'estoque';  /* 'estoque' | 'venda' | 'field' */
let _scanCooldown = false;

async function openScanner(mode) {
  _scanMode = mode || 'estoque';

  const titles = { estoque:'Buscar produto', venda:'Adicionar à venda', field:'Ler código de barras', 'new-prod':'Cadastrar produto' };
  const subs   = { estoque:'Aponte para o EAN-13 do produto', venda:'Produto será adicionado ao carrinho', field:'O código será preenchido no campo', 'new-prod':'Escaneie o código do produto a cadastrar' };
  if ($('scan-title')) $('scan-title').textContent = titles[mode] || titles.estoque;
  if ($('scan-sub'))   $('scan-sub').textContent   = subs[mode]   || subs.estoque;

  const ra = $('scan-result-area'), na = $('scan-notfound-area'), fc = $('scn-found-card');
  if (ra) ra.style.display = 'none';
  if (na) na.style.display = 'none';
  if (fc) fc.style.display = 'none';

  $('mscanner').classList.add('on');
  document.body.style.overflow = 'hidden';
  _scanCooldown = false;

  /* ── Verifica se a lib foi carregada ── */
  if (typeof Html5Qrcode === 'undefined') {
    _showScanError('Biblioteca de scanner não carregada. Use o campo abaixo.');
    return;
  }

  /* ── Verifica HTTPS (câmera só funciona em HTTPS ou localhost) ── */
  const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!isSecure) {
    _showScanError(`Câmera requer HTTPS.\nAcesse via: https://${location.hostname}:3443`);
    return;
  }

  /* ── Verifica suporte à API de câmera ── */
  if (!navigator.mediaDevices?.getUserMedia) {
    _showScanError('Seu navegador não suporta câmera. Use o campo manual abaixo.');
    return;
  }

  const cfg = {
    fps: 15,
    experimentalFeatures: { useBarCodeDetectorIfSupported: true },
  };

  /* Adiciona formatos se disponível */
  if (typeof Html5QrcodeSupportedFormats !== 'undefined') {
    cfg.formatsToSupport = [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.QR_CODE,
    ];
  }

  try {
    _scanner = new Html5Qrcode('scan-reader');

    /* Tenta câmera traseira primeiro, depois frontal */
    let started = false;
    for (const facing of ['environment', 'user']) {
      try {
        await _scanner.start({ facingMode: facing }, cfg, code => onScanResult(code), () => {});
        started = true;
        break;
      } catch(e) { /* tenta próxima */ }
    }

    if (!started) throw new Error('Nenhuma câmera disponível');

  } catch (err) {
    const msg = err?.message || '';
    if (msg.includes('Permission') || msg.includes('permission') || msg.includes('NotAllowed')) {
      _showScanError('Permissão de câmera negada.\nVá em Configurações > Privacidade > Câmera e permita o navegador.');
    } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) {
      _showScanError('Nenhuma câmera encontrada neste dispositivo.');
    } else {
      _showScanError('Câmera indisponível — use o campo manual abaixo.');
    }
  }
}

/* Mostra erro no scanner e foca o input manual */
function _showScanError(msg) {
  const na = $('scan-notfound-area');
  const si = $('scan-manual-input');
  if (na) { na.style.display = 'flex'; $('scan-notfound-text').textContent = msg; }
  /* Para o scanner se estava rodando */
  if (_scanner) { try { _scanner.stop(); } catch(e){} _scanner = null; }
  /* Foca automaticamente no input manual */
  setTimeout(() => { if (si) { si.focus(); si.scrollIntoView({ behavior:'smooth', block:'center' }); } }, 400);
}

/* ── Sons do sistema ───────────────────────────────── */
function playBeep(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (type === 'sale') {
      [[880,0],[1175,.1],[1320,.2]].forEach(([f,t]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(.22, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + t + .18);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + .22);
      });
    } else {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.value = 1760;
      g.gain.setValueAtTime(.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .13);
      o.start(); o.stop(ctx.currentTime + .15);
    }
  } catch(e) {}
}

function onScanResult(code) {
  if (_scanCooldown) return;
  _scanCooldown = true;
  playBeep('scan');

  const clean = code.replace(/\D/g, '');

  /* ── Modo field: apenas preenche o campo no modal ── */
  if (_scanMode === 'field') {
    closeScanner();
    if ($('pe-bc')) { $('pe-bc').value = clean; $('pe-bc').focus(); }
    showToast('Código lido: ' + clean);
    return;
  }

  /* ── Modo new-prod: cadastrar novo produto via código ── */
  if (_scanMode === 'new-prod') {
    closeScanner();
    const existing = DB.prods.find(p => p.bc && p.bc.replace(/\D/g,'') === clean);
    if (existing) {
      showExistingProductModal(existing);
    } else {
      /* Reset do modal e pré-preenche código */
      $('pe-id').value = '';
      ['pe-nm','pe-em','pe-pr','pe-pd','pe-img','pe-desc','pe-feats','pe-em-m','pe-img-m'].forEach(i => { if ($(i)) $(i).value = ''; });
      $('pe-st').value = '0';
      if ($('pe-bc'))    $('pe-bc').value    = clean;
      if ($('mp-title')) $('mp-title').textContent = 'Novo Produto';
      if ($('mp-sub'))   $('mp-sub').textContent   = `Código: ${clean}`;
      openMod('mp');
      showToast('Código lido — complete os dados do produto');
    }
    return;
  }

  /* ── Busca produto pelo EAN-13 ── */
  const prod = DB.prods.find(p => p.bc && p.bc.replace(/\D/g,'') === clean);

  /* Scanner do celular com modal fechado → fluxo direto no PC */
  const scannerOpen = $('mscanner')?.classList.contains('on');
  if (!scannerOpen) {
    _scanCooldown = false;
    if (!prod) {
      /* Produto não encontrado — oferecer cadastro */
      askConfirm({
        title: 'Produto não encontrado',
        msg:   `Código <strong>${clean}</strong> não está cadastrado.<br>Deseja cadastrar este produto agora?`,
        type:  'info',
        btnLabel: '+ Cadastrar',
      }, () => {
        $('pe-id').value = '';
        ['pe-nm','pe-em','pe-pr','pe-pd','pe-img','pe-desc','pe-feats','pe-em-m','pe-img-m'].forEach(i => { if ($(i)) $(i).value = ''; });
        $('pe-st').value = '0';
        if ($('pe-bc')) $('pe-bc').value = clean;
        if ($('mp-title')) $('mp-title').textContent = 'Novo Produto';
        if ($('mp-sub'))   $('mp-sub').textContent   = `Código: ${clean}`;
        openMod('mp');
      });
    } else {
      showExistingProductModal(prod);
    }
    return;
  }

  /* Scanner aberto normalmente */
  const ra = $('scan-result-area'), na = $('scan-notfound-area');
  if (!prod) {
    if (na) { na.style.display = 'flex'; $('scan-notfound-text').textContent = `Não encontrado: ${clean}`; }
    if (ra) ra.style.display = 'none';
    setTimeout(() => { _scanCooldown = false; if (na) na.style.display = 'none'; }, 2000);
    return;
  }

  /* Produto encontrado — preenche o card visual */
  const fc = $('scn-found-card');
  if (fc) {
    $('scn-found-nm').textContent   = `${prod.em || ''} ${prod.nm}`;
    $('scn-found-meta').textContent = `${prod.st} un. · ${cNm[prod.cat] || prod.cat}`;
    $('scn-found-pr').textContent   = brl(prod.pd ?? prod.pr);
    fc.style.display = 'flex';
  }
  if (na) na.style.display = 'none';

  setTimeout(() => {

    if (_scanMode === 'venda') {
      /* Nova Venda — adiciona ao carrinho e mantém scanner aberto */
      const vp = $('vp');
      if (vp) { vp.value = prod.id; vUpd(); nvAddItem(); }
      showToast(`✓ ${prod.nm} adicionado`);
      /* Esconde card e libera cooldown para próximo scan */
      setTimeout(() => {
        const fc2 = $('scn-found-card'); if (fc2) fc2.style.display = 'none';
        _scanCooldown = false;
      }, 1400);

    } else {
      /* Estoque — destaca produto */
      epage('estoque', null);
      const busca = $('est-busca');
      if (busca) { busca.value = prod.nm; rEst(); }
      showToast(`✓ ${prod.nm} encontrado`);
    }
  }, 800);
}

async function closeScanner() {
  if (_scanner) {
    try { await _scanner.stop(); } catch(e) {}
    try { _scanner.clear(); }     catch(e) {}
    _scanner = null;
  }
  closePhoneScanner();
  $('mscanner').classList.remove('on');
  document.body.style.overflow = '';
  _scanCooldown = false;
  const fc = $('scn-found-card'); if (fc) fc.style.display = 'none';
  const na = $('scan-notfound-area'); if (na) na.style.display = 'none';
  if ($('scan-manual-input')) $('scan-manual-input').value = '';
}

/* Abre scanner para preencher o campo EAN-13 do modal de produto */
function openScannerForField() { openScanner('field'); }

/* Abre scanner para cadastrar produto novo pelo código */
function openScannerForNewProd() { openScanner('new-prod'); }

/* ── Scanner por celular — sessão persistente ────────── */
let _phoneChannel   = null;
let _phonePanelOpen = false;
let _phoneConnected = false;
let _phoneSid       = null;
let _phoneQrUrl     = null;

/* Descobre o IP real da LAN via WebRTC (evita localhost no QR code) */
function _getLocalIP() {
  return new Promise(resolve => {
    const pc   = new RTCPeerConnection({ iceServers: [] });
    const seen = new Set();
    pc.createDataChannel('');
    pc.createOffer().then(o => pc.setLocalDescription(o)).catch(() => resolve(null));
    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) { pc.close(); resolve(null); return; }
      const m = candidate.candidate.match(/(\d{1,3}(?:\.\d{1,3}){3})/);
      if (m && !seen.has(m[1])) {
        seen.add(m[1]);
        /* Pega primeiro IP que não seja loopback nem link-local */
        if (!m[1].startsWith('127.') && !m[1].startsWith('169.254')) {
          pc.close(); resolve(m[1]);
        }
      }
    };
    setTimeout(() => { try { pc.close(); } catch(e) {} resolve(null); }, 2000);
  });
}

async function _renderQR(url) {
  const canvas = $('scn-qr-canvas');
  const img    = $('scn-qr-img');
  const urlEl  = $('scn-qr-url');

  /* Tenta QRCode.toCanvas (lib carregada no <head>) */
  if (window.QRCode && canvas) {
    try {
      await QRCode.toCanvas(canvas, url, {
        width: 200, margin: 1,
        color: { dark: '#111111', light: '#ffffff' }
      });
      canvas.style.display = 'block';
      if (img) img.style.display = 'none';
      return;
    } catch(e) { console.warn('[QR canvas]', e); }
  }

  /* Fallback: imagem via API pública */
  if (img) {
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(url)}`;
    img.style.display = 'block';
    if (canvas) canvas.style.display = 'none';
  }

  /* Fallback extra: mostra URL como texto */
  if (urlEl) { urlEl.textContent = url; urlEl.style.display = 'block'; }
}

function _phoneSetStatus(state, msg) {
  const dot = $('scn-phone-dot');
  const txt = $('scn-phone-status-txt');
  const btn = $('scn-phone-toggle');
  if (dot) dot.className = state === 'connected' ? 'scn-phone-dot connected'
                         : state === 'received'  ? 'scn-phone-dot received'
                         : 'scn-phone-dot';
  if (txt && msg) txt.textContent = msg;
  if (btn) btn.classList.toggle('phone-live', state === 'connected' || state === 'received');
}

async function togglePhoneScanner() {
  if (_phonePanelOpen) { _hidePhonePanel(); return; }

  if (!window._sbClient || window._sbClient._local) {
    showToast('Scanner por celular requer conexão com o Supabase'); return;
  }

  _phonePanelOpen = true;
  const btn = $('scn-phone-toggle');
  if (btn) btn.classList.add('active');

  const cam = document.querySelector('.scn-camera-wrap');
  const panel = $('scn-phone-panel');
  if (cam)   cam.style.display   = 'none';
  if (panel) panel.style.display = 'flex';

  if (_scanner) {
    try { await _scanner.stop(); } catch(e) {}
    try { _scanner.clear(); }     catch(e) {}
    _scanner = null;
  }

  /* Sessão já existe — reusa QR e canal */
  if (_phoneChannel && _phoneSid) {
    await _renderQR(_phoneQrUrl);
    _phoneSetStatus(_phoneConnected ? 'connected' : 'waiting',
      _phoneConnected ? '📱 Celular conectado — pronto para escanear' : 'Aguardando celular...');
    return;
  }

  /* Nova sessão */
  _phoneSid       = [...Array(14)].map(() => Math.random().toString(36)[2]).join('');
  _phoneConnected = false;

  let baseUrl;
  try {
    const r = await fetch('http://localhost:3001/api/tunnel');
    const j = await r.json();
    baseUrl = j.url || null;
  } catch(e) { baseUrl = null; }

  if (!baseUrl) {
    const host = await _getLocalIP() || location.hostname;
    baseUrl = `https://${host}:${location.port}`;
  }
  _phoneQrUrl = `${baseUrl}/mobile-scan.html?s=${_phoneSid}`;
  await _renderQR(_phoneQrUrl);
  _phoneSetStatus('waiting', 'Aguardando celular...');

  _phoneChannel = window._sbClient.channel(`erp-scan-${_phoneSid}`, {
    config: { broadcast: { self: false } }
  });

  _phoneChannel
    .on('broadcast', { event: 'phone-connected' }, () => {
      _phoneConnected = true;
      _phoneSetStatus('connected', '📱 Celular conectado — pronto para escanear');
    })
    .on('broadcast', { event: 'barcode' }, ({ payload }) => {
      if (!payload?.code) return;
      const txt = $('scn-phone-status-txt');
      _phoneSetStatus('received');
      if (txt) txt.textContent = `✓ ${payload.code}`;
      setTimeout(() => { if (_phoneConnected) _phoneSetStatus('connected'); }, 700);
      onScanResult(payload.code);
    })
    .subscribe();
}

function _hidePhonePanel() {
  _phonePanelOpen = false;
  const cam   = document.querySelector('.scn-camera-wrap');
  const panel = $('scn-phone-panel');
  const btn   = $('scn-phone-toggle');
  if (panel) panel.style.display = 'none';
  if (cam)   cam.style.display   = '';
  if (btn)   { btn.classList.remove('active'); btn.classList.toggle('phone-live', _phoneConnected); }
}

/* Desconecta o celular explicitamente */
function disconnectPhone() {
  if (_phoneChannel) { try { _phoneChannel.unsubscribe(); } catch(e) {} _phoneChannel = null; }
  _phonePanelOpen = _phoneConnected = false;
  _phoneSid = _phoneQrUrl = null;
  const btn = $('scn-phone-toggle');
  if (btn) btn.classList.remove('active', 'phone-live');
  const cam = document.querySelector('.scn-camera-wrap');
  const panel = $('scn-phone-panel');
  if (panel) panel.style.display = 'none';
  if (cam)   cam.style.display   = '';
  showToast('Celular desconectado');
}

/* Chamado ao fechar o modal scanner — apenas esconde o painel */
function closePhoneScanner() { if (_phonePanelOpen) _hidePhonePanel(); }

/* Input manual de código de barras no scanner */
function scanManualInput(val) {
  const clean = val.replace(/\D/g,'');
  const inp   = $('scan-manual-input');
  if (inp && clean !== val) inp.value = clean;
  /* Auto-submete se atingiu 13 dígitos */
  if (clean.length >= 13) scanManualSubmit();
}
function scanManualSubmit() {
  const val = ($('scan-manual-input')?.value || '').replace(/\D/g,'');
  if (!val) return;
  onScanResult(val);
  if ($('scan-manual-input')) $('scan-manual-input').value = '';
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

/* Base chart config — Shorti design system */
const ca = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        font: { family: 'Inter', size: 12, weight: '500' },
        color: '#6B7280',
        padding: 16,
        usePointStyle: true,
        pointStyleWidth: 8,
      }
    },
    tooltip: {
      backgroundColor: '#111827',
      titleColor: '#F9FAFB',
      bodyColor: '#9CA3AF',
      padding: 12,
      cornerRadius: 10,
      titleFont: { family: 'Inter', size: 13, weight: '600' },
      bodyFont:  { family: 'Inter', size: 12 },
      displayColors: false,
    }
  },
  scales: {
    x: {
      border: { display: false },
      grid: { display: false },
      ticks: { color: '#9CA3AF', font: { size: 12, family: 'Inter' }, maxRotation: 0 }
    },
    y: {
      border: { display: false },
      grid: { color: '#F3F4F6', lineWidth: 1 },
      ticks: { color: '#9CA3AF', font: { size: 12, family: 'Inter' } }
    }
  }
};

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

  /* ── Faturamento — área com gradiente ── */
  if (cf) {
    const { ym, lb } = _lastMonths(6);
    const data = ym.map(m => DB.peds.filter(p => p.dt?.startsWith(m)).reduce((a,b) => a+b.tot, 0));
    const ctx = cf.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 220);
    grad.addColorStop(0, 'rgba(37,99,235,.18)');
    grad.addColorStop(1, 'rgba(37,99,235,0)');
    _c.fat = new Chart(cf, {
      type: 'line',
      data: {
        labels: lb,
        datasets: [{
          label: 'Faturamento',
          data,
          borderColor: '#2563EB',
          backgroundColor: grad,
          fill: true,
          tension: 0.45,
          borderWidth: 2.5,
          pointRadius: 5,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#2563EB',
          pointBorderWidth: 2.5,
          pointHoverRadius: 7,
        }]
      },
      options: {
        ...ca,
        plugins: {
          ...ca.plugins,
          legend: { display: false },
          tooltip: {
            ...ca.plugins.tooltip,
            callbacks: { label: ctx => ' ' + brl(ctx.parsed.y) }
          }
        },
        scales: {
          x: { ...ca.scales.x },
          y: {
            ...ca.scales.y,
            ticks: {
              ...ca.scales.y.ticks,
              callback: v => v === 0 ? '' : 'R$' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v)
            }
          }
        }
      }
    });
  }

  /* ── Categorias — donut moderno ── */
  if (cc) {
    const cats      = ['pele','maquiagem','corpo','fragrancias'];
    const catLabels = ['Skincare','Maquiagem','Corpo','Fragrâncias'];
    const catColors = ['#2563EB','#7C3AED','#059669','#EA580C'];
    const catData   = cats.map(cat => {
      const names = new Set(DB.prods.filter(p => p.cat === cat).map(p => p.nm));
      return DB.peds.reduce((a,p) => {
        if (p.itens) return a + p.itens.filter(i => names.has(i.nm)).reduce((s,i) => s+i.q, 0);
        return names.has(p.prod) ? a + p.q : a;
      }, 0);
    });
    const hasData = catData.some(v => v > 0);
    _c.cat = new Chart(cc, {
      type: 'doughnut',
      data: {
        labels: catLabels,
        datasets: [{
          data: hasData ? catData : [1,1,1,1],
          backgroundColor: catColors,
          borderWidth: 3,
          borderColor: '#fff',
          hoverOffset: 6,
        }]
      },
      options: {
        ...ca,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              font: { family: 'Inter', size: 12, weight: '500' },
              color: '#374151', padding: 16,
              usePointStyle: true, pointStyleWidth: 10,
            }
          },
          tooltip: {
            ...ca.plugins.tooltip,
            callbacks: { label: ctx => `  ${ctx.label}: ${ctx.parsed} vendas` }
          }
        }
      }
    });
  }
}

function rFlxChart() {
  dc('flx');
  const c = $('ch-flx');
  if (!c) return;
  const { ym, lb } = _lastMonths(6);
  const rec = ym.map(m => DB.trans.filter(t => t.tp==='receita' && t.dt?.startsWith(m)).reduce((a,b) => a+b.vl, 0));
  const des = ym.map(m => DB.trans.filter(t => t.tp==='despesa' && t.dt?.startsWith(m)).reduce((a,b) => a+b.vl, 0));
  const ctx = c.getContext('2d');
  const gRec = ctx.createLinearGradient(0,0,0,220);
  gRec.addColorStop(0, 'rgba(5,150,105,.18)'); gRec.addColorStop(1, 'rgba(5,150,105,0)');
  const gDes = ctx.createLinearGradient(0,0,0,220);
  gDes.addColorStop(0, 'rgba(220,38,38,.14)'); gDes.addColorStop(1, 'rgba(220,38,38,0)');
  _c.flx = new Chart(c, {
    type: 'line',
    data: { labels: lb, datasets: [
      { label: 'Receita', data: rec, borderColor: '#059669', backgroundColor: gRec, fill: true, tension: 0.45, borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: '#fff', pointBorderColor: '#059669', pointBorderWidth: 2 },
      { label: 'Despesa', data: des, borderColor: '#DC2626', backgroundColor: gDes, fill: true, tension: 0.45, borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: '#fff', pointBorderColor: '#DC2626', pointBorderWidth: 2 }
    ]},
    options: {
      ...ca,
      plugins: {
        ...ca.plugins,
        tooltip: {
          ...ca.plugins.tooltip,
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${brl(ctx.parsed.y)}` }
        }
      },
      scales: {
        x: { ...ca.scales.x },
        y: { ...ca.scales.y, ticks: { ...ca.scales.y.ticks, callback: v => v === 0 ? '' : 'R$'+(v>=1000?(v/1000).toFixed(0)+'k':v) } }
      }
    }
  });
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

  // Modo local: pula auth, exibe badge na sidebar
  if (window._localMode) {
    const emailEl = $('user-email');
    if (emailEl) { emailEl.textContent = '🧪 Modo Local'; emailEl.style.color = '#F59E0B'; }
  } else if (window._sbClient) {
    // Verificar sessão Supabase (só se configurado e não for modo local)
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
  requestNotifPermission();
  initRealtimeOrders();
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
