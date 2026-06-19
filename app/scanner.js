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

const PHONE_SID_KEY  = 'erp_phone_sid';
const DEVICES_LS_KEY = 'erp_paired_devices';
let   _deviceChannels = {}; /* deviceCode → supabase channel */

/* ── Gerenciamento de dispositivos registrados ─────── */
function _getDevices() {
  try { return JSON.parse(localStorage.getItem(DEVICES_LS_KEY)) || []; } catch { return []; }
}
function _saveDevices(list) { localStorage.setItem(DEVICES_LS_KEY, JSON.stringify(list)); }

function toggleAddDevice() {
  const form = $('scn-add-dev-form');
  if (!form) return;
  const open = form.style.display !== 'none';
  form.style.display = open ? 'none' : 'block';
  if (!open) setTimeout(() => $('scn-dev-code-inp')?.focus(), 50);
}

function addDevice() {
  const rawCode = ($('scn-dev-code-inp')?.value || '').replace(/\s/g,'').toUpperCase();
  const name    = ($('scn-dev-name-inp')?.value || '').trim() || 'Meu celular';
  if (rawCode.length < 4) { showToast('Digite o código do celular'); return; }

  const devices = _getDevices();
  if (!devices.find(d => d.code === rawCode)) {
    devices.push({ code: rawCode, name, addedAt: new Date().toISOString() });
    _saveDevices(devices);
  }
  if ($('scn-dev-code-inp')) $('scn-dev-code-inp').value = '';
  if ($('scn-dev-name-inp')) $('scn-dev-name-inp').value = '';
  toggleAddDevice();
  _renderDeviceList();
  _subscribeDeviceChannel(rawCode, name);
  showToast(`${name} adicionado`);
}

function removeDevice(code) {
  _saveDevices(_getDevices().filter(d => d.code !== code));
  if (_deviceChannels[code]) {
    try { _deviceChannels[code].unsubscribe(); } catch(e) {}
    delete _deviceChannels[code];
  }
  _renderDeviceList();
}

function _renderDeviceList() {
  const list = $('scn-device-list');
  const wrap = $('scn-devices-wrap');
  const devices = _getDevices();
  if (wrap) wrap.style.display = 'block';
  if (!list) return;
  if (!devices.length) {
    list.innerHTML = '<p class="scn-no-devices">Nenhum dispositivo — clique em + para adicionar</p>';
    return;
  }
  list.innerHTML = devices.map(d => `
    <div class="scn-device-item">
      <span class="scn-dev-dot" id="ddot-${d.code}"></span>
      <span class="scn-dev-name">📱 ${d.name}</span>
      <button class="scn-dev-remove" onclick="removeDevice('${d.code}')" title="Remover">✕</button>
    </div>
  `).join('');
}

function _setDeviceOnline(code, online) {
  const dot = document.getElementById(`ddot-${code}`);
  if (dot) dot.className = `scn-dev-dot ${online ? 'online' : ''}`;
}

function _subscribeDeviceChannel(code, name) {
  if (_deviceChannels[code] || !window._sbClient || window._sbClient._local) return;
  const ch = window._sbClient.channel(`erp-device-${code}`, {
    config: { broadcast: { self: false } }
  });
  ch.on('broadcast', { event: 'device-ack' },   () => _setDeviceOnline(code, true));
  ch.on('broadcast', { event: 'device-ready' }, () => {
    _setDeviceOnline(code, true);
    /* Celular acabou de abrir — se há sessão ativa, envia o PIN imediatamente */
    if (_phonePanelOpen && _phoneSid && !_phoneConnected) {
      ch.send({ type: 'broadcast', event: 'new-session', payload: { pin: _phoneSid, url: _phoneQrUrl || '' } });
    }
  });
  ch.subscribe(status => {
    if (status === 'SUBSCRIBED') {
      ch.send({ type: 'broadcast', event: 'device-ping', payload: {} });
    }
  });
  _deviceChannels[code] = ch;
}

function _initDeviceChannels() {
  _getDevices().forEach(d => _subscribeDeviceChannel(d.code, d.name));
  _renderDeviceList();
}

async function _broadcastToDevices(pin, url) {
  const devices = _getDevices();
  for (const d of devices) {
    const ch = _deviceChannels[d.code];
    if (!ch) continue;
    try {
      await ch.send({ type: 'broadcast', event: 'new-session', payload: { pin, url } });
    } catch(e) {}
  }
}

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

