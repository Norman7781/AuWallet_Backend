-- Add catalogue metadata for the eight approved VMES undergraduate areas.
-- This migration does not invent curricula, create courses, or reassign any
-- existing student, enrollment, result, transcript, or graduation record.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

select pg_advisory_xact_lock(
  hashtextextended('au_wallet_vmes_undergraduate_catalogue_v1', 0)
);

create temporary table expected_vmes_program_catalogue (
  faculty_code text not null,
  faculty_name text not null,
  program_code text not null primary key,
  degree_level text not null,
  degree_name text not null,
  major text not null,
  major_concentration text,
  required_credits numeric not null,
  is_active boolean not null
) on commit drop;

insert into expected_vmes_program_catalogue (
  faculty_code,
  faculty_name,
  program_code,
  degree_level,
  degree_name,
  major,
  major_concentration,
  required_credits,
  is_active
)
values
  (
    'VMES',
    'Vincent Mary School of Engineering, Science and Technology',
    'SYN-VMES-AIT',
    'bachelor',
    'Bachelor of Science',
    'Applied Informatics',
    'Information Technology',
    126,
    true
  ),
  (
    'VMES',
    'Vincent Mary School of Engineering, Science and Technology',
    'SYN-VMES-AME',
    'bachelor',
    'Bachelor of Engineering',
    'Aircraft Maintenance Engineering',
    null,
    141,
    true
  ),
  (
    'VMES',
    'Vincent Mary School of Engineering, Science and Technology',
    'SYN-VMES-CE',
    'bachelor',
    'Bachelor of Engineering',
    'Computer Engineering',
    null,
    140,
    true
  ),
  (
    'VMES',
    'Vincent Mary School of Engineering, Science and Technology',
    'SYN-VMES-CPL',
    'bachelor',
    'Bachelor of Engineering',
    'Commercial Pilot License',
    null,
    141,
    true
  ),
  (
    'VMES',
    'Vincent Mary School of Engineering, Science and Technology',
    'SYN-VMES-CS',
    'bachelor',
    'Bachelor of Science',
    'Computer Science',
    null,
    132,
    true
  ),
  (
    'VMES',
    'Vincent Mary School of Engineering, Science and Technology',
    'SYN-VMES-EE',
    'bachelor',
    'Bachelor of Engineering',
    'Electrical Engineering',
    null,
    140,
    true
  ),
  (
    'VMES',
    'Vincent Mary School of Engineering, Science and Technology',
    'SYN-VMES-MCE-AI',
    'bachelor',
    'Bachelor of Engineering',
    'Mechatronics Engineering and Artificial Intelligence',
    null,
    136,
    true
  ),
  (
    'VMES',
    'Vincent Mary School of Engineering, Science and Technology',
    'SYN-VMES-NEA',
    'bachelor',
    'Bachelor of Engineering',
    'New Energy Automotive Engineering',
    null,
    126,
    true
  );

create temporary table vmes_catalogue_preflight_counts on commit drop as
select
  (select count(*) from academic.student) as student_count,
  (select count(*) from academic.student_program_enrollment) as enrollment_count,
  (select count(*) from academic.course) as course_count,
  (select count(*) from academic.academic_term) as term_count,
  (select count(*) from academic.course_result) as result_count,
  (select count(*) from academic.transcript) as transcript_count,
  (select count(*) from academic.graduation_record) as graduation_count;

do $preflight$
declare
  v_program_count bigint;
  v_expected_match_count bigint;
