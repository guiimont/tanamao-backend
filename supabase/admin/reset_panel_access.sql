-- Use no Supabase SQL Editor quando precisar recuperar acesso ao painel.
-- Substitua os placeholders antes de executar.

-- 1) Ver usuarios cadastrados:
select id, name, email, role, created_at
from employees
order by created_at desc;

-- 2) Resetar senha de um usuario existente:
update employees
   set password_hash = '<BCRYPT_HASH_AQUI>'
 where email = '<EMAIL_DO_USUARIO>';

-- 3) Se nao existir nenhum admin, crie um:
insert into employees (name, email, password_hash, role)
select 'Guilherme', '<SEU_EMAIL>', '<BCRYPT_HASH_AQUI>', 'admin'
where not exists (
  select 1 from employees where email = '<SEU_EMAIL>'
);

-- 4) Garantir que o usuario escolhido seja admin:
update employees
   set role = 'admin'
 where email = '<SEU_EMAIL>';
