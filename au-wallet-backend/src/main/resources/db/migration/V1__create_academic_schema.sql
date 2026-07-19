-- Mock VMES Academic Database
-- Source of truth for programs, students, enrollments, courses, results,
-- transcripts, and graduation records. The wallet application only ever
-- READS from this schema.

create schema if not exists academic;

create table academic.program (
    program_id          bigint generated always as identity primary key,
    faculty_code        text not null,
    faculty_name        text not null,
    program_code        text not null unique,
    degree_level        text not null,
    degree_name         text not null,
    major               text not null,
    major_concentration text,
    required_credits    numeric(6,2) not null check (required_credits >= 0),
    is_active           boolean not null default true
);

create table academic.student (
    student_id            bigint generated always as identity primary key,
    admission_no          text not null unique,
    title                 text not null,
    first_name            text not null,
    middle_name           text,
    last_name             text not null,
    date_of_birth         date not null,
    university_email      text not null unique,
    personal_email        text,
    passport_number_hmac  text not null,
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now()
);

create table academic.student_program_enrollment (
    enrollment_id              bigint generated always as identity primary key,
    student_id                 bigint not null references academic.student(student_id),
    program_id                 bigint not null references academic.program(program_id),
    admission_date              date not null,
    academic_status            text not null check (academic_status in
        ('studying','graduated','alumni','withdrawn','suspended')),
    previous_institution_name  text,
    created_at                 timestamptz not null default now(),
    updated_at                 timestamptz not null default now()
);

create table academic.course (
    course_id        bigint generated always as identity primary key,
    program_id       bigint not null references academic.program(program_id),
    course_code      text not null,
    course_title     text not null,
    default_credits  numeric(5,2) not null check (default_credits >= 0),
    course_category  text,
    is_active        boolean not null default true,
    unique (program_id, course_code)
);

create table academic.academic_term (
    academic_term_id  bigint generated always as identity primary key,
    term_code         text not null unique,
    academic_year     integer not null,
    semester_no       integer not null,
    term_label        text not null
);

create table academic.course_result (
    course_result_id  bigint generated always as identity primary key,
    enrollment_id     bigint not null references academic.student_program_enrollment(enrollment_id),
    academic_term_id  bigint references academic.academic_term(academic_term_id),
    course_id         bigint not null references academic.course(course_id),
    credits           numeric(5,2) not null check (credits >= 0),
    grade             text not null,
    result_type       text not null check (result_type in ('normal','transfer','seminar','pass_fail')),
    constraint course_result_term_required_unless_transfer
        check (result_type = 'transfer' or academic_term_id is not null)
);

create table academic.transcript (
    transcript_id             bigint generated always as identity primary key,
    enrollment_id             bigint not null unique references academic.student_program_enrollment(enrollment_id),
    document_number           text unique,
    verification_code         text unique,
    issued_on                 date,
    is_certified_true_copy    boolean not null default false,
    document_status           text not null default 'draft' check (document_status in ('draft','issued','revoked')),
    registrar_name             text,
    created_at                timestamptz not null default now()
);

create table academic.graduation_record (
    graduation_record_id       bigint generated always as identity primary key,
    enrollment_id               bigint not null unique references academic.student_program_enrollment(enrollment_id),
    graduation_date              date,
    total_credits_completed     numeric(6,2) not null default 0,
    total_credits_transferred   numeric(6,2) not null default 0,
    total_credits_earned         numeric(6,2) not null default 0,
    cumulative_gpa                numeric(3,2) check (cumulative_gpa between 0 and 4),
    award                         text,
    requirements_fulfilled       boolean not null default false,
    graduation_status             text not null default 'pending' check (graduation_status in ('pending','completed','rescinded')),
    approved_at                   timestamptz
);

create index idx_student_program_enrollment_student_id on academic.student_program_enrollment(student_id);
create index idx_student_program_enrollment_program_id on academic.student_program_enrollment(program_id);
create index idx_course_result_enrollment_id on academic.course_result(enrollment_id);
create index idx_course_program_id on academic.course(program_id);
