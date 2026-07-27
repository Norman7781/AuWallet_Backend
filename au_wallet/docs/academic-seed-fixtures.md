# Synthetic Academic Seed Fixtures

These fixtures are fictional development data for AU Wallet enrollment and
Transcript VC eligibility testing. They are not claims about Assumption
University's official programs, curriculum, students, awards, transcripts, or
academic history. No personal or academic value was copied from a real
transcript.

## Fixture scope

The final expanded fixture contains:

| Relation                              | Rows |
| ------------------------------------- | ---: |
| `academic.program`                    |    1 |
| `academic.student`                    |   20 |
| `academic.student_program_enrollment` |   20 |
| `academic.course`                     |   54 |
| `academic.academic_term`              |   12 |
| `academic.course_result`              |  761 |
| `academic.transcript`                 |   10 |
| `academic.graduation_record`          |   10 |

The synthetic catalog uses 40 three-credit courses, six two-credit courses,
and eight zero-credit seminars. Its active credits total 132. Course codes and
titles are fictional transcript-style fixtures, and `SYN-VMES-CSIDS` is not an
official university program code.

The twelve synthetic terms are:

- `2020/02`
- `2021/01`
- `2021/02`
- `2021/03`
- `2022/01`
- `2022/02`
- `2023/01`
- `2023/02`
- `2024/01`
- `2024/02`
- `2025/01`
- `2025/02`

Semester 01 runs approximately June through October. Semester 02 runs
approximately November through March of the next calendar year. Semester 03
is an optional summer or intersession term; this fixture uses `2021/03`. No
2026 term exists, and every non-transfer result resolves to exactly one term
in this set.

The original five scenarios retain their result totals:

- Current student: 12 results, 25 completed credits.
- Graduate: 54 results, 132 completed credits.
- Alumnus: 54 results, 114 completed plus 18 transferred credits.
- Graduate awaiting issuance: 54 results, 132 completed credits.
- Withdrawn student: 9 results, 21 completed credits.

The 15-student expansion adds 578 results: 481 normal, 12 transfer, and 85
seminar. Across all 20 students there are 631 normal, 18 transfer, and 112
seminar results, for 761 total. Transfers use `TR`, have no academic term, and
do not affect GPA. Zero-credit seminars use `S` and also do not affect GPA.

The fixture uses this synthetic grade-point scale:

| Grade | Points |
| ----- | -----: |
| A     |   4.00 |
| A-    |   3.75 |
| B+    |   3.25 |
| B     |   3.00 |
| B-    |   2.75 |
| C+    |   2.25 |
| C     |   2.00 |

The completed students reconcile to:

- Graduate: 474.00 points / 132 GPA credits = 3.590909..., stored as 3.59.
- Alumnus: 408.75 points / 114 GPA credits = 3.585526..., stored as 3.59.
- Awaiting issuance: 447.00 points / 132 GPA credits = 3.386363..., stored as
  3.39.

Additional completed students reconcile to:

| Admission | Grade points / GPA credits | Stored GPA | Award                |
| --------- | -------------------------- | ---------: | -------------------- |
| `6499015` | 473.25 / 132               |       3.59 | Academic Distinction |
| `6499016` | 444.50 / 132               |       3.37 | —                    |
| `6399017` | 452.25 / 132               |       3.43 | —                    |
| `6399018` | 447.25 / 132               |       3.39 | —                    |
| `6399019` | 408.00 / 114               |       3.58 | Academic Distinction |
| `6399020` | 392.00 / 114               |       3.44 | —                    |
| `6499021` | 395.25 / 132               |       2.99 | —                    |

`Academic Distinction` is produced only by the synthetic test rule: unrounded
GPA at least 3.50, 132 earned credits, and no failing grade. It is not an
official university award policy.

## Eligibility scenarios

| Scenario          | Old fixture ID  | Admission number | Admission date | Academic status | Wallet  | Transcript VC                        |
| ----------------- | --------------- | ---------------- | -------------- | --------------- | ------- | ------------------------------------ |
| Current           | `DEMO-STU-0001` | `6899001`        | 2025-06-02     | studying        | allowed | ineligible                           |
| Graduate          | `DEMO-STU-0002` | `6499002`        | 2021-06-07     | graduated       | allowed | eligible                             |
| Alumnus           | `DEMO-STU-0003` | `6399003`        | 2020-06-08     | alumni          | allowed | eligible                             |
| Awaiting issuance | `DEMO-STU-0004` | `6499004`        | 2021-06-07     | graduated       | allowed | ineligible while transcript is draft |
| Withdrawn         | `DEMO-STU-0005` | `6699005`        | 2023-06-05     | withdrawn       | denied  | ineligible                           |

