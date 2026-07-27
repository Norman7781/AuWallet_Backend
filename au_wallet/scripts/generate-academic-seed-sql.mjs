import { createHmac } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PASSPORT_ENV_NAMES = [
  'SEED_PASSPORT_DEMO_STU_0001',
  'SEED_PASSPORT_DEMO_STU_0002',
  'SEED_PASSPORT_DEMO_STU_0003',
  'SEED_PASSPORT_DEMO_STU_0004',
  'SEED_PASSPORT_DEMO_STU_0005',
];

const OLD_ADMISSION_NUMBERS = [
  'DEMO-STU-0001',
  'DEMO-STU-0002',
  'DEMO-STU-0003',
  'DEMO-STU-0004',
  'DEMO-STU-0005',
];

const STUDENTS = [
  [
    '6899001',
    'Ms',
    'Araya',
    null,
    'Nopparat',
    '2006-09-18',
    'araya.nopparat@students.synthetic-au.test',
    null,
  ],
  [
    '6499002',
    'Mr',
    'Kawin',
    null,
    'Rattanakul',
    '2003-04-12',
    'kawin.rattanakul@students.synthetic-au.test',
    null,
  ],
  ['6399003', 'Ms', 'Lalita', null, 'Chansiri', '2001-08-27', null, null],
  [
    '6499004',
    'Mr',
    'Thanet',
    null,
    'Virojkul',
    '2002-12-05',
    'thanet.virojkul@students.synthetic-au.test',
    null,
  ],
  [
    '6699005',
    'Ms',
    'Mali',
    null,
    'Suthipong',
    '2004-06-21',
    'mali.suthipong@students.synthetic-au.test',
    null,
  ],
];

const ENROLLMENTS = [
  ['6899001', '2025-06-02', 'studying', null],
  ['6499002', '2021-06-07', 'graduated', null],
  ['6399003', '2020-06-08', 'alumni', 'Synthetic Transfer Institute'],
  ['6499004', '2021-06-07', 'graduated', null],
  ['6699005', '2023-06-05', 'withdrawn', null],
];

const COURSES = [
  ['ELE1101', 'Academic Communication Studio', 3, 'general_education'],
  ['ELE1201', 'Analytical Reading and Writing', 3, 'general_education'],
  ['GE1101', 'Quantitative Reasoning', 3, 'general_education'],
  ['GE1201', 'Science, Society and Sustainability', 2, 'general_education'],
  ['GE1301', 'Global Citizenship and Cultures', 2, 'general_education'],
  ['GE2101', 'Ethics in Contemporary Life', 2, 'general_education'],
  ['GE2201', 'Creative Inquiry and Design', 3, 'general_education'],
  ['GE2301', 'Thai Society in Global Context', 3, 'general_education'],
  [
    'GE2401',
    'Community Engagement and Service Learning',
    2,
    'general_education',
  ],
  ['BBA1101', 'Organizational Foundations', 2, 'business_core'],
  ['BBA1201', 'Economics for Digital Ventures', 3, 'business_core'],
  ['BBA1301', 'Accounting and Financial Literacy', 3, 'business_core'],
  ['BBA1401', 'Innovation, Law and Entrepreneurship', 3, 'business_core'],
  ['BBA1501', 'Digital Venture Workshop', 2, 'business_core'],
  ['CSX2101', 'Computational Problem Solving I', 3, 'computing_core'],
  ['CSX2102', 'Computational Problem Solving II', 3, 'computing_core'],
  ['CSX2201', 'Discrete Structures for Computing', 3, 'computing_core'],
  ['CSX2202', 'Data Organization and Algorithms', 3, 'computing_core'],
  ['ITX2101', 'Computer Systems Fundamentals', 3, 'computing_core'],
  ['ITX2201', 'Networked Systems Principles', 3, 'computing_core'],
  ['ITX2301', 'Data Management Foundations', 3, 'computing_core'],
  ['ITX2302', 'Operating Platforms and Concurrency', 3, 'computing_core'],
  ['CSX3101', 'Software Construction Methods', 3, 'computing_core'],
  ['ITX3101', 'Human-Centered Interface Engineering', 3, 'computing_core'],
  ['ITX3201', 'Web Systems Engineering', 3, 'computing_core'],
  ['CSX3201', 'Secure Computing Foundations', 3, 'computing_core'],
  ['ITX3301', 'Cloud-Native Systems', 3, 'computing_core'],
  ['CSX3301', 'Programming Language Concepts', 3, 'computing_core'],
  [
    'CSX3401',
    'Mathematical Methods for Intelligent Systems',
    3,
    'major_required',
  ],
  ['CSX3402', 'Statistical Modeling for Computing', 3, 'major_required'],
  ['CSX4101', 'Foundations of Artificial Intelligence', 3, 'major_required'],
  ['CSX4102', 'Applied Machine Learning', 3, 'major_required'],
  ['ITX4101', 'Data Engineering Pipelines', 3, 'major_required'],
  ['CSX4301', 'Information Visualization', 3, 'major_required'],
  ['CSX4302', 'Decision Analytics', 3, 'major_required'],
  ['CSX4401', 'Responsible Data Practice', 3, 'major_required'],
  ['CSX4402', 'Research Methods in Computing', 3, 'major_required'],
  ['CSX4501', 'Capstone Studio I', 3, 'major_required'],
  ['CSX4502', 'Capstone Studio II', 3, 'major_required'],
  ['ITX4301', 'Applied Informatics Integration', 3, 'major_required'],
  ['CSX4701', 'Natural Language Systems', 3, 'major_elective'],
  ['CSX4702', 'Vision and Multimedia Analytics', 3, 'major_elective'],
  ['CSX4703', 'Recommender and Personalization Systems', 3, 'major_elective'],
  ['ITX4701', 'Cyber Risk Analytics', 3, 'major_elective'],
  ['ITX4702', 'Distributed Data Platforms', 3, 'major_elective'],
  ['CSX4704', 'Emerging Topics in Informatics', 3, 'major_elective'],
  ['BG14901', 'Professional Responsibility Seminar I', 0, 'seminar'],
  ['BG14902', 'Professional Responsibility Seminar II', 0, 'seminar'],
  ['BG14903', 'Professional Responsibility Seminar III', 0, 'seminar'],
  ['BG14904', 'Professional Responsibility Seminar IV', 0, 'seminar'],
  ['BG14905', 'Professional Responsibility Seminar V', 0, 'seminar'],
  ['BG14906', 'Professional Responsibility Seminar VI', 0, 'seminar'],
  ['BG14907', 'Professional Responsibility Seminar VII', 0, 'seminar'],
  ['BG14908', 'Professional Responsibility Seminar VIII', 0, 'seminar'],
];

