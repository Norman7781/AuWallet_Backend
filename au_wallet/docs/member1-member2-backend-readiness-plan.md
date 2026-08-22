# Plan: Member 1 and Member 2 Backend Readiness for August 7

**Generated**: 2026-08-05 (Asia/Bangkok)
**Target meeting**: 2026-08-07
**Estimated complexity**: High
**Scope**: Backend review, correction, integration, migration review, testing, and
API handoff only

## Overview

Recheck Member 1 authentication and holder-account work as a prerequisite, then
deeply review and correct Member 2 onboarding, academic matching, and issuer
review work. The final backend flow must let current students, graduates, and
alumni apply for a wallet, but it must require an AU issuer-staff decision before
the holder becomes active.

This plan does not implement either frontend, create presentation/demo
machinery, add passport-document upload, seed more academic data, or issue VCs.
Its output is a secure, tested backend API contract that both frontend teams can
integrate with after the August 7 meeting.

## Locked scope and business rules

- The existing 20 synthetic academic students and curriculum are the academic
  source of truth. No further academic seeding is required.
- A Supabase Auth user is a wallet login identity; it is not an academic student
  record and does not duplicate the academic dataset.
- Wallet registration creates a `student` Auth user and a `pending` holder
  account.
- Pending student holders may submit onboarding.
- The holder submits exactly:
  - admission number;
  - date of birth in `YYYY-MM-DD` format;
  - passport number.
- The raw passport number is accepted only by NestJS over HTTPS, normalized and
  HMACed in memory, and never stored, returned, or logged.
- Passport-document upload remains postponed.
- Graduation date is not holder-supplied. When relevant, the backend reads the
  official value from `academic.graduation_record`.
- Eligible enrollment statuses are `studying`, `graduated`, and `alumni`.
- `withdrawn` is not wallet-eligible.
- An exact three-factor match plus exactly one eligible enrollment is a system
  recommendation, not final activation.
- AU issuer staff must approve an exact eligible match before the holder becomes
  active.
- A failed or ambiguous system match may be reviewed and rejected, but it cannot
  be manually approved until an independent verification method is designed.
- Rejecting an onboarding request does not automatically reject or suspend the
  holder account. The pending holder may correct the information and resubmit.
- Issuer approval must atomically set the request to `matched`, set reviewer
  metadata, preserve the matched enrollment, activate the holder, and set
  `confirmed_at`.
- Both browser frontends call NestJS. They do not query protected academic or
  wallet application tables directly.
- Member 3's VC creation and Transcript VC eligibility remain downstream and out
  of scope.

## Target state machine

| Request situation                                  | Request status | `matched_enrollment_id` | Issuer action              | Holder status |
| -------------------------------------------------- | -------------- | ----------------------: | -------------------------- | ------------- |
| Exact identity + exactly one eligible enrollment   | `under_review` |                     Set | Approve or reject          | `pending`     |
| No exact identity or ambiguous eligible enrollment | `under_review` |                  `NULL` | Reject; request correction | `pending`     |
| Exact identity but ineligible enrollment           | `rejected`     |                  `NULL` | None for MVP               | `pending`     |
| Issuer approves eligible exact match               | `matched`      |               Preserved | Final                      | `active`      |
| Issuer rejects review request                      | `rejected`     |     Preserved or `NULL` | Final for that request     | `pending`     |

`canApprove` is a derived API value. It is true only when an under-review request
has an exact candidate enrollment and the backend/database can revalidate that
it is still the sole eligible enrollment.

## Ownership boundaries

### Member 1 prerequisite area

- `src/auth-holder-account/**`
- `src/supabase/migrations/202607280001_complete_member1_auth.sql`

Review this area for compatibility and security. Keep Member 1's migration
unchanged. Any necessary source integration change must be minimal, documented,
and discussed with Member 1. The existing protection that prevents the generic
holder-status endpoint from directly setting `active` must remain.

### Member 2 owned area

- `src/onboarding-verification/**`
- `src/supabase/migrations/202608052024_member2_onboarding_integration.sql`
- Member 2 documentation and tests

Member 2 owns corrections to matching, request creation, issuer review,
approval/rejection, response mapping, the backend RPC adapter, and the follow-up
migration.

### Shared integration area

