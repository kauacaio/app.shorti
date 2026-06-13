/* =====================================================
   app/catalogo.js — Catálogo, CRUD de produtos,
   wizard mobile de produto
   ===================================================== */

function rKat() {
  $('ktt').innerHTML = DB.prods.map(p => `
    <tr>
      <td class="emoji-cell">${p.img
        ? `<img src="${p.img}" style="width:36px;height:36px;object-fit:cover;border-radius:8px;display:block" onerror="this.outerHTML='${p.em}'">`
        : p.em}</td>
      <td class="cell-strong">${p.nm}</td>
      <td>${cNm[p.cat]}</td>
      <td>${p.pd ? `<span style="text-decoration:line-through;color:#94a3b8;font-size:11px">${brl(p.pr)}</span> <strong style="color:#16a34a">${brl(p.pd)}</strong>` : brl(p.pr)}</td>
      <td>${p.pd ? brl(p.pd) : '—'}</td>
      <td>${p.dt ? `<span class="xb ${p.dt === 'new' ? 'xb-green' : 'xb-gold'}">${p.dt === 'new' ? 'Novo' : 'Promoção'}</span>` : '—'}</td>
      <td class="table-actions"><button class="eb small" onclick="editP(${p.id})">Editar</button><button class="eb small" onclick="delP(${p.id})">Excluir</button></td>
    </tr>`).join('');
}

/* ── Wizard de produto (mobile) ──────────────────────── */
let _mpStep = 1;

function mpGoStep(n) {
  _mpStep = n;
  document.querySelectorAll('.mp-step-panel').forEach(el => {
    el.classList.toggle('mp-step-on', parseInt(el.dataset.step) === n);
  });
  document.querySelectorAll('.mp-dot').forEach(el => {
    const s = parseInt(el.dataset.step);
    el.classList.toggle('active', s === n);
    el.classList.toggle('done',   s < n);
  });
  const lbls = { 1:'Dados do produto', 2:'Preço & Estoque', 3:'Extras & Foto' };
  const lbl = $('mp-wiz-label');
  if (lbl) lbl.textContent = lbls[n] || '';
  const prev = $('mp-prev-btn'), next = $('mp-next-btn');
  if (prev) prev.style.display = n === 1 ? 'none' : '';
  if (next) next.textContent = n === 3 ? 'Salvar produto' : 'Próximo';
}

function mpNext() {
  if (_mpStep === 1) {
    const nm = ($('pe-nm')?.value || '').trim();
    if (!nm) { showToast('Informe o nome do produto'); $('pe-nm')?.focus(); return; }
  }
  if (_mpStep === 3) { confirmSaveProd(); return; }
  mpGoStep(_mpStep + 1);
}

function mpPrev() {
  if (_mpStep > 1) mpGoStep(_mpStep - 1);
}

function mpSyncField(fromId, toId) {
  const from = $(fromId), to = $(toId);
  if (from && to) to.value = from.value;
}

function mpPreviewUpdate() {
  const url  = ($('pe-img')?.value || '').trim();
  const em   = $('pe-em')?.value || '📦';
  const img  = $('mp-preview-img');
  const emEl = $('mp-preview-em');
  const hint = $('mp-img-hint');
  if (url) {
    if (img) {
      img.src = url;
      img.onload  = () => { img.style.display = 'block'; if (emEl) emEl.style.display = 'none'; if (hint) hint.textContent = '✓ Imagem carregada'; if (hint) hint.style.color = 'var(--green)'; };
      img.onerror = () => { img.style.display = 'none'; if (emEl) emEl.style.display = 'block'; if (hint) hint.textContent = '⚠ URL inválida ou inacessível'; if (hint) hint.style.color = 'var(--warn)'; };
    }
  } else {
    if (img)  { img.style.display = 'none'; img.src = ''; }
    if (emEl) { emEl.style.display = 'block'; emEl.textContent = em || '📦'; }
    if (hint) { hint.textContent = ''; }
  }
  if (emEl && !url) emEl.textContent = em || '📦';
}

