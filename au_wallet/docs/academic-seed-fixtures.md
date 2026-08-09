# Synthetic Academic Seed Fixtures

These fixtures are fictional development data for AU Wallet onboarding and
Transcript VC eligibility tests. They are not claims about Assumption
University's official program structure, students, results, awards, or
transcripts. No identity or academic history was copied from a real person or
transcript.

## Final fixture scope

The following is the intended corrected post-migration state.

| Relation                              | Rows |
| ------------------------------------- | ---: |
| `academic.program`                    |    8 |
| `academic.student`                    |   20 |
| `academic.student_program_enrollment` |   20 |
| `academic.course`                     |   70 |
| `academic.academic_term`              |   12 |
| `academic.course_result`              |  649 |
| `academic.transcript`                 |   10 |
| `academic.graduation_record`          |   10 |

The catalogue contains eight VMES undergraduate metadata rows: Applied
Informatics, Aircraft Maintenance Engineering, Computer Engineering,
Commercial Pilot License, Computer Science, Electrical Engineering,
Mechatronics Engineering and Artificial Intelligence, and New Energy
Automotive Engineering. The natural keys use the `SYN-VMES-*` prefix.

Only `SYN-VMES-CS` has fixture students, enrollments, courses, results,
transcripts, or graduation records. It remains the concentration-neutral,
synthetic Bachelor of Science in Computer Science fixture with 132 required
credits. `major_concentration` is `NULL` because SED and IDS are student
choices, not separate program rows. The current schema has no enrollment-level
concentration column, so a fixture student's chosen path is represented by
their major-elective results. The other seven rows are programme catalogue
metadata only; they do not imply an approved seeded curriculum.

The non-null catalogue credit totals were checked against published AU/VMES
programme materials on 2026-08-09: AIT 126, AME 141, CE 140, CPL 141, CS 132,
EE 140, MCE-AI 136, and NEA 126. Sources:

