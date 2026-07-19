-- AU Wallet Database
-- Wallet accounts, onboarding attempts, matching outcomes, and
-- uploaded-document metadata. Not a source of truth for academic facts.
--
-- matched_enrollment_id is a LOGICAL reference to
-- academic.student_program_enrollment.enrollment_id. It is intentionally
-- NOT a physical foreign key: the locked plan defers the decision on
-- whether academic and wallet end up in schemas of one Supabase project
-- (where cross-schema FKs are possible) or in separate projects (where
-- they are not). If you deploy both schemas in one Supabase project and
-- want to enforce this at the DB level, add the FK yourself in a later
-- migration once that decision is confirmed.

create schema if not exists wallet;

create table wallet.holder_account (
    holder_account_id  bigint generated always as identity primary key,
    university_email   text not null unique,
    personal_email     text,
    account_status     text not null default 'pending' check (account_status in
        ('pending','active','rejected','suspended')),
    confirmed_at        timestamptz,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);

create table wallet.wallet_onboarding_request (
    onboarding_request_id  bigint generated always as identity primary key,
    holder_account_id      bigint not null references wallet.holder_account(holder_account_id),
    admission_no            text not null,
    date_of_birth            date not null,
    passport_number_hmac    text not null,
    verification_status      text not null default 'submitted' check (verification_status in
        ('submitted','under_review','matched','rejected')),
    matched_enrollment_id     bigint unique,
    reviewed_by                text,
    reviewed_at                 timestamptz,
    rejection_reason            text,
    submitted_at                 timestamptz not null default now(),
    constraint matched_has_no_rejection_reason
        check (verification_status <> 'matched' or rejection_reason is null),
    constraint rejected_has_no_matched_enrollment
        check (verification_status <> 'rejected' or matched_enrollment_id is null)
);

create table wallet.uploaded_identity_document (
    uploaded_identity_document_id  bigint generated always as identity primary key,
    onboarding_request_id           bigint not null references wallet.wallet_onboarding_request(onboarding_request_id),
    document_type                    text not null check (document_type in ('passport','national_id','other')),
    storage_object_path              text not null,
    original_file_name                text,
    mime_type                         text,
    file_size_bytes                   integer,
    file_hash                         text,
    uploaded_at                        timestamptz not null default now()
);

create index idx_onboarding_request_holder_account_id on wallet.wallet_onboarding_request(holder_account_id);
create index idx_onboarding_request_verification_status on wallet.wallet_onboarding_request(verification_status);
create index idx_uploaded_identity_document_request_id on wallet.uploaded_identity_document(onboarding_request_id);

-- Enforces "only one matched request per holder" from the locked plan.
create unique index uq_one_matched_request_per_holder
    on wallet.wallet_onboarding_request(holder_account_id)
    where verification_status = 'matched';