const TERMS = [
  ['2020/02', 2020, 2, 'Academic Year 2020 Semester 2'],
  ['2021/01', 2021, 1, 'Academic Year 2021 Semester 1'],
  ['2021/02', 2021, 2, 'Academic Year 2021 Semester 2'],
  ['2021/03', 2021, 3, 'Academic Year 2021 Semester 3'],
  ['2022/01', 2022, 1, 'Academic Year 2022 Semester 1'],
  ['2022/02', 2022, 2, 'Academic Year 2022 Semester 2'],
  ['2023/01', 2023, 1, 'Academic Year 2023 Semester 1'],
  ['2023/02', 2023, 2, 'Academic Year 2023 Semester 2'],
  ['2024/01', 2024, 1, 'Academic Year 2024 Semester 1'],
  ['2024/02', 2024, 2, 'Academic Year 2024 Semester 2'],
  ['2025/01', 2025, 1, 'Academic Year 2025 Semester 1'],
  ['2025/02', 2025, 2, 'Academic Year 2025 Semester 2'],
];

const COMPLETE_TERM_COURSES = [
  [
    '2021/01',
    ['ELE1101', 'ELE1201', 'GE1101', 'GE2201', 'GE1201', 'GE1301', 'BG14901'],
  ],
  [
    '2021/02',
    ['GE2301', 'BBA1201', 'BBA1301', 'BBA1401', 'GE2101', 'GE2401', 'BG14902'],
  ],
  [
    '2022/01',
    [
      'CSX2101',
      'CSX2102',
      'CSX2201',
      'CSX2202',
      'ITX2101',
      'BBA1101',
      'BG14903',
    ],
  ],
  [
    '2022/02',
    [
      'ITX2201',
      'ITX2301',
      'ITX2302',
      'CSX3101',
      'ITX3101',
      'BBA1501',
      'BG14904',
    ],
  ],
  [
    '2023/01',
    [
      'ITX3201',
      'CSX3201',
      'ITX3301',
      'CSX3301',
      'CSX3401',
      'CSX3402',
      'BG14905',
    ],
  ],
  [
    '2023/02',
    [
      'CSX4101',
      'CSX4102',
      'ITX4101',
      'CSX4301',
      'CSX4302',
      'CSX4401',
      'BG14906',
    ],
  ],
  [
    '2024/01',
    ['CSX4402', 'CSX4501', 'CSX4502', 'ITX4301', 'CSX4701', 'BG14907'],
  ],
  [
    '2024/02',
    ['CSX4702', 'CSX4703', 'ITX4701', 'ITX4702', 'CSX4704', 'BG14908'],
  ],
];

const GRADUATE_GRADES = [
  ['A', 'A-', 'B+', 'A', 'A', 'A', 'S'],
  ['A-', 'B+', 'A', 'A-', 'A-', 'A-', 'S'],
  ['B+', 'A', 'A-', 'B+', 'A', 'B+', 'S'],
  ['A-', 'B+', 'A', 'A-', 'B+', 'B', 'S'],
  ['B', 'B', 'A', 'A-', 'B+', 'A', 'S'],
  ['A-', 'B+', 'A', 'A-', 'B+', 'B', 'S'],
  ['A', 'A-', 'B', 'B', 'A', 'S'],
  ['A-', 'B+', 'A', 'A-', 'B', 'S'],
];

const AWAITING_GRADES = [
  ['A', 'A-', 'B+', 'B', 'A', 'A-', 'S'],
  ['A-', 'B+', 'A', 'A-', 'B+', 'B+', 'S'],
  ['B+', 'B', 'A-', 'B+', 'A', 'B', 'S'],
  ['A-', 'B+', 'B', 'A-', 'B+', 'C+', 'S'],
  ['B', 'B', 'A', 'A-', 'B+', 'B', 'S'],
  ['A-', 'B+', 'A', 'A-', 'B+', 'B', 'S'],
  ['B+', 'B', 'B-', 'B', 'A', 'S'],
  ['A-', 'B+', 'B-', 'B+', 'B', 'S'],
];

const ALUMNUS_TERM_COURSES = [
  ['2020/02', ['GE2201', 'GE2301', 'BBA1301', 'BBA1401', 'CSX2201', 'BG14901']],
  [
    '2021/01',
    ['CSX2202', 'ITX2101', 'ITX2201', 'ITX2301', 'GE1201', 'BG14902'],
  ],
  [
    '2021/02',
    [
      'ITX2302',
      'CSX3101',
      'ITX3101',
      'ITX3201',
      'CSX3201',
      'GE1301',
      'BG14903',
    ],
  ],
  ['2021/03', ['GE2101', 'BG14904']],
  [
    '2022/01',
    [
      'ITX3301',
      'CSX3301',
      'CSX3401',
      'CSX3402',
      'CSX4101',
      'CSX4102',
      'BG14905',
    ],
  ],
  [
    '2022/02',
    [
      'ITX4101',
      'CSX4301',
      'CSX4302',
      'CSX4401',
      'CSX4402',
      'CSX4501',
      'BG14906',
    ],
  ],
  [
    '2023/01',
    ['CSX4502', 'ITX4301', 'CSX4701', 'CSX4702', 'CSX4703', 'BG14907'],
  ],
  [
    '2023/02',
    [
      'ITX4701',
      'ITX4702',
      'CSX4704',
      'BBA1101',
      'GE2401',
      'BBA1501',
      'BG14908',
    ],
  ],
];

const ALUMNUS_GRADES = [
  ['A', 'A-', 'B+', 'A', 'A-', 'S'],
  ['B+', 'A', 'A-', 'B+', 'A', 'S'],
  ['A', 'A-', 'B+', 'A', 'A-', 'A-', 'S'],
  ['B+', 'S'],
  ['B+', 'A', 'A-', 'B+', 'B', 'B', 'S'],
  ['A', 'A-', 'B+', 'B', 'A', 'A-', 'S'],
  ['B+', 'B', 'A', 'A-', 'B+', 'S'],
  ['A', 'A-', 'B', 'A', 'A-', 'B', 'S'],
];

const COURSE_BY_CODE = new Map(COURSES.map((course) => [course[0], course]));
const COURSE_RESULTS = [];

function addTermResults(admissionNo, termCourseGroups, gradeGroups) {
  termCourseGroups.forEach(([termCode, courseCodes], groupIndex) => {
    const grades = gradeGroups[groupIndex];
    if (courseCodes.length !== grades.length) {
      fail(`Grade allocation length mismatch for ${admissionNo} ${termCode}`);
    }
    courseCodes.forEach((courseCode, courseIndex) => {
      const course = COURSE_BY_CODE.get(courseCode);
      if (!course) {
        fail(`Unknown course code in result allocation: ${courseCode}`);
      }
      const grade = grades[courseIndex];
      const resultType = course[2] === 0 ? 'seminar' : 'normal';
      COURSE_RESULTS.push([
        admissionNo,
        termCode,
        courseCode,
        course[2],
        grade,
        resultType,
      ]);
    });
  });
}