/* Salvar produto — pede confirmação se for edição */
function confirmSaveProd() {
  const nm = $('pe-nm')?.value?.trim();
  if (!nm) { showToast('Informe o nome do produto'); return; }
  const eid = $('pe-id')?.value;
  if (eid) {
    askConfirm({
      title: 'Salvar alterações?',
      msg: `As mudanças em <strong>${nm}</strong> serão salvas permanentemente.`,
      type: 'info',
      btnLabel: 'Salvar'
    }, saveProd);
  } else {
    saveProd();
  }
}

function saveProd() {
  const eid = $('pe-id')?.value;
  const featsRaw = $('pe-feats')?.value || '';
  const o = {
    em: $('pe-em').value || '💄',
    nm: $('pe-nm').value,
    cat: $('pe-cat').value,
    pr: parseFloat($('pe-pr').value) || 0,
    pd: $('pe-pd').value ? parseFloat($('pe-pd').value) : null,
    st: parseInt($('pe-st').value) || 0,
    dt: $('pe-dt').value,
    img: ($('pe-img')?.value || '').trim(),
    desc: ($('pe-desc')?.value || '').trim(),
    feats: featsRaw ? featsRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
    bump: $('pe-bump')?.value ? parseInt($('pe-bump').value) : null,
    bc: ($('pe-bc')?.value || '').replace(/\D/g,'') || null,
  };
  if (!o.nm) { showToast('Informe o nome'); return; }
  if (!eid && o.bc) {
    const dup = DB.prods.find(p => p.bc && p.bc === o.bc);
    if (dup) { showExistingProductModal(dup); return; }
  }
  let saved;
  if (eid) {
    const p = DB.prods.find(x => x.id === parseInt(eid));
    if (p) { Object.assign(p, o); saved = p; }
  } else {
    o.id = DB.nid.p++;
    DB.prods.push(o);
    saved = o;
  }
  renderAll();
  closeMod('mp');
  showToast(eid ? 'Produto atualizado ✓' : 'Produto criado ✓');
  if (saved) sbSync(() => SBProds.upsert(saved));
  $('pe-id').value = '';
  ['pe-nm','pe-em','pe-pr','pe-pd','pe-img','pe-desc','pe-feats','pe-bc'].forEach(i => { if ($(i)) $(i).value = ''; });
  $('pe-st').value = '0';
  if ($('pe-em-m'))  $('pe-em-m').value  = '';
  if ($('pe-img-m')) $('pe-img-m').value = '';
}

function editP(id) {
  const p = DB.prods.find(x => x.id === id);
  if (!p) return;
  $('pe-id').value = p.id;
  $('pe-em').value  = p.em;
  $('pe-nm').value  = p.nm;
  $('pe-cat').value = p.cat;
  $('pe-pr').value  = p.pr;
  $('pe-pd').value  = p.pd || '';
  $('pe-st').value  = p.st;
  $('pe-dt').value  = p.dt || '';
  if ($('pe-img'))   $('pe-img').value   = p.img   || '';
  if ($('pe-desc'))  $('pe-desc').value  = p.desc  || '';
  if ($('pe-feats')) $('pe-feats').value = (p.feats||[]).join(', ');
  if ($('pe-bump'))  $('pe-bump').value  = p.bump  || '';
  if ($('pe-bc'))    $('pe-bc').value    = p.bc    || '';
  if ($('pe-em-m'))  $('pe-em-m').value  = p.em    || '';
  if ($('pe-img-m')) $('pe-img-m').value = p.img   || '';
  if ($('mp-title')) $('mp-title').textContent = 'Editar Produto';
  if ($('mp-sub'))   $('mp-sub').textContent   = `Editando: ${p.nm}`;
  setTimeout(mpPreviewUpdate, 50);
  openMod('mp');
}

function delP(id) {
  const p = DB.prods.find(x => x.id === id);
  if (!p) return;
  askConfirm({
    title: 'Excluir produto?',
    msg: `Tem certeza que deseja excluir <strong>${p.nm}</strong>? Esta ação <strong>não pode ser desfeita</strong>.`,
    type: 'danger',
    btnLabel: 'Excluir produto'
  }, () => {
    DB.prods = DB.prods.filter(x => x.id !== id);
    renderAll();
    showToast('Produto excluído');
    sbSync(() => SBProds.delete(id));
  });
}
