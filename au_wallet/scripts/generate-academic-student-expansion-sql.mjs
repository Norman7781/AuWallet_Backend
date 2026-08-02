import { createHmac } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  COURSES,
  PROGRAM_CODE,
  curriculumBlocksFor,
  mapLegacyCourseCode,
  mapLegacyTermGroups,
} from './academic-curriculum-fixture.mjs';

const PROJECT_REF = 'ezsylcmnqbcwvkoqybkd';
const BASE_FIXTURE_FINGERPRINT = '2083ef44f9227f8578a878fde658806c';
const BASE_ADMISSIONS = ['6899001', '6499002', '6399003', '6499004', '6699005'];

const STUDENTS = [
  ['6899011', 'Mr', 'Narin', null, 'Kittisak', '2006-11-03', null, null],
  ['6799012', 'Ms', 'Pimchanok', null, 'Wattanakul', '2005-07-19', null, null],
  ['6699013', 'Mr', 'Tawan', null, 'Siriporn', '2004-02-28', null, null],
  ['6499014', 'Ms', 'Chanya', null, 'Methakul', '2002-10-14', null, null],
  ['6499015', 'Mr', 'Krit', null, 'Phongsawat', '2002-05-09', null, null],
  ['6499016', 'Ms', 'Napasorn', null, 'Yindee', '2002-08-31', null, null],
  ['6399017', 'Mr', 'Ronnakorn', null, 'Teerakul', '2001-01-22', null, null],
  ['6399018', 'Ms', 'Benyada', null, 'Srisawat', '2001-06-17', null, null],
  ['6399019', 'Mr', 'Phurin', null, 'Kanchana', '2000-12-04', null, null],
  ['6399020', 'Ms', 'Supansa', null, 'Thamrong', '2001-03-26', null, null],
  ['6499021', 'Mr', 'Natthanon', null, 'Charoen', '2002-09-12', null, null],
  ['6899022', 'Ms', 'Wipada', null, 'Raksakul', '2006-04-07', null, null],
  ['6799023', 'Mr', 'Jirawat', null, 'Manee', '2005-09-25', null, null],
  ['6699024', 'Ms', 'Kanya', null, 'Phromchai', '2004-07-11', null, null],
  ['6499025', 'Mr', 'Pongsatorn', null, 'Saelim', '2002-02-16', null, null],
];

const ENROLLMENTS = [
  ['6899011', '2025-06-02', 'studying', null],
  ['6799012', '2024-06-03', 'studying', null],
  ['6699013', '2023-06-05', 'studying', null],
  ['6499014', '2021-06-07', 'studying', null],
  ['6499015', '2021-06-07', 'graduated', null],
  ['6499016', '2021-06-07', 'graduated', null],
  ['6399017', '2020-06-08', 'graduated', null],
  ['6399018', '2020-06-08', 'alumni', null],
  ['6399019', '2020-06-08', 'alumni', 'Synthetic Transfer College'],
  ['6399020', '2020-06-08', 'alumni', 'Fictional International Institute'],
  ['6499021', '2021-06-07', 'alumni', null],
  ['6899022', '2025-06-02', 'withdrawn', null],
  ['6799023', '2024-06-03', 'withdrawn', null],
  ['6699024', '2023-06-05', 'withdrawn', null],
  ['6499025', '2021-06-07', 'withdrawn', null],
];

const LEGACY_CURRENT_BLOCKS = [
  ['ELE1101', 'ELE1201', 'GE1101', 'GE1201', 'GE1301'],
  ['GE2101', 'GE2201', 'GE2301', 'GE2401', 'BBA1101'],
];

const LEGACY_TRANSFER_BLOCKS = [
  ['GE2201', 'GE2301', 'BBA1301', 'BBA1401', 'CSX2201'],
  ['CSX2202', 'ITX2101', 'ITX2201', 'ITX2301', 'GE1201'],
  ['ITX2302', 'CSX3101', 'ITX3101', 'ITX3201', 'CSX3201', 'GE1301'],
  ['GE2101'],
  ['ITX3301', 'CSX3301', 'CSX3401', 'CSX3402', 'CSX4101', 'CSX4102'],
  ['ITX4101', 'CSX4301', 'CSX4302', 'CSX4401', 'CSX4402', 'CSX4501'],
  ['CSX4502', 'ITX4301', 'CSX4701', 'CSX4702', 'CSX4703'],
  ['ITX4701', 'ITX4702', 'CSX4704', 'BBA1101', 'GE2401', 'BBA1501'],
];

const LEGACY_TRANSFER_COURSES = [
  'ELE1101',
  'ELE1201',
  'GE1101',
  'BBA1201',
  'CSX2101',
  'CSX2102',
];
const COURSE_BY_CODE = new Map(COURSES.map((course) => [course[0], course]));
const APPROVED_TERMS = new Set([
  '2020/02',
  '2021/01',
  '2021/02',
  '2021/03',
  '2022/01',
  '2022/02',
  '2023/01',
  '2023/02',
  '2024/01',
  '2024/02',
  '2025/01',
  '2025/02',
]);
const FULL_2020_TERMS = [
  '2020/02',
  '2021/01',
  '2021/02',
  '2021/03',
  '2022/01',
  '2022/02',
  '2023/01',
  '2023/02',
];
const FULL_2021_TERMS = [
  '2021/01',
  '2021/02',
  '2022/01',
  '2022/02',
  '2023/01',
  '2023/02',
  '2024/01',
  '2024/02',
];

const GRADE_POINTS = new Map([
  ['A', 4],
  ['A-', 3.75],
  ['B+', 3.25],
  ['B', 3],
  ['B-', 2.75],
  ['C+', 2.25],
  ['C', 2],
]);
const GRADE_PATTERNS = [
  ['A', 'A-', 'B+', 'A', 'B', 'A-', 'A', 'B+', 'A-', 'B', 'A', 'B+'],
  ['B+', 'B', 'A-', 'B+', 'B', 'A', 'B', 'B+', 'A-', 'B', 'B+', 'A'],
  ['A-', 'B+', 'B', 'A', 'B+', 'A-', 'B', 'A', 'B+', 'B', 'A-', 'B+'],
  ['B', 'B+', 'A-', 'B', 'A', 'B+', 'B', 'A-', 'B+', 'A', 'B', 'B+'],
  ['B', 'B-', 'B+', 'C+', 'B', 'A-', 'B', 'C', 'B+', 'B-', 'A', 'B'],
];

