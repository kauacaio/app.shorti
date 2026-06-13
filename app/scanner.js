/* =====================================================
   app/scanner.js — Scanner de código de barras (câmera)
   e scanner por celular via Supabase Realtime
   ===================================================== */

let _scanner    = null;
let _scanMode   = 'estoque';
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

  if (typeof Html5Qrcode === 'undefined') {
    _showScanError('Biblioteca de scanner não carregada. Use o campo abaixo.');
    return;
  }

  const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!isSecure) {
    _showScanError(`Câmera requer HTTPS.\nAcesse via: https://${location.hostname}:3443`);
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    _showScanError('Seu navegador não suporta câmera. Use o campo manual abaixo.');
    return;
  }

  const cfg = {
    fps: 15,
    experimentalFeatures: { useBarCodeDetectorIfSupported: true },
  };

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

    let started = false;
    for (const facing of ['environment', 'user']) {
      try {
        await _scanner.start({ facingMode: facing }, cfg, code => onScanResult(code), () => {});
        started = true;
        break;
      } catch(e) {}
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

function _showScanError(msg) {
  const na = $('scan-notfound-area');
  const si = $('scan-manual-input');
  if (na) { na.style.display = 'flex'; $('scan-notfound-text').textContent = msg; }
  if (_scanner) { try { _scanner.stop(); } catch(e){} _scanner = null; }
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

  const flash = $('scn-flash');
  if (flash) { flash.classList.remove('show'); void flash.offsetWidth; flash.classList.add('show'); }

  const clean = code.replace(/\D/g, '');

  if (_scanMode === 'field') {
    closeScanner();
    if ($('pe-bc')) { $('pe-bc').value = clean; $('pe-bc').focus(); }
    showToast('Código lido: ' + clean);
    return;
  }

  if (_scanMode === 'new-prod') {
    closeScanner();
    const existing = DB.prods.find(p => p.bc && p.bc.replace(/\D/g,'') === clean);
    if (existing) {
      showExistingProductModal(existing);
    } else {
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

  const prod = DB.prods.find(p => p.bc && p.bc.replace(/\D/g,'') === clean);

  const scannerOpen = $('mscanner')?.classList.contains('on');
  if (!scannerOpen) {
    _scanCooldown = false;
    if (!prod) {
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

  const ra = $('scan-result-area'), na = $('scan-notfound-area');
  if (!prod) {
    if (na) { na.style.display = 'flex'; $('scan-notfound-text').textContent = `Não encontrado: ${clean}`; }
    if (ra) ra.style.display = 'none';
    setTimeout(() => { _scanCooldown = false; if (na) na.style.display = 'none'; }, 2000);
    return;
  }

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
      const vp = $('vp');
      if (vp) { vp.value = prod.id; vUpd(); nvAddItem(); }
      showToast(`✓ ${prod.nm} adicionado`);
      setTimeout(() => {
        const fc2 = $('scn-found-card'); if (fc2) fc2.style.display = 'none';
        _scanCooldown = false;
      }, 1400);
    } else {
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

function openScannerForField() { openScanner('field'); }
function openScannerForNewProd() { openScanner('new-prod'); }

/* ── Scanner por celular — sessão persistente ────────── */
let _phoneChannel   = null;
let _phonePanelOpen = false;
let _phoneConnected = false;
let _phoneSid       = null;
let _phoneQrUrl     = null;

const PHONE_SID_KEY = 'erp_phone_sid';

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

  if (img) {
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(url)}`;
    img.style.display = 'block';
    if (canvas) canvas.style.display = 'none';
  }

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

  if (_phoneChannel && _phoneSid) {
    await _renderQR(_phoneQrUrl);
    _phoneSetStatus(_phoneConnected ? 'connected' : 'waiting',
      _phoneConnected ? '📱 Celular conectado — pronto para escanear' : 'Aguardando celular...');
    return;
  }

  /* Já existe um celular pareado de uma sessão anterior?
     Tenta reaproveitar o aparelho em vez de pedir para escanear o QR de novo. */
  const savedSid = localStorage.getItem(PHONE_SID_KEY);
  if (savedSid) {
    _showPhoneReconnecting(true);
    const reconnected = await _attemptPhoneReconnect(savedSid);
    _showPhoneReconnecting(false);
    if (reconnected) { showToast('📱 Celular já pareado conectado automaticamente'); return; }
    localStorage.removeItem(PHONE_SID_KEY);
  }

  await _startPhonePairing();
}

/* Tenta reconectar a um celular já pareado (mesma sessão), pingando o canal.
   Resolve true se o celular responder a tempo, false caso contrário. */
function _attemptPhoneReconnect(sid) {
  return new Promise(resolve => {
    let settled = false;
    const ch = window._sbClient.channel(`erp-scan-${sid}`, { config: { broadcast: { self: false } } });

    const finish = ok => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (!ok) { try { ch.unsubscribe(); } catch(e) {} resolve(false); return; }
      _phoneChannel   = ch;
      _phoneSid       = sid;
      _phoneConnected = true;
      localStorage.setItem(PHONE_SID_KEY, sid);
      _phoneSetStatus('connected', '📱 Celular conectado — pronto para escanear');
      resolve(true);
    };

    const timer = setTimeout(() => finish(false), 2600);

    /* Todos os listeners precisam ser registrados antes do subscribe */
    _bindPhoneEvents(ch);
    ch.on('broadcast', { event: 'pong' },            () => finish(true))
      .on('broadcast', { event: 'phone-connected' }, () => finish(true))
      .subscribe(status => {
        if (status === 'SUBSCRIBED') ch.send({ type: 'broadcast', event: 'ping', payload: {} });
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') finish(false);
      });
  });
}

function _showPhoneReconnecting(show) {
  const panel = $('scn-phone-panel');
  if (panel) panel.classList.toggle('reconnecting', show);
}

function _bindPhoneEvents(ch) {
  ch.on('broadcast', { event: 'phone-connected' }, () => {
      _phoneConnected = true;
      if (_phoneSid) localStorage.setItem(PHONE_SID_KEY, _phoneSid);
      _phoneSetStatus('connected', '📱 Celular conectado — pronto para escanear');
    })
    .on('broadcast', { event: 'barcode' }, ({ payload }) => {
      if (!payload?.code) return;
      const txt = $('scn-phone-status-txt');
      _phoneSetStatus('received');
      if (txt) txt.textContent = `✓ ${payload.code}`;
      setTimeout(() => { if (_phoneConnected) _phoneSetStatus('connected'); }, 700);
      onScanResult(payload.code);
    });
}

/* Busca a URL do túnel público (serveo.net) — tenta algumas vezes,
   pois o túnel leva alguns segundos para conectar após o servidor subir. */
async function _fetchTunnelUrl(attempts = 3, delayMs = 1200) {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch('http://localhost:3001/api/tunnel');
      const j = await r.json();
      if (j.url) return j.url;
    } catch(e) {}
    if (i < attempts - 1) await new Promise(res => setTimeout(res, delayMs));
  }
  return null;
}

function _setQrNetHint(viaTunnel) {
  const el = $('scn-qr-net-hint');
  if (!el) return;
  if (viaTunnel) {
    el.className = 'scn-qr-net-hint tunnel';
    el.textContent = '🌐 Funciona em qualquer rede (Wi-Fi ou dados móveis)';
  } else {
    el.className = 'scn-qr-net-hint lan';
    el.textContent = '📶 Funciona apenas se o celular estiver na mesma rede Wi-Fi do computador';
  }
  el.style.display = 'block';
}

async function _startPhonePairing() {
  _phoneSid       = [...Array(14)].map(() => Math.random().toString(36)[2]).join('');
  _phoneConnected = false;

  let baseUrl   = await _fetchTunnelUrl();
  let viaTunnel = !!baseUrl;

  if (!baseUrl) {
    /* Sem túnel: usar o endereço que o PC está usando AGORA para acessar o
       ERP — é garantidamente alcançável (foi por ele que a página carregou).
       Só tenta adivinhar o IP da rede via WebRTC quando o acesso é por
       localhost/127.0.0.1 (nesse caso location.hostname não serviria
       para o celular alcançar o PC). A adivinhação por WebRTC pode pegar
       um IP de VPN/Docker/adaptador virtual e causar "conexão recusada". */
    let host = location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
      host = await _getLocalIP() || host;
    }
    baseUrl = `${location.protocol}//${host}:${location.port}`;
  }
  _phoneQrUrl = `${baseUrl}/mobile-scan.html?s=${_phoneSid}`;
  await _renderQR(_phoneQrUrl);
  _setQrNetHint(viaTunnel);
  _phoneSetStatus('waiting', 'Aguardando celular...');

  _phoneChannel = window._sbClient.channel(`erp-scan-${_phoneSid}`, {
    config: { broadcast: { self: false } }
  });
  _bindPhoneEvents(_phoneChannel);
  _phoneChannel.subscribe();
}

/* Gera um novo QR do zero — útil quando o link anterior não funcionou
   (ex.: túnel ainda conectando, ou IP local não alcançável pelo celular). */
async function refreshPhoneQr() {
  if (_phoneChannel) { try { _phoneChannel.unsubscribe(); } catch(e) {} _phoneChannel = null; }
  _phoneConnected = false;
  _phoneSid = _phoneQrUrl = null;
  localStorage.removeItem(PHONE_SID_KEY);

  const hint = $('scn-qr-net-hint');
  if (hint) hint.style.display = 'none';

  showToast('Gerando novo QR code...');
  await _startPhonePairing();
}

function _hidePhonePanel() {
  _phonePanelOpen = false;
  const cam   = document.querySelector('.scn-camera-wrap');
  const panel = $('scn-phone-panel');
  const btn   = $('scn-phone-toggle');
  if (panel) { panel.style.display = 'none'; panel.classList.remove('reconnecting'); }
  if (cam)   cam.style.display   = '';
  if (btn)   { btn.classList.remove('active'); btn.classList.toggle('phone-live', _phoneConnected); }
}

function disconnectPhone() {
  if (_phoneChannel) { try { _phoneChannel.unsubscribe(); } catch(e) {} _phoneChannel = null; }
  _phonePanelOpen = _phoneConnected = false;
  _phoneSid = _phoneQrUrl = null;
  localStorage.removeItem(PHONE_SID_KEY);
  const btn = $('scn-phone-toggle');
  if (btn) btn.classList.remove('active', 'phone-live');
  const cam = document.querySelector('.scn-camera-wrap');
  const panel = $('scn-phone-panel');
  if (panel) { panel.style.display = 'none'; panel.classList.remove('reconnecting'); }
  if (cam)   cam.style.display   = '';
  showToast('Celular desconectado');
}

function closePhoneScanner() { if (_phonePanelOpen) _hidePhonePanel(); }

function scanManualInput(val) {
  const clean = val.replace(/\D/g,'');
  const inp   = $('scan-manual-input');
  if (inp && clean !== val) inp.value = clean;
  if (clean.length >= 13) scanManualSubmit();
}
function scanManualSubmit() {
  const val = ($('scan-manual-input')?.value || '').replace(/\D/g,'');
  if (!val) return;
  onScanResult(val);
  if ($('scan-manual-input')) $('scan-manual-input').value = '';
}
