-- Replace four synthetic free-elective result references with approved,
-- credit-compatible VMES Computer Science Major Elective Group 2 courses.
-- Only academic.course_result.course_id and the four obsolete course rows may
-- change. Exact corrected-state reruns validate without persistent mutation.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

select pg_advisory_xact_lock(
  hashtextextended('au_wallet_remove_synthetic_free_electives_v1', 0)
);

create temporary table free_elective_course_mapping (
  old_code text primary key,
  old_title text not null,
  new_code text not null unique,
  new_title text not null
) on commit drop;

insert into free_elective_course_mapping (
  old_code,
  old_title,
  new_code,
  new_title
)
values
  (
    'SYN-FE1001',
    'Intercultural Communication',
    'ITX2004',
    'UI/UX Design and Prototyping'
  ),
  (
    'SYN-FE1002',
    'Creative Problem Solving',
    'ITX3003',
    'Business Systems'
  ),
  ('SYN-FE1003', 'Personal Finance Fundamentals', 'ITX4502', 'Tech Startup'),
  (
    'SYN-FE1004',
    'Community Innovation Workshop',
    'ITX4518',
    'Blockchain and Digital Currencies'
  );

create temporary table free_elective_correction_state (
  state_name text primary key check (state_name in ('A', 'B'))
) on commit drop;

do $preflight$
declare
  v_state_a boolean;
  v_state_b boolean;