const RESULTS = [];

function fail(message) {
  throw new Error(message);
}

function creditsFor(courseCode) {
  const course = COURSE_BY_CODE.get(courseCode);
  if (!course) fail(`Unknown curriculum course: ${courseCode}`);
  return course[2];
}

function addBlockResults(admissionNo, blocks, terms, patternIndex, offset = 0) {
  if (blocks.length !== terms.length) {
    fail(`Term allocation mismatch for ${admissionNo}`);
  }
  const pattern = GRADE_PATTERNS[patternIndex];
  let gradedIndex = offset;
  blocks.forEach((courseCodes, blockIndex) => {
    courseCodes.forEach((courseCode) => {
      const credits = creditsFor(courseCode);
      RESULTS.push([
        admissionNo,
        terms[blockIndex],
        courseCode,
        credits,
        pattern[gradedIndex++ % pattern.length],
        'normal',
      ]);
    });
  });
}

function addTransferResults(admissionNo, patternIndex, offset = 0) {
  LEGACY_TRANSFER_COURSES.map((courseCode) =>
    mapLegacyCourseCode(admissionNo, courseCode),
  ).forEach((courseCode) => {
    RESULTS.push([admissionNo, null, courseCode, 3, 'TR', 'transfer']);
  });
  addBlockResults(
    admissionNo,
    mapLegacyTermGroups(
      admissionNo,
      LEGACY_TRANSFER_BLOCKS.map((courseCodes, index) => [
        FULL_2020_TERMS[index],
        courseCodes,
      ]),
    ).map(([, courseCodes]) => courseCodes),
    FULL_2020_TERMS,
    patternIndex,
    offset,
  );
}

addBlockResults(
  '6899011',
  mapLegacyTermGroups(
    '6899011',
    LEGACY_CURRENT_BLOCKS.map((courseCodes, index) => [
      ['2025/01', '2025/02'][index],
      courseCodes,
    ]),
  ).map(([, courseCodes]) => courseCodes),
  ['2025/01', '2025/02'],
  0,
  2,
);
addBlockResults(
  '6799012',
  curriculumBlocksFor('6799012').slice(0, 4),
  ['2024/01', '2024/02', '2025/01', '2025/02'],
  1,
  1,
);
addBlockResults(
  '6699013',
  curriculumBlocksFor('6699013').slice(0, 6),
  ['2023/01', '2023/02', '2024/01', '2024/02', '2025/01', '2025/02'],
  2,
  3,
);
addBlockResults(
  '6499014',
  curriculumBlocksFor('6499014').slice(0, 7),
  ['2021/01', '2021/02', '2022/01', '2022/02', '2023/01', '2024/02', '2025/02'],
  3,
  4,
);
addBlockResults(
  '6499015',
  curriculumBlocksFor('6499015'),
  FULL_2021_TERMS,
  0,
  0,
);
addBlockResults(
  '6499016',
  curriculumBlocksFor('6499016'),
  FULL_2021_TERMS,
  1,
  3,
);
addBlockResults(
  '6399017',
  curriculumBlocksFor('6399017'),
  FULL_2020_TERMS,
  2,
  5,
);
addBlockResults(
  '6399018',
  curriculumBlocksFor('6399018'),
  FULL_2020_TERMS,
  3,
  2,
);
addTransferResults('6399019', 0, 7);
addTransferResults('6399020', 2, 4);
addBlockResults(
  '6499021',
  curriculumBlocksFor('6499021'),
  FULL_2021_TERMS,
  4,
  1,
);
addBlockResults(
  '6899022',
  curriculumBlocksFor('6899022').slice(0, 1),
  ['2025/01'],
  4,
  0,
);
addBlockResults(
  '6799023',
  curriculumBlocksFor('6799023').slice(0, 2),
  ['2024/01', '2024/02'],
  3,
  3,
);
addBlockResults(
  '6699024',
  curriculumBlocksFor('6699024').slice(0, 3),
  ['2023/01', '2023/02', '2024/01'],
  4,
  6,
);
addBlockResults(
  '6499025',
  curriculumBlocksFor('6499025').slice(0, 4),
  ['2021/01', '2021/02', '2022/01', '2022/02'],
  1,
  8,
);

function academicSummary(admissionNo) {
  const normal = RESULTS.filter(
    (result) => result[0] === admissionNo && result[5] === 'normal',
  );
  const transfer = RESULTS.filter(
    (result) => result[0] === admissionNo && result[5] === 'transfer',
  );
  const completed = normal.reduce((sum, result) => sum + result[3], 0);
  const transferred = transfer.reduce((sum, result) => sum + result[3], 0);
  const gradePoints = normal.reduce(
    (sum, result) => sum + result[3] * GRADE_POINTS.get(result[4]),
    0,
  );
  const unroundedGpa = gradePoints / completed;
  const storedGpa = Math.round(unroundedGpa * 100) / 100;
  return {
    completed,
    transferred,
    earned: completed + transferred,
    gradePoints,
    storedGpa,
    award:
      unroundedGpa >= 3.5 && completed + transferred === 132
        ? 'Academic Distinction'
        : null,
  };
}

const COMPLETED_CONFIG = [
  ['6499015', '2026-01-17', '2025-04-21 09:00:00+07'],
  ['6499016', '2026-01-17', '2025-04-21 11:00:00+07'],
  ['6399017', '2025-01-18', '2024-04-22 09:00:00+07'],
  ['6399018', '2025-01-18', '2024-04-23 09:00:00+07'],
  ['6399019', '2025-01-18', '2024-04-23 10:00:00+07'],
  ['6399020', '2025-01-18', '2024-04-24 09:00:00+07'],
  ['6499021', '2026-01-17', '2025-04-22 09:00:00+07'],
];

const GRADUATIONS = COMPLETED_CONFIG.map(
  ([admissionNo, graduationDate, approvedAt]) => {
    const summary = academicSummary(admissionNo);
    return [
      admissionNo,
      graduationDate,
      summary.completed,
      summary.transferred,
      summary.earned,
      summary.storedGpa,
      summary.award,
      true,
      'completed',
      approvedAt,
    ];
  },
);

