-- Decouple the wallet account lifecycle from issuer verification and add the
-- prototype issuer-provider catalog and holder/provider connection boundary.
--
-- This follow-up migration intentionally preserves wallet.wallet_onboarding_request
-- and every existing row. The legacy name remains for migration compatibility;
-- application APIs use issuer-verification terminology.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

select pg_advisory_xact_lock(
  hashtextextended('au_wallet_issuer_connections_v1', 0)
);

-- Transaction-local snapshots prove this migration does not change academic,
-- Auth, holder, document, Storage, or protected request-history values.
create temporary table issuer_connection_preflight_counts on commit drop as
select
  (select count(*) from academic.program) as program_count,
  (select count(*) from academic.student) as student_count,
  (select count(*) from academic.student_program_enrollment) as enrollment_count,
  (select count(*) from academic.course) as course_count,
  (select count(*) from academic.academic_term) as term_count,
  (select count(*) from academic.course_result) as result_count,
  (select count(*) from academic.transcript) as transcript_count,
  (select count(*) from academic.graduation_record) as graduation_count,
  (select count(*) from auth.users) as auth_user_count,
  (select count(*) from wallet.holder_account) as holder_count,
  (select count(*) from wallet.wallet_onboarding_request) as request_count,
  (select count(*) from wallet.uploaded_identity_document) as document_count,
  (select count(*) from storage.objects) as storage_object_count;

create temporary table issuer_connection_holder_snapshot on commit drop as
select
  holder_account_id,
  auth_user_id,
  university_email,
  personal_email,
  account_status,
  confirmed_at,
  created_at,
  updated_at
from wallet.holder_account;

create temporary table issuer_connection_request_snapshot on commit drop as
select
  onboarding_request_id,
  holder_account_id,
  admission_no,
  date_of_birth,
  passport_number_hmac,
  verification_status,
  matched_enrollment_id,
  reviewed_by,
  reviewed_at,
  rejection_reason,
  submitted_at
from wallet.wallet_onboarding_request;

create temporary table expected_preflight_onboarding_state on commit drop as
select
  verification_status,
  matched_enrollment_id,
  rejection_reason,
  reviewed_by,
  reviewed_at
from wallet.wallet_onboarding_request
with no data;

