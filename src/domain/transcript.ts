import { GRADES, normalizeGrade } from '../data/academic';
import timetables from '../data/timetables.json';
import type { BuiltProfile } from './buildProfile';
import type { Course } from './types';

export interface TranscriptRow {
  course: Course;
  kind: string;
  note: string;
  candidateCategoryId: string;
  classification: string;
  needsConfirmation: boolean;
  confirmed: boolean;
  included: boolean;
}
export interface Transcript {
  rows: TranscriptRow[];
  warnings: string[];
  reportedCredits: number | null;
  reportedGpa: number | null;
}
export interface Timetable {
  term: string;
  source: string;
  sha256: string;
  courses: { code: string; name: string; kind: string; credits: number; area: string }[];
}
const areaIds: Record<string, string> = {
  '기초:의사소통': 'ge-communication',
  '기초:글쓰기': 'ge-writing', '기초:발표와토론': 'ge-speaking',
  '기초:인문기초': 'ge-humanities', '기초:과학기초': 'ge-science',
  '기초:외국어기초': 'ge-language', '기초:AI/데이터': 'ge-ai',
  '소양:인성': 'ge-personality', '소양:실무': 'ge-practical', '소양:실기': 'ge-activity',
  '심화:글로벌언어': 'ge-advanced-language', '심화:인간과문화': 'ge-advanced-culture',
  '심화:인간과사회': 'ge-advanced-society', '심화:과학과기술': 'ge-advanced-science',
  '심화:예술과체육': 'ge-advanced-arts', '심화:융복합': 'ge-advanced-convergence',
};

export function classifyRow(course: Course, kind: string, profile: BuiltProfile, tables: readonly Timetable[] = timetables) {
  const allowed = new Set(profile.categories.map(item => item.id));
  if (kind === '전선' || kind === '전필') {
    if (profile.categories.some(item => item.id.startsWith('secondary-'))) return { categoryId: '', candidateCategoryId: '', classification: '복수전공 과목의 원전공/다전공 구분을 선택해 주세요.', needsConfirmation: true };
    return { categoryId: `primary-${kind === '전선' ? 'elective' : 'required'}`, candidateCategoryId: '', classification: '성적표 이수구분 · 단일전공', needsConfirmation: false };
  }
  if (kind === '일교' && allowed.has('ge-other')) return { categoryId: 'ge-other', candidateCategoryId: '', classification: '성적표 일반교양 · 세부 필수영역에는 합산하지 않음', needsConfirmation: false };
  const exact = tables.filter(item => item.term === course.semester);
  const matches = (exact.length ? exact : tables).flatMap(table => table.courses.filter(item => item.code === course.courseCode && item.kind === kind).map(item => ({ ...item, term: table.term, source: table.source })));
  const categories = [...new Set(matches.map(item => areaIds[`${item.kind}:${item.area}`] ?? ''))];
  const id = categories.length === 1 ? categories[0] : '';
  // Older communication areas merge writing and speaking; the inspected cohort explicitly defines this union.
  const mapped = ['ge-writing', 'ge-speaking'].includes(id) && allowed.has('ge-communication') ? 'ge-communication' : id;
  if (!mapped || !allowed.has(mapped) || matches.some(item => item.credits !== course.credits)) return { categoryId: '', candidateCategoryId: '', classification: matches.length ? '시간표 영역·학점 또는 교육과정이 일치하지 않아 직접 확인이 필요합니다.' : '학수번호와 이수구분에 맞는 시간표 자료 없음', needsConfirmation: true };
  const source = matches.map(item => `${item.term} · ${item.area}`).filter((value, index, all) => all.indexOf(value) === index).join(', ');
  return { categoryId: exact.length ? mapped : '', candidateCategoryId: exact.length ? '' : mapped,
    classification: `${exact.length ? '동일 학기 시간표' : '다른 학기 시간표 후보 (확인 후 반영)'}: ${source}`, needsConfirmation: !exact.length };
}