- `src/app.module.ts`
- `src/main.ts`
- `src/config/environment.ts`
- `src/supabase/database.types.ts`
- `test/**`
- `.env.example`

Changes here must be restricted to backend integration, safe configuration,
stable CORS, database boundary types, and cross-module tests.

## Prerequisites

- Preserve the current dirty worktree; do not discard or overwrite unrelated
  teammate changes.
- Use Node.js 22 or the repository-declared supported version.
- Keep `.env`, `.env.seed.local`, and any test-credential file ignored.
- Never print the Supabase secret key, passport HMAC secret, passport input,
  access token, refresh token, or stored passport HMAC.
- Treat both migrations as review artifacts until explicit approval is given.
- Before live work, confirm the runtime `PASSPORT_HMAC_SECRET` matches the seed
  secret without printing either value.

## Sprint 0: Establish a review baseline

**Goal**: Create an evidence-backed ownership and behavior baseline before
editing code.

### Task 0.1: Fingerprint and classify the worktree

- **Location**: repository root
- **Description**:
  - capture `git status`, current commit, and changed-file list;
  - classify each changed file as Member 1, Member 2, or shared integration;
  - identify changes already committed on `origin/main` versus uncommitted work;
  - record hashes for Member 1's migration before and after the review.
- **Acceptance criteria**:
  - no existing change is discarded;
  - Member 1's migration remains byte-for-byte unchanged;
  - unrelated academic seed scripts are outside the edit set.
- **Validation**: compare the final changed-file list and migration hash with the
  baseline.

### Task 0.2: Run the untouched baseline checks

- **Location**: `package.json`, `src/**`, `test/**`
- **Description**: run formatting check, ESLint without `--fix`, unit tests, E2E
  tests, Nest build, and `git diff --check` before making corrections.
- **Acceptance criteria**: failures are recorded as baseline findings rather
  than silently fixed.
- **Validation**: save command names and pass/fail counts in the review report.

**Sprint demo/verification**:

- Produce a one-page table of code ownership, current routes, migrations, test
  counts, and known blockers.

## Sprint 1: Recheck Member 1 authentication prerequisites

**Goal**: Confirm that Member 2 can safely rely on authentication, holder
ownership, and roles without redesigning Member 1's module.

### Task 1.1: Audit registration and pending-holder creation

- **Location**:
  - `src/auth-holder-account/auth/auth.service.ts`
  - `src/auth-holder-account/holder-account/holder-account.service.ts`
  - related DTOs and tests
- **Description**: trace registration from Supabase Auth creation through
  server-controlled `app_metadata.role = student` and pending holder creation.
- **Acceptance criteria**:
  - registration cannot self-assign `issuer_staff` or `admin`;
  - holder ownership uses `auth_user_id`, never email authorization;
  - registration rollback removes the Auth user if holder creation fails;
  - a pending holder can authenticate and submit onboarding;
  - rejected or suspended holder behavior is intentional and tested.
- **Validation**: focused unit tests for successful creation, duplicate email,
  partial failure, and missing holder.

### Task 1.2: Audit login, tokens, and role enforcement

- **Location**:
  - `src/auth-holder-account/auth/**`
  - `src/auth-holder-account/common/guards/**`
  - `src/auth-holder-account/users/**`
  - `src/auth-holder-account/roles/**`
- **Description**: trace login, refresh, logout, `GET /auth/me`, JWT validation,
  and role checks used by both Member 2 controllers.
- **Acceptance criteria**:
  - authorization reads server-controlled `app_metadata`, not user metadata;
  - student tokens cannot call issuer routes;
  - issuer-staff tokens cannot submit student onboarding without a student holder;
  - expired/invalid tokens consistently return `401`;
  - wrong roles consistently return `403`.
- **Validation**: guard/service unit tests and HTTP-level authorization tests.

### Task 1.3: Protect the activation boundary

- **Location**:
  - `src/auth-holder-account/holder-account/dto/update-account-status.dto.ts`
  - `src/auth-holder-account/holder-account/holder-account.service.ts`
  - corresponding tests
- **Description**: preserve defense in depth so the generic status endpoint
  cannot set `active`; only the approved-onboarding transaction may activate a
  holder.
- **Acceptance criteria**:
  - DTO validation rejects `active`;
  - service validation independently rejects `active`;
  - both `issuer_staff` and `admin` are covered by HTTP tests;
  - no generic update can set `confirmed_at`.
