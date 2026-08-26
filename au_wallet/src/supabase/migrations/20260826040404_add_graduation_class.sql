-- Graduation class is the commencement cohort, distinct from the exact
-- academic graduation date. The existing fixture dates model the January
-- 2025 and January 2026 commencement cohorts as Classes 52 and 53.
alter table academic.graduation_record
  add column if not exists graduation_class integer;

alter table academic.graduation_record
  drop constraint if exists graduation_record_graduation_class_positive;

alter table academic.graduation_record
  add constraint graduation_record_graduation_class_positive
  check (graduation_class is null or graduation_class > 0);

update academic.graduation_record
set graduation_class = case graduation_date
  when date '2025-01-18' then 52
  when date '2026-01-17' then 53
  else graduation_class
end
where graduation_class is null
  and graduation_date in (date '2025-01-18', date '2026-01-17');

create index if not exists graduation_record_graduation_class_idx
  on academic.graduation_record (graduation_class)
  where graduation_class is not null;

comment on column academic.graduation_record.graduation_class is
  'Registrar commencement cohort number. Do not derive this value from graduation_date.';
