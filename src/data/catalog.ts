import { REQUIRED_COURSES_BY_YEAR } from './required-courses';

/** Verified against the GLOCAL campus pages of the official 2020–2026 handbooks. */
export const SUPPORTED_YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026] as const;
export type CurriculumYear = (typeof SUPPORTED_YEARS)[number];

export interface CatalogSource {
  id: string;
  title: string;
  url: string;
  pdfUrl: string;
  pdfPage: number;
  printedPage: number;
}

export interface CatalogCourse {
  code: string;
  name: string;
  credits: number;
  category: string;
}

export interface CatalogCourseGroup {
  id: string;
  label: string;
  codes: string[];
  minCount: number;
}

export interface DepartmentCurriculum {
  departmentId: string;
  name: string;
  year: CurriculumYear;
  totalCredits: number;
  generalCredits: number;
  majorRequiredCredits: number;
  majorElectiveCredits: number;
  majorCredits: number;
  /** Credits required when another department's student takes this as a second major. */
  doubleMajorCredits: number | null;
  commonRequiredCredits: number;
  requiredCourses: CatalogCourse[];
  /** Options in a choose-N group, not independently mandatory courses. */
  requiredCourseChoices: CatalogCourse[];
  requiredCourseGroups: CatalogCourseGroup[];
  sources: CatalogSource[];
  unknownReasons: string[];
  nonCreditRequirements: string[];
}

const handbookInfo: Record<CurriculumYear, [number, number, number, number]> = {
  2020: [67655, 94074, 523, 508],
  2021: [89183, 95748, 319, 304],
  2022: [96338, 104381, 328, 314],
  2023: [105633, 107582, 326, 312],
  2024: [113224, 114139, 34, 29],
  2025: [119312, 1, 32, 28],
  2026: [119313, 1, 31, 27],
};

export function handbookSource(year: CurriculumYear, pdfPage?: number, printedPage?: number): CatalogSource {
  const [post, file, defaultPage, defaultPrint] = handbookInfo[year];
  return {
    id: `handbook-${year}-${pdfPage ?? defaultPage}`,
    title: `${year}학년도 건국대학교 GLOCAL캠퍼스 요람`,
    url: `https://www.kku.ac.kr/cms/FR_CON/BoardView.do?MENU_ID=590&SITE_NO=2&BOARD_SEQ=13&BBS_SEQ=${post}`,
    pdfUrl: `https://www.kku.ac.kr/ajaxFile/FR_SVC/FileDown.do?BOARD_SEQ=13&SITE_NO=2&BBS_SEQ=${post}&FILE_SEQ=${file}`,
    pdfPage: pdfPage ?? defaultPage,
    printedPage: printedPage ?? defaultPrint,
  };
}

// Name, general education, required major, elective major, total major, second major, graduation total.
type Row = [string, number, number, number, number, number | null, number, number?];
const rows2020: Row[] = [
  ['산업디자인전공',35,14,52,66,40,132,2], ['실내디자인전공',35,13,53,66,40,132,2],
  ['패션디자인전공',35,2,64,66,40,132,2], ['시각영상디자인전공',35,11,55,66,40,132,2],
  ['미디어콘텐츠전공',35,14,52,66,40,132,2], ['조형예술학과',35,14,52,66,40,132,2],
  ['경영학전공',35,24,42,66,45,124,12], ['경제통상학전공',35,12,54,66,40,124,12],
  ['경찰학과',35,12,54,66,40,124], ['문헌정보학과',35,12,54,66,40,124],
  ['유아교육과',35,24,42,66,null,140], ['신문방송학전공',35,15,51,66,40,124,12],
  ['동화·한국어문화전공',35,24,42,66,40,124,12], ['영어문화학전공',35,12,54,66,40,124,12],
  ['기계전자전공',35,12,54,66,40,132,6], ['소프트웨어전공',35,18,48,66,40,132,6],
  ['의학공학전공',35,18,48,66,40,132,6], ['녹색환경시스템전공',35,0,66,66,40,132],
  ['에너지소재학전공',35,12,54,66,40,132], ['간호학과',29,99,6,105,null,135],
  ['사회복지학과',35,12,54,66,40,124], ['바이오의약학전공',39,12,54,66,40,132],
  ['바이오생명공학전공',39,13,53,66,40,132], ['식품학전공',35,0,66,66,40,132],
  ['뷰티화장품전공',35,0,66,66,40,132], ['스포츠건강학전공',35,0,66,66,40,132],
  ['골프산업전공',35,12,54,66,40,132],
];

