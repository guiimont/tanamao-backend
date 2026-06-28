-- Run this in the Supabase SQL Editor if the panel shows:
-- "Could not find the table 'public.production_ingredients' in the schema cache"
--
-- This script is idempotent and ends by asking PostgREST to reload the schema cache.

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

alter table production_ingredients
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

create index if not exists idx_product_ingredient_requirements_product
  on product_ingredient_requirements(product_id);

create index if not exists idx_product_ingredient_requirements_ingredient
  on product_ingredient_requirements(ingredient_id);

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

create index if not exists idx_production_shopping_lists_status_created
  on production_shopping_lists(status, created_at desc);

comment on table production_ingredients is 'Internal ingredient catalog used by product technical sheets.';
comment on table product_ingredient_requirements is 'Structured bill of materials: ingredient quantity required to produce one unit of a product.';
comment on table production_shopping_lists is 'Generated internal shopping lists based on planned production.';

notify pgrst, 'reload schema';