- **Validation**: DTO, service, and E2E tests.

### Task 1.4: Review Member 1's migration as a prerequisite

- **Location**:
  `src/supabase/migrations/202607280001_complete_member1_auth.sql`
- **Description**: verify `auth_user_id`, its FK/index, login history, RLS, and
  grants against current Member 1 code. Document that the migration must execute
  atomically without editing it.
- **Acceptance criteria**:
  - follow-up migration can safely narrow any broad grants;
  - execution stops if transactional behavior cannot be guaranteed;
  - the migration is not applied during code review.
- **Validation**: static SQL review and read-only live preflight later.

**Sprint demo/verification**:

- Demonstrate mocked HTTP registration/authentication and prove that direct
  activation is impossible.

## Sprint 2: Correct Member 2's onboarding state machine

**Goal**: Convert the current auto-activation design into system matching plus
explicit issuer approval.

### Task 2.1: Lock matching inputs and eligibility

- **Location**:
  - `src/onboarding-verification/onboarding/dto/create-onboarding-request.dto.ts`
  - `src/onboarding-verification/student-matching/**`
  - `src/onboarding-verification/security/**`
- **Description**: verify trimming, date-only validation, passport
  normalization/HMAC, exact identity lookup, eligible status evaluation, and the
  exactly-one-enrollment rule.
- **Acceptance criteria**:
  - only admission number, DOB, and passport number are accepted;
  - document fields and graduation date are rejected by whitelist validation;
  - zero and multiple matches do not reveal which field failed;
  - studying, graduated, and alumni are eligible;
  - withdrawn is ineligible;
  - the documentation placeholder secret is rejected;
  - raw passport data and HMACs never enter logs or API responses.
- **Validation**: table-driven DTO, HMAC, repository, and matching-service tests.

### Task 2.2: Separate system matching from final approval

- **Location**:
  - `src/onboarding-verification/onboarding/onboarding.service.ts`
  - `src/onboarding-verification/onboarding/onboarding-request.repository.ts`
  - related interfaces and mappers
- **Description**:
  - exact eligible match creates an `under_review` request with its candidate
    `matched_enrollment_id` but does not activate the holder;
  - no/ambiguous match creates `under_review` with no candidate enrollment;
  - ineligible match creates a rejected request with a controlled generic reason;
  - request rejection leaves the holder pending and resubmittable.
- **Acceptance criteria**:
  - submission never sets a holder to `active`;
  - the wallet response never exposes matching internals;
  - only one active workflow exists per holder;
  - a rejected request permits corrected resubmission;
  - concurrent duplicate submissions result in one request and a controlled
    conflict response.
- **Validation**: service/repository unit tests and concurrency-oriented database
  assertions in the migration test checklist.

### Task 2.3: Replace the unconfigured finalizer boundary

- **Location**:
  - `src/onboarding-verification/onboarding/verified-onboarding-finalizer.ts`
  - `src/onboarding-verification/onboarding-verification.module.ts`
  - `src/supabase/database.types.ts`
- **Description**: replace the placeholder provider that always returns `503`
  with a typed Supabase RPC adapter for issuer approval. Rename the abstraction if
  necessary so its purpose is approval rather than submission-time activation.
- **Acceptance criteria**:
  - no production provider uses `UnconfiguredVerifiedOnboardingFinalizer`;
  - the adapter calls only the reviewed backend-only RPC;
  - database function inputs/outputs are represented in boundary types;
  - database errors map to stable HTTP errors without leaking SQL details.
- **Validation**: adapter unit tests for success, stale decision, invalid
  candidate, database failure, and safe error mapping.

**Sprint demo/verification**:

- Show, using service-level tests, that current student and alumnus exact matches
  both stop at `under_review` with the holder still pending.

## Sprint 3: Implement safe issuer review and approval

**Goal**: Give the issuer frontend a legitimate queue, detail view, Approve
button, and Reject button.

### Task 3.1: Define review-safe issuer data

- **Location**:
  - `src/onboarding-verification/issuer-review/**`
  - academic repository extensions under `student-matching/**`
- **Description**: return enough official academic context for an AU reviewer
  without exposing the passport number or HMAC.
