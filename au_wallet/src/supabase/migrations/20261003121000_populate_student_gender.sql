update academic.student
set gender = case
  when lower(rtrim(btrim(title), '.')) = 'mr' then 'male'
  when lower(rtrim(btrim(title), '.')) in ('mrs', 'ms') then 'female'
end
where lower(rtrim(btrim(title), '.')) in ('mr', 'mrs', 'ms')
  and gender is distinct from case
    when lower(rtrim(btrim(title), '.')) = 'mr' then 'male'
    when lower(rtrim(btrim(title), '.')) in ('mrs', 'ms') then 'female'
  end;