addTermResults('6499002', COMPLETE_TERM_COURSES, GRADUATE_GRADES);
addTermResults('6499004', COMPLETE_TERM_COURSES, AWAITING_GRADES);

for (const courseCode of [
  'ELE1101',
  'ELE1201',
  'GE1101',
  'BBA1201',
  'CSX2101',
  'CSX2102',
]) {
  COURSE_RESULTS.push(['6399003', null, courseCode, 3, 'TR', 'transfer']);
}
addTermResults('6399003', ALUMNUS_TERM_COURSES, ALUMNUS_GRADES);

addTermResults(
  '6899001',
  [
    [
      '2025/01',
      ['ELE1101', 'ELE1201', 'GE1101', 'GE1201', 'GE1301', 'BG14901'],
    ],
    ['2025/02', ['GE2101', 'GE2201', 'GE2301', 'GE2401', 'BBA1101', 'BG14902']],
  ],
  [
    ['B+', 'A-', 'B', 'A', 'A-', 'S'],
    ['B+', 'B', 'A-', 'B+', 'B', 'S'],
  ],
);

addTermResults(
  '6699005',
  [
    ['2023/01', ['ELE1101', 'ELE1201', 'GE1101', 'GE1201', 'BG14901']],
    ['2023/02', ['GE1301', 'GE2101', 'GE2201', 'GE2301']],
  ],
  [
    ['C+', 'B-', 'B', 'C', 'S'],
    ['B', 'C+', 'B-', 'C'],
  ],
);

const GRADUATIONS = [
  [
    '6499002',
    '2026-01-17',
    132,
    0,
    132,
    3.59,
    'Academic Distinction',
    true,
    'completed',
    '2025-04-18 09:00:00+07',
  ],
  [
    '6399003',
    '2025-01-18',
    114,
    18,
    132,
    3.59,
    'Academic Distinction',
    true,
    'completed',
    '2024-04-19 09:00:00+07',
  ],
  [
    '6499004',
    '2026-01-17',
    132,
    0,
    132,
    3.39,
    null,
    true,
    'completed',
    '2025-04-18 11:00:00+07',
  ],
];

