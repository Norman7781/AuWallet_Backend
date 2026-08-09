# Member 2 Issuer-Connection Verification Record

Updated: 2026-08-09

Target project: `senior project 2` (`ezsylcmnqbcwvkoqybkd`)

This record supersedes the earlier assumption that academic verification opens
or activates the wallet. The new follow-up migration is prepared locally and
has not been applied.

## Independent wallet lifecycle

1. A person registers with first name, last name, personal email, and password.
2. The backend creates a Supabase Auth student and a pending holder account.
3. Supabase sends its standard confirmation link.
4. After confirmation, the person returns to the wallet and logs in.
5. The first successful confirmed login activates the holder once and sets
   `confirmed_at`. Later logins are idempotent; refresh never performs this
   transition.
6. The holder may enter and use an empty wallet without connecting an issuer.

Academic verification never activates, rejects, suspends, or disconnects the
holder account. Those account states remain Member 1 security/administrative
concerns.

## Provider connection

The backend-managed prototype catalog contains exactly three mock entries:

- Assumption University — available for verification;
- Demo Issuer Alpha — synthetic, coming soon;
- Demo Issuer Beta — synthetic, coming soon.

These entries are prototype fixtures, not a real trusted list. A holder has at
most one persistent connection per provider. No row means not connected.

The AU form accepts only admission number, date of birth, and passport number.
The passport is normalized and HMACed in trusted backend memory and is never
stored raw or logged. Exact matching uses admission number, date of birth, and
passport HMAC only. Names and personal/university email are not match factors.

Studying, graduated, and alumni enrollments are eligible. Withdrawn enrollment
is ineligible. Submission calls one backend-only atomic database operation that
independently revalidates the three factors and requires exactly one eligible
enrollment. An exact eligible match immediately marks the request matched and
only the AU connection verified. Missing, ambiguous, and ineligible matches
all receive the same generic rejected/unverified result. Rejection allows a
corrected resubmission for that provider connection.

One academic enrollment may verify at most one holder connection for a given
provider. Submission serializes competing claims, and a partial unique index on
the provider/enrollment pair remains the database backstop. The first valid
claim may verify; later or concurrent claims receive the same generic
unconfirmed result as every other unsuccessful verification. No ownership or
duplicate-claim diagnostic is exposed.

The active August 10 flow has no issuer employee review. The older protected
issuer-review implementation remains deprecated compatibility code only and is
not part of the provider-connection contract. Neither automatic verification
nor any compatibility decision updates `wallet.holder_account`.

## Compatibility and boundaries

The legacy `/onboarding-verification/requests` routes are no longer wired into
the active application module. New wallet integrations use the
`/issuer-providers` and `/issuer-connections` routes documented in the August
10 contract.

The academic catalogue has eight guarded VMES undergraduate metadata rows.
Only the existing `SYN-VMES-CS` row owns the 20 fixture enrollments and 74-course
curriculum. The seven additional programme rows do not seed or claim a course
curriculum.

Official graduation date remains academic data and is never entered by the
holder. Passport document upload, real issuer discovery/trust lists,
transcripts, credential construction, signing, issuance, and wallet credential
storage are all outside this implementation.

Browser applications call NestJS only. Internal provider IDs, connection IDs,
academic IDs, raw/normalized passports, and passport HMACs never appear in
wallet responses.

## Migration review checkpoint

The provider-connection and eight-program catalogue migrations remain
unapplied. Read-only classification of the single active legacy verification
request confirms that migration would preserve the row and reclassify it to
the generic rejected state; it would not create a verified provider
connection. This statement intentionally omits the holder identity and the
failed matching factor. Applying the migration still requires explicit
approval of that known outcome.

## Issuer frontend coordination notes

A read-only review of the issuer frontend `develop` branch found mock
transcript-issuance screens, not a Member 2 verification-review screen. Its
mock faculty label, academic dates, student identifiers, faculties, majors,
and wallet-DID assumptions do not match the protected backend fixtures. The
academic fixtures use January term dates and do not store a wallet DID. Whether
a studying holder may later receive a partial Transcript VC is also unresolved.
These are Member 3/frontend coordination items and do not change the automatic
provider-connection boundary.
