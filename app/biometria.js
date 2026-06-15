/* =====================================================
   app/biometria.js — Desbloqueio por biometria (WebAuthn)

   Gate local de conveniência: usa o autenticador de plataforma
   do dispositivo (Touch ID / Face ID / digital Android / Windows
   Hello) para "destravar" a tela do ERP. A sessão do Supabase já
   persistida no localStorage continua sendo a autenticação real —
   isto só evita ter que digitar a senha de novo neste aparelho.
   ===================================================== */

const BIO_KEY = 'mlb_bio_cred';

function _bioStore() {
  try { return JSON.parse(localStorage.getItem(BIO_KEY) || '{}'); } catch(e) { return {}; }
}
function _bioSave(store) {
  try { localStorage.setItem(BIO_KEY, JSON.stringify(store)); } catch(e) {}
}

function isBioEnrolled(userId) {
  return !!_bioStore()[userId];
}

async function isBioAvailable() {
  if (!window.PublicKeyCredential || !navigator.credentials) return false;
  try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
  catch(e) { return false; }
}

function _b64urlToBuf(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
  const bin = atob(b64 + pad);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

async function bioEnroll(userId, label) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Shorti' },
      user: { id: new TextEncoder().encode(userId), name: label || 'usuário', displayName: label || 'Usuário Shorti' },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
      attestation: 'none'
    }
  });
  if (!cred) throw new Error('Cadastro cancelado.');
  const store = _bioStore();
  store[userId] = { id: cred.id, createdAt: Date.now() };
  _bioSave(store);
}

async function bioVerify(userId) {
  const entry = _bioStore()[userId];
  if (!entry) return false;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: _b64urlToBuf(entry.id), type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000
      }
    });
    return !!assertion;
  } catch(e) {
    return false;
  }
}

function bioRemove(userId) {
  const store = _bioStore();
  delete store[userId];
  _bioSave(store);
}

/* ── Tela de bloqueio (overlay #bio-lock) ── */
function showBioLock() {
  return new Promise(resolve => {
    const overlay = $('bio-lock');
    const alertEl = $('bio-lock-alert');
    const btn     = $('bio-lock-btn');
    if (!overlay || !alertEl || !btn) { resolve(true); return; }
    overlay.style.display = 'flex';

    async function attempt() {
      alertEl.style.display = 'none';
      btn.disabled = true;
      btn.classList.add('ld');
      const ok = await bioVerify(window._userId);
      btn.disabled = false;
      btn.classList.remove('ld');
      if (ok) {
        overlay.style.display = 'none';
        resolve(true);
      } else {
        alertEl.textContent = 'Não foi possível confirmar sua biometria. Tente novamente.';
        alertEl.style.display = 'block';
      }
    }

    btn.onclick = attempt;
    attempt();
  });
}
