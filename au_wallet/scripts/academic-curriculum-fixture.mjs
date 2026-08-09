export const PROGRAM_CODE = 'SYN-VMES-CS';
export const LEGACY_PROGRAM_CODE = 'SYN-VMES-CSIDS';

export const ALL_ADMISSIONS = [
  '6399003',
  '6399017',
  '6399018',
  '6399019',
  '6399020',
  '6499002',
  '6499004',
  '6499014',
  '6499015',
  '6499016',
  '6499021',
  '6499025',
  '6699005',
  '6699013',
  '6699024',
  '6799012',
  '6799023',
  '6899001',
  '6899011',
  '6899022',
];

export const SED_ADMISSIONS = new Set([
  '6399017',
  '6399019',
  '6499002',
  '6499015',
  '6499021',
  '6499025',
  '6699005',
  '6699013',
  '6799023',
  '6899011',
]);

export const IDS_ADMISSIONS = new Set(
  ALL_ADMISSIONS.filter((admissionNo) => !SED_ADMISSIONS.has(admissionNo)),
);

const GENERAL_LANGUAGE = 'general_education_language';
const GENERAL_HUMANITIES = 'general_education_humanities';
const GENERAL_SOCIAL = 'general_education_social_science';
const GENERAL_SCIENCE = 'general_education_science_mathematics';
const CORE = 'specialized_core';
const MAJOR_ORGANIZATION = 'major_organization_information_systems';
const MAJOR_APPLICATION = 'major_application_technology';
const MAJOR_SOFTWARE = 'major_technology_software_methods';
const MAJOR_SYSTEMS = 'major_systems_infrastructure';
const MAJOR_HARDWARE = 'major_hardware_architecture';
const ELECTIVE_SED = 'major_elective_sed';
const ELECTIVE_IDS = 'major_elective_ids';
const ELECTIVE_GROUP_2 = 'major_elective_group_2';

