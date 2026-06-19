/* =====================================================
   app/consulta.js — Página "Consultar Produto":
   câmera mobile + QR do celular + busca por nome/EAN
   ===================================================== */

let _cqScanner=null, _cqCamActive=false, _cqScanCooldown=false;

function openCQ(){ epage('consulta', null); }

async function rCQ(){
  _cqScanCooldown=false;
  await _cqStopCamera();
  ['cq-product-card','cq-search-results'].forEach(id=>{if($(id))$(id).style.display='none';});
  if($('cq-search'))$('cq-search').value='';
  if($('cq-clear'))$('cq-clear').style.display='none';
  if($('cq-placeholder'))$('cq-placeholder').style.display='flex';
  const mob=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)||window.innerWidth<=768;
  if(mob){
    if($('cq-camera-wrap'))$('cq-camera-wrap').style.display='block';
    if($('cq-qr-wrap'))$('cq-qr-wrap').style.display='none';
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    await _cqStartCamera();
  } else {
    if($('cq-camera-wrap'))$('cq-camera-wrap').style.display='none';
    if($('cq-qr-wrap'))$('cq-qr-wrap').style.display='flex';
    await _cqSetupQR();
  }
}

async function _cqStartCamera(){
  const reader=$('cq-reader');
  if(!reader||typeof Html5Qrcode==='undefined'){showToast('Scanner indisponível');return;}
  if(!(location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname))){showToast('Câmera requer HTTPS');return;}
  reader.innerHTML='';
  if(!reader.offsetWidth||!reader.offsetHeight){
    await new Promise(r=>setTimeout(r,120));
  }
  try{
    _cqScanner=new Html5Qrcode('cq-reader');
    const cfg={fps:15,experimentalFeatures:{useBarCodeDetectorIfSupported:true}};
    if(typeof Html5QrcodeSupportedFormats!=='undefined')
      cfg.formatsToSupport=[Html5QrcodeSupportedFormats.EAN_13,Html5QrcodeSupportedFormats.EAN_8,Html5QrcodeSupportedFormats.CODE_128,Html5QrcodeSupportedFormats.UPC_A];
    let ok=false;
    for(const f of['environment','user']){try{await _cqScanner.start({facingMode:f},cfg,_cqOnScan,()=>{});ok=true;break;}catch(e){}}
    if(ok)_cqCamActive=true;else throw new Error('no camera');
  }catch(e){
    _cqCamActive=false;
    const msg=(e?.message||'').toLowerCase();
    showToast(msg.includes('permission')||msg.includes('notallowed')?'Permissão de câmera negada':'Câmera indisponível');
  }
}

async function _cqStopCamera(){
  _cqCamActive=false;
  if(_cqScanner){
    try{await _cqScanner.stop();}catch(e){}
    try{_cqScanner.clear();}catch(e){}
    _cqScanner=null;
  }
  const reader=$('cq-reader');
  if(reader)reader.innerHTML='';
}

