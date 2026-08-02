# Plan: Member 2 Onboarding and Verification

**Generated**: 2026-08-02
**Estimated complexity**: High overall; low for the first increment

## Overview

Member 2 can begin without waiting for Member 1's HTTP APIs by building the
security and academic-matching core behind internal NestJS services and mocked
tests. The first two increments will not expose an HTTP endpoint, write to
Supabase, upload documents, activate holder accounts, or modify Member 1's
implementation.

The first real onboarding endpoint and wallet persistence will wait until the
Member 1 authentication/holder-account database contract is usable in the live
project. This prevents Member 2 from inventing a second authentication system or
coupling verification code to a schema that is known to be changing.

## Locked contracts

- Project: `senior project 2` (`ezsylcmnqbcwvkoqybkd`).
- Member 2 code belongs under `src/onboarding-verification/`.
- Academic records are authoritative and read-only to Member 2.
- Automatic matching uses exactly admission number, date of birth, and
  passport-number HMAC.
- Personal email, university email, and names are not matching factors.
- Passport normalization is Unicode NFKC, trim, remove spaces and hyphens, then
  uppercase letters.
- Passport protection uses HMAC-SHA-256 with `PASSPORT_HMAC_SECRET` and
  lowercase hexadecimal output.
- The raw passport identifier is received only over TLS. A passport document
  image or PDF is optional and is not required for automatic matching.
- A raw passport number must never be stored, logged, returned, or included in
  an error.
- Graduation date is not an automatic matching factor. Any future
  `claimedGraduationDate` is optional supporting evidence for manual review and
  must never replace `academic.graduation_record.graduation_date`.
- Wallet workflow state belongs in `wallet.wallet_onboarding_request` and
  `wallet.uploaded_identity_document`.
- Member 1 remains responsible for authentication, holder-account ownership,
  roles, account security, and auth-related RLS/grants.
- Member 3 remains responsible for VC eligibility, construction, signing, and
  issuance.

## Confirmed current-state constraints

- The repository contains Member 1 controllers and services, but her external
  API and migration contract are considered unfinished.
- Member 1's existing guard contract provides `supabaseAuthId`,
  `holderAccountId`, `role`, and `accountStatus` when its backing schema is
  available.
- The live `wallet.holder_account` table does not currently contain
  `auth_user_id`, so a live authenticated student cannot yet be reliably joined
  to a holder row through the planned Member 1 implementation.
- The live `wallet.login_history` table is also absent. Member 1's local
  migration exists but has not been applied and still needs holder-account
  identity-sequence permission.
- The live `service_role` currently has no direct schema/table access to the
  academic or wallet application tables. Backend grants and Data API schema
  exposure must be agreed before live Supabase client queries are enabled.
- The repository Supabase types describe Member 1 objects that do not all exist
  in the live schema. Member 2 must not regenerate or overwrite those types
  independently.
- `wallet.wallet_onboarding_request.verification_status` accepts only
  `submitted`, `under_review`, `matched`, and `rejected`. The implementation
  must use `under_review` for manual review; it must not invent a
  `manual_review` database value.
- The database permits only one matched request per holder and makes
  `matched_enrollment_id` unique, but it does not guarantee one active
  submitted/under-review request per holder.
- `wallet.uploaded_identity_document.storage_object_path` is required. Document
  persistence must wait until the source and ownership of that path are agreed.
  An onboarding request must not require a document row.
- RLS is currently disabled on the academic and wallet application tables. This
  is a separate shared security concern and is not part of the Member 2 feature
  implementation plan.

## Prerequisites

- Node.js 22 or later and the existing pinned dependencies.
- A backend-only `PASSPORT_HMAC_SECRET` supplied at runtime; no real value is
  committed or printed.
- The existing `SupabaseService` for later read-only academic queries.
- Member 1 coordination before protected endpoints or holder activation.
- Explicit approval before any migration, constraint, RLS, grant, policy, or
  live database write.