begin
  if to_regclass('academic.program') is null
    or to_regclass('academic.student') is null
    or to_regclass('academic.student_program_enrollment') is null
    or to_regclass('academic.course') is null
    or to_regclass('academic.academic_term') is null
    or to_regclass('academic.course_result') is null
    or to_regclass('academic.transcript') is null
    or to_regclass('academic.graduation_record') is null
  then
    raise exception
      'Free-elective correction preflight failed: required academic table missing';
  end if;

  select
    (select count(*) from academic.program) = 8
    and (select count(*) from academic.student) = 20
    and (select count(*) from academic.student_program_enrollment) = 20
    and (select count(*) from academic.course) = 74
    and (select count(*) from academic.course where default_credits = 3) = 66
    and (select count(*) from academic.course where default_credits = 2) = 8
    and (select sum(default_credits) from academic.course) = 214
    and (select count(*) from academic.academic_term) = 12
    and (select count(*) from academic.course_result) = 649
    and (select count(*) from academic.transcript) = 10
    and (select count(*) from academic.graduation_record) = 10
    and (
      select count(*)
      from academic.course as course
      join academic.program as program
        on program.program_id = course.program_id
      where program.program_code = 'SYN-VMES-CS'
    ) = 74
    and not exists (
      select
        mapping.old_code,
        mapping.old_title,
        3::numeric,
        'synthetic_free_elective'::text,
        true
      from free_elective_course_mapping as mapping
      except
      select
        course.course_code,
        course.course_title,
        course.default_credits,
        course.course_category,
        course.is_active
      from academic.course as course
      join academic.program as program
        on program.program_id = course.program_id
      where program.program_code = 'SYN-VMES-CS'
        and course.course_code like 'SYN-FE%'
    )
    and not exists (
      select
        course.course_code,
        course.course_title,
        course.default_credits,
        course.course_category,
        course.is_active
      from academic.course as course
      join academic.program as program
        on program.program_id = course.program_id
      where program.program_code = 'SYN-VMES-CS'
        and course.course_code like 'SYN-FE%'
      except
      select
        mapping.old_code,
        mapping.old_title,
        3::numeric,
        'synthetic_free_elective'::text,
        true
      from free_elective_course_mapping as mapping
    )
    and not exists (
      select
        mapping.new_code,
        mapping.new_title,
        3::numeric,
        'major_elective_group_2'::text,
        true
      from free_elective_course_mapping as mapping
      except
      select
        course.course_code,
        course.course_title,
        course.default_credits,
        course.course_category,
        course.is_active
      from academic.course as course
      join academic.program as program
        on program.program_id = course.program_id
      join free_elective_course_mapping as mapping
        on mapping.new_code = course.course_code
      where program.program_code = 'SYN-VMES-CS'
    )
    and (
      select count(*)
      from academic.course_result as result
      join academic.course as course
        on course.course_id = result.course_id
      where course.course_code like 'SYN-FE%'
    ) = 40
    and not exists (
      select course.course_code
      from academic.course as course
      join academic.course_result as result
        on result.course_id = course.course_id
      where course.course_code like 'SYN-FE%'
      group by course.course_code
      having count(*) <> 10
    )
    and (
      select count(*)
      from (
        select result.enrollment_id
        from academic.course_result as result
        join academic.course as course
          on course.course_id = result.course_id
        where course.course_code like 'SYN-FE%'
        group by result.enrollment_id
        having count(*) = 4
          and count(distinct course.course_code) = 4
      ) as complete_enrollments
    ) = 10
    and not exists (
      select 1
      from academic.course_result as result
      join academic.course as course
        on course.course_id = result.course_id
      join free_elective_course_mapping as mapping
        on mapping.new_code = course.course_code
    )
    and not exists (
      select 1
      from academic.course_result as old_result
      join academic.course as old_course
        on old_course.course_id = old_result.course_id
      cross join free_elective_course_mapping as mapping
      join academic.course as replacement_course
        on replacement_course.course_code = mapping.new_code
      join academic.course_result as conflict
        on conflict.enrollment_id = old_result.enrollment_id
        and conflict.course_id = replacement_course.course_id
      where old_course.course_code like 'SYN-FE%'
    )
  into v_state_a;

  select
    (select count(*) from academic.program) = 8
    and (select count(*) from academic.student) = 20
    and (select count(*) from academic.student_program_enrollment) = 20
    and (select count(*) from academic.course) = 70
    and (select count(*) from academic.course where default_credits = 3) = 62
    and (select count(*) from academic.course where default_credits = 2) = 8
    and (select sum(default_credits) from academic.course) = 202
    and (select count(*) from academic.academic_term) = 12
    and (select count(*) from academic.course_result) = 649
    and (select count(*) from academic.transcript) = 10
    and (select count(*) from academic.graduation_record) = 10
    and not exists (
      select 1
      from academic.course
      where course_code like 'SYN-FE%'
        or course_category = 'synthetic_free_elective'
    )
    and not exists (
      select
        mapping.new_code,
        mapping.new_title,
        3::numeric,
        'major_elective_group_2'::text,
        true
      from free_elective_course_mapping as mapping
      except
      select
        course.course_code,
        course.course_title,
        course.default_credits,
        course.course_category,
        course.is_active
      from academic.course as course
      join academic.program as program
        on program.program_id = course.program_id
      join free_elective_course_mapping as mapping
        on mapping.new_code = course.course_code
      where program.program_code = 'SYN-VMES-CS'
    )
    and not exists (
      select course.course_code
      from academic.course as course
      join academic.course_result as result
        on result.course_id = course.course_id
      join free_elective_course_mapping as mapping
        on mapping.new_code = course.course_code
      group by course.course_code
      having count(*) <> 10
    )
    and (
      select count(*)
      from (
        select result.enrollment_id
        from academic.course_result as result
        join academic.course as course
          on course.course_id = result.course_id
        join free_elective_course_mapping as mapping
          on mapping.new_code = course.course_code
        group by result.enrollment_id
        having count(*) = 4
          and count(distinct course.course_code) = 4
      ) as complete_enrollments
    ) = 10
  into v_state_b;

  v_state_a := coalesce(v_state_a, false);
  v_state_b := coalesce(v_state_b, false);

  if v_state_a = v_state_b then
    raise exception
      'Free-elective correction preflight failed: ambiguous fixture state';
  elsif not v_state_a and not v_state_b then
    raise exception
      'Free-elective correction preflight failed: partial or unexpected fixture state';
  end if;

  insert into free_elective_correction_state (state_name)
  values (case when v_state_a then 'A' else 'B' end);
end
$preflight$;

