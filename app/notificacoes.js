/* =====================================================
   app/notificacoes.js — Central de notificações
   (desktop + mobile) e geração automática
   ===================================================== */

/* ── Permissão e Som ──────────────────────────────── */

const _NP_KEY = 'srt_notif_prompt_dismissed';

function maybeShowNotifPrompt() {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'default') return;
  if (localStorage.getItem(_NP_KEY)) return;
  /* Mostra 3s após load, para não assustar na entrada */
  setTimeout(() => {
    const el = $('notif-prompt');
    if (el) el.classList.add('on');
  }, 3000);
}

async function enableNotifFromPrompt() {
  dismissNotifPrompt();
  if (!('Notification' in window)) return;
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    showToast('Notificações ativadas ✓', 'ok');
  }
}

function dismissNotifPrompt() {
  const el = $('notif-prompt');
  if (el) el.classList.remove('on');
  localStorage.setItem(_NP_KEY, '1');
}

const _notifSounds = {
  order:   [[523, 0,    0.12, 0.3], [659, 0.15, 0.12, 0.3], [784, 0.30, 0.22, 0.3]],
  solic:   [[659, 0,    0.12, 0.3], [659, 0.17, 0.15, 0.3]],
  fiado:   [[440, 0,    0.18, 0.3], [330, 0.23, 0.30, 0.3]],
  stock:   [[200, 0,    0.40, 0.2]],
  extrato: [[440, 0,    0.10, 0.25], [523, 0.14, 0.22, 0.3]],
};

function playNotifSound(type) {
  try {
    const ctx   = new (window.AudioContext || window.webkitAudioContext)();
    const notes = _notifSounds[type] || _notifSounds.order;
    notes.forEach(([freq, delay, dur, vol]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + dur + 0.05);
    });
  } catch(e) {}
}

function fireOSNotification(n) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const notif = new Notification(n.title, {
      body:  n.msg,
      icon:  './icon-192.png',
      badge: './icon-192.png',
      tag:   n.key,
    });
    notif.onclick = () => {
      window.focus();
      notif.close();
      if (n.link) {
        if (window.innerWidth <= 768) mobNav(n.link);
        else epage(n.link, null);
      }
    };
  } catch(e) {}
}

/* ── CRUD básico ──────────────────────────────────── */
function addNotif({ key, type, icon, title, msg, link }) {
  if (localStorage.getItem('mlb_notif_dismissed_' + key)) return;
  const existing = DB.notifs.find(n => n.key === key);
  if (existing) {
    if (existing.title !== title || existing.msg !== msg) {
      existing.title = title;
      existing.msg   = msg;
      sbSync(() => SBNotifs.upsert(existing));
    }
    return;
  }
  const n = { id: DB.nid.notif++, key, type, icon, title, msg, link: link || '', read: false, dt: new Date().toISOString() };
  DB.notifs.push(n);
  sbSync(() => SBNotifs.upsert(n));
  playNotifSound(type);
  fireOSNotification(n);
}

function removeNotif(key) {
  const i = DB.notifs.findIndex(n => n.key === key);
  if (i < 0) return;
  const [n] = DB.notifs.splice(i, 1);
  sbSync(() => SBNotifs.delete(n.id));
}

function markNotifRead(id) {
  const n = DB.notifs.find(x => x.id === id);
  if (!n || n.read) return;
  n.read = true;
  sbSync(() => SBNotifs.upsert(n));
  rNotifBadge();
}

function markAllNotifsRead() {
  let changed = false;
  DB.notifs.forEach(n => {
    if (!n.read) { n.read = true; changed = true; sbSync(() => SBNotifs.upsert(n)); }
  });
  if (changed) { rNotif(); rNotifBadge(); }
}

function dismissNotif(id, ev) {
  if (ev) ev.stopPropagation();
  const n = DB.notifs.find(x => x.id === id);
  if (!n) return;
  localStorage.setItem('mlb_notif_dismissed_' + n.key, '1');
  removeNotif(n.key);
  rNotif();
  rNotifBadge();
}

function openNotif(id) {
  const n = DB.notifs.find(x => x.id === id);
  if (!n) return;
  markNotifRead(id);
  rNotif();
  closeNotifPanel();
  if (n.link) {
    if (n.link === 'extrato') { _extY = 0; _extM = 0; }
    if (window.innerWidth <= 768) mobNav(n.link); else epage(n.link, null);
  }
}

/* ── Painel ───────────────────────────────────────── */
function toggleNotifPanel() {
  const dr = $('notif-drawer');
  if (dr && dr.classList.contains('open')) closeNotifPanel(); else openNotifPanel();
}

function openNotifPanel() {
  rNotif();
  $('notif-backdrop')?.classList.add('on');
  $('notif-drawer')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeNotifPanel() {
  $('notif-backdrop')?.classList.remove('on');
  $('notif-drawer')?.classList.remove('open');
  document.body.style.overflow = '';
}

/* ── Render ───────────────────────────────────────── */
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1)  return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