## Sprint 1: Passport security foundation

**Goal**: Produce a testable Member 2 security component without HTTP routes or
database access.

**Demo/validation**:

- Run the focused unit tests for the passport HMAC service.
- Confirm normalization is deterministic and distinct normalized inputs produce
  distinct 64-character lowercase hexadecimal outputs.
- Confirm tests and exceptions never print the secret, raw input, or digest.

### Task 1.1: Create the Member 2 module boundary

- **Location**:
  - `src/onboarding-verification/onboarding-verification.module.ts`
- **Description**: Create the feature module without registering controllers or
  importing it into `AppModule` yet.
- **Dependencies**: None.
- **Acceptance criteria**:
  - The module contains only Member 2 providers.
  - No Member 1 file changes are required.
  - No Supabase calls occur during module construction.
- **Validation**: Nest testing module compiles.

### Task 1.2: Implement passport normalization and HMAC

- **Location**:
  - `src/onboarding-verification/security/passport-hmac.service.ts`
  - `src/onboarding-verification/security/passport-hmac.service.spec.ts`
- **Description**: Normalize in memory, calculate HMAC-SHA-256, and return only
  the lowercase hexadecimal digest to trusted backend callers.
- **Dependencies**: Task 1.1.
- **Acceptance criteria**:
  - Uses the locked normalization algorithm in the locked order.
  - Rejects empty input after normalization.
  - Reads the HMAC secret through backend configuration only.
  - Contains no logging of inputs, secrets, or output values.
  - Tests use obviously synthetic, non-real identifier strings.
- **Validation**: Focused Jest unit tests plus lint/build.

### Task 1.3: Fail closed when the service secret is unavailable

- **Location**:
  - `src/onboarding-verification/security/passport-hmac.service.ts`
  - `src/onboarding-verification/security/passport-hmac.service.spec.ts`
- **Description**: Read `PASSPORT_HMAC_SECRET` through `ConfigService` and fail
  service construction when it is absent or empty. Do not change the global
  environment validator while the Member 2 module is not registered in
  `AppModule`.
- **Dependencies**: Task 1.2.
- **Acceptance criteria**:
  - No real secret is committed.
  - The variable is not exposed as a public/browser variable.
  - Focused tests provide a safe synthetic value and cover missing/empty values.
  - Member 1's current application startup requirements remain unchanged.
- **Validation**: Focused unit tests, then full build.

**Suggested checkpoint commit**: `Add passport HMAC verification foundation`

## Sprint 2: Read-only academic matching core

**Goal**: Match a supplied identity against academic data through a service that
is fully testable with mocks and performs no wallet writes.

**Demo/validation**:

- Unit-test exact three-factor matching.
- Demonstrate studying, graduated, and alumni as wallet-eligible statuses.
- Demonstrate withdrawn and suspended as wallet-ineligible statuses.
- Demonstrate every mismatch returning the same internal non-disclosing result.
- Demonstrate zero or multiple eligible enrollments moving to manual review
  rather than selecting an enrollment silently.

### Task 2.1: Define Member 2-local matching models

- **Location**:
  - `src/onboarding-verification/student-matching/student-match.interface.ts`
  - `src/onboarding-verification/student-matching/academic-student-record.interface.ts`
- **Description**: Define the minimum fields Member 2 needs from student and
  enrollment rows without changing shared generated/manual Supabase types.
- **Dependencies**: Sprint 1.
- **Acceptance criteria**:
  - No names or emails are part of the match input.
  - Results distinguish matched-and-eligible, matched-but-ineligible, and no
    match internally.
  - External callers can map failures to one generic response.
- **Validation**: TypeScript build.

### Task 2.2: Implement the academic lookup service

- **Location**:
  - `src/onboarding-verification/student-matching/academic-student.repository.ts`
  - `src/onboarding-verification/student-matching/academic-student.repository.spec.ts`
