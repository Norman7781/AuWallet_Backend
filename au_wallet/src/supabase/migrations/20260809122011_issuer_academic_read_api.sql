begin;

-- The issuer portal calls NestJS only. These grants expand the trusted
-- backend's read boundary just enough to build a pre-issuance academic
-- preview. Browser roles remain unable to query application tables.
do $preflight$
begin
  if to_regclass('academic.academic_term') is null
    or to_regclass('academic.course') is null
    or to_regclass('academic.course_result') is null
  then
    raise exception
      'Issuer academic read API preflight failed: required tables are absent';
  end if;

  if not has_schema_privilege('service_role', 'academic', 'usage')
    or not has_table_privilege(
      'service_role',
      'academic.student',
      'select'
    )
    or not has_table_privilege(
      'service_role',
      'academic.student_program_enrollment',
      'select'
    )
    or not has_table_privilege(
      'service_role',
      'academic.program',
      'select'
    )
  then
    raise exception
      'Issuer academic read API preflight failed: backend base grants differ';
  end if;

  if has_table_privilege(
      'service_role',
      'academic.academic_term',
      'select'
    )
    or has_table_privilege('service_role', 'academic.course', 'select')
    or has_table_privilege(
      'service_role',
      'academic.course_result',
      'select'
    )
  then
    raise exception
      'Issuer academic read API preflight failed: read grants already exist';
  end if;
end
$preflight$;

grant select on table
  academic.academic_term,
  academic.course,
  academic.course_result
to service_role;

revoke all on table
  academic.academic_term,
  academic.course,
  academic.course_result
from anon, authenticated;

do $postflight$
declare
  table_name text;
  role_name text;
begin
  foreach table_name in array array[
    'academic.academic_term',
    'academic.course',
    'academic.course_result'
  ]
  loop
    if not has_table_privilege('service_role', table_name, 'select')
      or has_table_privilege('service_role', table_name, 'insert')
      or has_table_privilege('service_role', table_name, 'update')
      or has_table_privilege('service_role', table_name, 'delete')
    then
      raise exception
        'Issuer academic read API postflight failed for backend table %',
        table_name;
    end if;

    foreach role_name in array array['anon', 'authenticated']
    loop
      if has_table_privilege(role_name, table_name, 'select')
        or has_table_privilege(role_name, table_name, 'insert')
        or has_table_privilege(role_name, table_name, 'update')
        or has_table_privilege(role_name, table_name, 'delete')
      then
        raise exception
          'Issuer academic read API postflight failed for browser role % on %',
          role_name,
          table_name;
      end if;
    end loop;
  end loop;
end
$postflight$;

commit;