/** Only course rows are retained. Student name/ID and original PDF never enter app state. */
export function parseTranscript(text: string, profile: BuiltProfile, tables: readonly Timetable[] = timetables): Transcript {
  const rows: TranscriptRow[] = [];
  const warnings: string[] = [];
  const pattern = /^(\d{4})\s*(1학기|2학기|여름(?:학기|계절학기)?|겨울(?:학기|계절학기)?)\s+(\S+)\s+([A-Z]+\d+)\s+(.+?)\s+(\d+(?:\.\d+)?)\s*(A\+|B\+|C\+|D\+|NP|[ABCDFPN])(?:\s+(.*))?$/;
  for (const line of text.split('\n').map(value => value.trim()).filter(Boolean)) {
    if (!/^\d{4}\s*(?:[12]학기|여름|겨울)/.test(line)) continue;
    const match = line.match(pattern);
    if (!match) { warnings.push(`과목 행을 판독하지 못했습니다: ${line.slice(0, 140)}`); continue; }
    const [, year, term, kind, code, name, credits, rawGrade, note = ''] = match;
    const grade = normalizeGrade(rawGrade)!;
    const semester = `${year}-${term.startsWith('1') ? '1' : term.startsWith('2') ? '2' : term.startsWith('여름') ? '여름' : '겨울'}`;
    const course: Course = { id: `pdf-${rows.length}`, courseCode: code, name: name.replace(/\s+/g, ' ').trim(), semester,
      categoryId: '', credits: Number(credits), grade, deletionEligibility: note ? 'unknown' : 'eligible',
      ...(note ? { deletionReason: `성적표 인정/삭제 구분 확인: ${note}` } : {}) };
    const classified = classifyRow(course, kind, profile, tables);
    course.categoryId = classified.categoryId;
    rows.push({ course, kind, note, ...classified, confirmed: false, included: true });
  }
  const total = text.match(/총\s*취득학점\s*:\s*(\d+(?:\.\d+)?)/);
  const gpa = text.match(/총\s*(?:평균평점|평점평균)\s*:\s*(\d+(?:\.\d+)?)/);
  const reportedCredits = total ? Number(total[1]) : null;
  const reportedGpa = gpa ? Number(gpa[1]) : null;
  const earned = rows.reduce((sum, row) => sum + (GRADES.find(grade => grade.label === row.course.grade)?.earned ? row.course.credits : 0), 0);
  if (reportedCredits !== null && earned !== reportedCredits) warnings.push(`성적표 총 취득학점 ${reportedCredits}와 추출한 취득학점 ${earned}가 다릅니다. 누락·재수강·삭제 표시를 확인해 주세요.`);
  if (rows.length === 0) throw new Error('과목 표를 읽지 못했습니다. 지원하는 텍스트 성적표인지 확인해 주세요. 스캔 PDF는 지원하지 않습니다.');
  return { rows, warnings, reportedCredits, reportedGpa };
}

export function rowErrors(row: TranscriptRow, profile: BuiltProfile): string[] {
  if (!row.included) return [];
  const c = row.course;
  return [!c.name.trim() ? '과목명 필요' : '', !c.courseCode?.trim() ? '학수번호 필요' : '',
    !/^\d{4}-(1|2|여름|겨울)$/.test(c.semester) ? '학기 형식 오류' : '',
    !Number.isInteger(c.credits) || c.credits < 1 || c.credits > 1000 ? '학점은 양의 정수' : '',
    !normalizeGrade(c.grade) ? '지원하지 않는 등급' : '',
    !profile.categories.some(item => item.id === c.categoryId) ? '과목 구분 선택 필요' : '',
    (row.needsConfirmation || row.note) && !row.confirmed ? '확인 체크 필요' : '',
  ].filter(Boolean);
}

export function courseKey(course: Course) { return `${course.semester}:${course.courseCode?.trim().toUpperCase()}`; }

export const timetableSummary = timetables.map(item => `${item.term}: ${item.courses.length}개 교양 기록`).join(' / ');