const rows2021: Row[] = [
  ['산업디자인학과',35,14,58,72,40,132], ['실내디자인학과',35,13,56,69,40,132],
  ['패션디자인학과',35,2,70,72,40,132], ['시각영상디자인학과',35,17,49,66,40,132],
  ['미디어콘텐츠학과',35,14,58,72,40,132], ['조형예술학과',35,2,64,66,40,132],
  ['경영학과',35,18,48,66,45,124], ['경제통상학과',35,12,60,72,40,124],
  ['경찰학과',35,12,54,66,40,124], ['소방방재융합학과',35,12,54,66,40,132],
  ['문헌정보학과',35,12,54,66,40,124], ['유아교육과',35,21,45,66,null,140],
  ['사회복지학과',35,12,54,66,40,124], ['신문방송학과',35,3,63,66,40,124],
  ['동화·한국어문화학과',35,12,60,72,40,124], ['영어문화학과',35,12,54,66,40,124],
  ['메카트로닉스공학과',35,21,45,66,40,132], ['컴퓨터공학과',35,15,51,66,40,132],
  ['바이오메디컬공학과',35,21,45,66,40,132], ['녹색기술융합학과',35,15,57,72,40,132],
  ['응용화학과',35,21,45,66,40,132], ['간호학과',29,99,6,105,null,135],
  ['바이오의약학과',38,12,54,66,40,132], ['생명공학과',35,19,47,66,40,132],
  ['식품학과',35,0,66,66,40,132], ['뷰티화장품학과',35,0,66,66,40,132],
  ['스포츠건강학과',35,0,72,72,40,132], ['골프산업학과',35,20,52,72,40,132],
];

function revise(previous: Row[], replacements: Row[], rename: Record<string, string> = {}): Row[] {
  const next = previous.map((row): Row => [rename[row[0]] ?? row[0], ...row.slice(1)] as Row);
  for (const replacement of replacements) {
    const index = next.findIndex((row) => row[0] === replacement[0]);
    if (index < 0) next.push(replacement);
    else next[index] = replacement;
  }
  return next;
}

const rows2022 = revise(rows2021, [
  ['패션디자인학과',35,14,58,72,40,132],
  ['의예과',34,48,0,48,null,244], ['의학과',0,162,0,162,null,244],
]);
const rows2023 = revise(rows2022, [
  ['패션디자인학과',35,17,55,72,40,132], ['경영학과',35,27,39,66,45,124],
  ['간호학과',29,100,6,106,null,135], ['생명공학과',35,13,53,66,40,132],
], {'식품학과':'식품영양학과'});
const rows2024 = revise(rows2023, [
  ['실내디자인학과',35,16,53,69,40,132], ['패션디자인학과',35,20,52,72,40,132],
  ['소방방재융합학과',35,18,48,66,40,132], ['유아교육과',35,15,51,66,null,140],
  ['컴퓨터공학과',35,12,54,66,40,132], ['생명공학과',35,0,66,66,40,132],
  ['골프산업학과',35,21,51,72,40,132], ['의예과',34,48,0,48,null,243],
  ['의학과',0,161,0,161,null,243], ['반도체전공',35,0,66,66,40,120],
  ['이차전지전공',35,18,54,72,40,120], ['빅데이터전공',35,12,54,66,40,120],
  ['다문화언어소통전공',35,12,60,72,40,120], ['사회복지상담전공',35,15,51,66,40,120],
  ['창업경영전공',35,12,54,66,40,120],
], {'응용화학과':'에너지신소재공학과'});
const rows2025 = revise(rows2024.map((r): Row => [r[0], r[0] === '간호학과' ? 25 : r[0] === '의예과' ? 29 : r[0] === '의학과' ? 0 : 31, ...r.slice(2)] as Row), [
  ['시각영상디자인학과',31,11,61,72,40,132], ['경찰학과',31,0,66,66,40,124],
  ['컴퓨터공학과',31,3,63,66,40,132], ['녹색기술융합학과',31,12,60,72,40,132],
  ['바이오의약학과',31,0,66,66,40,132], ['의예과',29,48,0,48,null,237],
  ['의학과',0,160,0,160,null,237],
], {'다문화언어소통전공':'다문화·한국어교육전공', '사회복지상담전공':'사회복지상담심리전공'});
const rows2026 = revise(rows2025.filter((row) => !['반도체전공','이차전지전공','빅데이터전공'].includes(row[0])), [
  ['경제통상학과',31,9,63,72,40,124], ['유아교육과',31,12,54,66,null,140],
  ['간호학과',29,100,6,106,null,135], ['의예과',33,47,0,47,null,232],
  ['의학과',0,152,0,152,null,232], ['배터리반도체융합산업전공',31,15,54,69,40,120],
  ['AI빅데이터전공',31,12,54,66,40,120], ['스마트푸드테크산업전공',31,0,66,66,40,120],
  ['국제경영학과',31,0,66,66,null,124], ['미디어영상학과',31,0,66,66,null,124],
], {'사회복지상담심리전공':'상담심리전공'});

