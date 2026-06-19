-- ============================================================
-- FIX: Notificações vazando entre tenants no Realtime
-- O filtro server-side só funciona se a tabela estiver na
-- publication correta E com RLS ativo.
-- ============================================================

-- 1. Garante RLS ativo na tabela
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 2. Garante que está na publication do Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- 3. Recria política limpa (garante que só o próprio tenant vê)
DROP POLICY IF EXISTS "notifications_tenant_all"    ON public.notifications;
DROP POLICY IF EXISTS "notifications_tenant_select" ON public.notifications;

CREATE POLICY "notifications_tenant_all" ON public.notifications
  FOR ALL TO authenticated
  USING     (tenant_id IN (SELECT public.my_tenant_ids()))
  WITH CHECK(tenant_id IN (SELECT public.my_tenant_ids()));

-- Confirmar
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND tablename = 'notifications';
