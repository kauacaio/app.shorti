/* =====================================================
   store.js — Loja / Tela de Vendas
   Depende de: app.js (DB, $, brl, cNm, showToast)
   ===================================================== */

const ERP_PW = 'milena2025';

/* ── Cadastro rápido (nome + WhatsApp) salvo por loja ──────────── */
const CUSTOMER_KEY = 'mlb_customer_' + (new URLSearchParams(location.search).get('loja') || 'default');

function loadCustomerInfo() {
  try {
    const raw = localStorage.getItem(CUSTOMER_KEY);
    return raw ? JSON.parse(raw) : { nome: '', tel: '' };
  } catch(e) { return { nome: '', tel: '' }; }
}
function saveCustomerInfo(info) {
  try { localStorage.setItem(CUSTOMER_KEY, JSON.stringify(info)); } catch(e) {}
}

/* ── Tema: pares de fonte por estilo ─────────────── */
const FONT_PAIRS = {
  elegante:    ["'Cormorant Garamond', Georgia, serif", "'DM Sans', system-ui, sans-serif"],
  moderno:     ["'Poppins', system-ui, sans-serif", "'Inter', system-ui, sans-serif"],
  minimal:     ["'Inter', system-ui, sans-serif", "'Inter', system-ui, sans-serif"],
  classica:    ["'Playfair Display', Georgia, serif", "'Lato', system-ui, sans-serif"],
  suave:       ["'Quicksand', system-ui, sans-serif", "'Nunito Sans', system-ui, sans-serif"],
  sofisticada: ["'Marcellus', Georgia, serif", "'Manrope', system-ui, sans-serif"]
};

/* Clareia (percent > 0) ou escurece (percent < 0) uma cor hex */
function shade(hex, percent) {
  const m = (hex || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return hex;
  let r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
  const apply = c => {
    const v = percent >= 0 ? c + (255 - c) * percent : c * (1 + percent);
    return Math.max(0, Math.min(255, Math.round(v)));
  };
  [r, g, b] = [apply(r), apply(g), apply(b)];
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

/* ── Navegação ───────────────────────────────────── */
function goto(id) {
  const e = document.getElementById(id);
  if (e) e.scrollIntoView({ behavior: 'smooth' });
}

/* ── Login ───────────────────────────────────────── */
function showLogin() {
  $('store').style.display = 'none';
  $('login').style.display = 'flex';
  if ($('login-err')) $('login-err').classList.remove('on');
  setTimeout(() => { const f = $('login-em') || $('login-pw'); if (f) f.focus(); }, 80);
}

function closeLogin() {
  $('login').style.display = 'none';
  $('store').style.display = 'block';
  if ($('login-em')) $('login-em').value = '';
  if ($('login-pw')) $('login-pw').value = '';
  if ($('login-err')) $('login-err').classList.remove('on');
}

async function doLogin(e) {
  e.preventDefault();
  const emailEl = $('login-em');
  const pw      = $('login-pw');
  const btn     = e.target.querySelector('[type=submit]');
  if (btn) { btn.disabled = true; btn.textContent = 'Entrando…'; }

  const fail = () => {
    if ($('login-err')) $('login-err').classList.add('on');
    pw.value = '';
    pw.focus();
    const card = $('login-card');
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
    if (btn) { btn.disabled = false; btn.textContent = 'Entrar no painel'; }
  };

  // Tenta Supabase Auth (quando configurado)
  if (window._sbClient && emailEl?.value) {
    try {
      await SBAuth.signIn(emailEl.value.trim(), pw.value);
      window.location.href = 'erp.html';
      return;
    } catch(err) {
      fail();
      return;
    }
  }

  // Fallback — senha local
  if (pw.value === ERP_PW) {
    pw.value = '';
    window.location.href = 'erp.html';
  } else {
    fail();
  }
}

function togglePw() {
  const pw = $('login-pw');
  if (pw) pw.type = pw.type === 'password' ? 'text' : 'password';
}

/* ── Animações ───────────────────────────────────── */
function initScrollReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('vis'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal,.reveal-r,.reveal-l').forEach(el => {
    if (!el.classList.contains('vis')) obs.observe(el);
  });
}