The generator asserts the full eligibility rule: an enrollment must be
`graduated` or `alumni`; graduation must be completed, fulfilled, approved,
and have enough earned credits; and the transcript must be issued.

## Academic identity matching and email ownership

`academic.student.personal_email` is optional and non-authoritative. Every
current synthetic academic student intentionally stores `NULL` in this
column, and both the base and expansion generators preserve that contract.
`university_email` remains optional and unchanged, but it is not an automatic
matching factor.

`wallet.holder_account.personal_email` remains required current contact and
recovery information. Member 1's authentication flow verifies ownership of
that wallet email independently through OTP or another approved account
verification mechanism. It is never verified by comparing it with an
academic email.

Member 2's automatic academic match requires all three official factors:

1. Admission number.
2. Date of birth.
3. Passport-number HMAC.

Neither personal email nor university email participates in that match.
Failed automatic matches return one generic failure or manual-review result;
they do not reveal which factor differed. Official identity and enrollment
data is returned only after all three academic factors match.

## Fifteen-student expansion

The additive expansion balances the final enrollment distribution at five
students per status:

| Admission | Fictional name       | Status    | Results | Completed / transferred credits | Transcript VC     |
| --------- | -------------------- | --------- | ------: | ------------------------------- | ----------------- |
| `6899011` | Narin Kittisak       | studying  |      12 | 25 / 0                          | ineligible        |
| `6799012` | Pimchanok Wattanakul | studying  |      28 | 66 / 0                          | ineligible        |
| `6699013` | Tawan Siriporn       | studying  |      42 | 102 / 0                         | ineligible        |
| `6499014` | Chanya Methakul      | studying  |      48 | 117 / 0                         | ineligible        |
| `6499015` | Krit Phongsawat      | graduated |      54 | 132 / 0                         | eligible          |
| `6499016` | Napasorn Yindee      | graduated |      54 | 132 / 0                         | ineligible; draft |
| `6399017` | Ronnakorn Teerakul   | graduated |      54 | 132 / 0                         | eligible          |
| `6399018` | Benyada Srisawat     | alumni    |      54 | 132 / 0                         | eligible          |
| `6399019` | Phurin Kanchana      | alumni    |      54 | 114 / 18                        | eligible          |
| `6399020` | Supansa Thamrong     | alumni    |      54 | 114 / 18                        | eligible          |
| `6499021` | Natthanon Charoen    | alumni    |      54 | 132 / 0                         | eligible          |
| `6899022` | Wipada Raksakul      | withdrawn |       7 | 16 / 0                          | ineligible        |
| `6799023` | Jirawat Manee        | withdrawn |      14 | 32 / 0                          | ineligible        |
| `6699024` | Kanya Phromchai      | withdrawn |      21 | 49 / 0                          | ineligible        |
| `6499025` | Pongsatorn Saelim    | withdrawn |      28 | 66 / 0                          | ineligible        |

All studying, graduated, and alumni fixtures remain wallet-eligible. All
withdrawn fixtures remain wallet-ineligible. Current and withdrawn histories
are intentionally partial; completed histories reconcile to 132 earned
credits.

## Academic completion, conferral, and transcript dates

`graduation_record.approved_at` represents approval of academic completion
after the final semester. `graduation_record.graduation_date` represents the
later annual January ceremony or conferral date.

| Admission number | Final term | Academic completion approved | Graduation ceremony/conferral | Transcript status | Transcript issued |
| ---------------- | ---------- | ---------------------------- | ----------------------------- | ----------------- | ----------------- |
| `6499002`        | `2024/02`  | 2025-04-18 09:00:00+07       | 2026-01-17                    | issued            | 2025-05-02        |
| `6399003`        | `2023/02`  | 2024-04-19 09:00:00+07       | 2025-01-18                    | issued            | 2024-05-03        |
| `6499004`        | `2024/02`  | 2025-04-18 11:00:00+07       | 2026-01-17                    | draft             | —                 |
| `6499015`        | `2024/02`  | 2025-04-21 09:00:00+07       | 2026-01-17                    | issued            | 2025-05-06        |
| `6499016`        | `2024/02`  | 2025-04-21 11:00:00+07       | 2026-01-17                    | draft             | —                 |
| `6399017`        | `2023/02`  | 2024-04-22 09:00:00+07       | 2025-01-18                    | issued            | 2024-05-07        |
| `6399018`        | `2023/02`  | 2024-04-23 09:00:00+07       | 2025-01-18                    | issued            | 2024-05-08        |
| `6399019`        | `2023/02`  | 2024-04-23 10:00:00+07       | 2025-01-18                    | issued            | 2024-05-09        |
| `6399020`        | `2023/02`  | 2024-04-24 09:00:00+07       | 2025-01-18                    | issued            | 2024-05-10        |
| `6499021`        | `2024/02`  | 2025-04-22 09:00:00+07       | 2026-01-17                    | issued            | 2025-05-07        |

