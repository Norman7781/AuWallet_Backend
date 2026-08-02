import { chmodSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROGRAM_CODE } from './academic-curriculum-fixture.mjs';

const PROJECT_REF = 'ezsylcmnqbcwvkoqybkd';
const EXPECTED_FIXTURE_FINGERPRINT = '8ddd18d4633db282f4266e723fe59a73';
const EXPECTED_OUTPUT = resolve(
  '/tmp/au-wallet-academic-personal-email-removal.sql',
);
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
      'Provide exactly /tmp/au-wallet-academic-personal-email-removal.sql; add --force only to allow replacement',
    );
  }

  const outputPath = resolve(positional[0]);
  if (outputPath !== EXPECTED_OUTPUT) {
    fail(
      'Output path must be /tmp/au-wallet-academic-personal-email-removal.sql',
    );
  }
  if (!force && existsSync(outputPath)) {
    fail('Output file already exists; pass --force to replace it');
  }

  return { force, outputPath };
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const admissionsSql = ADMISSIONS.map(quote).join(', ');

const fixtureFingerprintExpression = `md5(jsonb_build_object(
    'programs', (
      SELECT jsonb_agg(jsonb_build_object(
        'faculty_code', program.faculty_code,
        'faculty_name', program.faculty_name,
        'program_code', program.program_code,
        'degree_level', program.degree_level,
        'degree_name', program.degree_name,
        'major', program.major,
        'major_concentration', program.major_concentration,
        'required_credits', program.required_credits,
        'is_active', program.is_active
      ) ORDER BY program.program_code)
      FROM academic.program AS program
    ),
    'students', (
      SELECT jsonb_agg(jsonb_build_object(
        'admission_no', student.admission_no,
        'title', student.title,
        'first_name', student.first_name,
        'middle_name', student.middle_name,
        'last_name', student.last_name,
        'date_of_birth', student.date_of_birth,
        'university_email', student.university_email,
        'passport_number_hmac', student.passport_number_hmac
      ) ORDER BY student.admission_no)
      FROM academic.student AS student
    ),
    'enrollments', (
      SELECT jsonb_agg(jsonb_build_object(
        'admission_no', student.admission_no,
        'program_code', program.program_code,
        'admission_date', enrollment.admission_date,
        'academic_status', enrollment.academic_status,
        'previous_institution_name', enrollment.previous_institution_name
      ) ORDER BY student.admission_no, program.program_code)
      FROM academic.student_program_enrollment AS enrollment
      JOIN academic.student AS student
        ON student.student_id = enrollment.student_id
      JOIN academic.program AS program
        ON program.program_id = enrollment.program_id
    ),
    'courses', (
      SELECT jsonb_agg(jsonb_build_object(
        'program_code', program.program_code,
        'course_code', course.course_code,
        'course_title', course.course_title,
        'default_credits', course.default_credits,
        'course_category', course.course_category,
        'is_active', course.is_active
      ) ORDER BY program.program_code, course.course_code)
      FROM academic.course AS course
      JOIN academic.program AS program
        ON program.program_id = course.program_id
    ),
    'terms', (
      SELECT jsonb_agg(jsonb_build_object(
        'term_code', term.term_code,
        'academic_year', term.academic_year,
        'semester_no', term.semester_no,
        'term_label', term.term_label
      ) ORDER BY term.term_code)
      FROM academic.academic_term AS term
    ),
    'results', (
      SELECT jsonb_agg(jsonb_build_object(
        'admission_no', student.admission_no,
        'term_code', term.term_code,
        'course_code', course.course_code,
        'credits', result.credits,
        'grade', result.grade,
        'result_type', result.result_type
      ) ORDER BY student.admission_no, course.course_code)
      FROM academic.course_result AS result
      JOIN academic.student_program_enrollment AS enrollment
        ON enrollment.enrollment_id = result.enrollment_id
      JOIN academic.student AS student
        ON student.student_id = enrollment.student_id
      JOIN academic.course AS course
        ON course.course_id = result.course_id
      LEFT JOIN academic.academic_term AS term
        ON term.academic_term_id = result.academic_term_id
    ),
    'graduations', (
      SELECT jsonb_agg(jsonb_build_object(
        'admission_no', student.admission_no,
        'graduation_date', graduation.graduation_date,
        'total_credits_completed', graduation.total_credits_completed,
        'total_credits_transferred', graduation.total_credits_transferred,
        'total_credits_earned', graduation.total_credits_earned,
        'cumulative_gpa', graduation.cumulative_gpa,
        'award', graduation.award,
        'requirements_fulfilled', graduation.requirements_fulfilled,
        'graduation_status', graduation.graduation_status,
        'approved_at_utc', to_char(
          graduation.approved_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US'
        )
      ) ORDER BY student.admission_no)
      FROM academic.graduation_record AS graduation
      JOIN academic.student_program_enrollment AS enrollment
        ON enrollment.enrollment_id = graduation.enrollment_id
      JOIN academic.student AS student
        ON student.student_id = enrollment.student_id
    ),
    'transcripts', (
      SELECT jsonb_agg(jsonb_build_object(
        'admission_no', student.admission_no,
        'document_number', transcript.document_number,
        'verification_code', transcript.verification_code,
        'issued_on', transcript.issued_on,
        'is_certified_true_copy', transcript.is_certified_true_copy,
        'document_status', transcript.document_status,
        'registrar_name', transcript.registrar_name
      ) ORDER BY student.admission_no)
      FROM academic.transcript AS transcript
      JOIN academic.student_program_enrollment AS enrollment
        ON enrollment.enrollment_id = transcript.enrollment_id
      JOIN academic.student AS student
        ON student.student_id = enrollment.student_id
    )
  )::text)`;