// The official-looking curriculum rows below are transcribed only from the
// curriculum text supplied for this fixture task. Range-based selected-topic
// entries use the lower bound as one concrete mock catalog code.
export const COURSES = [
  ['ELE1001', 'Communicative English I', 3, GENERAL_LANGUAGE],
  ['ELE1002', 'Communicative English II', 3, GENERAL_LANGUAGE],
  ['ELE2000', 'Academic English', 3, GENERAL_LANGUAGE],
  ['ELE2001', 'Advanced Academic English', 3, GENERAL_LANGUAGE],
  ['GE1410', 'Thai for Professional Communication', 2, GENERAL_LANGUAGE],
  [
    'GE1411',
    'Thai Language for Multicultural Communication',
    2,
    GENERAL_LANGUAGE,
  ],
  ['GE1412', 'Introductory Thai Usage', 2, GENERAL_LANGUAGE],
  ['GE2110', 'Human Civilizations and Global Citizens', 2, GENERAL_HUMANITIES],
  ['BBA1004', 'Essential Marketing for Entrepreneurs', 2, GENERAL_SOCIAL],
  ['BBA1005', 'Essential Finance for Entrepreneurs', 2, GENERAL_SOCIAL],
  ['BBA1006', 'Essential Economics for Entrepreneurs', 2, GENERAL_SOCIAL],
  ['GE2202', 'Ethics', 3, GENERAL_SOCIAL],
  ['BBA1007', 'Data Analytics for Entrepreneurs', 3, GENERAL_SCIENCE],
  ['GE1303', 'Science for Sustainable Future', 2, GENERAL_SCIENCE],
  ['CSX2003', 'Principles of Statistics', 3, CORE],
  ['CSX2006', 'Mathematics and Statistics for Data Science', 3, CORE],
  ['CSX2008', 'Mathematics Foundation for Computer Science', 3, CORE],
  ['ITX2005', 'Design Thinking', 3, CORE],
  ['ITX2007', 'Data Science', 3, CORE],
  ['ITX3007', 'Software Engineering', 3, CORE],
  ['ITX3002', 'Introduction to Information Technology', 3, MAJOR_ORGANIZATION],
  ['CSX3010', 'Senior Project I', 3, MAJOR_APPLICATION],
  ['CSX3011', 'Senior Project II', 3, MAJOR_APPLICATION],
  ['CSX3001', 'Fundamentals of Computer Programming', 3, MAJOR_SOFTWARE],
  ['CSX3002', 'Object-Oriented Concepts and Programming', 3, MAJOR_SOFTWARE],
  ['CSX3003', 'Data Structures and Algorithms', 3, MAJOR_SOFTWARE],
  ['CSX3004', 'Programming Languages', 3, MAJOR_SOFTWARE],
  ['CSX3009', 'Algorithm Design', 3, MAJOR_SOFTWARE],
  ['CSX2009', 'Cloud Computing', 3, MAJOR_SYSTEMS],
  ['CSX3005', 'Computer Networks', 3, MAJOR_SYSTEMS],
  ['CSX3006', 'Database Systems', 3, MAJOR_SYSTEMS],
  ['CSX3008', 'Operating Systems', 3, MAJOR_SYSTEMS],
  ['CSX3007', 'Computer Architecture', 3, MAJOR_HARDWARE],
  ['ITX3004', 'Information System Analysis and Design', 3, ELECTIVE_SED],
  ['ITX4104', 'Software Testing', 3, ELECTIVE_SED],
  ['CSX4107', 'Web Application Development', 3, ELECTIVE_SED],
  ['CSX4109', 'Android Application Development', 3, ELECTIVE_SED],
  ['CSX4110', 'Backend Application Development', 3, ELECTIVE_SED],
  ['CSX4407', 'Enterprise Application Development', 3, ELECTIVE_SED],
  ['CSX4180', 'Selected Topic in Software Engineering', 3, ELECTIVE_SED],
  ['CSX4201', 'Artificial Intelligence Concepts', 3, ELECTIVE_IDS],
  ['CSX4203', 'Machine Learning', 3, ELECTIVE_IDS],
  ['CSX4207', 'Decision Support and Recommender Systems', 3, ELECTIVE_IDS],
  [
    'CSX4210',
    'Natural Language Processing and Social Interactions',
    3,
    ELECTIVE_IDS,
  ],
  ['CSX4211', 'Data Engineering', 3, ELECTIVE_IDS],
  ['CSX4212', 'Data Analytics', 3, ELECTIVE_IDS],
  ['CSX4213', 'Computer Vision', 3, ELECTIVE_IDS],
  ['CSX4280', 'Selected Topic in Data Science', 3, ELECTIVE_IDS],
  ['CSX4108', 'iOS Application Development', 3, ELECTIVE_GROUP_2],
  ['CSX4202', 'Data Mining', 3, ELECTIVE_GROUP_2],
  ['CSX4205', 'Big Data Analytics', 3, ELECTIVE_GROUP_2],
  [
    'CSX4206',
    'Data Warehousing and Business Intelligence',
    3,
    ELECTIVE_GROUP_2,
  ],
  ['CSX4208', 'Deep Learning', 3, ELECTIVE_GROUP_2],
  ['CSX4306', 'Internet of Things', 3, ELECTIVE_GROUP_2],
  ['CSX4501', 'Theory of Computation', 3, ELECTIVE_GROUP_2],
  ['CSX4510', 'Neural Networks', 3, ELECTIVE_GROUP_2],
  ['CSX4513', 'AR/VR Application Development', 3, ELECTIVE_GROUP_2],
  ['CSX4514', 'Cross-platform Application Development', 3, ELECTIVE_GROUP_2],
  ['CSX4515', 'Game Design and Development', 3, ELECTIVE_GROUP_2],
  ['CSX4516', 'Reusability and Design Patterns', 3, ELECTIVE_GROUP_2],
  ['ITX2004', 'UI/UX Design and Prototyping', 3, ELECTIVE_GROUP_2],
  ['ITX3003', 'Business Systems', 3, ELECTIVE_GROUP_2],
  ['ITX4212', 'Predictive Analytics', 3, ELECTIVE_GROUP_2],
  ['ITX4213', 'Artificial Intelligence for Business', 3, ELECTIVE_GROUP_2],
  ['ITX4502', 'Tech Startup', 3, ELECTIVE_GROUP_2],
  ['ITX4509', 'Cybersecurity', 3, ELECTIVE_GROUP_2],
  ['ITX4517', 'Software Configuration Management', 3, ELECTIVE_GROUP_2],
  ['ITX4518', 'Blockchain and Digital Currencies', 3, ELECTIVE_GROUP_2],
  ['ITX4519', 'Internetworking Workshop', 3, ELECTIVE_GROUP_2],
  ['CSX4600', 'Selected Topics', 3, ELECTIVE_GROUP_2],
];

