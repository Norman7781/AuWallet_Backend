# Member 2 Onboarding and Verification Implementation Record

Updated: 2026-08-06

Target project: `senior project 2` (`ezsylcmnqbcwvkoqybkd`)

This record describes the implemented local backend flow. The required
migrations have not been applied.

## Wallet account opening

1. The wallet registers a student with `firstName`, `lastName`,
   `personalEmail`, and `password`.
2. The backend creates a Supabase Auth user, assigns the server-controlled
   `student` role in `app_metadata`, and creates a pending
   `wallet.holder_account` using the personal email.
3. Supabase sends its standard signup confirmation-link email using the
   project's configured Site URL.
4. The student clicks the link, then manually returns to the wallet.
5. The student logs in through `POST /auth/login` and receives the normal
   authenticated session.
6. The authenticated pending holder submits `admissionNo`, `dateOfBirth`, and
   `passportNumber`.
7. The backend normalizes and HMACs the passport identifier in trusted backend
   memory, then matches exactly admission number, date of birth, and passport
   HMAC against authoritative academic data.
8. A request remains `under_review` until issuer staff approves or rejects it.
9. Approval atomically revalidates the stored identity and sole eligible
   enrollment, sets the request to `matched`, records review metadata, activates
   the pending holder, and sets `confirmed_at`.

Signup confirmation does not use an email OTP, custom email template,
application callback page, localhost redirect, or React Native deep link. The
student manually returns to the wallet after the standard confirmation link.

## Matching and eligibility

Automatic matching uses only:

- admission number;
- date of birth;
- passport-number HMAC.

Names, personal email, and university email are not automatic matching
factors. Academic personal emails remain unrelated to wallet registration.

Wallet-eligible academic statuses are:

- `studying`;
- `graduated`;
- `alumni`.

Current students, graduated students, and alumni use the same onboarding form.
An exact eligible candidate is stored internally while the request waits for an
issuer decision. No or ambiguous match remains non-approvable. An ineligible
match is rejected without activating the holder.

## Issuer review

Issuer staff and admins may list and inspect under-review requests. Review
responses contain only the limited academic context needed for the decision.
They never return the raw passport identifier or passport HMAC.

`canApprove` means a submission-time exact eligible candidate is currently
available. Approval performs the definitive three-factor and sole-enrollment
revalidation inside the database transaction.

The official graduation date comes only from
`academic.graduation_record.graduation_date`. It is shown to issuer reviewers
when appropriate. Graduation date is never requested from the student.

## Postponed work

- Passport document upload is postponed and optional; no document is required
  for this account-opening flow.
- Password recovery is not part of the August 7 frontend integration and has no
  approved React Native callback design.
- Transcript VC construction, signing, and issuance belong to Member 3 and are
  outside this implementation.
- Migrations, test-user creation, and live database integration require
  separate approval.

## Security boundaries

- Browser frontends call NestJS only.
- Supabase secret keys and `PASSPORT_HMAC_SECRET` remain backend-only.
- Raw passport identifiers, HMAC values, passwords, and session tokens are
  never logged.
- Academic records remain authoritative and read-only to Member 2.
- The generic holder-status endpoint cannot directly activate an unverified
  holder.
- Member 1's existing migration remains byte-for-byte unchanged.
