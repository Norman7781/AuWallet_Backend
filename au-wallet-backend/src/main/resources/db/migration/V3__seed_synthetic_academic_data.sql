-- Synthetic data only, for local development and end-to-end testing of the
-- matching flow. Never seed a real student's real passport number.
--
-- This student's passport HMAC below was computed for raw passport
-- "P1234567" using the DEFAULT local dev HMAC secret
-- ("changeme-local-dev-secret-do-not-use-in-prod"). If you override
-- PASSPORT_HMAC_SECRET, this seed row will no longer match - recompute it
-- (see README "Local smoke test") or just create your own synthetic
-- students once you have a real secret set.

insert into academic.program
    (faculty_code, faculty_name, program_code, degree_level, degree_name, major, required_credits, is_active)
values
    ('SCI', 'Faculty of Science and Technology', 'CS-BSC', 'bachelor', 'Bachelor of Science', 'Computer Science', 132, true);

insert into academic.student
    (admission_no, title, first_name, middle_name, last_name, date_of_birth, university_email, personal_email, passport_number_hmac)
values
    ('6611201', 'Mr.', 'Aung Kaung', 'Myat', 'Aung', '2003-05-14',
     'aungkaungmyat.stu@au.edu', 'aungkaungmyat@example.com',
     '7fda3c6dd9f936cb45e8786aaa330702ffc9c8c0f910dd4f83dc35c1fee85724');

insert into academic.student_program_enrollment
    (student_id, program_id, admission_date, academic_status)
select s.student_id, p.program_id, date '2022-08-15', 'studying'
from academic.student s, academic.program p
where s.admission_no = '6611201' and p.program_code = 'CS-BSC';