const COMMON_BLOCKS = [
  ['ELE1001', 'ELE1002', 'GE2202', 'BBA1007', 'GE1411', 'BBA1004'],
  ['ELE2000', 'ELE2001', 'CSX2003', 'CSX2006', 'BBA1005', 'BBA1006'],
  ['CSX2008', 'ITX2005', 'ITX2007', 'ITX3007', 'ITX3002', 'GE2110'],
  ['CSX3010', 'CSX3011', 'CSX3001', 'CSX3002', 'CSX3003', 'GE1303'],
  ['CSX3004', 'CSX3009', 'CSX2009', 'CSX3005', 'CSX3006', 'CSX3008'],
];

const SED_SELECTED = ['ITX3004', 'ITX4104', 'CSX4107', 'CSX4110', 'CSX4407'];
const SED_ADDITIONAL = [
  'CSX4109',
  'CSX4108',
  'CSX4514',
  'CSX4516',
  'ITX4517',
  'ITX4509',
];
const IDS_SELECTED = ['CSX4201', 'CSX4203', 'CSX4211', 'CSX4212', 'CSX4213'];
const IDS_ADDITIONAL = [
  'CSX4207',
  'CSX4210',
  'CSX4202',
  'CSX4205',
  'CSX4208',
  'ITX4509',
];
// For this synthetic fixture, these additional approved Major Elective Group 2
// courses satisfy the 12-credit free-elective portion deterministically.
const FREE_ELECTIVE_SELECTION = ['ITX2004', 'ITX3003', 'ITX4502', 'ITX4518'];

export function concentrationFor(admissionNo) {
  if (!ALL_ADMISSIONS.includes(admissionNo)) {
    throw new Error(`Unknown fixture admission number: ${admissionNo}`);
  }
  return SED_ADMISSIONS.has(admissionNo) ? 'SED' : 'IDS';
}

export function curriculumBlocksFor(admissionNo) {
  const concentration = concentrationFor(admissionNo);
  const selected = concentration === 'SED' ? SED_SELECTED : IDS_SELECTED;
  const additional = concentration === 'SED' ? SED_ADDITIONAL : IDS_ADDITIONAL;
  return [
    ...COMMON_BLOCKS.map((block) => [...block]),
    ['CSX3007', ...selected],
    additional.slice(0, 5),
    [additional[5], ...FREE_ELECTIVE_SELECTION],
  ];
}

