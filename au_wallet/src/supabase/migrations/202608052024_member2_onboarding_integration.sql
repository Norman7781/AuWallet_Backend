-- Member 2: backend-only onboarding permissions, RLS hardening, and
-- atomic issuer approval and verified-onboarding activation.
--
-- Prerequisite: 202607280001_complete_member1_auth.sql has been applied.
-- Expected live state before this migration:
--   - the approved academic fixture counts are unchanged;
--   - auth.users and all wallet application tables are empty;
--   - wallet.holder_account.auth_user_id and wallet.login_history exist;
--   - the original onboarding state check and global candidate uniqueness
--     constraint still exist;
--   - this migration's replacement constraints, function, and indexes do not
--     exist.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

select pg_advisory_xact_lock(
  hashtextextended('au_wallet_member2_onboarding_integration_v1', 0)
);

-- Parse the approved legacy check against columns copied from the live table.
-- Comparing PostgreSQL expression trees avoids whitespace-sensitive SQL text
-- checks and rejects a same-named constraint with different behavior.
create temporary table expected_legacy_wallet_onboarding_state
  on commit drop
  as select
    verification_status,
    matched_enrollment_id,
    rejection_reason
  from wallet.wallet_onboarding_request
  with no data;

alter table expected_legacy_wallet_onboarding_state
  add constraint expected_legacy_wallet_onboarding_state_check check (
    (
      verification_status = 'matched'
      and matched_enrollment_id is not null
      and rejection_reason is null
    )
    or (
      verification_status = 'rejected'
      and matched_enrollment_id is null
      and rejection_reason is not null
    )
    or (
      verification_status in ('submitted', 'under_review')
      and matched_enrollment_id is null
    )
  );

do $preflight$
declare
  v_actual_legacy_state_expression text;
  v_expected_legacy_state_expression text;
begin
  if to_regclass('academic.student') is null
    or to_regclass('academic.student_program_enrollment') is null
    or to_regclass('wallet.holder_account') is null
    or to_regclass('wallet.wallet_onboarding_request') is null
    or to_regclass('wallet.uploaded_identity_document') is null
  then
    raise exception
      'Member 2 migration preflight failed: a required application table is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'wallet'
      and table_name = 'holder_account'
      and column_name = 'auth_user_id'
      and data_type = 'uuid'
      and is_nullable = 'NO'
  ) then
    raise exception
      'Member 2 migration preflight failed: apply the approved Member 1 migration first';
  end if;

  if to_regclass('wallet.login_history') is null
    or to_regclass('wallet.login_history_login_history_id_seq') is null
  then
    raise exception
      'Member 2 migration preflight failed: Member 1 login-history objects are missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'holder_account_auth_user_id_fkey'
      and conrelid = 'wallet.holder_account'::regclass
  ) or to_regclass('wallet.holder_account_auth_user_id_uidx') is null
  then
    raise exception
      'Member 2 migration preflight failed: holder ownership constraints are missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'wallet'
      and tablename = 'holder_account'
      and policyname = 'holders can read their own account'
      and cmd = 'SELECT'
      and 'authenticated' = any(roles)
  ) then
    raise exception
      'Member 2 migration preflight failed: Member 1 holder policy is missing';
  end if;

  if (select count(*) from academic.program) <> 1
    or (select count(*) from academic.student) <> 20
    or (select count(*) from academic.student_program_enrollment) <> 20
    or (select count(*) from academic.course) <> 74
    or (select count(*) from academic.academic_term) <> 12
    or (select count(*) from academic.course_result) <> 649
    or (select count(*) from academic.transcript) <> 10
    or (select count(*) from academic.graduation_record) <> 10
  then
    raise exception
      'Member 2 migration preflight failed: academic fixture counts differ from the approved state';
  end if;

  if exists (select 1 from auth.users)
    or exists (select 1 from wallet.holder_account)
    or exists (select 1 from wallet.wallet_onboarding_request)
    or exists (select 1 from wallet.uploaded_identity_document)
    or exists (select 1 from wallet.login_history)
  then
    raise exception
      'Member 2 migration preflight failed: Auth or wallet data exists; stop for review';
  end if;

  select pg_get_expr(
    constraint_record.conbin,
    constraint_record.conrelid,
    true
  )
  into v_actual_legacy_state_expression
  from pg_constraint as constraint_record
  where constraint_record.conrelid =
      'wallet.wallet_onboarding_request'::regclass
    and constraint_record.conname = 'wallet_onboarding_request_check'
    and constraint_record.contype = 'c'
    and constraint_record.convalidated;

  select pg_get_expr(
    constraint_record.conbin,
    constraint_record.conrelid,
    true
  )
  into v_expected_legacy_state_expression
  from pg_constraint as constraint_record
  where constraint_record.conrelid =
      'pg_temp.expected_legacy_wallet_onboarding_state'::regclass
    and constraint_record.conname =
      'expected_legacy_wallet_onboarding_state_check'
    and constraint_record.contype = 'c'
    and constraint_record.convalidated;

  if v_actual_legacy_state_expression is null
    or v_actual_legacy_state_expression is distinct from
      v_expected_legacy_state_expression
  then
    raise exception
      'Member 2 migration preflight failed: the original onboarding state check differs';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'wallet.wallet_onboarding_request'::regclass
      and conname = 'wallet_onboarding_request_matched_enrollment_id_key'
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (matched_enrollment_id)'
  ) then
    raise exception
      'Member 2 migration preflight failed: the original global candidate uniqueness constraint differs';
  end if;

  if to_regclass('wallet.one_active_onboarding_request_per_holder_idx')
      is not null
    or to_regclass(
      'wallet.one_active_candidate_per_enrollment_idx'
    ) is not null
    or exists (
      select 1
      from pg_constraint
      where conrelid = 'wallet.wallet_onboarding_request'::regclass
        and conname = 'wallet_onboarding_request_state_check'
    )
    or to_regprocedure(
      'wallet.approve_onboarding_request(bigint,uuid)'
    ) is not null
  then
    raise exception
      'Member 2 migration preflight failed: follow-up objects already exist';
  end if;