begin
  if to_regclass('academic.program') is null
    or to_regclass('academic.student_program_enrollment') is null
    or to_regclass('academic.course') is null
    or to_regclass('academic.course_result') is null
  then
    raise exception
      'VMES catalogue preflight failed: a required academic table is missing';
  end if;

  select count(*) into v_program_count from academic.program;

  select count(*)
  into v_expected_match_count
  from academic.program as actual
  join expected_vmes_program_catalogue as expected
    using (program_code)
  where row(
    actual.faculty_code,
    actual.faculty_name,
    actual.degree_level,
    actual.degree_name,
    actual.major,
    actual.major_concentration,
    actual.required_credits,
    actual.is_active
  ) is not distinct from row(
    expected.faculty_code,
    expected.faculty_name,
    expected.degree_level,
    expected.degree_name,
    expected.major,
    expected.major_concentration,
    expected.required_credits,
    expected.is_active
  );

  if not (
    (v_program_count = 8 and v_expected_match_count = 8)
    or (
      v_program_count = 1
      and v_expected_match_count = 1
      and exists (
        select 1
        from academic.program
        where program_code = 'SYN-VMES-CS'
      )
    )
  )
  then
    raise exception
      'VMES catalogue preflight failed: catalogue is partial or conflicting';
  end if;

  if (select student_count from vmes_catalogue_preflight_counts) <> 20
    or (select enrollment_count from vmes_catalogue_preflight_counts) <> 20
    or (select course_count from vmes_catalogue_preflight_counts) <> 74
    or (select term_count from vmes_catalogue_preflight_counts) <> 12
    or (select result_count from vmes_catalogue_preflight_counts) <> 649
    or (select transcript_count from vmes_catalogue_preflight_counts) <> 10
    or (select graduation_count from vmes_catalogue_preflight_counts) <> 10
  then
    raise exception
      'VMES catalogue preflight failed: academic fixture counts differ';
  end if;

  if (
    select count(*)
    from academic.student_program_enrollment as enrollment
    join academic.program as program
      on program.program_id = enrollment.program_id
    where program.program_code = 'SYN-VMES-CS'
  ) <> 20
    or (
      select count(*)
      from academic.course as course
      join academic.program as program
        on program.program_id = course.program_id
      where program.program_code = 'SYN-VMES-CS'
    ) <> 74
  then
    raise exception
      'VMES catalogue preflight failed: CS fixture ownership differs';
  end if;
end
$preflight$;

insert into academic.program (
  faculty_code,
  faculty_name,
  program_code,
  degree_level,
  degree_name,
  major,
  major_concentration,
  required_credits,
  is_active
)
select
  expected.faculty_code,
  expected.faculty_name,
  expected.program_code,
  expected.degree_level,
  expected.degree_name,
  expected.major,
  expected.major_concentration,
  expected.required_credits,
  expected.is_active
from expected_vmes_program_catalogue as expected
where expected.program_code <> 'SYN-VMES-CS'
  and not exists (
    select 1
    from academic.program as actual
    where actual.program_code = expected.program_code
  );

do $postflight$
begin
  if (select count(*) from academic.program) <> 8
    or exists (
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
      from expected_vmes_program_catalogue
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
    )
    or exists (
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
      from expected_vmes_program_catalogue
    )
  then
    raise exception
      'VMES catalogue postflight failed: catalogue rows differ';
  end if;

  if exists (
    select 1
    from vmes_catalogue_preflight_counts as before
    where before.student_count <> (select count(*) from academic.student)
      or before.enrollment_count <>
        (select count(*) from academic.student_program_enrollment)
      or before.course_count <> (select count(*) from academic.course)
      or before.term_count <> (select count(*) from academic.academic_term)
      or before.result_count <> (select count(*) from academic.course_result)
      or before.transcript_count <> (select count(*) from academic.transcript)
      or before.graduation_count <>
        (select count(*) from academic.graduation_record)
  ) then
    raise exception
      'VMES catalogue postflight failed: academic fixture rows changed';
  end if;

  if exists (
    select 1
    from academic.student_program_enrollment as enrollment
    join academic.program as program
      on program.program_id = enrollment.program_id
    where program.program_code <> 'SYN-VMES-CS'
  ) or exists (
    select 1
    from academic.course as course
    join academic.program as program
      on program.program_id = course.program_id
    where program.program_code <> 'SYN-VMES-CS'
  ) then
    raise exception
      'VMES catalogue postflight failed: CS fixture ownership changed';
  end if;
end
$postflight$;

commit;