// These positions describe the superseded synthetic catalog only so the
// guarded correction can remap existing result foreign keys without changing
// grades, terms, result types, or earned credits.
export const LEGACY_COMPLETE_BLOCKS = [
  ['ELE1101', 'ELE1201', 'GE1101', 'GE2201', 'GE1201', 'GE1301'],
  ['GE2301', 'BBA1201', 'BBA1301', 'BBA1401', 'GE2101', 'GE2401'],
  ['CSX2101', 'CSX2102', 'CSX2201', 'CSX2202', 'ITX2101', 'BBA1101'],
  ['ITX2201', 'ITX2301', 'ITX2302', 'CSX3101', 'ITX3101', 'BBA1501'],
  ['ITX3201', 'CSX3201', 'ITX3301', 'CSX3301', 'CSX3401', 'CSX3402'],
  ['CSX4101', 'CSX4102', 'ITX4101', 'CSX4301', 'CSX4302', 'CSX4401'],
  ['CSX4402', 'CSX4501', 'CSX4502', 'ITX4301', 'CSX4701'],
  ['CSX4702', 'CSX4703', 'ITX4701', 'ITX4702', 'CSX4704'],
];

export const LEGACY_SEMINAR_CODES = [
  'BG14901',
  'BG14902',
  'BG14903',
  'BG14904',
  'BG14905',
  'BG14906',
  'BG14907',
  'BG14908',
];

export function mapLegacyCourseCode(admissionNo, legacyCode) {
  const legacyPath = LEGACY_COMPLETE_BLOCKS.flat();
  const targetPath = curriculumBlocksFor(admissionNo).flat();
  const index = legacyPath.indexOf(legacyCode);
  if (index === -1) {
    throw new Error(`Unknown legacy course code: ${legacyCode}`);
  }
  return targetPath[index];
}

export function mapLegacyTermGroups(admissionNo, groups) {
  return groups.map(([termCode, courseCodes]) => [
    termCode,
    courseCodes.map((courseCode) =>
      mapLegacyCourseCode(admissionNo, courseCode),
    ),
  ]);
}

function validateCurriculum() {
  const catalog = new Map(COURSES.map((course) => [course[0], course]));
  if (COURSES.length !== 70 || catalog.size !== 70) {
    throw new Error('Curriculum catalog natural-key assertion failed');
  }
  const threeCredit = COURSES.filter((course) => course[2] === 3).length;
  const twoCredit = COURSES.filter((course) => course[2] === 2).length;
  const catalogCredits = COURSES.reduce((sum, course) => sum + course[2], 0);
  if (threeCredit !== 62 || twoCredit !== 8 || catalogCredits !== 202) {
    throw new Error('Curriculum catalog credit assertion failed');
  }
  if (
    COURSES.some(
      (course) =>
        course[0].startsWith('SYN-FE') ||
        course[3] === 'synthetic_free_elective',
    )
  ) {
    throw new Error('Synthetic free-elective retirement assertion failed');
  }
  if (SED_ADMISSIONS.size !== 10 || IDS_ADMISSIONS.size !== 10) {
    throw new Error('Fixture concentration distribution assertion failed');
  }
  for (const admissionNo of ALL_ADMISSIONS) {
    const path = curriculumBlocksFor(admissionNo).flat();
    if (path.length !== 46 || new Set(path).size !== 46) {
      throw new Error(
        `Curriculum path count assertion failed for ${admissionNo}`,
      );
    }
    if (path.some((courseCode) => !catalog.has(courseCode))) {
      throw new Error(
        `Curriculum path catalog assertion failed for ${admissionNo}`,
      );
    }
    const credits = path.reduce(
      (sum, courseCode) => sum + catalog.get(courseCode)[2],
      0,
    );
    const pathThreeCredit = path.filter(
      (courseCode) => catalog.get(courseCode)[2] === 3,
    ).length;
    const pathTwoCredit = path.filter(
      (courseCode) => catalog.get(courseCode)[2] === 2,
    ).length;
    if (credits !== 132 || pathThreeCredit !== 40 || pathTwoCredit !== 6) {
      throw new Error(
        `Curriculum path credit assertion failed for ${admissionNo}`,
      );
    }
    if (
      !path.includes('GE1411') ||
      path.includes('GE1410') ||
      path.includes('GE1412')
    ) {
      throw new Error(
        `International Thai-course assertion failed for ${admissionNo}`,
      );
    }
  }
}

validateCurriculum();
