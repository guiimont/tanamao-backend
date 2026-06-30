-- Run this in the Supabase SQL Editor before testing preparation videos.
-- It adds the product columns used by the admin panel and public "Faça você mesmo" recipe view.

alter table if exists products
  add column if not exists preparation_video_url text,
  add column if not exists preparation_video_path text;

comment on column products.preparation_video_url is
  'Preparation video public URL. Public only for free recipe products.';

comment on column products.preparation_video_path is
  'Supabase Storage path for the preparation video.';

notify pgrst, 'reload schema';