create temporary table free_elective_protected_before on commit drop as
select
  (select count(*) from academic.program) as program_count,
  (select count(*) from academic.student) as student_count,
  (select count(*) from academic.student_program_enrollment) as enrollment_count,
  (select count(*) from academic.academic_term) as term_count,
  (select count(*) from academic.course_result) as result_count,
  (select count(*) from academic.transcript) as transcript_count,
  (select count(*) from academic.graduation_record) as graduation_count,
  (
    select md5(jsonb_agg(to_jsonb(program) order by program.program_id)::text)
    from academic.program as program
  ) as program_fingerprint,
  (
    select md5(jsonb_agg(to_jsonb(student) order by student.student_id)::text)
    from academic.student as student
  ) as student_fingerprint,
  (
    select md5(jsonb_agg(to_jsonb(enrollment) order by enrollment.enrollment_id)::text)
    from academic.student_program_enrollment as enrollment
  ) as enrollment_fingerprint,
  (
    select md5(jsonb_agg(to_jsonb(term) order by term.academic_term_id)::text)
    from academic.academic_term as term
  ) as term_fingerprint,
  (
    select md5(
      jsonb_agg(
        to_jsonb(result) - 'course_id'
        order by result.course_result_id
      )::text
    )
    from academic.course_result as result
  ) as result_non_course_fingerprint,
  (
    select md5(jsonb_agg(to_jsonb(transcript) order by transcript.transcript_id)::text)
    from academic.transcript as transcript
  ) as transcript_fingerprint,
  (
    select md5(
      jsonb_agg(
        to_jsonb(graduation)
        order by graduation.graduation_record_id
      )::text
    )
    from academic.graduation_record as graduation
  ) as graduation_fingerprint,
  (select sum(credits) from academic.course_result) as result_credit_total,
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
  (
    select md5(
      jsonb_agg(
        jsonb_build_object(
          'enrollment_id', calculated.enrollment_id,
          'gpa', calculated.gpa
        )
        order by calculated.enrollment_id
      )::text
    )
    from (
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
        ) as gpa
      from academic.course_result as result
      group by result.enrollment_id
    ) as calculated
  ) as calculated_gpa_fingerprint;

create temporary table free_elective_result_snapshot on commit drop as
select
  result.course_result_id,
  replacement.course_id as expected_course_id,
  to_jsonb(result) - 'course_id' as protected_values
from academic.course_result as result
join academic.course as old_course
  on old_course.course_id = result.course_id
join free_elective_course_mapping as mapping
  on mapping.old_code = old_course.course_code
join academic.course as replacement
  on replacement.course_code = mapping.new_code
join academic.program as replacement_program
  on replacement_program.program_id = replacement.program_id
where replacement_program.program_code = 'SYN-VMES-CS';

do $mutation$
declare
  v_updated_count bigint;
  v_deleted_count bigint;
begin
  if (select state_name from free_elective_correction_state) = 'A' then
    if (select count(*) from free_elective_result_snapshot) <> 40 then
      raise exception
        'Free-elective correction failed: protected result snapshot differs';
    end if;

    update academic.course_result as result
    set course_id = snapshot.expected_course_id
    from free_elective_result_snapshot as snapshot
    where snapshot.course_result_id = result.course_result_id;

    get diagnostics v_updated_count = row_count;

    if v_updated_count <> 40 then
      raise exception
        'Free-elective correction failed: expected 40 remapped results, changed %',
        v_updated_count;
    end if;

    delete from academic.course as course
    using free_elective_course_mapping as mapping
    where course.course_code = mapping.old_code;

    get diagnostics v_deleted_count = row_count;

    if v_deleted_count <> 4 then
      raise exception
        'Free-elective correction failed: expected four deleted courses, changed %',
        v_deleted_count;
    end if;
  elsif exists (select 1 from free_elective_result_snapshot) then
    raise exception
      'Free-elective correction failed: corrected state has obsolete results';
  end if;
end
$mutation$;

