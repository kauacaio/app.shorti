/* =====================================================
   app/pedidos.js — A Receber, Histórico de Vendas,
   edição de pedido, updPS
   ===================================================== */

/* ── A Receber (vendas fiado) ────────────────────── */
function rReceber() {
  const el = $('rbtt');
  const cardsEl = $('rbcards');
  if (!el && !cardsEl) return;
  const fiado = DB.peds.filter(p => p.pag === 'Fiado');
  const total   = fiado.reduce((a, b) => a + b.tot, 0);
  const vencido = fiado.filter(p => p.dtpag && p.dtpag < td()).reduce((a, b) => a + b.tot, 0);
  if ($('r-total'))   $('r-total').textContent   = brl(total);
  if ($('r-vencido')) $('r-vencido').textContent = brl(vencido);
  if ($('r-qtd'))     $('r-qtd').textContent     = fiado.length;
  if (!fiado.length) {
    if (el)      el.innerHTML      = '<tr><td colspan="7" style="text-align:center;padding:28px;color:#71717A;font-size:13px">✓ Nenhum valor pendente no momento</td></tr>';
    if (cardsEl) cardsEl.innerHTML = '<p class="small-note" style="padding:20px 0;text-align:center;color:var(--tx-s)">✓ Nenhum valor pendente no momento</p>';
    return;
  }
  const avatarColors = ['--blue-bg,--blue','--violet-bg,--violet','--green-bg,--green','--orange-bg,--orange'];
  if (el) el.innerHTML = fiado.map(p => {
    const c = DB.clis.find(x => x.id === p.cid);
    const venc = p.dtpag && p.dtpag < td();
    return `<tr>
      <td>#${p.id}</td>
      <td>${c ? esc(c.nm) : '—'}</td>
      <td>${c ? esc(c.tel) : '—'}</td>
      <td>${esc(p.prod)} ×${p.q}</td>
      <td>${brl(p.tot)}</td>
      <td ${venc ? 'style="color:#DC2626;font-weight:600"' : ''}>${p.dtpag ? fdt(p.dtpag) : fdt(p.dt)}${venc ? ' ⚠' : ''}</td>
      <td class="table-actions"><button class="eb small" style="background:#18181B;color:#fff;border-color:#18181B" onclick="receberPed(${p.id})">✓ Receber</button></td>
    </tr>`;
  }).join('');
  if (cardsEl) cardsEl.innerHTML = fiado.map((p, idx) => {
    const c   = DB.clis.find(x => x.id === p.cid);
    const nm  = c ? c.nm : '—';
    const ini = esc(nm.split(' ').filter(Boolean).map(w => w[0]).slice(0,2).join('').toUpperCase() || '?');
    const venc = p.dtpag && p.dtpag < td();
    const [bg, fg] = avatarColors[idx % avatarColors.length].split(',');
    return `<div class="rb-card">
      <div class="rb-card-top">
        <div class="order-avatar" style="background:var(${bg});color:var(${fg})">${ini}</div>
        <div class="rb-card-info">
          <div class="rb-card-name">${esc(nm)}</div>
          <div class="rb-card-prod">${esc(p.prod)} ×${p.q}</div>
        </div>
        <div class="rb-card-val">${brl(p.tot)}</div>
      </div>
      <div class="rb-card-bottom">
        <span class="rb-card-due ${venc ? 'rb-due-late' : ''}">${venc ? '⚠ venceu ' : 'vence '}${p.dtpag ? fdt(p.dtpag) : fdt(p.dt)}</span>
        <button class="eb small" style="background:#18181B;color:#fff;border-color:#18181B" onclick="receberPed(${p.id})">✓ Receber</button>
      </div>
    </div>`;
  }).join('');
}

function receberPed(id) {
  const p = DB.peds.find(x => x.id === id);
  if (!p) return;
  const c = DB.clis.find(x => x.id === p.cid);
  askConfirm(`Confirmar recebimento de ${brl(p.tot)}${c ? ' de ' + esc(c.nm) : ''}?\n\nUm lançamento de receita será registrado no financeiro.`, async () => {
    p.pag = 'Recebido';
    p.st  = 'Entregue';
    const t = { id: await nextId('t'), tp: 'receita', ds: `Recebimento pedido #${p.id}`, vl: p.tot, dt: td() };
    DB.trans.push(t);
    rReceber();
    rFin();
    rMet();
    rDashRec();
    genAutoNotifs();
    showToast('Pagamento registrado!');
    sbSync(() => SBPeds.upsert(p));
    sbSync(() => SBTrans.upsert(t));
  });
}

