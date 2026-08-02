import { chmodSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROGRAM_CODE } from './academic-curriculum-fixture.mjs';

const PROJECT_REF = 'ezsylcmnqbcwvkoqybkd';
const EXPECTED_OUTPUT = resolve('/tmp/au-wallet-academic-university-email.sql');
const ADMISSIONS = [
  '6399003',
  '6399017',
  '6399018',
  '6399019',
  '6399020',
  '6499002',
  '6499004',
  '6499014',
  '6499015',
  '6499016',
  '6499021',
  '6499025',
  '6699005',
  '6699013',
  '6699024',
  '6799012',
  '6799023',
  '6899001',
  '6899011',
  '6899022',
];

function fail(message) {
  throw new Error(message);
}

function parseArguments(args) {
  const force = args.includes('--force');
  const unknownFlags = args.filter(
    (argument) => argument.startsWith('--') && argument !== '--force',
  );
  const positional = args.filter((argument) => !argument.startsWith('--'));

  if (unknownFlags.length > 0) {
    fail('Unknown command-line option');
  }
  if (positional.length !== 1) {
    fail(
      'Provide exactly /tmp/au-wallet-academic-university-email.sql; add --force only to allow replacement',
    );
  }

  const outputPath = resolve(positional[0]);
  if (outputPath !== EXPECTED_OUTPUT) {
    fail('Output path must be /tmp/au-wallet-academic-university-email.sql');
  }
  if (!force && existsSync(outputPath)) {
    fail('Output file already exists; pass --force to replace it');
  }

  return { force, outputPath };
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function buildSql() {
  const admissionsSql = ADMISSIONS.map(quote).join(', ');

  return `-- Guarded university-email assignment for synthetic academic students.
-- Intended Supabase project ref: ${PROJECT_REF}.
-- Changes only academic.student.university_email and updated_at.

BEGIN;

SELECT pg_advisory_xact_lock(
  hashtextextended('au_wallet.academic.university_email.v1', 0)
);

DO $academic_university_email$
DECLARE
  fixture_students bigint;
  fixture_program_links bigint;
  mismatched_emails bigint;
  affected_rows bigint;
  wallet_holder_count bigint;
  wallet_request_count bigint;
  wallet_document_count bigint;
BEGIN
  SELECT count(*)
  INTO wallet_holder_count
  FROM wallet.holder_account;

  SELECT count(*)
  INTO wallet_request_count
  FROM wallet.wallet_onboarding_request;

  SELECT count(*)
  INTO wallet_document_count
  FROM wallet.uploaded_identity_document;

  SELECT
    count(*) FILTER (WHERE student.admission_no IS NOT NULL),
    count(*) FILTER (WHERE program.program_code = '${PROGRAM_CODE}')
  INTO fixture_students, fixture_program_links
  FROM (
    SELECT unnest(ARRAY[${admissionsSql}]::text[]) AS admission_no
  ) AS approved
  LEFT JOIN academic.student AS student
    ON student.admission_no = approved.admission_no
  LEFT JOIN academic.student_program_enrollment AS enrollment
    ON enrollment.student_id = student.student_id
  LEFT JOIN academic.program AS program
    ON program.program_id = enrollment.program_id;

  IF (SELECT count(*) FROM academic.program) <> 1
    OR (SELECT count(*) FROM academic.student) <> 20
    OR (SELECT count(*) FROM academic.student_program_enrollment) <> 20
    OR (SELECT count(*) FROM academic.course) <> 74
    OR (SELECT count(*) FROM academic.academic_term) <> 12
    OR (SELECT count(*) FROM academic.course_result) <> 649
    OR (SELECT count(*) FROM academic.transcript) <> 10
    OR (SELECT count(*) FROM academic.graduation_record) <> 10
  THEN
    RAISE EXCEPTION 'University-email assignment rejected: academic table counts differ';
  END IF;

  IF fixture_students <> 20 OR fixture_program_links <> 20 THEN
    RAISE EXCEPTION 'University-email assignment rejected: fixture scope differs';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM academic.student
    WHERE admission_no NOT IN (${admissionsSql})
  ) THEN
    RAISE EXCEPTION 'University-email assignment rejected: unexpected student exists';
  END IF;

  IF (SELECT count(*) FROM academic.student
      WHERE personal_email IS NULL) <> 20
    OR (SELECT count(*) FROM academic.student
        WHERE passport_number_hmac ~ '^[0-9a-f]{64}$') <> 20
    OR (SELECT count(DISTINCT passport_number_hmac)
        FROM academic.student) <> 20
  THEN
    RAISE EXCEPTION 'University-email assignment rejected: academic identity fixture differs';
  END IF;

  IF (SELECT count(DISTINCT ('u' || admission_no || '@au.test'))
      FROM academic.student) <> 20
  THEN
    RAISE EXCEPTION 'University-email assignment rejected: target emails are not unique';
  END IF;

  SELECT count(*)
  INTO mismatched_emails
  FROM academic.student
  WHERE admission_no IN (${admissionsSql})
    AND university_email IS DISTINCT FROM
      'u' || admission_no || '@au.test';

  UPDATE academic.student
  SET university_email = 'u' || admission_no || '@au.test',
      updated_at = clock_timestamp()
  WHERE admission_no IN (${admissionsSql})
    AND university_email IS DISTINCT FROM
      'u' || admission_no || '@au.test';

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> mismatched_emails THEN
    RAISE EXCEPTION 'University-email assignment update count mismatch';
  END IF;

  IF (SELECT count(*) FROM academic.student
      WHERE university_email = 'u' || admission_no || '@au.test') <> 20
    OR (SELECT count(DISTINCT university_email)
        FROM academic.student) <> 20
    OR EXISTS (
      SELECT 1
      FROM academic.student
      WHERE university_email !~ '^u[0-9]+@au[.]test$'
    )
  THEN
    RAISE EXCEPTION 'Final university-email assertion failed';
  END IF;

  IF (SELECT count(*) FROM academic.program) <> 1
    OR (SELECT count(*) FROM academic.student) <> 20
    OR (SELECT count(*) FROM academic.student_program_enrollment) <> 20
    OR (SELECT count(*) FROM academic.course) <> 74
    OR (SELECT count(*) FROM academic.academic_term) <> 12
    OR (SELECT count(*) FROM academic.course_result) <> 649
    OR (SELECT count(*) FROM academic.transcript) <> 10
    OR (SELECT count(*) FROM academic.graduation_record) <> 10
  THEN
    RAISE EXCEPTION 'Final academic table-count assertion failed';
  END IF;

  IF (SELECT count(*) FROM wallet.holder_account) <> wallet_holder_count
    OR (SELECT count(*) FROM wallet.wallet_onboarding_request) <>
      wallet_request_count
    OR (SELECT count(*) FROM wallet.uploaded_identity_document) <>
      wallet_document_count
  THEN
    RAISE EXCEPTION 'Wallet isolation assertion failed';
  END IF;
END
$academic_university_email$;

COMMIT;
`;
}

function main() {
  const { force, outputPath } = parseArguments(process.argv.slice(2));
  const sql = buildSql();

  writeFileSync(outputPath, sql, {
    encoding: 'utf8',
    flag: force ? 'w' : 'wx',
    mode: 0o600,
  });
  chmodSync(outputPath, 0o600);

  process.stdout.write(
    [
      'Generated guarded synthetic academic university-email SQL.',
      `Output: ${outputPath}`,
      'The artifact updates only approved academic student email fields.',
      'No database statements were executed.',
    ].join('\n') + '\n',
  );
}

try {
  main();
} catch (error) {
  const message =
    error instanceof Error ? error.message : 'Unknown generator failure';
  process.stderr.write(
    `Academic university-email generation failed: ${message}\n`,
  );
  process.exitCode = 1;
}