end
$preflight$;

-- These schemas are used only by the trusted NestJS backend. Browser roles
-- receive no new academic or onboarding-table privileges.
grant usage on schema academic, wallet to service_role;

revoke all on table
  academic.program,
  academic.student,
  academic.academic_term,
  academic.student_program_enrollment,
  academic.course,
  academic.course_result,
  academic.transcript,
  academic.graduation_record
from service_role;

grant select on table
  academic.program,
  academic.student,
  academic.student_program_enrollment,
  academic.graduation_record
to service_role;

revoke all on table
  wallet.holder_account,
  wallet.login_history,
  wallet.wallet_onboarding_request,
  wallet.uploaded_identity_document
from service_role;

grant select, insert, update on table wallet.holder_account to service_role;
grant insert on table wallet.login_history to service_role;
grant select, insert, update on table wallet.wallet_onboarding_request
  to service_role;

-- Both browser applications call NestJS. Member 1's own-holder policy remains
-- defined, but browser roles have no table privilege with which to use it.
revoke all on table wallet.holder_account from anon, authenticated;

revoke all on table
  academic.program,
  academic.student,
  academic.academic_term,
  academic.student_program_enrollment,
  academic.course,
  academic.course_result,
  academic.transcript,
  academic.graduation_record,
  wallet.login_history,
  wallet.wallet_onboarding_request,
  wallet.uploaded_identity_document
from anon, authenticated;

revoke all on sequence
  wallet.holder_account_holder_account_id_seq,
  wallet.login_history_login_history_id_seq,
  wallet.wallet_onboarding_request_onboarding_request_id_seq
from anon, authenticated, service_role;

grant usage on sequence
  wallet.holder_account_holder_account_id_seq,
  wallet.login_history_login_history_id_seq,
  wallet.wallet_onboarding_request_onboarding_request_id_seq
to service_role;

-- RLS is defense in depth for every application table in the exposed custom
-- schemas. No browser policy is added for academic or onboarding data.
alter table academic.program enable row level security;
alter table academic.student enable row level security;
alter table academic.academic_term enable row level security;
alter table academic.student_program_enrollment enable row level security;
alter table academic.course enable row level security;
alter table academic.course_result enable row level security;
alter table academic.transcript enable row level security;
alter table academic.graduation_record enable row level security;
alter table wallet.holder_account enable row level security;
alter table wallet.login_history enable row level security;
alter table wallet.wallet_onboarding_request enable row level security;
alter table wallet.uploaded_identity_document enable row level security;

-- Replace the original state constraint. Exact eligible candidates may remain
-- attached during issuer review and after rejection, while completed matches
-- require complete reviewer metadata.
alter table wallet.wallet_onboarding_request
  drop constraint wallet_onboarding_request_check;

