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
  _phoneSid=[...Array(14)].map(()=>Math.random().toString(36)[2]).join('');
  _phoneConnected=false;
  let base;try{const r=await fetch('http://localhost:3001/api/tunnel');base=(await r.json()).url||null;}catch(e){base=null;}
  if(!base){const h=await _getLocalIP()||location.hostname;base=`https://${h}:${location.port}`;}
  _phoneQrUrl=`${base}/mobile-scan.html?s=${_phoneSid}`;
  await _cqRenderQR(_phoneQrUrl);
  _phoneChannel=window._sbClient.channel(`erp-scan-${_phoneSid}`,{config:{broadcast:{self:false}}});
  _phoneChannel
    .on('broadcast',{event:'phone-connected'},()=>{_phoneConnected=true;_phoneSetStatus('connected','📱 Celular conectado');_cqFlipConnected();})
    .on('broadcast',{event:'barcode'},({payload})=>{if(payload?.code){if($('ep-consulta')?.classList.contains('on'))_cqOnScan(payload.code);else onScanResult(payload.code);}})
    .subscribe();
}

async function _cqRenderQR(url){
  const c=$('cq-qr-canvas'),i=$('cq-qr-img');
  if(window.QRCode&&c){try{await QRCode.toCanvas(c,url,{width:180,margin:1,color:{dark:'#111',light:'#fff'}});c.style.display='block';if(i)i.style.display='none';return;}catch(e){}}
  if(i){i.src=`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(url)}`;i.style.display='block';if(c)c.style.display='none';}
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
  const sc=p.st===0?'var(--err)':p.st<=3?'#D97706':'var(--ok)';
  const sl=p.st===0?'Sem estoque':p.st<=3?`Baixo — ${p.st} un.`:`${p.st} un. em estoque`;
  const thumb=p.img?`<img src="${p.img}" class="cq-pi-img" alt="">`:`<div class="cq-pi-em">${p.em||'📦'}</div>`;
  el.innerHTML=`<div class="cq-prod">
    <div class="cq-prod-top">${thumb}
      <div class="cq-prod-info">
        <div class="cq-prod-nm">${p.nm}</div>
        ${p.cat?`<div class="cq-prod-cat">${p.cat}</div>`:''}
        <div class="cq-prod-price"><span class="cq-price-val">${brl(p.pd??p.pr)}</span>${p.pd?`<del class="cq-price-old">${brl(p.pr)}</del>`:''}</div>
        <div class="cq-prod-stock" style="color:${sc}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          ${sl}</div>
        ${p.bc?`<div class="cq-prod-bc">EAN ${p.bc}</div>`:''}
      </div>
    </div>
    ${p.desc?`<p class="cq-prod-desc">${p.desc}</p>`:''}
    ${p.feats?.length?`<div class="cq-prod-feats">${p.feats.map(f=>`<span class="cq-feat">${f}</span>`).join('')}</div>`:''}
    <div class="cq-prod-actions">
      <button class="btn btn-outline cq-act-btn" onclick="cqEdit(${p.id})">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Editar
      </button>
      <button class="btn btn-primary cq-act-btn" onclick="cqSell(${p.id})"${p.st===0?' disabled':''}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>Vender
      </button>
    </div></div>`;
  el.style.display='block';
}
function cqEdit(id){_cqStopCamera();setTimeout(()=>editP(id),80);}
function cqSell(id){const p=DB.prods.find(x=>x.id===id);if(!p)return;_cqStopCamera();const mob=window.innerWidth<=768;setTimeout(()=>{if(mob)mobNav('nvenda');else epage('nvenda',null);setTimeout(()=>{const vp=$('vp');if(vp){vp.value=id;vUpd();nvAddItem();}},150);},80);}
