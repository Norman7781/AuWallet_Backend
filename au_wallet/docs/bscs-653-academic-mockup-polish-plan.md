# Plan: BSCS 653-Onward Academic Mock-Up Polish

**Generated**: 2026-08-16 (Asia/Bangkok)
**Estimated complexity**: High
**Scope**: Academic mock data, schema semantics, audit read model, backend read contract, and tests. No real student data, UI work, wallet-flow change, or VC issuance change.

## Confirmed design

- The supplied `653-onward_BSCS_Curriculum_15062022for-webAcademic_Aug26.pdf` is the single curriculum baseline for every mock VMES undergraduate CS student.
- All 20 mock students are enrolled in `SYN-VMES-CS`; the other seven VMES undergraduate programmes remain catalogue-only rows.
- Each enrollment has one immutable declared concentration: `SED` or `IDS`.
- Major Elective Group 2 contributes only to the 33-credit major-elective requirement.
- The 12-credit free-elective requirement uses four external-to-CS, clearly synthetic mock courses.
- The data should show realistic term progression, prerequisites, graduation outcomes, and one completed student whose transcript is not yet issued.
- Direct browser access to academic tables remains prohibited. NestJS accesses them through the service role only.

## Re-check of the current state

The live project has eight applied migrations, 20 students/enrollments, eight programme rows, 70 CS course-catalogue rows, 649 course results, ten graduation records, and ten transcripts.

The existing fixture is close but not semantically complete:

1. `academic.program.major_concentration` is `NULL` for CS, so it cannot represent each student's declared SED/IDS choice.
2. The current 20 paths infer concentration from results rather than storing it on the enrollment.
3. `ITX2004`, `ITX3003`, `ITX4502`, and `ITX4518` are Group 2 courses but are currently used as the four free electives.
4. `academic.course_result` records completion but does not explicitly state which degree-requirement bucket the result satisfies.
5. The current term grouping was generated from historical fixture blocks, not the exact eight-semester study plan in the supplied curriculum.

The redesign must preserve `student_id`, `enrollment_id`, admission number, date of birth, passport HMAC, wallet connection, and onboarding-request relationships. Wallet tables are out of scope for data mutation.

## Target model

```text
student_program_enrollment
  curriculum_version = "BSCS-2022-653-ONWARD"
  declared_concentration = "SED" | "IDS"

course
  course_category = catalogue classification
  catalog_scope = "bscs_653" | "external_free_elective"
  owning_unit = display/source label for external mock courses

course_result
  degree_requirement_bucket =
    "general_education" | "specialized_core" | "major_required" |
    "concentration" | "major_elective" | "free_elective"
```

`course_category` describes the catalogue. `degree_requirement_bucket` describes how that particular result is applied to the student's degree. This distinction is essential because a course may be in a concentration catalogue but be used as one of the six additional major electives.

The implementation will add a backend-only audit view or read-only SQL query that reports, per enrollment:

```text
curriculum version and declared concentration
general education / 30
specialized core / 18
major required / 39
concentration / 15
additional major electives / 18
free electives / 12
total earned / 132
graduation-ready yes/no
```

## Canonical full-study plan

Every complete path has these fixed terms, with concentration/elective choices filled into the elective slots.

| Term               | Credits | Fixed courses                                       | Variable slots                                   |
| ------------------ | ------: | --------------------------------------------------- | ------------------------------------------------ |
| Year 1, Semester 1 |      16 | ELE1001, CSX2003, ITX3002, CSX3001, BBA1006, GE1303 | None                                             |
| Year 1, Semester 2 |      16 | ELE1002, CSX2008, ITX2005, CSX3002, BBA1004, GE1411 | None                                             |
| Year 2, Semester 1 |      17 | ELE2000, CSX2006, CSX3003, ITX3007, BBA1005         | One major elective                               |
| Year 2, Semester 2 |      18 | ELE2001, ITX2007, CSX2009, CSX3006, BBA1007         | One major elective                               |
| Year 3, Semester 1 |      17 | GE2110, CSX3004, CSX3005, CSX3009                   | One major elective, one external free elective   |
| Year 3, Semester 2 |      15 | CSX3007, CSX3008, CSX3010                           | Two major electives                              |
| Year 4, Semester 1 |      18 | GE2202                                              | Four major electives, one external free elective |
| Year 4, Semester 2 |      15 | CSX3011                                             | Two major electives, two external free electives |

