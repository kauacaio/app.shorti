-- =====================================================================
-- Migração multi-tenant — Shorti (ERPbyGRUPOLIMA)
-- Execute no SQL Editor do Supabase (Dashboard > SQL Editor > New query)
-- Pré-requisito: schema.sql já executado.
-- =====================================================================

-- ─── Extensão para gen_random_uuid() ──────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Tabela de tenants ─────────────────────────────────────────────────
create table if not exists tenants (
  id             uuid         primary key default gen_random_uuid(),
  slug           text         not null unique,
  nome           text         not null,
  owner_user_id  uuid         not null unique references auth.users(id),
  created_at     timestamptz  not null default now()
);

alter table tenants enable row level security;

-- Dono gerencia o próprio registro de tenant
create policy "tenants_owner_all" on tenants
  for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- Leitura pública (loja: resolve slug → tenant_id).
-- IMPORTANTE: o app deve sempre fazer select('id,slug,nome'),
-- nunca select('*'), para não expor owner_user_id a anônimos.
create policy "tenants_anon_select" on tenants
  for select using (true);

-- ─── Tenant inicial — Milena Lima Beauty ───────────────────────────────
-- Preencha o e-mail da conta da Milena cadastrada em
-- Supabase Dashboard > Authentication > Users
insert into tenants (slug, nome, owner_user_id)
select 'milena-lima-beauty', 'Milena Lima Beauty', id
from auth.users
where email = '<EMAIL_DA_MILENA>'
on conflict (owner_user_id) do nothing;

-- ─── Função auxiliar: tenant_id do usuário autenticado ─────────────────
-- Subqueries não são permitidas em DEFAULT; usamos uma função stable.
create or replace function current_tenant_id()
returns uuid
language sql
stable
as $$
  select id from tenants where owner_user_id = auth.uid() limit 1
$$;

-- ─── Tabela notifications (não existia em schema.sql) ──────────────────
create table if not exists notifications (
  id          integer      not null,
  key         text         not null,
  type        text         not null default 'info',
  icon        text         not null default '🔔',
  title       text         not null,
  msg         text         not null default '',
  link        text         not null default '',
  read        boolean      not null default false,
  dt          text         not null default now()::text,
  created_at  timestamptz  not null default now()
);

-- =====================================================================
-- Helper: aplica tenant_id + PK composta + RLS isolada a uma tabela
-- que já tem coluna `id integer`.
-- =====================================================================
do $$
declare
  milena_id uuid;
  tbl text;
begin
  select id into milena_id from tenants where slug = 'milena-lima-beauty';

  if milena_id is null then
    raise exception 'Tenant da Milena não encontrado — preencha o e-mail correto em <EMAIL_DA_MILENA> e rode novamente.';
  end if;

  foreach tbl in array array['products','clients','orders','transactions','solicitacoes','notifications'] loop
    execute format('alter table %I add column if not exists tenant_id uuid references tenants(id)', tbl);
    execute format('update %I set tenant_id = $1 where tenant_id is null', tbl) using milena_id;
    execute format('alter table %I alter column tenant_id set not null', tbl);
    execute format('alter table %I alter column tenant_id set default current_tenant_id()', tbl);
  end loop;
end $$;

-- orders.cid → clients(id) depende do índice de clients_pkey; precisa ser
-- removido ANTES de recriar a PK composta de clients (sem perda de dados).
alter table orders drop constraint if exists orders_cid_fkey;

-- ─── PKs compostas (tenant_id, id) ──────────────────────────────────────
alter table products     drop constraint if exists products_pkey;
alter table products     add  primary key (tenant_id, id);

alter table clients      drop constraint if exists clients_pkey;
alter table clients      add  primary key (tenant_id, id);

alter table orders       drop constraint if exists orders_pkey;
alter table orders       add  primary key (tenant_id, id);

alter table transactions drop constraint if exists transactions_pkey;
alter table transactions add  primary key (tenant_id, id);

alter table solicitacoes drop constraint if exists solicitacoes_pkey;
alter table solicitacoes add  primary key (tenant_id, id);

alter table notifications drop constraint if exists notifications_pkey;
alter table notifications add  primary key (tenant_id, id);

-- orders.cid → clients(id) passa a ser composta (tenant_id, cid) → clients(tenant_id, id)
alter table orders add constraint orders_cid_tenant_fkey
  foreign key (tenant_id, cid) references clients(tenant_id, id) on delete set null;

-- ─── store_settings: PK passa a ser tenant_id (1 registro por loja) ────
alter table store_settings add column if not exists tenant_id uuid references tenants(id);
update store_settings set tenant_id = (select id from tenants where slug = 'milena-lima-beauty')
  where tenant_id is null;
