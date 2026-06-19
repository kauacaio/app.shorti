/* =====================================================
   app/estoque.js — Estoque, detalhe de produto, updSt
   ===================================================== */

let _estCat = '', _estSt = '';

function estCat(el, cat) {
  _estCat = cat;
  document.querySelectorAll('.est-cat-chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  rEst();
}
function estSt(el, st) {
  _estSt = st;
  document.querySelectorAll('.est-st-chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  rEst();
}

/* ── Resumo do estoque (cards mobile) ── */
function rEstSummary() {
  const el = $('est-summary');
  if (!el) return;
  const total   = DB.prods.length;
  const units   = DB.prods.reduce((a,b) => a+b.st, 0);
  const valor   = DB.prods.reduce((a,b) => a+(b.pd||b.pr)*b.st, 0);
  const atencao = DB.prods.filter(p => p.st <= 5).sort((a,b) => a.st - b.st).slice(0, 5);

  el.innerHTML = `
    <div class="est-stat-row">
      <div class="est-stat"><div class="est-stat-val">${total}</div><div class="est-stat-lbl">Produtos</div></div>
      <div class="est-stat"><div class="est-stat-val">${units}</div><div class="est-stat-lbl">Unidades</div></div>
      <div class="est-stat"><div class="est-stat-val est-stat-money">${brl(valor)}</div><div class="est-stat-lbl">Valor em estoque</div></div>
    </div>
    ${atencao.length ? `
      <div class="est-alert-card">
        <div class="est-alert-hd">⚠ Estoque baixo</div>
        <div class="stock-list">
          ${atencao.map(p => {
            const pct = Math.min(100, Math.round((p.st/10)*100));
            const barCls = p.st===0?'stock-bar-out':p.st<=2?'stock-bar-low':'stock-bar-ok';
            return `<div class="stock-item" onclick="showProdDetail(${p.id})">
              <div class="stock-emoji">${p.em||'📦'}</div>
              <div class="stock-info">
                <div class="stock-name">${p.nm}</div>
                <div class="stock-bar-wrap"><div class="stock-bar-fill ${barCls}" style="width:${pct}%"></div></div>
              </div>
              <span class="xb ${p.st===0?'xb-red':'xb-gold'}">${p.st} un.</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    ` : `<div class="est-alert-card est-alert-ok">✓ Estoque em dia, nenhum produto baixo</div>`}`;
}

function rEst() {
  rEstSummary();
  const el = $('est-list');
  if (!el) {
    if ($('ett')) $('ett').innerHTML = DB.prods.map(p =>
      `<tr><td>${p.em} <span class="cell-strong">${p.nm}</span></td><td>${cNm[p.cat]}</td><td>${brl(p.pr)}</td>
       <td><span class="xb ${p.st===0?'xb-red':p.st<=3?'xb-gold':'xb-green'}">${p.st}</span></td>
       <td><span class="xb ${p.st===0?'xb-red':p.st<=5?'xb-gold':'xb-green'}">${p.st===0?'Esgotado':p.st<=5?'Baixo':'OK'}</span></td>
       <td class="table-actions"><button class="eb small" onclick="editP(${p.id})">Editar</button>
       <input type="number" value="${p.st}" min="0" class="small-input" onchange="updSt(${p.id},this.value)"></td></tr>`
    ).join('');
    return;
  }

  const busca = ($('est-busca')?.value || '').toLowerCase();

  const section = $('ep-estoque');
  if (section) section.classList.toggle('est-search-active', busca.length > 0);

  let prods   = [...DB.prods];
  if (busca)             prods = prods.filter(p => p.nm.toLowerCase().includes(busca) || (p.em||'').includes(busca));
  if (_estCat)           prods = prods.filter(p => p.cat === _estCat);
  if (_estSt === 'ok')       prods = prods.filter(p => p.st > 5);
  if (_estSt === 'baixo')    prods = prods.filter(p => p.st > 0 && p.st <= 5);
  if (_estSt === 'esgotado') prods = prods.filter(p => p.st === 0);

  if (!prods.length) {
    el.innerHTML = '<div class="est-empty">Nenhum produto encontrado.</div>';
    return;
  }

  const catOrder = ['pele','maquiagem','corpo','fragrancias'];
  const groups   = {};
  prods.forEach(p => { if (!groups[p.cat]) groups[p.cat] = []; groups[p.cat].push(p); });

  let html = '';
  catOrder.forEach(cat => {
    if (!groups[cat]) return;
    const list = groups[cat];
    html += `<div class="est-group-hd">
      <span class="est-group-name">${cNm[cat] || cat}</span>
      <span class="xb xb-gray">${list.length} produto${list.length!==1?'s':''}</span>
    </div>`;
    html += list.map(p => {
      const stCls = p.st === 0 ? 'xb-red' : p.st <= 5 ? 'xb-gold' : 'xb-green';
      const stLbl = p.st === 0 ? 'Esgotado' : p.st <= 5 ? 'Baixo' : 'OK';
      const dotClr= p.st === 0 ? '#EF4444' : p.st <= 5 ? '#D97706' : '#059669';
      const thumb = p.img
        ? `<div class="est-thumb"><img src="${p.img}" alt="${p.nm}"></div>`
        : `<div class="est-thumb">${p.em || '📦'}</div>`;
      return `<div class="est-row" onclick="showProdDetail(${p.id})">
        ${thumb}
        <div class="est-row-info">
          <div class="est-row-nm">${p.nm}${p.pd ? ` <span class="est-promo-tag">🏷 ${brl(p.pd)}</span>` : ''}</div>
          <div class="est-row-meta">${cNm[p.cat] || p.cat} · ${brl(p.pr)}</div>
        </div>
        <div class="est-row-right">
          <div class="est-qty-badge" style="color:${dotClr}">
            <span class="est-qty-dot" style="background:${dotClr}"></span>
            ${p.st} un.
          </div>
          <span class="xb ${stCls}">${stLbl}</span>
        </div>
      </div>`;
    }).join('');
  });

  el.innerHTML = html;
}

/* ── Métricas de estoque ── */
function showEstMetrics() {
  const total  = DB.prods.length;
  const units  = DB.prods.reduce((a,b) => a+b.st, 0);
  const valor  = DB.prods.reduce((a,b) => a+(b.pd||b.pr)*b.st, 0);
  const ok     = DB.prods.filter(p => p.st > 5).length;
  const baixo  = DB.prods.filter(p => p.st > 0 && p.st <= 5).length;
  const zero   = DB.prods.filter(p => p.st === 0).length;

  const sold = {};
  DB.peds.forEach(p => {
    if (p.itens) p.itens.forEach(i => { sold[i.nm] = (sold[i.nm]||0)+i.q; });
    else sold[p.prod] = (sold[p.prod]||0)+p.q;
  });
  const top = Object.entries(sold).sort((a,b)=>b[1]-a[1]).slice(0,5);

  $('estq-mc').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:18px">
      <div class="mc mc-blue"  style="padding:14px;gap:6px">
        <div class="mc-label">Produtos</div>
        <div class="mc-value" style="font-size:22px">${total}</div>
      </div>
      <div class="mc mc-green" style="padding:14px;gap:6px">
        <div class="mc-label">Unidades</div>
        <div class="mc-value" style="font-size:22px">${units}</div>
      </div>
      <div class="mc mc-violet" style="padding:14px;gap:6px">
        <div class="mc-label">Valor em estoque</div>
        <div class="mc-value" style="font-size:16px">${brl(valor)}</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">
      <span class="xb xb-green" style="padding:6px 14px;font-size:12px">✓ OK: ${ok}</span>
      <span class="xb xb-gold"  style="padding:6px 14px;font-size:12px">↓ Baixo: ${baixo}</span>
      <span class="xb xb-red"   style="padding:6px 14px;font-size:12px">✕ Esgotado: ${zero}</span>
    </div>
    ${top.length ? `
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--tx-s);margin-bottom:10px">Mais vendidos</div>
      ${top.map(([nm,q],i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #F3F4F6">
          <span style="font-size:13px;color:var(--tx);font-weight:500">${i+1}. ${nm}</span>
          <span style="font-size:12.5px;font-weight:600;color:var(--tx-m)">${q} un. vendidas</span>
        </div>`).join('')}
    ` : ''}`;
  openMod('mestq');
}

/* ── Detalhe do produto ── */
let _curProd = null;
function showProdDetail(id) {
  _curProd = id;
  const p = DB.prods.find(x => x.id === id);
  if (!p) return;

  const peds = DB.peds.filter(ped =>
    ped.itens ? ped.itens.some(i => i.nm === p.nm) : ped.prod === p.nm
  );
  const totalQ = peds.reduce((a, ped) =>
    a + (ped.itens ? ped.itens.filter(i=>i.nm===p.nm).reduce((s,i)=>s+i.q,0) : ped.q), 0
  );

  const maxSt  = Math.max(p.st+3, 10);
  const pct    = p.st===0 ? 0 : Math.min(100, Math.round((p.st/maxSt)*100));
  const barClr = p.st===0 ? 'var(--err)' : p.st<=5 ? 'var(--warn)' : 'var(--green)';
  const stMsg  = p.st===0 ? 'Esgotado' : p.st<=5 ? 'Estoque baixo' : 'Estoque saudável';

  $('prod-drawer-title').textContent = p.nm;
  $('prod-del-btn').onclick  = () => { closeProdDetail(); delP(id); };
  $('prod-edit-btn').onclick = () => { closeProdDetail(); editP(id); };

  $('prod-drawer-body').innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;padding-bottom:18px;border-bottom:1px solid #F3F4F6;margin-bottom:18px">
      <div style="width:54px;height:54px;border-radius:14px;background:#F9FAFB;display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;overflow:hidden">
        ${p.img ? `<img src="${p.img}" style="width:100%;height:100%;object-fit:cover">` : (p.em||'📦')}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:15px;font-weight:700;color:var(--tx)">${p.nm}</div>
        <div style="font-size:12.5px;color:var(--tx-m);margin-top:2px">${cNm[p.cat]||p.cat}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
          <span style="font-size:14px;font-weight:700;color:var(--tx)">${brl(p.pr)}</span>
          ${p.pd?`<span style="font-size:12px;color:var(--green);font-weight:600">🏷 ${brl(p.pd)}</span>`:''}
        </div>
      </div>
    </div>

    <div style="margin-bottom:18px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:13px;font-weight:600;color:var(--tx)">Estoque atual</span>
        <span style="font-size:15px;font-weight:700;color:var(--tx)">${p.st} un.</span>
      </div>
      <div style="height:8px;background:#F3F4F6;border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${barClr};border-radius:4px;transition:width .4s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px">
        <span style="font-size:12px;color:var(--tx-m)">${stMsg}</span>
        <button class="eb" onclick="openMod('msolic')" style="font-size:11.5px">+ Solicitar reposição</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px">
      <div style="background:#F9FAFB;border-radius:10px;padding:14px">
        <div style="font-size:11.5px;color:var(--tx-m);margin-bottom:4px">Unidades vendidas</div>
        <div style="font-size:22px;font-weight:700;color:var(--tx);letter-spacing:-.04em">${totalQ}</div>
      </div>
      <div style="background:#F9FAFB;border-radius:10px;padding:14px">
        <div style="font-size:11.5px;color:var(--tx-m);margin-bottom:4px">Pedidos incluindo</div>
        <div style="font-size:22px;font-weight:700;color:var(--tx);letter-spacing:-.04em">${peds.length}</div>
      </div>
    </div>

    ${p.desc ? `<div style="font-size:13px;color:var(--tx-m);line-height:1.6;padding:12px 14px;background:#F9FAFB;border-radius:10px;margin-bottom:18px">${p.desc}</div>` : ''}

    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--tx-s);margin-bottom:10px">Últimos pedidos</div>
    ${peds.length ? [...peds].slice(-5).reverse().map(ped => {
      const c = DB.clis.find(x => x.id === ped.cid);
      const stCls = {Pendente:'xb-gold',Confirmado:'xb-blue',Enviado:'xb-gray',Entregue:'xb-green'};
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #F3F4F6">
        <div>
          <div style="font-size:13px;font-weight:500;color:var(--tx)">${c ? esc(c.nm) : '—'}</div>
          <div style="font-size:11.5px;color:var(--tx-m)">${fdt(ped.dt)}</div>
        </div>
        <span class="xb ${stCls[ped.st]||'xb-gray'}">${ped.st}</span>
      </div>`;
    }).join('')
    : `<p style="font-size:13px;color:var(--tx-m);text-align:center;padding:16px 0">Nenhum pedido com este produto.</p>`}
  `;

  $('prod-backdrop').classList.add('on');
  $('prod-drawer').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeProdDetail() {
  $('prod-backdrop').classList.remove('on');
  $('prod-drawer').classList.remove('open');
  document.body.style.overflow = '';
}

function updSt(id, v) {
  const p = DB.prods.find(x => x.id === id);
  if (p) { p.st = parseInt(v) || 0; rEst(); rDashLow(); rMet(); genAutoNotifs(); showToast('Estoque atualizado'); sbSync(() => SBProds.updateStock(id, p.st)); }
}
