-- =====================================================================
-- V6 — Alocação atômica de IDs sequenciais por tenant
--
-- Problema: o app calculava o próximo id como max(id)+1 no cliente
-- (DB.nid.*), guardado em memória desde o carregamento da página. Se
-- dois dispositivos/abas criam um registro (produto, cliente, pedido,
-- lançamento, solicitação) quase ao mesmo tempo, ambos calculam o
-- mesmo id e o upsert do segundo SOBRESCREVE silenciosamente o
-- registro do primeiro (mesma chave primária tenant_id+id).
--
-- Solução: tabela id_counters + função next_id(), que faz um
-- INSERT ... ON CONFLICT DO UPDATE ... RETURNING — atômico, protegido
-- pelo lock de linha do Postgres, então duas chamadas concorrentes
-- nunca retornam o mesmo número.
--
-- Rode este script no SQL Editor do Supabase DEPOIS de
-- migration_tenants.sql (depende de current_tenant_id()).
-- =====================================================================

create table if not exists id_counters (
  tenant_id uuid not null references tenants(id),
  name      text not null,
  val       integer not null,
  primary key (tenant_id, name)
);

alter table id_counters enable row level security;

drop policy if exists "id_counters_own" on id_counters;
create policy "id_counters_own" on id_counters for all to authenticated
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

grant select, insert, update on id_counters to authenticated;

-- ─── Semeia os contadores com o maior id já usado em cada tabela/tenant
insert into id_counters (tenant_id, name, val)
select tenant_id, 'products', coalesce(max(id), 0) from products group by tenant_id
on conflict (tenant_id, name) do nothing;

insert into id_counters (tenant_id, name, val)
select tenant_id, 'clients', coalesce(max(id), 0) from clients group by tenant_id
on conflict (tenant_id, name) do nothing;

insert into id_counters (tenant_id, name, val)
select tenant_id, 'orders', coalesce(max(id), 0) from orders group by tenant_id
on conflict (tenant_id, name) do nothing;

insert into id_counters (tenant_id, name, val)
select tenant_id, 'transactions', coalesce(max(id), 0) from transactions group by tenant_id
on conflict (tenant_id, name) do nothing;

insert into id_counters (tenant_id, name, val)
select tenant_id, 'solicitacoes', coalesce(max(id), 0) from solicitacoes group by tenant_id
on conflict (tenant_id, name) do nothing;

-- ─── Função: próximo id (atômico) para a tabela p_name do tenant atual
create or replace function next_id(p_name text)
returns integer
language sql
as $$
  insert into id_counters (tenant_id, name, val)
  values (current_tenant_id(), p_name, 1)
  on conflict (tenant_id, name) do update set val = id_counters.val + 1
  returning val
$$;

grant execute on function next_id(text) to authenticated;
