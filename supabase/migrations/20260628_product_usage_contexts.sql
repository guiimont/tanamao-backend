-- Product usage contexts for the icon guide.
-- These tags identify the best moment or situation to use each product/recipe.

alter table if exists products
  add column if not exists usage_contexts text[] not null default array[]::text[];

comment on column products.usage_contexts is
  'Icon guide tags: breakfast, work, lunch_dinner, quick_snack.';

alter table if exists orders
  add column if not exists weekly_context_report jsonb not null default '{}'::jsonb;

comment on column orders.weekly_context_report is
  'Snapshot generated at checkout showing weekly eating contexts covered and suggested complements.';

notify pgrst, 'reload schema';
