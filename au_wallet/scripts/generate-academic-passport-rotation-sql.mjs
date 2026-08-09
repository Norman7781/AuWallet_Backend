import { createHmac } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const STUDENT_ADMISSIONS = [
  '6899001',
  '6499002',
  '6399003',
  '6499004',
  '6699005',
  '6899011',
  '6799012',
  '6699013',
  '6499014',
  '6499015',
  '6499016',
  '6399017',
  '6399018',
  '6399019',
  '6399020',
  '6499021',
  '6899022',
  '6799023',
  '6699024',
  '6499025',
];

function fail(message) {
  throw new Error(message);
}

function parseArguments(args) {
  const force = args.includes('--force');
  const positional = args.filter((argument) => !argument.startsWith('--'));
  const unknownFlags = args.filter(
    (argument) => argument.startsWith('--') && argument !== '--force',
  );

  if (unknownFlags.length > 0) fail('Unknown command-line option');
  if (positional.length !== 1) {
    fail(
      'Provide exactly one /tmp output path ending in .generated-passport-rotation.sql',
    );
  }

  const outputPath = resolve(positional[0]);
  if (
    !outputPath.startsWith('/tmp/') ||
    !outputPath.endsWith('.generated-passport-rotation.sql')
  ) {
    fail(
      'Output must be a /tmp path ending in .generated-passport-rotation.sql',
    );
  }
  if (!force && existsSync(outputPath)) {
    fail('Output file already exists; pass --force to replace it');
  }

  return { force, outputPath };
}

function requireEnvironmentVariable(name) {
  const value = process.env[name];
  delete process.env[name];
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${name} is required`);
  }
  return value;
}

function normalizePassport(value) {
  return value.normalize('NFKC').trim().toUpperCase();
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function buildSql(expectedRows) {
  const values = expectedRows
    .map(
      ({ admissionNo, passportHmac }) =>
        `    (${quote(admissionNo)}::text, ${quote(passportHmac)}::text)`,
    )
    .join(',\n');

  return `-- Protected synthetic passport-HMAC rotation.
-- Generated from ignored local test inputs; delete this artifact after execution.
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SELECT pg_advisory_xact_lock(
  hashtextextended('au_wallet.academic.synthetic_passport_rotation.v1', 0)
);
LOCK TABLE academic.student IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE expected_passport_hmac (
  admission_no text PRIMARY KEY,
  passport_number_hmac text NOT NULL UNIQUE
) ON COMMIT DROP;

INSERT INTO expected_passport_hmac (admission_no, passport_number_hmac)
VALUES
${values};

CREATE TEMP TABLE protected_student_snapshot ON COMMIT DROP AS
SELECT
  student_id,
  to_jsonb(student) - 'passport_number_hmac' AS protected_values
FROM academic.student AS student;

DO $preflight$
DECLARE
  v_current_count bigint;
  v_expected_count bigint;
BEGIN
  SELECT count(*) INTO v_current_count FROM academic.student;
  SELECT count(*) INTO v_expected_count FROM expected_passport_hmac;

  IF v_current_count <> 20 OR v_expected_count <> 20 THEN
    RAISE EXCEPTION 'Passport rotation rejected: expected exactly 20 students';
  END IF;

  IF EXISTS (
    SELECT admission_no FROM academic.student
    EXCEPT
    SELECT admission_no FROM expected_passport_hmac
  ) OR EXISTS (
    SELECT admission_no FROM expected_passport_hmac
    EXCEPT
    SELECT admission_no FROM academic.student
  ) THEN
    RAISE EXCEPTION 'Passport rotation rejected: student fixture differs';
  END IF;

  IF (SELECT count(*) FROM academic.student
      WHERE passport_number_hmac ~ '^[0-9a-f]{64}$') <> 20
     OR (SELECT count(DISTINCT passport_number_hmac)
         FROM academic.student) <> 20
     OR (SELECT count(*) FROM expected_passport_hmac
         WHERE passport_number_hmac ~ '^[0-9a-f]{64}$') <> 20 THEN
    RAISE EXCEPTION 'Passport rotation rejected: HMAC contract differs';
  END IF;

  IF (SELECT count(*)
      FROM academic.student AS student
      JOIN expected_passport_hmac AS expected USING (admission_no)
      WHERE student.passport_number_hmac = expected.passport_number_hmac)
     NOT IN (0, 20) THEN
    RAISE EXCEPTION 'Passport rotation rejected: partial target state';
  END IF;
END
$preflight$;

DO $rotation$
DECLARE
  v_matching_count bigint;
  v_updated_count bigint;
BEGIN
  SELECT count(*) INTO v_matching_count
  FROM academic.student AS student
  JOIN expected_passport_hmac AS expected USING (admission_no)
  WHERE student.passport_number_hmac = expected.passport_number_hmac;

  IF v_matching_count = 0 THEN
    UPDATE academic.student AS student
    SET passport_number_hmac = expected.passport_number_hmac
    FROM expected_passport_hmac AS expected
    WHERE student.admission_no = expected.admission_no;
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count <> 20 THEN
      RAISE EXCEPTION 'Passport rotation updated an unexpected row count';
    END IF;
  END IF;
END
$rotation$;

DO $postflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM academic.student AS student
    JOIN expected_passport_hmac AS expected USING (admission_no)
    WHERE student.passport_number_hmac <> expected.passport_number_hmac
  ) OR (SELECT count(DISTINCT passport_number_hmac)
        FROM academic.student) <> 20 THEN
    RAISE EXCEPTION 'Passport rotation postflight failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM academic.student AS student
    JOIN protected_student_snapshot AS snapshot USING (student_id)
    WHERE to_jsonb(student) - 'passport_number_hmac'
          IS DISTINCT FROM snapshot.protected_values
  ) THEN
    RAISE EXCEPTION 'Passport rotation changed a protected student field';
  END IF;

  IF (SELECT count(*) FROM academic.program) <> 8
     OR (SELECT count(*) FROM academic.student_program_enrollment) <> 20
     OR (SELECT count(*) FROM academic.academic_term) <> 12
     OR (SELECT count(*) FROM academic.course) <> 70
     OR (SELECT count(*) FROM academic.course_result) <> 649
     OR (SELECT count(*) FROM academic.transcript) <> 10
     OR (SELECT count(*) FROM academic.graduation_record) <> 10 THEN
    RAISE EXCEPTION 'Passport rotation changed protected academic aggregates';
  END IF;
