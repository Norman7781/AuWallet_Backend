# AU Wallet Backend

Java / Spring Boot backend for the AU Wallet app. This version handles
**wallet account creation, onboarding, and identity matching against a
synthetic academic database hosted on Supabase**. It does **not** yet issue
Verifiable Credentials or handle Verifiable Presentation flows — that's the
next phase, once this data layer and matching flow are confirmed working.

## What this service does right now

```text
1. Applicant creates a pending wallet account (university email).
2. Applicant submits admission number, date of birth, and passport number.
3. Backend hashes the passport number (HMAC) — the raw value is never stored.
4. Backend checks all four values (admission_no, date_of_birth,
   university_email, passport_number_hmac) against the academic database.
5. Match found + eligible enrollment  -> wallet account becomes active.
6. No confident match                 -> request is rejected or routed to
                                          manual review (optional document
                                          upload metadata supported).
7. (Not built yet) Issuer creates and delivers a Transcript VC for eligible
   graduates/alumni.
```

This mirrors the flow and table design locked in
`2026-07-15-locked-two-database-erd-plan.md`. If you change the matching
fields, statuses, or table shapes, update that plan first — this code
follows it, not the other way around.

## Deliberately excluded from login/onboarding, per the locked plan

The onboarding form only asks for **admission number, date of birth, and
passport number** (university email comes from the account, not the form).
It intentionally does **not** ask for name, graduation date, or a passport
photo at that step:

- **Official name** is never entered by the applicant. It's resolved *after*
  a successful match, by reading `academic.student` — see
  `GET /api/v1/holder-accounts/{id}/profile`.
- **Graduation date** belongs to eligibility for a Transcript VC later, not
  identity matching now.
- **Passport photo** is optional evidence for *manual review only*, via
  `wallet.uploaded_identity_document` — never a required login field, and
  never required when the automatic four-field match already succeeds.

If the product actually needs to collect a photo/name/graduation date at
login time for a different reason, that's a real change to the locked plan
and should be discussed before the schema changes — this scaffold is built
to match what's currently agreed.

## Architecture

```text
Supabase Postgres (one project, two schemas)
├── academic  (8 tables) — source of truth, READ-ONLY from this app
│   program, student, student_program_enrollment, course,
│   academic_term, course_result, transcript, graduation_record
└── wallet    (3 tables) — owned by this app
    holder_account, wallet_onboarding_request, uploaded_identity_document

Spring Boot app
├── com.auwallet.academic   — JPA entities + repositories, read-only
├── com.auwallet.wallet     — entities, repositories, services, controllers
├── com.auwallet.common     — passport HMAC, exceptions
└── com.auwallet.config     — Swagger / OpenAPI, CORS
```

Two logical databases, one physical Supabase project, in two Postgres
schemas — this is the simplest option under the locked plan's "one project
with two schemas versus separate projects" open question. `wallet` never
writes to `academic`. `matched_enrollment_id` is stored as a plain `bigint`
in `wallet.wallet_onboarding_request`, **not** a physical foreign key,
because the plan explicitly defers that decision. If you later split
`academic` and `wallet` into separate Supabase projects, no application
code changes — only the Flyway `schemas` config and connection string.

## Setup

### 1. Create a Supabase project

Use the free tier for development. Once created, go to
**Project Settings → Database** for your connection details.

### 2. Choose a Supabase connection string

Supabase gives you three connection modes. For this app (a persistent
Spring Boot service using Hikari + JPA), use:

- **Session pooler** (recommended) or the **direct connection** — both
  behave like a normal Postgres connection and work with JPA out of the box.
- **Avoid the Transaction pooler** (port 6543) unless you explicitly set
  `spring.jpa.properties.hibernate.connection.provider_disables_autocommit`
  and disable server-side prepared statements — pgbouncer's transaction
  mode breaks JDBC's prepared statement cache otherwise.

### 3. Set environment variables