const TRANSCRIPTS = [
  [
    '6499015',
    'SYN-AU-TR-2025-6499015',
    'SYNV-25-6499015-A6R2',
    '2025-05-06',
    true,
    'issued',
    'Office of the University Registrar',
  ],
  ['6499016', null, null, null, false, 'draft', null],
  [
    '6399017',
    'SYN-AU-TR-2024-6399017',
    'SYNV-24-6399017-B7T3',
    '2024-05-07',
    true,
    'issued',
    'Office of the University Registrar',
  ],
  [
    '6399018',
    'SYN-AU-TR-2024-6399018',
    'SYNV-24-6399018-C8U4',
    '2024-05-08',
    true,
    'issued',
    'Office of the University Registrar',
  ],
  [
    '6399019',
    'SYN-AU-TR-2024-6399019',
    'SYNV-24-6399019-D9V5',
    '2024-05-09',
    true,
    'issued',
    'Office of the University Registrar',
  ],
  [
    '6399020',
    'SYN-AU-TR-2024-6399020',
    'SYNV-24-6399020-E2W6',
    '2024-05-10',
    true,
    'issued',
    'Office of the University Registrar',
  ],
  [
    '6499021',
    'SYN-AU-TR-2025-6499021',
    'SYNV-25-6499021-F3X7',
    '2025-05-07',
    true,
    'issued',
    'Office of the University Registrar',
  ],
];

const RESULT_SUMMARIES = STUDENTS.map(([admissionNo]) => {
  const rows = RESULTS.filter((result) => result[0] === admissionNo);
  return [
    admissionNo,
    rows.length,
    rows.filter((result) => result[5] === 'normal').length,
    rows.filter((result) => result[5] === 'transfer').length,
    rows.filter((result) => result[5] === 'seminar').length,
    rows
      .filter((result) => result[5] === 'normal')
      .reduce((sum, result) => sum + result[3], 0),
    rows
      .filter((result) => result[5] === 'transfer')
      .reduce((sum, result) => sum + result[3], 0),
  ];
});

const GPA_ASSERTIONS = GRADUATIONS.map((graduation) => {
  const summary = academicSummary(graduation[0]);
  return [
    graduation[0],
    summary.completed,
    summary.gradePoints,
    summary.storedGpa,
  ];
});

const BASE_ELIGIBILITY = [
  ['6899001', true, false],
  ['6499002', true, true],
  ['6399003', true, true],
  ['6499004', true, false],
  ['6699005', false, false],
];
const ADDITIONAL_ELIGIBILITY = ENROLLMENTS.map(([admissionNo, , status]) => {
  const transcript = TRANSCRIPTS.find((row) => row[0] === admissionNo);
  return [
    admissionNo,
    ['studying', 'graduated', 'alumni'].includes(status),
    ['graduated', 'alumni'].includes(status) && transcript?.[5] === 'issued',
  ];
});
const ELIGIBILITY = [...BASE_ELIGIBILITY, ...ADDITIONAL_ELIGIBILITY];

function requireEnvironmentVariable(name) {
  const value = process.env[name];
  if (typeof value !== 'string' || value.length === 0) {
    fail(`Required environment variable ${name} is missing or empty`);
  }
  return value;
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
      'Provide exactly one output path ending in .generated-seed.sql; add --force only to allow replacement',
    );
  }
  const outputPath = resolve(positional[0]);
  if (!outputPath.endsWith('.generated-seed.sql')) {
    fail('Output path must end in .generated-seed.sql');
  }
  if (!force && existsSync(outputPath)) {
    fail('Output file already exists; pass --force to replace it');
  }
  return { force, outputPath };
}

function normalizePassport(rawPassport) {
  return rawPassport
    .normalize('NFKC')
    .trim()
    .replace(/\s/gu, '')
    .replace(/-/g, '')
    .toUpperCase();
}

