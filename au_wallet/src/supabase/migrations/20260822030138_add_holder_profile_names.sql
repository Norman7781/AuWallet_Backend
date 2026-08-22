-- Store the registration names with the wallet profile.  The verified AU
-- student number deliberately remains derived from the verified connection,
-- so it cannot be populated from a self-submitted onboarding value.

alter table wallet.holder_account
  add column if not exists first_name text,
  add column if not exists last_name text;

update wallet.holder_account as holder
set first_name = coalesce(
      nullif(btrim(holder.first_name), ''),
      nullif(btrim(auth_user.raw_user_meta_data ->> 'first_name'), '')
    ),
    last_name = coalesce(
      nullif(btrim(holder.last_name), ''),
      nullif(btrim(auth_user.raw_user_meta_data ->> 'last_name'), '')
    )
from auth.users as auth_user
where auth_user.id = holder.auth_user_id
  and (holder.first_name is null or holder.last_name is null);

do $$
begin
  if exists (
    select 1
    from wallet.holder_account
    where nullif(btrim(first_name), '') is null
       or nullif(btrim(last_name), '') is null
  ) then
    raise exception
      'wallet.holder_account contains rows without registration names; backfill them before applying this migration';
  end if;
end
$$;

alter table wallet.holder_account
  alter column first_name set not null,
  alter column last_name set not null;

comment on column wallet.holder_account.first_name is
  'Name supplied at wallet registration; not used for authorization or AU identity matching.';

comment on column wallet.holder_account.last_name is
  'Name supplied at wallet registration; not used for authorization or AU identity matching.';