END
$postflight$;

COMMIT;
`;
}

function main() {
  const { force, outputPath } = parseArguments(process.argv.slice(2));
  let secret = requireEnvironmentVariable('PASSPORT_HMAC_SECRET');
  const secretBytes = Buffer.from(secret.trim(), 'utf8');
  secret = '';
  const expectedRows = [];

  try {
    for (const admissionNo of STUDENT_ADMISSIONS) {
      const environmentName = `SEED_PASSPORT_${admissionNo}`;
      let passport = requireEnvironmentVariable(environmentName);
      const normalized = normalizePassport(passport);
      passport = '';

      if (!/^[A-Z0-9]{8}$/.test(normalized)) {
        fail(
          `${environmentName} must be exactly eight ASCII letters or digits`,
        );
      }

      expectedRows.push({
        admissionNo,
        passportHmac: createHmac('sha256', secretBytes)
          .update(normalized, 'utf8')
          .digest('hex'),
      });
    }
  } finally {
    secretBytes.fill(0);
  }

  if (
    expectedRows.length !== 20 ||
    new Set(expectedRows.map((row) => row.passportHmac)).size !== 20
  ) {
    fail('Synthetic passport inputs must produce 20 distinct HMACs');
  }

  const sql = buildSql(expectedRows);
  expectedRows.forEach((row) => {
    row.passportHmac = '';
  });
  writeFileSync(outputPath, sql, {
    encoding: 'utf8',
    flag: force ? 'w' : 'wx',
    mode: 0o600,
  });
  process.stdout.write(
    [
      'Generated protected synthetic passport-HMAC rotation SQL.',
      `Output: ${outputPath}`,
      'Expected students: 20.',
      'No database statements were executed.',
    ].join('\n') + '\n',
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Generation failed'}\n`,
  );
  process.exitCode = 1;
}
