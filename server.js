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
const { spawn } = require('child_process');

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

let _tunnelUrl  = null;  // preenchido quando localtunnel conectar
let _externalIp = null;  // IP público da máquina (senha do localtunnel)

/* ── Handler de requisições (compartilhado entre HTTP e HTTPS) ── */
function handler(req, res) {
  /* CORS para o localtunnel funcionar */
  res.setHeader('Access-Control-Allow-Origin', '*');

  const parsed = url.parse(req.url);
  let pathname = parsed.pathname;

  /* Endpoint: retorna URL do túnel + IP externo (senha do localtunnel) */
  if (pathname === '/api/tunnel') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ url: _tunnelUrl, password: _externalIp }));
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

/* ── Servidor HTTPS — porta 3000 (PC) ── */
const tlsOpts = {
  key:  fs.readFileSync(path.join(__dirname, 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'cert.pem')),
};
https.createServer(tlsOpts, handler).listen(3000, '0.0.0.0', () => {
  console.log('✅ HTTPS  → https://192.168.3.48:3000/erp.html');
});

/* ── Servidor HTTP — porta 3001 (localtunnel) ── */
http.createServer(handler).listen(3001, '127.0.0.1', () => {
  console.log('🔁 HTTP   → http://localhost:3001  (para localtunnel)');
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
      console.log('   ' + _tunnelUrl + '/mobile-scan.html');
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
      console.log('   ' + _tunnelUrl + '/mobile-scan.html');
      console.log('');
    }
  });

  tun.on('close', (code) => {
    console.warn(`[tunnel] encerrado (${code}) — reiniciando em 8s...`);
    _tunnelUrl = null;
    setTimeout(startTunnel, 8000);
  });
}