const TRANSCRIPTS = [
  [
    '6499002',
    'SYN-AU-TR-2025-6499002',
    'SYNV-25-6499002-X7K9',
    '2025-05-02',
    true,
    'issued',
    'Office of the University Registrar',
  ],
  [
    '6399003',
    'SYN-AU-TR-2024-6399003',
    'SYNV-24-6399003-M4Q8',
    '2024-05-03',
    true,
    'issued',
    'Office of the University Registrar',
  ],
  ['6499004', null, null, null, false, 'draft', null],
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

function fail(message) {
  throw new Error(message);
}

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
  if (unknownFlags.length > 0) {
    fail('Unknown command-line option');
  }
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

function createPassportDigest(environmentName, secretBytes) {
  let rawPassport = requireEnvironmentVariable(environmentName);
  delete process.env[environmentName];
  let normalizedPassport = '';
  let normalizedBytes;
  try {
    normalizedPassport = normalizePassport(rawPassport);
    normalizedBytes = Buffer.from(normalizedPassport, 'utf8');
    return createHmac('sha256', secretBytes)
      .update(normalizedBytes)
      .digest('hex');
  } finally {
    rawPassport = '';
    normalizedPassport = '';
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
  integer: (value) => `${value}::integer`,
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
  const admissionNumbers = new Set(STUDENTS.map((student) => student[0]));
  const courseCodes = new Set(COURSES.map((course) => course[0]));
  const termCodes = new Set(TERMS.map((term) => term[0]));
  if (
    admissionNumbers.size !== 5 ||
    courseCodes.size !== 54 ||
    termCodes.size !== 12
  ) {
    fail('Fixture natural keys are not unique');
  }
  const creditDistribution = new Map();
  for (const course of COURSES) {
    creditDistribution.set(
      course[2],
      (creditDistribution.get(course[2]) ?? 0) + 1,
    );
  }
  const catalogCredits = COURSES.reduce((sum, course) => sum + course[2], 0);
  if (
    creditDistribution.get(3) !== 40 ||
    creditDistribution.get(2) !== 6 ||
    creditDistribution.get(0) !== 8 ||
    catalogCredits !== 132
  ) {
    fail('Catalog credit assertions failed');
  }
  const expected = new Map([
    ['6899001', [12, 10, 0, 2, 25]],
    ['6499002', [54, 46, 0, 8, 132]],
    ['6399003', [54, 40, 6, 8, 114]],
    ['6499004', [54, 46, 0, 8, 132]],
    ['6699005', [9, 8, 0, 1, 21]],
  ]);
  const pairs = new Set();
  for (const [
    admissionNo,
    termCode,
    courseCode,
    credits,
    grade,
    resultType,
  ] of COURSE_RESULTS) {
    if (!admissionNumbers.has(admissionNo) || !courseCodes.has(courseCode)) {
      fail('Course result references an unknown natural key');
    }
    if (termCode !== null && !termCodes.has(termCode)) {
      fail('Course result references an unknown term');
    }
    if (pairs.has(`${admissionNo}:${courseCode}`)) {
      fail('Duplicate enrollment/course result allocation');
    }
    pairs.add(`${admissionNo}:${courseCode}`);
    const catalogCreditsForCourse = COURSE_BY_CODE.get(courseCode)[2];
    if (resultType === 'normal' && credits !== catalogCreditsForCourse) {
      fail('Normal result credits differ from catalog credits');
    }
    if (resultType === 'transfer' && (grade !== 'TR' || termCode !== null)) {
      fail('Transfer result contract failed');
    }
    if (resultType === 'seminar' && (grade !== 'S' || credits !== 0)) {
      fail('Seminar result contract failed');
    }
  }
  if (COURSE_RESULTS.length !== 183) {
    fail('Global course-result count assertion failed');
  }
  for (const [admissionNo, expectedValues] of expected) {
    const rows = COURSE_RESULTS.filter((result) => result[0] === admissionNo);
    const actualValues = [
      rows.length,
      rows.filter((result) => result[5] === 'normal').length,
      rows.filter((result) => result[5] === 'transfer').length,
      rows.filter((result) => result[5] === 'seminar').length,
      rows
        .filter((result) => result[5] === 'normal')
        .reduce((sum, result) => sum + result[3], 0),
    ];
    if (actualValues.some((value, index) => value !== expectedValues[index])) {
      fail(`Scenario result assertion failed for ${admissionNo}`);
    }
  }
  const typeCounts = new Map();
  COURSE_RESULTS.forEach((result) =>
    typeCounts.set(result[5], (typeCounts.get(result[5]) ?? 0) + 1),
  );
  if (
    typeCounts.get('normal') !== 150 ||
    typeCounts.get('transfer') !== 6 ||
    typeCounts.get('seminar') !== 27
  ) {
    fail('Course-result type count assertion failed');
  }
  const expectedGpa = new Map([
    ['6499002', [132, 474, 3.59]],
    ['6399003', [114, 408.75, 3.59]],
    ['6499004', [132, 447, 3.39]],
  ]);
  for (const [
    admissionNo,
    [expectedCredits, expectedPoints, storedGpa],
  ] of expectedGpa) {
    const graded = COURSE_RESULTS.filter(
      (result) => result[0] === admissionNo && result[5] === 'normal',
    );
    const credits = graded.reduce((sum, result) => sum + result[3], 0);
    const points = graded.reduce(
      (sum, result) => sum + result[3] * GRADE_POINTS.get(result[4]),
      0,
    );
    if (
      credits !== expectedCredits ||
      points !== expectedPoints ||
      Math.round((points / credits) * 100) / 100 !== storedGpa
    ) {
      fail(`GPA assertion failed for ${admissionNo}`);
    }
  }
}

function buildSql(passportDigests) {
  const newStudentRows = STUDENTS.map((student, index) => [
    ...student,
    passportDigests[index],
  ]);
  const oldStudentRows = [
    [
      'DEMO-STU-0001',
      null,
      'Avery',
      null,
      'Testwell',
      '2004-03-14',
      'avery.current@student.demo-university.test',
      passportDigests[0],
    ],
    [
      'DEMO-STU-0002',
      null,
      'Blair',
      null,
      'Mockridge',
      '1999-11-22',
      'blair.graduate@student.demo-university.test',
      passportDigests[1],
    ],
    [
      'DEMO-STU-0003',
      null,
      'Casey',
      null,
      'Fictionvale',
      '1996-05-09',
      null,
      passportDigests[2],
    ],
    [
      'DEMO-STU-0004',
      null,
      'Devon',
      null,
      'Sampleton',
      '2000-07-18',
      'devon.pending@student.demo-university.test',
      passportDigests[3],
    ],
    [
      'DEMO-STU-0005',
      null,
      'Ellis',
      null,
      'Demowood',
      '2002-01-30',
      'ellis.withdrawn@student.demo-university.test',
      passportDigests[4],
    ],
  ];
  const oldEnrollmentRows = [
    ['DEMO-STU-0001', '2023-08-15', 'studying', null],
    ['DEMO-STU-0002', '2018-08-15', 'graduated', null],
    ['DEMO-STU-0003', '2015-08-17', 'alumni', null],
    ['DEMO-STU-0004', '2019-08-19', 'graduated', null],
    ['DEMO-STU-0005', '2021-08-16', 'withdrawn', null],
  ];
  const oldGraduationRows = [
    [
      'DEMO-STU-0002',
      '2022-07-15',
      132,
      0,
      132,
      null,
      null,
      true,
      'completed',
      '2022-07-20 09:00:00+07',
    ],
    [
      'DEMO-STU-0003',
      '2019-07-12',
      138,
      0,
      138,
      null,
      null,
      true,
      'completed',
      '2019-07-18 09:00:00+07',
    ],
    [
      'DEMO-STU-0004',
      '2023-07-14',
      132,
      0,
      132,
      null,
      null,
      true,
      'completed',
      '2023-07-20 09:00:00+07',
    ],
  ];
  const oldTranscriptRows = [
    [
      'DEMO-STU-0002',
      'DEMO-TR-0002',
      'DEMO-VERIFY-0002',
      '2022-07-22',
      true,
      'issued',
      'Synthetic Registrar',
    ],
    [
      'DEMO-STU-0003',
      'DEMO-TR-0003',
      'DEMO-VERIFY-0003',
      '2019-07-19',
      true,
      'issued',
      'Synthetic Registrar',
    ],
    ['DEMO-STU-0004', null, null, null, false, 'draft', null],
  ];

  const studentTypes = [
    'text',
    'text',
    'text',
    'text',
    'text',
    'date',
    'text',
    'text',
    'text',
  ];
  const enrollmentTypes = ['text', 'date', 'text', 'text'];
  const courseTypes = ['text', 'text', 'numeric', 'text'];
  const termTypes = ['text', 'integer', 'integer', 'text'];
  const resultTypes = ['text', 'text', 'text', 'numeric', 'text', 'text'];
  const graduationTypes = [
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
  ];
  const transcriptTypes = [
    'text',
    'text',
    'text',
    'date',
    'boolean',
    'text',
    'text',
  ];

  const oldStudentValues = valuesSql(oldStudentRows, [
    'text',
    'text',
    'text',
    'text',
    'text',
    'date',
    'text',
    'text',
  ]);
  const oldEnrollmentValues = valuesSql(oldEnrollmentRows, enrollmentTypes);
  const oldGraduationValues = valuesSql(oldGraduationRows, graduationTypes);
  const oldTranscriptValues = valuesSql(oldTranscriptRows, transcriptTypes);
  const studentValues = valuesSql(newStudentRows, studentTypes);
  const enrollmentValues = valuesSql(ENROLLMENTS, enrollmentTypes);
  const courseValues = valuesSql(COURSES, courseTypes);
  const termValues = valuesSql(TERMS, termTypes);
  const resultValues = valuesSql(COURSE_RESULTS, resultTypes);
  const graduationValues = valuesSql(GRADUATIONS, graduationTypes);
  const transcriptValues = valuesSql(TRANSCRIPTS, transcriptTypes);
  const oldAdmissions = OLD_ADMISSION_NUMBERS.map(quote).join(', ');
  const newAdmissions = STUDENTS.map((student) => quote(student[0])).join(', ');
  const courseCodes = COURSES.map((course) => quote(course[0])).join(', ');
  const termCodes = TERMS.map((term) => quote(term[0])).join(', ');

  return `-- Protected synthetic academic fixture replacement.
-- Intended Supabase project ref: ezsylcmnqbcwvkoqybkd.
-- This file contains derived passport HMACs and must remain temporary.

BEGIN;

SELECT pg_advisory_xact_lock(
  hashtextextended('au_wallet.academic.synthetic_fixtures.v2', 0)
);

DO $academic_seed$
DECLARE
  old_any boolean;
  new_any boolean;
  affected_rows integer;
  old_enrollment_ids bigint[];
BEGIN
  SELECT
    EXISTS (SELECT 1 FROM academic.program WHERE program_code = 'DEMO-BSCS')
    OR EXISTS (SELECT 1 FROM academic.student WHERE admission_no IN (${oldAdmissions}))
    OR EXISTS (
      SELECT 1 FROM academic.transcript
      WHERE document_number IN ('DEMO-TR-0002', 'DEMO-TR-0003')
         OR verification_code IN ('DEMO-VERIFY-0002', 'DEMO-VERIFY-0003')
    )
  INTO old_any;

  SELECT
    EXISTS (SELECT 1 FROM academic.program WHERE program_code = 'SYN-VMES-CSIDS')
    OR EXISTS (SELECT 1 FROM academic.student WHERE admission_no IN (${newAdmissions}))
    OR EXISTS (SELECT 1 FROM academic.academic_term WHERE term_code IN (${termCodes}))
    OR EXISTS (
      SELECT 1 FROM academic.transcript
      WHERE document_number IN ('SYN-AU-TR-2025-6499002', 'SYN-AU-TR-2024-6399003')
         OR verification_code IN ('SYNV-25-6499002-X7K9', 'SYNV-24-6399003-M4Q8')
    )
  INTO new_any;

  IF old_any AND NOT new_any THEN
    -- State A: verify the complete old fixture before any mutation.
    IF (SELECT count(*) FROM academic.program) <> 1
      OR (SELECT count(*) FROM academic.student) <> 5
      OR (SELECT count(*) FROM academic.student_program_enrollment) <> 5
      OR (SELECT count(*) FROM academic.course) <> 0
      OR (SELECT count(*) FROM academic.academic_term) <> 0
      OR (SELECT count(*) FROM academic.course_result) <> 0
      OR (SELECT count(*) FROM academic.transcript) <> 3
      OR (SELECT count(*) FROM academic.graduation_record) <> 3
      OR (SELECT count(*) FROM wallet.holder_account) <> 0
      OR (SELECT count(*) FROM wallet.wallet_onboarding_request) <> 0
      OR (SELECT count(*) FROM wallet.uploaded_identity_document) <> 0
    THEN
      RAISE EXCEPTION 'State A rejected: old fixture table counts do not match exactly';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM academic.program
      WHERE program_code = 'DEMO-BSCS'
        AND faculty_code = 'DEMO-SCIT'
        AND faculty_name = 'Synthetic Faculty of Science and Technology'
        AND degree_level = 'bachelor'
        AND degree_name = 'Bachelor of Science'
        AND major = 'Computer Science'
        AND major_concentration IS NULL
        AND required_credits = 132::numeric
        AND is_active
    ) THEN
      RAISE EXCEPTION 'State A rejected: old program differs';
    END IF;

    IF EXISTS (
      WITH expected(admission_no, title, first_name, middle_name, last_name, date_of_birth, university_email, passport_number_hmac) AS (
        VALUES
${oldStudentValues}
      ),
      actual AS (
        SELECT admission_no, title, first_name, middle_name, last_name, date_of_birth,
          university_email, passport_number_hmac
        FROM academic.student
      ),
      missing AS (SELECT * FROM expected EXCEPT SELECT * FROM actual),
      extra AS (SELECT * FROM actual EXCEPT SELECT * FROM expected)
      SELECT 1 FROM missing UNION ALL SELECT 1 FROM extra
    ) THEN
      RAISE EXCEPTION 'State A rejected: old students differ';
    END IF;

    IF EXISTS (
      WITH expected(admission_no, admission_date, academic_status, previous_institution_name) AS (
        VALUES
${oldEnrollmentValues}
      ),
      actual AS (
        SELECT student.admission_no, enrollment.admission_date,
          enrollment.academic_status, enrollment.previous_institution_name
        FROM academic.student_program_enrollment AS enrollment
        JOIN academic.student AS student ON student.student_id = enrollment.student_id
        JOIN academic.program AS program ON program.program_id = enrollment.program_id
        WHERE program.program_code = 'DEMO-BSCS'
      ),
      missing AS (SELECT * FROM expected EXCEPT SELECT * FROM actual),
      extra AS (SELECT * FROM actual EXCEPT SELECT * FROM expected)
      SELECT 1 FROM missing UNION ALL SELECT 1 FROM extra
    ) THEN
      RAISE EXCEPTION 'State A rejected: old enrollments differ';
    END IF;

    IF EXISTS (
      WITH expected(admission_no, graduation_date, total_credits_completed,
        total_credits_transferred, total_credits_earned, cumulative_gpa, award,
        requirements_fulfilled, graduation_status, approved_at) AS (
        VALUES
${oldGraduationValues}
      ),
      actual AS (
        SELECT student.admission_no, graduation.graduation_date,
          graduation.total_credits_completed, graduation.total_credits_transferred,
          graduation.total_credits_earned, graduation.cumulative_gpa, graduation.award,
          graduation.requirements_fulfilled, graduation.graduation_status,
          graduation.approved_at
        FROM academic.graduation_record AS graduation
        JOIN academic.student_program_enrollment AS enrollment
          ON enrollment.enrollment_id = graduation.enrollment_id
        JOIN academic.student AS student ON student.student_id = enrollment.student_id
      ),
      missing AS (SELECT * FROM expected EXCEPT SELECT * FROM actual),
      extra AS (SELECT * FROM actual EXCEPT SELECT * FROM expected)
      SELECT 1 FROM missing UNION ALL SELECT 1 FROM extra
    ) THEN
      RAISE EXCEPTION 'State A rejected: old graduation records differ';
    END IF;

    IF EXISTS (
      WITH expected(admission_no, document_number, verification_code, issued_on,
        is_certified_true_copy, document_status, registrar_name) AS (
        VALUES
${oldTranscriptValues}
      ),
      actual AS (
        SELECT student.admission_no, transcript.document_number,
          transcript.verification_code, transcript.issued_on,
          transcript.is_certified_true_copy, transcript.document_status,
          transcript.registrar_name
        FROM academic.transcript AS transcript
        JOIN academic.student_program_enrollment AS enrollment
          ON enrollment.enrollment_id = transcript.enrollment_id
        JOIN academic.student AS student ON student.student_id = enrollment.student_id
      ),
      missing AS (SELECT * FROM expected EXCEPT SELECT * FROM actual),
      extra AS (SELECT * FROM actual EXCEPT SELECT * FROM expected)
      SELECT 1 FROM missing UNION ALL SELECT 1 FROM extra
    ) THEN
      RAISE EXCEPTION 'State A rejected: old transcripts differ';
    END IF;

    SELECT array_agg(enrollment.enrollment_id ORDER BY enrollment.enrollment_id)
    INTO old_enrollment_ids
    FROM academic.student_program_enrollment AS enrollment
    JOIN academic.student AS student ON student.student_id = enrollment.student_id
    JOIN academic.program AS program ON program.program_id = enrollment.program_id
    WHERE program.program_code = 'DEMO-BSCS'
      AND student.admission_no IN (${oldAdmissions});

    IF cardinality(old_enrollment_ids) <> 5 THEN
      RAISE EXCEPTION 'State A rejected: old enrollment resolution failed';
    END IF;

    DELETE FROM academic.transcript
    WHERE enrollment_id = ANY(old_enrollment_ids);
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 3 THEN
      RAISE EXCEPTION 'State A replacement transcript delete count mismatch';
    END IF;

    DELETE FROM academic.graduation_record
    WHERE enrollment_id = ANY(old_enrollment_ids);
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 3 THEN
      RAISE EXCEPTION 'State A replacement graduation delete count mismatch';
    END IF;

    DELETE FROM academic.student_program_enrollment
    WHERE enrollment_id = ANY(old_enrollment_ids);
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 5 THEN
      RAISE EXCEPTION 'State A replacement enrollment delete count mismatch';
    END IF;

    DELETE FROM academic.student
    WHERE admission_no IN (${oldAdmissions});
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 5 THEN
      RAISE EXCEPTION 'State A replacement student delete count mismatch';
    END IF;

    DELETE FROM academic.program
    WHERE program_code = 'DEMO-BSCS';
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 1 THEN
      RAISE EXCEPTION 'State A replacement program delete count mismatch';
    END IF;

    INSERT INTO academic.program (
      faculty_code, faculty_name, program_code, degree_level, degree_name,
      major, major_concentration, required_credits, is_active
    ) VALUES (
      'VMES', 'Vincent Mary School of Engineering, Science and Technology',
      'SYN-VMES-CSIDS', 'bachelor', 'Bachelor of Science', 'Computer Science',
      'Informatics and Data Science', 132::numeric, true
    );

    INSERT INTO academic.student (
      admission_no, title, first_name, middle_name, last_name, date_of_birth,
      university_email, personal_email, passport_number_hmac
    )
    VALUES
${studentValues};

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
    JOIN academic.student AS student ON student.admission_no = fixture.admission_no
    JOIN academic.program AS program ON program.program_code = 'SYN-VMES-CSIDS';

    INSERT INTO academic.course (
      program_id, course_code, course_title, default_credits, course_category,
      is_active
    )
    SELECT program.program_id, fixture.course_code, fixture.course_title,
      fixture.default_credits, fixture.course_category, true
    FROM (
      VALUES
${courseValues}
    ) AS fixture(course_code, course_title, default_credits, course_category)
    JOIN academic.program AS program ON program.program_code = 'SYN-VMES-CSIDS';

    INSERT INTO academic.academic_term (
      term_code, academic_year, semester_no, term_label
    )
    VALUES
${termValues};

    INSERT INTO academic.course_result (
      enrollment_id, academic_term_id, course_id, credits, grade, result_type
    )
    SELECT enrollment.enrollment_id, term.academic_term_id, course.course_id,
      fixture.credits, fixture.grade, fixture.result_type
    FROM (
      VALUES
${resultValues}
    ) AS fixture(admission_no, term_code, course_code, credits, grade, result_type)
    JOIN academic.student AS student ON student.admission_no = fixture.admission_no
    JOIN academic.student_program_enrollment AS enrollment
      ON enrollment.student_id = student.student_id
    JOIN academic.program AS program
      ON program.program_id = enrollment.program_id
     AND program.program_code = 'SYN-VMES-CSIDS'
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
    JOIN academic.student AS student ON student.admission_no = fixture.admission_no
    JOIN academic.student_program_enrollment AS enrollment
      ON enrollment.student_id = student.student_id
    JOIN academic.program AS program
      ON program.program_id = enrollment.program_id
     AND program.program_code = 'SYN-VMES-CSIDS';

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
    JOIN academic.student AS student ON student.admission_no = fixture.admission_no
    JOIN academic.student_program_enrollment AS enrollment
      ON enrollment.student_id = student.student_id
    JOIN academic.program AS program
      ON program.program_id = enrollment.program_id
     AND program.program_code = 'SYN-VMES-CSIDS';

  ELSIF NOT old_any AND new_any THEN
    -- State B: validation-only no-op. The assertions below require exact equality.
    NULL;
  ELSIF old_any AND new_any THEN
    RAISE EXCEPTION 'Replacement rejected: old and revised fixture keys coexist';
  ELSE
    RAISE EXCEPTION 'Replacement rejected: neither exact fixture state is present';
  END IF;

  -- Exact revised-state table counts, including wallet isolation.
  IF (SELECT count(*) FROM academic.program) <> 1
    OR (SELECT count(*) FROM academic.student) <> 5
    OR (SELECT count(*) FROM academic.student_program_enrollment) <> 5
    OR (SELECT count(*) FROM academic.course) <> 54
    OR (SELECT count(*) FROM academic.academic_term) <> 12
    OR (SELECT count(*) FROM academic.course_result) <> 183
    OR (SELECT count(*) FROM academic.transcript) <> 3
    OR (SELECT count(*) FROM academic.graduation_record) <> 3
    OR (SELECT count(*) FROM wallet.holder_account) <> 0
    OR (SELECT count(*) FROM wallet.wallet_onboarding_request) <> 0
    OR (SELECT count(*) FROM wallet.uploaded_identity_document) <> 0
  THEN
    RAISE EXCEPTION 'Revised fixture table-count assertion failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM academic.program
    WHERE faculty_code = 'VMES'
      AND faculty_name = 'Vincent Mary School of Engineering, Science and Technology'
      AND program_code = 'SYN-VMES-CSIDS'
      AND degree_level = 'bachelor'
      AND degree_name = 'Bachelor of Science'
      AND major = 'Computer Science'
      AND major_concentration = 'Informatics and Data Science'
      AND required_credits = 132::numeric
      AND is_active
  ) THEN
    RAISE EXCEPTION 'Revised fixture program assertion failed';
  END IF;

  IF EXISTS (
    WITH expected(admission_no, title, first_name, middle_name, last_name,
      date_of_birth, university_email, personal_email, passport_number_hmac) AS (
      VALUES
${studentValues}
    ),
    actual AS (
      SELECT admission_no, title, first_name, middle_name, last_name,
        date_of_birth, university_email, personal_email, passport_number_hmac
      FROM academic.student
    ),
    missing AS (SELECT * FROM expected EXCEPT SELECT * FROM actual),
    extra AS (SELECT * FROM actual EXCEPT SELECT * FROM expected)
    SELECT 1 FROM missing UNION ALL SELECT 1 FROM extra
  ) THEN
    RAISE EXCEPTION 'Revised fixture student assertion failed';
  END IF;

  IF (SELECT count(*) FROM academic.student
      WHERE passport_number_hmac ~ '^[0-9a-f]{64}$') <> 5
    OR (SELECT count(DISTINCT passport_number_hmac) FROM academic.student) <> 5
  THEN
    RAISE EXCEPTION 'Revised fixture passport HMAC assertion failed';
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
      JOIN academic.student AS student ON student.student_id = enrollment.student_id
      JOIN academic.program AS program ON program.program_id = enrollment.program_id
      WHERE program.program_code = 'SYN-VMES-CSIDS'
    ),
    missing AS (SELECT * FROM expected EXCEPT SELECT * FROM actual),
    extra AS (SELECT * FROM actual EXCEPT SELECT * FROM expected)
    SELECT 1 FROM missing UNION ALL SELECT 1 FROM extra
  ) THEN
    RAISE EXCEPTION 'Revised fixture enrollment assertion failed';
  END IF;

  IF EXISTS (
    WITH expected(course_code, course_title, default_credits, course_category) AS (
      VALUES
${courseValues}
    ),
    actual AS (
      SELECT course.course_code, course.course_title, course.default_credits,
        course.course_category
      FROM academic.course AS course
      JOIN academic.program AS program ON program.program_id = course.program_id
      WHERE program.program_code = 'SYN-VMES-CSIDS' AND course.is_active
    ),
    missing AS (SELECT * FROM expected EXCEPT SELECT * FROM actual),
    extra AS (SELECT * FROM actual EXCEPT SELECT * FROM expected)
    SELECT 1 FROM missing UNION ALL SELECT 1 FROM extra
  ) THEN
    RAISE EXCEPTION 'Revised fixture course catalog differs';
  END IF;

  IF (
    SELECT ROW(
      count(*),
      count(*) FILTER (WHERE default_credits = 3),
      count(*) FILTER (WHERE default_credits = 2),
      count(*) FILTER (WHERE default_credits = 0),
      sum(default_credits),
      count(DISTINCT course_code)
    )
    FROM academic.course AS course
    JOIN academic.program AS program ON program.program_id = course.program_id
    WHERE program.program_code = 'SYN-VMES-CSIDS' AND course.is_active
  ) IS DISTINCT FROM ROW(54::bigint, 40::bigint, 6::bigint, 8::bigint, 132::numeric, 54::bigint)
  THEN
    RAISE EXCEPTION 'Revised fixture catalog aggregate assertion failed';
  END IF;

  IF EXISTS (
    WITH expected(term_code, academic_year, semester_no, term_label) AS (
      VALUES
${termValues}
    ),
    actual AS (
      SELECT term_code, academic_year, semester_no, term_label
      FROM academic.academic_term
    ),
    missing AS (SELECT * FROM expected EXCEPT SELECT * FROM actual),
    extra AS (SELECT * FROM actual EXCEPT SELECT * FROM expected)
    SELECT 1 FROM missing UNION ALL SELECT 1 FROM extra
  ) THEN
    RAISE EXCEPTION 'Revised fixture academic terms differ';
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
      JOIN academic.student AS student ON student.student_id = enrollment.student_id
      JOIN academic.course AS course ON course.course_id = result.course_id
      LEFT JOIN academic.academic_term AS term
        ON term.academic_term_id = result.academic_term_id
    ),
    missing AS (SELECT * FROM expected EXCEPT SELECT * FROM actual),
    extra AS (SELECT * FROM actual EXCEPT SELECT * FROM expected)
    SELECT 1 FROM missing UNION ALL SELECT 1 FROM extra
  ) THEN
    RAISE EXCEPTION 'Revised fixture course results differ';
  END IF;

  IF (
    SELECT ROW(
      count(*) FILTER (WHERE result_type = 'normal'),
      count(*) FILTER (WHERE result_type = 'transfer'),
      count(*) FILTER (WHERE result_type = 'seminar')
    )
    FROM academic.course_result
  ) IS DISTINCT FROM ROW(150::bigint, 6::bigint, 27::bigint)
  THEN
    RAISE EXCEPTION 'Revised fixture result-type assertion failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM academic.course_result
    GROUP BY enrollment_id, course_id
    HAVING count(*) <> 1
  ) THEN
    RAISE EXCEPTION 'Revised fixture duplicate enrollment/course result';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM academic.course_result AS result
    JOIN academic.course AS course ON course.course_id = result.course_id
    WHERE result.result_type = 'normal'
      AND result.credits IS DISTINCT FROM course.default_credits
  ) THEN
    RAISE EXCEPTION 'Normal result credits do not match catalog';
  END IF;

  IF EXISTS (
    SELECT 1 FROM academic.course_result
    WHERE result_type = 'transfer'
      AND (grade <> 'TR' OR academic_term_id IS NOT NULL)
  ) OR (
    SELECT count(*) FROM academic.course_result
    WHERE result_type = 'transfer'
  ) <> 6 THEN
    RAISE EXCEPTION 'Transfer result assertion failed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM academic.course_result
    WHERE result_type = 'seminar'
      AND (grade <> 'S' OR credits <> 0::numeric)
  ) OR (
    SELECT count(*) FROM academic.course_result
    WHERE result_type = 'seminar'
  ) <> 27 THEN
    RAISE EXCEPTION 'Seminar result assertion failed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM academic.academic_term WHERE term_code LIKE '2026/%'
  ) OR NOT EXISTS (
    SELECT 1
    FROM academic.academic_term
    WHERE term_code = '2021/03'
      AND academic_year = 2021
      AND semester_no = 3
  ) OR EXISTS (
    SELECT 1
    FROM academic.course_result AS result
    LEFT JOIN academic.academic_term AS term
      ON term.academic_term_id = result.academic_term_id
    WHERE result.academic_term_id IS NOT NULL
      AND (
        term.term_code IS NULL
        OR term.term_code NOT IN (${termCodes})
      )
  ) THEN
    RAISE EXCEPTION 'Academic calendar term-set assertion failed';
  END IF;

  IF EXISTS (
    WITH expected(admission_no, result_count, completed_credits) AS (
      VALUES
        ('6899001'::text, 12::bigint, 25::numeric),
        ('6499002'::text, 54::bigint, 132::numeric),
        ('6399003'::text, 54::bigint, 114::numeric),
        ('6499004'::text, 54::bigint, 132::numeric),
        ('6699005'::text, 9::bigint, 21::numeric)
    ),
    actual AS (
      SELECT student.admission_no, count(*)::bigint AS result_count,
        sum(result.credits) FILTER (WHERE result.result_type = 'normal') AS completed_credits
      FROM academic.course_result AS result
      JOIN academic.student_program_enrollment AS enrollment
        ON enrollment.enrollment_id = result.enrollment_id
      JOIN academic.student AS student ON student.student_id = enrollment.student_id
      GROUP BY student.admission_no
    ),
    missing AS (SELECT * FROM expected EXCEPT SELECT * FROM actual),
    extra AS (SELECT * FROM actual EXCEPT SELECT * FROM expected)
    SELECT 1 FROM missing UNION ALL SELECT 1 FROM extra
  ) THEN
    RAISE EXCEPTION 'Scenario result count or completed-credit assertion failed';
  END IF;

  IF EXISTS (
    WITH grade_totals AS (
      SELECT student.admission_no,
        sum(result.credits) FILTER (WHERE result.result_type = 'normal') AS gpa_credits,
        sum(result.credits * CASE result.grade
          WHEN 'A' THEN 4.00 WHEN 'A-' THEN 3.75 WHEN 'B+' THEN 3.25
          WHEN 'B' THEN 3.00 WHEN 'B-' THEN 2.75 WHEN 'C+' THEN 2.25
          WHEN 'C' THEN 2.00 ELSE NULL END
        ) FILTER (WHERE result.result_type = 'normal') AS grade_points
      FROM academic.course_result AS result
      JOIN academic.student_program_enrollment AS enrollment
        ON enrollment.enrollment_id = result.enrollment_id
      JOIN academic.student AS student ON student.student_id = enrollment.student_id
      WHERE student.admission_no IN ('6499002', '6399003', '6499004')
      GROUP BY student.admission_no
    ),
    expected(admission_no, gpa_credits, grade_points, stored_gpa) AS (
      VALUES
        ('6499002'::text, 132::numeric, 474.00::numeric, 3.59::numeric),
        ('6399003'::text, 114::numeric, 408.75::numeric, 3.59::numeric),
        ('6499004'::text, 132::numeric, 447.00::numeric, 3.39::numeric)
    )
    SELECT 1
    FROM expected
    JOIN grade_totals USING (admission_no)
    JOIN academic.student AS student USING (admission_no)
    JOIN academic.student_program_enrollment AS enrollment
      ON enrollment.student_id = student.student_id
    JOIN academic.graduation_record AS graduation
      ON graduation.enrollment_id = enrollment.enrollment_id
    WHERE grade_totals.gpa_credits IS DISTINCT FROM expected.gpa_credits
       OR grade_totals.grade_points IS DISTINCT FROM expected.grade_points
       OR round(grade_totals.grade_points / grade_totals.gpa_credits, 2)
          IS DISTINCT FROM expected.stored_gpa
       OR graduation.cumulative_gpa IS DISTINCT FROM expected.stored_gpa
  ) THEN
    RAISE EXCEPTION 'Credit-weighted GPA assertion failed';
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
        graduation.total_credits_completed, graduation.total_credits_transferred,
        graduation.total_credits_earned, graduation.cumulative_gpa,
        graduation.award, graduation.requirements_fulfilled,
        graduation.graduation_status, graduation.approved_at
      FROM academic.graduation_record AS graduation
      JOIN academic.student_program_enrollment AS enrollment
        ON enrollment.enrollment_id = graduation.enrollment_id
      JOIN academic.student AS student ON student.student_id = enrollment.student_id
    ),
    missing AS (SELECT * FROM expected EXCEPT SELECT * FROM actual),
    extra AS (SELECT * FROM actual EXCEPT SELECT * FROM expected)
    SELECT 1 FROM missing UNION ALL SELECT 1 FROM extra
  ) THEN
    RAISE EXCEPTION 'Revised fixture graduation records differ';
  END IF;

  IF (SELECT count(*) FROM academic.graduation_record
      WHERE award = 'Academic Distinction') <> 2
    OR EXISTS (
      SELECT 1
      FROM academic.graduation_record AS graduation
      JOIN academic.student_program_enrollment AS enrollment
        ON enrollment.enrollment_id = graduation.enrollment_id
      JOIN academic.student AS student ON student.student_id = enrollment.student_id
      WHERE graduation.award IS NOT NULL
        AND student.admission_no NOT IN ('6499002', '6399003')
    )
  THEN
    RAISE EXCEPTION 'Synthetic award assertion failed';
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
      JOIN academic.student AS student ON student.student_id = enrollment.student_id
    ),
    missing AS (SELECT * FROM expected EXCEPT SELECT * FROM actual),
    extra AS (SELECT * FROM actual EXCEPT SELECT * FROM expected)
    SELECT 1 FROM missing UNION ALL SELECT 1 FROM extra
  ) THEN
    RAISE EXCEPTION 'Revised fixture transcripts differ';
  END IF;

  IF EXISTS (
    WITH expected(admission_no, wallet_allowed, transcript_vc_eligible) AS (
      VALUES
        ('6899001'::text, true, false),
        ('6499002'::text, true, true),
        ('6399003'::text, true, true),
        ('6499004'::text, true, false),
        ('6699005'::text, false, false)
    ),
    actual AS (
      SELECT student.admission_no,
        enrollment.academic_status IN ('studying', 'graduated', 'alumni') AS wallet_allowed,
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
      JOIN academic.program AS program ON program.program_id = enrollment.program_id
      LEFT JOIN academic.graduation_record AS graduation
        ON graduation.enrollment_id = enrollment.enrollment_id
      LEFT JOIN academic.transcript AS transcript
        ON transcript.enrollment_id = enrollment.enrollment_id
    ),
    missing AS (SELECT * FROM expected EXCEPT SELECT * FROM actual),
    extra AS (SELECT * FROM actual EXCEPT SELECT * FROM expected)
    SELECT 1 FROM missing UNION ALL SELECT 1 FROM extra
  ) THEN
    RAISE EXCEPTION 'Wallet or Transcript VC eligibility assertion failed';
  END IF;
END
$academic_seed$;

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
    passportDigests = PASSPORT_ENV_NAMES.map((environmentName) =>
      createPassportDigest(environmentName, secretBytes),
    );
  } finally {
    secretBytes.fill(0);
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
      'Generated protected synthetic academic replacement SQL.',
      `Output: ${outputPath}`,
      'Planned rows: program=1, student=5, enrollment=5, course=54, academic_term=12.',
      'Planned rows: course_result=183, transcript=3, graduation_record=3.',
      'No database statements were executed.',
    ].join('\n') + '\n',
  );
}

try {
  main();
} catch (error) {
  const message =
    error instanceof Error ? error.message : 'Unknown generator failure';
  process.stderr.write(`Academic seed generation failed: ${message}\n`);
  process.exitCode = 1;
}
