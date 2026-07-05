-- Password reset support for the internal panel.
-- Run this once in the Supabase SQL Editor.

alter table if exists employees
  add column if not exists password_reset_token_hash text,
  add column if not exists password_reset_expires_at timestamptz,
  add column if not exists password_reset_requested_at timestamptz;

create index if not exists idx_employees_password_reset_token_hash
  on employees(password_reset_token_hash)
  where password_reset_token_hash is not null;

notify pgrst, 'reload schema';
