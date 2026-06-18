/* =====================================================
   core.js — Utilidades compartilhadas + DB + Supabase
   Carregado por: erp.html e index.html
   ===================================================== */

const $ = id => document.getElementById(id);

/* Escapa texto antes de interpolar em innerHTML — usar sempre em campos
   que podem conter dados de terceiros (nome/telefone de clientes, itens
   de pedidos da loja, observações, etc.). */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
const brl = v => 'R$ ' + (+v).toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+,)/g, '$1.');
const fdt = d => { if (!d) return '—'; const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; };
const td = () => new Date().toISOString().split('T')[0];
const addDays = (d, n) => { const dt = new Date(d + 'T00:00:00'); dt.setDate(dt.getDate() + n); return dt.toISOString().split('T')[0]; };
const cNm = { pele: 'Skincare', corpo: 'Corpo', maquiagem: 'Maquiagem', fragrancias: 'Fragrâncias' };
const stB = { Pendente: 'xb-gold', Confirmado: 'xb-blue', Enviado: 'xb-gray', Entregue: 'xb-green' };

const DB = {
  prods: [],
  clis:  [],
  peds:  [],
  trans: [],
  solics: [],
  notifs: [],
  cart: [],
  nid: { p: 200, c: 200, ped: 2000, t: 200, s: 100, notif: 1 },
  settings: {
    banner:    'Frete <em>GRÁTIS</em> em compras acima de R$ 150 · Consultoria personalizada inclusa em cada pedido',
    whatsapp:  '5511999999999',
    pix:       '',
    pixVerified: false,
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
    ],
    theme: { template: 'classico', primary: '#3D6655', accent: '#C4897A', font: 'elegante' },
    published: true
  }
};

/* ── Configurações persistidas (chave por loja/slug) ── */
const SETTINGS_KEY = 'mlb_settings_' + (new URLSearchParams(location.search).get('loja') || 'default');

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    const s = DB.settings;
    if (saved.banner    !== undefined) s.banner    = saved.banner;
    if (saved.whatsapp  !== undefined) s.whatsapp  = saved.whatsapp;
    if (saved.pix       !== undefined) s.pix       = saved.pix;
    if (saved.pixVerified !== undefined) s.pixVerified = saved.pixVerified;
    if (saved.heroKicker!== undefined) s.heroKicker= saved.heroKicker;
    if (saved.heroLines && Array.isArray(saved.heroLines)) s.heroLines = saved.heroLines;
    if (saved.heroSub   !== undefined) s.heroSub   = saved.heroSub;
    if (saved.heroProof !== undefined) s.heroProof = saved.heroProof;
    if (saved.marquee   !== undefined) s.marquee   = saved.marquee;
    if (saved.benefits  && Array.isArray(saved.benefits)) s.benefits  = saved.benefits;
    if (saved.theme     && typeof saved.theme === 'object') Object.assign(s.theme, saved.theme);
    if (saved.published !== undefined) s.published = saved.published;
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
  const tid = window._tenant?.id || null;
  const [prods, clis, peds, trans, solics, notifs, settings] = await Promise.all([
    safe(() => SBProds.list(tid)),
    safe(() => SBClis.list(tid)),
    safe(() => SBPeds.list(tid)),
    safe(() => SBTrans.list(tid)),
    safe(() => SBSolics.list(tid)),
    safe(() => SBNotifs.list(tid)),
    safe(() => SBSettings.get(tid))
  ]);
  if (prods)    { DB.prods  = prods;  if (prods.length)  DB.nid.p   = Math.max(...prods.map(x => x.id))  + 1; }
  if (clis)     { DB.clis   = clis;   if (clis.length)   DB.nid.c   = Math.max(...clis.map(x => x.id))   + 1; }
  if (peds)     { DB.peds   = peds;   if (peds.length)   DB.nid.ped = Math.max(...peds.map(x => x.id))   + 1; }
  if (trans)    { DB.trans  = trans;  if (trans.length)  DB.nid.t   = Math.max(...trans.map(x => x.id))  + 1; }
  if (solics)   { DB.solics = solics; if (solics.length) DB.nid.s   = Math.max(...solics.map(x => x.id)) + 1; }
  if (notifs)   { DB.notifs = notifs; if (notifs.length) DB.nid.notif = Math.max(...notifs.map(x => x.id)) + 1; }
  if (settings) Object.assign(DB.settings, settings);
  safe(() => Tenants.pingActivity());
}

/* ── Geração de IDs (V6) ──────────────────────────────
   Pede o próximo id ao Postgres via RPC next_id(), que faz
   um incremento atômico por tenant — evita que dois
   dispositivos calculem o mesmo max(id)+1 e um upsert
   sobrescreva o registro do outro. Em modo local (sem
   Supabase) usa o contador local de sempre. */
const _ID_TABLE = { p: 'products', c: 'clients', ped: 'orders', t: 'transactions', s: 'solicitacoes' };

/* ── Botões de ação "prontos" ─────────────────────────
   Padrão visual: um botão de avançar/salvar/confirmar
   fica verde (.btn-success) assim que o pré-requisito da
   ação (campo obrigatório preenchido, item selecionado,
   carrinho não-vazio etc.) é atendido — mesmo princípio
   do botão "Ir para pagamento" da Nova Venda. */
function setBtnReady(id, ready) {
  const b = $(id);
  if (b) b.classList.toggle('btn-success', !!ready);
}

async function nextId(kind) {
  if (_sbReady && !window._localMode && _ID_TABLE[kind]) {
    try { return await SBIds.next(_ID_TABLE[kind]); }
    catch(e) { console.warn('[nextId]', e.message); }
  }
  return DB.nid[kind]++;
}

async function doLogout() {
  if (typeof nvHasProgress === 'function' && nvHasProgress()) {
    nvConfirmLeave(() => doLogout());
    return;
  }
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