async function _cqSetupQR(){
  if(_phoneConnected&&_phoneChannel){
    _cqFlipConnected();
    _phoneChannel.on('broadcast',{event:'barcode'},({payload})=>{if(payload?.code&&$('ep-consulta')?.classList.contains('on'))_cqOnScan(payload.code);});
    return;
  }
  if(_phoneSid&&_phoneChannel&&_phoneQrUrl){
    _cqShowPinDigits(_phoneSid);
    await _cqRenderQR(_phoneQrUrl);
    _phoneChannel
      .on('broadcast',{event:'phone-connected'},()=>{_phoneConnected=true;_phoneSetStatus('connected','📱 Celular conectado');_cqFlipConnected();})
      .on('broadcast',{event:'barcode'},({payload})=>{if(payload?.code&&$('ep-consulta')?.classList.contains('on'))_cqOnScan(payload.code);});
    return;
  }
  if(!window._sbClient||window._sbClient._local){
    const w=$('cq-qr-wrap');
    if(w)w.innerHTML=`<div class="cq-no-phone"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg><p>Use a busca para localizar produtos.<br><small>Scanner por celular requer Supabase.</small></p></div>`;
    return;
  }

  /* PIN de 6 dígitos */
  _phoneSid = String(Math.floor(100000 + Math.random() * 900000));
  _phoneConnected = false;

  /* URL base */
  const hasLocalServer = location.port === '3000';
  let base = null;
  if(hasLocalServer){try{const r=await fetch(`${location.protocol}//${location.hostname}:3000/api/tunnel`);const j=await r.json();base=j.url||null;}catch(e){}}
  if(!base){
    const host = (location.hostname==='localhost'||location.hostname==='127.0.0.1')?(await _getLocalIP()||location.hostname):location.hostname;
    const port = location.port?`:${location.port}`:'';
    const dir  = location.pathname.replace(/\/[^/]*$/,'');
    base = `${location.protocol}//${host}${port}${dir}`;
  }
  _phoneQrUrl = `${base}/mobile-scan.html?s=${_phoneSid}`;

  /* Exibe PIN e QR */
  _cqShowPinDigits(_phoneSid);
  await _cqRenderQR(_phoneQrUrl);

  /* Broadcast para dispositivos registrados */
  _broadcastToDevices(_phoneSid, _phoneQrUrl);

  _phoneChannel=window._sbClient.channel(`erp-scan-${_phoneSid}`,{config:{broadcast:{self:false}}});
  _phoneChannel
    .on('broadcast',{event:'phone-connected'},()=>{_phoneConnected=true;_phoneSetStatus('connected','📱 Celular conectado');_cqFlipConnected();})
    .on('broadcast',{event:'barcode'},({payload})=>{if(payload?.code){if($('ep-consulta')?.classList.contains('on'))_cqOnScan(payload.code);else onScanResult(payload.code);}})
    .subscribe();
}

function _cqShowPinDigits(sid){
  const el=$('cq-pin-digits');
  if(!el)return;
  const mk=d=>`<span class="cq-pin-d">${d}</span>`;
  el.innerHTML=sid.slice(0,3).split('').map(mk).join('')+'<span class="cq-pin-sep"></span>'+sid.slice(3).split('').map(mk).join('');
}

async function cqCopyLink(){
  if(!_phoneQrUrl){showToast('Aguarde o código ser gerado');return;}
  const btn=$('cq-copy-btn');
  const orig=btn?.innerHTML;
  try{
    await navigator.clipboard.writeText(_phoneQrUrl);
    if(btn){
      btn.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copiado!';
      btn.style.background='#16A34A';
      setTimeout(()=>{btn.innerHTML=orig;btn.style.background='';},2000);
    }
  }catch(e){showToast(_phoneQrUrl);}
}

async function _cqRenderQR(url){
  const c=$('cq-qr-canvas'),i=$('cq-qr-img');
  const opt=$('cq-qr-option'), div=$('cq-conn-or');
  let ok=false;

  if(window.QRCode&&c){
    try{await QRCode.toCanvas(c,url,{width:140,margin:1,color:{dark:'#111',light:'#fff'}});c.style.display='block';if(i)i.style.display='none';ok=true;}catch(e){}
  }
  if(!ok&&i){
    i.onload=()=>{if(opt)opt.style.display='block';if(div)div.style.display='flex';};
    i.onerror=()=>{};
    i.src=`https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=6&data=${encodeURIComponent(url)}`;
    i.style.display='block';if(c)c.style.display='none';
    return;
  }
  if(ok){if(opt)opt.style.display='block';if(div)div.style.display='flex';}
}

function _cqFlipConnected(){
  const w=$('cq-state-waiting'),c=$('cq-state-connected');
  if(w){w.style.transition='opacity .22s';w.style.opacity='0';setTimeout(()=>{w.style.display='none';},230);}
  if(c){c.style.display='flex';requestAnimationFrame(()=>c.classList.add('visible'));}
}

function _cqOnScan(code){
  if(_cqScanCooldown)return;
  _cqScanCooldown=true;
  playBeep('scan');
  const clean=code.replace(/\D/g,'');
  const prod=DB.prods.find(p=>p.bc&&p.bc.replace(/\D/g,'')=== clean);
  if(prod)cqShowProduct(prod);
  else{showToast('Código não cadastrado: '+clean);if($('cq-search')){$('cq-search').value=clean;cqSearch();}}
  setTimeout(()=>{_cqScanCooldown=false;},2000);
}

