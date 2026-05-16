-- =====================================================================
-- Milena Lima Beauty — Schema Supabase
-- Execute no SQL Editor do Supabase (Dashboard > SQL Editor > New query)
-- =====================================================================

-- ─── Extensões ───────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Tabelas ─────────────────────────────────────────────────────────

create table if not exists products (
  id          integer      primary key,
  em          text         not null default '💄',
  nm          text         not null,
  cat         text         not null check (cat in ('pele','corpo','maquiagem','fragrancias')),
  pr          numeric(10,2) not null,
  pd          numeric(10,2),
  st          integer      not null default 0,
  dt          text         not null default '',
  img         text         not null default '',
  bump        integer,
  description text         not null default '',
  feats       text[]       not null default '{}',
  created_at  timestamptz  not null default now()
);

create table if not exists clients (
  id          integer      primary key,
  nm          text         not null,
  tel         text         not null default '',
  em          text         not null default '',
  ci          text         not null default '',
  es          text         not null default '',
  an          date,
  pe          text         not null default 'Normal',
  gasto       numeric(10,2) not null default 0,
  ult         date,
  created_at  timestamptz  not null default now()
);

create table if not exists orders (
  id          integer      primary key,
  cid         integer      references clients(id) on delete set null,
  prod        text         not null,
  q           integer      not null default 1,
  tot         numeric(10,2) not null,
  pag         text         not null default 'PIX',
  st          text         not null default 'Confirmado'
                           check (st in ('Pendente','Confirmado','Enviado','Entregue')),
  dt          date         not null default current_date,
  created_at  timestamptz  not null default now()
);

create table if not exists transactions (
  id          integer      primary key,
  tp          text         not null check (tp in ('receita','despesa')),
  ds          text         not null,
  vl          numeric(10,2) not null,
  dt          date         not null default current_date,
  created_at  timestamptz  not null default now()
);

create table if not exists store_settings (
  id          integer      primary key default 1,
  data        jsonb        not null default '{}'::jsonb,
  updated_at  timestamptz  not null default now()
);

-- ─── Row Level Security ───────────────────────────────────────────────
-- Produtos e configurações: leitura pública, escrita apenas autenticado
-- Clientes, pedidos e transações: apenas usuário autenticado

alter table products       enable row level security;
alter table clients        enable row level security;
alter table orders         enable row level security;
alter table transactions   enable row level security;
alter table store_settings enable row level security;

-- Produtos
create policy "products_anon_select"  on products for select using (true);
create policy "products_auth_insert"  on products for insert to authenticated with check (true);
create policy "products_auth_update"  on products for update to authenticated using (true);
create policy "products_auth_delete"  on products for delete to authenticated using (true);

-- Configurações
create policy "settings_anon_select"  on store_settings for select using (true);
create policy "settings_auth_insert"  on store_settings for insert to authenticated with check (true);
create policy "settings_auth_update"  on store_settings for update to authenticated using (true);

-- Clientes
create policy "clients_auth_all"      on clients      for all to authenticated using (true) with check (true);

-- Pedidos
create policy "orders_auth_all"       on orders       for all to authenticated using (true) with check (true);

-- Transações
create policy "transactions_auth_all" on transactions for all to authenticated using (true) with check (true);

-- ─── Dados iniciais — Produtos ────────────────────────────────────────
insert into products (id, em, nm, cat, pr, pd, st, dt, img, description, feats) values
  (1, '💄', 'Batom Cremoso Nude',      'maquiagem',   89.90,  null,   15, 'new',  'https://images.unsplash.com/photo-1586495777744-4e6232bf4c6d?w=600&q=80',
   'Fórmula cremosa de longa duração com vitamina E. Cor versátil que combina com todos os tons de pele.',
   array['Vitamina E','Longa duração','Cor universal']),
  (2, '🌸', 'Sérum Vitamina C',         'pele',       159.90, 129.90,  8, 'sale', 'https://images.unsplash.com/photo-1617897903246-719242758050?w=600&q=80',
   'Clareador e antioxidante poderoso. Reduz manchas e uniformiza o tom da pele em até 4 semanas.',
   array['Vitamina C pura','Anti-manchas','Antioxidante']),
  (3, '✨', 'Pó Iluminador',             'maquiagem',  119.90,  null,  20, '',     'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=600&q=80',
   'Reflexo de luz natural multidimensional. Realça os pontos altos do rosto para um brilho saudável.',
   array['Efeito natural','Longa fixação','Multidimensional']),
  (4, '🧴', 'Hidratante Corporal Rosê', 'corpo',       89.90,  null,   3, 'new',  'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600&q=80',
   'Hidratação profunda por 24h com manteiga de karité e fragrância suave de rosas silvestres.',
   array['24h hidratação','Manteiga de karité','Fragrância floral']),
  (5, '💐', 'Perfume Eau de Parfum',    'fragrancias', 249.90, 199.90,  5, 'sale', 'https://images.unsplash.com/photo-1614806687007-2215b4a1c53b?w=600&q=80',
   'Notas florais e almiscaradas de luxo. Fragrância intensa com duração de até 12h na pele.',
   array['12h duração','Notas florais','Luxo acessível']),
  (6, '🌿', 'Esfoliante Facial',        'pele',        79.90,  null,  12, '',     'https://images.unsplash.com/photo-1556227703-86f90c2dcf1d?w=600&q=80',
   'Microesfoliação suave com ativos naturais. Remove células mortas e prepara a pele para absorver tratamentos.',
   array['Micropartículas','Extratos naturais','Pré-tratamento']),
  (7, '💋', 'Gloss Labial Rosé',        'maquiagem',   59.90,  null,  25, 'new',  'https://images.unsplash.com/photo-1574634534894-89d7576c8259?w=600&q=80',
   'Efeito gloss úmido com leve volume natural. Hidrata profundamente e dá brilho luminoso irresistível.',
   array['Efeito volume','Hidratante','Brilho intenso']),
  (8, '🫧', 'Gel de Limpeza Facial',    'pele',        99.90,  79.90,  2, 'sale', 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=600&q=80',
   'Limpeza profunda sem ressecar. pH balanceado para todos os tipos de pele, inclusive a sensível.',
   array['pH balanceado','Limpeza profunda','Todos os tipos'])
