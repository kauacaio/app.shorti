-- =====================================================================
-- DIAGNÓSTICO COMPLETO — cola no SQL Editor do Supabase e rode.
-- Retorna tudo numa query só (o Editor mostra só o último resultado).
-- =====================================================================
WITH
  t1 AS (
    SELECT 'tabela_existe' AS tipo, table_name AS chave, null AS valor
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('products','clients','orders','transactions','solicitacoes','notifications','tenants','store_settings')
  ),
  t2 AS (
    SELECT 'tem_tenant_id' AS tipo, table_name AS chave, null AS valor
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'tenant_id'
      AND table_name IN ('products','clients','orders','transactions','solicitacoes','notifications','store_settings')
  ),
  t3 AS (
    SELECT 'rls' AS tipo, relname::text AS chave, relrowsecurity::text AS valor
    FROM pg_class
    WHERE relnamespace = 'public'::regnamespace
      AND relname IN ('products','clients','orders','transactions','solicitacoes','notifications','tenants','store_settings')
  ),
  t4 AS (
    SELECT 'policy' AS tipo, tablename AS chave, policyname AS valor
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('products','clients','orders','transactions','solicitacoes','notifications','tenants','store_settings')
  ),
  t5 AS (
    SELECT 'tenant' AS tipo, slug AS chave, nome AS valor
    FROM tenants
  )
SELECT * FROM t1
UNION ALL SELECT * FROM t2
UNION ALL SELECT * FROM t3
UNION ALL SELECT * FROM t4
UNION ALL SELECT * FROM t5
ORDER BY tipo, chave;