function cqSearch(){
  const q=($('cq-search')?.value||'').trim();
  if($('cq-clear'))$('cq-clear').style.display=q?'flex':'none';
  if(!q){if($('cq-search-results'))$('cq-search-results').style.display='none';return;}
  const ql=q.toLowerCase();
  const res=DB.prods.filter(p=>p.nm.toLowerCase().includes(ql)||(p.bc||'').includes(q)||(p.cat||'').toLowerCase().includes(ql)).slice(0,10);
  const el=$('cq-search-results');if(!el)return;
  el.innerHTML=!res.length
    ?`<div class="cq-no-results">Nenhum resultado para "<strong>${q}</strong>"</div>`
    :res.map(p=>`<div class="cq-rr" onclick="cqShowProduct(DB.prods.find(x=>x.id===${p.id}))">
        <span class="cq-rr-em">${p.em||'📦'}</span>
        <div class="cq-rr-info">
          <span class="cq-rr-nm">${p.nm}</span>
          <span class="cq-rr-pr">${brl(p.pd??p.pr)}${p.pd?` <del style="opacity:.4;font-size:11px">${brl(p.pr)}</del>`:''}</span>
        </div>
        <span class="cq-rr-st${p.st===0?' zero':p.st<=3?' low':''}">${p.st} un.</span></div>`).join('');
  el.style.display='block';
  if($('cq-product-card'))$('cq-product-card').style.display='none';
  if($('cq-placeholder'))$('cq-placeholder').style.display='none';
}
function cqClearSearch(){if($('cq-search'))$('cq-search').value='';if($('cq-clear'))$('cq-clear').style.display='none';if($('cq-search-results'))$('cq-search-results').style.display='none';}

