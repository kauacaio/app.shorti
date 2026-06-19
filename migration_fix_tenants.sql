-- ============================================================
-- FIX TENANTS: Vincula cada tenant ao seu owner correto.
-- Cole no SQL Editor do Supabase e rode DEPOIS do migration_fix_rls.sql
-- ============================================================

-- Mostra o estado atual antes de qualquer mudança:
SELECT
  t.id        AS tenant_id,
  t.slug,
  t.nome,
  t.owner_user_id,
  u.email     AS owner_email
FROM tenants t
LEFT JOIN auth.users u ON u.id = t.owner_user_id
ORDER BY t.created_at;