const rowsByYear: Record<CurriculumYear, Row[]> = {2020:rows2020,2021:rows2021,2022:rows2022,2023:rows2023,2024:rows2024,2025:rows2025,2026:rows2026};
const course = (code: string, name: string, credits: number, category = 'major-required'): CatalogCourse => ({code,name,credits,category});
const departmentPrefixes: Record<string,string[]> = {
  산업디자인전공:['BWCC'], 산업디자인학과:['BWCC'], 실내디자인전공:['BWDA'], 실내디자인학과:['BWDA'],
  패션디자인전공:['BWEA'], 패션디자인학과:['BWEA'], 시각영상디자인전공:['BWLB'], 시각영상디자인학과:['BWLB'],
  미디어콘텐츠전공:['BWLC'], 미디어콘텐츠학과:['BWLC'], 조형예술학과:['BWLD'],
  경영학전공:['BRIR'], 경영학과:['BRIR'], 경제통상학전공:['BRIS'], 경제통상학과:['BRIS'],
  경찰학과:['BRIU'], 소방방재융합학과:['BRIB'], 문헌정보학과:['BRIV'], 유아교육과:['BRIW'],
  사회복지학과:['BVHH'], 신문방송학전공:['BRIN'], 신문방송학과:['BRIN'],
  '동화·한국어문화전공':['BRIO'], '동화·한국어문화학과':['BRIO'], 영어문화학전공:['BRIP'], 영어문화학과:['BRIP'],
  기계전자전공:['NDGD','NDDB'], 메카트로닉스공학과:['NDGD','NDDB'], 소프트웨어전공:['NDGE'], 컴퓨터공학과:['NDGE'],
  의학공학전공:['BVBA'], 바이오메디컬공학과:['BVBA'], 녹색환경시스템전공:['NDGB'], 녹색기술융합학과:['NDGB'],
  에너지소재학전공:['NDGC'], 응용화학과:['NDGC'], 에너지신소재공학과:['NDGC'],
  간호학과:['BVHG','BVCA'], 바이오의약학전공:['BVHB'], 바이오의약학과:['BVHB'],
  바이오생명공학전공:['BVHC'], 생명공학과:['BVHC'], 식품학전공:['BVHD'], 식품학과:['BVHD'], 식품영양학과:['BVHD'],
  뷰티화장품전공:['BVHE'], 뷰티화장품학과:['BVHE'], 스포츠건강학전공:['BVHJ'], 스포츠건강학과:['BVHJ'],
  골프산업전공:['BVHK'], 골프산업학과:['BVHK'], 의예과:['BUAA','BUBA'], 의학과:['BUCA'],
  반도체전공:['BVEJ'], 이차전지전공:['BVEK'], 빅데이터전공:['BVEL'], 다문화언어소통전공:['BVEN'],
  '다문화·한국어교육전공':['BVEN'], 사회복지상담전공:['BVEO'], 사회복지상담심리전공:['BVEO'], 창업경영전공:['BVEP'],
  배터리반도체융합산업전공:['BVFD'], AI빅데이터전공:['BVFK'], 상담심리전공:['BVFF'],
  스마트푸드테크산업전공:[], 국제경영학과:[], 미디어영상학과:[],
};
const businessChoices = [
  course('BRIR57563','기업가정신과창업',3), course('BRIR09271','마케팅',3), course('BRIR13288','재무관리',3),
  course('BRIR13306','회계원리',3), course('BRIR13231','경영정보시스템',3), course('BRIR39188','생산운영관리',3),
  course('BRIR13286','인적자원관리',3),
];
const ictChoices = [course('NDFA57957','대학수학',3,'major-common'),course('NDFA15312','일반물리학및실험',3,'major-common'),course('NDFA11989','컴퓨터프로그래밍',3,'major-common')];
const biologyLabChoices = [course('BVHC48022','생명과학기초실험1',3),course('BVHC48023','생명과학기초실험2',3),course('BVHC63445','생명공학심화실험1',3),course('BVHC63446','생명공학심화실험2',3)];
const biologyThesisChoices = [course('BVHC63444','생명공학논문실험',1),course('BVHC53650','생명공학논문연구',1)];

