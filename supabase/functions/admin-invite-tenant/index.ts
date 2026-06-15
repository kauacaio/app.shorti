// Edge Function: admin-invite-tenant
// Convida um novo cliente (lojista) por e-mail, chamando a Admin API do
// Supabase. Só funciona para usuários cadastrados em `grupolima_admins`.
//
// Deploy: supabase functions deploy admin-invite-tenant
// (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já são injetados automaticamente)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ ok: false, error: 'Método não permitido' }, 405);

  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.replace('Bearer ', '');
  if (!jwt) return json({ ok: false, error: 'Sessão inválida' }, 401);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Verifica se quem chamou é admin GrupoLima (RLS + RPC com o JWT do usuário)
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: isAdmin, error: adminErr } = await callerClient.rpc('is_grupolima_admin');
  if (adminErr || !isAdmin) return json({ ok: false, error: 'Acesso restrito' }, 403);

  let body: { email?: string; nome?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'JSON inválido' }, 400);
  }

  const email = (body.email || '').trim();
  const nome = (body.nome || '').trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: 'E-mail inválido' }, 400);
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const origin = req.headers.get('origin') || new URL(req.url).origin;
  const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { nome },
    redirectTo: `${origin}/onboarding.html`,
  });

  if (error) return json({ ok: false, error: error.message }, 400);
  return json({ ok: true });
});