Copy `.env.example` to `.env` and fill in real values (or export them
directly — this project reads plain env vars, no `.env` loader is wired up
by default, so use `export $(cat .env | xargs)` locally, a `direnv` setup,
or your IDE's run-configuration env vars).

```text
SUPABASE_DB_URL=jdbc:postgresql://<host>:5432/postgres?sslmode=require
SUPABASE_DB_USER=postgres.<project-ref>
SUPABASE_DB_PASSWORD=<your-db-password>
PASSPORT_HMAC_SECRET=<openssl rand -hex 32>
APP_CORS_ORIGINS=http://localhost:3000
```

### 4. Run it

```bash
mvn spring-boot:run
```

On startup, Flyway automatically creates the `academic` and `wallet`
schemas and all 11 tables (`V1`, `V2`), then seeds one synthetic student
for local testing (`V3`). Nothing here touches a real student's data —
all seed values are fabricated.

### 5. Open Swagger

```text
http://localhost:8080/swagger-ui.html
```

Every endpoint, request/response shape, and description is generated from
the controllers — this is the live source of truth for the API surface,
more so than any list in this README.

## Local smoke test

The seed data (`V3__seed_synthetic_academic_data.sql`) creates one
synthetic student matchable with:

```text
admissionNo:   6611201
dateOfBirth:   2003-05-14
universityEmail: aungkaungmyat.stu@au.edu
passportNumber:  P1234567
```

```bash
# 1. Create a pending wallet account
curl -X POST http://localhost:8080/api/v1/holder-accounts \
  -H "Content-Type: application/json" \
  -d '{"universityEmail":"aungkaungmyat.stu@au.edu"}'
# -> {"holderAccountId":1,"accountStatus":"pending",...}

# 2. Submit the matching attempt
curl -X POST http://localhost:8080/api/v1/holder-accounts/1/onboarding-requests \
  -H "Content-Type: application/json" \
  -d '{"admissionNo":"6611201","dateOfBirth":"2003-05-14","passportNumber":"P1234567"}'
# -> {"verificationStatus":"matched","matchedEnrollmentId":1,...}

# 3. Check the resolved profile (name now resolved from academic.student)
curl http://localhost:8080/api/v1/holder-accounts/1/profile
```

> Note: the seeded `passport_number_hmac` was computed with the **default**
> local dev secret. If you set your own `PASSPORT_HMAC_SECRET`, this seed
> row won't match anymore — either unset it for local testing, or edit
> `V3__seed_synthetic_academic_data.sql` with a hash computed under your
> secret.

## API surface

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/holder-accounts` | Create a pending wallet account |
| GET | `/api/v1/holder-accounts/{id}` | Get account status |
| GET | `/api/v1/holder-accounts/{id}/profile` | Resolved profile (name, academic status) after a match |
| POST | `/api/v1/holder-accounts/{id}/onboarding-requests` | Submit a matching attempt |
| GET | `/api/v1/holder-accounts/{id}/onboarding-requests` | List a holder's attempts |
| GET | `/api/v1/onboarding-requests/{id}` | Get one attempt |
| PATCH | `/api/v1/onboarding-requests/{id}/review` | Manual reviewer decision (matched/rejected) |
| POST | `/api/v1/onboarding-requests/{id}/documents` | Attach identity-document metadata (evidence only) |
| GET | `/api/v1/onboarding-requests/{id}/documents` | List document metadata for a request |

## Rules this code enforces (from the locked plan)

- The raw passport number is hashed (`PassportHmacService`) before it ever
  reaches a repository, log line, or exception message, and is never
  included in any response DTO.
- All four fields (`admission_no`, `date_of_birth`, `university_email`,
  `passport_number_hmac`) must match the same academic student row for an
  automatic match — see `MatchingService.attemptMatch`.
- Only one onboarding request per holder may be `matched`
  (`uq_one_matched_request_per_holder` unique partial index).
- One academic enrollment can't be claimed by two holders
  (`matched_enrollment_id` is unique when present).
- A matched request has no rejection reason; a rejected request has no
  matched enrollment (DB check constraints).
- Rejecting one onboarding request does not reject the holder account —
  the account stays `pending` so the holder can retry.
- The wallet database never writes to the academic schema.
- The official name is only ever read after a successful match, never
  collected from the applicant.

## Explicitly not implemented yet

- Verifiable Credential issuance and Verifiable Presentation flows.
- Authentication (login sessions, tokens, password storage) — every
  endpoint above is currently unauthenticated. Do not deploy this beyond a
  local/dev environment as-is.
- Supabase Row Level Security policies / Data API exposure.
- Real object storage wiring for uploaded identity documents (this app
  only stores the `storage_object_path` string — actual upload to Supabase
  Storage happens client-side or via a signed URL you build separately).
- Transcript VC eligibility endpoint (the read model — `Transcript`,
  `GraduationRecord` entities/repositories — already exists for this, it's
  just not wired to a controller yet).
- Staff/reviewer identity — `reviewedBy` is free text, not an authoritative
  audit trail.

## Assumptions made while scaffolding (flag if wrong)

The locked plan doesn't fully specify a couple of behaviors this code had
to pick a default for:

1. **Tie-break when a student has multiple eligible enrollments**: picks
   the earliest by `enrollment_id`. (`MatchingService`, documented inline.)
2. **Automatic under_review vs. rejected split**: if zero students match
   all four fields → `rejected`. If a student matches but has no eligible,
   unclaimed enrollment → `under_review`. The plan describes both outcomes
   but not exactly which condition triggers which; adjust
   `MatchingService.attemptMatch` if the team confirms a different rule.
3. **Deployment shape**: one Supabase project, two Postgres schemas
   (`academic`, `wallet`) in the same database. This was still an open
   question in the locked plan ("Stage 3: Supabase deployment planning") —
   easy to change later since no cross-schema FK depends on it.
