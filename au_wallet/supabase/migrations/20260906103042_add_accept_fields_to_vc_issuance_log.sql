alter table public.vc_issuance_log
  add column if not exists accepted_at timestamptz null,
  add column if not exists credential_id uuid null;
