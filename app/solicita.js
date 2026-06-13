/* =====================================================
   app/solicita.js — Solicitações (pedidos para Mary Kay)
   ===================================================== */

let _solicFtr = '';

function solcFtr(btn, val) {
  _solicFtr = val;
  document.querySelectorAll('.solic-fc').forEach(b => b.classList.toggle('on', b === btn));
  rSolic();
}

function rSolic() {
  const el = $('stt');
  const cardsEl = $('solcards');
  if (!el && !cardsEl) return;

  const busca = ($('solic-busca')?.value || '').toLowerCase().trim();
  let items = [...DB.solics].reverse();
  if (_solicFtr) items = items.filter(s => s.st === _solicFtr);
  if (busca)     items = items.filter(s => s.nm.toLowerCase().includes(busca) || (s.obs||'').toLowerCase().includes(busca));

  const stXb = { Pendente: 'xb-gold', Solicitado: 'xb-blue', Recebido: 'xb-green' };

  if (!items.length) {
    const msg = busca || _solicFtr ? 'Nenhum resultado encontrado.' : 'Nenhuma solicitação ainda. Clique em <strong>+ Solicitação</strong> para adicionar.';
    if (el)      el.innerHTML      = `<tr><td colspan="8" style="text-align:center;padding:32px;color:#94A3B8;font-size:13px">${msg}</td></tr>`;
    if (cardsEl) cardsEl.innerHTML = `<p class="small-note" style="padding:20px 0;text-align:center;color:var(--tx-s)">${msg}</p>`;
    return;
  }

  if (cardsEl) cardsEl.innerHTML = items.map(s => `
    <div class="rb-card">
      <div class="rb-card-top">
        <div class="rb-card-info">
          <div class="rb-card-name">${s.nm}</div>
          <div class="rb-card-prod">${s.q} un. ${s.pr ? '· ' + brl(s.pr) : ''}${s.obs ? ' · ' + s.obs : ''}</div>
        </div>
        <span class="xb ${stXb[s.st] || 'xb-gray'}">${s.st}</span>
      </div>
      <div class="rb-card-bottom">
        <span class="rb-card-due">${fdt(s.dt)}</span>
        <div style="display:flex;gap:8px">
          <button class="eb small" onclick="editSolic(${s.id})">Editar</button>
          <button class="eb small" onclick="delSolic(${s.id})">Excluir</button>
        </div>
      </div>
    </div>`).join('');

  if (!el) return;
  el.innerHTML = items.map(s => `
    <tr>
      <td style="color:#94A3B8;font-size:12px">#${String(s.id).padStart(3,'0')}</td>
      <td class="cell-strong">${s.nm}</td>
      <td>${s.q} un.</td>
      <td>${s.pr ? brl(s.pr) : '—'}</td>
      <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.obs || '—'}</td>
      <td>${fdt(s.dt)}</td>
      <td><span class="xb ${stXb[s.st] || 'xb-gray'}">${s.st}</span></td>
      <td class="table-actions">
        <button class="eb small" onclick="editSolic(${s.id})">Editar</button>
        <button class="eb small" onclick="delSolic(${s.id})">Excluir</button>
      </td>
    </tr>`).join('');
}

function newSolic() {
  if ($('sl-id'))    $('sl-id').value = '';
  if ($('sl-nm'))    $('sl-nm').value = '';
  if ($('sl-q'))     $('sl-q').value  = '1';
  if ($('sl-pr'))    $('sl-pr').value = '';
  if ($('sl-obs'))   $('sl-obs').value = '';
  if ($('sl-st'))    $('sl-st').value = 'Pendente';
  const row = $('sl-status-row'); if (row) row.style.display = 'none';
  slSetSt(null, 'Pendente');
  if ($('msolic-title'))    $('msolic-title').textContent    = 'Nova Solicitação';
  if ($('msolic-save-btn')) $('msolic-save-btn').textContent = 'Criar solicitação';
  openMod('msolic');
}

function editSolic(id) {
  const s = DB.solics.find(x => x.id === id);
  if (!s) return;
  if ($('sl-id'))  $('sl-id').value  = s.id;
  if ($('sl-nm'))  $('sl-nm').value  = s.nm;
  if ($('sl-q'))   $('sl-q').value   = s.q;
  if ($('sl-pr'))  $('sl-pr').value  = s.pr || '';
  if ($('sl-obs')) $('sl-obs').value = s.obs || '';
  if ($('sl-st'))  $('sl-st').value  = s.st;
  const row = $('sl-status-row'); if (row) row.style.display = 'flex';
  slSetSt(null, s.st);
  if ($('msolic-title'))    $('msolic-title').textContent    = 'Editar Solicitação';
  if ($('msolic-save-btn')) $('msolic-save-btn').textContent = 'Salvar alterações';
  openMod('msolic');
}

function slSetSt(btn, val) {
  if ($('sl-st')) $('sl-st').value = val;
  document.querySelectorAll('#sl-status-row .pay-chip').forEach(b => {
    b.classList.toggle('on', b.textContent.trim().includes(val));
  });
}

function updSolicSt(id, st) {
  const s = DB.solics.find(x => x.id === id);
  if (s) { s.st = st; rSolic(); genAutoNotifs(); showToast('Status atualizado'); sbSync(() => SBSolics.updateStatus(id, st)); }
}

function delSolic(id) {
  askConfirm('Excluir esta solicitação?', () => {
    DB.solics = DB.solics.filter(x => x.id !== id);
    rSolic();
    showToast('Solicitação removida');
    sbSync(() => SBSolics.delete(id));
  });
}

function saveSolic() {
  const nm = $('sl-nm')?.value.trim();
  if (!nm) { showToast('Informe o produto'); return; }
  const eid = $('sl-id')?.value;
  const q   = parseInt($('sl-q')?.value)   || 1;
  const pr  = parseFloat($('sl-pr')?.value) || null;
  const obs = $('sl-obs')?.value.trim()    || '';
  const st  = $('sl-st')?.value            || 'Pendente';

  if (eid) {
    const s = DB.solics.find(x => x.id === parseInt(eid));
    if (s) { Object.assign(s, { nm, q, pr, obs, st }); sbSync(() => SBSolics.upsert(s)); }
    showToast('Solicitação atualizada ✓');
  } else {
    const s = { id: DB.nid.s++, nm, q, pr, obs, st: 'Pendente', dt: td() };
    DB.solics.push(s);
    sbSync(() => SBSolics.upsert(s));
    showToast('Solicitação criada ✓');
  }
  rSolic();
  closeMod('msolic');
}