do $postflight$
begin
  if (select count(*) from academic.course) <> 70
    or (select count(*) from academic.course where default_credits = 3) <> 62
    or (select count(*) from academic.course where default_credits = 2) <> 8
    or (select sum(default_credits) from academic.course) <> 202
    or (select count(*) from academic.course_result) <> 649
    or (
      select count(*)
      from academic.course as course
      join academic.program as program
        on program.program_id = course.program_id
      where program.program_code = 'SYN-VMES-CS'
    ) <> 70
    or exists (
      select 1
      from academic.course
      where course_code like 'SYN-FE%'
        or course_category = 'synthetic_free_elective'
    )
    or exists (
      select mapping.new_code
      from free_elective_course_mapping as mapping
      except
      select course.course_code
      from academic.course as course
      join academic.program as program
        on program.program_id = course.program_id
      where program.program_code = 'SYN-VMES-CS'
        and course.default_credits = 3
        and course.course_category = 'major_elective_group_2'
    )
    or exists (
      select course.course_code
      from academic.course as course
      join academic.course_result as result
        on result.course_id = course.course_id
      join free_elective_course_mapping as mapping
        on mapping.new_code = course.course_code
      group by course.course_code
      having count(*) <> 10
    )
    or exists (
      select 1
      from academic.course_result
      group by enrollment_id, course_id
      having count(*) > 1
    )
  then
    raise exception
      'Free-elective correction postflight failed: corrected catalogue differs';
  end if;

  if exists (
    select 1
    from free_elective_protected_before as before
    where before.program_count <> (select count(*) from academic.program)
      or before.student_count <> (select count(*) from academic.student)
      or before.enrollment_count <>
        (select count(*) from academic.student_program_enrollment)
      or before.term_count <> (select count(*) from academic.academic_term)
      or before.result_count <> (select count(*) from academic.course_result)
      or before.transcript_count <> (select count(*) from academic.transcript)
      or before.graduation_count <>
        (select count(*) from academic.graduation_record)
      or before.program_fingerprint is distinct from (
        select md5(jsonb_agg(to_jsonb(program) order by program.program_id)::text)
        from academic.program as program
      )
      or before.student_fingerprint is distinct from (
        select md5(jsonb_agg(to_jsonb(student) order by student.student_id)::text)
        from academic.student as student
      )
      or before.enrollment_fingerprint is distinct from (
        select md5(
          jsonb_agg(to_jsonb(enrollment) order by enrollment.enrollment_id)::text
        )
        from academic.student_program_enrollment as enrollment
      )
      or before.term_fingerprint is distinct from (
        select md5(jsonb_agg(to_jsonb(term) order by term.academic_term_id)::text)
        from academic.academic_term as term
      )
      or before.result_non_course_fingerprint is distinct from (
        select md5(
          jsonb_agg(
            to_jsonb(result) - 'course_id'
            order by result.course_result_id
          )::text
        )
        from academic.course_result as result
      )
      or before.transcript_fingerprint is distinct from (
        select md5(
          jsonb_agg(to_jsonb(transcript) order by transcript.transcript_id)::text
        )
        from academic.transcript as transcript
      )
      or before.graduation_fingerprint is distinct from (
        select md5(
          jsonb_agg(
            to_jsonb(graduation)
            order by graduation.graduation_record_id
          )::text
        )
        from academic.graduation_record as graduation
      )
      or before.result_credit_total is distinct from (
        select sum(credits) from academic.course_result
      )
      or before.grade_point_total is distinct from (
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
      )
      or before.calculated_gpa_fingerprint is distinct from (
        select md5(
          jsonb_agg(
            jsonb_build_object(
              'enrollment_id', calculated.enrollment_id,
              'gpa', calculated.gpa
            )
            order by calculated.enrollment_id
          )::text
        )
        from (
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
                sum(result.credits)
                  filter (where result.result_type = 'normal'),
                0
              ),
              2
            ) as gpa
          from academic.course_result as result
          group by result.enrollment_id
        ) as calculated
      )
  ) then
    raise exception
      'Free-elective correction postflight failed: protected academic data changed';
  end if;

  if exists (
    select 1
    from free_elective_result_snapshot as snapshot
    join academic.course_result as result
      on result.course_result_id = snapshot.course_result_id
    where result.course_id <> snapshot.expected_course_id
      or to_jsonb(result) - 'course_id' is distinct from snapshot.protected_values
  ) or (
    select count(*)
    from free_elective_result_snapshot as snapshot
    join academic.course_result as result
      on result.course_result_id = snapshot.course_result_id
  ) <> (select count(*) from free_elective_result_snapshot)
  then
    raise exception
      'Free-elective correction postflight failed: remapped result differs';
  end if;

  if (
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
      on result_totals.enrollment_id = graduation.enrollment_id
    where graduation.total_credits_earned = 132
      and result_totals.earned_credits = 132
  ) <> 10
  then
    raise exception
      'Free-elective correction postflight failed: completed histories differ';
  end if;
end
$postflight$;

commit;
