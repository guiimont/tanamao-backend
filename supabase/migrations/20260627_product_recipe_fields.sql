-- Product recipe fields.
-- For sellable products these fields are internal production data.
-- For free recipe products they can be shown on the public site.

alter table if exists products
  add column if not exists ingredients text,
  add column if not exists preparation_method text,
  add column if not exists preparation_video_url text,
  add column if not exists preparation_video_path text;

comment on column products.ingredients is 'Ingredients / product formula. Public only for free recipe products.';
comment on column products.preparation_method is 'Preparation method. Public only for free recipe products.';
comment on column products.preparation_video_url is 'Preparation video public URL. Public only for free recipe products.';
comment on column products.preparation_video_path is 'Supabase Storage path for the preparation video.';

notify pgrst, 'reload schema';