on conflict (id) do nothing;

-- Referências de order bump
update products set bump = 7 where id = 1;
update products set bump = 6 where id = 2;
update products set bump = 1 where id = 3;
update products set bump = 2 where id = 4;
update products set bump = 3 where id = 5;
update products set bump = 8 where id = 6;
update products set bump = 4 where id = 8;

-- ─── Dados iniciais — Clientes ────────────────────────────────────────
insert into clients (id, nm, tel, em, ci, es, an, pe, gasto, ult) values
  (1, 'Ana Paula Ferreira', '(11) 98765-4321', 'ana@email.com',      'São Paulo',       'SP', '1990-03-15', 'Mista',  680,  '2025-04-28'),
  (2, 'Carla Mendes',       '(21) 97654-3210', 'carla@email.com',    'Rio de Janeiro',  'RJ', '1985-07-22', 'Seca',  1240,  '2025-05-02'),
  (3, 'Fernanda Souza',     '(31) 96543-2109', 'fernanda@email.com', 'Belo Horizonte',  'MG', '1995-11-08', 'Oleosa', 430,  '2025-04-15'),
  (4, 'Juliana Costa',      '(41) 95432-1098', 'juli@email.com',     'Curitiba',        'PR', '1992-01-30', 'Normal', 920,  '2025-05-05')
on conflict (id) do nothing;

-- ─── Dados iniciais — Pedidos ─────────────────────────────────────────
insert into orders (id, cid, prod, q, tot, pag, st, dt) values
  (1001, 1, 'Sérum Vitamina C',         2, 319.80, 'PIX',     'Entregue',  '2025-04-28'),
  (1002, 2, 'Batom Cremoso Nude',       1,  89.90, 'Cartão',  'Enviado',   '2025-05-02'),
  (1003, 3, 'Pó Iluminador',            1, 119.90, 'PIX',     'Confirmado','2025-04-15'),
  (1004, 4, 'Perfume Eau de Parfum',    1, 199.90, 'PIX',     'Pendente',  '2025-05-05'),
  (1005, 1, 'Hidratante Corporal Rosê', 2, 179.80, 'Dinheiro','Entregue',  '2025-05-07')
on conflict (id) do nothing;

-- ─── Dados iniciais — Transações ─────────────────────────────────────
insert into transactions (id, tp, ds, vl, dt) values
  (1, 'receita', 'Pedido #1001',       319.80, '2025-04-28'),
  (2, 'receita', 'Pedido #1002',        89.90, '2025-05-02'),
  (3, 'despesa', 'Reposição estoque',  450.00, '2025-05-01'),
  (4, 'receita', 'Pedido #1003',       119.90, '2025-04-15'),
  (5, 'despesa', 'Frete entrega',       45.00, '2025-05-03'),
  (6, 'receita', 'Pedido #1004',       199.90, '2025-05-05'),
  (7, 'receita', 'Pedido #1005',       179.80, '2025-05-07')
on conflict (id) do nothing;

-- ─── Configurações padrão da loja ────────────────────────────────────
insert into store_settings (id, data) values (1, '{
  "banner":     "Frete <em>GRÁTIS</em> em compras acima de R$ 150 · Consultoria personalizada inclusa em cada pedido",
  "whatsapp":   "5511999999999",
  "heroKicker": "Consultora Oficial Mary Kay",
  "heroLines":  ["Beleza que", "transforma.", "Cuidado que", "permanece."],
  "heroSub":    "Produtos de alta performance para pele, corpo e bem-estar. Consultoria personalizada, feita para você.",
  "heroProof":  "+500 clientes · Avaliação 4.9/5",
  "marquee":    "Skincare · Maquiagem · Corpo & Banho · Fragrâncias · Autocuidado · Mary Kay · Consultoria ·",
  "benefits": [
    {"title": "Entrega para todo o Brasil",  "desc": "Rápido e com rastreamento"},
    {"title": "Parcelamento em até 12x",     "desc": "Sem juros no cartão"},
    {"title": "100% Originais Mary Kay",     "desc": "Garantia de autenticidade"},
    {"title": "Consultoria personalizada",   "desc": "Atendimento exclusivo grátis"}
  ]
}'::jsonb) on conflict (id) do nothing;

-- ─── IMPORTANTE ───────────────────────────────────────────────────────
-- Após executar este schema, crie um usuário em:
-- Supabase Dashboard > Authentication > Users > Add user
-- Use o email e senha que a Milena usará para acessar o painel.
-- Depois preencha SUPABASE_URL e SUPABASE_ANON_KEY em supabase.js.