- **Review detail fields**:
  - onboarding request ID and submission time;
  - holder account ID;
  - admission number and DOB;
  - system match result and derived `canApprove`;
  - academic name, program/concentration, admission date, and academic status
    only when an exact candidate exists;
  - official graduation date for a graduate/alumnus when available;
  - reviewed time and controlled rejection reason.
- **Acceptance criteria**:
  - raw passport and HMAC never appear in selected columns or returned objects;
  - grades, GPA, full transcript results, and unrelated personal data are absent;
  - current students have no fabricated graduation date;
  - `canApprove` is false for missing, ambiguous, ineligible, stale, or already
    decided requests.
- **Validation**: repository select-list tests and response-shape tests.

### Task 3.2: Implement approve and reject decisions

- **Location**:
  - `src/onboarding-verification/issuer-review/issuer-review.controller.ts`
  - `src/onboarding-verification/issuer-review/issuer-review.service.ts`
  - related DTO, repository, and tests
- **Description**: support both `{ "decision": "approve" }` and controlled
  rejection through the existing decision endpoint.
- **Acceptance criteria**:
  - only `issuer_staff` or `admin` may decide;
  - approval is allowed only for an under-review exact eligible candidate;
  - mismatched requests return `409` on attempted approval;
  - stale or repeated decisions return deterministic `409` errors;
  - rejection records `reviewed_by`, `reviewed_at`, and controlled reason;
  - approval records reviewer metadata and activates the holder atomically.
- **Validation**: DTO, service, controller, and authorization tests.

### Task 3.3: Recheck the current-student and alumnus paths

- **Location**: Member 2 service and E2E tests
- **Description**: encode the two agreed scenarios as named tests.
- **Acceptance criteria**:
  - current student: exact eligible match -> under review -> issuer approval ->
    active wallet; no graduation date is requested or fabricated;
  - alumnus: exact eligible match -> under review -> issuer approval -> active
    wallet; official graduation date may be shown from the academic database;
  - neither scenario creates a Transcript VC in Member 2 code.
- **Validation**: deterministic unit and HTTP-level E2E scenarios.

**Sprint demo/verification**:

- Exercise the issuer queue/detail/approve/reject contract with mocked database
  boundaries and show the exact holder/request transitions.

## Sprint 4: Redesign and review Member 2's follow-up migration

**Goal**: Make database permissions and issuer approval enforce the same rules as
the NestJS code.

### Task 4.1: Replace submission-time activation with approval-time RPC

- **Location**:
  `src/supabase/migrations/202608052024_member2_onboarding_integration.sql`
- **Description**: because this migration has not been applied, revise it so the
  backend-only RPC accepts a request ID and reviewer identity, locks the request
  and holder, and revalidates the stored exact identity and sole eligible
  enrollment before approval.
- **Acceptance criteria**:
  - function is `SECURITY INVOKER` with empty `search_path` and qualified names;
  - only `service_role` may execute it;
  - request must be `under_review` with a candidate enrollment;
  - the database independently rechecks the three-factor identity, exactly one
    eligible enrollment, candidate enrollment ID, and pending holder;
  - request `matched`, `reviewed_by`, `reviewed_at`, holder `active`, and
    `confirmed_at` change in one transaction;
  - zero/multiple/stale/ineligible cases fail generically with no partial update;
  - concurrent approval/rejection cannot produce two decisions.
- **Validation**: static assertions plus transaction/concurrency SQL tests before
  live execution.

### Task 4.2: Recheck grants, RLS, schemas, sequences, and indexes

- **Location**: same migration
- **Description**: keep browser roles away from protected application tables,
  grant the backend only the required academic/wallet operations, enable RLS as
  defense in depth, and retain the partial unique workflow index.
- **Acceptance criteria**:
  - authenticated browser role has no direct holder, onboarding, document, or
    academic-table access;
  - service role reads only the academic tables used by Member 2;
  - service role has only required wallet table/sequence/function privileges;
  - all application tables in exposed schemas have RLS enabled;
  - postflight assertions verify the exact intended privileges and objects;
  - `uploaded_identity_document` remains unused and inaccessible.
- **Validation**: migration SQL checks and, after approval, Supabase security and
  performance advisors.

### Task 4.3: Verify migration ordering and rollback behavior

- **Location**: both migration files and the readiness report
- **Description**: document the exact order: Member 1 migration first, Member 2
  follow-up second. Confirm each is executed as a single transaction and stop on
  any failed preflight.
