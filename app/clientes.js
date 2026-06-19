/* =====================================================
   app/clientes.js — Lista, perfil e CRUD de clientes
   ===================================================== */

/* Paleta de cores para avatar (determinística pelo nome) */
function _cliColor(nm) {
  const palette = ['#2563EB','#7C3AED','#059669','#D97706','#DC2626','#0891B2','#9333EA','#16A34A'];
  let h = 0; for (let i = 0; i < nm.length; i++) h = nm.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

function rClis() {
  const busca = ($('cli-busca')?.value || '').toLowerCase().trim();
  let clis = [...DB.clis];
  if (busca) clis = clis.filter(c =>
    c.nm.toLowerCase().includes(busca) ||
    (c.tel||'').includes(busca) ||
    (c.em||'').toLowerCase().includes(busca)
  );
  clis.sort((a,b) => b.gasto - a.gasto);

  const cardsEl = $('clicards');
  if (!clis.length) {
    $('ctt').innerHTML = `<tr><td colspan="7" style="text-align:center;padding:28px;color:#94A3B8;font-size:13px">${busca ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}</td></tr>`;
    if (cardsEl) cardsEl.innerHTML = `<p class="small-note" style="padding:20px 0;text-align:center;color:var(--tx-s)">${busca ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}</p>`;
    return;
  }

  if (cardsEl) cardsEl.innerHTML = clis.map(c => {
    const ini   = esc(c.nm.trim()[0]?.toUpperCase() || '?');
    const color = _cliColor(c.nm);
    return `<div class="rb-card" style="cursor:pointer" onclick="openCliProfile(${c.id})">
      <div class="rb-card-top">
        <span class="cli-avatar" style="background:${color}">${ini}</span>
        <div class="rb-card-info">
          <div class="rb-card-name">${esc(c.nm)}</div>
          <div class="rb-card-prod">${esc(c.tel || c.em || '—')}</div>
        </div>
        <div class="rb-card-val">${brl(c.gasto)}</div>
      </div>
      <div class="rb-card-bottom">
        <span class="rb-card-due">${c.ci ? `${esc(c.ci)}${c.es ? '/' + esc(c.es) : ''}` : '—'}</span>
        <span class="rb-card-due">Últ. pedido: ${fdt(c.ult)}</span>
      </div>
    </div>`;
  }).join('');

  $('ctt').innerHTML = clis.map(c => {
    const ini   = esc(c.nm.trim()[0]?.toUpperCase() || '?');
    const color = _cliColor(c.nm);
    const tel   = c.tel ? `<a href="tel:${esc(c.tel)}" onclick="event.stopPropagation()" style="color:inherit">${esc(c.tel)}</a>` : '—';
    return `<tr style="cursor:pointer" onclick="openCliProfile(${c.id})">
      <td>
        <div class="cli-row-name">
          <span class="cli-avatar" style="background:${color}">${ini}</span>
          <div>
            <div class="cli-row-nm">${esc(c.nm)}</div>
            ${c.em ? `<div class="cli-row-sub">${esc(c.em)}</div>` : ''}
          </div>
        </div>
      </td>
      <td>${tel}</td>
      <td>${c.ci ? `${esc(c.ci)}${c.es ? '/' + esc(c.es) : ''}` : '—'}</td>
      <td>${esc(c.pe || '—')}</td>
      <td style="font-weight:600">${brl(c.gasto)}</td>
      <td>${fdt(c.ult)}</td>
      <td class="table-actions" onclick="event.stopPropagation()">
        <button class="eb small" onclick="openCliProfile(${c.id})">Ver perfil</button>
        <button class="eb small" onclick="editCli(${c.id})">Editar</button>
      </td>
    </tr>`;
  }).join('');
}

/* ── Modal perfil largo ───────────────────────────── */
let _mcpId = null;

function openCliProfile(id) {
  const c = DB.clis.find(x => x.id === id);
  if (!c) return;
  _mcpId = id;

  const color = _cliColor(c.nm);
  const ini   = c.nm.trim()[0]?.toUpperCase() || '?';
  const av = $('mcp-avatar-big');
  if (av) { av.textContent = ini; av.style.background = color; }

  const hero = $('mcp-hero');
  if (hero) hero.style.background = `linear-gradient(135deg, ${color}12 0%, ${color}06 100%)`;

  if ($('mcp-nm'))       $('mcp-nm').textContent      = c.nm;
  const locStr = [c.ci, c.es].filter(Boolean).join('/');
  if ($('mcp-hero-sub')) $('mcp-hero-sub').textContent = [locStr, c.pe].filter(Boolean).join(' · ') || 'Cliente';

  const mkRow = (svg, val) => `<div class="mcp-info-row">${svg}<span class="mcp-info-val">${val}</span></div>`;
  const phoneIco = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.45 19.79 19.79 0 0 1 1.58 4.81 2 2 0 0 1 3.56 2.63h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.2A16 16 0 0 0 13.8 16.1l.9-.89a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.42 17.5z"/></svg>`;
  const emailIco = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`;
  const locIco   = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
  const bthIco   = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  const infoRows = [
    c.tel ? mkRow(phoneIco, esc(c.tel)) : '',
    c.em  ? mkRow(emailIco, esc(c.em))  : '',
    locStr ? mkRow(locIco, esc(locStr))  : '',
    c.an  ? mkRow(bthIco, fdt(c.an)) : '',
  ].filter(Boolean).join('');
  if ($('mcp-info')) $('mcp-info').innerHTML = infoRows || `<span style="font-size:12px;color:#94A3B8">Sem contato cadastrado</span>`;

  const peds  = DB.peds.filter(p => p.cid === id);
  const tkMed = peds.length ? c.gasto / peds.length : 0;
  if ($('mcp-stats')) $('mcp-stats').innerHTML = `
    <div class="mcp-stat"><div class="mcp-stat-val">${brl(c.gasto)}</div><div class="mcp-stat-lbl">Total gasto</div></div>
    <div class="mcp-stat"><div class="mcp-stat-val">${peds.length}</div><div class="mcp-stat-lbl">Pedidos</div></div>
    <div class="mcp-stat"><div class="mcp-stat-val">${brl(tkMed)}</div><div class="mcp-stat-lbl">Ticket médio</div></div>
    <div class="mcp-stat"><div class="mcp-stat-val">${fdt(c.ult)}</div><div class="mcp-stat-lbl">Último pedido</div></div>`;

  const tags = [c.pe ? { t: c.pe, skin: true } : null, { t: peds.length ? 'Ativa' : 'Sem compras', skin: false }].filter(Boolean);
  if ($('mcp-tags')) $('mcp-tags').innerHTML = tags.map(({ t, skin }) =>
    `<span class="mcp-tag${skin ? ' mcp-tag-skin' : ''}">${t}</span>`
  ).join('');

  const stCl = { Pendente:'xb-gold', Confirmado:'xb-blue', Enviado:'xb-gray', Entregue:'xb-green', Recebido:'xb-green' };
  const histEl = $('mcp-hist-list');
  if (histEl) {
    if (!peds.length) {
      histEl.innerHTML = `<div class="mcp-hist-empty">Nenhuma compra registrada ainda.</div>`;
    } else {
      const sorted = [...peds].sort((a,b) => (b.dt||'').localeCompare(a.dt||''));
      histEl.innerHTML = sorted.map(p => {
        const prodNm = esc(p.itens?.length ? p.itens.map(i => i.nm).join(', ') : (p.prod || '—'));
        const pagCls = p.pag === 'Fiado' ? 'color:#D97706;font-weight:600' : '';
        return `<div class="mcp-hist-row">
          <span class="mcp-hist-date">${fdt(p.dt)}</span>
          <span class="mcp-hist-prod" title="${prodNm}">${prodNm}</span>
          <span class="mcp-hist-val">${brl(p.tot)}</span>
          <span class="mcp-hist-pag" style="${pagCls}">${p.pag||'—'}</span>
          <span class="mcp-hist-st"><span class="xb ${stCl[p.st]||'xb-gray'}">${p.st||'—'}</span></span>
        </div>`;
      }).join('');
    }
  }
  if ($('mcp-hist-count')) $('mcp-hist-count').textContent = peds.length ? `${peds.length} pedido${peds.length !== 1 ? 's' : ''}` : '';

  const fiado = peds.filter(p => p.pag === 'Fiado').reduce((a,b) => a+b.tot, 0);
  if ($('mcp-hist-summary')) $('mcp-hist-summary').innerHTML = fiado > 0
    ? `<span>Total gasto: <strong>${brl(c.gasto)}</strong></span><span class="mcp-hist-fiado">⚠ Fiado em aberto: ${brl(fiado)}</span>`
    : `<span>Total gasto: <strong>${brl(c.gasto)}</strong></span><span>Ticket médio: <strong>${brl(tkMed)}</strong></span>`;

  const editBtn = $('mcp-edit-btn');
  const delBtn  = $('mcp-del-btn');
  const saleBtn = $('mcp-sale-btn');
  if (editBtn) editBtn.onclick = () => { closeMod('mcp'); editCli(id); };
  if (delBtn)  delBtn.onclick  = () => { closeMod('mcp'); delCli(id); };
  if (saleBtn) saleBtn.onclick = () => { closeMod('mcp'); if (window.innerWidth <= 768) mobNav('nvenda'); else epage('nvenda', null); };

  openMod('mcp');
}

function newCli() {
  if ($('nc-id')) $('nc-id').value = '';
  if ($('mc-title')) $('mc-title').textContent = 'Novo Cliente';
  if ($('mc-save-btn')) $('mc-save-btn').textContent = 'Cadastrar cliente';
  ['nc-nm', 'nc-tel', 'nc-em', 'nc-ci', 'nc-es'].forEach(fid => { if ($(fid)) $(fid).value = ''; });
  if ($('nc-an')) $('nc-an').value = '';
  openMod('mc');
}

function editCli(id) {
  const c = DB.clis.find(x => x.id === id);
  if (!c) return;
  if ($('nc-id')) $('nc-id').value = c.id;
  if ($('nc-nm')) $('nc-nm').value = c.nm;
  if ($('nc-tel')) $('nc-tel').value = c.tel || '';
  if ($('nc-em')) $('nc-em').value = c.em || '';
  if ($('nc-ci')) $('nc-ci').value = c.ci || '';
  if ($('nc-es')) $('nc-es').value = c.es || '';
  if ($('nc-an')) $('nc-an').value = c.an || '';
  if ($('nc-pe')) $('nc-pe').value = c.pe || 'Normal';
  if ($('mc-title')) $('mc-title').textContent = 'Editar Cliente';
  if ($('mc-save-btn')) $('mc-save-btn').textContent = 'Salvar alterações';
  openMod('mc');
}

/* Botão "Cadastrar cliente"/"Salvar alterações" fica verde quando o nome está preenchido */
function checkCliReady() {
  setBtnReady('mc-save-btn', !!$('nc-nm')?.value?.trim());
}

async function saveCli() {
  const eid = $('nc-id')?.value;
  const nm  = $('nc-nm').value.trim();
  if (!nm) { showToast('Informe o nome'); return; }
  const fields = {
    nm, tel: $('nc-tel').value, em: $('nc-em').value,
    ci: $('nc-ci').value, es: $('nc-es').value,
    an: $('nc-an').value, pe: $('nc-pe').value
  };
  if (eid) {
    const c = DB.clis.find(x => x.id === parseInt(eid));
    if (c) { Object.assign(c, fields); sbSync(() => SBClis.upsert({ ...c })); }
  } else {
    const c = { id: await nextId('c'), ...fields, gasto: 0, ult: '' };
    DB.clis.push(c);
    sbSync(() => SBClis.upsert(c));
  }
  rClis();
  rNV();
  closeMod('mc');
  showToast(eid ? 'Cliente atualizado' : 'Cliente cadastrado');
}

function delCli(id) {
  const c = DB.clis.find(x => x.id === id);
  if (!c) return;
  askConfirm({ title: 'Excluir cliente?', msg: `<strong>${esc(c.nm)}</strong> será removido permanentemente.`, type: 'danger', btnLabel: 'Excluir' }, () => {
    DB.clis = DB.clis.filter(x => x.id !== id);
    rClis(); rNV();
    showToast('Cliente excluído');
    sbSync(() => SBClis.delete(id));
  });
}