alter table expected_preflight_onboarding_state
  add constraint expected_preflight_onboarding_state_check check (
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

do $preflight$
declare
  v_existing_approval_definition text;
  v_actual_state_expression text;
  v_expected_state_expression text;
begin
  if to_regclass('wallet.holder_account') is null
    or to_regclass('wallet.wallet_onboarding_request') is null
    or to_regclass('academic.student') is null
    or to_regclass('academic.student_program_enrollment') is null
  then
    raise exception
      'Issuer-connection migration preflight failed: a required table is missing';
  end if;

  if to_regclass('wallet.issuer_provider') is not null
    or to_regclass('wallet.holder_issuer_connection') is not null
    or exists (
      select 1
      from information_schema.columns
      where table_schema = 'wallet'
        and table_name = 'wallet_onboarding_request'
        and column_name = 'holder_issuer_connection_id'
    )
  then
    raise exception
      'Issuer-connection migration preflight failed: follow-up objects already exist';
  end if;

  if to_regprocedure('wallet.approve_onboarding_request(bigint,uuid)') is null
    or to_regclass('wallet.one_active_onboarding_request_per_holder_idx') is null
    or to_regclass('wallet.one_matched_request_per_holder_idx') is null
  then
    raise exception
      'Issuer-connection migration preflight failed: the applied Member 2 boundary differs';
  end if;

  select pg_get_expr(constraint_record.conbin, constraint_record.conrelid, true)
  into v_actual_state_expression
  from pg_constraint as constraint_record
  where constraint_record.conrelid =
      'wallet.wallet_onboarding_request'::regclass
    and constraint_record.conname =
      'wallet_onboarding_request_state_check'
    and constraint_record.contype = 'c';

  select pg_get_expr(constraint_record.conbin, constraint_record.conrelid, true)
  into v_expected_state_expression
  from pg_constraint as constraint_record
  where constraint_record.conrelid =
      'pg_temp.expected_preflight_onboarding_state'::regclass
    and constraint_record.conname =
      'expected_preflight_onboarding_state_check'
    and constraint_record.contype = 'c';

  if v_actual_state_expression is distinct from v_expected_state_expression
  then
    raise exception
      'Issuer-connection migration preflight failed: onboarding state constraint differs';
  end if;

  select pg_get_functiondef(
    'wallet.approve_onboarding_request(bigint,uuid)'::regprocedure
  ) into v_existing_approval_definition;

  if v_existing_approval_definition !~*
    'update[[:space:]]+wallet[.]holder_account'
  then
    raise exception
      'Issuer-connection migration preflight failed: the existing approval lifecycle differs';
  end if;

  if exists (
    select 1
    from wallet.wallet_onboarding_request
    where verification_status not in (
      'submitted', 'under_review', 'matched', 'rejected'
    )
  ) then
    raise exception
      'Issuer-connection migration preflight failed: an existing request cannot be classified';
  end if;

  -- Provider context did not exist historically. More than one request for a
  -- holder would be ambiguous to backfill and therefore requires manual review.
  if exists (
    select holder_account_id
    from wallet.wallet_onboarding_request
    group by holder_account_id
    having count(*) > 1
  ) then
    raise exception
      'Issuer-connection migration preflight failed: existing request history is ambiguous';
  end if;

  if exists (
    select 1
    from wallet.wallet_onboarding_request as request
    left join wallet.holder_account as holder
      on holder.holder_account_id = request.holder_account_id
    where holder.holder_account_id is null
  ) then
    raise exception
      'Issuer-connection migration preflight failed: an existing request has no holder';
  end if;
end
$preflight$;

create table wallet.issuer_provider (
  issuer_provider_id bigint generated always as identity primary key,
  issuer_code text not null unique,
  display_name text not null,
  description text not null,
  availability text not null,
  connection_verification_enabled boolean not null default false,
  is_mock boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint issuer_provider_code_check check (
    issuer_code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint issuer_provider_availability_check check (
    availability in ('available', 'coming_soon', 'disabled')
  ),
  constraint issuer_provider_verification_state_check check (
    availability = 'available' or not connection_verification_enabled
  )
);

comment on table wallet.issuer_provider is
  'Backend-managed prototype issuer catalog. Mock rows are not a trust list.';

insert into wallet.issuer_provider (
  issuer_code,
  display_name,
  description,
  availability,
  connection_verification_enabled,
  is_mock
)
values
  (
    'assumption-university',
    'Assumption University',
    'Connect a wallet to the prototype Assumption University issuer service.',
    'available',
    true,
    true
  ),
  (
    'demo-issuer-alpha',
    'Demo Issuer Alpha',
    'Synthetic placeholder provider for the prototype catalog.',
    'coming_soon',
    false,
    true
  ),
  (
    'demo-issuer-beta',
    'Demo Issuer Beta',
    'Synthetic placeholder provider for the prototype catalog.',
    'coming_soon',
    false,
    true
  );

create table wallet.holder_issuer_connection (
  holder_issuer_connection_id bigint generated always as identity primary key,
  holder_account_id bigint not null,
  issuer_provider_id bigint not null,
  connection_status text not null default 'pending_verification',
  verified_enrollment_id bigint,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint holder_issuer_connection_holder_fkey
    foreign key (holder_account_id)
    references wallet.holder_account(holder_account_id)
    on delete restrict,
  constraint holder_issuer_connection_provider_fkey
    foreign key (issuer_provider_id)
    references wallet.issuer_provider(issuer_provider_id)
    on delete restrict,
  constraint holder_issuer_connection_enrollment_fkey
    foreign key (verified_enrollment_id)
    references academic.student_program_enrollment(enrollment_id)
    on delete restrict,
  constraint holder_issuer_connection_holder_provider_key
    unique (holder_account_id, issuer_provider_id),
  constraint holder_issuer_connection_identity_holder_key
    unique (holder_issuer_connection_id, holder_account_id),
  constraint holder_issuer_connection_status_check check (
    connection_status in (
      'pending_verification', 'verified', 'rejected', 'disconnected'
    )
  ),
  constraint holder_issuer_connection_verified_state_check check (
    (
      connection_status = 'verified'
      and verified_enrollment_id is not null
      and verified_at is not null
    )
    or (
      connection_status <> 'verified'
      and verified_enrollment_id is null
      and verified_at is null
    )
  )
);

create index holder_issuer_connection_provider_idx
  on wallet.holder_issuer_connection (issuer_provider_id);

create unique index one_verified_connection_per_provider_enrollment_idx
  on wallet.holder_issuer_connection (
    issuer_provider_id,
    verified_enrollment_id
  )
  where connection_status = 'verified'
    and verified_enrollment_id is not null;

create temporary table expected_verified_connection_claim on commit drop as
select issuer_provider_id, verified_enrollment_id, connection_status
from wallet.holder_issuer_connection
with no data;

create unique index expected_verified_connection_claim_idx
  on expected_verified_connection_claim (
    issuer_provider_id,
    verified_enrollment_id
  )
  where connection_status = 'verified'
    and verified_enrollment_id is not null;

-- Every historical request is unambiguously classified as an AU attempt by
-- the preflight. Generated provider/connection IDs are always resolved by
-- natural key and relationships.
insert into wallet.holder_issuer_connection (
  holder_account_id,
  issuer_provider_id,
  connection_status,
  verified_enrollment_id,
  verified_at
)
select
  request.holder_account_id,
  provider.issuer_provider_id,
  case request.verification_status
    when 'matched' then 'verified'
    when 'rejected' then 'rejected'
    else 'pending_verification'
  end,
  case
    when request.verification_status = 'matched'
      then request.matched_enrollment_id
    else null
  end,
  case
    when request.verification_status = 'matched'
      then request.reviewed_at
    else null
  end
from wallet.wallet_onboarding_request as request
join wallet.issuer_provider as provider
  on provider.issuer_code = 'assumption-university';

alter table wallet.wallet_onboarding_request
  add column holder_issuer_connection_id bigint;

update wallet.wallet_onboarding_request as request
set holder_issuer_connection_id = connection.holder_issuer_connection_id
from wallet.holder_issuer_connection as connection
join wallet.issuer_provider as provider
  on provider.issuer_provider_id = connection.issuer_provider_id
  and provider.issuer_code = 'assumption-university'
where request.holder_issuer_connection_id is null
  and connection.holder_account_id = request.holder_account_id;

alter table wallet.wallet_onboarding_request
  alter column holder_issuer_connection_id set not null;

alter table wallet.wallet_onboarding_request
  add constraint wallet_onboarding_request_connection_holder_fkey
  foreign key (holder_issuer_connection_id, holder_account_id)
  references wallet.holder_issuer_connection (
    holder_issuer_connection_id,
    holder_account_id
  )
  on delete restrict;

-- Automatic verification has no human reviewer. Keep the historical manual
-- review shape valid while allowing matched rows with no reviewer metadata.
alter table wallet.wallet_onboarding_request
  drop constraint wallet_onboarding_request_state_check;

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
      and (
        (reviewed_by is null and reviewed_at is null)
        or (reviewed_by is not null and reviewed_at is not null)
      )
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

-- Finish legacy active attempts during the migration itself. Exact identity
-- with exactly one eligible enrollment becomes verified; every other outcome
-- is the same generic rejection. Existing request identities and timestamps
-- remain unchanged and no row is deleted or recreated.
with legacy_classification as (
  select
    request.onboarding_request_id,
    count(enrollment.enrollment_id) filter (
      where enrollment.academic_status in ('studying', 'graduated', 'alumni')
    ) as eligible_enrollment_count,
    min(enrollment.enrollment_id) filter (
      where enrollment.academic_status in ('studying', 'graduated', 'alumni')
    ) as sole_eligible_enrollment_id
  from wallet.wallet_onboarding_request as request
  left join academic.student as student
    on student.admission_no = request.admission_no
    and student.date_of_birth = request.date_of_birth
    and student.passport_number_hmac = request.passport_number_hmac
  left join academic.student_program_enrollment as enrollment
    on enrollment.student_id = student.student_id
  where request.verification_status in ('submitted', 'under_review')
  group by request.onboarding_request_id
)
update wallet.wallet_onboarding_request as request
set verification_status = case
      when classification.eligible_enrollment_count = 1 then 'matched'
      else 'rejected'
    end,
    matched_enrollment_id = case
      when classification.eligible_enrollment_count = 1
        then classification.sole_eligible_enrollment_id
      else null
    end,
    reviewed_by = null,
    reviewed_at = null,
    rejection_reason = case
      when classification.eligible_enrollment_count = 1 then null
      else 'ISSUER_VERIFICATION_NOT_CONFIRMED'
    end
from legacy_classification as classification
where request.onboarding_request_id = classification.onboarding_request_id;

update wallet.holder_issuer_connection as connection
set connection_status = case
      when request.verification_status = 'matched' then 'verified'
      else 'rejected'
    end,
    verified_enrollment_id = case
      when request.verification_status = 'matched'
        then request.matched_enrollment_id
      else null
    end,
    verified_at = case
      when request.verification_status = 'matched'
        then coalesce(request.reviewed_at, statement_timestamp())
      else null
    end,
    updated_at = statement_timestamp()
from wallet.wallet_onboarding_request as request
where request.holder_issuer_connection_id =
    connection.holder_issuer_connection_id;

drop index wallet.one_active_onboarding_request_per_holder_idx;
drop index wallet.one_matched_request_per_holder_idx;

create unique index one_active_verification_attempt_per_connection_idx
  on wallet.wallet_onboarding_request (holder_issuer_connection_id)
  where verification_status in ('submitted', 'under_review');

create unique index one_matched_verification_per_connection_idx
  on wallet.wallet_onboarding_request (holder_issuer_connection_id)
  where verification_status = 'matched';

create index wallet_onboarding_request_connection_idx
  on wallet.wallet_onboarding_request (holder_issuer_connection_id);

create temporary table expected_issuer_verification_indexes on commit drop as
select holder_issuer_connection_id, verification_status
from wallet.wallet_onboarding_request
with no data;

create unique index expected_active_verification_attempt_idx
  on expected_issuer_verification_indexes (holder_issuer_connection_id)
  where verification_status in ('submitted', 'under_review');

create unique index expected_matched_verification_idx
  on expected_issuer_verification_indexes (holder_issuer_connection_id)
  where verification_status = 'matched';

create temporary table expected_automatic_onboarding_state on commit drop as
select
  verification_status,
  matched_enrollment_id,
  rejection_reason,
  reviewed_by,
  reviewed_at
from wallet.wallet_onboarding_request
with no data;

alter table expected_automatic_onboarding_state
  add constraint expected_automatic_onboarding_state_check check (
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
      and (
        (reviewed_by is null and reviewed_at is null)
        or (reviewed_by is not null and reviewed_at is not null)
      )
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

-- This is the active wallet submission boundary. It creates or locks the AU
-- connection, independently revalidates the three-factor academic identity,
-- records one terminal attempt, and changes only provider-connection state.
create function wallet.submit_issuer_connection_verification(
  p_holder_account_id bigint,
  p_issuer_code text,
  p_admission_no text,
  p_date_of_birth date,
  p_passport_number_hmac text
)
returns table (
  issuer_code text,
  connection_status text,
  verification_status text,
  rejection_reason text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  verified_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_provider_id bigint;
  v_provider_availability text;
  v_provider_verification_enabled boolean;
  v_connection_id bigint;
  v_connection_status text;
  v_active_request_exists boolean;
  v_eligible_enrollment_count bigint;
  v_sole_eligible_enrollment_id bigint;
  v_enrollment_already_claimed boolean := false;
  v_is_verified boolean;
  v_request_id bigint;
  v_now timestamptz := statement_timestamp();
begin
  if p_holder_account_id is null
    or p_holder_account_id <= 0
    or nullif(btrim(p_issuer_code), '') is null
    or nullif(btrim(p_admission_no), '') is null
    or p_date_of_birth is null
    or p_passport_number_hmac is null
    or p_passport_number_hmac !~ '^[0-9a-f]{64}$'
  then
    raise exception using
      errcode = 'P0001',
      message = 'Issuer verification could not be processed';
  end if;

  perform 1
  from wallet.holder_account as holder
  where holder.holder_account_id = p_holder_account_id
    and holder.account_status = 'active'
  for update;

  if not found then
    raise exception using
      errcode = 'P1005',
      message = 'Wallet account is not active';
  end if;

  select
    provider.issuer_provider_id,
    provider.availability,
    provider.connection_verification_enabled
  into
    v_provider_id,
    v_provider_availability,
    v_provider_verification_enabled
  from wallet.issuer_provider as provider
  where provider.issuer_code = lower(btrim(p_issuer_code));

  if not found then
    raise exception using
      errcode = 'P1001',
      message = 'Issuer provider was not found';
  end if;

  if lower(btrim(p_issuer_code)) <> 'assumption-university'
    or v_provider_availability <> 'available'
    or not v_provider_verification_enabled
  then
    raise exception using
      errcode = 'P1002',
      message = 'Issuer verification is not available';
  end if;

  insert into wallet.holder_issuer_connection (
    holder_account_id,
    issuer_provider_id,
    connection_status
  )
  values (
    p_holder_account_id,
    v_provider_id,
    'pending_verification'
  )
  on conflict (holder_account_id, issuer_provider_id) do nothing;

  select
    connection.holder_issuer_connection_id,
    connection.connection_status
  into v_connection_id, v_connection_status
  from wallet.holder_issuer_connection as connection
  where connection.holder_account_id = p_holder_account_id
    and connection.issuer_provider_id = v_provider_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Issuer verification could not be processed';
  end if;

  if v_connection_status = 'verified' then
    raise exception using
      errcode = 'P1003',
      message = 'Issuer connection is already verified';
  end if;

  select exists (
    select 1
    from wallet.wallet_onboarding_request as request
    where request.holder_issuer_connection_id = v_connection_id
      and request.verification_status in ('submitted', 'under_review')
  ) into v_active_request_exists;

  if v_active_request_exists then
    raise exception using
      errcode = 'P1004',
      message = 'An active issuer verification already exists';
  end if;

  select count(*), min(enrollment.enrollment_id)
  into v_eligible_enrollment_count, v_sole_eligible_enrollment_id
  from academic.student_program_enrollment as enrollment
  join academic.student as student
    on student.student_id = enrollment.student_id
  where enrollment.academic_status in ('studying', 'graduated', 'alumni')
    and student.admission_no = btrim(p_admission_no)
    and student.date_of_birth = p_date_of_birth
    and student.passport_number_hmac = p_passport_number_hmac;

  v_is_verified := v_eligible_enrollment_count = 1;

  if v_is_verified then
    -- Serialize every claim for one provider/enrollment pair. This keeps the
    -- public result deterministic under concurrency while the partial unique
    -- index remains the database backstop.
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        pg_catalog.format(
          'au_wallet:issuer_enrollment_claim:%s:%s',
          v_provider_id,
          v_sole_eligible_enrollment_id
        ),
        0
      )
    );

    select exists (
      select 1
      from wallet.holder_issuer_connection as claimed
      where claimed.issuer_provider_id = v_provider_id
        and claimed.verified_enrollment_id = v_sole_eligible_enrollment_id
        and claimed.connection_status = 'verified'
        and claimed.holder_issuer_connection_id <> v_connection_id
    ) into v_enrollment_already_claimed;

    v_is_verified := not v_enrollment_already_claimed;
  end if;

  -- A unique violation is an expected concurrency backstop, not an internal
  -- server error. Convert it to the same generic terminal rejection used for
  -- every other unsuccessful verification.
  begin
    insert into wallet.wallet_onboarding_request (
      holder_account_id,
      holder_issuer_connection_id,
      admission_no,
      date_of_birth,
      passport_number_hmac,
      verification_status,
      matched_enrollment_id,
      reviewed_by,
      reviewed_at,
      rejection_reason,
      submitted_at
    )
    values (
      p_holder_account_id,
      v_connection_id,
      btrim(p_admission_no),
      p_date_of_birth,
      p_passport_number_hmac,
      case when v_is_verified then 'matched' else 'rejected' end,
      case when v_is_verified then v_sole_eligible_enrollment_id else null end,
      null,
      null,
      case
        when v_is_verified then null
        else 'ISSUER_VERIFICATION_NOT_CONFIRMED'
      end,
      v_now
    )
    returning onboarding_request_id into v_request_id;
  exception
    when unique_violation then
      v_is_verified := false;

      insert into wallet.wallet_onboarding_request (
        holder_account_id,
        holder_issuer_connection_id,
        admission_no,
        date_of_birth,
        passport_number_hmac,
        verification_status,
        matched_enrollment_id,
        reviewed_by,
        reviewed_at,
        rejection_reason,
        submitted_at
      )
      values (
        p_holder_account_id,
        v_connection_id,
        btrim(p_admission_no),
        p_date_of_birth,
        p_passport_number_hmac,
        'rejected',
        null,
        null,
        null,
        'ISSUER_VERIFICATION_NOT_CONFIRMED',
        v_now
      )
      returning onboarding_request_id into v_request_id;
  end;

  begin
    update wallet.holder_issuer_connection as connection
    set connection_status = case
          when v_is_verified then 'verified'
          else 'rejected'
        end,
        verified_enrollment_id = case
          when v_is_verified then v_sole_eligible_enrollment_id
          else null
        end,
        verified_at = case when v_is_verified then v_now else null end,
        updated_at = v_now
    where connection.holder_issuer_connection_id = v_connection_id;
  exception
    when unique_violation then
      v_is_verified := false;

      update wallet.wallet_onboarding_request as request
      set verification_status = 'rejected',
          matched_enrollment_id = null,
          rejection_reason = 'ISSUER_VERIFICATION_NOT_CONFIRMED'
      where request.onboarding_request_id = v_request_id;

      update wallet.holder_issuer_connection as connection
      set connection_status = 'rejected',
          verified_enrollment_id = null,
          verified_at = null,
          updated_at = v_now
      where connection.holder_issuer_connection_id = v_connection_id;
  end;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Issuer verification could not be processed';
  end if;

  return query select
    'assumption-university'::text,
    case when v_is_verified then 'verified' else 'rejected' end::text,
    case when v_is_verified then 'matched' else 'rejected' end::text,
    case
      when v_is_verified then null
      else 'ISSUER_VERIFICATION_NOT_CONFIRMED'
    end::text,
    v_now,
    null::timestamptz,
    case when v_is_verified then v_now else null end::timestamptz;
end
$function$;

revoke all on function wallet.submit_issuer_connection_verification(
  bigint, text, text, date, text
) from public, anon, authenticated;
grant execute on function wallet.submit_issuer_connection_verification(
  bigint, text, text, date, text
) to service_role;

comment on function wallet.submit_issuer_connection_verification(
  bigint, text, text, date, text
) is
  'Backend-only atomic AU connection verification; never changes holder-account state.';

-- Replace the old wallet-activation finalizer. Approval now verifies only the
-- selected AU connection and never reads or updates holder account status.
drop function wallet.approve_onboarding_request(bigint, uuid);

create function wallet.approve_onboarding_request(
  p_onboarding_request_id bigint,
  p_reviewed_by uuid
)
returns table (
  onboarding_request_id bigint,
  holder_issuer_connection_id bigint,
  issuer_code text,
  connection_status text,
  verification_status text,
  matched_enrollment_id bigint,
  rejection_reason text,
  reviewed_at timestamptz,
  submitted_at timestamptz,
  verified_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_connection_id bigint;
  v_provider_id bigint;
  v_provider_code text;
  v_provider_availability text;
  v_provider_verification_enabled boolean;
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
      message = 'Issuer verification could not be approved';
  end if;

  select
    request.holder_issuer_connection_id,
    request.admission_no,
    request.date_of_birth,
    request.passport_number_hmac,
    request.matched_enrollment_id,
    request.submitted_at
  into
    v_connection_id,
    v_admission_no,
    v_date_of_birth,
    v_passport_number_hmac,
    v_candidate_enrollment_id,
    v_submitted_at
  from wallet.wallet_onboarding_request as request
  where request.onboarding_request_id = p_onboarding_request_id
    and request.verification_status = 'under_review'
  for update;

  if not found or v_candidate_enrollment_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'Issuer verification could not be approved';
  end if;

  select connection.issuer_provider_id
  into v_provider_id
  from wallet.holder_issuer_connection as connection
  where connection.holder_issuer_connection_id = v_connection_id
    and connection.connection_status = 'pending_verification'
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Issuer verification could not be approved';
  end if;

  select
    provider.issuer_code,
    provider.availability,
    provider.connection_verification_enabled
  into
    v_provider_code,
    v_provider_availability,
    v_provider_verification_enabled
  from wallet.issuer_provider as provider
  where provider.issuer_provider_id = v_provider_id;

  if not found
    or v_provider_code <> 'assumption-university'
    or v_provider_availability <> 'available'
    or not v_provider_verification_enabled
  then
    raise exception using
      errcode = 'P0001',
      message = 'Issuer verification could not be approved';
  end if;

  select count(*), min(enrollment.enrollment_id)
  into v_eligible_enrollment_count, v_sole_eligible_enrollment_id
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
      message = 'Issuer verification could not be approved';
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
      message = 'Issuer verification could not be approved';
  end if;

  update wallet.holder_issuer_connection as connection
  set connection_status = 'verified',
      verified_enrollment_id = v_candidate_enrollment_id,
      verified_at = v_now,
      updated_at = v_now
  where connection.holder_issuer_connection_id = v_connection_id
    and connection.connection_status = 'pending_verification';

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Issuer verification could not be approved';
  end if;

  return query select
    p_onboarding_request_id,
    v_connection_id,
    v_provider_code,
    'verified'::text,
    'matched'::text,
    v_candidate_enrollment_id,
    null::text,
    v_now,
    v_submitted_at,
    v_now;
end
$function$;

revoke all on function wallet.approve_onboarding_request(bigint, uuid)
  from public, anon, authenticated;
grant execute on function wallet.approve_onboarding_request(bigint, uuid)
  to service_role;

comment on function wallet.approve_onboarding_request(bigint, uuid) is
  'Backend-only approval that atomically revalidates AU identity and verifies only the holder/provider connection.';

create function wallet.reject_issuer_verification_request(
  p_onboarding_request_id bigint,
  p_reviewed_by uuid,
  p_rejection_reason text
)
returns table (
  onboarding_request_id bigint,
  holder_issuer_connection_id bigint,
  issuer_code text,
  connection_status text,
  verification_status text,
  matched_enrollment_id bigint,
  rejection_reason text,
  reviewed_at timestamptz,
  submitted_at timestamptz,
  verified_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_connection_id bigint;
  v_provider_id bigint;
  v_provider_code text;
  v_candidate_enrollment_id bigint;
  v_submitted_at timestamptz;
  v_now timestamptz := statement_timestamp();
begin
  if p_onboarding_request_id is null
    or p_onboarding_request_id <= 0
    or p_reviewed_by is null
    or nullif(btrim(p_rejection_reason), '') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Issuer verification could not be rejected';
  end if;

  select
    request.holder_issuer_connection_id,
    request.matched_enrollment_id,
    request.submitted_at
  into v_connection_id, v_candidate_enrollment_id, v_submitted_at
  from wallet.wallet_onboarding_request as request
  where request.onboarding_request_id = p_onboarding_request_id
    and request.verification_status = 'under_review'
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Issuer verification could not be rejected';
  end if;

  select connection.issuer_provider_id
  into v_provider_id
  from wallet.holder_issuer_connection as connection
  where connection.holder_issuer_connection_id = v_connection_id
    and connection.connection_status = 'pending_verification'
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Issuer verification could not be rejected';
  end if;

  select provider.issuer_code
  into v_provider_code
  from wallet.issuer_provider as provider
  where provider.issuer_provider_id = v_provider_id;

  update wallet.wallet_onboarding_request as request
  set verification_status = 'rejected',
      reviewed_by = p_reviewed_by,
      reviewed_at = v_now,
      rejection_reason = btrim(p_rejection_reason)
  where request.onboarding_request_id = p_onboarding_request_id
    and request.verification_status = 'under_review';

  update wallet.holder_issuer_connection as connection
  set connection_status = 'rejected',
      verified_enrollment_id = null,
      verified_at = null,
      updated_at = v_now
  where connection.holder_issuer_connection_id = v_connection_id
    and connection.connection_status = 'pending_verification';

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Issuer verification could not be rejected';
  end if;

  return query select
    p_onboarding_request_id,
    v_connection_id,
    v_provider_code,
    'rejected'::text,
    'rejected'::text,
    v_candidate_enrollment_id,
    btrim(p_rejection_reason),
    v_now,
    v_submitted_at,
    null::timestamptz;
end
$function$;

revoke all on function wallet.reject_issuer_verification_request(
  bigint, uuid, text
) from public, anon, authenticated;
grant execute on function wallet.reject_issuer_verification_request(
  bigint, uuid, text
) to service_role;

alter table wallet.issuer_provider enable row level security;
alter table wallet.holder_issuer_connection enable row level security;

revoke all on table wallet.issuer_provider,
  wallet.holder_issuer_connection
from public, anon, authenticated, service_role;

grant select on table wallet.issuer_provider to service_role;
grant select, insert, update on table wallet.holder_issuer_connection
  to service_role;

revoke all on sequence
  wallet.issuer_provider_issuer_provider_id_seq,
  wallet.holder_issuer_connection_holder_issuer_connection_id_seq
from public, anon, authenticated, service_role;

grant usage on sequence
  wallet.holder_issuer_connection_holder_issuer_connection_id_seq
to service_role;

do $postflight$
declare
  v_approval_definition text;
  v_submission_definition text;
  v_actual_state_expression text;
  v_expected_state_expression text;
  v_actual_active_predicate text;
  v_expected_active_predicate text;
  v_actual_matched_predicate text;
  v_expected_matched_predicate text;
  v_actual_claim_predicate text;
  v_expected_claim_predicate text;
  v_actual_claim_columns text[];
begin
  if (select count(*) from wallet.issuer_provider) <> 3
    or not exists (
      select 1 from wallet.issuer_provider
      where issuer_code = 'assumption-university'
        and display_name = 'Assumption University'
        and availability = 'available'
        and connection_verification_enabled
        and is_mock
    )
    or not exists (
      select 1 from wallet.issuer_provider
      where issuer_code = 'demo-issuer-alpha'
        and display_name = 'Demo Issuer Alpha'
        and availability = 'coming_soon'
        and not connection_verification_enabled
        and is_mock
    )
    or not exists (
      select 1 from wallet.issuer_provider
      where issuer_code = 'demo-issuer-beta'
        and display_name = 'Demo Issuer Beta'
        and availability = 'coming_soon'
        and not connection_verification_enabled
        and is_mock
    )
  then
    raise exception
      'Issuer-connection migration postflight failed: provider fixtures differ';
  end if;

  if exists (
    select 1
    from issuer_connection_request_snapshot as before
    full join wallet.wallet_onboarding_request as after
      using (onboarding_request_id)
    where before.onboarding_request_id is null
      or after.onboarding_request_id is null
      or row(
        before.holder_account_id, before.admission_no, before.date_of_birth,
        before.passport_number_hmac, before.submitted_at
      ) is distinct from row(
        after.holder_account_id, after.admission_no, after.date_of_birth,
        after.passport_number_hmac, after.submitted_at
      )
  ) then
    raise exception
      'Issuer-connection migration postflight failed: protected request history changed';
  end if;

  if exists (
    select 1
    from issuer_connection_request_snapshot as before
    join wallet.wallet_onboarding_request as after
      using (onboarding_request_id)
    where before.verification_status in ('submitted', 'under_review')
      and after.verification_status not in ('matched', 'rejected')
  ) then
    raise exception
      'Issuer-connection migration postflight failed: legacy active request was not finalized';
  end if;

  if exists (
    select * from issuer_connection_holder_snapshot
    except
    select
      holder_account_id, auth_user_id, university_email, personal_email,
      account_status, confirmed_at, created_at, updated_at
    from wallet.holder_account
  ) or exists (
    select
      holder_account_id, auth_user_id, university_email, personal_email,
      account_status, confirmed_at, created_at, updated_at
    from wallet.holder_account
    except
    select * from issuer_connection_holder_snapshot
  ) then
    raise exception
      'Issuer-connection migration postflight failed: holder data changed';
  end if;

  if exists (
    select 1
    from wallet.wallet_onboarding_request as request
    join wallet.holder_issuer_connection as connection
      on connection.holder_issuer_connection_id =
        request.holder_issuer_connection_id
    join wallet.issuer_provider as provider
      on provider.issuer_provider_id = connection.issuer_provider_id
    where connection.holder_account_id <> request.holder_account_id
      or provider.issuer_code <> 'assumption-university'
  ) or exists (
    select 1
    from wallet.wallet_onboarding_request
    where holder_issuer_connection_id is null
  ) then
    raise exception
      'Issuer-connection migration postflight failed: request backfill differs';
  end if;

  if (
    select count(*)
    from wallet.holder_issuer_connection
  ) <> (
    select count(distinct holder_account_id)
    from issuer_connection_request_snapshot
  ) or exists (
    select 1
    from issuer_connection_request_snapshot as before
    join wallet.wallet_onboarding_request as request
      on request.onboarding_request_id = before.onboarding_request_id
    join wallet.holder_issuer_connection as connection
      on connection.holder_issuer_connection_id =
        request.holder_issuer_connection_id
    where connection.connection_status is distinct from case
      when request.verification_status = 'matched' then 'verified'
      when request.verification_status = 'rejected' then 'rejected'
      else 'pending_verification'
    end
      or connection.verified_enrollment_id is distinct from case
        when request.verification_status = 'matched'
          then request.matched_enrollment_id
        else null
      end
      or (
        request.verification_status = 'matched'
        and connection.verified_at is null
      )
      or (
        request.verification_status <> 'matched'
        and connection.verified_at is not null
      )
  ) then
    raise exception
      'Issuer-connection migration postflight failed: connection state backfill differs';
  end if;

  if to_regclass(
    'wallet.one_active_verification_attempt_per_connection_idx'
  ) is null
    or to_regclass(
      'wallet.one_matched_verification_per_connection_idx'
    ) is null
    or to_regclass('wallet.one_active_onboarding_request_per_holder_idx')
      is not null
    or to_regclass('wallet.one_matched_request_per_holder_idx') is not null
    or to_regclass(
      'wallet.one_verified_connection_per_provider_enrollment_idx'
    ) is null
    or to_regclass(
      'wallet.holder_issuer_connection_verified_enrollment_idx'
    ) is not null
  then
    raise exception
      'Issuer-connection migration postflight failed: workflow indexes differ';
  end if;

  select pg_get_expr(index_record.indpred, index_record.indrelid, true)
  into v_actual_active_predicate
  from pg_index as index_record
  where index_record.indexrelid =
    'wallet.one_active_verification_attempt_per_connection_idx'::regclass
    and index_record.indisunique
    and index_record.indnkeyatts = 1;

  select pg_get_expr(index_record.indpred, index_record.indrelid, true)
  into v_expected_active_predicate
  from pg_index as index_record
  where index_record.indexrelid =
    'pg_temp.expected_active_verification_attempt_idx'::regclass;

  select pg_get_expr(index_record.indpred, index_record.indrelid, true)
  into v_actual_matched_predicate
  from pg_index as index_record
  where index_record.indexrelid =
    'wallet.one_matched_verification_per_connection_idx'::regclass
    and index_record.indisunique
    and index_record.indnkeyatts = 1;

  select pg_get_expr(index_record.indpred, index_record.indrelid, true)
  into v_expected_matched_predicate
  from pg_index as index_record
  where index_record.indexrelid =
    'pg_temp.expected_matched_verification_idx'::regclass;

  if v_actual_active_predicate is distinct from v_expected_active_predicate
    or v_actual_matched_predicate is distinct from
      v_expected_matched_predicate
  then
    raise exception
      'Issuer-connection migration postflight failed: workflow index predicates differ';
  end if;

  select
    pg_get_expr(index_record.indpred, index_record.indrelid, true),
    array_agg(attribute.attname order by key_position.ordinality)
  into v_actual_claim_predicate, v_actual_claim_columns
  from pg_index as index_record
  cross join lateral unnest(index_record.indkey::smallint[])
    with ordinality as key_position(attnum, ordinality)
  join pg_attribute as attribute
    on attribute.attrelid = index_record.indrelid
    and attribute.attnum = key_position.attnum
  where index_record.indexrelid =
    'wallet.one_verified_connection_per_provider_enrollment_idx'::regclass
    and index_record.indisunique
    and index_record.indnkeyatts = 2
  group by index_record.indpred, index_record.indrelid;

  select pg_get_expr(index_record.indpred, index_record.indrelid, true)
  into v_expected_claim_predicate
  from pg_index as index_record
  where index_record.indexrelid =
    'pg_temp.expected_verified_connection_claim_idx'::regclass;

  if v_actual_claim_predicate is distinct from v_expected_claim_predicate
    or v_actual_claim_columns is distinct from
      array['issuer_provider_id', 'verified_enrollment_id']::text[]
  then
    raise exception
      'Issuer-connection migration postflight failed: verified enrollment claim index differs';
  end if;

  select pg_get_expr(constraint_record.conbin, constraint_record.conrelid, true)
  into v_actual_state_expression
  from pg_constraint as constraint_record
  where constraint_record.conrelid =
      'wallet.wallet_onboarding_request'::regclass
    and constraint_record.conname =
      'wallet_onboarding_request_state_check'
    and constraint_record.contype = 'c';

  select pg_get_expr(constraint_record.conbin, constraint_record.conrelid, true)
  into v_expected_state_expression
  from pg_constraint as constraint_record
  where constraint_record.conrelid =
      'pg_temp.expected_automatic_onboarding_state'::regclass
    and constraint_record.conname =
      'expected_automatic_onboarding_state_check'
    and constraint_record.contype = 'c';

  if v_actual_state_expression is distinct from v_expected_state_expression
  then
    raise exception
      'Issuer-connection migration postflight failed: onboarding state constraint differs';
  end if;

  if not (
    select relrowsecurity
    from pg_class
    where oid = 'wallet.issuer_provider'::regclass
  ) or not (
    select relrowsecurity
    from pg_class
    where oid = 'wallet.holder_issuer_connection'::regclass
  ) then
    raise exception
      'Issuer-connection migration postflight failed: RLS is not enabled';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'wallet'
      and tablename in ('issuer_provider', 'holder_issuer_connection')
  ) then
    raise exception
      'Issuer-connection migration postflight failed: unexpected browser policy exists';
  end if;

  if has_table_privilege('anon', 'wallet.issuer_provider', 'SELECT')
    or has_table_privilege('anon', 'wallet.issuer_provider', 'INSERT')
    or has_table_privilege('anon', 'wallet.issuer_provider', 'UPDATE')
    or has_table_privilege('anon', 'wallet.issuer_provider', 'DELETE')
    or has_table_privilege(
      'authenticated', 'wallet.issuer_provider', 'SELECT'
    )
    or has_table_privilege(
      'authenticated', 'wallet.issuer_provider', 'INSERT'
    )
    or has_table_privilege(
      'authenticated', 'wallet.issuer_provider', 'UPDATE'
    )
    or has_table_privilege(
      'authenticated', 'wallet.issuer_provider', 'DELETE'
    )
    or has_table_privilege(
      'anon', 'wallet.holder_issuer_connection', 'SELECT'
    )
    or has_table_privilege(
      'anon', 'wallet.holder_issuer_connection', 'INSERT'
    )
    or has_table_privilege(
      'anon', 'wallet.holder_issuer_connection', 'UPDATE'
    )
    or has_table_privilege(
      'anon', 'wallet.holder_issuer_connection', 'DELETE'
    )
    or has_table_privilege(
      'authenticated', 'wallet.holder_issuer_connection', 'SELECT'
    )
    or has_table_privilege(
      'authenticated', 'wallet.holder_issuer_connection', 'INSERT'
    )
    or has_table_privilege(
      'authenticated', 'wallet.holder_issuer_connection', 'UPDATE'
    )
    or has_table_privilege(
      'authenticated', 'wallet.holder_issuer_connection', 'DELETE'
    )
  then
    raise exception
      'Issuer-connection migration postflight failed: browser table access remains';
  end if;

  if not has_table_privilege(
    'service_role', 'wallet.issuer_provider', 'SELECT'
  )
    or has_table_privilege(
      'service_role', 'wallet.issuer_provider', 'INSERT'
    )
    or has_table_privilege(
      'service_role', 'wallet.issuer_provider', 'UPDATE'
    )
    or has_table_privilege(
      'service_role', 'wallet.issuer_provider', 'DELETE'
    )
    or has_table_privilege(
      'service_role', 'wallet.issuer_provider', 'TRUNCATE'
    )
    or has_table_privilege(
      'service_role', 'wallet.issuer_provider', 'REFERENCES'
    )
    or has_table_privilege(
      'service_role', 'wallet.issuer_provider', 'TRIGGER'
    )
    or not has_table_privilege(
      'service_role', 'wallet.holder_issuer_connection', 'SELECT'
    )
    or not has_table_privilege(
      'service_role', 'wallet.holder_issuer_connection', 'INSERT'
    )
    or not has_table_privilege(
      'service_role', 'wallet.holder_issuer_connection', 'UPDATE'
    )
    or has_table_privilege(
      'service_role', 'wallet.holder_issuer_connection', 'DELETE'
    )
    or has_table_privilege(
      'service_role', 'wallet.holder_issuer_connection', 'TRUNCATE'
    )
    or has_table_privilege(
      'service_role', 'wallet.holder_issuer_connection', 'REFERENCES'
    )
    or has_table_privilege(
      'service_role', 'wallet.holder_issuer_connection', 'TRIGGER'
    )
  then
    raise exception
      'Issuer-connection migration postflight failed: service-role grants differ';
  end if;

  if not has_sequence_privilege(
    'service_role',
    'wallet.holder_issuer_connection_holder_issuer_connection_id_seq',
    'USAGE'
  ) or has_sequence_privilege(
    'service_role',
    'wallet.holder_issuer_connection_holder_issuer_connection_id_seq',
    'SELECT,UPDATE'
  ) or has_sequence_privilege(
    'service_role',
    'wallet.issuer_provider_issuer_provider_id_seq',
    'USAGE,SELECT,UPDATE'
  ) then
    raise exception
      'Issuer-connection migration postflight failed: sequence grants differ';
  end if;

  if has_function_privilege(
    'anon', 'wallet.approve_onboarding_request(bigint,uuid)', 'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'wallet.approve_onboarding_request(bigint,uuid)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'wallet.approve_onboarding_request(bigint,uuid)',
    'EXECUTE'
  ) then
    raise exception
      'Issuer-connection migration postflight failed: approval execute grants differ';
  end if;

  if has_function_privilege(
    'anon',
    'wallet.submit_issuer_connection_verification(bigint,text,text,date,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'wallet.submit_issuer_connection_verification(bigint,text,text,date,text)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'wallet.submit_issuer_connection_verification(bigint,text,text,date,text)',
    'EXECUTE'
  ) then
    raise exception
      'Issuer-connection migration postflight failed: submission execute grants differ';
  end if;

  if has_function_privilege(
    'anon',
    'wallet.reject_issuer_verification_request(bigint,uuid,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'wallet.reject_issuer_verification_request(bigint,uuid,text)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'wallet.reject_issuer_verification_request(bigint,uuid,text)',
    'EXECUTE'
  ) then
    raise exception
      'Issuer-connection migration postflight failed: rejection execute grants differ';
  end if;

  if exists (
    select 1
    from pg_proc
    where oid = 'wallet.approve_onboarding_request(bigint,uuid)'::regprocedure
      and (
        prosecdef
        or proconfig is distinct from array['search_path=""']
      )
  ) then
    raise exception
      'Issuer-connection migration postflight failed: approval security differs';
  end if;

  if exists (
    select 1
    from pg_proc
    where oid =
      'wallet.submit_issuer_connection_verification(bigint,text,text,date,text)'::regprocedure
      and (
        prosecdef
        or proconfig is distinct from array['search_path=""']
      )
  ) then
    raise exception
      'Issuer-connection migration postflight failed: submission security differs';
  end if;

  if exists (
    select 1
    from pg_proc
    where oid =
      'wallet.reject_issuer_verification_request(bigint,uuid,text)'::regprocedure
      and (
        prosecdef
        or proconfig is distinct from array['search_path=""']
      )
  ) then
    raise exception
      'Issuer-connection migration postflight failed: rejection security differs';
  end if;

  select pg_get_functiondef(
    'wallet.approve_onboarding_request(bigint,uuid)'::regprocedure
  ) into v_approval_definition;

  if v_approval_definition ~* 'update[[:space:]]+wallet[.]holder_account'
  then
    raise exception
      'Issuer-connection migration postflight failed: approval still changes holders';
  end if;

  select pg_get_functiondef(
    'wallet.submit_issuer_connection_verification(bigint,text,text,date,text)'::regprocedure
  ) into v_submission_definition;

  if v_submission_definition ~* 'update[[:space:]]+wallet[.]holder_account'
  then
    raise exception
      'Issuer-connection migration postflight failed: submission changes holders';
  end if;

  if exists (
    select 1
    from issuer_connection_preflight_counts as before
    where before.program_count <> (select count(*) from academic.program)
      or before.student_count <> (select count(*) from academic.student)
      or before.enrollment_count <>
        (select count(*) from academic.student_program_enrollment)
      or before.course_count <> (select count(*) from academic.course)
      or before.term_count <> (select count(*) from academic.academic_term)
      or before.result_count <> (select count(*) from academic.course_result)
      or before.transcript_count <> (select count(*) from academic.transcript)
      or before.graduation_count <>
        (select count(*) from academic.graduation_record)
      or before.auth_user_count <> (select count(*) from auth.users)
      or before.holder_count <> (select count(*) from wallet.holder_account)
      or before.request_count <>
        (select count(*) from wallet.wallet_onboarding_request)
      or before.document_count <>
        (select count(*) from wallet.uploaded_identity_document)
      or before.storage_object_count <> (select count(*) from storage.objects)
  ) then
    raise exception
      'Issuer-connection migration postflight failed: protected row counts changed';
  end if;
end
$postflight$;

commit;