All mock students are international-programme students in this fixture and therefore use `GE1411`; this is fixture data, not a rule for real AU students.

## 20-student target matrix

Every row uses `BSCS-2022-653-ONWARD` and `SYN-VMES-CS`.

| Admission no. | Concentration | Status    | Target earned credits | Scenario                                                                    |
| ------------- | ------------- | --------- | --------------------: | --------------------------------------------------------------------------- |
| 6399017       | SED           | graduated |                   132 | Issued transcript                                                           |
| 6399019       | SED           | alumni    |                   132 | 114 normal + 18 transfer credits; issued transcript                         |
| 6499002       | SED           | graduated |                   132 | Issued transcript                                                           |
| 6499015       | SED           | graduated |                   132 | Issued transcript                                                           |
| 6499021       | SED           | alumni    |                   132 | 114 normal + 18 transfer credits; issued transcript                         |
| 6499025       | SED           | withdrawn |                    32 | End of Year 1 progression                                                   |
| 6699005       | SED           | withdrawn |                    16 | End of Year 1 Semester 1 progression                                        |
| 6699013       | SED           | studying  |                    99 | End of Year 3 progression; Project I complete                               |
| 6799023       | SED           | withdrawn |                    67 | End of Year 2 progression                                                   |
| 6899011       | SED           | studying  |                    32 | End of Year 1 progression                                                   |
| 6399003       | IDS           | alumni    |                   132 | 114 normal + 18 transfer credits; issued transcript                         |
| 6399018       | IDS           | alumni    |                   132 | Completed graduation; transcript remains draft/pending                      |
| 6399020       | IDS           | alumni    |                   132 | Issued transcript                                                           |
| 6499004       | IDS           | graduated |                   132 | Issued transcript                                                           |
| 6499014       | IDS           | studying  |                   117 | End of Year 4 Semester 1 progression; ready for Project II credit threshold |
| 6499016       | IDS           | graduated |                   132 | Issued transcript                                                           |
| 6699024       | IDS           | withdrawn |                    84 | End of Year 3 Semester 1 progression                                        |
| 6799012       | IDS           | studying  |                    67 | End of Year 2 progression                                                   |
| 6899001       | IDS           | studying  |                    25 | Early Year 1 progression                                                    |
| 6899022       | IDS           | withdrawn |                    49 | End of Year 2 Semester 1 progression                                        |

The ten completed alumni/graduates retain ten graduation records. Nine transcript records have `document_status = 'issued'`; the record for `6399018` is `draft`, making that student deliberately ineligible for transcript-VC issuance.

## Elective allocation

### SED declared concentration (15 credits)

`ITX3004`, `ITX4104`, `CSX4107`, `CSX4110`, `CSX4407`

### IDS declared concentration (15 credits)

`CSX4201`, `CSX4203`, `CSX4211`, `CSX4212`, `CSX4213`

Each full SED/IDS path receives six further 3-credit major electives, selected from the Group 1 or Group 2 catalogue only after their prerequisites are met.

### External mock free electives (12 credits)

Add four clearly synthetic, non-CS catalogue entries, each worth three credits:

- `MOCK-AU-FE101` — Professional Communication
- `MOCK-AU-FE102` — Entrepreneurship and Innovation
- `MOCK-AU-FE103` — Creative Media and Storytelling
- `MOCK-AU-FE104` — Digital Law and Society

They are assigned to the Year 3 Semester 1, Year 4 Semester 1, and Year 4 Semester 2 free-elective slots. They must not use a CS Group 2 course code or category.

## Prerequisites and safety rules

- Keep the curriculum's published prerequisite relationships in the fixture schedule. A prerequisite must occur in an earlier completed term, not merely in the same term.
- Do not claim that the PDF establishes a universal minimum passing grade for every course; model only the supplied prerequisite and credit rules unless a separate official graduation-regulation source is supplied.
- Preserve all raw passport-number protections: only HMACs remain stored.
- New tables, views, or functions receive RLS and explicit least-privilege grants. `anon` and `authenticated` receive no access; service-role-only access remains backend-only.
- Create the schema/data migration through the approved migration workflow. If using the Supabase CLI, run `supabase migration new` before writing the migration; do not invent an applied migration filename.

## Sprint 1: Establish the canonical fixture contract

**Goal**: Make the supplied curriculum the single executable source of truth.

### Task 1.1: Replace the fixture definition

