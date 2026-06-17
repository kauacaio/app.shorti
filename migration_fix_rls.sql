-- ============================================================
-- FIX RLS: Remove políticas antigas que causam vazamento entre tenants.
-- Cole no SQL Editor do Supabase e rode.
-- ============================================================
-- As políticas "erp *" foram criadas antes da multi-tenancy e permitem
-- que QUALQUER usuário autenticado veja TODOS os dados.
-- As novas "*_tenant_all" já cobrem tudo corretamente — pode dropar.

DROP POLICY IF EXISTS "erp products"  ON public.products;
DROP POLICY IF EXISTS "erp clients"   ON public.clients;
DROP POLICY IF EXISTS "erp orders"    ON public.orders;
DROP POLICY IF EXISTS "erp trans"     ON public.transactions;

-- "products_auth_select" permite SELECT irrestrito para usuários logados.
-- Mantemos "products_anon_select" e "produtos publicos" (loja pública).
DROP POLICY IF EXISTS "products_auth_select" ON public.products;

-- "settings_auth_select" permite leitura irrestrita de configurações.
-- Mantemos "settings_tenant_insert/update" e "settings_admin_select".
DROP POLICY IF EXISTS "settings_auth_select" ON public.store_settings;

-- ============================================================
-- Confirmar que apenas as políticas corretas restaram:
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
