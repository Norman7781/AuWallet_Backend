alter table public.vc_issuance_log
  add column if not exists revocation_reason text null,
  add column if not exists revoked_at timestamptz null;