- **Description**: Query `academic.student` using admission number, date of
  birth, and computed passport HMAC, then resolve the related enrollment.
- **Dependencies**: Task 2.1.
- **Acceptance criteria**:
  - All three factors are included in the same academic student lookup.
  - Academic queries are select-only.
  - Returned fields are limited to identifiers and academic status required by
    verification.
  - Database errors are not converted into misleading match failures.
- **Validation**: Mocked Supabase-client tests; optional read-only live query that
  returns counts only and never returns HMAC values.

### Task 2.3: Implement the student matching service

- **Location**:
  - `src/onboarding-verification/student-matching/student-matching.service.ts`
  - `src/onboarding-verification/student-matching/student-matching.service.spec.ts`
- **Description**: Orchestrate normalization/HMAC, academic lookup, and wallet
  status eligibility without persistence.
- **Dependencies**: Tasks 2.1 and 2.2.
- **Acceptance criteria**:
  - `studying`, `graduated`, and `alumni` are eligible for wallet onboarding.
  - `withdrawn` and `suspended` are ineligible.
  - Transcript VC eligibility is not decided here.
  - The service does not retain, store, return, or log the raw or normalized
    passport identifier.
- **Validation**: Unit tests covering success, every mismatch factor, duplicate
  academic results, ineligible status, and database failure.

**Suggested checkpoint commit**: `Add read-only academic student matching`

## Sprint 3: Member 1 and database readiness gate

**Goal**: Establish the shared contract required before exposing or persisting a
real onboarding request.

**Demo/validation**:

- A real authenticated student request resolves to exactly one holder account.
- The guard supplies a non-null `holderAccountId` for that student.
- Member 2 tests can use a dedicated test configuration without live production
  rows.

### Task 3.1: Reconcile Member 1's live migration state

- **Owner**: Member 1 with team review.
- **Required outcomes**:
  - `wallet.holder_account.auth_user_id` exists and is unique.
  - Holder-account identity-sequence permission is included.
  - `wallet.login_history` and repository types match the applied schema.
  - JWT refresh behavior for changed privileged roles is accepted.
  - Test environment, CORS, and administrator bootstrap are documented.
- **Restriction**: Member 2 does not independently apply or rewrite this
  migration.

### Task 3.2: Agree the shared authorization contract

- **Owners**: Members 1 and 2.
- **Required outcomes**:
  - Student endpoints use Member 1's `JwtAuthGuard` and trusted
    `holderAccountId`, plus an explicit student-role requirement or equivalent
    non-null-holder contract.
  - Review endpoints additionally use `RolesGuard` for `issuer_staff` and
    `admin`.
  - Holder activation remains a Member 1-owned operation.
  - The RLS/grant model is jointly approved before database security changes.
  - `academic` and `wallet` Data API exposure is confirmed for backend-only use.
  - Backend permissions are limited to academic reads and the required wallet
    workflow operations.

### Task 3.3: Reconcile shared Supabase types

- **Location**: `src/supabase/database.types.ts` only after schema agreement.
- **Description**: Merge accurate academic and wallet types without erasing
  Member 1-owned types.
- **Dependencies**: Task 3.1.
- **Validation**: Full TypeScript build and Member 1/Member 2 test suites.

### Task 3.4: Approve runtime environment integration

- **Location**:
  - `src/config/environment.ts`
  - `.env.example`
- **Description**: Add `PASSPORT_HMAC_SECRET` to the typed global backend
  environment contract immediately before Member 2 becomes a runtime module.
- **Dependencies**: Member 1 test/startup configuration agreement.
- **Acceptance criteria**:
  - No real secret is committed or printed.
  - Local, test, and deployed backend environments receive the variable through
    their approved secret-management path.
  - The variable is never prefixed or configured for browser exposure.
- **Validation**: Environment validation tests plus both members' test suites.

## Sprint 4: Authenticated onboarding submission and status

