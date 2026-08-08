-- Production rounds consolidate paid orders into purchase and production plans.
-- Kept server-only: access is granted exclusively to service_role and RLS is enabled.

create table if not exists production_rounds (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'orders_closed', 'purchasing', 'producing', 'packing', 'delivering', 'completed', 'canceled')),
  order_cutoff_at timestamptz not null,
  production_date date not null,
  delivery_date date not null,
  safety_margin_percent numeric(5, 2) not null default 0
    check (safety_margin_percent >= 0 and safety_margin_percent <= 100),
  demand_json jsonb not null default '[]'::jsonb,
  shopping_json jsonb not null default '[]'::jsonb,
  missing_requirements_json jsonb not null default '[]'::jsonb,
  summary_json jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (delivery_date >= production_date)
);

create table if not exists production_round_orders (
  production_round_id uuid not null references production_rounds(id) on delete cascade,
  order_id uuid not null references orders(id) on delete restrict,
  added_at timestamptz not null default now(),
  primary key (production_round_id, order_id),
  unique (order_id)
);

create index if not exists idx_production_rounds_status_dates
  on production_rounds(status, production_date, delivery_date);

create index if not exists idx_production_round_orders_order
  on production_round_orders(order_id);

alter table production_rounds enable row level security;
alter table production_round_orders enable row level security;

revoke all on table production_rounds from anon, authenticated;
revoke all on table production_round_orders from anon, authenticated;
grant select, insert, update, delete on table production_rounds to service_role;
grant select, insert, update, delete on table production_round_orders to service_role;

comment on table production_rounds is
  'Operational cycle that turns paid orders into consolidated demand, shopping and production plans.';

comment on table production_round_orders is
  'Orders reserved by a production round. An order can belong to only one round.';