The issued transcripts occur several weeks after academic completion and
before the following January ceremony. The draft fixture intentionally models
an administrative issuance delay even though academic completion and ceremony
requirements have passed.

Synthetic issued-document identifiers are:

- `6499002`: `SYN-AU-TR-2025-6499002` / `SYNV-25-6499002-X7K9`
- `6399003`: `SYN-AU-TR-2024-6399003` / `SYNV-24-6399003-M4Q8`

## Protected replacement states

The generated SQL takes a transaction-level advisory lock and accepts only:

1. Complete old `DEMO-*` fixture with every revised natural key absent. It
   verifies the old values and whole-table counts before performing
   fixture-scoped child-to-parent deletion and inserting the revised fixture.
2. Complete revised fixture with every old fixture key absent. It performs no
   mutation and validates the exact revised rows and aggregates.

Mixed, partial, conflicting, unrelated, or empty states raise an exception.
The SQL never truncates, cascades, updates, alters schema objects, or writes to
the wallet schema. Identity primary keys are omitted; relationships are
resolved through program codes, admission numbers, course codes, and term
codes.

The separate expansion generator accepts only:

1. The exact fingerprinted five-student fixture with all 15 expansion keys
   absent. It inserts only new student, enrollment, result, graduation, and
   transcript rows.
2. The exact 20-student fixture. It performs validation only.

Any partial or conflicting expansion aborts before mutation. The expansion
does not delete or update existing academic rows and does not duplicate the
shared program, course catalog, or academic terms.

## Local secrets and generated SQL

Create `.env.seed.local` manually from `.env.seed.example`. Keep the stable
development `PASSPORT_HMAC_SECRET` and the same five fictional passport inputs
there. The `SEED_PASSPORT_DEMO_STU_0001` through
`SEED_PASSPORT_DEMO_STU_0005` names remain positionally mapped to the five
revised scenarios. Never commit `.env.seed.local`.

For the 15 additional fixtures, the expansion generator derives
domain-separated, obviously synthetic matching inputs from each admission
number only in memory. It applies the same normalization and HMAC contract
with the existing `PASSPORT_HMAC_SECRET`. The synthetic inputs and resulting
digests are never stored in source, printed, or logged, and must never be used
outside development.

The generator applies this normalization contract:

1. Unicode NFKC normalization.
2. Trim leading and trailing whitespace.
3. Remove all Unicode whitespace.
4. Remove ASCII hyphen-minus (`U+002D`).
5. Convert letters to uppercase.
6. Encode the normalized value and secret as UTF-8.
7. Compute HMAC-SHA-256.
8. Encode the digest as lowercase hexadecimal.

The NestJS onboarding matcher must use the same development secret and
normalization function. Production must use a different secret and must not
contain this synthetic fixture.

Generate the protected SQL only to a temporary, untracked path:

```bash
npm run seed:academic:generate -- /tmp/au-wallet-academic-v2.generated-seed.sql
```

To deliberately replace that temporary file:

```bash
npm run seed:academic:generate -- /tmp/au-wallet-academic-v2.generated-seed.sql --force
```

Generate the protected additive expansion:

```bash
npm run seed:academic:expand -- /tmp/au-wallet-academic-expansion.generated-seed.sql
```

Use `--force` only to deliberately replace the temporary expansion artifact.

Generate the guarded academic personal-email removal transaction:

```bash
npm run seed:academic:remove-personal-email -- /tmp/au-wallet-academic-personal-email-removal.sql
```

The removal artifact is written with mode `0600`, accepts only the exact
current or already-installed fixture state, and changes only the academic
column nullability plus the 20 approved academic students. Use `--force` only
to deliberately replace this exact temporary artifact.

Generated `*.generated-seed.sql` files contain passport HMAC digests, are
written with mode `0600`, and must not be committed or printed. Generation is
local only: the script does not connect to Supabase and does not execute SQL.

## Separate security work

Row Level Security and Data API schema exposure remain separate security
decisions. This fixture work does not change RLS, policies, grants, indexes,
Data API exposure, schemas, Auth, Storage, or wallet data.