alter table wallet.wallet_onboarding_request
  add constraint wallet_onboarding_request_state_check check (
    (
      verification_status = 'submitted'
      and matched_enrollment_id is null
      and rejection_reason is null
      and reviewed_by is null
      and reviewed_at is null
    )
    or (
      verification_status = 'under_review'
      and rejection_reason is null
      and reviewed_by is null
      and reviewed_at is null
    )
    or (
      verification_status = 'matched'
      and matched_enrollment_id is not null
      and rejection_reason is null
      and reviewed_by is not null
      and reviewed_at is not null
    )
    or (
      verification_status = 'rejected'
      and rejection_reason is not null
      and (
        (reviewed_by is null and reviewed_at is null)
        or (reviewed_by is not null and reviewed_at is not null)
      )
    )
  );

-- The original constraint owned a global unique index. Active candidate
-- ownership is unique, while rejected history remains resubmittable.
alter table wallet.wallet_onboarding_request
  drop constraint wallet_onboarding_request_matched_enrollment_id_key;

create unique index one_active_candidate_per_enrollment_idx
  on wallet.wallet_onboarding_request (matched_enrollment_id)
  where matched_enrollment_id is not null
    and verification_status in ('under_review', 'matched');

-- Prevent concurrent requests from creating more than one active onboarding
-- workflow for the same holder. Rejected requests remain resubmittable.
create unique index one_active_onboarding_request_per_holder_idx
  on wallet.wallet_onboarding_request (holder_account_id)
  where verification_status in ('submitted', 'under_review', 'matched');

