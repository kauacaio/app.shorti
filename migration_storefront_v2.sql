-- =====================================================================
-- V6 — Storefront: BR-09 (notificação de pedido) + BR-12 (gasto/ult)
-- Pré-requisito: migration_storefront_orders.sql já executado.
--
-- BR-09: create_storefront_order() agora insere uma notificação na
--        tabela `notifications` do tenant, que o ERP recebe via
--        Supabase Realtime (postgres_changes INSERT).
--
-- BR-12: Após inserir o pedido, atualiza clients.gasto e clients.ult
--        para manter o histórico do cliente sempre preciso no ERP.
-- =====================================================================

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
  v_notif_id  integer;
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
  -- ── Validações ────────────────────────────────────────────────────
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

  -- Serializa geração de IDs deste tenant (evita corrida em max(id)+1)
  perform pg_advisory_xact_lock(hashtext(v_tenant_id::text));

  -- ── Recalcula itens a partir do preço real do banco ───────────────
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

  -- ── Upsert cliente ─────────────────────────────────────────────────
  select id into v_client_id
    from clients where tenant_id = v_tenant_id and tel = v_tel limit 1;

  if v_client_id is null then
    select coalesce(max(id), 200) + 1 into v_client_id
      from clients where tenant_id = v_tenant_id;
    insert into clients (tenant_id, id, nm, tel)
    values (v_tenant_id, v_client_id, v_nome, v_tel);
  else
    update clients set nm = v_nome where tenant_id = v_tenant_id and id = v_client_id;
  end if;

  -- ── Inserir pedido ─────────────────────────────────────────────────
  select coalesce(max(id), 2000) + 1 into v_order_id
    from orders where tenant_id = v_tenant_id;

  select coalesce(sum((elem->>'q')::int), 0) into v_qtd
    from jsonb_array_elements(v_itens) elem;

  v_prod := case
    when jsonb_array_length(v_itens) = 1 then (v_itens->0->>'nm')
    else jsonb_array_length(v_itens) || ' produtos'
  end;

  insert into orders (tenant_id, id, cid, prod, q, tot, pag, parc, dtpag, itens, st, dt)
  values (v_tenant_id, v_order_id, v_client_id, v_prod, v_qtd, v_tot,
          'A combinar', 1, current_date, v_itens, 'Pendente', current_date);

  -- ── BR-12: Atualiza histórico do cliente ───────────────────────────
  update clients
  set gasto = coalesce(gasto, 0) + v_tot,
      ult   = current_date
  where tenant_id = v_tenant_id
    and id = v_client_id;

  -- ── BR-09: Insere notificação para o tenant ────────────────────────
  select coalesce(max(id), 0) + 1 into v_notif_id
    from notifications where tenant_id = v_tenant_id;

  insert into notifications (tenant_id, id, key, type, icon, title, msg, link, read, dt)
  values (
    v_tenant_id,
    v_notif_id,
    'pedido-loja-' || v_order_id,
    'order',
    '🛒',
    'Novo pedido da loja',
    v_nome || ' · R$ ' || to_char(v_tot, 'FM999990.00'),
    'pedidos',
    false,
    now()::text
  );

  return query select v_order_id, v_client_id;
end;
$$;

grant execute on function create_storefront_order(text, text, text, jsonb, numeric) to anon, authenticated;