alter table store_settings alter column tenant_id set not null;
alter table store_settings alter column tenant_id set default current_tenant_id();

alter table store_settings drop constraint if exists store_settings_pkey;
alter table store_settings drop column if exists id;
alter table store_settings add primary key (tenant_id);

-- =====================================================================
-- RLS — isolar por tenant nas tabelas autenticadas
-- =====================================================================

-- Produtos: leitura pública continua liberada (só p/ anon); ERP autenticado
-- passa a ver só os produtos do próprio tenant; escrita isolada por tenant
drop policy if exists "products_anon_select" on products;
drop policy if exists "products_auth_insert" on products;
drop policy if exists "products_auth_update" on products;
drop policy if exists "products_auth_delete" on products;

create policy "products_anon_select" on products for select to anon
  using (true);
create policy "products_auth_select" on products for select to authenticated
  using (tenant_id = (select id from tenants where owner_user_id = auth.uid() limit 1));

create policy "products_tenant_insert" on products for insert to authenticated
  with check (tenant_id = (select id from tenants where owner_user_id = auth.uid() limit 1));
create policy "products_tenant_update" on products for update to authenticated
  using      (tenant_id = (select id from tenants where owner_user_id = auth.uid() limit 1))
  with check (tenant_id = (select id from tenants where owner_user_id = auth.uid() limit 1));
create policy "products_tenant_delete" on products for delete to authenticated
  using      (tenant_id = (select id from tenants where owner_user_id = auth.uid() limit 1));

-- Configurações: leitura pública continua liberada (só p/ anon); ERP
-- autenticado vê só a config do próprio tenant; escrita isolada por tenant
drop policy if exists "settings_anon_select" on store_settings;
drop policy if exists "settings_auth_insert" on store_settings;
drop policy if exists "settings_auth_update" on store_settings;

create policy "settings_anon_select" on store_settings for select to anon
  using (true);
create policy "settings_auth_select" on store_settings for select to authenticated
  using (tenant_id = (select id from tenants where owner_user_id = auth.uid() limit 1));

create policy "settings_tenant_insert" on store_settings for insert to authenticated
  with check (tenant_id = (select id from tenants where owner_user_id = auth.uid() limit 1));
create policy "settings_tenant_update" on store_settings for update to authenticated
  using      (tenant_id = (select id from tenants where owner_user_id = auth.uid() limit 1))
  with check (tenant_id = (select id from tenants where owner_user_id = auth.uid() limit 1));

-- Clientes / Pedidos / Transações / Solicitações / Notificações: tudo isolado por tenant
drop policy if exists "clients_auth_all"      on clients;
drop policy if exists "orders_auth_all"       on orders;
drop policy if exists "transactions_auth_all" on transactions;
drop policy if exists "solicitacoes_auth_all" on solicitacoes;

create policy "clients_tenant_all" on clients for all to authenticated
  using      (tenant_id = (select id from tenants where owner_user_id = auth.uid() limit 1))
  with check (tenant_id = (select id from tenants where owner_user_id = auth.uid() limit 1));

create policy "orders_tenant_all" on orders for all to authenticated
  using      (tenant_id = (select id from tenants where owner_user_id = auth.uid() limit 1))
  with check (tenant_id = (select id from tenants where owner_user_id = auth.uid() limit 1));

create policy "transactions_tenant_all" on transactions for all to authenticated
  using      (tenant_id = (select id from tenants where owner_user_id = auth.uid() limit 1))
  with check (tenant_id = (select id from tenants where owner_user_id = auth.uid() limit 1));

create policy "solicitacoes_tenant_all" on solicitacoes for all to authenticated
  using      (tenant_id = (select id from tenants where owner_user_id = auth.uid() limit 1))
  with check (tenant_id = (select id from tenants where owner_user_id = auth.uid() limit 1));

alter table notifications enable row level security;
drop policy if exists "notifications_auth_all" on notifications;
create policy "notifications_tenant_all" on notifications for all to authenticated
  using      (tenant_id = (select id from tenants where owner_user_id = auth.uid() limit 1))
  with check (tenant_id = (select id from tenants where owner_user_id = auth.uid() limit 1));

-- =====================================================================
-- IMPORTANTE
-- =====================================================================
-- 1. Preencha '<EMAIL_DA_MILENA>' acima com o e-mail real da conta dela
--    ANTES de executar — o bloco do(s) acima falha se o tenant não existir.
-- 2. Para cada NOVA consultora:
--    a) Crie o usuário em Authentication > Users > Add user
--    b) Ela faz login no ERP — sem tenant ainda, será redirecionada
--       para onboarding.html, onde escolhe nome da loja + slug.
--    c) onboarding.html cria a linha em `tenants` e os `store_settings`
--       iniciais automaticamente (ver app/init.js + onboarding.html).