- **Acceptance criteria**:
  - no Auth users or wallet rows exist before strict preflight unless the plan is
    deliberately revised;
  - failure cannot leave a partially active holder/request;
  - no migration is applied without explicit approval.
- **Validation**: dry structural review and captured preflight queries.

**Sprint demo/verification**:

- Review the full SQL and a state-transition table; do not apply it yet.

## Sprint 5: Stabilize the API contract

**Goal**: Give both frontend teams a concise contract backed by tests, without
implementing either frontend.

### Task 5.1: Lock wallet-facing routes

- **Location**: Auth, holder, and onboarding controllers plus a new API contract
  document
- **Required routes**:
  - `POST /auth/register`
  - `POST /auth/login`
  - `POST /auth/refresh`
  - `POST /auth/logout`
  - `GET /auth/me`
  - `GET /holder-accounts/me`
  - `POST /onboarding-verification/requests`
  - `GET /onboarding-verification/requests/me`
- **Acceptance criteria**:
  - request DTOs and example responses match runtime behavior;
  - exact match returns `under_review`, not `matched` or active;
  - status polling shows the transition after issuer decision;
  - passport handling warning is explicit;
  - optional password/email-management endpoints are documented separately from
    the core onboarding flow.
- **Validation**: HTTP contract tests for every route, role, and major status.

### Task 5.2: Lock issuer-facing routes

- **Location**: issuer-review controller and API contract document
- **Required routes**:
  - `POST /auth/login`
  - `POST /auth/refresh`
  - `POST /auth/logout`
  - `GET /auth/me`
  - `GET /issuer/onboarding-requests?page=1&limit=20`
  - `GET /issuer/onboarding-requests/:id`
  - `PATCH /issuer/onboarding-requests/:id/decision`
- **Acceptance criteria**:
  - list/detail return review-safe fields and `canApprove`;
  - Approve works only for a system-confirmed exact eligible candidate;
  - Reject uses controlled reasons;
  - pagination and empty queue behavior are documented;
  - issuer staff cannot self-register through the student route.
- **Validation**: HTTP contract and role-authorization tests.

### Task 5.3: Standardize success and error envelopes

- **Location**: shared response/exception handling and all reviewed controllers
- **Description**: choose and apply one stable contract before handing routes to
  the frontend teams.
- **Target success shape**:

  ```json
  { "data": {}, "message": "...", "meta": {} }
  ```

- **Target error shape**:

  ```json
  {
    "error": {
      "code": "STABLE_MACHINE_CODE",
      "message": "Safe user-facing message",
      "details": []
    }
  }
  ```

- **Acceptance criteria**:
  - validation, authentication, authorization, not found, conflict, and internal
    errors follow the same envelope;
  - database errors and sensitive identity details are never exposed;
  - frontend behavior can depend on stable machine codes rather than message
    text.
- **Validation**: E2E assertions for representative `400`, `401`, `403`, `404`,
  `409`, and `500/503` cases.

### Task 5.4: Produce the August 7 backend handoff

- **Location**: `docs/backend-api-contract-2026-08-07.md`
- **Description**: publish base URL/ports, CORS origins, authentication header,
  route tables, payloads, response examples, state meanings, error codes, and
  known prerequisites.
- **Acceptance criteria**:
  - contains no credentials, tokens, raw passports, HMACs, or secrets;
  - clearly labels routes as implemented/tested versus blocked on migration;
  - frontend teammates can implement without reading NestJS source.
- **Validation**: manually compare every documented route with controller and
  E2E behavior.

**Sprint demo/verification**:

- Use API-level automated requests to show the contract. No frontend work is
  required for this sprint.

## Sprint 6: Full verification and gated live integration

**Goal**: Prove code readiness locally, then prove Supabase integration only
after explicit migration approval.

### Task 6.1: Run the complete local verification suite

- **Commands**:
  - Prettier check without writing;
  - ESLint without `--fix`;
  - `npm test -- --runInBand`;
  - `npm run test:e2e -- --runInBand`;
  - `npm run build`;
  - `git diff --check`;
  - static migration safety checks.
- **Acceptance criteria**:
  - all checks pass;
  - E2E coverage includes real controller/service wiring, not only route guards;
  - no unrelated file is automatically formatted or changed.