function createSyntheticPassportDigest(admissionNo, secretBytes) {
  let syntheticInput = ['SYNTHETIC', 'AU', 'PASSPORT', admissionNo].join('-');
  let normalizedInput = '';
  let normalizedBytes;
  try {
    normalizedInput = normalizePassport(syntheticInput);
    normalizedBytes = Buffer.from(normalizedInput, 'utf8');
    return createHmac('sha256', secretBytes)
      .update(normalizedBytes)
      .digest('hex');
  } finally {
    syntheticInput = '';
    normalizedInput = '';
    normalizedBytes?.fill(0);
  }
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const sqlValue = {
  text: (value) => (value === null ? 'NULL::text' : `${quote(value)}::text`),
  date: (value) => (value === null ? 'NULL::date' : `DATE ${quote(value)}`),
  timestamp: (value) =>
    value === null ? 'NULL::timestamptz' : `TIMESTAMPTZ ${quote(value)}`,
  numeric: (value) => `${value}::numeric`,
  bigint: (value) => `${value}::bigint`,
  boolean: (value) => `${value ? 'true' : 'false'}::boolean`,
};

function valuesSql(rows, types, indent = '      ') {
  return rows
    .map(
      (row) =>
        `${indent}(${row.map((value, index) => sqlValue[types[index]](value)).join(', ')})`,
    )
    .join(',\n');
}

function validateFixtureModel() {
  const admissions = new Set(STUDENTS.map((student) => student[0]));
  if (
    STUDENTS.length !== 15 ||
    admissions.size !== 15 ||
    [...admissions].some((admission) => BASE_ADMISSIONS.includes(admission))
  ) {
    fail('Additional student natural-key assertions failed');
  }
  if (STUDENTS.some((student) => student[6] !== null || student[7] !== null)) {
    fail('Database-derived university-email placeholder assertion failed');
  }
  const statusCounts = new Map();
  ENROLLMENTS.forEach((enrollment) =>
    statusCounts.set(enrollment[2], (statusCounts.get(enrollment[2]) ?? 0) + 1),
  );
  if (
    statusCounts.get('studying') !== 4 ||
    statusCounts.get('graduated') !== 3 ||
    statusCounts.get('alumni') !== 4 ||
    statusCounts.get('withdrawn') !== 4
  ) {
    fail('Additional status distribution assertion failed');
  }
  const pairs = new Set();
  for (const result of RESULTS) {
    const [admissionNo, termCode, courseCode, credits, grade, resultType] =
      result;
    const pair = `${admissionNo}:${courseCode}`;
    if (!admissions.has(admissionNo) || pairs.has(pair)) {
      fail('Additional course-result relationship assertion failed');
    }
    pairs.add(pair);
    if (termCode !== null && !APPROVED_TERMS.has(termCode)) {
      fail('Additional course result references an unapproved term');
    }
    if (
      resultType === 'normal' &&
      (credits !== creditsFor(courseCode) || !GRADE_POINTS.has(grade))
    ) {
      fail('Additional normal result assertion failed');
    }
    if (
      resultType === 'transfer' &&
      (credits !== 3 || grade !== 'TR' || termCode !== null)
    ) {
      fail('Additional transfer result assertion failed');
    }
    if (!['normal', 'transfer'].includes(resultType)) {
      fail('Unexpected additional course-result type');
    }
  }
  const typeCounts = new Map();
  RESULTS.forEach((result) =>
    typeCounts.set(result[5], (typeCounts.get(result[5]) ?? 0) + 1),
  );
  if (
    RESULTS.length !== 493 ||
    typeCounts.get('normal') !== 481 ||
    typeCounts.get('transfer') !== 12 ||
    (typeCounts.get('seminar') ?? 0) !== 0
  ) {
    fail('Additional result-count assertion failed');
  }
  const expectedSummaries = new Map([
    ['6899011', [10, 10, 0, 0, 25, 0]],
    ['6799012', [24, 24, 0, 0, 66, 0]],
    ['6699013', [36, 36, 0, 0, 102, 0]],
    ['6499014', [41, 41, 0, 0, 117, 0]],
    ['6499015', [46, 46, 0, 0, 132, 0]],
    ['6499016', [46, 46, 0, 0, 132, 0]],
    ['6399017', [46, 46, 0, 0, 132, 0]],
    ['6399018', [46, 46, 0, 0, 132, 0]],
    ['6399019', [46, 40, 6, 0, 114, 18]],
    ['6399020', [46, 40, 6, 0, 114, 18]],
    ['6499021', [46, 46, 0, 0, 132, 0]],
    ['6899022', [6, 6, 0, 0, 16, 0]],
    ['6799023', [12, 12, 0, 0, 32, 0]],
    ['6699024', [18, 18, 0, 0, 49, 0]],
    ['6499025', [24, 24, 0, 0, 66, 0]],
  ]);
  for (const summary of RESULT_SUMMARIES) {
    const expected = expectedSummaries.get(summary[0]);
    if (summary.slice(1).some((value, index) => value !== expected[index])) {
      fail(`Additional result summary assertion failed for ${summary[0]}`);
    }
  }
  if (
    GRADUATIONS.length !== 7 ||
    TRANSCRIPTS.length !== 7 ||
    GRADUATIONS.some(
      (graduation) =>
        graduation[4] !== 132 || graduation[5] < 0 || graduation[5] > 4,
    )
  ) {
    fail('Additional completion-record assertion failed');
  }
}

function buildSql(passportDigests) {
  const studentRows = STUDENTS.map((student, index) => [
    ...student,
    passportDigests[index],
  ]);
  const studentValues = valuesSql(studentRows, [
    'text',
    'text',
    'text',
    'text',
    'text',
    'date',
    'text',
    'text',
    'text',
  ]);
  const enrollmentValues = valuesSql(ENROLLMENTS, [
    'text',
    'date',
    'text',
    'text',
  ]);
  const resultValues = valuesSql(RESULTS, [
    'text',
    'text',
    'text',
    'numeric',
    'text',
    'text',
  ]);
  const graduationValues = valuesSql(GRADUATIONS, [
    'text',
    'date',
    'numeric',
    'numeric',
    'numeric',
    'numeric',
    'text',
    'boolean',
    'text',
    'timestamp',
  ]);
  const transcriptValues = valuesSql(TRANSCRIPTS, [
    'text',
    'text',
    'text',
    'date',
    'boolean',
    'text',
    'text',
  ]);
  const summaryValues = valuesSql(RESULT_SUMMARIES, [
    'text',
    'bigint',
    'bigint',
    'bigint',
    'bigint',
    'numeric',
    'numeric',
  ]);
  const gpaValues = valuesSql(GPA_ASSERTIONS, [
    'text',
    'numeric',
    'numeric',
    'numeric',
  ]);
  const eligibilityValues = valuesSql(ELIGIBILITY, [
    'text',
    'boolean',
    'boolean',
  ]);
  const additionalAdmissions = STUDENTS.map((student) =>
    quote(student[0]),
  ).join(', ');
  const baseAdmissions = BASE_ADMISSIONS.map(quote).join(', ');
  const documentNumbers = TRANSCRIPTS.filter((row) => row[1]).map((row) =>
    quote(row[1]),
  );
  const verificationCodes = TRANSCRIPTS.filter((row) => row[2]).map((row) =>
    quote(row[2]),
  );
  const distinctionAdmissions = [
    '6499002',
    '6399003',
    ...GRADUATIONS.filter((row) => row[6] === 'Academic Distinction').map(
      (row) => row[0],
    ),
  ];
  const distinctionList = distinctionAdmissions.map(quote).join(', ');

  return `-- Protected additive expansion from 5 to 20 synthetic academic students.
-- Intended Supabase project ref: ${PROJECT_REF}.
-- Contains derived HMAC values; keep temporary and never print.

BEGIN;

SELECT pg_advisory_xact_lock(
  hashtextextended('au_wallet.academic.synthetic_student_expansion.v1', 0)
);

DO $academic_expansion$
DECLARE
  additional_any boolean;
  base_fingerprint text;
  affected_rows bigint;
BEGIN
  SELECT
    EXISTS (
      SELECT 1 FROM academic.student
      WHERE admission_no IN (${additionalAdmissions})
    )
    OR EXISTS (
      SELECT 1 FROM academic.transcript
      WHERE document_number IN (${documentNumbers.join(', ')})
         OR verification_code IN (${verificationCodes.join(', ')})
    )
  INTO additional_any;

  SELECT md5(jsonb_build_object(
    'program', (
      SELECT jsonb_agg(jsonb_build_object(
        'faculty_code', faculty_code,
        'faculty_name', faculty_name,
        'program_code', program_code,
        'degree_level', degree_level,
        'degree_name', degree_name,
        'major', major,
        'major_concentration', major_concentration,
        'required_credits', required_credits,
        'is_active', is_active
      ) ORDER BY program_code)
      FROM academic.program
    ),
    'students', (
      SELECT jsonb_agg(jsonb_build_object(
        'admission_no', admission_no,
        'title', title,
        'first_name', first_name,
        'middle_name', middle_name,
        'last_name', last_name,
        'date_of_birth', date_of_birth,
        'passport_number_hmac', passport_number_hmac
      ) ORDER BY admission_no)
      FROM academic.student
      WHERE admission_no IN (${baseAdmissions})
    ),
    'enrollments', (
      SELECT jsonb_agg(jsonb_build_object(
        'admission_no', student.admission_no,
        'program_code', program.program_code,
        'admission_date', enrollment.admission_date,
        'academic_status', enrollment.academic_status,
        'previous_institution_name', enrollment.previous_institution_name
      ) ORDER BY student.admission_no)
      FROM academic.student_program_enrollment AS enrollment
      JOIN academic.student AS student
        ON student.student_id = enrollment.student_id
      JOIN academic.program AS program
        ON program.program_id = enrollment.program_id
      WHERE student.admission_no IN (${baseAdmissions})
    ),
    'courses', (
      SELECT jsonb_agg(jsonb_build_object(
        'program_code', program.program_code,
        'course_code', course.course_code,
        'course_title', course.course_title,
        'default_credits', course.default_credits,
        'course_category', course.course_category,
        'is_active', course.is_active
      ) ORDER BY course.course_code)
      FROM academic.course AS course
      JOIN academic.program AS program
        ON program.program_id = course.program_id
    ),
    'terms', (
      SELECT jsonb_agg(jsonb_build_object(
        'term_code', term_code,
        'academic_year', academic_year,
        'semester_no', semester_no,
        'term_label', term_label
      ) ORDER BY term_code)
      FROM academic.academic_term
    ),
    'results', (
      SELECT jsonb_agg(jsonb_build_object(
        'admission_no', student.admission_no,
        'term_code', term.term_code,
        'course_code', course.course_code,
        'credits', result.credits,
        'grade', result.grade,
        'result_type', result.result_type
      ) ORDER BY student.admission_no, course.course_code)
      FROM academic.course_result AS result
      JOIN academic.student_program_enrollment AS enrollment
        ON enrollment.enrollment_id = result.enrollment_id
      JOIN academic.student AS student
        ON student.student_id = enrollment.student_id
      JOIN academic.course AS course
        ON course.course_id = result.course_id
      LEFT JOIN academic.academic_term AS term
        ON term.academic_term_id = result.academic_term_id
      WHERE student.admission_no IN (${baseAdmissions})
    ),
    'graduations', (
      SELECT jsonb_agg(jsonb_build_object(
        'admission_no', student.admission_no,
        'graduation_date', graduation.graduation_date,
        'total_credits_completed', graduation.total_credits_completed,
        'total_credits_transferred', graduation.total_credits_transferred,
        'total_credits_earned', graduation.total_credits_earned,
        'cumulative_gpa', graduation.cumulative_gpa,
        'award', graduation.award,
        'requirements_fulfilled', graduation.requirements_fulfilled,
        'graduation_status', graduation.graduation_status,
        'approved_at_utc', to_char(
          graduation.approved_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US'
        )
      ) ORDER BY student.admission_no)
      FROM academic.graduation_record AS graduation
      JOIN academic.student_program_enrollment AS enrollment
        ON enrollment.enrollment_id = graduation.enrollment_id
      JOIN academic.student AS student
        ON student.student_id = enrollment.student_id
      WHERE student.admission_no IN (${baseAdmissions})
    ),
    'transcripts', (
      SELECT jsonb_agg(jsonb_build_object(
        'admission_no', student.admission_no,
        'document_number', transcript.document_number,
        'verification_code', transcript.verification_code,
        'issued_on', transcript.issued_on,
        'is_certified_true_copy', transcript.is_certified_true_copy,
        'document_status', transcript.document_status,
        'registrar_name', transcript.registrar_name
      ) ORDER BY student.admission_no)
      FROM academic.transcript AS transcript
      JOIN academic.student_program_enrollment AS enrollment
        ON enrollment.enrollment_id = transcript.enrollment_id
      JOIN academic.student AS student
        ON student.student_id = enrollment.student_id
      WHERE student.admission_no IN (${baseAdmissions})
    )
  )::text)
  INTO base_fingerprint;

  IF base_fingerprint IS DISTINCT FROM '${BASE_FIXTURE_FINGERPRINT}' THEN
    RAISE EXCEPTION 'Base five-student fixture fingerprint mismatch';
  END IF;

  IF NOT additional_any THEN
    -- State A: exact five-student base plus no expansion keys.
    IF (SELECT count(*) FROM academic.program) <> 1
      OR (SELECT count(*) FROM academic.student) <> 5
      OR (SELECT count(*) FROM academic.student_program_enrollment) <> 5
      OR (SELECT count(*) FROM academic.course) <> 74
      OR (SELECT count(*) FROM academic.academic_term) <> 12
      OR (SELECT count(*) FROM academic.course_result) <> 156
      OR (SELECT count(*) FROM academic.transcript) <> 3
      OR (SELECT count(*) FROM academic.graduation_record) <> 3
      OR (SELECT count(*) FROM wallet.holder_account) <> 0
      OR (SELECT count(*) FROM wallet.wallet_onboarding_request) <> 0
      OR (SELECT count(*) FROM wallet.uploaded_identity_document) <> 0
    THEN
      RAISE EXCEPTION 'State A rejected: base table counts differ';
    END IF;

    INSERT INTO academic.student (
      admission_no, title, first_name, middle_name, last_name, date_of_birth,
      university_email, personal_email, passport_number_hmac
    )
    VALUES
${studentValues};

    UPDATE academic.student
    SET university_email = 'u' || admission_no || '@au.test',
        updated_at = clock_timestamp()
    WHERE admission_no IN (${additionalAdmissions})
      AND university_email IS DISTINCT FROM
        'u' || admission_no || '@au.test';
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 15 THEN
      RAISE EXCEPTION 'Expansion university-email assignment count mismatch';
    END IF;

    INSERT INTO academic.student_program_enrollment (
      student_id, program_id, admission_date, academic_status,
      previous_institution_name
    )
    SELECT student.student_id, program.program_id, fixture.admission_date,
      fixture.academic_status, fixture.previous_institution_name
    FROM (
      VALUES
${enrollmentValues}
    ) AS fixture(admission_no, admission_date, academic_status, previous_institution_name)
    JOIN academic.student AS student
      ON student.admission_no = fixture.admission_no
    JOIN academic.program AS program
      ON program.program_code = '${PROGRAM_CODE}';

    INSERT INTO academic.course_result (
      enrollment_id, academic_term_id, course_id, credits, grade, result_type
    )
    SELECT enrollment.enrollment_id, term.academic_term_id, course.course_id,
      fixture.credits, fixture.grade, fixture.result_type
    FROM (
      VALUES
${resultValues}
    ) AS fixture(admission_no, term_code, course_code, credits, grade, result_type)
    JOIN academic.student AS student
      ON student.admission_no = fixture.admission_no
    JOIN academic.student_program_enrollment AS enrollment
      ON enrollment.student_id = student.student_id
    JOIN academic.program AS program
      ON program.program_id = enrollment.program_id
     AND program.program_code = '${PROGRAM_CODE}'
    JOIN academic.course AS course
      ON course.program_id = program.program_id
     AND course.course_code = fixture.course_code
    LEFT JOIN academic.academic_term AS term
      ON term.term_code = fixture.term_code;

    INSERT INTO academic.graduation_record (
      enrollment_id, graduation_date, total_credits_completed,
      total_credits_transferred, total_credits_earned, cumulative_gpa, award,
      requirements_fulfilled, graduation_status, approved_at
    )
    SELECT enrollment.enrollment_id, fixture.graduation_date,
      fixture.total_credits_completed, fixture.total_credits_transferred,
      fixture.total_credits_earned, fixture.cumulative_gpa, fixture.award,
      fixture.requirements_fulfilled, fixture.graduation_status,
      fixture.approved_at
    FROM (
      VALUES
${graduationValues}
    ) AS fixture(admission_no, graduation_date, total_credits_completed,
      total_credits_transferred, total_credits_earned, cumulative_gpa, award,
      requirements_fulfilled, graduation_status, approved_at)
    JOIN academic.student AS student
      ON student.admission_no = fixture.admission_no
    JOIN academic.student_program_enrollment AS enrollment
      ON enrollment.student_id = student.student_id
    JOIN academic.program AS program
      ON program.program_id = enrollment.program_id
     AND program.program_code = '${PROGRAM_CODE}';

    INSERT INTO academic.transcript (
      enrollment_id, document_number, verification_code, issued_on,
      is_certified_true_copy, document_status, registrar_name
    )
    SELECT enrollment.enrollment_id, fixture.document_number,
      fixture.verification_code, fixture.issued_on,
      fixture.is_certified_true_copy, fixture.document_status,
      fixture.registrar_name
    FROM (
      VALUES
${transcriptValues}
    ) AS fixture(admission_no, document_number, verification_code, issued_on,
      is_certified_true_copy, document_status, registrar_name)
    JOIN academic.student AS student
      ON student.admission_no = fixture.admission_no
    JOIN academic.student_program_enrollment AS enrollment
      ON enrollment.student_id = student.student_id
    JOIN academic.program AS program
      ON program.program_id = enrollment.program_id
     AND program.program_code = '${PROGRAM_CODE}';
  ELSE
    -- State B: expansion keys exist; perform validation-only no-op.
    NULL;
  END IF;

  IF (SELECT count(*) FROM academic.program) <> 1
    OR (SELECT count(*) FROM academic.student) <> 20
    OR (SELECT count(*) FROM academic.student_program_enrollment) <> 20
    OR (SELECT count(*) FROM academic.course) <> 74
    OR (SELECT count(*) FROM academic.academic_term) <> 12
    OR (SELECT count(*) FROM academic.course_result) <> 649
    OR (SELECT count(*) FROM academic.transcript) <> 10
    OR (SELECT count(*) FROM academic.graduation_record) <> 10
    OR (SELECT count(*) FROM wallet.holder_account) <> 0
    OR (SELECT count(*) FROM wallet.wallet_onboarding_request) <> 0
    OR (SELECT count(*) FROM wallet.uploaded_identity_document) <> 0
  THEN
    RAISE EXCEPTION 'Expanded fixture table-count assertion failed';
  END IF;

  IF EXISTS (
    WITH expected(admission_no, title, first_name, middle_name, last_name,
      date_of_birth, university_email, personal_email, passport_number_hmac) AS (
      VALUES
${studentValues}
    ),
    actual AS (
      SELECT admission_no, title, first_name, middle_name, last_name,
        date_of_birth, NULL::text AS university_email, personal_email,
        passport_number_hmac
      FROM academic.student
      WHERE admission_no IN (${additionalAdmissions})
    ),
    missing AS (SELECT * FROM expected EXCEPT SELECT * FROM actual),
    extra AS (SELECT * FROM actual EXCEPT SELECT * FROM expected)
    SELECT 1 FROM missing UNION ALL SELECT 1 FROM extra
  ) THEN
    RAISE EXCEPTION 'Expanded fixture student assertion failed';
  END IF;

  IF (SELECT count(*) FROM academic.student
      WHERE university_email = 'u' || admission_no || '@au.test') <> 20
    OR (SELECT count(DISTINCT university_email) FROM academic.student) <> 20
  THEN
    RAISE EXCEPTION 'Expanded fixture university-email assertion failed';
  END IF;

  IF (SELECT count(*) FROM academic.student
      WHERE passport_number_hmac ~ '^[0-9a-f]{64}$') <> 20
    OR (SELECT count(DISTINCT passport_number_hmac) FROM academic.student) <> 20
  THEN
    RAISE EXCEPTION 'Expanded fixture passport HMAC assertion failed';
  END IF;

  IF EXISTS (
    WITH expected(admission_no, admission_date, academic_status,
      previous_institution_name) AS (
      VALUES
${enrollmentValues}
    ),
    actual AS (
      SELECT student.admission_no, enrollment.admission_date,
        enrollment.academic_status, enrollment.previous_institution_name
      FROM academic.student_program_enrollment AS enrollment
      JOIN academic.student AS student
        ON student.student_id = enrollment.student_id
      JOIN academic.program AS program
        ON program.program_id = enrollment.program_id
      WHERE program.program_code = '${PROGRAM_CODE}'
        AND student.admission_no IN (${additionalAdmissions})
    ),
    missing AS (SELECT * FROM expected EXCEPT SELECT * FROM actual),
    extra AS (SELECT * FROM actual EXCEPT SELECT * FROM expected)
    SELECT 1 FROM missing UNION ALL SELECT 1 FROM extra
  ) THEN
    RAISE EXCEPTION 'Expanded fixture enrollment assertion failed';
  END IF;

  IF EXISTS (
    WITH expected(admission_no, term_code, course_code, credits, grade, result_type) AS (
      VALUES
${resultValues}
    ),
    actual AS (
      SELECT student.admission_no, term.term_code, course.course_code,
        result.credits, result.grade, result.result_type
      FROM academic.course_result AS result
      JOIN academic.student_program_enrollment AS enrollment
        ON enrollment.enrollment_id = result.enrollment_id
      JOIN academic.student AS student
        ON student.student_id = enrollment.student_id
      JOIN academic.course AS course
        ON course.course_id = result.course_id
      LEFT JOIN academic.academic_term AS term
        ON term.academic_term_id = result.academic_term_id
      WHERE student.admission_no IN (${additionalAdmissions})
    ),
    missing AS (SELECT * FROM expected EXCEPT SELECT * FROM actual),
    extra AS (SELECT * FROM actual EXCEPT SELECT * FROM expected)
    SELECT 1 FROM missing UNION ALL SELECT 1 FROM extra
  ) THEN
    RAISE EXCEPTION 'Expanded fixture course-result assertion failed';
  END IF;

  IF (
    SELECT ROW(
      count(*) FILTER (WHERE result_type = 'normal'),
      count(*) FILTER (WHERE result_type = 'transfer'),
      count(*) FILTER (WHERE result_type = 'seminar'),
      count(*)
    )
    FROM academic.course_result
  ) IS DISTINCT FROM ROW(631::bigint, 18::bigint, 0::bigint, 649::bigint)
  THEN
    RAISE EXCEPTION 'Expanded fixture result-type assertion failed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM academic.course_result
    GROUP BY enrollment_id, course_id
    HAVING count(*) <> 1
  ) OR EXISTS (
    SELECT 1
    FROM academic.course_result AS result
    JOIN academic.course AS course
      ON course.course_id = result.course_id
    WHERE result.result_type = 'normal'
      AND result.credits IS DISTINCT FROM course.default_credits
  ) OR EXISTS (
    SELECT 1 FROM academic.course_result
    WHERE result_type = 'transfer'
      AND (grade <> 'TR' OR academic_term_id IS NOT NULL)
  ) OR EXISTS (
    SELECT 1 FROM academic.course_result
    WHERE result_type NOT IN ('normal', 'transfer')
  ) THEN
    RAISE EXCEPTION 'Expanded fixture result relationship assertion failed';
  END IF;

  IF EXISTS (
    WITH expected(admission_no, result_count, normal_count, transfer_count,
      seminar_count, completed_credits, transferred_credits) AS (
      VALUES
${summaryValues}
    ),
    actual AS (
      SELECT student.admission_no,
        count(*)::bigint,
        count(*) FILTER (WHERE result.result_type = 'normal')::bigint,
        count(*) FILTER (WHERE result.result_type = 'transfer')::bigint,
        count(*) FILTER (WHERE result.result_type = 'seminar')::bigint,
        coalesce(sum(result.credits) FILTER (
          WHERE result.result_type = 'normal'
        ), 0)::numeric,
        coalesce(sum(result.credits) FILTER (
          WHERE result.result_type = 'transfer'
        ), 0)::numeric
      FROM academic.course_result AS result
      JOIN academic.student_program_enrollment AS enrollment
        ON enrollment.enrollment_id = result.enrollment_id
      JOIN academic.student AS student
        ON student.student_id = enrollment.student_id
      WHERE student.admission_no IN (${additionalAdmissions})
      GROUP BY student.admission_no
    ),
    missing AS (SELECT * FROM expected EXCEPT SELECT * FROM actual),
    extra AS (SELECT * FROM actual EXCEPT SELECT * FROM expected)
    SELECT 1 FROM missing UNION ALL SELECT 1 FROM extra
  ) THEN
    RAISE EXCEPTION 'Expanded fixture scenario summary assertion failed';
  END IF;

  IF EXISTS (
    WITH expected(admission_no, gpa_credits, grade_points, stored_gpa) AS (
      VALUES
${gpaValues}
    ),
    actual AS (
      SELECT student.admission_no,
        sum(result.credits) FILTER (
          WHERE result.result_type = 'normal'
        )::numeric,
        sum(result.credits * CASE result.grade
          WHEN 'A' THEN 4.00 WHEN 'A-' THEN 3.75 WHEN 'B+' THEN 3.25
          WHEN 'B' THEN 3.00 WHEN 'B-' THEN 2.75 WHEN 'C+' THEN 2.25
          WHEN 'C' THEN 2.00 ELSE NULL END
        ) FILTER (WHERE result.result_type = 'normal')::numeric,
        graduation.cumulative_gpa
      FROM academic.course_result AS result
      JOIN academic.student_program_enrollment AS enrollment
        ON enrollment.enrollment_id = result.enrollment_id
      JOIN academic.student AS student
        ON student.student_id = enrollment.student_id
      JOIN academic.graduation_record AS graduation
        ON graduation.enrollment_id = enrollment.enrollment_id
      WHERE student.admission_no IN (${GRADUATIONS.map((row) => quote(row[0])).join(', ')})
      GROUP BY student.admission_no, graduation.cumulative_gpa
    ),
    missing AS (SELECT * FROM expected EXCEPT SELECT * FROM actual),
    extra AS (SELECT * FROM actual EXCEPT SELECT * FROM expected)
    SELECT 1 FROM missing UNION ALL SELECT 1 FROM extra
  ) THEN
    RAISE EXCEPTION 'Expanded fixture GPA assertion failed';
  END IF;

  IF EXISTS (
    WITH expected(admission_no, graduation_date, total_credits_completed,
      total_credits_transferred, total_credits_earned, cumulative_gpa, award,
      requirements_fulfilled, graduation_status, approved_at) AS (
      VALUES
${graduationValues}
    ),
    actual AS (
      SELECT student.admission_no, graduation.graduation_date,
        graduation.total_credits_completed,
        graduation.total_credits_transferred,
        graduation.total_credits_earned, graduation.cumulative_gpa,
        graduation.award, graduation.requirements_fulfilled,
        graduation.graduation_status, graduation.approved_at
      FROM academic.graduation_record AS graduation
      JOIN academic.student_program_enrollment AS enrollment
        ON enrollment.enrollment_id = graduation.enrollment_id
      JOIN academic.student AS student
        ON student.student_id = enrollment.student_id
      WHERE student.admission_no IN (${additionalAdmissions})
    ),
    missing AS (SELECT * FROM expected EXCEPT SELECT * FROM actual),
    extra AS (SELECT * FROM actual EXCEPT SELECT * FROM expected)
    SELECT 1 FROM missing UNION ALL SELECT 1 FROM extra
  ) THEN
    RAISE EXCEPTION 'Expanded fixture graduation assertion failed';
  END IF;

  IF EXISTS (
    WITH expected(admission_no, document_number, verification_code, issued_on,
      is_certified_true_copy, document_status, registrar_name) AS (
      VALUES
${transcriptValues}
    ),
    actual AS (
      SELECT student.admission_no, transcript.document_number,
        transcript.verification_code, transcript.issued_on,
        transcript.is_certified_true_copy, transcript.document_status,
        transcript.registrar_name
      FROM academic.transcript AS transcript
      JOIN academic.student_program_enrollment AS enrollment
        ON enrollment.enrollment_id = transcript.enrollment_id
      JOIN academic.student AS student
        ON student.student_id = enrollment.student_id
      WHERE student.admission_no IN (${additionalAdmissions})
    ),
    missing AS (SELECT * FROM expected EXCEPT SELECT * FROM actual),
    extra AS (SELECT * FROM actual EXCEPT SELECT * FROM expected)
    SELECT 1 FROM missing UNION ALL SELECT 1 FROM extra
  ) THEN
    RAISE EXCEPTION 'Expanded fixture transcript assertion failed';
  END IF;

  IF (
    SELECT count(*)
    FROM academic.graduation_record AS graduation
    JOIN academic.student_program_enrollment AS enrollment
      ON enrollment.enrollment_id = graduation.enrollment_id
    JOIN academic.student AS student
      ON student.student_id = enrollment.student_id
    WHERE graduation.award = 'Academic Distinction'
      AND student.admission_no IN (${distinctionList})
  ) <> ${distinctionAdmissions.length}
    OR EXISTS (
      SELECT 1
      FROM academic.graduation_record AS graduation
      JOIN academic.student_program_enrollment AS enrollment
        ON enrollment.enrollment_id = graduation.enrollment_id
      JOIN academic.student AS student
        ON student.student_id = enrollment.student_id
      WHERE graduation.award IS NOT NULL
        AND student.admission_no NOT IN (${distinctionList})
    )
  THEN
    RAISE EXCEPTION 'Expanded fixture award assertion failed';
  END IF;

  IF EXISTS (
    WITH expected(admission_no, wallet_allowed, transcript_vc_eligible) AS (
      VALUES
${eligibilityValues}
    ),
    actual AS (
      SELECT student.admission_no,
        enrollment.academic_status IN (
          'studying', 'graduated', 'alumni'
        ) AS wallet_allowed,
        (
          enrollment.academic_status IN ('graduated', 'alumni')
          AND graduation.graduation_status = 'completed'
          AND graduation.requirements_fulfilled
          AND graduation.approved_at IS NOT NULL
          AND graduation.total_credits_earned >= program.required_credits
          AND transcript.document_status = 'issued'
        ) IS TRUE AS transcript_vc_eligible
      FROM academic.student AS student
      JOIN academic.student_program_enrollment AS enrollment
        ON enrollment.student_id = student.student_id
      JOIN academic.program AS program
        ON program.program_id = enrollment.program_id
      LEFT JOIN academic.graduation_record AS graduation
        ON graduation.enrollment_id = enrollment.enrollment_id
      LEFT JOIN academic.transcript AS transcript
        ON transcript.enrollment_id = enrollment.enrollment_id
    ),
    missing AS (SELECT * FROM expected EXCEPT SELECT * FROM actual),
    extra AS (SELECT * FROM actual EXCEPT SELECT * FROM expected)
    SELECT 1 FROM missing UNION ALL SELECT 1 FROM extra
  ) THEN
    RAISE EXCEPTION 'Expanded fixture eligibility assertion failed';
  END IF;

  IF (
    SELECT ROW(
      count(*) FILTER (WHERE academic_status = 'studying'),
      count(*) FILTER (WHERE academic_status = 'graduated'),
      count(*) FILTER (WHERE academic_status = 'alumni'),
      count(*) FILTER (WHERE academic_status = 'withdrawn')
    )
    FROM academic.student_program_enrollment
  ) IS DISTINCT FROM ROW(5::bigint, 5::bigint, 5::bigint, 5::bigint)
  THEN
    RAISE EXCEPTION 'Expanded fixture status distribution assertion failed';
  END IF;
END
$academic_expansion$;

COMMIT;
`;
}

function main() {
  validateFixtureModel();
  const { force, outputPath } = parseArguments(process.argv.slice(2));
  let secret = requireEnvironmentVariable('PASSPORT_HMAC_SECRET');
  delete process.env.PASSPORT_HMAC_SECRET;
  const secretBytes = Buffer.from(secret, 'utf8');
  secret = '';
  let passportDigests;
  try {
    passportDigests = STUDENTS.map((student) =>
      createSyntheticPassportDigest(student[0], secretBytes),
    );
  } finally {
    secretBytes.fill(0);
  }
  if (
    passportDigests.length !== 15 ||
    new Set(passportDigests).size !== 15 ||
    passportDigests.some((digest) => !/^[0-9a-f]{64}$/.test(digest))
  ) {
    fail('Synthetic passport digest assertion failed');
  }
  const sql = buildSql(passportDigests);
  passportDigests.fill('');
  writeFileSync(outputPath, sql, {
    encoding: 'utf8',
    flag: force ? 'w' : 'wx',
    mode: 0o600,
  });
  process.stdout.write(
    [
      'Generated protected synthetic academic student expansion SQL.',
      `Output: ${outputPath}`,
      'Additional rows: student=15, enrollment=15, course_result=493.',
      'Additional rows: graduation_record=7, transcript=7.',
      'Final rows: student=20, enrollment=20, course_result=649.',
      'No database statements were executed.',
    ].join('\n') + '\n',
  );
}

try {
  main();
} catch (error) {
  const message =
    error instanceof Error ? error.message : 'Unknown generator failure';
  process.stderr.write(`Academic expansion generation failed: ${message}\n`);
  process.exitCode = 1;
}