function departmentRequirements(name: string, year: CurriculumYear) {
  const prefixes = [...departmentPrefixes[name]];
  const isDesign = prefixes.some((prefix) => ['BWCC','BWDA','BWEA','BWLB','BWLC','BWLD'].includes(prefix));
  if (isDesign) prefixes.unshift('BWAA');
  if (year === 2020 && ['경영학전공','경제통상학전공'].includes(name)) prefixes.unshift('BRIQ');
  if (year === 2020 && ['신문방송학전공','동화·한국어문화전공','영어문화학전공'].includes(name)) prefixes.unshift('BRIM');
  const rows = prefixes.flatMap((prefix) => REQUIRED_COURSES_BY_YEAR[year][prefix] ?? []);
  const requiredCourses = rows.map(([code,name,credits]) => course(code,name,credits,year === 2020 && ['BWAA','BRIQ','BRIM'].includes(code.slice(0,4)) ? 'major-common' : 'major-required'));
  const requiredCourseChoices: CatalogCourse[] = [];
  const requiredCourseGroups: CatalogCourseGroup[] = [];
  const pages = new Set(rows.map((row) => row[3]));
  const addGroup = (id: string, label: string, choices: CatalogCourse[], minCount: number, page: number) => {
    requiredCourseChoices.push(...choices);
    requiredCourseGroups.push({id,label,codes:choices.map((item) => item.code),minCount});
    pages.add(page);
  };
  if (year === 2020 && ['기계전자전공','소프트웨어전공','의학공학전공'].includes(name)) {
    addGroup('ict-common-two','ICT융합공학부 공통필수 3과목 중 2과목',ictChoices,2,563);
  }
  if (year <= 2022 && ['경영학전공','경영학과'].includes(name)) {
    addGroup('business-required-four','경영학 선택필수 7과목 중 4과목',businessChoices,4,{2020:546,2021:344,2022:355}[year as 2020|2021|2022]);
  }
  if (name === '생명공학과' && year >= 2021 && year <= 2023) {
    const page = {2021:380,2022:393,2023:398}[year as 2021|2022|2023];
    if (year <= 2022) addGroup('biology-labs-two','생명공학 실험 선택필수 4과목 중 2과목',biologyLabChoices,2,page);
    addGroup('biology-thesis-one','생명공학 논문 선택필수 2과목 중 1과목',biologyThesisChoices,1,page);
  }
  const offset = year <= 2021 ? 15 : year <= 2023 ? 14 : year === 2024 ? 5 : 4;
  return {requiredCourses,requiredCourseChoices,requiredCourseGroups,
    courseSources:[...pages].sort((a,b) => a-b).map((page) => handbookSource(year,page,page-offset)),
  };
}

export const DEPARTMENT_CURRICULA: DepartmentCurriculum[] = SUPPORTED_YEARS.flatMap((year) => rowsByYear[year].map((row) => {
  const [name,generalCredits,majorRequiredCredits,majorElectiveCredits,majorCredits,doubleMajorCredits,totalCredits,commonRequiredCredits = 0] = row;
  const isCs = name === '컴퓨터공학과' || name === '소프트웨어전공';
  const requirements = departmentRequirements(name,year);
  return {
    departmentId: isCs ? 'computer' : name, name, year, totalCredits, generalCredits,
    majorRequiredCredits, majorElectiveCredits, majorCredits, doubleMajorCredits, commonRequiredCredits,
    requiredCourses: requirements.requiredCourses,
    requiredCourseChoices: requirements.requiredCourseChoices,
    requiredCourseGroups: requirements.requiredCourseGroups,
    sources: [handbookSource(year), ...requirements.courseSources],
    unknownReasons: name === '패션디자인전공' && year === 2020
      ? ['2020 요람 총괄표는 전필 2학점(공통)이나 학과 교과목표는 전필 12학점을 추가 명시합니다. 학과 확인 전 확정할 수 없습니다.']
      : [],
    nonCreditRequirements: isCs ? ['컴퓨터공학과 졸업작품·논문 또는 대체형 심사 통과 및 졸업서류 제출'] : [`${name}의 졸업논문·시험·작품 등 비학점 졸업요건 확인`],
  };
}));