function rNotif() {
  const el = $('notif-list');
  if (!el) return;
  if (!DB.notifs.length) {
    el.innerHTML = `<div class="notif-empty"><span class="notif-empty-icon">🔔</span>Nenhuma notificação por aqui.</div>`;
    return;
  }
  const sorted = [...DB.notifs].sort((a, b) => new Date(b.dt) - new Date(a.dt));
  el.innerHTML = sorted.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" onclick="openNotif(${n.id})">
      <div class="notif-icon notif-icon-${n.type}">${n.icon}</div>
      <div class="notif-body">
        <div class="notif-title">${esc(n.title)}</div>
        <div class="notif-msg">${esc(n.msg)}</div>
        <div class="notif-time">${timeAgo(n.dt)}</div>
      </div>
      <button class="notif-dismiss" onclick="dismissNotif(${n.id}, event)" title="Remover">✕</button>
    </div>`).join('');
}

function rNotifBadge() {
  const unread = DB.notifs.filter(n => !n.read).length;
  const d = $('notif-badge-desktop');
  if (d) {
    d.textContent = unread > 9 ? '9+' : unread;
    d.classList.toggle('on', unread > 0);
  }
  const m = $('notif-badge-mobile');
  if (m) m.classList.toggle('on', unread > 0);
}

/* ── Geração automática ───────────────────────────── */
function genAutoNotifs() {
  /* Estoque baixo / esgotado */
  DB.prods.forEach(p => {
    const key = `stock_${p.id}`;
    if (p.st === 0) {
      addNotif({ key, type: 'stock', icon: '⛔', title: `Esgotado: ${p.nm}`, msg: 'Produto sem estoque disponível.', link: 'estoque' });
    } else if (p.st <= 5) {
      addNotif({ key, type: 'stock', icon: '⚠️', title: `Estoque baixo: ${p.nm}`, msg: `Restam ${p.st} unidade${p.st === 1 ? '' : 's'}.`, link: 'estoque' });
    } else {
      removeNotif(key);
    }
  });

  /* Fiado vencido */
  const vencidos = DB.peds.filter(p => p.pag === 'Fiado' && p.dtpag && p.dtpag < td());
  vencidos.forEach(p => {
    const c = DB.clis.find(x => x.id === p.cid);
    addNotif({ key: `fiado_${p.id}`, type: 'fiado', icon: '⏰', title: 'Pagamento vencido', msg: `${c ? c.nm : 'Cliente'} · ${brl(p.tot)} (pedido #${p.id})`, link: 'receber' });
  });
  DB.notifs.filter(n => n.type === 'fiado').forEach(n => {
    if (!vencidos.some(p => `fiado_${p.id}` === n.key)) removeNotif(n.key);
  });

  /* Pedidos pendentes */
  const pendentes = DB.peds.filter(p => p.st === 'Pendente');
  pendentes.forEach(p => {
    const c = DB.clis.find(x => x.id === p.cid);
    addNotif({ key: `ped_${p.id}`, type: 'order', icon: '🛒', title: `Novo pedido #${p.id}`, msg: `${c ? c.nm : 'Cliente'} · ${brl(p.tot)}`, link: 'historico' });
  });
  DB.notifs.filter(n => n.type === 'order').forEach(n => {
    if (!pendentes.some(p => `ped_${p.id}` === n.key)) removeNotif(n.key);
  });

  /* Solicitações pendentes */
  const solicsPend = DB.solics.filter(s => s.st === 'Pendente');
  solicsPend.forEach(s => {
    addNotif({ key: `solic_${s.id}`, type: 'solic', icon: '📋', title: 'Solicitação pendente', msg: `${s.nm} ×${s.q}`, link: 'solicita' });
  });
  DB.notifs.filter(n => n.type === 'solic').forEach(n => {
    if (!solicsPend.some(s => `solic_${s.id}` === n.key)) removeNotif(n.key);
  });

  /* Extrato do mês anterior */
  genExtratoNotif();

  rNotif();
  rNotifBadge();
}

function genExtratoNotif() {
  const prev = new Date();
  prev.setDate(1);
  prev.setMonth(prev.getMonth() - 1);
  const prevY = prev.getFullYear();
  const prevM = prev.getMonth() + 1;
  const mStr  = `${prevY}-${String(prevM).padStart(2, '0')}`;
  const temDados = DB.peds.some(p => p.dt?.startsWith(mStr)) || DB.trans.some(t => t.dt?.startsWith(mStr));
  if (!temDados) return;
  const mnNames = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  addNotif({
    key: `extrato_${prevY}_${prevM}`,
    type: 'extrato', icon: '🧾',
    title: `Extrato de ${mnNames[prevM - 1]} disponível`,
    msg: 'Confira o resumo de vendas e recebimentos do mês.',
    link: 'extrato'
  });
}
