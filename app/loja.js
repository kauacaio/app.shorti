/* =====================================================
   app/loja.js — Configurações da loja (store settings)
   ===================================================== */

function rLoja() {
  const s = DB.settings;
  const v = (id, val) => { if ($(id)) $(id).value = val; };
  v('ls-banner',  s.banner.replace(/<[^>]+>/g, ''));
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

  /* Aparência */
  const theme = s.theme || {};
  v('ls-color-primary', theme.primary || '#3D6655');
  v('ls-color-accent',  theme.accent  || '#C4897A');
  v('ls-font',          theme.font    || 'elegante');
  setLojaTemplate(theme.template || 'classico');

  /* Publicação */
  updatePubBadge(s.published !== false);

  /* Segurança do dispositivo (biometria) */
  rBioSecurity();

  /* Prévia ao vivo — só configura o iframe uma vez */
  const frame = $('loja-preview');
  if (frame && !frame.dataset.loaded) {
    frame.dataset.loaded = '1';
    const qs = window._localMode ? 'local&preview=1' : `loja=${encodeURIComponent(window._tenant?.slug || '')}&preview=1`;
    frame.addEventListener('load', sendPreviewUpdate);
    frame.src = 'index.html?' + qs;
  }
}

/* ── Abas da página "Configurar Loja" ─────────────── */
function lojaTab(name, btn) {
  document.querySelectorAll('.loja-tab-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.loja-tab-btn').forEach(b => b.classList.remove('on'));
  $('loja-tab-' + name).style.display = '';
  btn.classList.add('on');
  if (name === 'aparencia') sendPreviewUpdate();
}

/* ── Modelo da loja ────────────────────────────────── */
function setLojaTemplate(t) {
  if ($('ls-template')) $('ls-template').value = t;
  document.querySelectorAll('.tpl-card').forEach(c => c.classList.toggle('on', c.dataset.template === t));
}
function selectLojaTemplate(t, btn) {
  setLojaTemplate(t);
  sendPreviewUpdate();
}

/* ── Publicação ────────────────────────────────────── */
function updatePubBadge(published) {
  const badge = $('ls-pub-badge');
  const toggle = $('ls-pub-toggle');
  if (!badge || !toggle) return;
  if (published) {
    badge.className = 'pub-badge pub-badge-on';
    badge.textContent = '● Publicada';
    toggle.textContent = 'Despublicar loja';
  } else {
    badge.className = 'pub-badge pub-badge-off';
    badge.textContent = '● Despublicada';
    toggle.textContent = 'Publicar loja';
  }
}
function toggleLojaPublicada() {
  DB.settings.published = DB.settings.published === false;
  updatePubBadge(DB.settings.published !== false);
  sendPreviewUpdate();
}

/* ── Segurança do dispositivo (biometria) ─────────── */
async function rBioSecurity() {
  const card  = $('bio-security-card');
  const badge = $('bio-badge');
  const btn   = $('bio-toggle');
  const hint  = $('bio-hint');
  if (!card || !badge || !btn) return;

  const userId = window._userId;
  if (!userId) {
    card.style.display = 'none';
    return;
  }

  card.style.display = '';

  if (typeof isBioAvailable !== 'function' || !(await isBioAvailable())) {
    badge.className = 'pub-badge pub-badge-off';
    badge.textContent = '● Não disponível';
    btn.textContent = 'Indisponível neste dispositivo';
    btn.disabled = true;
    if (hint) hint.textContent = 'Seu navegador ou dispositivo não tem biometria configurada (digital, Face ID ou Windows Hello), ou o acesso não está em uma conexão segura (HTTPS).';
    return;
  }

  btn.disabled = false;
  if (hint) hint.textContent = 'Use a biometria (digital, Face ID, Windows Hello) para destravar o Shorti mais rápido neste aparelho, sem digitar a senha.';
  if (isBioEnrolled(userId)) {
    badge.className = 'pub-badge pub-badge-on';
    badge.textContent = '● Ativada';
    btn.textContent = 'Remover desbloqueio por biometria';
  } else {
    badge.className = 'pub-badge pub-badge-off';
    badge.textContent = '● Desativada';
    btn.textContent = 'Ativar desbloqueio por biometria';
  }
}

async function toggleBioLock() {
  const userId = window._userId;
  if (!userId) return;
  const btn = $('bio-toggle');

  if (isBioEnrolled(userId)) {
    bioRemove(userId);
    showToast('Desbloqueio por biometria removido deste dispositivo');
  } else {
    btn.disabled = true;
    try {
      await bioEnroll(userId, window._tenant?.nome);
      showToast('Biometria ativada neste dispositivo');
    } catch(e) {
      showToast('Não foi possível ativar: ' + (e.message || 'tente novamente'));
    } finally {
      btn.disabled = false;
    }
  }
  rBioSecurity();
}

/* ── Prévia ao vivo — envia o estado atual pro iframe ── */
let _previewTimer = null;
function sendPreviewUpdate() {
  clearTimeout(_previewTimer);
  _previewTimer = setTimeout(() => {
    const frame = $('loja-preview');
    if (!frame || !frame.contentWindow) return;
    const s = DB.settings;
    const settings = {
      ...s,
      theme: {
        template: $('ls-template')?.value || 'classico',
        primary:  $('ls-color-primary')?.value || s.theme.primary,
        accent:   $('ls-color-accent')?.value  || s.theme.accent,
        font:     $('ls-font')?.value || 'elegante'
      }
    };
    frame.contentWindow.postMessage({ type: 'shorti-preview-update', settings }, '*');
  }, 150);
}

function saveLojaSettings() {
  const g = id => $(id)?.value?.trim() || '';
  const s = DB.settings;
  const raw = g('ls-banner');
  s.banner    = raw.includes('<em>') ? raw : raw.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s.heroKicker= g('ls-kicker');
  s.heroLines = [g('ls-hl1'), g('ls-hl2'), g('ls-hl3'), g('ls-hl4')];
  s.heroSub   = g('ls-sub');
  s.heroProof = g('ls-proof');
  s.marquee   = g('ls-marquee');
  s.benefits  = s.benefits.map((_, i) => ({ title: g('ls-bt' + i), desc: g('ls-bd' + i) }));
  s.theme = {
    template: $('ls-template')?.value || 'classico',
    primary:  $('ls-color-primary')?.value || s.theme.primary,
    accent:   $('ls-color-accent')?.value  || s.theme.accent,
    font:     $('ls-font')?.value || 'elegante'
  };
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch(e) {}
  sbSync(() => SBSettings.set(s, window._tenant?.id));
  showToast('Configurações salvas — atualize a loja para ver');
}

