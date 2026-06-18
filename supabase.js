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
      _sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession:    true,
          autoRefreshToken:  true,
          detectSessionInUrl: true,
          storageKey:        'srt-auth-v1',
        }
      });

      // PWA: quando o app volta ao foco, força o refresh do token
      // (o auto-refresh para quando o app fica em background)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          _sbClient.auth.startAutoRefresh();
        } else {
          _sbClient.auth.stopAutoRefresh();
        }
      });
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
  async refreshSession() {
    if (!_sbClient) return null;
    const { data } = await _sbClient.auth.refreshSession();
    return data?.session ?? null;
  },
  onChange(cb) {
    if (!_sbClient) return { data: { subscription: { unsubscribe: () => {} } } };
    return _sbClient.auth.onAuthStateChange(cb);
  },

  /* ── MFA (TOTP) ── usado pelo painel GrupoLima para exigir 2FA ── */
  async mfaLevel() {
    const { data, error } = await _sbClient.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    return data; // { currentLevel, nextLevel, currentAuthenticationMethods }
  },
  async mfaListFactors() {
    const { data, error } = await _sbClient.auth.mfa.listFactors();
    if (error) throw error;
    return data; // { all, totp, phone }
  },
  async mfaEnroll() {
    const { data, error } = await _sbClient.auth.mfa.enroll({ factorType: 'totp', issuer: 'Shorti' });
    if (error) throw error;
    return data; // { id, totp: { qr_code, secret, uri } }
  },
  async mfaChallenge(factorId) {
    const { data, error } = await _sbClient.auth.mfa.challenge({ factorId });
    if (error) throw error;
    return data; // { id }
  },
  async mfaVerify(factorId, challengeId, code) {
    const { data, error } = await _sbClient.auth.mfa.verify({ factorId, challengeId, code });
    if (error) throw error;
    return data;
  },
  async mfaUnenroll(factorId) {
    const { error } = await _sbClient.auth.mfa.unenroll({ factorId });
    if (error) throw error;
  },
  async resetPassword(email, redirectTo) {
    if (!_sbClient) throw new Error('Supabase não configurado');
    const { error } = await _sbClient.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  },
  async updatePassword(newPassword) {
    if (!_sbClient) throw new Error('Supabase não configurado');
    const { error } = await _sbClient.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },
  async updateProfile(data) {
    if (!_sbClient) throw new Error('Supabase não configurado');
    const { error } = await _sbClient.auth.updateUser({ data });
    if (error) throw error;
  },
  onAuthChange(cb) {
    if (!_sbClient) return;
    _sbClient.auth.onAuthStateChange((event) => cb(event));
  }
};

/* ── Tenants ────────────────────────────────────────── */
const Tenants = {
  async getByOwner() {
    const { data: sess } = await _sbClient.auth.getSession();
    const uid = sess?.session?.user?.id;
    if (!uid) return null;
    const { data, error } = await _sbClient.from('tenants')
      .select('id,slug,nome').eq('owner_user_id', uid).maybeSingle();
    if (error) throw error;
    return data;
  },
  /* Resolve tenant pelo usuário logado: owner OU membro */
  async getForUser() {
    const { data: sess } = await _sbClient.auth.getSession();
    const uid = sess?.session?.user?.id;
    if (!uid) return null;
    /* 1. owner direto */
    const { data: owned } = await _sbClient.from('tenants')
      .select('id,slug,nome').eq('owner_user_id', uid).maybeSingle();
    if (owned) return { ...owned, role: 'admin' };
    /* 2. membro — tabela pode não existir ainda (migration_team.sql pendente) */
    try {
      const { data: mem } = await _sbClient.from('tenant_members')
        .select('role, nome, tenants(id,slug,nome)')
        .eq('user_id', uid).maybeSingle();
      if (mem?.tenants) return { ...mem.tenants, role: mem.role, memberNome: mem.nome };
    } catch(e) {}
    return null;
  },
  async getBySlug(slug) {
    const { data, error } = await _sbClient.from('tenants')
      .select('id,slug,nome').eq('slug', slug).maybeSingle();
    if (error) throw error;
    return data;
  },
  async create({ slug, nome }) {
    const { data: sess } = await _sbClient.auth.getSession();
    const uid = sess?.session?.user?.id;
    if (!uid) throw new Error('Sessão inválida');
    const { data, error } = await _sbClient.from('tenants')
      .insert({ slug, nome, owner_user_id: uid })
      .select('id,slug,nome').single();
    if (error) throw error;
    return data;
  },
  async isAdmin() {
    const { data, error } = await _sbClient.rpc('is_grupolima_admin');
    if (error) { console.warn('[isAdmin]', error.message); return false; }
    return !!data;
  },
  async pingActivity() {
    const { error } = await _sbClient.rpc('ping_tenant_activity');
    if (error) throw error;
  }
};

