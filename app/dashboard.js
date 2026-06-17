/* =====================================================
   app/dashboard.js — Dashboard: métricas, atenção,
   popup, atividade recente, estoque baixo
   ===================================================== */

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
  const reveal = () => {
    el.style.display = 'block';
    el.classList.remove('closing');
  };

  const rlOv = $('rl-ov');
  if (rlOv && rlOv.classList.contains('on')) {
    rlOv.addEventListener('transitionend', () => setTimeout(reveal, 400), { once: true });
  } else {
    setTimeout(reveal, 700);
  }
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

/* Greeting com nome real do usuário logado */
async function rGreeting() {
  const h     = new Date().getHours();
  const greet = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const emoji = h < 12 ? '☀️' : h < 18 ? '👋' : '🌙';

  /* Nome por tenant (store_settings.displayName) — independente da conta */
  let nome = DB.settings?.displayName || 'você';
  if (nome === 'você' && DB.settings?.heroKicker) {
    nome = DB.settings.heroKicker.replace('Consultora Oficial Mary Kay','').replace('Consultora','').trim().split(' ')[0] || 'você';
  }
  nome = nome.split(' ')[0];
  nome = nome.charAt(0).toUpperCase() + nome.slice(1);

  const dias  = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const now   = new Date();
  const hi    = $('dash-hello');
  const dt    = $('dash-date');
  const emhN  = $('emh-name');
  if (hi) hi.textContent = `${greet}, ${nome}! ${emoji}`;
  if (dt) dt.textContent = `${dias[now.getDay()]}, ${now.getDate()} de ${meses[now.getMonth()]} de ${now.getFullYear()}`;
  if (emhN) emhN.innerHTML = `${greet}, <b>${esc(nome)}</b>`;
}

function rMet() {
  rGreeting();
  rDashAttention();

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

  const novosCli = DB.clis.filter(c => c.ult?.startsWith(curM)).length;

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
  const cardsEl = $('dash-rec-cards');
  if (!el && !cardsEl) return;

  const todos = [...DB.peds].reverse();
  if (!todos.length) {
    const msg = '<p class="small-note" style="padding:20px 0;text-align:center;color:var(--tx-s)">Nenhum pedido ainda. <a href="#" onclick="openMod(\'mv\')" style="color:var(--gl)">Registrar primeira venda →</a></p>';
    if (el)      el.innerHTML      = msg;
    if (cardsEl) cardsEl.innerHTML = msg;
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
      <div class="order-avatar" style="background:var(${bg});color:var(${fg})">${esc(ini)}</div>
      <div class="order-info">
        <div class="order-name">${esc(nm)}</div>
        <div class="order-product">${esc(prod)} · ${fdt(p.dt)}</div>
      </div>
      <div class="order-right">
        <div class="order-value">${brl(p.tot)}</div>
        <span class="xb ${stCls[p.st]||'xb-gray'}">${p.st}</span>
      </div>
    </div>`;
  }).join('');

  const cards = slice.map((p, idx) => {
    const c   = DB.clis.find(x => x.id === p.cid);
    const nm  = c ? c.nm : '—';
    const ini = nm.split(' ').filter(Boolean).map(w => w[0]).slice(0,2).join('').toUpperCase();
    const prod = p.itens && p.itens.length > 1
      ? `${p.itens[0].nm} +${p.itens.length - 1}`
      : (p.itens?.[0]?.nm || p.prod);
    const [bg, fg] = avatarColors[idx % avatarColors.length].split(',');
    return `<div class="rb-card" style="cursor:pointer" onclick="editPed(${p.id})">
      <div class="rb-card-top">
        <div class="order-avatar" style="background:var(${bg});color:var(${fg})">${esc(ini)}</div>
        <div class="rb-card-info">
          <div class="rb-card-name">${esc(nm)}</div>
          <div class="rb-card-prod">${esc(prod)} · ${fdt(p.dt)}</div>
        </div>
        <div class="rb-card-val">${brl(p.tot)}</div>
      </div>
      <div class="rb-card-bottom">
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

  if (el)      el.innerHTML      = rows + pagination;
  if (cardsEl) cardsEl.innerHTML = cards + pagination;
}

/* ── Precisa de atenção ── */
let _atnPage = 0;
const ATN_PER_PAGE = 4;

function rDashAttention(page) {
  if (page !== undefined) _atnPage = page;
  const el = $('dash-attention');
  if (!el) return;

  const vencidos = DB.peds.filter(p => p.pag === 'Fiado' && p.dtpag && p.dtpag < td());
  const critico  = DB.prods.filter(p => p.st <= 2);

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
            <span class="atn-row-name">${esc(nm)}</span>
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
            <span class="atn-row-name">${esc(p.em || '')} ${esc(p.nm)}</span>
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

/* rDashLow — mantida para compatibilidade */
function rDashLow() {
  const low = DB.prods.filter(p => p.st <= 5);
  if (!$('dash-low')) return;
  if (!low.length) { $('dash-low').innerHTML = '<p class="small-note" style="padding:16px 0">✓ Todos os produtos OK</p>'; return; }
  $('dash-low').innerHTML = low.map(p => {
    const pct = Math.min(100, Math.round((p.st/10)*100));
    const barCls = p.st===0?'stock-bar-out':p.st<=2?'stock-bar-low':'stock-bar-ok';
    return `<div class="stock-item">
      <div class="stock-emoji">${esc(p.em||'📦')}</div>
      <div class="stock-info">
        <div class="stock-name">${esc(p.nm)}</div>
        <div class="stock-bar-wrap"><div class="stock-bar-fill ${barCls}" style="width:${pct}%"></div></div>
      </div>
      <span class="xb ${p.st===0?'xb-red':'xb-gold'}">${p.st} un.</span>
    </div>`;
  }).join('');
}
