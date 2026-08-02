# Synthetic Academic Seed Fixtures

These fixtures are fictional development data for AU Wallet onboarding and
Transcript VC eligibility tests. They are not claims about Assumption
University's official program structure, students, results, awards, or
transcripts. No identity or academic history was copied from a real person or
transcript.

## Final fixture scope

| Relation                              | Rows |
| ------------------------------------- | ---: |
| `academic.program`                    |    1 |
| `academic.student`                    |   20 |
| `academic.student_program_enrollment` |   20 |
| `academic.course`                     |   74 |
| `academic.academic_term`              |   12 |
| `academic.course_result`              |  649 |
| `academic.transcript`                 |   10 |
| `academic.graduation_record`          |   10 |

The program natural key is `SYN-VMES-CS`. It is a concentration-neutral,
synthetic Bachelor of Science in Computer Science fixture under VMES with 132
required credits. `major_concentration` is `NULL` because SED and IDS are
student choices, not separate program rows. The current schema has no
enrollment-level concentration column, so a fixture student's chosen path is
represented by their major-elective results.

## Curriculum model

The catalog in
`scripts/academic-curriculum-fixture.mjs` contains the 70 curriculum
definitions supplied for this task plus four clearly marked synthetic free
electives. The four synthetic rows are not presented as approved AU courses;
they only fill the curriculum's unspecified 12-credit free-elective area.

Catalog totals are:

| Catalog component           | Courses | Credits |
| --------------------------- | ------: | ------: |
| Supplied curriculum entries |      70 |     202 |
| Synthetic free electives    |       4 |      12 |
| Total catalog               |      74 |     214 |

The catalog has 66 three-credit and eight two-credit rows. It has no invented
zero-credit seminar rows.

Each completed student selects a 46-course, 132-credit path:

- General education: 30 credits.
- Specialized core: 18 credits.
- Major required: 39 credits.
- Major electives: 33 credits.
- Synthetic free-elective placeholders: 12 credits.

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
independently through OTP or another approved account-verification mechanism.
It is never verified by comparing it with an academic email.

Automatic academic matching uses exactly:

1. Admission number.
2. Date of birth.
3. Passport-number HMAC.

Failed automatic matches return one generic failure or manual-review outcome
without revealing which factor differed. Official identity and enrollment
data is returned only after all three factors match.

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

## Generators

Generate a complete five-student base fixture:

```bash
npm run seed:academic:generate -- /tmp/au-wallet-academic-v3.generated-seed.sql
```

Generate the additive 15-student expansion:

```bash
npm run seed:academic:expand -- /tmp/au-wallet-academic-expansion-v3.generated-seed.sql
```

Generate the guarded correction for the currently installed 20-student
fixture:

```bash
npm run seed:academic:correct-curriculum -- /tmp/au-wallet-academic-curriculum-correction.sql
```

Generate the guarded, idempotent university-email assignment for the installed
20-student fixture:

```bash
npm run seed:academic:set-university-emails -- /tmp/au-wallet-academic-university-email.sql
```

Each generated file is mode `0600`. The base and expansion artifacts contain
derived passport HMACs and must remain temporary. Generators never connect to
Supabase by themselves.

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