- [Applied Informatics](https://vmes.au.edu/2024-bsai-for-673-onward/)
- [Aircraft Maintenance Engineering](https://vmes.au.edu/aircraft-maintenance-engineering-ame/)
- [Computer Engineering](https://vmes.au.edu/computer-engineering-ce/)
- [Commercial Pilot License](https://vmes.au.edu/commercial-pilot-license-cpl/)
- [Computer Science](https://vmes.au.edu/2022-bscs-653/)
- [Electrical Engineering](https://vmes.au.edu/electrical-engineering-ee/)
- [Mechatronics Engineering and Artificial Intelligence](https://vmes.au.edu/mechatronics-engineering-and-artificial-intelligence-mce-ai/)
- [New Energy Automotive Engineering](https://vmes.au.edu/new-energy-automotive-engineering-neae/)

## Curriculum model

The catalog in `scripts/academic-curriculum-fixture.mjs` contains 70 approved
curriculum definitions. The former four `SYN-FE*` placeholders have been
retired. For this synthetic fixture, four additional approved Computer Science
Major Elective Group 2 courses satisfy the 12-credit free-elective portion:
`ITX2004`, `ITX3003`, `ITX4502`, and `ITX4518`.

Catalog totals are:

| Catalog component           | Courses | Credits |
| --------------------------- | ------: | ------: |
| Approved curriculum entries |      70 |     202 |
| Synthetic free electives    |       0 |       0 |
| Total catalog               |      70 |     202 |

The catalog has 62 three-credit and eight two-credit rows. It has no `SYN-FE`
course codes, `synthetic_free_elective` categories, or invented zero-credit
seminar rows.

Each completed student selects a 46-course, 132-credit path:

- General education: 30 credits.
- Specialized core: 18 credits.
- Major required: 39 credits.
- Major electives: 33 credits.
- Approved Group 2 courses used for the free-elective portion: 12 credits.

That path contains 40 three-credit and six two-credit courses. All fixtures
model international students and therefore use `GE1411 Thai Language for
Multicultural Communication`. `GE1410` and `GE1412` remain in the catalog as
curriculum alternatives but are not assigned to these students.

The source described selected-topic ranges rather than one exact offering.
For deterministic mock keys, this fixture uses the lower bound from each
range:

- `CSX4180` for the `CSX4180-4199` SED range.
- `CSX4280` for the `CSX4280-4299` IDS range.
- `CSX4600` for the `CSX4600-4699` Group 2 range.

## Concentration paths

Ten fixtures use the Software Engineering and Development (SED) path and ten
use the Informatics and Data Science (IDS) path.

SED fixture admissions:

- `6399017`, `6399019`, `6499002`, `6499015`, `6499021`
- `6499025`, `6699005`, `6699013`, `6799023`, `6899011`

IDS fixture admissions:

- `6399003`, `6399018`, `6399020`, `6499004`, `6499014`
- `6499016`, `6699024`, `6799012`, `6899001`, `6899022`

The five required concentration courses and six additional major electives
for each path are deterministic test selections. They are meant to exercise
both curriculum branches, not prescribe a real student's registration plan.

## Academic histories

The corrected fixture keeps the existing 12 synthetic academic terms and all
non-curriculum result facts. It removes the 112 invented zero-credit seminar
results. Final result distribution is:

| Result type | Rows |
| ----------- | ---: |
| Normal      |  631 |
| Transfer    |   18 |
| Seminar     |    0 |
| Total       |  649 |

Transfers use `TR`, have no academic term, and do not affect GPA. Every normal
result's credits equal the referenced catalog course's default credits. The
correction remaps course foreign keys by credit-compatible positions, so
existing terms, grades, completed credits, transferred credits, and GPA values
remain unchanged.

The original five scenarios are:

| Admission | Status    | Results | Normal / transfer | Completed / transferred credits |
| --------- | --------- | ------: | ----------------: | ------------------------------: |
| `6899001` | studying  |      10 |            10 / 0 |                          25 / 0 |
| `6499002` | graduated |      46 |            46 / 0 |                         132 / 0 |
| `6399003` | alumni    |      46 |            40 / 6 |                        114 / 18 |
| `6499004` | graduated |      46 |            46 / 0 |                         132 / 0 |
| `6699005` | withdrawn |       8 |             8 / 0 |                          21 / 0 |

The 15-student expansion is:

| Admission | Status    | Results | Normal / transfer | Completed / transferred credits |
| --------- | --------- | ------: | ----------------: | ------------------------------: |
| `6899011` | studying  |      10 |            10 / 0 |                          25 / 0 |
| `6799012` | studying  |      24 |            24 / 0 |                          66 / 0 |
| `6699013` | studying  |      36 |            36 / 0 |                         102 / 0 |
| `6499014` | studying  |      41 |            41 / 0 |                         117 / 0 |
| `6499015` | graduated |      46 |            46 / 0 |                         132 / 0 |
| `6499016` | graduated |      46 |            46 / 0 |                         132 / 0 |
| `6399017` | graduated |      46 |            46 / 0 |                         132 / 0 |
| `6399018` | alumni    |      46 |            46 / 0 |                         132 / 0 |
| `6399019` | alumni    |      46 |            40 / 6 |                        114 / 18 |
| `6399020` | alumni    |      46 |            40 / 6 |                        114 / 18 |
| `6499021` | alumni    |      46 |            46 / 0 |                         132 / 0 |
| `6899022` | withdrawn |       6 |             6 / 0 |                          16 / 0 |
| `6799023` | withdrawn |      12 |            12 / 0 |                          32 / 0 |
| `6699024` | withdrawn |      18 |            18 / 0 |                          49 / 0 |
| `6499025` | withdrawn |      24 |            24 / 0 |                          66 / 0 |

The existing synthetic grade scale and completed-student GPAs are unchanged.
In particular, the original graduate, transfer alumnus, and awaiting-
transcript fixtures remain 3.59, 3.59, and 3.39 respectively.

## Eligibility

Wallet access remains allowed for `studying`, `graduated`, and `alumni`, and
denied for `withdrawn`. Transcript VC eligibility still requires a graduated
or alumni enrollment, completed/approved graduation with at least 132 earned
credits, and an issued transcript.

The curriculum correction does not change any enrollment, graduation, or
transcript value, so all existing wallet and Transcript VC eligibility
outcomes remain unchanged.

## Academic identity and email ownership

`academic.student.personal_email` is optional and non-authoritative. Every
synthetic academic student stores `NULL` in this column. Every current fixture
student has a unique university email derived from the academic admission
number:

```text
u{academic.student.admission_no}@au.test
```

The `.test` domain prevents collisions with real university accounts. The
generated email is a mock display/contact fixture only; it is not an automatic
matching factor.

`wallet.holder_account.personal_email` remains required current contact and
recovery information. Authentication verifies ownership of the wallet email
independently through Supabase's standard confirmation-link flow. It is never
verified by comparing it with an academic email.

Automatic academic matching uses exactly:

1. Admission number.
2. Date of birth.
3. Passport-number HMAC.

Failed, ambiguous, or ineligible automatic matches return one generic
unverified outcome without revealing which factor differed. An exact match
requires exactly one eligible enrollment.

## Passport HMAC contract

The base and expansion generators retain the existing local secret interface.
Never commit or print `.env.seed.local`.

Normalization remains:

1. Unicode NFKC normalization.
2. Trim leading and trailing whitespace.
3. Remove all Unicode whitespace.
4. Remove ASCII hyphens.
5. Convert letters to uppercase.
6. Encode normalized input and the secret as UTF-8.
7. Compute HMAC-SHA-256 using `PASSPORT_HMAC_SECRET`.
8. Encode the digest as lowercase hexadecimal.

The curriculum correction contains no passport input, secret, or HMAC value.

## Historical generators

The five mutation generators below are retained only as an auditable record of
the original sequential build. Their package commands are deliberately named
`historical:academic:*`. They require exact earlier one-program states and are
unsafe to treat as maintenance tools after the eight-program catalogue
expansion.

Generate a complete five-student base fixture:

```bash
npm run historical:academic:generate -- /tmp/au-wallet-academic-v3.generated-seed.sql
```

Generate the additive 15-student expansion:

```bash
npm run historical:academic:expand -- /tmp/au-wallet-academic-expansion-v3.generated-seed.sql
```

Generate the guarded correction for the currently installed 20-student
fixture:

```bash
npm run historical:academic:correct-curriculum -- /tmp/au-wallet-academic-curriculum-correction.sql
```

Generate the guarded, idempotent university-email assignment for the installed
20-student fixture:

```bash
npm run historical:academic:set-university-emails -- /tmp/au-wallet-academic-university-email.sql
```

The personal-email removal step is likewise retained only as
`historical:academic:remove-personal-email`.

Each generated file is mode `0600`. The base and expansion artifacts contain
derived passport HMACs and must remain temporary. Generators never connect to
Supabase by themselves.

These generators are historical, sequential fixture builders whose guarded
preconditions intentionally describe the earlier single-program CS state.
Their embedded 74-course assertions describe the superseded historical
catalogue and are intentionally not the supported final-state contract.
They must run before
`20260809080520_expand_vmes_undergraduate_catalogue.sql`. The catalogue
migration is followed by the guarded synthetic free-elective correction; the
historical generators must not be rerun against that expanded, corrected
state.

## Read-only final-fixture validation

Generate the supported final-state validator with:

```bash
npm run academic:validate-final:generate -- /tmp/au-wallet-academic-final-fixture-validation.sql
```

The generated SQL starts a read-only transaction and returns aggregate counts
and check booleans only. It does not return student identity, passport-derived
values, grades, or transcript contents. Execute it through an approved
read-only database channel and require `all_checks_pass = true`.

It validates the exact eight approved catalogue natural keys and credit totals,
20 CS students and enrollments, 70 CS courses, 12 terms, 649 results, 10
transcripts, 10 graduation records, zero enrollments/courses for the seven
catalogue-only programs, zero non-null academic personal emails, no retired
synthetic free-elective values, and ten results for each approved replacement.

The university-email transaction derives each address from the database-owned
student identity, updates only approved synthetic student email fields, and
asserts that wallet table counts remain unchanged.

The correction transaction accepts only the exact legacy fixture or the exact
already-corrected fixture. It verifies a preservation fingerprint, removes
only the 112 legacy seminar result rows, remaps the remaining 649 result
foreign keys, replaces only the synthetic catalog, and validates the final
state before commit. It does not alter database structure or write to wallet
tables.

## Separate security work

Row Level Security and Data API exposure remain separate security concerns.
This fixture work does not change RLS, policies, grants, indexes, schemas,
Auth, Storage, API settings, or wallet data.