create function wallet.approve_onboarding_request(
  p_onboarding_request_id bigint,
  p_reviewed_by uuid
)
returns table (
  onboarding_request_id bigint,
  holder_account_id bigint,
  verification_status text,
  matched_enrollment_id bigint,
  rejection_reason text,
  reviewed_at timestamptz,
  submitted_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_holder_account_id bigint;
  v_holder_status text;
  v_admission_no text;
  v_date_of_birth date;
  v_passport_number_hmac text;
  v_candidate_enrollment_id bigint;
  v_eligible_enrollment_count bigint;
  v_sole_eligible_enrollment_id bigint;
  v_submitted_at timestamptz;
  v_now timestamptz := statement_timestamp();
begin
  if p_onboarding_request_id is null
    or p_onboarding_request_id <= 0
    or p_reviewed_by is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Onboarding request could not be approved';
  end if;

  select
    request.holder_account_id,
    request.admission_no,
    request.date_of_birth,
    request.passport_number_hmac,
    request.matched_enrollment_id,
    request.submitted_at
  into
    v_holder_account_id,
    v_admission_no,
    v_date_of_birth,
    v_passport_number_hmac,
    v_candidate_enrollment_id,
    v_submitted_at
  from wallet.wallet_onboarding_request as request
  where request.onboarding_request_id = p_onboarding_request_id
    and request.verification_status = 'under_review'
  for update;

  if not found
    or v_candidate_enrollment_id is null
    or v_candidate_enrollment_id <= 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'Onboarding request could not be approved';
  end if;

  select holder.account_status
  into v_holder_status
  from wallet.holder_account as holder
  where holder.holder_account_id = v_holder_account_id
  for update;

  if not found or v_holder_status <> 'pending' then
    raise exception using
      errcode = 'P0001',
      message = 'Onboarding request could not be approved';
  end if;

  select
    count(*),
    min(enrollment.enrollment_id)
  into
    v_eligible_enrollment_count,
    v_sole_eligible_enrollment_id
  from academic.student_program_enrollment as enrollment
  join academic.student as student
    on student.student_id = enrollment.student_id
  where enrollment.academic_status in ('studying', 'graduated', 'alumni')
    and student.admission_no = v_admission_no
    and student.date_of_birth = v_date_of_birth
    and student.passport_number_hmac = v_passport_number_hmac;

  if v_eligible_enrollment_count <> 1
    or v_sole_eligible_enrollment_id is distinct from v_candidate_enrollment_id
  then
    raise exception using
      errcode = 'P0001',
      message = 'Onboarding request could not be approved';
  end if;

  update wallet.wallet_onboarding_request as request
  set verification_status = 'matched',
      reviewed_by = p_reviewed_by,
      reviewed_at = v_now,
      rejection_reason = null
  where request.onboarding_request_id = p_onboarding_request_id
    and request.verification_status = 'under_review'
    and request.matched_enrollment_id = v_candidate_enrollment_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Onboarding request could not be approved';
  end if;

  update wallet.holder_account as holder
  set account_status = 'active',
      confirmed_at = coalesce(holder.confirmed_at, v_now),
      updated_at = v_now
  where holder.holder_account_id = v_holder_account_id
    and holder.account_status = 'pending';

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Onboarding request could not be approved';
  end if;

  return query
  select
    p_onboarding_request_id,
    v_holder_account_id,
    'matched'::text,
    v_candidate_enrollment_id,
    null::text,
    v_now,
    v_submitted_at;
end
$function$;

revoke all on function wallet.approve_onboarding_request(
  bigint,
  uuid
) from public, anon, authenticated;

grant execute on function wallet.approve_onboarding_request(
  bigint,
  uuid
) to service_role;

comment on function wallet.approve_onboarding_request(
  bigint,
  uuid
) is
  'Backend-only issuer approval that atomically revalidates one eligible enrollment and activates its pending holder.';

-- Build transaction-local reference objects from the actual column types. The
-- postflight compares PostgreSQL's parsed expressions, so a constraint or
-- predicate with merely the right name cannot pass validation.
create temporary table expected_wallet_onboarding_state
  on commit drop
  as select
    verification_status,
    matched_enrollment_id,
    rejection_reason,
    reviewed_by,
    reviewed_at
  from wallet.wallet_onboarding_request
  with no data;

alter table expected_wallet_onboarding_state
  add constraint expected_wallet_onboarding_state_check check (
    (
      verification_status = 'submitted'
      and matched_enrollment_id is null
      and rejection_reason is null
      and reviewed_by is null
      and reviewed_at is null
    )
    or (
      verification_status = 'under_review'
      and rejection_reason is null
      and reviewed_by is null
      and reviewed_at is null
    )
    or (
      verification_status = 'matched'
      and matched_enrollment_id is not null
      and rejection_reason is null
      and reviewed_by is not null
      and reviewed_at is not null
    )
    or (
      verification_status = 'rejected'
      and rejection_reason is not null
      and (
        (reviewed_by is null and reviewed_at is null)
        or (reviewed_by is not null and reviewed_at is not null)
      )
    )
  );

create unique index expected_active_candidate_per_enrollment_idx
  on expected_wallet_onboarding_state (matched_enrollment_id)
  where matched_enrollment_id is not null
    and verification_status in ('under_review', 'matched');

do $postflight$
declare
  v_actual_state_expression text;
  v_expected_state_expression text;
  v_actual_candidate_predicate text;
  v_expected_candidate_predicate text;
begin
  if to_regclass('wallet.one_active_onboarding_request_per_holder_idx')
      is null
    or to_regclass(
      'wallet.one_active_candidate_per_enrollment_idx'
    ) is null
    or to_regprocedure(
      'wallet.approve_onboarding_request(bigint,uuid)'
    ) is null
  then
    raise exception
      'Member 2 migration postflight failed: integration objects are missing';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'wallet.wallet_onboarding_request'::regclass
      and conname = 'wallet_onboarding_request_check'
  ) then
    raise exception
      'Member 2 migration postflight failed: the original onboarding state check remains';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'wallet.wallet_onboarding_request'::regclass
      and conname = 'wallet_onboarding_request_matched_enrollment_id_key'
  ) or to_regclass(
    'wallet.wallet_onboarding_request_matched_enrollment_id_key'
  ) is not null
  then
    raise exception
      'Member 2 migration postflight failed: the global candidate uniqueness constraint remains';
  end if;

  select pg_get_expr(constraint_record.conbin, constraint_record.conrelid, true)
  into v_actual_state_expression
  from pg_constraint as constraint_record
  where constraint_record.conrelid =
      'wallet.wallet_onboarding_request'::regclass
    and constraint_record.conname =
      'wallet_onboarding_request_state_check'
    and constraint_record.contype = 'c'
    and constraint_record.convalidated;

  select pg_get_expr(constraint_record.conbin, constraint_record.conrelid, true)
  into v_expected_state_expression
  from pg_constraint as constraint_record
  where constraint_record.conrelid =
      'pg_temp.expected_wallet_onboarding_state'::regclass
    and constraint_record.conname =
      'expected_wallet_onboarding_state_check'
    and constraint_record.contype = 'c'
    and constraint_record.convalidated;

  if v_actual_state_expression is null
    or v_actual_state_expression is distinct from v_expected_state_expression
  then
    raise exception
      'Member 2 migration postflight failed: the replacement onboarding state constraint differs';
  end if;

  if not exists (
    select 1
    from pg_index as index_record
    where index_record.indexrelid =
      'wallet.one_active_candidate_per_enrollment_idx'::regclass
      and index_record.indrelid =
        'wallet.wallet_onboarding_request'::regclass
      and index_record.indisunique
      and index_record.indisvalid
      and index_record.indnkeyatts = 1
      and index_record.indkey[0] = (
        select attribute.attnum
        from pg_attribute as attribute
        where attribute.attrelid =
          'wallet.wallet_onboarding_request'::regclass
          and attribute.attname = 'matched_enrollment_id'
          and not attribute.attisdropped
      )
  ) then
    raise exception
      'Member 2 migration postflight failed: the active candidate index columns or uniqueness differ';
  end if;

  select pg_get_expr(index_record.indpred, index_record.indrelid, true)
  into v_actual_candidate_predicate
  from pg_index as index_record
  where index_record.indexrelid =
    'wallet.one_active_candidate_per_enrollment_idx'::regclass;

  select pg_get_expr(index_record.indpred, index_record.indrelid, true)
  into v_expected_candidate_predicate
  from pg_index as index_record
  where index_record.indexrelid =
    'pg_temp.expected_active_candidate_per_enrollment_idx'::regclass;

  if v_actual_candidate_predicate is null
    or v_actual_candidate_predicate is distinct from
      v_expected_candidate_predicate
  then
    raise exception
      'Member 2 migration postflight failed: the active candidate index predicate differs';
  end if;

  if exists (
    select 1
    from (
      values
        ('academic.program'::regclass),
        ('academic.student'::regclass),
        ('academic.academic_term'::regclass),
        ('academic.student_program_enrollment'::regclass),
        ('academic.course'::regclass),
        ('academic.course_result'::regclass),
        ('academic.transcript'::regclass),
        ('academic.graduation_record'::regclass),
        ('wallet.holder_account'::regclass),
        ('wallet.login_history'::regclass),
        ('wallet.wallet_onboarding_request'::regclass),
        ('wallet.uploaded_identity_document'::regclass)
    ) as targets(table_oid)
    join pg_class on pg_class.oid = targets.table_oid
    where not pg_class.relrowsecurity
  ) then
    raise exception
      'Member 2 migration postflight failed: RLS is not enabled everywhere expected';
  end if;

  if not has_schema_privilege('service_role', 'academic', 'USAGE')
    or not has_schema_privilege('service_role', 'wallet', 'USAGE')
    or not has_table_privilege(
      'service_role',
      'academic.program',
      'SELECT'
    )
    or not has_table_privilege(
      'service_role',
      'academic.student',
      'SELECT'
    )
    or not has_table_privilege(
      'service_role',
      'academic.graduation_record',
      'SELECT'
    )
    or not has_table_privilege(
      'service_role',
      'academic.student_program_enrollment',
      'SELECT'
    )
    or not has_table_privilege(
      'service_role',
      'wallet.holder_account',
      'SELECT'
    )
    or not has_table_privilege(
      'service_role',
      'wallet.holder_account',
      'INSERT'
    )
    or not has_table_privilege(
      'service_role',
      'wallet.holder_account',
      'UPDATE'
    )
    or not has_table_privilege(
      'service_role',
      'wallet.wallet_onboarding_request',
      'SELECT'
    )
    or not has_table_privilege(
      'service_role',
      'wallet.wallet_onboarding_request',
      'INSERT'
    )
    or not has_table_privilege(
      'service_role',
      'wallet.wallet_onboarding_request',
      'UPDATE'
    )
    or not has_table_privilege(
      'service_role',
      'wallet.login_history',
      'INSERT'
    )
    or not has_function_privilege(
      'service_role',
      'wallet.approve_onboarding_request(bigint,uuid)',
      'EXECUTE'
    )
    or not has_sequence_privilege(
      'service_role',
      'wallet.holder_account_holder_account_id_seq',
      'USAGE'
    )
    or not has_sequence_privilege(
      'service_role',
      'wallet.login_history_login_history_id_seq',
      'USAGE'
    )
    or not has_sequence_privilege(
      'service_role',
      'wallet.wallet_onboarding_request_onboarding_request_id_seq',
      'USAGE'
    )
  then
    raise exception
      'Member 2 migration postflight failed: backend privileges are incomplete';
  end if;

  if (
    select count(*)
    from (
      values
        ('academic.program'),
        ('academic.student'),
        ('academic.academic_term'),
        ('academic.student_program_enrollment'),
        ('academic.course'),
        ('academic.course_result'),
        ('academic.transcript'),
        ('academic.graduation_record')
    ) as academic_tables(table_name)
    where has_table_privilege(
      'service_role',
      academic_tables.table_name,
      'SELECT'
    )
  ) <> 4
  then
    raise exception
      'Member 2 migration postflight failed: service_role academic read scope is not exactly four tables';
  end if;

  if exists (
    select 1
    from (
      values
        ('academic.program'),
        ('academic.student'),
        ('academic.academic_term'),
        ('academic.student_program_enrollment'),
        ('academic.course'),
        ('academic.course_result'),
        ('academic.transcript'),
        ('academic.graduation_record')
    ) as academic_tables(table_name)
    where has_table_privilege(
      'service_role',
      academic_tables.table_name,
      'INSERT'
    )
      or has_table_privilege(
        'service_role',
        academic_tables.table_name,
        'UPDATE'
      )
      or has_table_privilege(
        'service_role',
        academic_tables.table_name,
        'DELETE'
      )
      or has_table_privilege(
        'service_role',
        academic_tables.table_name,
        'TRUNCATE'
      )
      or has_table_privilege(
        'service_role',
        academic_tables.table_name,
        'REFERENCES'
      )
      or has_table_privilege(
        'service_role',
        academic_tables.table_name,
        'TRIGGER'
      )
  ) then
    raise exception
      'Member 2 migration postflight failed: service_role has non-read academic privileges';
  end if;

  if exists (
    select 1
    from (
      values ('anon'), ('authenticated')
    ) as browser_roles(role_name)
    cross join (
      values
        ('academic.program'::regclass),
        ('academic.student'::regclass),
        ('academic.academic_term'::regclass),
        ('academic.student_program_enrollment'::regclass),
        ('academic.course'::regclass),
        ('academic.course_result'::regclass),
        ('academic.transcript'::regclass),
        ('academic.graduation_record'::regclass),
        ('wallet.holder_account'::regclass),
        ('wallet.login_history'::regclass),
        ('wallet.wallet_onboarding_request'::regclass),
        ('wallet.uploaded_identity_document'::regclass)
    ) as application_tables(table_oid)
    cross join (
      values
        ('SELECT'),
        ('INSERT'),
        ('UPDATE'),
        ('DELETE'),
        ('TRUNCATE'),
        ('REFERENCES'),
        ('TRIGGER')
    ) as table_privileges(privilege_name)
    where has_table_privilege(
      browser_roles.role_name,
      application_tables.table_oid,
      table_privileges.privilege_name
    )
  )
  then
    raise exception
      'Member 2 migration postflight failed: a browser role has direct application-table access';
  end if;

  if has_function_privilege(
      'anon',
      'wallet.approve_onboarding_request(bigint,uuid)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'wallet.approve_onboarding_request(bigint,uuid)',
      'EXECUTE'
    )
  then
    raise exception
      'Member 2 migration postflight failed: a browser role can execute the approval function';
  end if;

  if has_table_privilege(
      'service_role',
      'wallet.holder_account',
      'DELETE'
    )
    or has_table_privilege(
      'service_role',
      'wallet.login_history',
      'SELECT'
    )
    or has_table_privilege(
      'service_role',
      'wallet.login_history',
      'UPDATE'
    )
    or has_table_privilege(
      'service_role',
      'wallet.login_history',
      'DELETE'
    )
    or has_table_privilege(
      'service_role',
      'wallet.wallet_onboarding_request',
      'DELETE'
    )
    or has_table_privilege(
      'service_role',
      'wallet.uploaded_identity_document',
      'SELECT'
    )
    or has_table_privilege(
      'service_role',
      'wallet.uploaded_identity_document',
      'INSERT'
    )
    or has_table_privilege(
      'service_role',
      'wallet.uploaded_identity_document',
      'UPDATE'
    )
    or has_table_privilege(
      'service_role',
      'wallet.uploaded_identity_document',
      'DELETE'
    )
  then
    raise exception
      'Member 2 migration postflight failed: least-privilege contract violated';
  end if;

  if exists (select 1 from auth.users)
    or exists (select 1 from wallet.holder_account)
    or exists (select 1 from wallet.wallet_onboarding_request)
    or exists (select 1 from wallet.uploaded_identity_document)
    or exists (select 1 from wallet.login_history)
  then
    raise exception
      'Member 2 migration postflight failed: the migration changed application data';
  end if;
end
$postflight$;

notify pgrst, 'reload schema';

commit;
