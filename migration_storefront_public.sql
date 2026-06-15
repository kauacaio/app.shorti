-- =====================================================================
-- V5 — Restringe leitura anônima de products / store_settings por tenant
-- Execute no SQL Editor do Supabase, depois de migration_tenants.sql.
--
-- Problema: as policies "products_anon_select" e "settings_anon_select"
-- usavam `using (true)`, então qualquer requisição anônima sem o filtro
-- .eq('tenant_id', ...) (ex: chamando a REST API direto) conseguia ler
-- produtos e configurações de TODOS os tenants — incluindo lojas
-- despublicadas e a chave Pix/whatsapp salvos em store_settings.data.
-- =====================================================================

-- ─── products: anon só vê produtos de lojas publicadas ─────────────────
drop policy if exists "products_anon_select" on products;

create policy "products_anon_select" on products for select to anon
  using (
    exists (
      select 1 from store_settings ss
      where ss.tenant_id = products.tenant_id
        and coalesce((ss.data->>'published')::boolean, true)
    )
  );

-- ─── store_settings: remove select direto para anon ────────────────────
-- A loja passa a usar a função get_storefront_settings(slug), que devolve
-- só o necessário para a vitrine (sem pix/pixVerified) e só de lojas
-- publicadas.
drop policy if exists "settings_anon_select" on store_settings;

create or replace function get_storefront_settings(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select ss.data - 'pix' - 'pixVerified'
  from store_settings ss
  join tenants t on t.id = ss.tenant_id
  where t.slug = p_slug
    and coalesce((ss.data->>'published')::boolean, true)
  limit 1
$$;

grant execute on function get_storefront_settings(text) to anon, authenticated;