function cqShowProduct(p){
  if(!p)return;
  if($('cq-search-results'))$('cq-search-results').style.display='none';
  if($('cq-placeholder'))$('cq-placeholder').style.display='none';
  const el=$('cq-product-card');if(!el)return;

  /* ── Estoque ── */
  const stColor = p.st===0?'var(--err)':p.st<=3?'#D97706':'var(--ok)';
  const stLabel = p.st===0?'Sem estoque':p.st<=3?'Estoque baixo':'Disponível';
  const stPct   = Math.min(100, Math.round((p.st/Math.max(p.st,20))*100));

  /* ── Preço ── */
  const hasDisc  = p.pd!=null && p.pd<p.pr;
  const savings  = hasDisc ? p.pr-p.pd : 0;
  const discPct  = hasDisc ? Math.round((savings/p.pr)*100) : 0;

  /* ── Histórico de vendas ── */
  const peds = (DB.peds||[]).filter(o=>o.itens?.some(i=>i.pid===p.id));
  const totalSold = peds.reduce((acc,o)=>{const i=o.itens?.find(x=>x.pid===p.id);return acc+(i?i.q:0);},0);
  const totalRev  = peds.reduce((acc,o)=>{const i=o.itens?.find(x=>x.pid===p.id);return acc+(i?i.sub:0);},0);
  const lastPed   = peds.length ? [...peds].sort((a,b)=>b.dt.localeCompare(a.dt))[0] : null;
  const lastDate  = lastPed ? lastPed.dt.split('-').reverse().join('/') : null;

  /* ── Thumb ── */
  const thumb = p.img
    ? `<img src="${p.img}" class="cq-v2-img" alt="">`
    : `<div class="cq-v2-em">${p.em||'📦'}</div>`;

  /* ── Badges ── */
  const bgs=[];
  if(p.dt==='sale') bgs.push(`<span class="cq-badge cq-bdg-sale">Promoção</span>`);
  if(p.dt==='new')  bgs.push(`<span class="cq-badge cq-bdg-new">Novo</span>`);
  if(p.st===0)      bgs.push(`<span class="cq-badge cq-bdg-out">Sem estoque</span>`);
  else if(p.st<=3)  bgs.push(`<span class="cq-badge cq-bdg-low">Baixo estoque</span>`);

  el.innerHTML=`
  <div class="cq-v2">

    <!-- Hero -->
    <div class="cq-v2-hero">
      ${thumb}
      <div class="cq-v2-hero-body">
        ${bgs.length?`<div class="cq-v2-badges">${bgs.join('')}</div>`:''}
        <div class="cq-v2-name">${p.em?p.em+' ':''}${p.nm}</div>
        ${p.cat?`<div class="cq-v2-cat">${cNm?.[p.cat]||p.cat}</div>`:''}
        <div class="cq-v2-price-row">
          <span class="cq-v2-price">${brl(p.pd??p.pr)}</span>
          ${hasDisc?`<del class="cq-v2-price-old">${brl(p.pr)}</del><span class="cq-v2-disc">-${discPct}%</span>`:''}
        </div>
        ${hasDisc?`<div class="cq-v2-savings">Economia de ${brl(savings)}</div>`:''}
      </div>
    </div>

    <!-- Grade de dados -->
    <div class="cq-v2-grid">

      <div class="cq-v2-block">
        <div class="cq-v2-block-label">Estoque</div>
        <div class="cq-v2-stock-bar-bg"><div class="cq-v2-stock-bar" style="width:${stPct}%;background:${stColor}"></div></div>
        <div class="cq-v2-stock-txt" style="color:${stColor}"><strong>${p.st} unidades</strong> · ${stLabel}</div>
      </div>

      <div class="cq-v2-block">
        <div class="cq-v2-block-label">Preços</div>
        <div class="cq-v2-price-table">
          <div class="cq-v2-pt-row"><span>Preço normal</span><span>${brl(p.pr)}</span></div>
          ${hasDisc?`<div class="cq-v2-pt-row cq-v2-pt-promo"><span>Promoção</span><span>${brl(p.pd)}</span></div>`:''}
          ${p.bump!=null?`<div class="cq-v2-pt-row"><span>Order bump</span><span>${brl(p.bump)}</span></div>`:''}
        </div>
      </div>

      <div class="cq-v2-block">
        <div class="cq-v2-block-label">Vendas</div>
        <div class="cq-v2-stat-row">
          <div class="cq-v2-stat"><div class="cq-v2-stat-val">${totalSold}</div><div class="cq-v2-stat-lbl">un. vendidas</div></div>
          <div class="cq-v2-stat"><div class="cq-v2-stat-val">${totalRev>0?brl(totalRev):'—'}</div><div class="cq-v2-stat-lbl">faturado</div></div>
          <div class="cq-v2-stat"><div class="cq-v2-stat-val">${lastDate||'—'}</div><div class="cq-v2-stat-lbl">última venda</div></div>
        </div>
      </div>

      ${p.bc?`
      <div class="cq-v2-block">
        <div class="cq-v2-block-label">Código de barras</div>
        <div class="cq-v2-bc">${p.bc}</div>
      </div>`:''}

    </div>

    ${p.desc?`<div class="cq-v2-section"><div class="cq-v2-block-label">Descrição</div><p class="cq-v2-desc">${p.desc}</p></div>`:''}
    ${p.feats?.length?`<div class="cq-v2-section"><div class="cq-v2-block-label">Características</div><div class="cq-v2-feats">${p.feats.map(f=>`<span class="cq-feat">${f}</span>`).join('')}</div></div>`:''}

    <!-- Ações -->
    <div class="cq-v2-actions">
      <button class="btn btn-outline cq-act-btn" onclick="cqEdit(${p.id})">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Editar produto
      </button>
      <button class="btn btn-primary cq-act-btn" onclick="cqSell(${p.id})"${p.st===0?' disabled':''}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>Vender agora
      </button>
    </div>

  </div>`;
  el.style.display='block';
}
function cqEdit(id){_cqStopCamera();setTimeout(()=>editP(id),80);}
function cqSell(id){const p=DB.prods.find(x=>x.id===id);if(!p)return;_cqStopCamera();const mob=window.innerWidth<=768;setTimeout(()=>{if(mob)mobNav('nvenda');else epage('nvenda',null);setTimeout(()=>{const vp=$('vp');if(vp){vp.value=id;vUpd();nvAddItem();}},150);},80);}