**Goal**: Expose a protected student API that stores a wallet request while
keeping academic tables read-only.

**Demo/validation**:

- An authenticated synthetic student submits onboarding details.
- A valid eligible match is stored as `matched` with its enrollment ID.
- A mismatch is stored as `under_review` and receives a generic response.
- An academically ineligible status is denied without revealing a matching
  factor.
- The holder can retrieve only their own request status.

### Task 4.1: Add the submission DTO and response contract

- **Location**:
  - `src/onboarding-verification/onboarding/dto/create-onboarding-request.dto.ts`
  - `src/onboarding-verification/onboarding/onboarding-response.interface.ts`
- **Acceptance criteria**:
  - Accepts admission number, ISO date of birth, and passport input.
  - Does not require graduation date or a passport-document upload.
  - Does not accept `holderAccountId`, role, status, or matched enrollment from
    the browser.
  - Raw passport input is excluded from responses and logs.

### Task 4.2: Implement wallet request persistence

- **Location**:
  - `src/onboarding-verification/onboarding/onboarding-request.repository.ts`
  - corresponding unit tests
- **Acceptance criteria**:
  - Writes only to `wallet.wallet_onboarding_request`.
  - Stores only the HMAC, never the raw passport.
  - Uses the authenticated holder ID supplied by Member 1.
  - Checks for an existing active request before insert.
  - Maps unique conflicts to a safe conflict response.
- **Known limitation**: The existing database does not prevent two concurrent
  submitted/under-review requests. A partial unique constraint is a separate
  proposed migration requiring approval.

### Task 4.3: Implement onboarding orchestration

- **Location**:
  - `src/onboarding-verification/onboarding/onboarding.service.ts`
  - corresponding unit tests
- **Acceptance criteria**:
  - Calls the three-factor matching service once.
  - Maps eligible matches to `matched`.
  - Maps no-match outcomes to `under_review` with no factor disclosure.
  - Maps ineligible academic status according to the agreed rejection-versus-
    review policy while returning a generic public result.
  - Does not activate the holder account.

### Task 4.4: Expose protected student endpoints

- **Location**:
  - `src/onboarding-verification/onboarding/onboarding.controller.ts`
  - `src/onboarding-verification/onboarding-verification.module.ts`
  - `src/app.module.ts`
- **Shared edit rationale**: `AppModule` must import the Member 2 module for its
  routes to exist. No Member 1 behavior is changed.
- **Authorization**: Student routes use Member 1's `JwtAuthGuard` and an
  explicit student-role requirement; the browser never supplies
  `holderAccountId`.
- **Endpoints**:
  - `POST /onboarding-verification/requests`
  - `GET /onboarding-verification/requests/me`
- **Validation**: Controller tests with mocked guards/services, then an isolated
  end-to-end test environment approved by the team.

**Suggested checkpoint commit**: `Add authenticated onboarding request flow`

## Sprint 5: Optional identity-document metadata

**Goal**: Optionally record validated document metadata for manual review only
after a trustworthy storage path contract exists. Automatic matching and basic
onboarding submission do not require an upload.

### Task 5.1: Agree the storage boundary

- Decide whether the Nest backend uploads files, issues signed upload paths, or
  receives a path from another trusted service.
- Do not accept arbitrary client-controlled object paths.
- Plan Storage RLS jointly with Member 1 and the team.

### Task 5.2: Implement the document service

- **Location**:
  - `src/onboarding-verification/documents/`
- **Acceptance criteria**:
  - Stores document type, trusted object path, original filename, MIME type,
    file size, and file hash.
  - Verifies request ownership through the authenticated holder.
  - Does not parse, persist, or log raw passport numbers.
  - Restricts MIME type and file size according to an agreed allowlist.

**Suggested checkpoint commit**: `Add onboarding document metadata service`

## Sprint 6: Issuer review and Member 3 handoff

**Goal**: Allow authorized staff to review requests and produce a stable approved
verification result for VC management.

