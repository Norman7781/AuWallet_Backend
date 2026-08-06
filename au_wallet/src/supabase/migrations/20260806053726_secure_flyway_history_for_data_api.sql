begin;

do $preflight$
begin
  if pg_catalog.to_regclass('wallet.flyway_schema_history') is null then
    raise exception 'Required table wallet.flyway_schema_history does not exist';
  end if;
end
$preflight$;

alter table wallet.flyway_schema_history enable row level security;

revoke all privileges
  on table wallet.flyway_schema_history
  from anon, authenticated, service_role;

do $postflight$
declare
  rls_enabled boolean;
  checked_role text;
begin
  if pg_catalog.to_regclass('wallet.flyway_schema_history') is null then
    raise exception 'Postflight failed: wallet.flyway_schema_history does not exist';
  end if;

  select table_class.relrowsecurity
  into rls_enabled
  from pg_catalog.pg_class as table_class
  join pg_catalog.pg_namespace as table_schema
    on table_schema.oid = table_class.relnamespace
  where table_schema.nspname = 'wallet'
    and table_class.relname = 'flyway_schema_history'
    and table_class.relkind in ('r', 'p');

  if rls_enabled is distinct from true then
    raise exception 'Postflight failed: RLS is not enabled on wallet.flyway_schema_history';
  end if;

  foreach checked_role in array array['anon', 'authenticated', 'service_role']
  loop
    if pg_catalog.has_table_privilege(
      checked_role,
      'wallet.flyway_schema_history',
      'SELECT'
    ) or pg_catalog.has_table_privilege(
      checked_role,
      'wallet.flyway_schema_history',
      'INSERT'
    ) or pg_catalog.has_table_privilege(
      checked_role,
      'wallet.flyway_schema_history',
      'UPDATE'
    ) or pg_catalog.has_table_privilege(
      checked_role,
      'wallet.flyway_schema_history',
      'DELETE'
    ) or pg_catalog.has_table_privilege(
      checked_role,
      'wallet.flyway_schema_history',
      'TRUNCATE'
    ) or pg_catalog.has_table_privilege(
      checked_role,
      'wallet.flyway_schema_history',
      'REFERENCES'
    ) or pg_catalog.has_table_privilege(
      checked_role,
      'wallet.flyway_schema_history',
      'TRIGGER'
    ) then
      raise exception 'Postflight failed: role % retains privileges on wallet.flyway_schema_history',
        checked_role;
    end if;
  end loop;
end
$postflight$;

commit;
