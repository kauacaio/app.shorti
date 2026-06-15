/**
 * server.js — Servidor duplo para o ERP
 *
 * Porta 3000 → HTTPS (certificado autoassinado, para acesso do PC)
 * Porta 3001 → HTTP  (para o localtunnel, que entrega HTTPS válido para o celular)
 *
 * Uso: node server.js
 */

const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const url    = require('url');
const crypto = require('crypto');
const { spawn } = require('child_process');

/* Token gerado a cada execução — exigido (?key=... ou cookie) para
   qualquer requisição que chegue pelo túnel público (porta 3001).
   Sem ele, quem tiver a URL do serveo.net não consegue carregar nada. */
const TUNNEL_TOKEN = crypto.randomBytes(24).toString('hex');

/* ── MIME types ──────────────────────────────────── */
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.pem':  'text/plain',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
};

let _tunnelUrl = null; // preenchido quando o túnel SSH conectar

/* Lê o cookie "tt" (token do túnel) de uma requisição. */
function _getCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

/* ── Handler de requisições ─────────────────────────────────────────
   opts.tunnel = true  → porta 3001, exposta via serveo.net à internet.
   opts.tunnel = false → porta 3000, só acessível na rede local (PC). */
function handler(req, res, opts = {}) {
  const parsed = url.parse(req.url, true);
  let pathname = parsed.pathname;

  if (opts.tunnel) {
    /* Exige ?key=<token> (ou cookie já validado) para qualquer recurso
       servido pelo túnel público. Sem o token correto, ninguém que só
       tenha a URL do serveo.net consegue acessar o app. */
    const key = parsed.query.key || _getCookie(req, 'tt');
    if (key !== TUNNEL_TOKEN) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Acesso negado: link de teste inválido ou expirado.');
      return;
    }
    if (parsed.query.key) {
      res.setHeader('Set-Cookie', `tt=${TUNNEL_TOKEN}; Path=/; SameSite=Lax; Max-Age=43200`);
    }
  }

  /* Endpoint: retorna URL do túnel (e, só na rede local, o token de acesso) */
  if (pathname === '/api/tunnel') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ url: _tunnelUrl, key: opts.tunnel ? undefined : TUNNEL_TOKEN }));
    return;
  }

  /* Arquivos estáticos */
  if (pathname === '/' || pathname === '') pathname = '/index.html';

  /* Bloqueia acesso direto aos certificados */
  if (pathname.endsWith('.pem') || pathname.endsWith('.key')) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  const filePath = path.join(__dirname, pathname);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found: ' + pathname);
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

/* ── Servidor HTTPS — porta 3000 (PC, rede local) ── */
const tlsOpts = {
  key:  fs.readFileSync(path.join(__dirname, 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'cert.pem')),
};
https.createServer(tlsOpts, (req, res) => handler(req, res, { tunnel: false })).listen(3000, '0.0.0.0', () => {
  console.log('✅ HTTPS  → https://192.168.3.48:3000/erp.html');
});

/* ── Servidor HTTP — porta 3001 (exposta via túnel SSH) ── */
http.createServer((req, res) => handler(req, res, { tunnel: true })).listen(3001, '127.0.0.1', () => {
  console.log('🔁 HTTP   → http://localhost:3001  (para o túnel SSH)');
  console.log('🔑 Token do túnel: ' + TUNNEL_TOKEN);
  console.log('   (gerado automaticamente; sem ele, o link público não abre nada)');
  startTunnel();
});

/* ── Túnel SSH via serveo.net (HTTPS válido, sem senha) ── */
function startTunnel() {
  console.log('🌐 Iniciando túnel SSH (serveo.net)...');

  const tun = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=30',
    '-o', 'ExitOnForwardFailure=yes',
    '-R', '80:localhost:3001',
    'serveo.net'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  let buf = '';
  tun.stdout.on('data', (data) => {
    buf += data.toString();
    console.log('[tunnel]', data.toString().trim());

    const match = buf.match(/https?:\/\/[^\s]+serveousercontent\.com/i);
    if (match && !_tunnelUrl) {
      _tunnelUrl = match[0].replace(/^http:/, 'https:');
      console.log('');
      console.log('📱 QR code URL (celular):');
      console.log('   ' + _tunnelUrl + '/mobile-scan.html?key=' + TUNNEL_TOKEN);
      console.log('');
    }
  });

  tun.stderr.on('data', (d) => {
    const line = d.toString().trim();
    console.log('[tunnel]', line);
    const match = line.match(/https?:\/\/[^\s]+serveousercontent\.com/i);
    if (match && !_tunnelUrl) {
      _tunnelUrl = match[0].replace(/^http:/, 'https:');
      console.log('');
      console.log('📱 QR code URL (celular):');
      console.log('   ' + _tunnelUrl + '/mobile-scan.html?key=' + TUNNEL_TOKEN);
      console.log('');
    }
  });

  tun.on('close', (code) => {
    console.warn(`[tunnel] encerrado (${code}) — reiniciando em 8s...`);
    _tunnelUrl = null;
    setTimeout(startTunnel, 8000);
  });
}
