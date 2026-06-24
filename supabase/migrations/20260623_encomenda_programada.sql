-- Base para o modelo Ta na Mao: cardapio fixo, produtos pereciveis e venda sob encomenda.
-- A migracao e aditiva para preservar as tabelas atuais.

alter table if exists products
  add column if not exists stock_quantity integer default 0,
  add column if not exists category text,
  add column if not exists serving_size text,
  add column if not exists shelf_life_days integer,
  add column if not exists storage_instructions text,
  add column if not exists lead_time_hours integer default 24,
  add column if not exists available_days text[] default array[]::text[],
  add column if not exists max_units_per_day integer,
  add column if not exists is_sellable boolean default true,
  add column if not exists is_gift_recipe boolean default false,
  add column if not exists weekly_guide_note text;

alter table if exists orders
  add column if not exists scheduled_delivery_date date,
  add column if not exists delivery_window text,
  add column if not exists fulfillment_type text default 'delivery',
  add column if not exists production_started_at timestamptz,
  add column if not exists production_finished_at timestamptz;

create table if not exists product_daily_capacities (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references products(id) on delete cascade,
  production_date date not null,
  max_units integer not null check (max_units >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, production_date)
);

create index if not exists idx_orders_scheduled_delivery_date
  on orders(scheduled_delivery_date);

create index if not exists idx_product_daily_capacities_date
  on product_daily_capacities(production_date);

create table if not exists payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id text not null unique,
  order_id uuid references orders(id) on delete cascade,
  external_reference text,
  processed_at timestamptz not null default now()
);

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

create index if not exists idx_product_stock_movements_product
  on product_stock_movements(product_id);

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