- **Location**: `scripts/academic-curriculum-fixture.mjs`
- **Description**: Replace the historical block ordering with the exact eight-term plan; define declared SED/IDS paths, prerequisite-valid elective placement, four external mock free electives, and the 20-student target matrix.
- **Dependencies**: None.
- **Acceptance criteria**:
  - Every complete path totals 132 credits across the six requirement buckets.
  - Each concentration has exactly 15 credits.
  - Group 2 is never allocated to `free_elective`.
  - The external free-elective set totals 12 credits.
- **Validation**: Unit-test the fixture module directly for every admission number, term, credit total, concentration, and bucket allocation.

### Task 1.2: Define migration preflight and rollback snapshots

- **Location**: New migration generator plus `src/supabase/migrations/*` migration test.
- **Description**: Record aggregate-only preflight checks for the exact existing 20 enrollment IDs and their wallet references. Build postflight checks that prove the migration did not alter wallet tables, student identities, enrollment IDs, or passport HMACs.
- **Dependencies**: Task 1.1.
- **Validation**: Run the generated SQL against a disposable database/branch and verify a failure if the live fixture differs from its expected starting state.

**Demo/validation**: Print an aggregate-only curriculum matrix: all 20 admissions, declared concentration, status, earned credits, and requirement-bucket totals. Do not return names, dates of birth, passport HMACs, or grades.

## Sprint 2: Make the schema express the curriculum

**Goal**: Store declared concentration and requirement allocation explicitly.

### Task 2.1: Add enrollment curriculum fields

- **Location**: New Supabase migration; `src/supabase/database.types.ts`
- **Description**: Add non-null `curriculum_version` and `declared_concentration` to `academic.student_program_enrollment`; backfill every existing enrollment from the target matrix; restrict concentration values to `SED` and `IDS`.
- **Dependencies**: Sprint 1.
- **Acceptance criteria**: Every one of the 20 existing enrollments reads `BSCS-2022-653-ONWARD` and one declared concentration; no programme-level concentration is used to represent a student choice.
- **Validation**: SQL aggregate asserts ten SED and ten IDS enrollments, all under `SYN-VMES-CS`.

### Task 2.2: Add external course-catalogue semantics

- **Location**: New Supabase migration; `scripts/academic-curriculum-fixture.mjs`
- **Description**: Make `academic.course.program_id` nullable only for external free-elective catalogue rows; add a constrained `catalog_scope` and an `owning_unit` display field. Keep the seven non-CS VMES programmes catalogue-only and retain all 70 BSCS catalogue courses.
- **Dependencies**: Task 2.1.
- **Acceptance criteria**: The four `MOCK-AU-FE*` rows are external-free-elective rows; all BSCS rows remain attached to `SYN-VMES-CS`.
- **Validation**: Foreign-key, nullability, and exact-course-count assertions.

### Task 2.3: Add degree-requirement allocation to results

- **Location**: New Supabase migration; `src/supabase/database.types.ts`
- **Description**: Add non-null, checked `degree_requirement_bucket` to `academic.course_result`. Backfill only from the canonical target matrix, not from a heuristic based solely on `course_category`.
- **Dependencies**: Tasks 2.1-2.2.
- **Validation**: Each completed enrollment has bucket totals of 30/18/39/15/18/12 credits and no result has an invalid bucket.

**Demo/validation**: A direct database query can show a single completed SED and IDS enrollment passing the requirement breakdown without exposing personal data.

## Sprint 3: Rebuild all 20 mock academic histories

**Goal**: Make student results follow the official study plan and the agreed scenarios.

### Task 3.1: Generate the guarded data-rewrite migration

- **Location**: New generator in `scripts/`; generated migration in `src/supabase/migrations/`.
- **Description**: In one transaction, lock academic tables, preserve students/enrollments, replace only course-result/course-catalogue fixture rows needed for the corrected curriculum, reassign results by official term, and update graduation/transcript scenario values.
- **Dependencies**: Sprint 2.
- **Acceptance criteria**:
  - All 20 rows match the target matrix.
  - Ten students complete 132 credits; five are studying; five are withdrawn.
  - Three alumni include 18 valid transfer credits; all other full paths have 132 normal earned credits.
  - `6399018` is complete but has a draft transcript; the other nine completed students have issued transcripts.
  - Wallet tables and their counts are unchanged.
- **Validation**: Migration postflight aggregate checks, plus a transaction rollback drill on a disposable branch.

### Task 3.2: Build the graduation-audit read model

