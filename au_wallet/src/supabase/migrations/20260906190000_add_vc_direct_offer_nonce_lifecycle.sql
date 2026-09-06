-- Direct holder-offer proof nonces are short-lived, one-time, and bound to
-- the wallet holder that retrieved the offer.
alter table public.vc_issuance_log
  add column if not exists c_nonce_expires_at timestamp with time zone null,
  add column if not exists c_nonce_consumed_at timestamp with time zone null,
  add column if not exists c_nonce_holder_account_id bigint null
    references wallet.holder_account(holder_account_id) on delete set null;

create index if not exists vc_issuance_log_direct_nonce_lookup_idx
  on public.vc_issuance_log (student_id, code)
  where status = 'pending' and c_nonce_consumed_at is null;
