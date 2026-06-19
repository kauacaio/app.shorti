-- ============================================================
-- MULTI-USER POR TENANT: cria tenant_members + atualiza RLS
-- Cole no SQL Editor do Supabase e rode
-- ============================================================

-- 1. Tabela de membros por tenant
CREATE TABLE IF NOT EXISTS public.tenant_members (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'funcionario'
             CHECK (role IN ('admin','funcionario')),
  nome       text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

-- Admins do tenant veem/gerenciam todos os membros
CREATE POLICY "members_admin_all" ON public.tenant_members
  FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM public.tenants WHERE owner_user_id = auth.uid()
    )
  );

-- Qualquer membro vê o próprio registro
CREATE POLICY "members_self_select" ON public.tenant_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 2. Atualiza RLS de todas as tabelas de dados para aceitar
--    membros do tenant (não só o owner)
-- ============================================================

-- Helper: retorna os tenant_ids acessíveis pelo usuário logado
-- (owner OU membro)
CREATE OR REPLACE FUNCTION public.my_tenant_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM public.tenants WHERE owner_user_id = auth.uid()
  UNION
  SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid();
$$;

-- CLIENTS
DROP POLICY IF EXISTS "clients_tenant_all"    ON public.clients;
DROP POLICY IF EXISTS "clients_tenant_select" ON public.clients;
CREATE POLICY "clients_tenant_all" ON public.clients
  FOR ALL TO authenticated
  USING     (tenant_id IN (SELECT public.my_tenant_ids()))
  WITH CHECK(tenant_id IN (SELECT public.my_tenant_ids()));

-- ORDERS
DROP POLICY IF EXISTS "orders_tenant_all"    ON public.orders;
DROP POLICY IF EXISTS "orders_tenant_select" ON public.orders;
CREATE POLICY "orders_tenant_all" ON public.orders
  FOR ALL TO authenticated
  USING     (tenant_id IN (SELECT public.my_tenant_ids()))
  WITH CHECK(tenant_id IN (SELECT public.my_tenant_ids()));

-- TRANSACTIONS
DROP POLICY IF EXISTS "transactions_tenant_all"    ON public.transactions;
DROP POLICY IF EXISTS "transactions_tenant_select" ON public.transactions;
CREATE POLICY "transactions_tenant_all" ON public.transactions
  FOR ALL TO authenticated
  USING     (tenant_id IN (SELECT public.my_tenant_ids()))
  WITH CHECK(tenant_id IN (SELECT public.my_tenant_ids()));

-- SOLICITACOES
DROP POLICY IF EXISTS "solicitacoes_tenant_all"    ON public.solicitacoes;
DROP POLICY IF EXISTS "solicitacoes_tenant_select" ON public.solicitacoes;
CREATE POLICY "solicitacoes_tenant_all" ON public.solicitacoes
  FOR ALL TO authenticated
  USING     (tenant_id IN (SELECT public.my_tenant_ids()))
  WITH CHECK(tenant_id IN (SELECT public.my_tenant_ids()));

-- NOTIFICATIONS
DROP POLICY IF EXISTS "notifications_tenant_all"    ON public.notifications;
DROP POLICY IF EXISTS "notifications_tenant_select" ON public.notifications;
CREATE POLICY "notifications_tenant_all" ON public.notifications
  FOR ALL TO authenticated
  USING     (tenant_id IN (SELECT public.my_tenant_ids()))
  WITH CHECK(tenant_id IN (SELECT public.my_tenant_ids()));

-- PRODUCTS
DROP POLICY IF EXISTS "products_tenant_select" ON public.products;
DROP POLICY IF EXISTS "products_tenant_insert" ON public.products;
DROP POLICY IF EXISTS "products_tenant_update" ON public.products;
DROP POLICY IF EXISTS "products_tenant_delete" ON public.products;
CREATE POLICY "products_tenant_all" ON public.products
  FOR ALL TO authenticated
  USING     (tenant_id IN (SELECT public.my_tenant_ids()))
  WITH CHECK(tenant_id IN (SELECT public.my_tenant_ids()));

-- STORE SETTINGS
DROP POLICY IF EXISTS "settings_tenant_select" ON public.store_settings;
DROP POLICY IF EXISTS "settings_tenant_insert" ON public.store_settings;
DROP POLICY IF EXISTS "settings_tenant_update" ON public.store_settings;
CREATE POLICY "settings_tenant_all" ON public.store_settings
  FOR ALL TO authenticated
  USING     (tenant_id IN (SELECT public.my_tenant_ids()))
  WITH CHECK(tenant_id IN (SELECT public.my_tenant_ids()));

-- ============================================================
-- 3. Registra o owner da Milena como admin na nova tabela
-- ============================================================
INSERT INTO public.tenant_members (tenant_id, user_id, role, nome)
SELECT t.id, t.owner_user_id, 'admin', u.raw_user_meta_data->>'nome'
FROM   public.tenants t
JOIN   auth.users u ON u.id = t.owner_user_id
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- Confirmar:
SELECT tm.role, tm.nome, u.email, t.slug
FROM   tenant_members tm
JOIN   auth.users u ON u.id = tm.user_id
JOIN   tenants t    ON t.id = tm.tenant_id
ORDER BY t.slug, tm.role;
