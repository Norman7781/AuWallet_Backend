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
expected_replacements(course_code) as (
  values
    ('ITX2004'::text),
    ('ITX3003'::text),
    ('ITX4502'::text),
    ('ITX4518'::text)
),
calculated_gpa as (
  select
    result.enrollment_id,
    round(
      sum(
        result.credits * case result.grade
          when 'A' then 4.00
          when 'A-' then 3.75
          when 'B+' then 3.25
          when 'B' then 3.00
          when 'B-' then 2.75
          when 'C+' then 2.25
          when 'C' then 2.00
          else null
        end
      ) filter (where result.result_type = 'normal')
      /
      nullif(
        sum(result.credits) filter (where result.result_type = 'normal'),
        0
      ),
      2
    ) as cumulative_gpa
  from academic.course_result as result
  group by result.enrollment_id
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
    (
      select count(*)
      from academic.course
      where default_credits = 3
    ) as three_credit_course_count,
    (
      select count(*)
      from academic.course
      where default_credits = 2
    ) as two_credit_course_count,
    (select sum(default_credits) from academic.course)
      as catalogue_credit_total,
    (
      select count(*)
      from academic.course
      where course_code like 'SYN-FE%'
    ) as synthetic_free_elective_code_count,
    (
      select count(*)
      from academic.course
      where course_category = 'synthetic_free_elective'
    ) as synthetic_free_elective_category_count,
    (
      select count(*)
      from academic.course as course
      join academic.program as program
        on program.program_id = course.program_id
      join expected_replacements as expected
        using (course_code)
      where program.program_code = 'SYN-VMES-CS'
        and course.default_credits = 3
        and course.course_category = 'major_elective_group_2'
    ) as replacement_course_count,
    (
      select count(*)
      from academic.course_result as result
      join academic.course as course
        on course.course_id = result.course_id
      join expected_replacements as expected
        using (course_code)
    ) as replacement_result_count,
    not exists (
      select course.course_code
      from academic.course_result as result
      join academic.course as course
        on course.course_id = result.course_id
      join expected_replacements as expected
        using (course_code)
      group by course.course_code
      having count(*) <> 10
    ) as replacement_result_counts_match,
    (
      select count(*)
      from (
        select result.enrollment_id
        from academic.course_result as result
        join academic.course as course
          on course.course_id = result.course_id
        join expected_replacements as expected
          using (course_code)
        group by result.enrollment_id
        having count(*) = 4
          and count(distinct course.course_code) = 4
      ) as complete_replacement_sets
    ) as replacement_enrollment_count,
    (select count(*) from academic.academic_term) as term_count,
    (select count(*) from academic.course_result) as result_count,
    (
      select count(*)
      from (
        select enrollment_id, course_id
        from academic.course_result
        group by enrollment_id, course_id
        having count(*) > 1
      ) as duplicates
    ) as duplicate_enrollment_course_count,
    (select sum(credits) from academic.course_result) as result_credit_total,
    (
      select sum(credits)
      from academic.course_result
      where result_type = 'normal'
    ) as normal_credit_total,
    (
      select sum(credits)
      from academic.course_result
      where result_type = 'transfer'
    ) as transfer_credit_total,
    (
      select sum(
        credits * case grade
          when 'A' then 4.00
          when 'A-' then 3.75
          when 'B+' then 3.25
          when 'B' then 3.00
          when 'B-' then 2.75
          when 'C+' then 2.25
          when 'C' then 2.00
          else 0
        end
      )
      from academic.course_result
      where result_type = 'normal'
    ) as grade_point_total,
    (select count(*) from academic.transcript) as transcript_count,
    (select count(*) from academic.graduation_record) as graduation_count,
    (
      select sum(total_credits_completed)
      from academic.graduation_record
    ) as graduation_completed_credit_total,
    (
      select sum(total_credits_transferred)
      from academic.graduation_record
    ) as graduation_transferred_credit_total,
    (
      select sum(total_credits_earned)
      from academic.graduation_record
    ) as graduation_earned_credit_total,
    (
      select count(*)
      from academic.graduation_record as graduation
      join calculated_gpa as calculated
        using (enrollment_id)
      where graduation.cumulative_gpa is not distinct from
        calculated.cumulative_gpa
    ) as stored_gpa_match_count,
    (
      select count(*)
      from academic.graduation_record as graduation
      join (
        select
          enrollment_id,
          coalesce(
            sum(credits) filter (where result_type = 'normal'),
            0
          ) + coalesce(
            sum(credits) filter (where result_type = 'transfer'),
            0
          ) as earned_credits
        from academic.course_result
        group by enrollment_id
      ) as result_totals
        using (enrollment_id)
      where graduation.total_credits_earned = 132
        and result_totals.earned_credits = 132
    ) as completed_history_reconciliation_count,
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
    and course_count = 70
    and cs_course_count = 70
    and catalogue_only_course_count = 0
    and three_credit_course_count = 62
    and two_credit_course_count = 8
    and catalogue_credit_total = 202
    and synthetic_free_elective_code_count = 0
    and synthetic_free_elective_category_count = 0
    and replacement_course_count = 4
    and replacement_result_count = 40
    and replacement_result_counts_match
    and replacement_enrollment_count = 10
    and term_count = 12
    and result_count = 649
    and duplicate_enrollment_course_count = 0
    and result_credit_total = 1839
    and normal_credit_total = 1785
    and transfer_credit_total = 54
    and grade_point_total = 6060.75
    and transcript_count = 10
    and graduation_count = 10
    and graduation_completed_credit_total = 1266
    and graduation_transferred_credit_total = 54
    and graduation_earned_credit_total = 1320
    and stored_gpa_match_count = 10
    and completed_history_reconciliation_count = 10
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
  three_credit_course_count,
  two_credit_course_count,
  catalogue_credit_total,
  synthetic_free_elective_code_count,
  synthetic_free_elective_category_count,
  replacement_course_count,
  replacement_result_count,
  replacement_result_counts_match,
  replacement_enrollment_count,
  term_count,
  result_count,
  duplicate_enrollment_course_count,
  result_credit_total,
  normal_credit_total,
  transfer_credit_total,
  grade_point_total,
  transcript_count,
  graduation_count,
  graduation_completed_credit_total,
  graduation_transferred_credit_total,
  graduation_earned_credit_total,
  stored_gpa_match_count,
  completed_history_reconciliation_count,
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
