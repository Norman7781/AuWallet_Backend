import { chmodSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ALL_ADMISSIONS,
  COURSES,
  IDS_ADMISSIONS,
  LEGACY_COMPLETE_BLOCKS,
  LEGACY_PROGRAM_CODE,
  LEGACY_SEMINAR_CODES,
  PROGRAM_CODE,
  SED_ADMISSIONS,
  concentrationFor,
  curriculumBlocksFor,
} from './academic-curriculum-fixture.mjs';

const PROJECT_REF = 'ezsylcmnqbcwvkoqybkd';
const EXPECTED_OUTPUT = resolve(
  '/tmp/au-wallet-academic-curriculum-correction.sql',
);
const LEGACY_CURRICULUM_FINGERPRINT = 'e455e696fb4d127ab4c0fc4cb71a307b';
const PRESERVED_FIXTURE_FINGERPRINT = '2ab5b8a997389ca4c35145fa28d1eb9c';

function fail(message) {
  throw new Error(message);
}

function parseArguments(args) {
  const force = args.includes('--force');
  const unknownFlags = args.filter(
    (argument) => argument.startsWith('--') && argument !== '--force',
  );
  const positional = args.filter((argument) => !argument.startsWith('--'));

  if (unknownFlags.length > 0) fail('Unknown command-line option');
  if (positional.length !== 1) {
    fail(
      'Provide exactly /tmp/au-wallet-academic-curriculum-correction.sql; add --force only to allow replacement',
    );
  }
  const outputPath = resolve(positional[0]);
  if (outputPath !== EXPECTED_OUTPUT) {
    fail(
      'Output path must be /tmp/au-wallet-academic-curriculum-correction.sql',
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

const sqlValue = {
  text: (value) => (value === null ? 'NULL::text' : `${quote(value)}::text`),
  numeric: (value) => `${value}::numeric`,
  bigint: (value) => `${value}::bigint`,
};

function valuesSql(rows, types, indent = '      ') {
  return rows
    .map(
      (row) =>
        `${indent}(${row.map((value, index) => sqlValue[types[index]](value)).join(', ')})`,
    )
    .join(',\n');
}

const legacyPositions = LEGACY_COMPLETE_BLOCKS.flat().map(
  (courseCode, index) => [courseCode, index + 1],
);
const targetPaths = [
  ['SED', [...SED_ADMISSIONS][0]],
  ['IDS', [...IDS_ADMISSIONS][0]],
].flatMap(([concentration, admissionNo]) =>
  curriculumBlocksFor(admissionNo)
    .flat()
    .map((courseCode, index) => [concentration, index + 1, courseCode]),
);
const studentTracks = ALL_ADMISSIONS.map((admissionNo) => [
  admissionNo,
  concentrationFor(admissionNo),
]);
const resultSummaries = [
  ['6399003', 46, 40, 6, 114, 18],
  ['6399017', 46, 46, 0, 132, 0],
  ['6399018', 46, 46, 0, 132, 0],
  ['6399019', 46, 40, 6, 114, 18],
  ['6399020', 46, 40, 6, 114, 18],
  ['6499002', 46, 46, 0, 132, 0],
  ['6499004', 46, 46, 0, 132, 0],
  ['6499014', 41, 41, 0, 117, 0],
  ['6499015', 46, 46, 0, 132, 0],
  ['6499016', 46, 46, 0, 132, 0],
  ['6499021', 46, 46, 0, 132, 0],
  ['6499025', 24, 24, 0, 66, 0],
  ['6699005', 8, 8, 0, 21, 0],
  ['6699013', 36, 36, 0, 102, 0],
  ['6699024', 18, 18, 0, 49, 0],
  ['6799012', 24, 24, 0, 66, 0],
  ['6799023', 12, 12, 0, 32, 0],
  ['6899001', 10, 10, 0, 25, 0],
  ['6899011', 10, 10, 0, 25, 0],
  ['6899022', 6, 6, 0, 16, 0],
];

const curriculumLayerFingerprintExpression = `md5(jsonb_build_object(
    'program', (
      SELECT jsonb_agg(jsonb_build_object(
        'faculty_code', p.faculty_code, 'faculty_name', p.faculty_name,
        'program_code', p.program_code, 'degree_level', p.degree_level,
        'degree_name', p.degree_name, 'major', p.major,
        'major_concentration', p.major_concentration,
        'required_credits', p.required_credits, 'is_active', p.is_active
      ) ORDER BY p.program_code) FROM academic.program p
    ),
    'courses', (
      SELECT jsonb_agg(jsonb_build_object(
        'course_code', c.course_code, 'course_title', c.course_title,
        'default_credits', c.default_credits,
        'course_category', c.course_category, 'is_active', c.is_active
      ) ORDER BY c.course_code) FROM academic.course c
    ),
    'result_course_links', (
      SELECT jsonb_agg(jsonb_build_object(
        'course_result_id', r.course_result_id, 'course_code', c.course_code
      ) ORDER BY r.course_result_id)
      FROM academic.course_result r
      JOIN academic.course c ON c.course_id = r.course_id
    )
  )::text)`;

const preservedFixtureFingerprintExpression = `md5(jsonb_build_object(
    'students', (
      SELECT jsonb_agg(jsonb_build_object(
        'admission_no', s.admission_no, 'title', s.title,
        'first_name', s.first_name, 'middle_name', s.middle_name,
        'last_name', s.last_name, 'date_of_birth', s.date_of_birth,
        'personal_email', s.personal_email,
        'passport_number_hmac', s.passport_number_hmac
      ) ORDER BY s.admission_no) FROM academic.student s
    ),
    'enrollments', (
      SELECT jsonb_agg(jsonb_build_object(
        'admission_no', s.admission_no, 'admission_date', e.admission_date,
        'academic_status', e.academic_status,
        'previous_institution_name', e.previous_institution_name
      ) ORDER BY s.admission_no)
      FROM academic.student_program_enrollment e
      JOIN academic.student s ON s.student_id = e.student_id
    ),
    'terms', (
      SELECT jsonb_agg(jsonb_build_object(
        'term_code', t.term_code, 'academic_year', t.academic_year,
        'semester_no', t.semester_no, 'term_label', t.term_label
      ) ORDER BY t.term_code) FROM academic.academic_term t
    ),
    'results_without_seminars', (
      SELECT jsonb_agg(jsonb_build_object(
        'course_result_id', r.course_result_id,
        'admission_no', s.admission_no, 'term_code', t.term_code,
        'credits', r.credits, 'grade', r.grade, 'result_type', r.result_type
      ) ORDER BY r.course_result_id)
      FROM academic.course_result r
      JOIN academic.student_program_enrollment e
        ON e.enrollment_id = r.enrollment_id
      JOIN academic.student s ON s.student_id = e.student_id
      LEFT JOIN academic.academic_term t
        ON t.academic_term_id = r.academic_term_id
      WHERE r.result_type <> 'seminar'
    ),
    'graduations', (
      SELECT jsonb_agg(jsonb_build_object(
        'admission_no', s.admission_no,
        'graduation_date', g.graduation_date,
        'total_credits_completed', g.total_credits_completed,
        'total_credits_transferred', g.total_credits_transferred,
        'total_credits_earned', g.total_credits_earned,
        'cumulative_gpa', g.cumulative_gpa, 'award', g.award,
        'requirements_fulfilled', g.requirements_fulfilled,
        'graduation_status', g.graduation_status,
        'approved_at_utc', to_char(
          g.approved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'
        )
      ) ORDER BY s.admission_no)
      FROM academic.graduation_record g
      JOIN academic.student_program_enrollment e
        ON e.enrollment_id = g.enrollment_id
      JOIN academic.student s ON s.student_id = e.student_id
    ),
    'transcripts', (
      SELECT jsonb_agg(jsonb_build_object(
        'admission_no', s.admission_no,
        'document_number', tr.document_number,
        'verification_code', tr.verification_code,
        'issued_on', tr.issued_on,
        'is_certified_true_copy', tr.is_certified_true_copy,
        'document_status', tr.document_status,
        'registrar_name', tr.registrar_name
      ) ORDER BY s.admission_no)
      FROM academic.transcript tr
      JOIN academic.student_program_enrollment e
        ON e.enrollment_id = tr.enrollment_id
      JOIN academic.student s ON s.student_id = e.student_id
    )
  )::text)`;

function validateModel() {
  if (
    legacyPositions.length !== 46 ||
    new Set(legacyPositions.map((row) => row[0])).size !== 46 ||
    targetPaths.length !== 92 ||
    studentTracks.length !== 20 ||
    resultSummaries.reduce((sum, row) => sum + row[1], 0) !== 649
  ) {
    fail('Curriculum correction model assertion failed');
  }
}

function buildSql() {
  const courseValues = valuesSql(COURSES, ['text', 'text', 'numeric', 'text']);
  const legacyPositionValues = valuesSql(legacyPositions, ['text', 'bigint']);
  const targetPathValues = valuesSql(targetPaths, ['text', 'bigint', 'text']);
  const studentTrackValues = valuesSql(studentTracks, ['text', 'text']);
  const summaryValues = valuesSql(resultSummaries, [
    'text',
    'bigint',
    'bigint',
    'bigint',
    'numeric',
    'numeric',
  ]);
  const admissionsSql = ALL_ADMISSIONS.map(quote).join(', ');
  const legacySeminarsSql = LEGACY_SEMINAR_CODES.map(quote).join(', ');

  return `-- Guarded correction of the synthetic Computer Science curriculum.
-- Intended Supabase project ref: ${PROJECT_REF}.
-- This file contains no passport input, secret, or HMAC value.

BEGIN;

SELECT pg_advisory_xact_lock(
  hashtextextended('au_wallet.academic.curriculum_correction.v1', 0)
);

DO $academic_curriculum_correction$
DECLARE
  legacy_program_exists boolean;
  corrected_program_exists boolean;
  current_curriculum_fingerprint text;
  current_preserved_fingerprint text;
  final_preserved_fingerprint text;
  affected_rows bigint;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM academic.program
    WHERE program_code = '${LEGACY_PROGRAM_CODE}'
  ) INTO legacy_program_exists;

  SELECT EXISTS (
    SELECT 1 FROM academic.program
    WHERE program_code = '${PROGRAM_CODE}'
  ) INTO corrected_program_exists;

  SELECT ${preservedFixtureFingerprintExpression}
  INTO current_preserved_fingerprint;

  IF current_preserved_fingerprint IS DISTINCT FROM '${PRESERVED_FIXTURE_FINGERPRINT}' THEN
    RAISE EXCEPTION 'Correction rejected: preserved academic fixture differs';
  END IF;

  IF legacy_program_exists AND NOT corrected_program_exists THEN
    IF (SELECT count(*) FROM academic.program) <> 1
      OR (SELECT count(*) FROM academic.student) <> 20
      OR (SELECT count(*) FROM academic.student_program_enrollment) <> 20
      OR (SELECT count(*) FROM academic.course) <> 54
      OR (SELECT count(*) FROM academic.academic_term) <> 12
      OR (SELECT count(*) FROM academic.course_result) <> 761
      OR (SELECT count(*) FROM academic.transcript) <> 10
      OR (SELECT count(*) FROM academic.graduation_record) <> 10
      OR (SELECT count(*) FROM wallet.holder_account) <> 0
      OR (SELECT count(*) FROM wallet.wallet_onboarding_request) <> 0
      OR (SELECT count(*) FROM wallet.uploaded_identity_document) <> 0
    THEN
      RAISE EXCEPTION 'State A rejected: exact table counts differ';
    END IF;

    SELECT ${curriculumLayerFingerprintExpression}
    INTO current_curriculum_fingerprint;
    IF current_curriculum_fingerprint IS DISTINCT FROM '${LEGACY_CURRICULUM_FINGERPRINT}' THEN
      RAISE EXCEPTION 'State A rejected: legacy curriculum fingerprint differs';
    END IF;

    DELETE FROM academic.course_result AS result
    USING academic.course AS course
    WHERE result.course_id = course.course_id
      AND result.result_type = 'seminar'
      AND course.course_code IN (${legacySeminarsSql});
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 112 THEN
      RAISE EXCEPTION 'Seminar result removal count mismatch';
    END IF;

    UPDATE academic.course
    SET course_code = '__LEGACY__' || course_code
    WHERE program_id = (
      SELECT program_id FROM academic.program
      WHERE program_code = '${LEGACY_PROGRAM_CODE}'
    );
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 54 THEN
      RAISE EXCEPTION 'Legacy course staging count mismatch';
    END IF;

    UPDATE academic.program
    SET program_code = '${PROGRAM_CODE}',
        major_concentration = NULL
    WHERE program_code = '${LEGACY_PROGRAM_CODE}'
      AND faculty_code = 'VMES'
      AND faculty_name = 'Vincent Mary School of Engineering, Science and Technology'
      AND degree_level = 'bachelor'
      AND degree_name = 'Bachelor of Science'
      AND major = 'Computer Science'
      AND major_concentration = 'Informatics and Data Science'
      AND required_credits = 132::numeric
      AND is_active;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 1 THEN
      RAISE EXCEPTION 'Program correction count mismatch';
    END IF;

    INSERT INTO academic.course (
      program_id, course_code, course_title, default_credits,
      course_category, is_active
    )
    SELECT program.program_id, fixture.course_code, fixture.course_title,
      fixture.default_credits, fixture.course_category, true
    FROM (
      VALUES
${courseValues}
    ) AS fixture(course_code, course_title, default_credits, course_category)
    JOIN academic.program AS program
      ON program.program_code = '${PROGRAM_CODE}';
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 74 THEN
      RAISE EXCEPTION 'Corrected catalog insert count mismatch';
    END IF;

    WITH legacy_position(legacy_code, course_position) AS (
      VALUES
${legacyPositionValues}
    ),
    target_path(concentration, course_position, course_code) AS (
      VALUES
${targetPathValues}
    ),
    student_track(admission_no, concentration) AS (
      VALUES
${studentTrackValues}
    )
    UPDATE academic.course_result AS result
    SET course_id = target_course.course_id
    FROM academic.student_program_enrollment AS enrollment,
      academic.student AS student,
      academic.course AS legacy_course,
      legacy_position,
      student_track,
      target_path,
      academic.course AS target_course,
      academic.program AS program
    WHERE result.enrollment_id = enrollment.enrollment_id
      AND student.student_id = enrollment.student_id
      AND student.admission_no = student_track.admission_no
      AND legacy_course.course_id = result.course_id
      AND legacy_course.course_code = '__LEGACY__' || legacy_position.legacy_code
      AND target_path.concentration = student_track.concentration
      AND target_path.course_position = legacy_position.course_position
      AND program.program_id = enrollment.program_id
      AND program.program_code = '${PROGRAM_CODE}'
      AND target_course.program_id = program.program_id
      AND target_course.course_code = target_path.course_code;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 649 THEN
      RAISE EXCEPTION 'Course-result remap count mismatch';
    END IF;

    DELETE FROM academic.course
    WHERE program_id = (
      SELECT program_id FROM academic.program
      WHERE program_code = '${PROGRAM_CODE}'
    )
      AND starts_with(course_code, '__LEGACY__');
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 54 THEN
      RAISE EXCEPTION 'Legacy catalog removal count mismatch';
    END IF;
  ELSIF NOT legacy_program_exists AND corrected_program_exists THEN
    NULL;
  ELSIF legacy_program_exists AND corrected_program_exists THEN
    RAISE EXCEPTION 'Correction rejected: legacy and corrected program keys coexist';
  ELSE
    RAISE EXCEPTION 'Correction rejected: neither supported curriculum state exists';
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
    RAISE EXCEPTION 'Corrected fixture table-count assertion failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM academic.program
    WHERE faculty_code = 'VMES'
      AND faculty_name = 'Vincent Mary School of Engineering, Science and Technology'
      AND program_code = '${PROGRAM_CODE}'
      AND degree_level = 'bachelor'
      AND degree_name = 'Bachelor of Science'
      AND major = 'Computer Science'
      AND major_concentration IS NULL
      AND required_credits = 132::numeric
      AND is_active
  ) THEN
    RAISE EXCEPTION 'Corrected program assertion failed';
  END IF;

  IF EXISTS (
    WITH expected(course_code, course_title, default_credits, course_category) AS (
      VALUES
${courseValues}
    ),
    actual AS (
      SELECT course.course_code, course.course_title, course.default_credits,
        course.course_category
      FROM academic.course AS course
      JOIN academic.program AS program
        ON program.program_id = course.program_id
      WHERE program.program_code = '${PROGRAM_CODE}'
        AND course.is_active
    ),
    missing AS (SELECT * FROM expected EXCEPT SELECT * FROM actual),
    extra AS (SELECT * FROM actual EXCEPT SELECT * FROM expected)
    SELECT 1 FROM missing UNION ALL SELECT 1 FROM extra
  ) THEN
    RAISE EXCEPTION 'Corrected course catalog differs';
  END IF;

  IF (
    SELECT ROW(
      count(*),
      count(*) FILTER (WHERE default_credits = 3),
      count(*) FILTER (WHERE default_credits = 2),
      sum(default_credits),
      count(DISTINCT course_code)
    )
    FROM academic.course
  ) IS DISTINCT FROM ROW(
    74::bigint, 66::bigint, 8::bigint, 214::numeric, 74::bigint
  ) THEN
    RAISE EXCEPTION 'Corrected catalog aggregate assertion failed';
  END IF;

  IF EXISTS (
    WITH target_path(concentration, course_position, course_code) AS (
      VALUES
${targetPathValues}
    ),
    student_track(admission_no, concentration) AS (
      VALUES
${studentTrackValues}
    )
    SELECT 1
    FROM academic.course_result AS result
    JOIN academic.student_program_enrollment AS enrollment
      ON enrollment.enrollment_id = result.enrollment_id
    JOIN academic.student AS student
      ON student.student_id = enrollment.student_id
    JOIN student_track ON student_track.admission_no = student.admission_no
    JOIN academic.course AS course ON course.course_id = result.course_id
    LEFT JOIN target_path
      ON target_path.concentration = student_track.concentration
     AND target_path.course_code = course.course_code
    WHERE target_path.course_code IS NULL
  ) THEN
    RAISE EXCEPTION 'Corrected student curriculum-path assertion failed';
  END IF;

  IF EXISTS (
    WITH expected(admission_no, result_count, normal_count, transfer_count,
      completed_credits, transferred_credits) AS (
      VALUES
${summaryValues}
    ),
    actual AS (
      SELECT student.admission_no, count(*)::bigint,
        count(*) FILTER (WHERE result.result_type = 'normal')::bigint,
        count(*) FILTER (WHERE result.result_type = 'transfer')::bigint,
        coalesce(sum(result.credits) FILTER (
          WHERE result.result_type = 'normal'
        ), 0)::numeric,
        coalesce(sum(result.credits) FILTER (
          WHERE result.result_type = 'transfer'
        ), 0)::numeric
      FROM academic.course_result AS result
      JOIN academic.student_program_enrollment AS enrollment
        ON enrollment.enrollment_id = result.enrollment_id
      JOIN academic.student AS student
        ON student.student_id = enrollment.student_id
      GROUP BY student.admission_no
    ),
    missing AS (SELECT * FROM expected EXCEPT SELECT * FROM actual),
    extra AS (SELECT * FROM actual EXCEPT SELECT * FROM expected)
    SELECT 1 FROM missing UNION ALL SELECT 1 FROM extra
  ) THEN
    RAISE EXCEPTION 'Corrected student result-summary assertion failed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM academic.course_result
    GROUP BY enrollment_id, course_id
    HAVING count(*) <> 1
  ) OR EXISTS (
    SELECT 1
    FROM academic.course_result AS result
    JOIN academic.course AS course ON course.course_id = result.course_id
    WHERE result.result_type = 'normal'
      AND result.credits IS DISTINCT FROM course.default_credits
  ) OR EXISTS (
    SELECT 1 FROM academic.course_result
    WHERE result_type = 'transfer'
      AND (grade <> 'TR' OR academic_term_id IS NOT NULL OR credits <> 3)
  ) OR EXISTS (
    SELECT 1 FROM academic.course_result
    WHERE result_type NOT IN ('normal', 'transfer')
  ) THEN
    RAISE EXCEPTION 'Corrected course-result contract assertion failed';
  END IF;

  IF (
    SELECT ROW(
      count(*) FILTER (WHERE result_type = 'normal'),
      count(*) FILTER (WHERE result_type = 'transfer'),
      count(*) FILTER (WHERE result_type = 'seminar')
    ) FROM academic.course_result
  ) IS DISTINCT FROM ROW(631::bigint, 18::bigint, 0::bigint) THEN
    RAISE EXCEPTION 'Corrected course-result distribution assertion failed';
  END IF;

  IF (SELECT count(*) FROM academic.student
      WHERE admission_no IN (${admissionsSql})) <> 20
    OR (SELECT count(*) FROM academic.student) <> 20
    OR (SELECT count(*) FROM academic.student
        WHERE passport_number_hmac ~ '^[0-9a-f]{64}$') <> 20
    OR (SELECT count(DISTINCT passport_number_hmac)
        FROM academic.student) <> 20
  THEN
    RAISE EXCEPTION 'Corrected student identity assertion failed';
  END IF;

  SELECT ${preservedFixtureFingerprintExpression}
  INTO final_preserved_fingerprint;
  IF final_preserved_fingerprint IS DISTINCT FROM '${PRESERVED_FIXTURE_FINGERPRINT}' THEN
    RAISE EXCEPTION 'Correction changed protected academic fixture values';
  END IF;
END
$academic_curriculum_correction$;

COMMIT;
`;
}

function main() {
  validateModel();
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
      'Generated guarded academic curriculum correction SQL.',
      `Output: ${outputPath}`,
      'The artifact contains one transaction and no passport-derived values.',
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
    `Academic curriculum correction generation failed: ${message}\n`,
  );
  process.exitCode = 1;
}