### Task 6.2: Perform read-only Supabase preflight

- **Description**: verify project reference, expected academic counts, wallet/Auth
  emptiness or approved state, existing columns/functions/policies/grants, Data
  API exposure, and migration absence.
- **Acceptance criteria**:
  - correct project is `ezsylcmnqbcwvkoqybkd`;
  - academic mock rows are unchanged;
  - preflight matches both migration assumptions;
  - no values of sensitive columns are selected or printed.

### Task 6.3: Apply and verify only after approval

- **Dependencies**: Member 1 confirmation, final SQL review, explicit user
  authorization.
- **Description**: apply Member 1 then Member 2 atomically, run postflight and
  Supabase advisors, and live-test the APIs with the smallest agreed set of
  securely provisioned test identities.
- **Acceptance criteria**:
  - migrations commit in order;
  - no academic fixture changes occur;
  - current-student and alumnus requests remain pending until issuer approval;
  - approval atomically activates each holder;
  - mismatch cannot be approved;
  - wallet and issuer routes work with real JWT role enforcement.
- **Validation**: live relationship/status checks and API smoke results without
  printing credentials or protected identifiers.

**Sprint demo/verification**:

- Produce a backend readiness report with migration state, advisor results, route
  tests, state transitions, and remaining frontend/account-provisioning decisions.

## Testing strategy

- **Unit tests**: normalization/HMAC, matching cardinality, eligibility, service
  state transitions, response mapping, safe error mapping, and approval rules.
- **Repository tests**: exact selected columns, filter/update predicates,
  conflict handling, pagination, and absence of protected outputs.
- **Controller tests**: DTO validation, bearer-token requirement, role matrix,
  response envelopes, and stable error codes.
- **HTTP E2E tests**: complete wallet submission/status and issuer
  queue/detail/decision stories using controlled providers.
- **Migration tests**: exact grants, RLS, function execution privileges,
  concurrent decision protection, rollback, and state assertions.
- **Live smoke tests**: only after approval; validate current-student, alumnus,
  mismatch/rejection, correction/resubmission, and forbidden-role paths.

## Definition of ready for frontend handoff

- Member 1 dependency review has no unresolved security or compatibility blocker.
- Member 2 no longer auto-activates during submission.
- Production DI contains a real typed approval RPC adapter, not the placeholder
  finalizer.
- Issuer Approve and Reject behavior is implemented and tested.
- Current student and alumnus scenarios are named tests.
- Passport-document upload and holder-entered graduation date are absent.
- Success/error envelopes and machine codes are stable.
- API contract matches controller behavior.
- Local formatting, lint, unit, E2E, build, and migration checks pass.
- Live-dependent items are clearly labeled until migrations are approved.

## Risks and gotchas

- **Dirty worktree**: bulk formatting or resetting could destroy teammate work.
  Use narrow patches and compare the changed-file inventory after every sprint.
- **Current auto-activation design**: the existing migration and service must not
  be applied unchanged after the issuer-approval decision.
- **Placeholder finalizer**: current production DI returns `503` for the exact
  match path; mocked tests can hide this unless provider wiring is explicitly
  tested.
- **Status ambiguity**: define `matched` as the final issuer-approved state and
  `under_review` as waiting for a decision. Do not let frontend labels redefine
  database semantics.
- **Request rejection vs account rejection**: keep these separate so a student
  can correct and resubmit.
- **Manual mismatch approval**: do not enable it until AU defines independent
  evidence or a registrar workflow.
- **Email confirmation**: confirmation delivery may affect live login testing but
  must not change the API or database security design.
- **Mocked versus live E2E**: passing mocked HTTP tests is necessary but not proof
  that grants, RLS, and RPC permissions work in Supabase.
- **Cross-schema Data API exposure**: verify exposure, grants, and RLS separately;
  one does not replace the others.

## Rollback plan

- During review, revert only newly introduced Member 2 corrections using narrow
  patches; never reset the shared worktree.
- Before migration execution, rely on transaction preflight and rollback on any
  assertion failure.
- If live execution succeeds but behavior is wrong, stop API traffic and prepare
  a reviewed forward migration; do not manually edit rows or rewrite applied
  migration history.
- Preserve academic fixtures throughout. Any rollback that would touch academic
  student, curriculum, results, transcripts, or graduation rows requires a
  separate explicit review.
