-- Run this in the Supabase SQL Editor if product editing shows a schema cache error,
-- for example:
-- "Could not find the 'reorder_min_quantity' column of 'products' in the schema cache"
--
-- This script adds the product fields used by the current admin panel and reloads
-- the PostgREST schema cache.

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
  add column if not exists weekly_guide_note text,
  add column if not exists usage_contexts text[] not null default array[]::text[],
  add column if not exists ingredients text,
  add column if not exists preparation_method text,
  add column if not exists preparation_video_url text,
  add column if not exists preparation_video_path text,
  add column if not exists reorder_min_quantity integer default 0 check (reorder_min_quantity >= 0),
  add column if not exists reorder_quantity integer default 0 check (reorder_quantity >= 0);

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

create unique index if not exists idx_replenishment_requests_open_product
  on replenishment_requests(product_id)
  where status = 'open';

create index if not exists idx_replenishment_requests_status_created
  on replenishment_requests(status, created_at desc);

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

alter table if exists orders
  add column if not exists weekly_context_report jsonb not null default '{}'::jsonb;

comment on column orders.weekly_context_report is
  'Snapshot generated at checkout showing weekly eating contexts covered and suggested complements.';

notify pgrst, 'reload schema';
