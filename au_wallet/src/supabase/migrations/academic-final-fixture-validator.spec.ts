import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repositoryRoot = join(__dirname, '../../..');
const validator = readFileSync(
  join(
    repositoryRoot,
    'scripts/generate-academic-final-fixture-validation-sql.mjs',
  ),
  'utf8',
);
const curriculumFixture = readFileSync(
  join(repositoryRoot, 'scripts/academic-curriculum-fixture.mjs'),
  'utf8',
);
const packageJson = JSON.parse(
  readFileSync(join(repositoryRoot, 'package.json'), 'utf8'),
) as { scripts: Record<string, string> };

const historicalGenerators = [
  'generate-academic-seed-sql.mjs',
  'generate-academic-student-expansion-sql.mjs',
  'generate-academic-curriculum-correction-sql.mjs',
  'generate-academic-personal-email-removal-sql.mjs',
  'generate-academic-university-email-sql.mjs',
];

describe('final academic fixture validator', () => {
  it('retires every one-program generator behind an explicit historical command', () => {
    for (const generator of historicalGenerators) {
      const source = readFileSync(
        join(repositoryRoot, 'scripts', generator),
        'utf8',
      );
      expect(source).toContain('HISTORICAL ONE-TIME GENERATOR');
      expect(source).toContain('academic:validate-final:generate');
    }

    expect(
      Object.keys(packageJson.scripts).filter((name) =>
        name.startsWith('seed:academic:'),
      ),
    ).toEqual([]);
    expect(packageJson.scripts).toHaveProperty(
      'academic:validate-final:generate',
    );
  });

  it('generates an aggregate-only read-only transaction', () => {
    expect(validator).toContain('begin transaction read only;');
    expect(validator).toContain('all_checks_pass');
    expect(validator).toContain('commit;');
    expect(validator).not.toMatch(
      /(?:insert into|update|delete from|truncate|alter table|create table) academic\./i,
    );
    expect(validator).not.toMatch(
      /select[\s\S]{0,80}(?:admission_no|date_of_birth|passport_number_hmac)/i,
    );
  });

  it('checks the exact final catalogue and CS-only fixture ownership', () => {
    const expectedCodes = [
      'SYN-VMES-AIT',
      'SYN-VMES-AME',
      'SYN-VMES-CE',
      'SYN-VMES-CPL',
      'SYN-VMES-CS',
      'SYN-VMES-EE',
      'SYN-VMES-MCE-AI',
      'SYN-VMES-NEA',
    ];

    for (const code of expectedCodes) {
      expect(validator).toContain(`'${code}'`);
    }

    for (const assertion of [
      'program_count = 8',
      'student_count = 20',
      'enrollment_count = 20',
      'cs_enrollment_count = 20',
      'catalogue_only_enrollment_count = 0',
      'course_count = 70',
      'cs_course_count = 70',
      'catalogue_only_course_count = 0',
      'three_credit_course_count = 62',
      'two_credit_course_count = 8',
      'catalogue_credit_total = 202',
      'synthetic_free_elective_code_count = 0',
      'synthetic_free_elective_category_count = 0',
      'replacement_course_count = 4',
      'replacement_result_count = 40',
      'replacement_enrollment_count = 10',
      'term_count = 12',
      'result_count = 649',
      'duplicate_enrollment_course_count = 0',
      'result_credit_total = 1839',
      'normal_credit_total = 1785',
      'transfer_credit_total = 54',
      'grade_point_total = 6060.75',
      'transcript_count = 10',
      'graduation_count = 10',
      'graduation_completed_credit_total = 1266',
      'graduation_transferred_credit_total = 54',
      'graduation_earned_credit_total = 1320',
      'stored_gpa_match_count = 10',
      'completed_history_reconciliation_count = 10',
      'personal_email_non_null_count = 0',
    ]) {
      expect(validator).toContain(assertion);
    }
  });

  it('uses only the four approved replacement courses in corrected paths', () => {
    for (const courseCode of ['ITX2004', 'ITX3003', 'ITX4502', 'ITX4518']) {
      expect(curriculumFixture).toContain(`'${courseCode}'`);
      expect(validator).toContain(`'${courseCode}'`);
    }

    expect(curriculumFixture).toContain('COURSES.length !== 70');
    expect(curriculumFixture).toContain('threeCredit !== 62');
    expect(curriculumFixture).toContain('catalogCredits !== 202');
    expect(curriculumFixture).not.toMatch(/\['SYN-FE\d+/);
    expect(curriculumFixture).not.toContain(
      "const FREE_ELECTIVE = 'synthetic_free_elective'",
    );
  });
});
