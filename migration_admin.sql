-- =====================================================================
-- Painel GrupoLima — administração central de tenants (lojas/clientes)
-- Execute no SQL Editor do Supabase (Dashboard > SQL Editor > New query)
-- Pré-requisito: migration_tenants.sql já executado.
-- =====================================================================
--
-- DEPOIS de rodar este arquivo:
-- 1. Cadastre você (e quem mais da equipe) como admin GrupoLima:
--
--      insert into grupolima_admins (user_id)
--      select id from auth.users where email = '<SEU_EMAIL_AQUI>'
--      on conflict do nothing;
--
-- 2. Acesse admin.html logado com essa conta para ver o painel.
-- =====================================================================

-- ─── Tabela de admins GrupoLima ─────────────────────────────────────────
create table if not exists grupolima_admins (
  user_id    uuid        primary key references auth.users(id),
  created_at timestamptz not null default now()
);

alter table grupolima_admins enable row level security;

drop policy if exists "grupolima_admins_self_select" on grupolima_admins;
create policy "grupolima_admins_self_select" on grupolima_admins
  for select to authenticated
  using (user_id = auth.uid());

-- ─── Função auxiliar: usuário atual é admin GrupoLima? ───────────────────
-- security definer: pode ler grupolima_admins independente da policy acima,
-- usada tanto em outras policies quanto via RPC pelo front-end.
create or replace function is_grupolima_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from grupolima_admins where user_id = auth.uid())
$$;

grant execute on function is_grupolima_admin() to authenticated;

-- ─── Policies adicionais: admins GrupoLima leem todos os tenants ────────
-- Aditivas — não removem as policies de isolamento por tenant já existentes,
-- apenas dão visão extra a quem está em grupolima_admins.
drop policy if exists "tenants_admin_select" on tenants;
create policy "tenants_admin_select" on tenants for select to authenticated
  using (is_grupolima_admin());

drop policy if exists "products_admin_select" on products;
create policy "products_admin_select" on products for select to authenticated
  using (is_grupolima_admin());

drop policy if exists "clients_admin_select" on clients;
create policy "clients_admin_select" on clients for select to authenticated
  using (is_grupolima_admin());

drop policy if exists "orders_admin_select" on orders;
create policy "orders_admin_select" on orders for select to authenticated
  using (is_grupolima_admin());

drop policy if exists "transactions_admin_select" on transactions;
create policy "transactions_admin_select" on transactions for select to authenticated
  using (is_grupolima_admin());

drop policy if exists "settings_admin_select" on store_settings;
create policy "settings_admin_select" on store_settings for select to authenticated
  using (is_grupolima_admin());

-- ─── Última atividade de cada tenant ────────────────────────────────────
alter table tenants add column if not exists last_active_at timestamptz;

create or replace function ping_tenant_activity()
returns void
language sql
security definer
set search_path = public
as $$
  update tenants set last_active_at = now() where owner_user_id = auth.uid()
$$;

grant execute on function ping_tenant_activity() to authenticated;

-- ─── View: visão geral por tenant (lojas + métricas) ────────────────────
-- security_invoker faz a view respeitar as RLS de quem consulta:
-- admins (policies acima) veem todas as linhas; lojistas comuns
-- continuariam vendo só o próprio tenant.
create or replace view admin_tenant_overview
with (security_invoker = true) as
select
  t.id,
  t.slug,
  t.nome,
  t.created_at,
  t.last_active_at,
  coalesce((s.data->>'published')::boolean, false)      as published,
  coalesce(s.data->>'whatsapp', '')                       as whatsapp,
  coalesce(s.data->>'pix', '')                            as pix,
  coalesce((s.data->>'pixVerified')::boolean, false)      as pix_verified,
  coalesce(p.cnt, 0)                                      as produtos,
  coalesce(c.cnt, 0)                                      as clientes,
  coalesce(o.cnt, 0)                                      as pedidos,
  coalesce(o.total, 0)                                    as faturamento
from tenants t
left join store_settings s on s.tenant_id = t.id
left join (select tenant_id, count(*) cnt from products  group by tenant_id) p on p.tenant_id = t.id
left join (select tenant_id, count(*) cnt from clients   group by tenant_id) c on c.tenant_id = t.id
left join (
  select tenant_id, count(*) cnt, sum(tot) total
  from orders where st <> 'Cancelado'
  group by tenant_id
) o on o.tenant_id = t.id;

grant select on admin_tenant_overview to authenticated;
