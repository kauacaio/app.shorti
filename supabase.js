/* =====================================================
   supabase.js — Cliente Supabase + camada de dados
   Preencha SUPABASE_URL e SUPABASE_ANON_KEY abaixo

   MODO LOCAL: adicione ?local à URL para testar sem
   tocar no banco real. Dados ficam no localStorage.
   Ex: erp.html?local
   ===================================================== */

const SUPABASE_URL      = 'https://aksgxwucgkajznhxyciz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrc2d4d3VjZ2thanpuaHh5Y2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NTIyMjAsImV4cCI6MjA5NDQyODIyMH0.ggBOday3Mktl_Oc5pGG6rs-VG3iwDYc3GWNsGcH__5k';

/* ── Detecta modo local (?local na URL) ────────────── */
const _localMode = new URLSearchParams(location.search).has('local');
window._localMode = _localMode;

// Inicializa o cliente (null se SDK indisponível ou modo local)
let _sbClient = null;
if (!_localMode) {
  try {
    if (typeof supabase !== 'undefined') {
      _sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  } catch(e) {
    console.warn('[supabase.js] Cliente não pôde ser inicializado:', e.message);
  }
}

// Em modo local expõe um objeto sentinela (truthy) para initDB() rodar
window._sbClient = _localMode ? { _local: true } : _sbClient;

/* ── Autenticação ───────────────────────────────────── */
const SBAuth = {
  async signIn(email, password) {
    if (!_sbClient) throw new Error('Supabase não configurado');
    const { data, error } = await _sbClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },
  async signOut() {
    if (!_sbClient) return;
    const { error } = await _sbClient.auth.signOut();
    if (error) throw error;
  },
  async getSession() {
    if (!_sbClient) return null;
    const { data } = await _sbClient.auth.getSession();
    return data?.session ?? null;
  },
  onChange(cb) {
    if (!_sbClient) return { data: { subscription: { unsubscribe: () => {} } } };
    return _sbClient.auth.onAuthStateChange(cb);
  }
};

/* ── Produtos ───────────────────────────────────────── */
const SBProds = {
  async list() {
    const { data, error } = await _sbClient.from('products').select('*').order('id');
    if (error) throw error;
    return data.map(_rowToProduct);
  },
  async upsert(p) {
    const { error } = await _sbClient.from('products').upsert(_productToRow(p));
    if (error) throw error;
  },
  async delete(id) {
    const { error } = await _sbClient.from('products').delete().eq('id', id);
    if (error) throw error;
  },
  async updateStock(id, st) {
    const { error } = await _sbClient.from('products').update({ st }).eq('id', id);
    if (error) throw error;
  }
};

/* ── Clientes ───────────────────────────────────────── */
const SBClis = {
  async list() {
    const { data, error } = await _sbClient.from('clients').select('*').order('id');
    if (error) throw error;
    return data.map(_rowToClient);
  },
  async upsert(c) {
    const { error } = await _sbClient.from('clients').upsert(_clientToRow(c));
    if (error) throw error;
  },
  async update(id, patch) {
    const { error } = await _sbClient.from('clients').update(patch).eq('id', id);
    if (error) throw error;
  }
};

/* ── Pedidos ────────────────────────────────────────── */
const SBPeds = {
  async list() {
    const { data, error } = await _sbClient.from('orders').select('*').order('id');
    if (error) throw error;
    return data.map(_rowToOrder);
  },
  async upsert(ped) {
    const { error } = await _sbClient.from('orders').upsert(_orderToRow(ped));
    if (error) throw error;
  },
  async updateStatus(id, st) {
    const { error } = await _sbClient.from('orders').update({ st }).eq('id', id);
    if (error) throw error;
  }
};

/* ── Transações ─────────────────────────────────────── */
const SBTrans = {
  async list() {
    const { data, error } = await _sbClient.from('transactions').select('*').order('id');
    if (error) throw error;
    return data.map(_rowToTrans);
  },
  async upsert(t) {
    const { error } = await _sbClient.from('transactions').upsert(_transToRow(t));
    if (error) throw error;
  }
};

/* ── Solicitações ───────────────────────────────────── */
const SBSolics = {
  async list() {
    const { data, error } = await _sbClient.from('solicitacoes').select('*').order('id');
    if (error) throw error;
    return data.map(_rowToSolic);
  },
  async upsert(s) {
    const { error } = await _sbClient.from('solicitacoes').upsert(_solicToRow(s));
    if (error) throw error;
  },
  async delete(id) {
    const { error } = await _sbClient.from('solicitacoes').delete().eq('id', id);
    if (error) throw error;
  },
  async updateStatus(id, st) {
    const { error } = await _sbClient.from('solicitacoes').update({ st }).eq('id', id);
    if (error) throw error;
  }
};

/* ── Configurações ──────────────────────────────────── */
const SBSettings = {
  async get() {
    const { data, error } = await _sbClient.from('store_settings').select('data').eq('id', 1).single();
    if (error) throw error;
    return data?.data ?? null;
  },
  async set(settings) {
    const { error } = await _sbClient.from('store_settings')
      .upsert({ id: 1, data: settings, updated_at: new Date().toISOString() });
    if (error) throw error;
  }
};

/* ── Mapeamento rows ↔ objetos JS ───────────────────── */
function _rowToProduct(r) {
  return {
    id: r.id, em: r.em, nm: r.nm, cat: r.cat,
    pr: Number(r.pr), pd: r.pd != null ? Number(r.pd) : null,
    st: r.st, dt: r.dt || '', img: r.img || '',
    bump: r.bump ?? null,
    desc:  r.description || '',
    feats: r.feats || [],
    bc: r.bc || null,
  };
}

function _productToRow(p) {
  return {
    id: p.id, em: p.em, nm: p.nm, cat: p.cat,
    pr: p.pr, pd: p.pd ?? null,
    st: p.st, dt: p.dt || '', img: p.img || '',
    bump: p.bump ?? null,
    description: p.desc || '',
    feats: p.feats || [],
    bc: p.bc || null,
  };
}

function _rowToClient(r) {
  return {
    id: r.id, nm: r.nm, tel: r.tel || '', em: r.em || '',
    ci: r.ci || '', es: r.es || '',
    an: r.an || '', pe: r.pe || 'Normal',
    gasto: Number(r.gasto || 0),
    ult: r.ult || ''
  };
}

function _clientToRow(c) {
  return {
    id: c.id, nm: c.nm, tel: c.tel, em: c.em,
    ci: c.ci, es: c.es,
    an: c.an || null, pe: c.pe,
    gasto: c.gasto || 0,
    ult: c.ult || null
  };
}

function _rowToOrder(r) {
  return {
    id: r.id, cid: r.cid, prod: r.prod, q: r.q,
    tot: Number(r.tot), pag: r.pag,
    parc: r.parc || 1,
    dtpag: r.dtpag || r.dt,
    itens: r.itens || null,
    st: r.st, dt: r.dt
  };
}

function _orderToRow(ped) {
  return {
    id: ped.id, cid: ped.cid, prod: ped.prod, q: ped.q,
    tot: ped.tot, pag: ped.pag,
    parc: ped.parc || 1,
    dtpag: ped.dtpag || ped.dt,
    itens: ped.itens || null,
    st: ped.st, dt: ped.dt
  };
}

function _rowToTrans(r) {
  return { id: r.id, tp: r.tp, ds: r.ds, vl: Number(r.vl), dt: r.dt };
}

function _transToRow(t) {
  return { id: t.id, tp: t.tp, ds: t.ds, vl: t.vl, dt: t.dt };
}

function _rowToSolic(r) {
  return { id: r.id, nm: r.nm, q: r.q, pr: r.pr != null ? Number(r.pr) : null, obs: r.obs || '', st: r.st, dt: r.dt };
}

function _solicToRow(s) {
  return { id: s.id, nm: s.nm, q: s.q, pr: s.pr ?? null, obs: s.obs || '', st: s.st, dt: s.dt };
}

/* ── Modo local: substitui Supabase por localStorage ── */
if (_localMode) {

  /* Helpers de persistência */
  const _LS = {
    get(k, def = []) {
      try { return JSON.parse(localStorage.getItem('mlb_local_' + k)) ?? def; } catch { return def; }
    },
    set(k, v) { localStorage.setItem('mlb_local_' + k, JSON.stringify(v)); },
    upsert(k, item, mapFn) {
      const arr = _LS.get(k);
      const i = arr.findIndex(x => x.id === item.id);
      if (i >= 0) arr[i] = item; else arr.push(item);
      _LS.set(k, arr);
    },
    del(k, id) { _LS.set(k, _LS.get(k).filter(x => x.id !== id)); },
  };

  /* Produtos */
  SBProds.list        = async () => _LS.get('prods').map(_rowToProduct);
  SBProds.upsert      = async p  => _LS.upsert('prods', _productToRow(p));
  SBProds.delete      = async id => _LS.del('prods', id);
  SBProds.updateStock = async (id, st) => {
    const rows = _LS.get('prods');
    const r = rows.find(x => x.id === id);
    if (r) { r.st = st; _LS.set('prods', rows); }
  };

  /* Clientes */
  SBClis.list   = async () => _LS.get('clis').map(_rowToClient);
  SBClis.upsert = async c  => _LS.upsert('clis', _clientToRow(c));
  SBClis.delete = async id => _LS.del('clis', id);

  /* Pedidos */
  SBPeds.list   = async () => _LS.get('peds').map(_rowToOrder);
  SBPeds.upsert = async p  => _LS.upsert('peds', _orderToRow(p));
  SBPeds.delete = async id => _LS.del('peds', id);

  /* Transações */
  SBTrans.list   = async () => _LS.get('trans').map(_rowToTrans);
  SBTrans.upsert = async t  => _LS.upsert('trans', _transToRow(t));
  SBTrans.delete = async id => _LS.del('trans', id);

  /* Solicitações */
  SBSolics.list         = async () => _LS.get('solics').map(_rowToSolic);
  SBSolics.upsert       = async s  => _LS.upsert('solics', _solicToRow(s));
  SBSolics.delete       = async id => _LS.del('solics', id);
  SBSolics.updateStatus = async (id, st) => {
    const rows = _LS.get('solics');
    const r = rows.find(x => x.id === id);
    if (r) { r.st = st; _LS.set('solics', rows); }
  };

  /* Configurações */
  SBSettings.get = async () => { const s = _LS.get('settings', null); return s ? s.data : null; };
  SBSettings.set = async s  => _LS.set('settings', { data: s });

  /* Auth — sessão local sempre válida */
  SBAuth.getSession = async () => ({ user: { email: 'local@teste.dev' } });
  SBAuth.signOut    = async () => {
    if (confirm('Sair do modo local?')) window.location.replace('login.html');
  };
  SBAuth.onChange = () => ({ data: { subscription: { unsubscribe: () => {} } } });

  /* Badge visual "MODO LOCAL" */
  document.addEventListener('DOMContentLoaded', () => {
    const b = document.createElement('div');
    b.id = 'local-mode-badge';
    b.title = 'Modo local ativo — dados salvos no localStorage, sem sincronizar com o banco real';
    b.innerHTML = '🧪 LOCAL';
    b.style.cssText = [
      'position:fixed', 'bottom:72px', 'right:12px', 'z-index:9999',
      'background:#F59E0B', 'color:#fff', 'font-size:11px', 'font-weight:700',
      'padding:5px 10px', 'border-radius:8px', 'letter-spacing:.04em',
      'box-shadow:0 2px 8px rgba(0,0,0,.18)', 'cursor:default',
      'font-family:Inter,system-ui,sans-serif',
    ].join(';');
    document.body.appendChild(b);

    /* Botão de reset dos dados locais */
    b.addEventListener('click', () => {
      if (confirm('Limpar todos os dados do modo local?')) {
        ['prods','clis','peds','trans','solics','settings'].forEach(k =>
          localStorage.removeItem('mlb_local_' + k)
        );
        location.reload();
      }
    });
  });
}