### Task 6.1: Add issuer review endpoints

- **Location**: `src/onboarding-verification/issuer-review/`
- **Authorization**: Member 1's JWT guard plus `issuer_staff`/`admin` role guard.
- **Acceptance criteria**:
  - Lists requests requiring review without returning passport HMAC values.
  - Stores reviewer Supabase Auth ID in `reviewed_by`.
  - Records review time and a controlled rejection reason.
  - Prevents students from reviewing requests.

### Task 6.2: Coordinate holder-account activation

- Member 2 records the verification decision.
- Member 1 owns the operation that changes `holder_account.account_status`.
- The team must choose an atomic database operation or an explicit compensation
  strategy before approval updates both records.

### Task 6.3: Define the Member 3 handoff

- Return only the approved onboarding request ID, holder account ID, and matched
  enrollment ID required by VC management.
- Member 3 independently evaluates Transcript VC eligibility from academic
  enrollment, graduation, program-credit, and transcript records.
- Member 2 must not issue or sign a VC.

**Suggested checkpoint commit**: `Add issuer onboarding review workflow`

## Testing strategy

- Unit-test passport normalization/HMAC without fixed digest output in logs.
- Mock Supabase for all Sprint 1 and Sprint 2 tests.
- Test every academic status and each individual mismatch while asserting the
  same public failure response.
- Test ownership boundaries: holder IDs always come from the authenticated
  request, never a DTO.
- Test review authorization for student, issuer staff, and admin roles.
- Test duplicate and concurrent submission behavior explicitly.
- Do not write test records to the shared live project until a dedicated test
  approach and cleanup policy are approved.
- Run Prettier checks, TypeScript/Nest build, Jest, and relevant end-to-end tests
  at every checkpoint.

## Risks and gotchas

- **Live/auth mismatch**: Member 1's current repository types and services expect
  database objects not yet present live. Do not build a competing workaround in
  Member 2.
- **RLS disabled**: Academic and wallet tables are exposed without row-level
  protection if they are later granted and exposed through the Data API. Direct
  application-role grants are currently absent and Data API exposure is not yet
  confirmed. This requires a joint security plan; enabling RLS without policies
  could also break all access, so it must not be changed casually.
- **Backend secret authority**: The backend Supabase secret can bypass normal
  user-level protections. Every Member 2 endpoint must enforce ownership and
  roles in Nest even after RLS is added.
- **Active-request race**: An application-level `WHERE NOT EXISTS` check is not a
  complete concurrency guarantee. A database uniqueness rule may be needed
  later with explicit approval.
- **Status vocabulary**: Use `under_review`, not an invented manual-review
  status.
- **Document path requirement**: Document metadata cannot be safely inserted
  until the storage path source is defined. The absence of a document must not
  block automatic matching.
- **Backend access not ready**: The live `service_role` lacks the required
  schema and table privileges, and custom schemas must be exposed before
  `.schema('academic')` or `.schema('wallet')` can be used through Supabase's
  Data API.
- **HMAC secret rotation**: Changing the secret breaks equality matching against
  existing academic HMAC values. Rotation requires a planned dual-key or
  controlled recomputation process and is outside the first mockup increment.
- **Sensitive DTO logging**: Do not log whole request bodies or validation
  objects containing the passport input.

## Rollback plan

- Keep every sprint as a separate reviewed commit.
- Sprint 1 and Sprint 2 contain no database writes and can be reverted without
  data cleanup.
- Do not create migrations as part of feature-code commits.
- If a later wallet write fails, preserve the existing row for diagnosis; do not
  delete or truncate shared data.
- Any schema or security rollback must be designed jointly before the associated
  migration is approved.

## Current implementation checkpoint

Implement Sprint 1 and the mocked, read-only Sprint 2 matching core. Stop before
shared environment changes, controllers, AppModule changes, live Supabase
calls, wallet writes, document persistence, or Member 1 integration.
