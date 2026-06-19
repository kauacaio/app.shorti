// Edge Function: tenant-invite-member
// Convida um membro (funcionário ou admin) para um tenant.
// Só quem é admin/owner do tenant pode convidar.
//
// Deploy: supabase functions deploy tenant-invite-member

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'Método não permitido' }, 405);

  const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  if (!jwt) return json({ ok: false, error: 'Sessão inválida' }, 401);

  const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  /* Verifica JWT */
  const { data: { user }, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !user) return json({ ok: false, error: 'Sessão inválida' }, 401);

  /* Verifica se o caller é admin/owner do tenant */
  const { data: membership } = await admin
    .from('tenant_members')
    .select('role, tenant_id')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  /* Também aceita se for owner direto */
  let tenantId = membership?.tenant_id;
  if (!tenantId) {
    const { data: owned } = await admin
      .from('tenants')
      .select('id')
      .eq('owner_user_id', user.id)
      .maybeSingle();
    tenantId = owned?.id;
  }

  if (!tenantId) return json({ ok: false, error: 'Acesso restrito' }, 403);

  let body: { email?: string; nome?: string; role?: string };
  try { body = await req.json(); }
  catch { return json({ ok: false, error: 'JSON inválido' }, 400); }

  const email = (body.email || '').trim();
  const nome  = (body.nome  || '').trim();
  const role  = body.role === 'admin' ? 'admin' : 'funcionario';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return json({ ok: false, error: 'E-mail inválido' }, 400);

  /* Verifica se o usuário já existe */
  const { data: existing } = await admin
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  /* Convida via Auth admin (cria conta + envia e-mail) */
  const origin = req.headers.get('origin') || new URL(req.url).origin;
  const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nome },
    redirectTo: `${origin}/login.html`,
  });

  if (invErr && !invErr.message.includes('already been registered'))
    return json({ ok: false, error: invErr.message }, 400);

  /* Resolve o user_id (existente ou recém-criado) */
  let newUserId = invited?.user?.id;
  if (!newUserId) {
    const { data: { users } } = await admin.auth.admin.listUsers();
    newUserId = users.find(u => u.email === email)?.id;
  }
  if (!newUserId) return json({ ok: false, error: 'Não foi possível identificar o usuário' }, 500);

  /* Adiciona / atualiza em tenant_members */
  const { error: memberErr } = await admin
    .from('tenant_members')
    .upsert({ tenant_id: tenantId, user_id: newUserId, role, nome },
            { onConflict: 'tenant_id,user_id' });

  if (memberErr) return json({ ok: false, error: memberErr.message }, 500);

  return json({ ok: true, userId: newUserId });
});
