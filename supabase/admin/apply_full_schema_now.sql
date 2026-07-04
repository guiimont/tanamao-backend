-- Ta na Mao production schema consolidation.
-- Run this in the Supabase SQL Editor when preparing a new project or fixing
-- "schema cache" errors caused by missing tables/columns.
--
-- This script is additive and preserves existing data. It creates missing
-- tables, adds missing columns, refreshes triggers/functions and reloads the
-- PostgREST schema cache.

create extension if not exists pgcrypto;

create table if not exists settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists settings
  add column if not exists value jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null default 'operador',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists employees
  add column if not exists name text,
  add column if not exists email text,
  add column if not exists password_hash text,
  add column if not exists role text not null default 'operador',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_employees_role
  on employees(role);

create unique index if not exists idx_employees_email_unique
  on employees(email)
  where email is not null;

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  document text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists suppliers
  add column if not exists name text,
  add column if not exists contact text,
  add column if not exists document text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_suppliers_name
  on suppliers(name);

create table if not exists products (
  id text primary key,
  name text not null,
  description text not null default '',
  price numeric(12, 2) not null default 0 check (price >= 0),
  image_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  category text,
  serving_size text,
  shelf_life_days integer,
  storage_instructions text,
  lead_time_hours integer not null default 24,
  available_days text[] not null default array[]::text[],
  max_units_per_day integer,
  is_sellable boolean not null default true,
  is_gift_recipe boolean not null default false,
  weekly_guide_note text,
  usage_contexts text[] not null default array[]::text[],
  ingredients text,
  preparation_method text,
  preparation_video_url text,
  preparation_video_path text,
  reorder_min_quantity integer not null default 0 check (reorder_min_quantity >= 0),
  reorder_quantity integer not null default 0 check (reorder_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists products
  add column if not exists description text not null default '',
  add column if not exists price numeric(12, 2) not null default 0,
  add column if not exists image_url text,
  add column if not exists active boolean not null default true,
  add column if not exists sort_order integer not null default 0,
  add column if not exists stock_quantity integer not null default 0,
  add column if not exists category text,
  add column if not exists serving_size text,
  add column if not exists shelf_life_days integer,
  add column if not exists storage_instructions text,
  add column if not exists lead_time_hours integer not null default 24,
  add column if not exists available_days text[] not null default array[]::text[],
  add column if not exists max_units_per_day integer,
  add column if not exists is_sellable boolean not null default true,
  add column if not exists is_gift_recipe boolean not null default false,
  add column if not exists weekly_guide_note text,
  add column if not exists usage_contexts text[] not null default array[]::text[],
  add column if not exists ingredients text,
  add column if not exists preparation_method text,
  add column if not exists preparation_video_url text,
  add column if not exists preparation_video_path text,
  add column if not exists reorder_min_quantity integer not null default 0,
  add column if not exists reorder_quantity integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_products_active_sort
  on products(active, sort_order);

create index if not exists idx_products_category
  on products(category);

comment on column products.usage_contexts is
  'Icon guide tags: breakfast, work, lunch_dinner, quick_snack.';

comment on column products.ingredients is
  'Ingredients / product formula. Public only for free recipe products.';

comment on column products.preparation_method is
  'Preparation method. Public only for free recipe products.';

comment on column products.preparation_video_url is
  'Preparation video public URL. Public only for free recipe products.';

comment on column products.preparation_video_path is
  'Supabase Storage path for the preparation video.';

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  external_reference text unique,
  customer_name text not null,
  customer_phone text,
  delivery_address text,
  payment_method text,
  payment_status text not null default 'pending',
  delivery_status text not null default 'pending',
  mp_preference_id text,
  subtotal numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  gateway_fee numeric(12, 2) not null default 0,
  net_total numeric(12, 2) not null default 0,
  items_json jsonb not null default '[]'::jsonb,
  weekly_context_report jsonb not null default '{}'::jsonb,
  source text not null default 'site',
  scheduled_delivery_date date,
  delivery_window text,
  fulfillment_type text not null default 'delivery',
  production_started_at timestamptz,
  production_finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists orders
  add column if not exists external_reference text,
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists delivery_address text,
  add column if not exists payment_method text,
  add column if not exists payment_status text not null default 'pending',
  add column if not exists delivery_status text not null default 'pending',
  add column if not exists mp_preference_id text,
  add column if not exists subtotal numeric(12, 2) not null default 0,
  add column if not exists discount numeric(12, 2) not null default 0,
  add column if not exists total numeric(12, 2) not null default 0,
  add column if not exists gateway_fee numeric(12, 2) not null default 0,
  add column if not exists net_total numeric(12, 2) not null default 0,
  add column if not exists items_json jsonb not null default '[]'::jsonb,
  add column if not exists weekly_context_report jsonb not null default '{}'::jsonb,
  add column if not exists source text not null default 'site',
  add column if not exists scheduled_delivery_date date,
  add column if not exists delivery_window text,
  add column if not exists fulfillment_type text not null default 'delivery',
  add column if not exists production_started_at timestamptz,
  add column if not exists production_finished_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_orders_external_reference
  on orders(external_reference)
  where external_reference is not null;

create index if not exists idx_orders_created_at
  on orders(created_at desc);

create index if not exists idx_orders_payment_status
  on orders(payment_status);

create index if not exists idx_orders_delivery_status
  on orders(delivery_status);

create index if not exists idx_orders_scheduled_delivery_date
  on orders(scheduled_delivery_date);

comment on column orders.weekly_context_report is
  'Snapshot generated at checkout showing weekly eating contexts covered and suggested complements.';

create table if not exists costs (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  value numeric(12, 2) not null default 0 check (value >= 0),
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists costs
  add column if not exists description text,
  add column if not exists value numeric(12, 2) not null default 0,
  add column if not exists category text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_costs_created_at
  on costs(created_at desc);

create table if not exists stock_entries (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references suppliers(id) on delete set null,
  item_name text not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  total_value numeric(12, 2) not null default 0 check (total_value >= 0),
  unit_cost numeric(12, 4) not null default 0,
  unit_type text,
  category text,
  entry_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists stock_entries
  add column if not exists supplier_id uuid references suppliers(id) on delete set null,
  add column if not exists item_name text,
  add column if not exists quantity numeric(12, 3),
  add column if not exists total_value numeric(12, 2) not null default 0,
  add column if not exists unit_cost numeric(12, 4) not null default 0,
  add column if not exists unit_type text,
  add column if not exists category text,
  add column if not exists entry_date date,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_stock_entries_entry_date
  on stock_entries(entry_date desc);

create index if not exists idx_stock_entries_supplier
  on stock_entries(supplier_id);

create table if not exists product_daily_capacities (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references products(id) on delete cascade,
  production_date date not null,
  max_units integer not null check (max_units >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, production_date)
);

do $$
declare
  v_constraint_name text;
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'product_daily_capacities'
       and column_name = 'product_id'
       and data_type = 'uuid'
  ) then
    for v_constraint_name in
      select conname
        from pg_constraint
       where conrelid = 'public.product_daily_capacities'::regclass
         and contype = 'f'
    loop
      execute format('alter table public.product_daily_capacities drop constraint %I', v_constraint_name);
    end loop;

    alter table public.product_daily_capacities
      alter column product_id type text using product_id::text;
  end if;
end;
$$;

alter table if exists product_daily_capacities
  add column if not exists product_id text,
  add column if not exists production_date date,
  add column if not exists max_units integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_product_daily_capacities_date
  on product_daily_capacities(production_date);

create unique index if not exists idx_product_daily_capacities_product_date_unique
  on product_daily_capacities(product_id, production_date);

create table if not exists payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id text not null unique,
  order_id uuid references orders(id) on delete cascade,
  external_reference text,
  processed_at timestamptz not null default now()
);

alter table if exists payment_events
  add column if not exists payment_id text,
  add column if not exists order_id uuid references orders(id) on delete cascade,
  add column if not exists external_reference text,
  add column if not exists processed_at timestamptz not null default now();

create unique index if not exists idx_payment_events_payment_id_unique
  on payment_events(payment_id)
  where payment_id is not null;

create table if not exists product_stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references products(id) on delete cascade,
  qty_delta integer not null,
  reason text not null,
  reference text,
  order_id uuid references orders(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table if exists product_stock_movements
  add column if not exists product_id text references products(id) on delete cascade,
  add column if not exists qty_delta integer,
  add column if not exists reason text,
  add column if not exists reference text,
  add column if not exists order_id uuid references orders(id) on delete set null,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz not null default now();

create index if not exists idx_product_stock_movements_product
  on product_stock_movements(product_id);

create table if not exists replenishment_requests (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references products(id) on delete cascade,
  product_name text not null,
  current_stock integer not null default 0,
  reorder_min_quantity integer not null default 0,
  suggested_quantity integer not null default 0,
  status text not null default 'open' check (status in ('open', 'resolved', 'canceled')),
  source text not null default 'stock_trigger',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table if exists replenishment_requests
  add column if not exists product_id text references products(id) on delete cascade,
  add column if not exists product_name text,
  add column if not exists current_stock integer not null default 0,
  add column if not exists reorder_min_quantity integer not null default 0,
  add column if not exists suggested_quantity integer not null default 0,
  add column if not exists status text not null default 'open',
  add column if not exists source text not null default 'stock_trigger',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists resolved_at timestamptz;

create unique index if not exists idx_replenishment_requests_open_product
  on replenishment_requests(product_id)
  where status = 'open';

create index if not exists idx_replenishment_requests_status_created
  on replenishment_requests(status, created_at desc);

create table if not exists production_ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  unit_type text not null default 'un',
  supplier_id text,
  current_stock numeric(12, 3) not null default 0 check (current_stock >= 0),
  reorder_min_quantity numeric(12, 3) not null default 0 check (reorder_min_quantity >= 0),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists production_ingredients
  add column if not exists name text,
  add column if not exists category text,
  add column if not exists unit_type text not null default 'un',
  add column if not exists supplier_id text,
  add column if not exists current_stock numeric(12, 3) not null default 0,
  add column if not exists reorder_min_quantity numeric(12, 3) not null default 0,
  add column if not exists notes text,
  add column if not exists active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_production_ingredients_active_name
  on production_ingredients(active, name);

create index if not exists idx_production_ingredients_supplier
  on production_ingredients(supplier_id);

create unique index if not exists idx_production_ingredients_name_unique
  on production_ingredients(name)
  where name is not null;

create table if not exists product_ingredient_requirements (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references products(id) on delete cascade,
  ingredient_id uuid not null references production_ingredients(id) on delete restrict,
  quantity_per_unit numeric(12, 4) not null check (quantity_per_unit > 0),
  unit_type text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, ingredient_id)
);

alter table if exists product_ingredient_requirements
  add column if not exists product_id text references products(id) on delete cascade,
  add column if not exists ingredient_id uuid references production_ingredients(id) on delete restrict,
  add column if not exists quantity_per_unit numeric(12, 4),
  add column if not exists unit_type text,
  add column if not exists notes text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_product_ingredient_requirements_product
  on product_ingredient_requirements(product_id);

create index if not exists idx_product_ingredient_requirements_ingredient
  on product_ingredient_requirements(ingredient_id);

create unique index if not exists idx_product_ingredient_requirements_unique_product_ingredient
  on product_ingredient_requirements(product_id, ingredient_id);

create table if not exists production_shopping_lists (
  id uuid primary key default gen_random_uuid(),
  title text,
  status text not null default 'draft',
  production_items_json jsonb not null default '[]'::jsonb,
  shopping_items_json jsonb not null default '[]'::jsonb,
  missing_requirements_json jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists production_shopping_lists
  add column if not exists title text,
  add column if not exists status text not null default 'draft',
  add column if not exists production_items_json jsonb not null default '[]'::jsonb,
  add column if not exists shopping_items_json jsonb not null default '[]'::jsonb,
  add column if not exists missing_requirements_json jsonb not null default '[]'::jsonb,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_production_shopping_lists_status_created
  on production_shopping_lists(status, created_at desc);

comment on table production_ingredients is
  'Internal ingredient catalog used by product technical sheets.';

comment on table product_ingredient_requirements is
  'Structured bill of materials: ingredient quantity required to produce one unit of a product.';

comment on table production_shopping_lists is
  'Generated internal shopping lists based on planned production.';

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_settings_updated_at on settings;
create trigger trg_settings_updated_at
before update on settings
for each row
execute function set_updated_at();

drop trigger if exists trg_employees_updated_at on employees;
create trigger trg_employees_updated_at
before update on employees
for each row
execute function set_updated_at();

drop trigger if exists trg_suppliers_updated_at on suppliers;
create trigger trg_suppliers_updated_at
before update on suppliers
for each row
execute function set_updated_at();

drop trigger if exists trg_products_updated_at on products;
create trigger trg_products_updated_at
before update on products
for each row
execute function set_updated_at();

drop trigger if exists trg_orders_updated_at on orders;
create trigger trg_orders_updated_at
before update on orders
for each row
execute function set_updated_at();

drop trigger if exists trg_costs_updated_at on costs;
create trigger trg_costs_updated_at
before update on costs
for each row
execute function set_updated_at();

drop trigger if exists trg_stock_entries_updated_at on stock_entries;
create trigger trg_stock_entries_updated_at
before update on stock_entries
for each row
execute function set_updated_at();

drop trigger if exists trg_product_daily_capacities_updated_at on product_daily_capacities;
create trigger trg_product_daily_capacities_updated_at
before update on product_daily_capacities
for each row
execute function set_updated_at();

drop trigger if exists trg_production_ingredients_updated_at on production_ingredients;
create trigger trg_production_ingredients_updated_at
before update on production_ingredients
for each row
execute function set_updated_at();

drop trigger if exists trg_product_ingredient_requirements_updated_at on product_ingredient_requirements;
create trigger trg_product_ingredient_requirements_updated_at
before update on product_ingredient_requirements
for each row
execute function set_updated_at();

drop trigger if exists trg_production_shopping_lists_updated_at on production_shopping_lists;
create trigger trg_production_shopping_lists_updated_at
before update on production_shopping_lists
for each row
execute function set_updated_at();

create or replace function apply_product_stock_movement()
returns trigger
language plpgsql
as $$
begin
  update products
     set stock_quantity = greatest(coalesce(stock_quantity, 0) + new.qty_delta, 0)
   where id = new.product_id;

  return new;
end;
$$;

drop trigger if exists trg_apply_product_stock_movement on product_stock_movements;
create trigger trg_apply_product_stock_movement
after insert on product_stock_movements
for each row
execute function apply_product_stock_movement();

create or replace function process_order_stock(
  p_payment_id text,
  p_order_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_order orders%rowtype;
  v_inserted_payment_id text;
begin
  select *
    into v_order
    from orders
   where id = p_order_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'order_not_found');
  end if;

  insert into payment_events(payment_id, order_id, external_reference)
  values (p_payment_id, v_order.id, v_order.external_reference)
  on conflict (payment_id) do nothing
  returning payment_id into v_inserted_payment_id;

  if v_inserted_payment_id is null then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  update orders
     set payment_status = 'approved',
         updated_at = now()
   where id = v_order.id;

  return jsonb_build_object('ok', true, 'order_id', v_order.id);
end;
$$;

create or replace function start_production(p_order_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_order orders%rowtype;
  v_item jsonb;
  v_product products%rowtype;
  v_qty integer;
  v_issues jsonb := '[]'::jsonb;
begin
  select *
    into v_order
    from orders
   where id = p_order_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'order_not_found');
  end if;

  if v_order.payment_status <> 'approved' then
    return jsonb_build_object('ok', false, 'message', 'payment_not_approved');
  end if;

  if v_order.delivery_status in ('preparing', 'ready', 'out_for_delivery', 'delivered') then
    return jsonb_build_object('ok', true, 'delivery_status', v_order.delivery_status, 'issues', v_issues);
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(v_order.items_json, '[]'::jsonb))
  loop
    v_qty := coalesce((v_item->>'quantity')::integer, 0);

    select *
      into v_product
      from products
     where id = v_item->>'id'
     for update;

    if found and v_qty > 0 then
      if coalesce(v_product.stock_quantity, 0) >= v_qty then
        insert into product_stock_movements(product_id, qty_delta, reason, reference, order_id)
        values (v_product.id, -v_qty, 'order_production', v_order.external_reference, v_order.id);
      else
        v_issues := v_issues || jsonb_build_array(jsonb_build_object(
          'product_id', v_product.id,
          'requested', v_qty,
          'available', coalesce(v_product.stock_quantity, 0),
          'missing', v_qty - coalesce(v_product.stock_quantity, 0)
        ));
      end if;
    end if;
  end loop;

  update orders
     set delivery_status = 'preparing',
         production_started_at = coalesce(production_started_at, now()),
         updated_at = now()
   where id = v_order.id;

  return jsonb_build_object('ok', true, 'delivery_status', 'preparing', 'issues', v_issues);
end;
$$;

create or replace function sync_product_replenishment_request()
returns trigger
language plpgsql
as $$
declare
  v_stock integer := coalesce(new.stock_quantity, 0);
  v_min integer := coalesce(new.reorder_min_quantity, 0);
  v_suggested integer := greatest(coalesce(new.reorder_quantity, 0), v_min - v_stock, 1);
begin
  if coalesce(new.active, true)
     and coalesce(new.is_sellable, true)
     and v_min > 0
     and v_stock <= v_min then
    insert into replenishment_requests(
      product_id,
      product_name,
      current_stock,
      reorder_min_quantity,
      suggested_quantity,
      status,
      source
    )
    values (
      new.id,
      coalesce(new.name, new.id),
      v_stock,
      v_min,
      v_suggested,
      'open',
      'stock_trigger'
    )
    on conflict (product_id) where status = 'open'
    do update set
      product_name = excluded.product_name,
      current_stock = excluded.current_stock,
      reorder_min_quantity = excluded.reorder_min_quantity,
      suggested_quantity = excluded.suggested_quantity,
      updated_at = now();
  elsif v_min > 0 and v_stock > v_min then
    update replenishment_requests
       set status = 'resolved',
           resolved_at = now(),
           updated_at = now()
     where product_id = new.id
       and status = 'open';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_product_replenishment_request on products;
create trigger trg_sync_product_replenishment_request
after insert or update of stock_quantity, reorder_min_quantity, reorder_quantity, active, is_sellable, name on products
for each row
execute function sync_product_replenishment_request();

insert into settings (key, value)
values
  ('order_limits', '{"max_per_day": 999}'::jsonb),
  ('gateway_fees', '{"mercadopago": 0, "pix": 0, "debit_card": 0, "credit_card": 0}'::jsonb),
  (
    'cart_discounts',
    '{
      "enabled": true,
      "quantity_tiers": [
        { "min_items": 3, "rate": 0.03 },
        { "min_items": 5, "rate": 0.06 },
        { "min_items": 8, "rate": 0.09 },
        { "min_items": 12, "rate": 0.12 }
      ],
      "diversity_tiers": [
        { "min_unique_items": 3, "rate": 0.01 },
        { "min_unique_items": 5, "rate": 0.02 }
      ],
      "max_discount_rate": 0.15
    }'::jsonb
  ),
  (
    'site_content',
    '{
      "brandSubtitle": "Alimentacao inteligente sob encomenda",
      "headerBadge": "Producao sob encomenda",
      "heroEyebrow": "Alimentacao inteligente para rotina corrida",
      "heroTitle": "Comida pronta, saudavel e feita no tempo certo",
      "heroDescription": "Escolha os produtos do cardapio fixo, agende a melhor data e finalize em poucos passos.",
      "menuDiyLabel": "Faca voce mesmo",
      "menuDiyDescription": "Receitas saudaveis e praticas para apoiar sua rotina em casa.",
      "diyIntroTitle": "Como usar o Faca voce mesmo",
      "diyIntroText": "Este espaco foi criado para facilitar sua rotina. Alem das comidas prontas, reunimos receitas saudaveis e praticas para ajudar voce a comer bem com leveza durante a semana.",
      "recipeIngredientsTitle": "Ingredientes",
      "recipePreparationTitle": "Modo de preparo",
      "recipeEmptyText": "Informacao em preparacao.",
      "footerTitle": "Ta na Mao",
      "footerLine1": "Alimentacao saudavel pronta para quem tem rotina corrida.",
      "footerLine2": "Cardapio fixo, producao sob encomenda e organizacao semanal."
    }'::jsonb
  )
on conflict (key)
do nothing;

insert into replenishment_requests(
  product_id,
  product_name,
  current_stock,
  reorder_min_quantity,
  suggested_quantity,
  status,
  source
)
select
  id,
  coalesce(name, id),
  coalesce(stock_quantity, 0),
  coalesce(reorder_min_quantity, 0),
  greatest(coalesce(reorder_quantity, 0), coalesce(reorder_min_quantity, 0) - coalesce(stock_quantity, 0), 1),
  'open',
  'schema_seed'
from products
where coalesce(active, true)
  and coalesce(is_sellable, true)
  and coalesce(reorder_min_quantity, 0) > 0
  and coalesce(stock_quantity, 0) <= coalesce(reorder_min_quantity, 0)
on conflict (product_id) where status = 'open'
do update set
  product_name = excluded.product_name,
  current_stock = excluded.current_stock,
  reorder_min_quantity = excluded.reorder_min_quantity,
  suggested_quantity = excluded.suggested_quantity,
  updated_at = now();

notify pgrst, 'reload schema';