export const DEPARTMENTS = Array.from(new Map(DEPARTMENT_CURRICULA.map((entry) => [entry.departmentId, {
  id: entry.departmentId, name: entry.departmentId === 'computer' ? '컴퓨터공학과' : entry.name,
  aliases: entry.departmentId === 'computer' ? ['소프트웨어전공','컴퓨터공학과'] : [entry.name],
}])).values());

export function getDepartmentCurriculum(departmentId: string, year: number): DepartmentCurriculum | undefined {
  return DEPARTMENT_CURRICULA.find((entry) => entry.departmentId === departmentId && entry.year === year);
}
export function getDepartmentsForYear(year: number): DepartmentCurriculum[] {
  return DEPARTMENT_CURRICULA.filter((entry) => entry.year === year);
}

export interface GeneralEducationProfile {
  year: CurriculumYear;
  totalCredits: number;
  coreCredits: number;
  advancedCredits: number;
  personalityCredits: number;
  practicalCredits: number;
  activityCredits: number;
  areas: {id:string;label:string;minCredits:number}[];
  advancedAreaIds: string[];
  advancedMinimumAreaCount: number;
  requiredCourses: CatalogCourse[];
  sources: CatalogSource[];
  notes: string[];
}

const generalPages: Record<CurriculumYear,[number,number]> = {2020:[524,509],2021:[320,305],2022:[331,317],2023:[329,315],2024:[37,32],2025:[35,31],2026:[34,30]};
export const GENERAL_EDUCATION_BY_YEAR = Object.fromEntries(SUPPORTED_YEARS.map((year): [CurriculumYear, GeneralEducationProfile] => {
  const old = year <= 2021;
  const recent = year >= 2025;
  const small = recent ? 2 : 3;
  return [year, {
    year, totalCredits: recent ? 31 : 35, coreCredits: recent ? 14 : 18, advancedCredits:8,
    personalityCredits:3,practicalCredits:4,activityCredits:2,
    areas: [
      ...(old ? [{id:'ge-communication',label:'의사소통',minCredits:6}] : [{id:'ge-writing',label:'글쓰기',minCredits:small},{id:'ge-speaking',label:'발표와토론',minCredits:small}]),
      {id:'ge-humanities',label:old ? '인문사고' : '인문기초',minCredits:small},
      {id:'ge-science',label:old ? '과학사고' : '과학기초',minCredits:small},
      {id:'ge-language',label:old ? '국제화' : '외국어기초',minCredits:recent ? 4 : 6},
      ...(recent ? [{id:'ge-ai',label:'AI/데이터',minCredits:2}] : []),
      {id:'ge-personality',label:old ? 'KU인성' : 'KU소양 인성',minCredits:3},
      {id:'ge-practical',label:old ? '실무소양' : 'KU소양 실무',minCredits:4},
      {id:'ge-activity',label:old ? '실기소양' : 'KU소양 실기',minCredits:2},
    ],
    advancedAreaIds: ['ge-advanced-language',...(!old ? ['ge-advanced-culture'] : []),'ge-advanced-society','ge-advanced-science','ge-advanced-arts','ge-advanced-convergence'],
    advancedMinimumAreaCount:4,
    requiredCourses: [
      course(year === 2020 ? 'BKSA62440' : 'BZZA62440','성신의대학생활지도',1,'ge-personality'),
      course('BKSA53699','KUGEP1',small,'ge-language'),
      course('BKSA59472','취업전략수립및역량개발1',2,'ge-practical'),
      ...(old ? [course('BKSA49491','글쓰기',3,'ge-communication'),course('BKSA59471','발표와토론',3,'ge-communication')] : []),
    ],
    sources:[handbookSource(year,...generalPages[year])],
    notes:[
      '원전공별 예외와 편입생의 교양 이수 면제는 별도로 적용합니다.',
      '폐지·명칭변경 교과목의 대체 인정은 공식 이수구분 또는 학과 확인이 필요합니다.',
      ...(recent ? ['디자인대학은 과학기초 1과목을 심화교양 과학과기술 1과목으로 대체할 수 있으나 두 영역 중복 인정은 불가합니다.'] : []),
    ],
  }];
})) as Record<CurriculumYear, GeneralEducationProfile>;