- **Location**: New `academic` view/query or backend repository method; `issuer-academic` interfaces/repository/service/controller as needed.
- **Description**: Calculate credit totals, concentration compliance, free-elective compliance, total earned credits, graduation readiness, and transcript-VC readiness from results and official graduation/transcript records.
- **Dependencies**: Task 3.1.
- **Acceptance criteria**:
  - Completed students pass academic graduation audit.
  - `6399018` passes academic graduation audit but fails transcript-VC readiness only because the transcript is draft.
  - Studying and withdrawn scenarios do not pass graduation audit.
- **Validation**: Repository/service tests with both SED and IDS examples and the pending-transcript scenario.

**Demo/validation**: Show one SED graduate, one IDS graduate, one active student, one withdrawn student, and the pending-transcript alumni result through the issuer academic API.

## Sprint 4: Keep backend contracts and tests honest

**Goal**: Expose the new academic meaning safely to backend consumers.

### Task 4.1: Update backend types and issuer academic responses

- **Location**: `src/supabase/database.types.ts`, `src/onboarding-verification/issuer-academic/*`, `src/onboarding-verification/student-matching/*`.
- **Description**: Return declared concentration from the enrollment, not `program.major_concentration`. Add an audit response only to issuer/private endpoints; do not add it to public wallet matching responses.
- **Dependencies**: Sprint 3.
- **Validation**: Unit tests assert the API response includes `curriculumVersion`, `declaredConcentration`, and aggregate audit fields only where authorized.

### Task 4.2: Replace stale fixture documentation and validators

- **Location**: `docs/academic-seed-fixtures.md`, `scripts/generate-academic-final-fixture-validation-sql.mjs`, migration specs.
- **Description**: Replace the obsolete statement that Group 2 courses fulfil free-elective credits; document all 20 scenarios, expected counts, and the transcript-pending case.
- **Dependencies**: Tasks 4.1 and 3.1.
- **Validation**: Generate and execute the read-only aggregate validator; it must expose no student identity, academic grades, or passport-derived values.

### Task 4.3: Run release verification

- **Location**: CI/local test suite and Supabase project.
- **Description**: Run migration tests, backend unit tests, E2E tests where configured, a read-only live verification query, and Supabase security/performance advisors.
- **Dependencies**: Tasks 4.1-4.2.
- **Validation**:
  - `npm test -- --runInBand` passes.
  - Migration list contains the new migration after the existing eight.
  - `anon` and `authenticated` still have zero direct grants on `academic` and `wallet` application tables.
  - No new high/warn security issue is introduced.

**Demo/validation**: The 20-student fixture, issuer academic read API, wallet identity matching, and transcript-eligibility data agree on the same enrollment identities.

## Testing strategy

- Fixture unit tests: exact course lists, term placement, prerequisites, credits, declared concentration, and requirement-bucket allocation for all 20 students.
- Migration tests: guard clauses, idempotency/one-time application behavior, count assertions, and unchanged wallet references.
- Repository/service tests: SED, IDS, active, withdrawn, transfer-credit, and transcript-pending audit outcomes.
- Read-only live SQL: counts, bucket totals, status distribution, and no browser-role grants; never query or print personal values.
- Regression suite: run all existing Jest tests after updating expected contracts.

## Risks and mitigations

- **Existing wallet connections reference enrollments.** Do not recreate students or enrollments; preserve their IDs and update only academic catalogue/result semantics.
- **A broad DELETE/INSERT can corrupt test state.** Use a single guarded transaction with preflight fingerprints and an explicit postflight assertion that wallet counts and foreign-key references did not change.
- **Prerequisites may be misread.** Encode only prerequisites stated in the supplied PDF; reject same-term prerequisite scheduling.
- **Free electives could appear official.** Use a `MOCK-AU-FE*` prefix and document them as synthetic, external-to-CS test data.
- **A direct Data API grant leaks academic data.** Keep RLS enabled and grant new academic objects only to `service_role`; browser roles remain unprivileged.
- **Old fixture validators become misleading.** Replace them in the same change set as the data rewrite.

## Rollback plan

- Apply first to a Supabase development branch or disposable clone and preserve the pre-migration aggregate fingerprint.
- If any postflight assertion fails, the migration transaction rolls back completely.
- After a successful live migration, rollback is a dedicated reverse migration that restores the prior fixture only from a reviewed backup/snapshot; never use `git reset` or manual destructive table deletion against the live project.