/* Tenta renderizar QR no bloco secundário — silencioso se falhar */
async function _tryRenderQrSecondary(url) {
  const wrap   = $('scn-qr-secondary');
  const canvas = $('scn-qr-canvas');
  const img    = $('scn-qr-img');

  /* Tenta biblioteca QRCode.js primeiro */
  if (window.QRCode && canvas) {
    try {
      await QRCode.toCanvas(canvas, url, {
        width: 160, margin: 1,
        color: { dark: '#111111', light: '#ffffff' }
      });
      canvas.style.display = 'block';
      if (img) img.style.display = 'none';
      if (wrap) wrap.style.display = 'block';
      return;
    } catch(e) {}
  }

  /* Fallback: imagem via api.qrserver.com */
  if (img) {
    if (canvas) canvas.style.display = 'none';
    img.style.display = 'block';
    img.onload  = () => { if (wrap) wrap.style.display = 'block'; };
    img.onerror = () => { /* silencioso — QR secundário simplesmente não aparece */ };
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=8&data=${encodeURIComponent(url)}`;
  }
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

  _initDeviceChannels();

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
      /* Celular mandando barcode = está conectado, mesmo que phone-connected tenha chegado antes da subscription */
      if (!_phoneConnected) {
        _phoneConnected = true;
        if (_phoneSid) localStorage.setItem(PHONE_SID_KEY, _phoneSid);
      }
      const txt = $('scn-phone-status-txt');
      _phoneSetStatus('received');
      if (txt) txt.textContent = `✓ ${payload.code}`;
      setTimeout(() => _phoneSetStatus('connected', '📱 Celular conectado — pronto para escanear'), 700);
      onScanResult(payload.code);
    });
}

/* Busca a URL do túnel público (serveo.net) — tenta algumas vezes,
   pois o túnel leva alguns segundos para conectar após o servidor subir. */
async function _fetchTunnelUrl(attempts = 3, delayMs = 1200) {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(`${location.protocol}//${location.hostname}:3000/api/tunnel`);
      const j = await r.json();
      if (j.url) return j;
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
  /* PIN de 6 dígitos — fácil de digitar, único o suficiente para uma sessão */
  _phoneSid       = String(Math.floor(100000 + Math.random() * 900000));
  _phoneConnected = false;

  /* Porta 3000 = servidor local (server.js) rodando → tenta pegar URL do túnel.
     Em produção (GitHub Pages, Vercel) a porta é vazia → pula o fetch. */
  const hasLocalServer = location.port === '3000';
  const tunnel  = hasLocalServer ? await _fetchTunnelUrl() : null;
  let baseUrl   = tunnel?.url;
  let viaTunnel = !!baseUrl;

  if (!baseUrl) {
    let host = location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
      host = await _getLocalIP() || host;
    }
    const port = location.port ? `:${location.port}` : '';
    const dir  = location.pathname.replace(/\/[^/]*$/, '');
    baseUrl = `${location.protocol}//${host}${port}${dir}`;
  }

  /* ── Envia sessão para dispositivos registrados (auto-connect) ── */
  const mobileBase = `${baseUrl}/mobile-scan.html`;
  _phoneQrUrl = `${mobileBase}?s=${_phoneSid}`;
  _broadcastToDevices(_phoneSid, _phoneQrUrl);

  /* Retry: reenvia a cada 5s por até 30s, caso o celular ainda esteja abrindo */
  let _retryCount = 0;
  const _retryTimer = setInterval(() => {
    if (_phoneConnected || _retryCount >= 6) { clearInterval(_retryTimer); return; }
    _retryCount++;
    _broadcastToDevices(_phoneSid, _phoneQrUrl);
  }, 5000);

  const pinBlock = $('scn-pin-block');
  if (pinBlock) pinBlock.style.display = 'block';
  const pinDigits = $('scn-pin-digits');
  if (pinDigits) {
    const mkBox = d => `<span class="scn-pin-digit">${d}</span>`;
    pinDigits.innerHTML =
      _phoneSid.slice(0,3).split('').map(mkBox).join('') +
      '<span class="scn-pin-divider"></span>' +
      _phoneSid.slice(3).split('').map(mkBox).join('');
  }

  /* ── Tenta QR como secundário (não bloqueia nem trava se falhar) ── */
  _tryRenderQrSecondary(_phoneQrUrl);

  _setQrNetHint(viaTunnel || !hasLocalServer);
  _phoneSetStatus('waiting', 'Aguardando celular...');

  _phoneChannel = window._sbClient.channel(`erp-scan-${_phoneSid}`, {
    config: { broadcast: { self: false } }
  });
  _bindPhoneEvents(_phoneChannel);
  _phoneChannel
    .on('broadcast', { event: 'pong' }, () => {
      if (!_phoneConnected) {
        _phoneConnected = true;
        if (_phoneSid) localStorage.setItem(PHONE_SID_KEY, _phoneSid);
        _phoneSetStatus('connected', '📱 Celular conectado — pronto para escanear');
      }
    })
    .subscribe(status => {
      /* Assim que conectado, pinga o celular — se ele já estiver na sessão responde com pong */
      if (status === 'SUBSCRIBED') {
        _phoneChannel.send({ type: 'broadcast', event: 'ping', payload: {} });
      }
    });
}

/* Gera um novo QR do zero — útil quando o link anterior não funcionou
   (ex.: túnel ainda conectando, ou IP local não alcançável pelo celular). */
async function refreshPhoneQr() {
  if (_phoneChannel) { try { _phoneChannel.unsubscribe(); } catch(e) {} _phoneChannel = null; }
  _phoneConnected = false;
  _phoneSid = _phoneQrUrl = null;
  localStorage.removeItem(PHONE_SID_KEY);

  const hint = $('scn-qr-net-hint');
  const pinBlock = $('scn-pin-block');
  const qrSec   = $('scn-qr-secondary');
  if (hint)     hint.style.display     = 'none';
  if (pinBlock) pinBlock.style.display = 'none';
  if (qrSec)   qrSec.style.display    = 'none';

  showToast('Gerando novo código...');
  await _startPhonePairing();
}

async function copyMobileScanLink() {
  if (!_phoneQrUrl) { showToast('Gere um código primeiro'); return; }

  const btn = document.getElementById('scn-copy-link-btn');
  const orig = btn?.innerHTML;

  try {
    await navigator.clipboard.writeText(_phoneQrUrl);
    if (btn) {
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Link copiado!';
      btn.style.background = '#16A34A';
      setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; }, 2000);
    }
  } catch(e) {
    /* fallback: share API */
    if (navigator.share) {
      try { await navigator.share({ title: 'ERP Scanner', url: _phoneQrUrl }); } catch(e2) {}
    } else {
      showToast(_phoneQrUrl);
    }
  }
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