function buildSql() {
  return `-- Protected removal of synthetic academic personal-email values.
-- Intended Supabase project ref: ${PROJECT_REF}.
-- This transaction changes only academic.student.personal_email nullability
-- and the exact approved fixture rows.

BEGIN;

SELECT pg_advisory_xact_lock(
  hashtextextended('au_wallet.academic.personal_email_removal.v1', 0)
);

DO $academic_personal_email_removal$
DECLARE
  academic_email_nullable text;
  wallet_email_nullable text;
  fixture_students bigint;
  fixture_program_links bigint;
  null_personal_emails bigint;
  nonnull_personal_emails bigint;
  affected_rows bigint;
  current_fingerprint text;
  final_fingerprint text;
BEGIN
  SELECT is_nullable
  INTO academic_email_nullable
  FROM information_schema.columns
  WHERE table_schema = 'academic'
    AND table_name = 'student'
    AND column_name = 'personal_email';

  SELECT is_nullable
  INTO wallet_email_nullable
  FROM information_schema.columns
  WHERE table_schema = 'wallet'
    AND table_name = 'holder_account'
    AND column_name = 'personal_email';

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

  SELECT
    count(*) FILTER (WHERE personal_email IS NULL),
    count(*) FILTER (WHERE personal_email IS NOT NULL)
  INTO null_personal_emails, nonnull_personal_emails
  FROM academic.student;

  SELECT ${fixtureFingerprintExpression}
  INTO current_fingerprint;

  IF (SELECT count(*) FROM academic.program) <> 1
    OR (SELECT count(*) FROM academic.student) <> 20
    OR (SELECT count(*) FROM academic.student_program_enrollment) <> 20
    OR (SELECT count(*) FROM academic.course) <> 74
    OR (SELECT count(*) FROM academic.academic_term) <> 12
    OR (SELECT count(*) FROM academic.course_result) <> 649
    OR (SELECT count(*) FROM academic.transcript) <> 10
    OR (SELECT count(*) FROM academic.graduation_record) <> 10
  THEN
    RAISE EXCEPTION 'Academic personal-email removal rejected: academic table counts differ';
  END IF;

  IF (SELECT count(*) FROM wallet.holder_account) <> 0
    OR (SELECT count(*) FROM wallet.wallet_onboarding_request) <> 0
    OR (SELECT count(*) FROM wallet.uploaded_identity_document) <> 0
  THEN
    RAISE EXCEPTION 'Academic personal-email removal rejected: wallet tables are not empty';
  END IF;

  IF wallet_email_nullable IS DISTINCT FROM 'NO' THEN
    RAISE EXCEPTION 'Academic personal-email removal rejected: wallet personal-email contract differs';
  END IF;

  IF fixture_students <> 20 OR fixture_program_links <> 20 THEN
    RAISE EXCEPTION 'Academic personal-email removal rejected: approved fixture scope differs';
  END IF;

  IF current_fingerprint IS DISTINCT FROM '${EXPECTED_FIXTURE_FINGERPRINT}' THEN
    RAISE EXCEPTION 'Academic personal-email removal rejected: academic fixture fingerprint differs';
  END IF;

  IF (SELECT count(*) FROM academic.student
      WHERE admission_no IN (${admissionsSql})) <> 20
    OR EXISTS (
      SELECT 1
      FROM academic.student
      WHERE admission_no NOT IN (${admissionsSql})
    )
  THEN
    RAISE EXCEPTION 'Academic personal-email removal rejected: admission scope differs';
  END IF;

  IF (SELECT count(*) FROM academic.student
      WHERE passport_number_hmac ~ '^[0-9a-f]{64}$') <> 20
    OR (SELECT count(DISTINCT passport_number_hmac)
        FROM academic.student) <> 20
  THEN
    RAISE EXCEPTION 'Academic personal-email removal rejected: passport HMAC contract differs';
  END IF;

  IF academic_email_nullable = 'NO'
    AND null_personal_emails = 0
    AND nonnull_personal_emails = 20
  THEN
    ALTER TABLE academic.student
      ALTER COLUMN personal_email DROP NOT NULL;

    UPDATE academic.student AS student
    SET personal_email = NULL
    WHERE student.personal_email IS NOT NULL
      AND student.admission_no IN (${admissionsSql})
      AND EXISTS (
        SELECT 1
        FROM academic.student_program_enrollment AS enrollment
        JOIN academic.program AS program
          ON program.program_id = enrollment.program_id
        WHERE enrollment.student_id = student.student_id
          AND program.program_code = '${PROGRAM_CODE}'
      );

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 20 THEN
      RAISE EXCEPTION 'Academic personal-email removal update count mismatch';
    END IF;
  ELSIF academic_email_nullable = 'YES'
    AND null_personal_emails = 20
    AND nonnull_personal_emails = 0
  THEN
    NULL;
  ELSE
    RAISE EXCEPTION
      'Academic personal-email removal rejected: unexpected nullability or mixed email state';
  END IF;

  SELECT is_nullable
  INTO academic_email_nullable
  FROM information_schema.columns
  WHERE table_schema = 'academic'
    AND table_name = 'student'
    AND column_name = 'personal_email';

  SELECT
    count(*) FILTER (WHERE personal_email IS NULL),
    count(*) FILTER (WHERE personal_email IS NOT NULL)
  INTO null_personal_emails, nonnull_personal_emails
  FROM academic.student;

  SELECT ${fixtureFingerprintExpression}
  INTO final_fingerprint;

  IF academic_email_nullable IS DISTINCT FROM 'YES'
    OR null_personal_emails <> 20
    OR nonnull_personal_emails <> 0
  THEN
    RAISE EXCEPTION 'Final academic personal-email assertion failed';
  END IF;

  IF final_fingerprint IS DISTINCT FROM '${EXPECTED_FIXTURE_FINGERPRINT}'
    OR final_fingerprint IS DISTINCT FROM current_fingerprint
  THEN
    RAISE EXCEPTION 'Final academic fixture fingerprint assertion failed';
  END IF;

  IF (SELECT count(*) FROM academic.program) <> 1
    OR (SELECT count(*) FROM academic.student) <> 20
    OR (SELECT count(*) FROM academic.student_program_enrollment) <> 20
    OR (SELECT count(*) FROM academic.course) <> 74
    OR (SELECT count(*) FROM academic.academic_term) <> 12
    OR (SELECT count(*) FROM academic.course_result) <> 649
    OR (SELECT count(*) FROM academic.transcript) <> 10
    OR (SELECT count(*) FROM academic.graduation_record) <> 10
    OR (SELECT count(*) FROM wallet.holder_account) <> 0
    OR (SELECT count(*) FROM wallet.wallet_onboarding_request) <> 0
    OR (SELECT count(*) FROM wallet.uploaded_identity_document) <> 0
  THEN
    RAISE EXCEPTION 'Final table-count assertion failed';
  END IF;

  IF (
    SELECT ROW(
      count(*) FILTER (WHERE academic_status = 'studying'),
      count(*) FILTER (WHERE academic_status = 'graduated'),
      count(*) FILTER (WHERE academic_status = 'alumni'),
      count(*) FILTER (WHERE academic_status = 'withdrawn')
    )
    FROM academic.student_program_enrollment
  ) IS DISTINCT FROM ROW(5::bigint, 5::bigint, 5::bigint, 5::bigint)
  THEN
    RAISE EXCEPTION 'Final enrollment-status assertion failed';
  END IF;

  IF (
    SELECT ROW(
      count(*) FILTER (WHERE result_type = 'normal'),
      count(*) FILTER (WHERE result_type = 'transfer'),
      count(*) FILTER (WHERE result_type = 'seminar')
    )
    FROM academic.course_result
  ) IS DISTINCT FROM ROW(631::bigint, 18::bigint, 0::bigint)
  THEN
    RAISE EXCEPTION 'Final course-result distribution assertion failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM academic.graduation_record AS graduation
    JOIN academic.student_program_enrollment AS enrollment
      ON enrollment.enrollment_id = graduation.enrollment_id
    JOIN academic.program AS program
      ON program.program_id = enrollment.program_id
    WHERE enrollment.academic_status NOT IN ('graduated', 'alumni')
      OR graduation.graduation_status <> 'completed'
      OR NOT graduation.requirements_fulfilled
      OR graduation.approved_at IS NULL
      OR graduation.total_credits_earned < program.required_credits
  ) THEN
    RAISE EXCEPTION 'Final graduation-record assertion failed';
  END IF;

  IF (
    SELECT ROW(
      count(*) FILTER (
        WHERE document_status = 'issued'
          AND document_number IS NOT NULL
          AND verification_code IS NOT NULL
          AND issued_on IS NOT NULL
          AND is_certified_true_copy
          AND registrar_name IS NOT NULL
      ),
      count(*) FILTER (
        WHERE document_status = 'draft'
          AND document_number IS NULL
          AND verification_code IS NULL
          AND issued_on IS NULL
          AND NOT is_certified_true_copy
          AND registrar_name IS NULL
      )
    )
    FROM academic.transcript
  ) IS DISTINCT FROM ROW(8::bigint, 2::bigint)
  THEN
    RAISE EXCEPTION 'Final transcript assertion failed';
  END IF;

  IF (SELECT count(*) FROM academic.student
      WHERE passport_number_hmac ~ '^[0-9a-f]{64}$') <> 20
    OR (SELECT count(DISTINCT passport_number_hmac)
        FROM academic.student) <> 20
  THEN
    RAISE EXCEPTION 'Final passport HMAC assertion failed';
  END IF;

  IF wallet_email_nullable IS DISTINCT FROM 'NO' THEN
    RAISE EXCEPTION 'Final wallet personal-email contract assertion failed';
  END IF;
END
$academic_personal_email_removal$;

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
      'Generated protected academic personal-email removal SQL.',
      `Output: ${outputPath}`,
      'The artifact contains one guarded transaction and no secret values.',
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
    `Academic personal-email removal generation failed: ${message}\n`,
  );
  process.exitCode = 1;
}
