begin;

-- The two original demo rows have never been used for a holder connection.
-- Keep their immutable IDs, but replace their UI-facing placeholder metadata
-- with clearly labelled *mock* future integrations.
do $preflight$
declare
  v_demo_provider_count integer;
  v_existing_connection_count integer;
begin
  select count(*)
  into v_demo_provider_count
  from wallet.issuer_provider
  where issuer_code in ('demo-issuer-alpha', 'demo-issuer-beta');

  if v_demo_provider_count <> 2 then
    raise exception
      'Issuer-provider migration preflight failed: expected two unused demo providers';
  end if;

  select count(*)
  into v_existing_connection_count
  from wallet.holder_issuer_connection as connection
  join wallet.issuer_provider as provider
    on provider.issuer_provider_id = connection.issuer_provider_id
  where provider.issuer_code in ('demo-issuer-alpha', 'demo-issuer-beta');

  if v_existing_connection_count <> 0 then
    raise exception
      'Issuer-provider migration preflight failed: demo providers already have holder connections';
  end if;
end
$preflight$;

update wallet.issuer_provider
set issuer_code = 'thaid',
    display_name = 'ThaID (Thai Digital Identity)',
    description = 'Mock placeholder for a future consent-based Thai Digital Identity integration. It is not connected to ThaID, DOPA, or NDID.',
    availability = 'coming_soon',
    connection_verification_enabled = false,
    is_mock = true,
    updated_at = now()
where issuer_code = 'demo-issuer-alpha';

update wallet.issuer_provider
set issuer_code = 'dlt-qr-licence',
    display_name = 'DLT QR Licence',
    description = 'Mock placeholder for a future Department of Land Transport driving-licence verification integration. It is not connected to DLT.',
    availability = 'coming_soon',
    connection_verification_enabled = false,
    is_mock = true,
    updated_at = now()
where issuer_code = 'demo-issuer-beta';

do $postflight$
declare
  v_expected_provider_count integer;
begin
  select count(*)
  into v_expected_provider_count
  from wallet.issuer_provider
  where (issuer_code = 'thaid'
         and display_name = 'ThaID (Thai Digital Identity)'
         and availability = 'coming_soon'
         and connection_verification_enabled = false
         and is_mock = true)
     or (issuer_code = 'dlt-qr-licence'
         and display_name = 'DLT QR Licence'
         and availability = 'coming_soon'
         and connection_verification_enabled = false
         and is_mock = true);

  if v_expected_provider_count <> 2 then
    raise exception
      'Issuer-provider migration postflight failed: mock provider state differs';
  end if;
end
$postflight$;

commit;
