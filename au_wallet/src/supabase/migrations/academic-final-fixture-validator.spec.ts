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
      'course_count = 74',
      'cs_course_count = 74',
      'catalogue_only_course_count = 0',
      'term_count = 12',
      'result_count = 649',
      'transcript_count = 10',
      'graduation_count = 10',
      'personal_email_non_null_count = 0',
    ]) {
      expect(validator).toContain(assertion);
    }
  });
});
