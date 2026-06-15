/* =====================================================
   app/financeiro.js — Financeiro e lançamentos
   ===================================================== */

function rFin() {
  const rec    = DB.trans.filter(t => t.tp === 'receita').reduce((a, b) => a + b.vl, 0);
  const des    = DB.trans.filter(t => t.tp === 'despesa').reduce((a, b) => a + b.vl, 0);
  const fat    = DB.peds.reduce((a, b) => a + b.tot, 0);
  $('f-r').textContent = brl(rec);
  $('f-d').textContent = brl(des);
  $('f-l').textContent = brl(rec - des);
  $('f-t').textContent = brl(DB.peds.length ? fat / DB.peds.length : 0);
  const recentes = [...DB.trans].reverse().slice(0, 8);
  $('ftt').innerHTML = recentes.map(t => `
    <tr>
      <td>${fdt(t.dt)}</td>
      <td>${esc(t.ds)}</td>
      <td><span class="xb ${t.tp === 'receita' ? 'xb-green' : 'xb-red'}">${t.tp === 'receita' ? 'Receita' : 'Despesa'}</span></td>
      <td class="${t.tp === 'receita' ? 'revenue' : 'expense'}">${t.tp === 'receita' ? '+' : '-'} ${brl(t.vl)}</td>
    </tr>`).join('');
  if ($('fincards')) $('fincards').innerHTML = !recentes.length
    ? `<p class="small-note" style="padding:20px 0;text-align:center;color:var(--tx-s)">Nenhum lançamento registrado</p>`
    : recentes.map(t => `
      <div class="rb-card">
        <div class="rb-card-top">
          <div class="rb-card-info">
            <div class="rb-card-name">${esc(t.ds)}</div>
            <div class="rb-card-prod">${fdt(t.dt)}</div>
          </div>
          <div class="rb-card-val ${t.tp === 'receita' ? 'revenue' : 'expense'}">${t.tp === 'receita' ? '+' : '-'} ${brl(t.vl)}</div>
        </div>
        <div class="rb-card-bottom">
          <span class="xb ${t.tp === 'receita' ? 'xb-green' : 'xb-red'}">${t.tp === 'receita' ? 'Receita' : 'Despesa'}</span>
        </div>
      </div>`).join('');
  rFlxChart();
}

function saveTr() {
  const o = {
    id: DB.nid.t++,
    tp: $('tr-tp').value,
    ds: $('tr-ds').value,
    vl: parseFloat($('tr-vl').value) || 0,
    dt: $('tr-dt').value || td()
  };
  if (!o.ds) { showToast('Informe a descrição'); return; }
  DB.trans.push(o);
  rFin();
  closeMod('mt');
  showToast('Lançamento salvo');
  sbSync(() => SBTrans.upsert(o));
  if ($('tr-ds')) $('tr-ds').value = '';
  if ($('tr-vl')) $('tr-vl').value = '';
  $('tr-dt').value = td();
}

function srch(id, q) { document.querySelectorAll('#' + id + ' tr').forEach(r => { r.style.display = r.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none'; }); }
function srchSt(s) { document.querySelectorAll('#ptt tr').forEach(r => { r.style.display = (!s || r.textContent.includes(s)) ? '' : 'none'; }); }
