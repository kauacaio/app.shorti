-- =====================================================================
-- Pedido pendente vindo da loja — Shorti (ERPbyGRUPOLIMA)
-- Execute no SQL Editor do Supabase (Dashboard > SQL Editor > New query)
-- Pré-requisito: migration_tenants.sql já executado.
-- =====================================================================
--
-- Cria a função create_storefront_order(), usada pela loja (visitante
-- anônimo) para registrar um pedido "Pendente" + cliente no ERP ao
-- finalizar a compra via WhatsApp. A tabela `clients`/`orders` só aceita
-- escrita de usuários autenticados (RLS), então a função roda com
-- SECURITY DEFINER e expõe apenas esta operação controlada para `anon`.
--
-- IMPORTANTE (v2): o preço/total não vem mais do cliente. `p_itens` chega
-- só com {pid, q}; nome, emoji, preço unitário e subtotal de cada item são
-- recalculados aqui a partir de `products` (preço atual: pd se houver,
-- senão pr). `p_tot` é ignorado — mantido apenas por compatibilidade de
-- assinatura. Isso evita que um visitante (ou chamada direta à API) crie
-- pedidos com valores/itens arbitrários.

create or replace function create_storefront_order(
  p_slug  text,
  p_nome  text,
  p_tel   text,
  p_itens jsonb,
  p_tot   numeric default 0
)
returns table(order_id integer, client_id integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_client_id integer;
  v_order_id  integer;
  v_prod      text;
  v_qtd       integer;
  v_tot       numeric := 0;
  v_itens     jsonb := '[]'::jsonb;
  v_item      jsonb;
  v_pid       integer;
  v_q         integer;
  v_price     numeric;
  v_name      text;
  v_em        text;
  v_sub       numeric;
  v_nome      text := trim(coalesce(p_nome, ''));
  v_tel       text := trim(coalesce(p_tel, ''));
begin
  select id into v_tenant_id from tenants where slug = p_slug;
  if v_tenant_id is null then
    raise exception 'Loja não encontrada';
  end if;

  if v_nome = '' or length(v_nome) > 120 then
    raise exception 'Nome inválido';
  end if;
  if v_tel = '' or length(v_tel) > 30 then
    raise exception 'Telefone inválido';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array'
     or jsonb_array_length(p_itens) = 0 or jsonb_array_length(p_itens) > 50 then
    raise exception 'Itens inválidos';
  end if;

  -- Serializa a geração de ids deste tenant (evita corrida em max(id)+1)
  perform pg_advisory_xact_lock(hashtext(v_tenant_id::text));

  -- Recalcula cada item a partir do preço REAL do produto no banco —
  -- nunca confia em nome/preço/subtotal enviados pelo cliente.
  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    v_pid := (v_item->>'pid')::integer;
    v_q   := (v_item->>'q')::integer;

    if v_pid is null or v_q is null or v_q <= 0 or v_q > 1000 then
      raise exception 'Item inválido';
    end if;

    select coalesce(pd, pr), nm, em into v_price, v_name, v_em
      from products where tenant_id = v_tenant_id and id = v_pid;

    if v_price is null then
      raise exception 'Produto % não encontrado', v_pid;
    end if;

    v_sub := v_price * v_q;
    v_tot := v_tot + v_sub;

    v_itens := v_itens || jsonb_build_object(
      'pid', v_pid, 'nm', v_name, 'em', v_em,
      'q', v_q, 'pr', v_price, 'sub', v_sub
    );
  end loop;

  select id into v_client_id from clients where tenant_id = v_tenant_id and tel = v_tel limit 1;
  if v_client_id is null then
    select coalesce(max(id), 200) + 1 into v_client_id from clients where tenant_id = v_tenant_id;
    insert into clients (tenant_id, id, nm, tel)
    values (v_tenant_id, v_client_id, v_nome, v_tel);
  else
    update clients set nm = v_nome where tenant_id = v_tenant_id and id = v_client_id;
  end if;

  select coalesce(max(id), 2000) + 1 into v_order_id from orders where tenant_id = v_tenant_id;

  select coalesce(sum((elem->>'q')::int), 0) into v_qtd from jsonb_array_elements(v_itens) elem;
  v_prod := case when jsonb_array_length(v_itens) = 1
                 then (v_itens->0->>'nm')
                 else jsonb_array_length(v_itens) || ' produtos' end;

  insert into orders (tenant_id, id, cid, prod, q, tot, pag, parc, dtpag, itens, st, dt)
  values (v_tenant_id, v_order_id, v_client_id, v_prod, v_qtd, v_tot, 'A combinar', 1, current_date, v_itens, 'Pendente', current_date);

  return query select v_order_id, v_client_id;
end;
$$;

grant execute on function create_storefront_order(text, text, text, jsonb, numeric) to anon, authenticated;
