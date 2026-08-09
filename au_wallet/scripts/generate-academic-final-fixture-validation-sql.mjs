import { chmodSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const EXPECTED_OUTPUT = resolve(
  '/tmp/au-wallet-academic-final-fixture-validation.sql',
);

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
      'Provide exactly /tmp/au-wallet-academic-final-fixture-validation.sql; add --force only to allow replacement',
    );
  }

  const outputPath = resolve(positional[0]);
  if (outputPath !== EXPECTED_OUTPUT) {
    fail(
      'Output path must be /tmp/au-wallet-academic-final-fixture-validation.sql',
    );
  }
  if (!force && existsSync(outputPath)) {
    fail('Output file already exists; pass --force to replace it');
  }

  return { force, outputPath };
}

function buildSql() {
  return `-- Read-only aggregate validator for the final eight-program academic fixture.
-- This query returns counts and booleans only. It never returns student identity,
-- passport-derived values, grades, transcripts, or other protected row values.

begin transaction read only;

with expected_programs(
  faculty_code,
  faculty_name,
  program_code,
  degree_level,
  degree_name,
  major,
  major_concentration,
  required_credits,
  is_active
) as (
  values
    (
      'VMES'::text,
      'Vincent Mary School of Engineering, Science and Technology'::text,
      'SYN-VMES-AIT'::text,
      'bachelor'::text,
      'Bachelor of Science'::text,
      'Applied Informatics'::text,
      'Information Technology'::text,
      126::numeric,
      true
    ),
    ('VMES', 'Vincent Mary School of Engineering, Science and Technology',
      'SYN-VMES-AME', 'bachelor', 'Bachelor of Engineering',
      'Aircraft Maintenance Engineering', null, 141, true),
    ('VMES', 'Vincent Mary School of Engineering, Science and Technology',
      'SYN-VMES-CE', 'bachelor', 'Bachelor of Engineering',
      'Computer Engineering', null, 140, true),
    ('VMES', 'Vincent Mary School of Engineering, Science and Technology',
      'SYN-VMES-CPL', 'bachelor', 'Bachelor of Engineering',
      'Commercial Pilot License', null, 141, true),
    ('VMES', 'Vincent Mary School of Engineering, Science and Technology',
      'SYN-VMES-CS', 'bachelor', 'Bachelor of Science',
      'Computer Science', null, 132, true),
    ('VMES', 'Vincent Mary School of Engineering, Science and Technology',
      'SYN-VMES-EE', 'bachelor', 'Bachelor of Engineering',
      'Electrical Engineering', null, 140, true),
    ('VMES', 'Vincent Mary School of Engineering, Science and Technology',
      'SYN-VMES-MCE-AI', 'bachelor', 'Bachelor of Engineering',
      'Mechatronics Engineering and Artificial Intelligence', null, 136, true),
    ('VMES', 'Vincent Mary School of Engineering, Science and Technology',
      'SYN-VMES-NEA', 'bachelor', 'Bachelor of Engineering',
      'New Energy Automotive Engineering', null, 126, true)
),
metrics as (
  select
    (select count(*) from academic.program) as program_count,
    (select count(*) from academic.student) as student_count,
    (select count(*) from academic.student_program_enrollment)
      as enrollment_count,
    (
      select count(*)
      from academic.student_program_enrollment as enrollment
      join academic.program as program
        on program.program_id = enrollment.program_id
      where program.program_code = 'SYN-VMES-CS'
    ) as cs_enrollment_count,
    (
      select count(*)
      from academic.student_program_enrollment as enrollment
      join academic.program as program
        on program.program_id = enrollment.program_id
      where program.program_code <> 'SYN-VMES-CS'
    ) as catalogue_only_enrollment_count,
    (select count(*) from academic.course) as course_count,
    (
      select count(*)
      from academic.course as course
      join academic.program as program
        on program.program_id = course.program_id
      where program.program_code = 'SYN-VMES-CS'
    ) as cs_course_count,
    (
      select count(*)
      from academic.course as course
      join academic.program as program
        on program.program_id = course.program_id
      where program.program_code <> 'SYN-VMES-CS'
    ) as catalogue_only_course_count,
    (select count(*) from academic.academic_term) as term_count,
    (select count(*) from academic.course_result) as result_count,
    (select count(*) from academic.transcript) as transcript_count,
    (select count(*) from academic.graduation_record) as graduation_count,
    (
      select count(*)
      from academic.student
      where personal_email is not null
    ) as personal_email_non_null_count,
    not exists (
      select * from expected_programs
      except
      select
        faculty_code,
        faculty_name,
        program_code,
        degree_level,
        degree_name,
        major,
        major_concentration,
        required_credits,
        is_active
      from academic.program
    ) and not exists (
      select
        faculty_code,
        faculty_name,
        program_code,
        degree_level,
        degree_name,
        major,
        major_concentration,
        required_credits,
        is_active
      from academic.program
      except
      select * from expected_programs
    ) as program_catalogue_matches
)
select
  program_catalogue_matches
    and program_count = 8
    and student_count = 20
    and enrollment_count = 20
    and cs_enrollment_count = 20
    and catalogue_only_enrollment_count = 0
    and course_count = 74
    and cs_course_count = 74
    and catalogue_only_course_count = 0
    and term_count = 12
    and result_count = 649
    and transcript_count = 10
    and graduation_count = 10
    and personal_email_non_null_count = 0 as all_checks_pass,
  program_catalogue_matches,
  program_count,
  student_count,
  enrollment_count,
  cs_enrollment_count,
  catalogue_only_enrollment_count,
  course_count,
  cs_course_count,
  catalogue_only_course_count,
  term_count,
  result_count,
  transcript_count,
  graduation_count,
  personal_email_non_null_count
from metrics;

commit;
`;
}

function main() {
  const { force, outputPath } = parseArguments(process.argv.slice(2));
  writeFileSync(outputPath, buildSql(), {
    encoding: 'utf8',
    flag: force ? 'w' : 'wx',
    mode: 0o600,
  });
  chmodSync(outputPath, 0o600);

  process.stdout.write(
    [
      'Generated read-only final academic fixture validation SQL.',
      `Output: ${outputPath}`,
      'Run it read-only and require all_checks_pass=true.',
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
    `Academic final-fixture validator generation failed: ${message}\n`,
  );
  process.exitCode = 1;
}
