/* =====================================================
   app/loja.js — Configurações da loja (store settings)
   ===================================================== */

function rLoja() {
  const s = DB.settings;
  const v = (id, val) => { if ($(id)) $(id).value = val; };
  v('ls-banner',  s.banner.replace(/<[^>]+>/g, ''));
  v('ls-wa',      s.whatsapp);
  v('ls-pix',     s.pix);
  const badge  = $('ls-pix-badge');
  const retest = $('ls-pix-retest');
  if (badge && retest) {
    if (!s.pix) {
      badge.style.display = 'none';
      retest.style.display = 'none';
    } else if (s.pixVerified) {
      badge.className = 'pix-badge pix-badge-ok';
      badge.textContent = '✓ Pix verificado';
      badge.style.display = '';
      retest.style.display = '';
    } else {
      badge.className = 'pix-badge pix-badge-warn';
      badge.textContent = '⚠ Não verificado';
      badge.style.display = '';
      retest.style.display = '';
    }
  }
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

  /* Alterar a chave Pix exige confirmação de senha + teste de R$ 1,00 */
  const newPix = g('ls-pix');
  if (newPix !== s.pix) pixRequestChange(newPix, s.pix);
}