function initCursor() {
  if (document.querySelector('.cursor')) return;
  const cur = document.createElement('div');
  cur.className = 'cursor';
  document.body.appendChild(cur);
  document.addEventListener('mousemove', e => {
    cur.style.transform = `translate(${e.clientX - 5}px,${e.clientY - 5}px)`;
    cur.classList.add('ready');
  });
  document.querySelectorAll('button,a,.pcard,.filter-btn,.hero-gcard,.telao-cta').forEach(el => {
    el.addEventListener('mouseenter', () => cur.classList.add('hover'));
    el.addEventListener('mouseleave', () => cur.classList.remove('hover'));
  });
}

function initCounters() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const target = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const isFloat = target % 1 !== 0;
      const dur = 1400;
      const t0 = performance.now();
      const tick = now => {
        const p = Math.min((now - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (isFloat ? (eased * target).toFixed(1) : Math.round(eased * target)) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      obs.unobserve(el);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('.stat-num[data-count]').forEach(el => obs.observe(el));
}

/* ── Hero — galeria de dois produtos ─────────────── */
function rHeroCards() {
  const g = $('hero-gallery');
  if (!g) return;
  const picks = DB.prods.filter(p => p.st > 0).slice(0, 2);
  g.innerHTML = picks.map((p, i) => `
    <div class="hero-gcard ${i === 1 ? 'hero-gcard--b' : ''}" onclick="addC(${p.id})">
      <div class="hero-gc-img">
        ${p.img ? `<img src="${p.img}" alt="${p.nm}" loading="eager" onerror="this.style.display='none'">` : ''}
      </div>
      <div class="hero-gc-foot">
        <span class="hero-gc-cat">${cNm[p.cat]}</span>
        <div class="hero-gc-nm">${p.nm}</div>
        <span class="hero-gc-pr">${brl(p.pd || p.pr)}</span>
      </div>
    </div>`).join('');
}

/* ── Produtos (grade) ────────────────────────────── */
function rProds(cat) {
  const g = $('pgrid');
  if (!g) return;
  const list = cat === 'todos' ? DB.prods : DB.prods.filter(p => p.cat === cat);
  g.innerHTML = list.map(p => `
    <div class="pcard reveal">
      <div class="pcard-img">
        ${p.img ? `<img src="${p.img}" alt="${p.nm}" loading="lazy" onerror="this.style.display='none'">` : ''}
        ${p.dt ? `<div class="pbadge ${p.dt === 'new' ? 'b-new' : 'b-sale'}">${p.dt === 'new' ? 'Novo' : 'Promo'}</div>` : ''}
        ${p.st > 0 && p.st <= 3 ? `<div class="pstock-pill">Só ${p.st} restantes</div>` : ''}
        ${p.st === 0 ? `<div class="pstock-pill pstock-out">Esgotado</div>` : ''}
        <div class="pcard-overlay">
          ${p.desc ? `<p class="pcard-overlay-desc">${p.desc}</p>` : ''}
          <button class="pcard-add" onclick="event.stopPropagation(); addC(${p.id})" ${p.st === 0 ? 'disabled' : ''}>${p.st === 0 ? 'Esgotado' : 'Adicionar'}</button>
        </div>
      </div>
      <div class="pcard-foot">
        <span class="pcard-cat">${cNm[p.cat]}</span>
        <div class="pcard-name">${p.nm}</div>
        ${p.desc ? `<p class="pcard-desc">${p.desc}</p>` : ''}
        <div class="pcard-price">
          ${p.pd
            ? `<span class="pcard-price-new">${brl(p.pd)}</span><span class="pcard-price-old">${brl(p.pr)}</span>`
            : `<span class="pcard-price-reg">${brl(p.pr)}</span>`}
        </div>
      </div>
    </div>`).join('');
  requestAnimationFrame(initScrollReveal);
}

let _currentCat = 'todos';
function filP(cat, btn) {
  _currentCat = cat;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  rProds(cat);
}

function carouselNav(dir) {
  const g = $('pgrid');
  if (!g) return;
  const card = g.querySelector('.pcard');
  const step = card ? card.offsetWidth + 18 : 280;
  g.scrollBy({ left: dir * step * 2, behavior: 'smooth' });
}

/* ── Telão (carrossel de produtos) ───────────────── */
let _telaoIdx = 0;
let _telaoTimer = null;

function initTelao() {
  const track = $('telao-track');
  const dotsEl = $('telao-dots');
  if (!track) return;
  const featured = DB.prods.filter(p => p.st > 0);
  if (!featured.length) return;

  track.innerHTML = featured.map((p, i) => `
    <div class="telao-slide ${i === 0 ? 'on' : ''}">
      <div class="telao-left">
        <span class="telao-cat">${cNm[p.cat]}</span>
        <h2 class="telao-name">${p.nm}</h2>
        <p class="telao-desc">${p.desc || ''}</p>
        <div class="telao-prices">
          ${p.pd
            ? `<span class="telao-price-new">${brl(p.pd)}</span><span class="telao-price-old">${brl(p.pr)}</span>`
            : `<span class="telao-price-new">${brl(p.pr)}</span>`}
        </div>
        <button class="telao-cta" onclick="addC(${p.id})">Adicionar ao carrinho</button>
      </div>
      <div class="telao-right">
        ${p.img
          ? `<img src="${p.img}" alt="${p.nm}" class="telao-img" onerror="this.style.display='none'">`
          : `<div class="telao-img-placeholder"></div>`}
      </div>
    </div>`).join('');

  if (dotsEl) {
    dotsEl.innerHTML = featured.map((_, i) =>
      `<button class="telao-dot ${i === 0 ? 'on' : ''}" onclick="telaoGo(${i})"></button>`
    ).join('');
  }

  clearInterval(_telaoTimer);
  _telaoTimer = setInterval(() => telaoNav(1), 5000);
}

function telaoNav(dir) {
  const slides = document.querySelectorAll('.telao-slide');
  if (!slides.length) return;
  slides[_telaoIdx].classList.remove('on');
  document.querySelectorAll('.telao-dot')[_telaoIdx]?.classList.remove('on');
  _telaoIdx = (_telaoIdx + dir + slides.length) % slides.length;
  slides[_telaoIdx].classList.add('on');
  document.querySelectorAll('.telao-dot')[_telaoIdx]?.classList.add('on');
}

function telaoGo(idx) {
  clearInterval(_telaoTimer);
  const slides = document.querySelectorAll('.telao-slide');
  if (!slides.length) return;
  slides[_telaoIdx].classList.remove('on');
  document.querySelectorAll('.telao-dot')[_telaoIdx]?.classList.remove('on');
  _telaoIdx = idx;
  slides[idx].classList.add('on');
  document.querySelectorAll('.telao-dot')[idx]?.classList.add('on');
  _telaoTimer = setInterval(() => telaoNav(1), 5000);
}

/* ── Order Bump ──────────────────────────────────── */
let _bumpTimer = null;

function showBump(bumpId) {
  const bump = DB.prods.find(x => x.id === bumpId);
  if (!bump || bump.st === 0) return;
  const panel = $('bump-panel');
  if (!panel) return;
  const emEl = $('bump-em');
  if (emEl) {
    emEl.innerHTML = bump.img
      ? `<img src="${bump.img}" alt="${bump.nm}" onerror="this.style.display='none'">`
      : '';
  }
  if ($('bump-nm')) $('bump-nm').textContent = bump.nm;
  if ($('bump-pr')) $('bump-pr').textContent = brl(bump.pd || bump.pr);
  panel.dataset.id = bump.id;
  panel.classList.add('on');
  clearTimeout(_bumpTimer);
  _bumpTimer = setTimeout(() => panel.classList.remove('on'), 9000);
}

function addBump() {
  const id = parseInt($('bump-panel')?.dataset.id);
  if (id) addC(id);
  $('bump-panel')?.classList.remove('on');
}

function dismissBump() {
  clearTimeout(_bumpTimer);
  $('bump-panel')?.classList.remove('on');
}

/* ── Carrinho ────────────────────────────────────── */
function toggleCart() {
  $('cpanel').classList.toggle('on');
  $('cbg').classList.toggle('on');
}

function addC(id) {
  const p = DB.prods.find(x => x.id === id);
  if (!p) return;
  const ex = DB.cart.find(x => x.id === id);
  if (ex) ex.q += 1;
  else DB.cart.push({ ...p, q: 1 });
  updC();
  showToast(`${p.nm} adicionado ao carrinho`);
  if (p.bump) showBump(p.bump);
}

function updC() {
  const tot = DB.cart.reduce((a, b) => a + (b.pd || b.pr) * b.q, 0);
  $('cnt').textContent = DB.cart.reduce((a, b) => a + b.q, 0);
  const cb = $('cbody'), cf = $('cfoot');
  if (!DB.cart.length) {
    cb.innerHTML = `<div class="cempty"><span>🛒</span><p>Seu carrinho está vazio.</p></div>`;
    cf.style.display = 'none';
    return;
  }
  cb.innerHTML = DB.cart.map(i => `
    <div class="ci">
      <div class="ciimg">${i.img
        ? `<img src="${i.img}" alt="${i.nm}" style="width:100%;height:100%;object-fit:cover;border-radius:10px" onerror="this.style.display='none'">`
        : ''}</div>
      <div class="cinfo">
        <div class="cinm">${i.nm}</div>
        <div class="cipr">${brl((i.pd || i.pr) * i.q)}</div>
        <div class="ciqr"><button class="qb" onclick="cq(${i.id}, -1)">−</button><span class="qn">${i.q}</span><button class="qb" onclick="cq(${i.id}, 1)">+</button><button class="cirm" onclick="crm(${i.id})">✕</button></div>
      </div>
    </div>`).join('');
  cf.style.display = 'flex';
  $('csub').textContent = brl(tot);
  $('ctot').textContent = brl(tot);
}

function cq(id, d) { const i = DB.cart.find(x => x.id === id); if (!i) return; i.q += d; if (i.q <= 0) crm(id); else updC(); }
function crm(id) { DB.cart = DB.cart.filter(x => x.id !== id); updC(); }

function checkout() {
  if (!DB.cart.length) return;

  const nome = ($('cc-nome')?.value || '').trim();
  const tel = ($('cc-tel')?.value || '').trim();
  if (!nome) { showToast('Preencha seu nome para continuar'); $('cc-nome')?.focus(); return; }
  if (!tel) { showToast('Preencha seu WhatsApp para continuar'); $('cc-tel')?.focus(); return; }
  saveCustomerInfo({ nome, tel });

  const msg = encodeURIComponent('Olá Milena! Gostaria de comprar:\n' + DB.cart.map(i => `• ${i.nm} ×${i.q} — ${brl((i.pd || i.pr) * i.q)}`).join('\n') + '\n\nTotal: ' + brl(DB.cart.reduce((a, b) => a + (b.pd || b.pr) * b.q, 0)));
  window.open(`https://wa.me/${(DB.settings?.whatsapp || '5511999999999')}?text=${msg}`, '_blank');

  if (window._sbClient) {
    // Só pid/q vão para o servidor — preço, nome e total são recalculados
    // lá a partir do catálogo real (nunca confiamos no que o navegador envia).
    const itens = DB.cart.map(i => ({ pid: i.id, q: i.q }));
    const slug = window._tenant?.slug || new URLSearchParams(location.search).get('loja') || '';
    SBStorefront.createOrder({ slug, nome, tel, itens }).catch(e => console.warn('[pedido loja]', e?.message));
  }
}

/* ── Produtos em destaque (segunda sessão) ───────── */
function rFeaturedProds() {
  const g = $('pgrid-feat');
  if (!g) return;
  const list = DB.prods.filter(p => p.dt && p.st > 0);
  g.innerHTML = list.map(p => `
    <div class="pcard reveal${p.dt === 'sale' ? ' pcard--sale' : ''}">
      <div class="pcard-img">
        ${p.img ? `<img src="${p.img}" alt="${p.nm}" loading="lazy" onerror="this.style.display='none'">` : ''}
        ${p.dt ? `<div class="pbadge ${p.dt === 'new' ? 'b-new' : 'b-sale'}">${p.dt === 'new' ? 'Novo' : 'Promo'}</div>` : ''}
        ${p.st > 0 && p.st <= 3 ? `<div class="pstock-pill">Só ${p.st} restantes</div>` : ''}
        <div class="pcard-overlay">
          ${p.desc ? `<p class="pcard-overlay-desc">${p.desc}</p>` : ''}
          <button class="pcard-add" onclick="event.stopPropagation(); addC(${p.id})">Adicionar</button>
        </div>
      </div>
      <div class="pcard-foot">
        <span class="pcard-cat">${cNm[p.cat]}</span>
        <div class="pcard-name">${p.nm}</div>
        ${p.desc ? `<p class="pcard-desc">${p.desc}</p>` : ''}
        <div class="pcard-price">
          ${p.pd
            ? `<span class="pcard-price-new">${brl(p.pd)}</span><span class="pcard-price-old">${brl(p.pr)}</span>`
            : `<span class="pcard-price-reg">${brl(p.pr)}</span>`}
        </div>
      </div>
    </div>`).join('');
  requestAnimationFrame(initScrollReveal);
}

/* ── Seção verde — efeitos interativos ───────────── */
function initFeatureSplit() {
  const sec = document.querySelector('.feature-split');
  if (!sec) return;

  // Reveal de palavras ao entrar na viewport
  const obs = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    sec.classList.add('fs-active');
    obs.disconnect();
  }, { threshold: 0.3 });
  obs.observe(sec);

  // Glow que segue o mouse + parallax no visual
  const vis = sec.querySelector('.fs-visual');
  sec.addEventListener('mousemove', e => {
    const r = sec.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width * 100).toFixed(1);
    const y = ((e.clientY - r.top) / r.height * 100).toFixed(1);
    sec.style.setProperty('--mx', x + '%');
    sec.style.setProperty('--my', y + '%');
    if (vis) {
      const cx = (e.clientX - r.left - r.width / 2) / r.width;
      const cy = (e.clientY - r.top - r.height / 2) / r.height;
      vis.style.transform = `translate(${(cx * 22).toFixed(1)}px, ${(cy * 14).toFixed(1)}px)`;
    }
  });
  sec.addEventListener('mouseleave', () => {
    sec.style.setProperty('--mx', '35%');
    sec.style.setProperty('--my', '50%');
    if (vis) vis.style.transform = '';
  });

  // Botão CTA — glow segue cursor interno
  const cta = sec.querySelector('.fs-cta');
  if (cta) {
    cta.addEventListener('mousemove', e => {
      const r = cta.getBoundingClientRect();
      cta.style.setProperty('--bx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      cta.style.setProperty('--by', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    });
  }
}

/* ── Progresso do carousel ───────────────────────── */
function initCarouselProgress() {
  const g = $('pgrid');
  const fill = $('pgrid-bar-fill');
  const hint = $('pgrid-drag-hint');
  if (!g || !fill) return;
  g.addEventListener('scroll', () => {
    const max = g.scrollWidth - g.clientWidth;
    fill.style.width = (max > 0 ? (g.scrollLeft / max) * 100 : 0) + '%';
    if (hint && g.scrollLeft > 20) hint.classList.add('used');
  }, { passive: true });
  // seed inicial da barra
  const max = g.scrollWidth - g.clientWidth;
  if (max > 0) fill.style.width = (g.scrollLeft / max * 100) + '%';
}

/* ── Aplica configurações da loja ────────────────── */
function applySettings() {
  const s = DB.settings;
  if (!s) return;

  /* Tema: modelo de loja, cores e fontes */
  const theme = s.theme || {};
  document.documentElement.setAttribute('data-template', theme.template || 'classico');
  const root = document.documentElement.style;
  if (theme.primary) {
    root.setProperty('--brand', theme.primary);
    root.setProperty('--sage-accent', theme.primary);
  }
  if (theme.accent) {
    root.setProperty('--rose', theme.accent);
    root.setProperty('--blush-mid', theme.accent);
    root.setProperty('--rose-dark', shade(theme.accent, -0.25));
    root.setProperty('--blush-deep', shade(theme.accent, -0.25));
    root.setProperty('--rose-soft', shade(theme.accent, 0.85));
    root.setProperty('--blush', shade(theme.accent, 0.85));
  }
  const fonts = FONT_PAIRS[theme.font] || FONT_PAIRS.elegante;
  root.setProperty('--font-display', fonts[0]);
  root.setProperty('--font-body', fonts[1]);

  const banner = document.querySelector('.urgency-banner');
  if (banner && s.banner) banner.innerHTML = s.banner;
  const kicker = document.querySelector('.hero-kicker');
  if (kicker && s.heroKicker) {
    const line = kicker.querySelector('.kicker-line');
    kicker.innerHTML = '';
    if (line) kicker.appendChild(line);
    kicker.appendChild(document.createTextNode(s.heroKicker));
  }
  if (s.heroLines) {
    document.querySelectorAll('.hl-line').forEach((el, i) => { if (s.heroLines[i] !== undefined) el.textContent = s.heroLines[i]; });
  }
  const sub = document.querySelector('.hero-sub');
  if (sub && s.heroSub) sub.textContent = s.heroSub;
  const pf = document.querySelector('.proof-text');
  if (pf && s.heroProof) {
    const parts = s.heroProof.split('·').map(p => p.trim());
    pf.innerHTML = parts.length > 1 ? `<strong>${parts[0]}</strong> &middot; ${parts.slice(1).join(' · ')}` : s.heroProof;
  }
  if (s.marquee) document.querySelectorAll('.marquee-track span').forEach(el => { el.textContent = s.marquee + ' '; });
  if (s.benefits) {
    document.querySelectorAll('.benefit-item').forEach((el, i) => {
      if (!s.benefits[i]) return;
      const t = el.querySelector('.benefit-title');
      const d = el.querySelector('.benefit-desc');
      if (t) t.textContent = s.benefits[i].title;
      if (d) d.textContent = s.benefits[i].desc;
    });
  }
}

/* ── Navegação ativa por scroll ──────────────────── */
function initNavHighlight() {
  const links = document.querySelectorAll('.main-nav a[href^="#"]');
  if (!links.length) return;
  const map = {};
  links.forEach(a => {
    const id = a.getAttribute('href').slice(1);
    const sec = document.getElementById(id);
    if (sec) map[id] = a;
  });
  const sections = Object.keys(map).map(id => document.getElementById(id));
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(a => a.classList.remove('nav-active'));
      if (map[e.target.id]) map[e.target.id].classList.add('nav-active');
    });
  }, { rootMargin: '-30% 0px -60% 0px' });
  sections.forEach(s => obs.observe(s));
}

