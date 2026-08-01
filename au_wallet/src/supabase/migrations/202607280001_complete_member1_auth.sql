-- Member 1: Supabase Auth ownership, holder-account RLS, and login auditing.
-- Apply this migration before running the updated NestJS authentication module.

alter table wallet.holder_account
  add column if not exists auth_user_id uuid;

do $$
begin
  if exists (
    select 1
    from wallet.holder_account
    where auth_user_id is null
  ) then
    raise exception
      'wallet.holder_account contains rows without auth_user_id; backfill them before applying this migration';
  end if;
end
$$;

alter table wallet.holder_account
  alter column auth_user_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'holder_account_auth_user_id_fkey'
      and conrelid = 'wallet.holder_account'::regclass
  ) then
    alter table wallet.holder_account
      add constraint holder_account_auth_user_id_fkey
      foreign key (auth_user_id)
      references auth.users(id)
      on delete cascade;
  end if;
end
$$;

create unique index if not exists holder_account_auth_user_id_uidx
  on wallet.holder_account (auth_user_id);

create table if not exists wallet.login_history (
  login_history_id bigint generated always as identity primary key,
  auth_user_id uuid references auth.users(id) on delete set null,
  holder_account_id bigint
    references wallet.holder_account(holder_account_id) on delete set null,
  email text,
  ip_address inet,
  user_agent text,
  login_status text not null
    check (login_status in ('SUCCESS', 'FAILED', 'LOGGED_OUT')),
  failure_reason text,
  login_time timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists login_history_auth_user_id_login_time_idx
  on wallet.login_history (auth_user_id, login_time desc);

create index if not exists login_history_holder_account_id_idx
  on wallet.login_history (holder_account_id);

alter table wallet.holder_account enable row level security;
alter table wallet.login_history enable row level security;

drop policy if exists "holders can read their own account"
  on wallet.holder_account;

create policy "holders can read their own account"
  on wallet.holder_account
  for select
  to authenticated
  using ((select auth.uid()) = auth_user_id);

grant usage on schema wallet to authenticated, service_role;

revoke all on table wallet.holder_account from anon, authenticated;
grant select on table wallet.holder_account to authenticated;
grant all on table wallet.holder_account to service_role;

revoke all on table wallet.login_history from anon, authenticated;
grant all on table wallet.login_history to service_role;
grant usage, select on sequence wallet.login_history_login_history_id_seq
  to service_role;

comment on column wallet.holder_account.auth_user_id is
  'Immutable owner identity from auth.users.id; authorization must not use email matching.';

comment on table wallet.login_history is
  'Backend-only audit events for successful login, failed login, and logout.';
