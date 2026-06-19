-- =====================================================================
-- V8 — Exige MFA (TOTP) para o painel GrupoLima (admin)
-- Execute no SQL Editor do Supabase, depois de migration_admin.sql.
--
-- Problema: contas em `grupolima_admins` têm acesso de leitura a TODOS
-- os tenants (tenants_admin_select, products_admin_select, etc — ver
-- migration_admin.sql). Se a senha de uma dessas contas for comprometida,
-- o atacante lê dados (incluindo Pix) de todas as lojas com apenas
-- usuário+senha.
--
-- Solução: as policies "*_admin_select" passam a exigir também que a
-- sessão tenha completado MFA (aal2), além de `is_grupolima_admin()`.
-- A autenticação com senha sozinha (aal1) continua valendo para o
-- acesso normal ao próprio tenant (policies "*_tenant_*"/"*_owner_*"),
-- só a VISÃO CROSS-TENANT do painel admin passa a exigir o segundo fator.
--
-- Depois de rodar este arquivo, cada admin deve cadastrar um app TOTP
-- (Google Authenticator, Authy, etc) em admin.html — o painel agora
-- mostra a tela de configuração/verificação de 2FA automaticamente.
-- =====================================================================

-- ─── Função auxiliar: sessão atual já completou o segundo fator? ───────
create or replace function is_mfa_aal2()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
$$;

-- ─── Policies admin passam a exigir is_grupolima_admin() AND aal2 ──────
drop policy if exists "tenants_admin_select" on tenants;
create policy "tenants_admin_select" on tenants for select to authenticated
  using (is_grupolima_admin() and is_mfa_aal2());

drop policy if exists "products_admin_select" on products;
create policy "products_admin_select" on products for select to authenticated
  using (is_grupolima_admin() and is_mfa_aal2());

drop policy if exists "clients_admin_select" on clients;
create policy "clients_admin_select" on clients for select to authenticated
  using (is_grupolima_admin() and is_mfa_aal2());

drop policy if exists "orders_admin_select" on orders;
create policy "orders_admin_select" on orders for select to authenticated
  using (is_grupolima_admin() and is_mfa_aal2());

drop policy if exists "transactions_admin_select" on transactions;
create policy "transactions_admin_select" on transactions for select to authenticated
  using (is_grupolima_admin() and is_mfa_aal2());

drop policy if exists "settings_admin_select" on store_settings;
create policy "settings_admin_select" on store_settings for select to authenticated
  using (is_grupolima_admin() and is_mfa_aal2());

-- =====================================================================
-- NOTA: `is_grupolima_admin()` (sem o aal2) continua valendo para a
-- RPC `is_grupolima_admin()` chamada pelo front-end (Tenants.isAdmin()),
-- que só decide se mostra o link/rota do painel admin — não dá acesso
-- a dados de outros tenants. O front-end (admin.html) usa essa RPC para
-- saber se deve mostrar a tela de configuração de 2FA antes de liberar
-- a listagem de lojas, que aí sim depende das policies acima (aal2).
-- =====================================================================