/* ── Progressive enhancement — carrega dados do Supabase ── */
function showLojaIndisponivel(title, msg) {
  const store = $('store');
  if (!store) return;
  store.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:40px;font-family:'DM Sans',sans-serif;">
      <h1 style="font-size:28px;margin-bottom:8px;">${title}</h1>
      <p style="color:#64748B;">${msg}</p>
    </div>`;
}
function showLojaNaoEncontrada() {
  showLojaIndisponivel('Loja não encontrada', 'Verifique o endereço da loja e tente novamente.');
}

async function loadFromSupabase() {
  if (!window._sbClient) return;
  const safe = async fn => { try { return await fn(); } catch(e) { return null; } };

  const slug = new URLSearchParams(location.search).get('loja');
  if (!slug) { showLojaNaoEncontrada(); return; }
  const tenant = await safe(() => Tenants.getBySlug(slug));
  if (!tenant) { showLojaNaoEncontrada(); return; }
  window._tenant = tenant;

  const [prods, settings] = await Promise.all([
    safe(() => SBProds.list(tenant.id)),
    safe(() => SBStorefront.getSettings(slug))
  ]);
  if (prods)    { DB.prods = prods.filter(p => p.st > 0); }
  if (settings) Object.assign(DB.settings, settings);

  const isPreview = new URLSearchParams(location.search).has('preview');
  if (DB.settings.published === false && !isPreview) {
    showLojaIndisponivel('Loja indisponível', 'Esta loja está temporariamente fora do ar.');
    return;
  }

  document.title = tenant.nome;

  /* Restaura URL limpa se viemos via 404-routing (GitHub Pages) */
  const _rtSlug = sessionStorage.getItem('_srt_slug');
  const _rtBase = sessionStorage.getItem('_srt_base');
  if (_rtSlug && _rtSlug === slug && _rtBase !== null) {
    sessionStorage.removeItem('_srt_slug');
    sessionStorage.removeItem('_srt_base');
    history.replaceState(null, '', _rtBase + '/' + _rtSlug);
  }

  if ($('site-intro-brand'))   $('site-intro-brand').textContent   = tenant.nome;
  if ($('site-intro-eyebrow')) $('site-intro-eyebrow').textContent = tenant.nome;
  if ($('site-brand-link'))    $('site-brand-link').textContent    = tenant.nome;
  if ($('footer-copyright-text')) {
    const kicker = DB.settings.heroKicker ? ' · ' + DB.settings.heroKicker : '';
    $('footer-copyright-text').textContent = '© ' + new Date().getFullYear() + ' ' + tenant.nome + kicker;
  }

  rStore();
}

/* ── Init ────────────────────────────────────────── */
function rStore() {
  rHeroCards();
  rProds('todos');
  rFeaturedProds();
  initTelao();
  requestAnimationFrame(initScrollReveal);
  initCursor();
  initCounters();
  initNavHighlight();
  initCarouselProgress();
  applySettings();

  const customer = loadCustomerInfo();
  if ($('cc-nome')) $('cc-nome').value = customer.nome || '';
  if ($('cc-tel')) $('cc-tel').value = customer.tel || '';
}

/* Se Supabase disponível: segura o intro como loading screen,
   aguarda os dados do tenant e só então renderiza.
   Modo local (?local) ou offline: renderiza imediatamente com defaults. */
if (window._sbClient && !window._localMode) {
  const intro = document.getElementById('site-intro');
  if (intro) {
    /* Cancela o auto-dismiss do CSS e mantém o intro visível */
    intro.style.animation = 'none';
    intro.style.opacity   = '1';
    intro.style.pointerEvents = 'none';
  }
  loadFromSupabase().finally(() => {
    if (intro) {
      intro.style.transition = 'opacity .55s ease';
      intro.style.opacity    = '0';
      setTimeout(() => intro.remove(), 600);
    }
  });
} else {
  rStore();
}

/* ── Prévia ao vivo (iframe do ERP envia atualizações de tema/conteúdo) ── */
if (new URLSearchParams(location.search).has('preview')) {
  window.addEventListener('message', e => {
    if (e.data?.type !== 'shorti-preview-update') return;
    Object.assign(DB.settings, e.data.settings);
    applySettings();
  });
}
document.addEventListener('DOMContentLoaded', initScrollReveal);

/* ── Card de engajamento ─────────────────────────── */
(function initMkt() {
  let activated = false;

  function activate() {
    if (activated) return;
    activated = true;
    window.removeEventListener('scroll', activate);
    window.removeEventListener('touchstart', activate);
    window.removeEventListener('mousemove', activate);
  }

  window.addEventListener('scroll',     activate, { passive: true, once: true });
  window.addEventListener('touchstart', activate, { passive: true, once: true });
  window.addEventListener('mousemove',  activate, { passive: true, once: true });

  setTimeout(() => {
    if (activated) return;
    window.scrollTo({ top: 380, behavior: 'smooth' });
    setTimeout(() => {
      const card = document.getElementById('mkt-card');
      if (card) card.classList.add('on');
    }, 900);
  }, 6000);
})();

function dismissMkt() {
  const c = document.getElementById('mkt-card');
  if (c) { c.style.animation = 'none'; c.style.opacity = '0'; c.style.transform = 'translateY(12px)'; setTimeout(() => c.classList.remove('on'), 180); }
}

function mktGo() {
  dismissMkt();
  goto('produtos');
}

/* ── Aviso de cookies + Política de Privacidade ──── */
const COOKIE_CONSENT_KEY = 'mlb_cookie_consent';
function acceptCookies() {
  try { localStorage.setItem(COOKIE_CONSENT_KEY, '1'); } catch(e) {}
  const b = $('cookie-banner');
  if (b) b.classList.remove('on');
}
function openPrivacy(e) {
  if (e) e.preventDefault();
  const m = $('privacy-modal');
  if (m) m.classList.add('on');
}
function closePrivacy() {
  const m = $('privacy-modal');
  if (m) m.classList.remove('on');
}
(function initCookieBanner() {
  let consented = false;
  try { consented = localStorage.getItem(COOKIE_CONSENT_KEY) === '1'; } catch(e) {}
  if (consented) return;
  setTimeout(() => {
    const b = $('cookie-banner');
    if (b) b.classList.add('on');
  }, 2600);
})();

function openMobNav() {
  document.getElementById('mob-nav').classList.add('on');
  document.body.style.overflow = 'hidden';
}
function closeMobNav() {
  document.getElementById('mob-nav').classList.remove('on');
  document.body.style.overflow = '';
}
document.getElementById('mob-nav')?.addEventListener('click', e => {
  if (e.target === document.getElementById('mob-nav')) closeMobNav();
});