/* ── Painel GrupoLima (admin) ────────────────────────── */
const SBAdmin = {
  async listTenants() {
    const { data, error } = await _sbClient.from('admin_tenant_overview')
      .select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  async invite({ email, nome }) {
    const { data: sess } = await _sbClient.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) throw new Error('Sessão inválida');
    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-invite-tenant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email, nome })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.ok === false) throw new Error(body.error || 'Erro ao convidar');
    return body;
  }
};

/* ── IDs sequenciais (V6 — alocação atômica por tenant) ──
   Pede ao Postgres o próximo id da tabela via next_id(),
   evitando que dois dispositivos calculem o mesmo
   max(id)+1 e se sobrescrevam num upsert. */
const SBIds = {
  async next(table) {
    const { data, error } = await _sbClient.rpc('next_id', { p_name: table });
    if (error) throw error;
    return data;
  }
};

/* ── Produtos ───────────────────────────────────────── */
const SBProds = {
  async list(tenantId) {
    let q = _sbClient.from('products').select('*').order('id');
    if (tenantId) q = q.eq('tenant_id', tenantId);
    const { data, error } = await q;
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
  async list(tenantId) {
    let q = _sbClient.from('clients').select('*').order('id');
    if (tenantId) q = q.eq('tenant_id', tenantId);
    const { data, error } = await q;
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
  async list(tenantId) {
    let q = _sbClient.from('orders').select('*').order('id');
    if (tenantId) q = q.eq('tenant_id', tenantId);
    const { data, error } = await q;
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

/* ── Pedidos vindos da loja (visitante anônimo) ──────── */
const SBStorefront = {
  async createOrder({ slug, nome, tel, itens }) {
    const { data, error } = await _sbClient.rpc('create_storefront_order', {
      p_slug: slug, p_nome: nome, p_tel: tel, p_itens: itens
    });
    if (error) throw error;
    return data?.[0] || null;
  },
  /* Configurações públicas da loja (sem pix/pixVerified) — anon não tem
     mais select direto em store_settings, só via esta RPC. */
  async getSettings(slug) {
    const { data, error } = await _sbClient.rpc('get_storefront_settings', { p_slug: slug });
    if (error) throw error;
    return data;
  }
};

/* ── Transações ─────────────────────────────────────── */
const SBTrans = {
  async list(tenantId) {
    let q = _sbClient.from('transactions').select('*').order('id');
    if (tenantId) q = q.eq('tenant_id', tenantId);
    const { data, error } = await q;
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
  async list(tenantId) {
    let q = _sbClient.from('solicitacoes').select('*').order('id');
    if (tenantId) q = q.eq('tenant_id', tenantId);
    const { data, error } = await q;
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

/* ── Notificações ───────────────────────────────────── */
const SBNotifs = {
  async list(tenantId) {
    let q = _sbClient.from('notifications').select('*').order('id');
    if (tenantId) q = q.eq('tenant_id', tenantId);
    const { data, error } = await q;
    if (error) throw error;
    return data.map(_rowToNotif);
  },
  async upsert(n) {
    const { error } = await _sbClient.from('notifications').upsert(_notifToRow(n));
    if (error) throw error;
  },
  async delete(id) {
    const { error } = await _sbClient.from('notifications').delete().eq('id', id);
    if (error) throw error;
  }
};

/* ── Configurações ──────────────────────────────────── */
const SBSettings = {
  async get(tenantId) {
    let q = _sbClient.from('store_settings').select('data');
    if (tenantId) q = q.eq('tenant_id', tenantId);
    const { data, error } = await q.single();
    if (error) throw error;
    return data?.data ?? null;
  },
  async set(settings, tenantId) {
    const row = { data: settings, updated_at: new Date().toISOString() };
    if (tenantId) row.tenant_id = tenantId;
    const { error } = await _sbClient.from('store_settings').upsert(row);
    if (error) throw error;
  }
};

/* ── Equipe (tenant_members) ────────────────────────── */
const SBTeam = {
  async list(tenantId) {
    if (!_sbClient || !tenantId) return [];
    const { data, error } = await _sbClient
      .from('tenant_members')
      .select('id, user_id, role, nome, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at');
    if (error) throw error;
    return data || [];
  },
  async invite({ email, nome, role, tenantId }) {
    if (!_sbClient) throw new Error('Supabase não configurado');
    const { data: sess } = await _sbClient.auth.getSession();
    const jwt = sess?.session?.access_token;
    if (!jwt) throw new Error('Sessão inválida');
    const res = await fetch(`${_sbClient.supabaseUrl}/functions/v1/tenant-invite-member`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, nome, role }),
    });
    const body = await res.json();
    if (!body.ok) throw new Error(body.error || 'Erro ao convidar');
    return body;
  },
  async remove(memberId, tenantId) {
    if (!_sbClient) throw new Error('Supabase não configurado');
    const { error } = await _sbClient
      .from('tenant_members')
      .delete()
      .eq('id', memberId)
      .eq('tenant_id', tenantId);
    if (error) throw error;
  },
  async updateRole(memberId, tenantId, role) {
    if (!_sbClient) throw new Error('Supabase não configurado');
    const { error } = await _sbClient
      .from('tenant_members')
      .update({ role })
      .eq('id', memberId)
      .eq('tenant_id', tenantId);
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

function _rowToNotif(r) {
  return { id: r.id, key: r.key, type: r.type, icon: r.icon, title: r.title, msg: r.msg, link: r.link || '', read: !!r.read, dt: r.dt };
}

function _notifToRow(n) {
  return { id: n.id, key: n.key, type: n.type, icon: n.icon, title: n.title, msg: n.msg, link: n.link || '', read: !!n.read, dt: n.dt };
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

  /* ── Conta de testes: dados de demonstração na primeira visita ── */
  if (!localStorage.getItem('mlb_local_seeded')) {
    _LS.set('prods', [
      { id: 1,  em: '💧', nm: 'Sérum Vitamina C',            cat: 'pele',        pr: 189.90, pd: 159.90, st: 42, dt: 'sale', img: '', bump: 13, description: 'Sérum facial com vitamina C para uniformizar o tom da pele.', feats: ['Vitamina C', 'Anti-manchas', 'FPS 30'], bc: '7891234567890' },
      { id: 2,  em: '🧴', nm: 'Hidratante Corporal',          cat: 'corpo',       pr: 79.90,  pd: null,   st: 28, dt: '',     img: '', bump: null, description: 'Hidratante corporal de absorção rápida, toque seco.', feats: ['Hidratação 24h', 'Toque seco'], bc: '7896543210987' },
      { id: 3,  em: '💋', nm: 'Batom Matte',                  cat: 'maquiagem',   pr: 59.90,  pd: null,   st: 3,  dt: 'new',  img: '', bump: null, description: 'Batom matte de alta cobertura e longa duração.', feats: ['Longa duração', 'Acabamento matte'], bc: '7894561237890' },
      { id: 4,  em: '🧼', nm: 'Sabonete Facial',              cat: 'pele',        pr: 39.90,  pd: null,   st: 0,  dt: '',     img: '', bump: null, description: 'Sabonete facial para todos os tipos de pele.', feats: ['Limpeza profunda', 'pH balanceado'], bc: '7891112223334' },
      { id: 5,  em: '🌸', nm: 'Perfume Floral 75ml',          cat: 'fragrancias', pr: 149.90, pd: 129.90, st: 15, dt: 'sale', img: '', bump: null, description: 'Fragrância floral de longa fixação.', feats: ['Floral', 'Longa fixação'], bc: '7895556667778' },
      { id: 6,  em: '💄', nm: 'Base Líquida FPS 15',          cat: 'maquiagem',   pr: 99.90,  pd: null,   st: 18, dt: '',     img: '', bump: null, description: 'Base de cobertura média com proteção solar.', feats: ['Cobertura média', 'FPS 15'], bc: '7893334445556' },
      { id: 7,  em: '✨', nm: 'Máscara de Cílios',            cat: 'maquiagem',   pr: 69.90,  pd: null,   st: 22, dt: 'new',  img: '', bump: null, description: 'Máscara de cílios com efeito volume.', feats: ['Efeito volume', 'Longa duração'], bc: '7897778889990' },
      { id: 8,  em: '🧖', nm: 'Creme Anti-idade Noturno',     cat: 'pele',        pr: 219.90, pd: null,   st: 9,  dt: '',     img: '', bump: null, description: 'Creme noturno com ação anti-idade.', feats: ['Ação noturna', 'Anti-idade'], bc: '7892223334445' },
      { id: 9,  em: '🧽', nm: 'Esfoliante Corporal',          cat: 'corpo',       pr: 69.90,  pd: null,   st: 31, dt: '',     img: '', bump: null, description: 'Esfoliante corporal para pele macia.', feats: ['Esfoliação suave', 'Pele macia'], bc: '7894445556667' },
      { id: 10, em: '🌿', nm: 'Óleo Corporal Relaxante',      cat: 'corpo',       pr: 89.90,  pd: null,   st: 14, dt: '',     img: '', bump: null, description: 'Óleo corporal com aroma relaxante.', feats: ['Aroma relaxante', 'Hidratação profunda'], bc: '7896667778889' },
      { id: 11, em: '🌺', nm: 'Perfume Amadeirado 50ml',      cat: 'fragrancias', pr: 139.90, pd: null,   st: 7,  dt: '',     img: '', bump: null, description: 'Fragrância amadeirada para o dia a dia.', feats: ['Amadeirado', 'Versátil'], bc: '7891231231230' },
      { id: 12, em: '💅', nm: 'Kit Pincéis de Maquiagem',     cat: 'maquiagem',   pr: 119.90, pd: 99.90,  st: 11, dt: 'sale', img: '', bump: null, description: 'Kit com pincéis essenciais para maquiagem.', feats: ['5 peças', 'Cerdas macias'], bc: '7894564564560' },
      { id: 13, em: '🩹', nm: 'Protetor Solar Facial FPS 50', cat: 'pele',        pr: 99.90,  pd: null,   st: 2,  dt: '',     img: '', bump: null, description: 'Protetor solar facial de alta proteção.', feats: ['FPS 50', 'Toque seco'], bc: '7897897897890' },
    ]);

    _LS.set('clis', [
      { id: 1, nm: 'Camila Souza',   tel: '11987654321', em: 'camila.souza@email.com',   ci: 'São Paulo',  es: 'SP', an: '1990-04-12', pe: 'Mista',     gasto: 379.60, ult: '2026-06-10' },
      { id: 2, nm: 'Patrícia Alves', tel: '11976543210', em: 'patricia.alves@email.com', ci: 'Campinas',   es: 'SP', an: '1985-11-03', pe: 'Seca',      gasto: 359.60, ult: '2026-06-08' },
      { id: 3, nm: 'Juliana Costa',  tel: '11965432109', em: 'juliana.costa@email.com',  ci: 'Guarulhos',  es: 'SP', an: '1993-07-22', pe: 'Oleosa',    gasto: 269.70, ult: '2026-06-04' },
      { id: 4, nm: 'Fernanda Lima',  tel: '11954321098', em: 'fernanda.lima@email.com',  ci: 'São Paulo',  es: 'SP', an: '1988-02-15', pe: 'Normal',    gasto: 429.70, ult: '2026-06-11' },
      { id: 5, nm: 'Bruna Ferreira', tel: '11943210987', em: 'bruna.ferreira@email.com', ci: 'Osasco',     es: 'SP', an: '1995-09-30', pe: 'Sensível',  gasto: 219.90, ult: '2026-05-20' },
    ]);

    _LS.set('peds', [
      { id: 2001, cid: 1, prod: '2 produtos',                  q: 2, tot: 219.80, pag: 'PIX',               parc: 1, dtpag: '2026-06-09', st: 'Entregue',  dt: '2026-06-09',
        itens: [{ pid: 1,  nm: 'Sérum Vitamina C',  em: '💧', q: 1, pr: 159.90, sub: 159.90 }, { pid: 3, nm: 'Batom Matte', em: '💋', q: 1, pr: 59.90, sub: 59.90 }] },
      { id: 2002, cid: 2, prod: 'Hidratante Corporal',         q: 2, tot: 159.80, pag: 'Cartão de Crédito', parc: 2, dtpag: '2026-06-06', st: 'Enviado',   dt: '2026-06-06',
        itens: [{ pid: 2,  nm: 'Hidratante Corporal', em: '🧴', q: 2, pr: 79.90, sub: 159.80 }] },
      { id: 2003, cid: 3, prod: '3 produtos',                  q: 3, tot: 269.70, pag: 'Fiado',             parc: 1, dtpag: '2026-06-20', st: 'Pendente',  dt: '2026-06-04',
        itens: [{ pid: 6, nm: 'Base Líquida FPS 15', em: '💄', q: 1, pr: 99.90, sub: 99.90 }, { pid: 7, nm: 'Máscara de Cílios', em: '✨', q: 1, pr: 69.90, sub: 69.90 }, { pid: 12, nm: 'Kit Pincéis de Maquiagem', em: '💅', q: 1, pr: 99.90, sub: 99.90 }] },
      { id: 2004, cid: 4, prod: 'Perfume Floral 75ml',         q: 1, tot: 129.90, pag: 'Dinheiro',          parc: 1, dtpag: '2026-05-28', st: 'Entregue',  dt: '2026-05-28',
        itens: [{ pid: 5, nm: 'Perfume Floral 75ml', em: '🌸', q: 1, pr: 129.90, sub: 129.90 }] },
      { id: 2005, cid: 5, prod: 'Creme Anti-idade Noturno',    q: 1, tot: 219.90, pag: 'Fiado',             parc: 1, dtpag: '2026-06-15', st: 'Pendente',  dt: '2026-05-20',
        itens: [{ pid: 8, nm: 'Creme Anti-idade Noturno', em: '🧖', q: 1, pr: 219.90, sub: 219.90 }] },
      { id: 2006, cid: 1, prod: '2 produtos',                  q: 2, tot: 159.80, pag: 'PIX',               parc: 1, dtpag: '2026-06-10', st: 'Confirmado', dt: '2026-06-10',
        itens: [{ pid: 9, nm: 'Esfoliante Corporal', em: '🧽', q: 1, pr: 69.90, sub: 69.90 }, { pid: 10, nm: 'Óleo Corporal Relaxante', em: '🌿', q: 1, pr: 89.90, sub: 89.90 }] },
      { id: 2007, cid: 2, prod: 'Protetor Solar Facial FPS 50', q: 2, tot: 199.80, pag: 'Cartão de Débito', parc: 1, dtpag: '2026-06-08', st: 'Entregue', dt: '2026-06-08',
        itens: [{ pid: 13, nm: 'Protetor Solar Facial FPS 50', em: '🩹', q: 2, pr: 99.90, sub: 199.80 }] },
      { id: 2008, cid: 4, prod: '2 produtos',                  q: 2, tot: 299.80, pag: 'PIX',               parc: 1, dtpag: '2026-06-11', st: 'Confirmado', dt: '2026-06-11',
        itens: [{ pid: 11, nm: 'Perfume Amadeirado 50ml', em: '🌺', q: 1, pr: 139.90, sub: 139.90 }, { pid: 1, nm: 'Sérum Vitamina C', em: '💧', q: 1, pr: 159.90, sub: 159.90 }] },
    ]);

    _LS.set('trans', [
      { id: 3001, tp: 'receita', ds: 'Venda #2001 · Camila Souza',     vl: 219.80, dt: '2026-06-09' },
      { id: 3002, tp: 'receita', ds: 'Venda #2002 · Patrícia Alves',   vl: 159.80, dt: '2026-06-06' },
      { id: 3003, tp: 'despesa', ds: 'Reposição de estoque · Skincare', vl: 480.00, dt: '2026-06-05' },
      { id: 3004, tp: 'receita', ds: 'Venda #2004 · Fernanda Lima',    vl: 129.90, dt: '2026-05-28' },
      { id: 3005, tp: 'despesa', ds: 'Embalagens e etiquetas',         vl: 65.00,  dt: '2026-05-30' },
      { id: 3006, tp: 'receita', ds: 'Venda #2007 · Patrícia Alves',   vl: 199.80, dt: '2026-06-08' },
      { id: 3007, tp: 'receita', ds: 'Venda #2006 · Camila Souza',     vl: 159.80, dt: '2026-06-10' },
      { id: 3008, tp: 'despesa', ds: 'Frete de reposição',             vl: 120.00, dt: '2026-06-02' },
      { id: 3009, tp: 'receita', ds: 'Venda #2008 · Fernanda Lima',    vl: 299.80, dt: '2026-06-11' },
      { id: 3010, tp: 'despesa', ds: 'Compra de novos produtos · Perfumaria', vl: 540.00, dt: '2026-06-01' },
    ]);

    _LS.set('solics', [
      { id: 101, nm: 'Sabonete Facial',              q: 20, pr: 39.90,  obs: 'Estoque zerado, repor com urgência.', st: 'Pendente',   dt: '2026-06-10' },
      { id: 102, nm: 'Protetor Solar Facial FPS 50', q: 15, pr: 99.90,  obs: 'Apenas 2 unidades restantes.',        st: 'Solicitado', dt: '2026-06-08' },
      { id: 103, nm: 'Batom Matte',                  q: 10, pr: 59.90,  obs: '',                                     st: 'Recebido',   dt: '2026-06-01' },
    ]);

    localStorage.setItem('mlb_local_seeded', '1');
  }

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

  /* Pedidos vindos da loja (visitante anônimo) ──
     Espelha a RPC create_storefront_order: recebe só {pid, q} e recalcula
     nome/preço/subtotal a partir do catálogo local — nunca confia em
     valores vindos do cliente. */
  SBStorefront.createOrder = async ({ nome, tel, itens }) => {
    const prods = _LS.get('prods');
    const fullItens = [];
    let tot = 0;
    for (const it of itens) {
      const p = prods.find(x => x.id === it.pid);
      const q = Number(it.q);
      if (!p || !(q > 0)) continue;
      const pr = p.pd != null ? p.pd : p.pr;
      const sub = pr * q;
      tot += sub;
      fullItens.push({ pid: p.id, nm: p.nm, em: p.em, q, pr, sub });
    }
    if (!fullItens.length) throw new Error('Itens inválidos');

    const clis = _LS.get('clis');
    let cli = clis.find(c => c.tel === tel);
    if (cli) {
      cli.nm = nome;
    } else {
      cli = { id: (clis.length ? Math.max(...clis.map(c => c.id)) : 200) + 1, nm: nome, tel, em: '', ci: '', es: '', an: '', pe: 'Normal', gasto: 0, ult: '' };
      clis.push(cli);
    }
    _LS.set('clis', clis);

    const peds = _LS.get('peds');
    const id = (peds.length ? Math.max(...peds.map(p => p.id)) : 2000) + 1;
    const q = fullItens.reduce((a, b) => a + b.q, 0);
    const prod = fullItens.length === 1 ? fullItens[0].nm : `${fullItens.length} produtos`;
    const ped = { id, cid: cli.id, prod, q, tot, pag: 'A combinar', parc: 1, dtpag: td(), itens: fullItens, st: 'Pendente', dt: td() };
    peds.push(ped);
    _LS.set('peds', peds);

    return { order_id: id, client_id: cli.id };
  };
  SBStorefront.getSettings = async () => {
    const s = _LS.get('settings', null);
    if (!s?.data) return null;
    const { pix, pixVerified, ...pub } = s.data;
    return pub;
  };

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

  /* Notificações */
  SBNotifs.list   = async () => _LS.get('notifs').map(_rowToNotif);
  SBNotifs.upsert = async n  => _LS.upsert('notifs', _notifToRow(n));
  SBNotifs.delete = async id => _LS.del('notifs', id);

  /* Configurações */
  SBSettings.get = async () => { const s = _LS.get('settings', null); return s ? s.data : null; };
  SBSettings.set = async s  => _LS.set('settings', { data: s });

  /* Tenants — modo local opera sempre num único tenant fixo */
  Tenants.getByOwner   = async () => ({ id: 'local-tenant', slug: 'local', nome: 'Conta de Testes' });
  Tenants.getBySlug    = async (slug) => ({ id: 'local-tenant', slug, nome: 'Conta de Testes' });
  Tenants.create       = async ({ slug, nome }) => ({ id: 'local-tenant', slug, nome });
  Tenants.isAdmin      = async () => true;
  Tenants.pingActivity = async () => {};

  /* Painel GrupoLima — modo local mostra tenants de exemplo */
  SBAdmin.listTenants = async () => ([
    { id: 'local-tenant', slug: 'milena-lima-beauty', nome: 'Milena Lima Beauty', created_at: '2026-05-02T10:00:00Z', last_active_at: '2026-06-13T18:40:00Z', published: true,  whatsapp: '5511999999999', pix: 'milena@pix.com.br', pix_verified: true,  produtos: 13, clientes: 5, pedidos: 8, faturamento: 1538.40 },
    { id: 'local-tenant-2', slug: 'bella-estetica',     nome: 'Bella Estética',     created_at: '2026-05-20T14:30:00Z', last_active_at: '2026-06-12T09:15:00Z', published: true,  whatsapp: '5511988888888', pix: '',                pix_verified: false, produtos: 7,  clientes: 2, pedidos: 3, faturamento: 420.00 },
    { id: 'local-tenant-3', slug: 'espaco-ana',         nome: 'Espaço Ana',         created_at: '2026-06-10T08:00:00Z', last_active_at: null,                  published: false, whatsapp: '',              pix: '',                pix_verified: false, produtos: 0,  clientes: 0, pedidos: 0, faturamento: 0 }
  ]);
  SBAdmin.invite = async ({ email, nome }) => ({ ok: true, local: true });

  /* Auth — sessão local sempre válida */
  SBAuth.getSession = async () => ({ user: { email: 'local@teste.dev' } });
  SBAuth.signIn     = async (email, password) => {
    if (!password) throw new Error('Senha obrigatória');
    return { user: { email } };
  };
  SBAuth.signOut    = async () => {
    if (confirm('Sair do modo local?')) window.location.replace('login.html');
  };
  SBAuth.onChange       = () => ({ data: { subscription: { unsubscribe: () => {} } } });
  SBAuth.resetPassword  = async () => {};
  SBAuth.updatePassword  = async () => {};
  SBAuth.updateProfile   = async () => {};
  SBAuth.onAuthChange    = () => {};
  Tenants.getForUser     = async () => ({ id: 'local-tenant', slug: 'local', nome: 'Conta de Testes', role: 'admin' });
  SBTeam.list   = async () => [];
  SBTeam.invite = async () => ({ ok: true });
  SBTeam.remove = async () => {};
  SBTeam.updateRole = async () => {};

  /* Badge visual "CONTA DE TESTES" */
  document.addEventListener('DOMContentLoaded', () => {
    const b = document.createElement('div');
    b.id = 'local-mode-badge';
    b.title = 'Conta de testes — dados de demonstração salvos só neste navegador. Clique para restaurar.';
    b.innerHTML = '🧪<span class="lmb-txt"> CONTA DE TESTES</span>';
    b.style.cssText = [
      'position:fixed', 'bottom:72px', 'right:12px', 'z-index:9999',
      'background:#F59E0B', 'color:#fff', 'font-size:11px', 'font-weight:700',
      'padding:5px 10px', 'border-radius:8px', 'letter-spacing:.04em',
      'box-shadow:0 2px 8px rgba(0,0,0,.18)', 'cursor:default',
      'font-family:Inter,system-ui,sans-serif',
    ].join(';');
    document.body.appendChild(b);

    /* Botão de reset: restaura os dados de demonstração originais */
    b.addEventListener('click', () => {
      if (confirm('Restaurar os dados de demonstração? Suas alterações neste navegador serão perdidas.')) {
        ['prods','clis','peds','trans','solics','notifs','settings','seeded'].forEach(k =>
          localStorage.removeItem('mlb_local_' + k)
        );
        location.reload();
      }
    });
  });
}