/* ── Histórico de Vendas ─────────────────────────── */
let _hvSt = '';

function rHistorico() { hvUpd(); }

function hvSt(el, st) {
  _hvSt = st;
  document.querySelectorAll('.hv-chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  hvUpd();
}

function hvClear() {
  _hvSt = '';
  if ($('hv-busca')) $('hv-busca').value = '';
  if ($('hv-de'))    $('hv-de').value    = '';
  if ($('hv-ate'))   $('hv-ate').value   = '';
  if ($('hv-pag'))   $('hv-pag').value   = '';
  document.querySelectorAll('.hv-chip').forEach((c, i) => c.classList.toggle('on', i === 0));
  hvUpd();
}

function hvUpd() {
  const busca = ($('hv-busca')?.value || '').toLowerCase().trim();
  const de    = $('hv-de')?.value    || '';
  const ate   = $('hv-ate')?.value   || '';
  const pag   = ($('hv-pag')?.value  || '').toLowerCase();

  let peds = [...DB.peds].reverse();

  if (busca) peds = peds.filter(p => {
    const c = DB.clis.find(x => x.id === p.cid);
    return (c?.nm || '').toLowerCase().includes(busca) || p.prod.toLowerCase().includes(busca);
  });
  if (de)    peds = peds.filter(p => p.dt >= de);
  if (ate)   peds = peds.filter(p => p.dt <= ate);
  if (pag)   peds = peds.filter(p => p.pag.toLowerCase().includes(pag));
  if (_hvSt) peds = peds.filter(p => p.st === _hvSt);

  const tot   = peds.reduce((a, b) => a + b.tot, 0);
  const tkMed = peds.length ? tot / peds.length : 0;
  const kpis  = $('hv-kpis');
  if (kpis) kpis.innerHTML = `
    <article class="summary-card"><div>Vendas</div><div class="summary-value">${peds.length}</div><div class="summary-meta">${peds.filter(p => p.pag === 'Fiado').length} fiado</div></article>
    <article class="summary-card"><div>Total</div><div class="summary-value">${brl(tot)}</div><div class="summary-meta">no filtro atual</div></article>
    <article class="summary-card"><div>Ticket médio</div><div class="summary-value">${brl(tkMed)}</div><div class="summary-meta">por pedido</div></article>`;

  const tb = $('hvtt');
  const cardsEl = $('hvcards');
  const stCl = { Pendente: 'xb-gold', Confirmado: 'xb-blue', Enviado: 'xb-gray', Entregue: 'xb-green' };
  if (!peds.length) {
    if (tb)      tb.innerHTML      = `<tr><td colspan="8" style="text-align:center;padding:22px;color:#94a3b8;font-size:13px">Nenhuma venda encontrada</td></tr>`;
    if (cardsEl) cardsEl.innerHTML = `<p class="small-note" style="padding:20px 0;text-align:center;color:var(--tx-s)">Nenhuma venda encontrada</p>`;
    return;
  }
  const avatarColors = ['--blue-bg,--blue','--violet-bg,--violet','--green-bg,--green','--orange-bg,--orange'];
  if (cardsEl) cardsEl.innerHTML = peds.map((p, idx) => {
    const c   = DB.clis.find(x => x.id === p.cid);
    const nm  = c ? c.nm : (p.pendente_cli ? 'Sem cliente' : '—');
    const ini = esc(nm.split(' ').filter(Boolean).map(w => w[0]).slice(0,2).join('').toUpperCase() || '?');
    const [bg, fg] = avatarColors[idx % avatarColors.length].split(',');
    return `<div class="rb-card" style="cursor:pointer" onclick="editPed(${p.id})">
      <div class="rb-card-top">
        <div class="order-avatar" style="background:var(${bg});color:var(${fg})">${ini}</div>
        <div class="rb-card-info">
          <div class="rb-card-name">${esc(nm)}</div>
          <div class="rb-card-prod">${esc(p.prod)} · ${fdt(p.dt)}</div>
        </div>
        <div class="rb-card-val">${brl(p.tot)}</div>
      </div>
      <div class="rb-card-bottom">
        <span class="xb ${stCl[p.st] || 'xb-gray'}">${p.st}</span>
        <span class="rb-card-due">${p.pag}</span>
      </div>
    </div>`;
  }).join('');
  if (!tb) return;
  tb.innerHTML = peds.map(p => {
    const c = DB.clis.find(x => x.id === p.cid);
    return `<tr>
      <td style="color:var(--tx-m);font-size:12.5px">#${p.id}</td>
      <td>${fdt(p.dt)}</td>
      <td style="font-weight:500">${c ? esc(c.nm) : (p.pendente_cli ? '<span class="xb xb-gold" style="font-size:11px">Sem cliente</span>' : '—')}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.prod)}</td>
      <td style="font-weight:600">${brl(p.tot)}</td>
      <td style="color:var(--tx-m)">${p.pag}</td>
      <td><span class="xb ${stCl[p.st] || 'xb-gray'}">${p.st}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          <select class="fi small-select" onchange="updPS(${p.id}, this.value);hvUpd()">
            ${['Pendente','Confirmado','Enviado','Entregue'].map(x => `<option${x === p.st ? ' selected' : ''}>${x}</option>`).join('')}
          </select>
          <button class="cupom-row-btn" onclick="gerarCupomPedido(${p.id})" title="Gerar cupom fiscal">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Cupom
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function updPS(id, st) {
  const p = DB.peds.find(x => x.id === id);
  if (p) { p.st = st; rReceber(); rDashRec(); genAutoNotifs(); showToast('Status atualizado'); sbSync(() => SBPeds.updateStatus(id, st)); }
}

/* ── Editar Pedido ───────────────────────────────── */
function editPed(id) {
  const p = DB.peds.find(x => x.id === id);
  if (!p) return;
  if ($('med-id')) $('med-id').value = p.id;
  const sel = $('med-c');
  if (sel) sel.innerHTML = DB.clis.map(c => `<option value="${c.id}"${c.id === p.cid ? ' selected' : ''}>${esc(c.nm)}</option>`).join('');
  const pagBase = p.pag ? p.pag.replace(/\s+\d+×$/, '') : 'PIX';
  if ($('med-pg')) $('med-pg').value = pagBase;
  if ($('med-parc')) $('med-parc').value = p.parc || 1;
  if ($('med-dtpag')) $('med-dtpag').value = p.dtpag || p.dt;
  if ($('med-tot')) $('med-tot').value = p.tot;
  if ($('med-st')) $('med-st').value = p.st;
  openMod('med');
}

async function savePedEdit() {
  const id    = parseInt($('med-id')?.value);
  const p     = DB.peds.find(x => x.id === id);
  if (!p) return;
  const cid   = parseInt($('med-c')?.value);
  const pag   = $('med-pg')?.value;
  const parc  = parseInt($('med-parc')?.value) || 1;
  const dtpag = $('med-dtpag')?.value || p.dtpag;
  const tot   = parseFloat($('med-tot')?.value) || p.tot;
  const st    = $('med-st')?.value;
  const pagLabel = parc > 1 ? `${pag} ${parc}×` : pag;
  const oldCli = DB.clis.find(x => x.id === p.cid);
  const newCli = DB.clis.find(x => x.id === cid);
  if (p.cid !== cid) {
    if (oldCli) { oldCli.gasto = Math.max(0, (oldCli.gasto || 0) - p.tot); sbSync(() => SBClis.update(p.cid, { gasto: oldCli.gasto })); }
    if (newCli) { newCli.gasto = (newCli.gasto || 0) + tot; sbSync(() => SBClis.update(cid, { gasto: newCli.gasto })); }
  } else if (oldCli && tot !== p.tot) {
    oldCli.gasto = Math.max(0, (oldCli.gasto || 0) - p.tot + tot);
    sbSync(() => SBClis.update(p.cid, { gasto: oldCli.gasto }));
  }
  const wasfiado = p.pag === 'Fiado';
  const nowFiado = pag === 'Fiado';
  const tr = DB.trans.find(t => t.ds === `Pedido #${id}`);
  if (wasfiado && !nowFiado) {
    const newTr = { id: await nextId('t'), tp: 'receita', ds: `Pedido #${id}`, vl: tot, dt: dtpag };
    DB.trans.push(newTr);
    sbSync(() => SBTrans.upsert(newTr));
  } else if (!wasfiado && nowFiado && tr) {
    DB.trans = DB.trans.filter(t => t.ds !== `Pedido #${id}`);
    sbSync(() => _sbClient?.from('transactions').delete().eq('id', tr.id));
  } else if (tr) {
    tr.vl = tot; tr.dt = dtpag; sbSync(() => SBTrans.upsert(tr));
  }
  Object.assign(p, { cid, pag: pagLabel, parc, dtpag, tot, st });
  sbSync(() => SBPeds.upsert(p));
  renderAll();
  closeMod('med');
  showToast('Pedido atualizado');
}
