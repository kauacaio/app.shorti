-- ============================================================
-- FIX RLS 2: Adiciona SELECT com filtro de tenant para products e store_settings.
-- Rode no SQL Editor do Supabase logo após o migration_fix_rls.sql
-- ============================================================

-- Products: SELECT filtrado por tenant (ERP lista só os produtos do próprio tenant)
CREATE POLICY "products_tenant_select"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (
      SELECT id FROM public.tenants
      WHERE owner_user_id = auth.uid()
      LIMIT 1
    )
  );

-- Store settings: SELECT filtrado por tenant
CREATE POLICY "settings_tenant_select"
  ON public.store_settings
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (
      SELECT id FROM public.tenants
      WHERE owner_user_id = auth.uid()
      LIMIT 1
    )
  );

-- Confirmar resultado:
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('products', 'store_settings')
ORDER BY tablename, policyname;
