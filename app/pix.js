/* =====================================================
   app/pix.js — QR Code Pix (BR Code / EMV) e cópia
   ===================================================== */

function _pixTLV(id, value) {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

function _pixCRC16(payload) {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/* Monta o payload "Pix Copia e Cola" (BR Code / EMV) */
function buildPixPayload(key, amount, txid) {
  const k = (key || '').trim();
  if (!k) return '';
  const name = 'MILENA LIMA BEAUTY'.slice(0, 25);
  const city = 'SAO PAULO'.slice(0, 15);
  const id = (txid || '***').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 25) || '***';

  const gui = _pixTLV('00', 'BR.GOV.BCB.PIX') + _pixTLV('01', k);
  let payload =
    _pixTLV('00', '01') +
    _pixTLV('26', gui) +
    _pixTLV('52', '0000') +
    _pixTLV('53', '986') +
    (amount > 0 ? _pixTLV('54', amount.toFixed(2)) : '') +
    _pixTLV('58', 'BR') +
    _pixTLV('59', name) +
    _pixTLV('60', city) +
    _pixTLV('62', _pixTLV('05', id));

  payload += '6304';
  payload += _pixCRC16(payload);
  return payload;
}

/* Renderiza o QR (canvas se a lib estiver disponível, senão imagem via API) */
async function renderPixQR(canvasEl, imgEl, payload) {
  if (!payload) return;
  if (window.QRCode && canvasEl) {
    try {
      await QRCode.toCanvas(canvasEl, payload, { width: 150, margin: 1, color: { dark: '#111', light: '#fff' } });
      canvasEl.style.display = 'block';
      if (imgEl) imgEl.style.display = 'none';
      return;
    } catch (e) {}
  }
  if (imgEl) {
    imgEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=8&data=${encodeURIComponent(payload)}`;
    imgEl.style.display = 'block';
    if (canvasEl) canvasEl.style.display = 'none';
  }
}

/* =====================================================
   Segurança: alteração e verificação da chave Pix
   ===================================================== */
let _mpixNewValue = '';
let _mpixOldValue = '';
let _mpixPayload  = '';

/* Persiste DB.settings (local + Supabase) */
function _pixPersistSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(DB.settings)); } catch(e) {}
  sbSync(() => SBSettings.set(DB.settings, window._tenant?.id));
}

/* Abre o fluxo de confirmação ao alterar a chave Pix (riscos + senha) */
function pixRequestChange(newValue, oldValue) {
  _mpixNewValue = newValue;
  _mpixOldValue = oldValue;
  $('mpix-step1').style.display = '';
  $('mpix-step2').style.display = 'none';
  $('mpix-actions-1').style.display = '';
  $('mpix-actions-2').style.display = 'none';
  $('mpix-err').style.display = 'none';
  $('mpix-pass').value = '';
  $('mpix-email').value = '';
  const okBtn = $('mpix-actions-1')?.querySelector('.btn-primary');
  if (okBtn) { okBtn.disabled = false; okBtn.textContent = 'Confirmar e gerar teste'; }
  if (typeof SBAuth !== 'undefined' && SBAuth.getSession) {
    SBAuth.getSession().then(sess => {
      const email = sess?.user?.email;
      if (email) $('mpix-email').value = email;
    }).catch(() => {});
  }
  openMod('mpix');
}

/* Refazer o teste de R$ 1,00 para a chave já salva */
function pixRetest() {
  if (!DB.settings.pix) return;
  pixRequestChange(DB.settings.pix, DB.settings.pix);
}

/* Cancela a troca da chave Pix, restaura o valor anterior no campo */
function pixCancelChange() {
  if ($('ls-pix')) $('ls-pix').value = _mpixOldValue;
  closeMod('mpix');
}

/* Etapa 1: confirma a senha do usuário e avança para o teste de R$ 1,00 */
async function pixConfirmStep1() {
  const email = $('mpix-email')?.value?.trim();
  const pass  = $('mpix-pass')?.value || '';
  const errEl = $('mpix-err');
  if (!email || !pass) {
    if (errEl) { errEl.textContent = 'Informe e-mail e senha para confirmar.'; errEl.style.display = ''; }
    return;
  }
  const okBtn = $('mpix-actions-1')?.querySelector('.btn-primary');
  if (okBtn) { okBtn.disabled = true; okBtn.textContent = 'Verificando...'; }
  try {
    await SBAuth.signIn(email, pass);
  } catch (e) {
    if (errEl) { errEl.textContent = 'E-mail ou senha incorretos. Tente novamente.'; errEl.style.display = ''; }
    if (okBtn) { okBtn.disabled = false; okBtn.textContent = 'Confirmar e gerar teste'; }
    return;
  }
  if (errEl) errEl.style.display = 'none';

  /* Salva a nova chave (ainda não verificada) e mostra o QR de teste */
  DB.settings.pix = _mpixNewValue;
  DB.settings.pixVerified = false;
  _pixPersistSettings();
  if (typeof rLoja === 'function') rLoja();

  _mpixPayload = buildPixPayload(_mpixNewValue, 1.00, 'TESTEPIX');
  if ($('mpix-key')) $('mpix-key').textContent = `Chave: ${_mpixNewValue}`;
  $('mpix-step1').style.display = 'none';
  $('mpix-step2').style.display = '';
  $('mpix-actions-1').style.display = 'none';
  $('mpix-actions-2').style.display = '';
  renderPixQR($('mpix-qr'), $('mpix-img'), _mpixPayload);
}

/* Etapa 2: resultado do teste de R$ 1,00 */
function pixTestResult(ok) {
  DB.settings.pixVerified = ok;
  _pixPersistSettings();
  if (typeof rLoja === 'function') rLoja();
  closeMod('mpix');
  showToast(ok
    ? 'Chave Pix verificada com sucesso! ✓'
    : 'Chave Pix salva, mas não verificada. Revise antes de divulgar aos clientes.');
}

/* Copia o código Pix "copia e cola" para a área de transferência */
function copyPixCode(payload, btn) {
  if (!payload) return;
  const done = () => {
    if (btn) {
      const old = btn.textContent;
      btn.textContent = '✓ Código copiado!';
      setTimeout(() => { btn.textContent = old; }, 1600);
    }
    showToast('Código Pix copiado!');
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(payload).then(done).catch(() => showToast('Não foi possível copiar o código'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = payload; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { showToast('Não foi possível copiar o código'); }
    document.body.removeChild(ta);
  }
}
