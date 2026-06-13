/* =====================================================
   app/extrato.js — Extrato Mensal
   ===================================================== */

let _extY = 0, _extM = 0;

function _extInit() {
  if (_extY) return;
  const prev = new Date();
  prev.setDate(1);
  prev.setMonth(prev.getMonth() - 1);
  _extY = prev.getFullYear();
  _extM = prev.getMonth() + 1;
}

function extNavMes(d) {
  _extM += d;
  if (_extM > 12) { _extM = 1;  _extY++; }
  if (_extM < 1)  { _extM = 12; _extY--; }
  const now = new Date();
  if (_extY > now.getFullYear() || (_extY === now.getFullYear() && _extM > now.getMonth() + 1)) {
    _extM -= d;
    if (_extM > 12) { _extM = 1;  _extY++; }
    if (_extM < 1)  { _extM = 12; _extY--; }
    return;
  }
  rExtrato();
}

function rExtrato() {
  _extInit();
  const mnNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const mStr = `${_extY}-${String(_extM).padStart(2,'0')}`;
  const mesNm = `${mnNames[_extM - 1]} ${_extY}`;
  const nowRef = new Date();
  const isPreview = (_extY === nowRef.getFullYear() && _extM === nowRef.getMonth() + 1);

  if ($('ext-month-label')) {
    $('ext-month-label').innerHTML = isPreview
      ? `${mesNm} <span class="ext-preview-badge">Prévia</span>`
      : mesNm;
  }
  if ($('ext-subtitle')) {
    $('ext-subtitle').textContent = isPreview
      ? 'Prévia do mês atual — dados em tempo real'
      : 'Demonstrativo financeiro completo';
  }
  const noteEl = $('ext-preview-note');
  if (noteEl) noteEl.style.display = isPreview ? 'flex' : 'none';

  const pedsMes   = DB.peds.filter(p => p.dt?.startsWith(mStr));
  const transMes  = DB.trans.filter(t => t.dt?.startsWith(mStr));
  const recMes    = transMes.filter(t => t.tp === 'receita').reduce((a,b) => a+b.vl, 0);
  const desMes    = transMes.filter(t => t.tp === 'despesa').reduce((a,b) => a+b.vl, 0);
  const fatMes    = pedsMes.reduce((a,b) => a+b.tot, 0);
  const fiadoMes  = pedsMes.filter(p => p.pag === 'Fiado').reduce((a,b) => a+b.tot, 0);
  const lucro     = recMes - desMes;
  const pct       = fatMes > 0 ? Math.round((recMes / fatMes) * 100) : 0;
  const tkMed     = pedsMes.length ? fatMes / pedsMes.length : 0;

  /* KPIs */
  if ($('ext-kpis')) $('ext-kpis').innerHTML = `
    <div class="ext-kpi kpi-rose" data-icon="✦">
      <div class="ext-kpi-label">Faturamento</div>
      <div class="ext-kpi-value">${brl(fatMes)}</div>
      <div class="ext-kpi-sub" style="color:#C4897A">${pedsMes.length} pedido${pedsMes.length !== 1 ? 's' : ''}</div>
    </div>
    <div class="ext-kpi kpi-sage" data-icon="✓">
      <div class="ext-kpi-label">Recebido</div>
      <div class="ext-kpi-value">${brl(recMes)}</div>
      <div class="ext-kpi-sub" style="color:#6B9E7A">${pct}% do faturamento</div>
    </div>
    <div class="ext-kpi kpi-amber" data-icon="⏳">
      <div class="ext-kpi-label">A Receber</div>
      <div class="ext-kpi-value">${brl(fiadoMes)}</div>
      <div class="ext-kpi-sub" style="color:#D97706">${pedsMes.filter(p => p.pag==='Fiado').length} fiado${pedsMes.filter(p => p.pag==='Fiado').length !== 1 ? 's' : ''}</div>
    </div>
    <div class="ext-kpi kpi-slate" data-icon="◈">
      <div class="ext-kpi-label">Ticket Médio</div>
      <div class="ext-kpi-value">${brl(tkMed)}</div>
      <div class="ext-kpi-sub" style="color:${lucro >= 0 ? '#6B9E7A' : '#dc2626'}">Lucro ${brl(lucro)}</div>
    </div>`;

  /* Barra de progresso */
  if ($('ext-prog-pct'))  $('ext-prog-pct').textContent  = pct + '%';
  if ($('ext-prog-fill')) $('ext-prog-fill').style.width = pct + '%';
  if ($('ext-prog-rec'))  $('ext-prog-rec').textContent  = `${brl(recMes)} recebido`;
  if ($('ext-prog-pend')) $('ext-prog-pend').textContent = fiadoMes > 0 ? `${brl(fiadoMes)} a receber` : 'Tudo recebido ✓';

  /* Pedidos do mês */
  if ($('ext-ped-count')) $('ext-ped-count').textContent = `${pedsMes.length} pedido${pedsMes.length !== 1 ? 's' : ''}`;
  const extStCl = { Pendente:'xb-gold', Confirmado:'xb-blue', Enviado:'xb-gray', Entregue:'xb-green' };
  if ($('ext-peds-tb')) {
    if (!pedsMes.length) {
      $('ext-peds-tb').innerHTML = `<tr><td colspan="6" style="text-align:center;padding:22px;color:#94a3b8;font-size:13px">Nenhum pedido em ${mesNm}</td></tr>`;
    } else {
      $('ext-peds-tb').innerHTML = [...pedsMes].reverse().map(p => {
        const c = DB.clis.find(x => x.id === p.cid);
        const pagCl = p.pag === 'Fiado' ? 'style="color:#d97706;font-weight:600"' : '';
        return `<tr>
          <td style="color:#94a3b8">#${p.id}</td>
          <td style="font-weight:500">${c ? c.nm : '—'}</td>
          <td>${p.prod}</td>
          <td style="font-weight:600">${brl(p.tot)}</td>
          <td ${pagCl}>${p.pag}</td>
          <td><span class="xb ${extStCl[p.st]||'xb-gray'}">${p.st}</span></td>
        </tr>`;
      }).join('');
    }
  }
  if ($('ext-peds-cards')) {
    $('ext-peds-cards').innerHTML = !pedsMes.length
      ? `<p class="small-note" style="padding:20px 0;text-align:center;color:var(--tx-s)">Nenhum pedido em ${mesNm}</p>`
      : [...pedsMes].reverse().map(p => {
          const c = DB.clis.find(x => x.id === p.cid);
          return `<div class="rb-card">
            <div class="rb-card-top">
              <div class="rb-card-info">
                <div class="rb-card-name">${c ? c.nm : '—'}</div>
                <div class="rb-card-prod">${p.prod}</div>
              </div>
              <div class="rb-card-val">${brl(p.tot)}</div>
            </div>
            <div class="rb-card-bottom">
              <span class="xb ${extStCl[p.st]||'xb-gray'}">${p.st}</span>
              <span class="rb-card-due">${p.pag}</span>
            </div>
          </div>`;
        }).join('');
  }

  /* Top clientes */
  if ($('ext-top-clis')) {
    const cliMap = {};
    pedsMes.forEach(p => { cliMap[p.cid] = (cliMap[p.cid] || 0) + p.tot; });
    const sorted = Object.entries(cliMap).sort((a,b) => b[1]-a[1]).slice(0,5);
    $('ext-top-clis').innerHTML = !sorted.length
      ? '<p style="font-size:13px;color:#94a3b8;padding:8px 0">Nenhum cliente este mês</p>'
      : sorted.map(([cid,tot],i) => {
          const c = DB.clis.find(x => x.id === parseInt(cid));
          return `<div class="ext-rank-item">
            <div class="ext-rank-pos ${i===0?'top1':''}">${i+1}</div>
            <div class="ext-rank-nm">${c ? c.nm : `#${cid}`}</div>
            <div class="ext-rank-val">${brl(tot)}</div>
          </div>`;
        }).join('');
  }

  /* Top produtos */
  if ($('ext-top-prods')) {
    const prodMap = {};
    pedsMes.forEach(p => {
      if (p.itens) p.itens.forEach(i => { prodMap[i.nm] = (prodMap[i.nm] || 0) + i.sub; });
      else prodMap[p.prod] = (prodMap[p.prod] || 0) + p.tot;
    });
    const sorted = Object.entries(prodMap).sort((a,b) => b[1]-a[1]).slice(0,5);
    $('ext-top-prods').innerHTML = !sorted.length
      ? '<p style="font-size:13px;color:#94a3b8;padding:8px 0">Nenhum produto este mês</p>'
      : sorted.map(([nm,tot],i) => `
          <div class="ext-rank-item">
            <div class="ext-rank-pos ${i===0?'top1':''}">${i+1}</div>
            <div class="ext-rank-nm">${nm}</div>
            <div class="ext-rank-val">${brl(tot)}</div>
          </div>`).join('');
  }

  /* Lançamentos financeiros */
  if ($('ext-trans-count')) $('ext-trans-count').textContent = `${transMes.length} lançamento${transMes.length !== 1 ? 's' : ''}`;
  if ($('ext-trans-tb')) {
    if (!transMes.length) {
      $('ext-trans-tb').innerHTML = `<tr><td colspan="4" style="text-align:center;padding:22px;color:#94a3b8;font-size:13px">Nenhum lançamento em ${mesNm}</td></tr>`;
    } else {
      $('ext-trans-tb').innerHTML = [...transMes].reverse().map(t => `
        <tr>
          <td style="color:#94a3b8">${fdt(t.dt)}</td>
          <td>${t.ds}</td>
          <td><span class="xb ${t.tp==='receita'?'xb-green':'xb-red'}">${t.tp==='receita'?'Receita':'Despesa'}</span></td>
          <td class="${t.tp==='receita'?'revenue':'expense'}" style="font-weight:600">${t.tp==='receita'?'+':'-'} ${brl(t.vl)}</td>
        </tr>`).join('');
    }
  }
  if ($('ext-trans-cards')) {
    $('ext-trans-cards').innerHTML = !transMes.length
      ? `<p class="small-note" style="padding:20px 0;text-align:center;color:var(--tx-s)">Nenhum lançamento em ${mesNm}</p>`
      : [...transMes].reverse().map(t => `
        <div class="rb-card">
          <div class="rb-card-top">
            <div class="rb-card-info">
              <div class="rb-card-name">${t.ds}</div>
              <div class="rb-card-prod">${fdt(t.dt)}</div>
            </div>
            <div class="rb-card-val ${t.tp==='receita'?'revenue':'expense'}">${t.tp==='receita'?'+':'-'} ${brl(t.vl)}</div>
          </div>
          <div class="rb-card-bottom">
            <span class="xb ${t.tp==='receita'?'xb-green':'xb-red'}">${t.tp==='receita'?'Receita':'Despesa'}</span>
          </div>
        </div>`).join('');
  }

  /* Rodapé */
  const now = new Date();
  const dtStr = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  if ($('ext-gen-dt'))    $('ext-gen-dt').textContent    = dtStr;
  if ($('ext-footer-mes')) $('ext-footer-mes').textContent = mesNm;
}
