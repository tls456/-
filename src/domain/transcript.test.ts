import { describe, expect, it } from 'vitest';
import { buildProfile } from './buildProfile';
import { defaultAcademic } from '../state';
import { classifyRow, courseKey, parseTranscript, rowErrors } from './transcript';
import timetables from '../data/timetables.json';

const profile = buildProfile(defaultAcademic(2025));
const row = '2025 1학기 심화 BKSA47127 가상테스트교과목 1 P';

describe('성적표 추출과 시간표 영역 매칭', () => {
  it('개인정보를 보관하지 않고 코드·등급·학기를 추출한다', () => {
    const result = parseTranscript(`성명: 가상학생\n학번: 202599999\n${row}\n총 취득학점 : 1.0`, profile);
    expect(result.rows[0].course).toMatchObject({ semester: '2025-1', courseCode: 'BKSA47127', credits: 1, grade: 'P' });
    expect(JSON.stringify(result)).not.toMatch(/가상학생|202599999/);
    expect(result.warnings).toEqual([]);
  });
  it('다른 학기 자료는 후보로만 제공하고 반영을 차단한다', () => {
    const parsed = parseTranscript(row, profile, timetables.filter(table => table.term === '2026-2')).rows[0];
    expect(parsed.course.categoryId).toBe('');
    expect(parsed.candidateCategoryId).toBe('ge-advanced-science');
    expect(rowErrors(parsed, profile)).toContain('확인 체크 필요');
    parsed.course.categoryId = parsed.candidateCategoryId;
    expect(rowErrors(parsed, profile)).toEqual(['확인 체크 필요']);
    parsed.confirmed = true;
    expect(rowErrors(parsed, profile)).toEqual([]);
  });
  it('같은 학기 자료는 자동 분류한다', () => {
    const parsed = parseTranscript(row.replace('2025 1학기', '2026 2학기'), profile).rows[0];
    expect(parsed.course.categoryId).toBe('ge-advanced-science');
    expect(rowErrors(parsed, profile)).toEqual([]);
  });
  it('추가한 과거 동일 학기 자료로 후보 확인을 생략한다', () => {
    const parsed = parseTranscript(row, profile).rows[0];
    expect(parsed.course.categoryId).toBe('ge-advanced-science');
    expect(parsed.candidateCategoryId).toBe('');
    expect(parsed.needsConfirmation).toBe(false);
    expect(parsed.classification).toContain('동일 학기 시간표: 2025-1');
    expect(rowErrors(parsed, profile)).toEqual([]);
  });
  it('같은 학기 자료가 있으면 다른 학기 분류가 충돌해도 그 학기를 우선한다', () => {
    const tables = timetables.filter(table => table.term === '2025-1' || table.term === '2026-2').map(table => table.term === '2026-2' ? { ...table, courses: table.courses.map(item => item.code === 'BKSA47127' ? { ...item, area: '예술과체육' } : item) } : table);
    expect(parseTranscript(row, profile, tables).rows[0].course.categoryId).toBe('ge-advanced-science');
  });
  it('같은 학기 안에서 영역이 충돌하면 자동 분류하지 않는다', () => {
    const tables = timetables.filter(table => table.term === '2025-1').map(table => ({ ...table, courses: [...table.courses, { code: 'BKSA47127', name: '가상충돌', kind: '심화', credits: 1, area: '예술과체육' }] }));
    const parsed = parseTranscript(row, profile, tables).rows[0];
    expect(parsed.course.categoryId).toBe('');
    expect(parsed.candidateCategoryId).toBe('');
    expect(parsed.needsConfirmation).toBe(true);
  });
  it('이수 학기 자료에 과목이 빠졌다면 다른 학기 자료로 몰래 대체하지 않는다', () => {
    const tables = timetables.filter(table => table.term === '2025-1' || table.term === '2026-2').map(table => table.term === '2025-1' ? { ...table, courses: table.courses.filter(item => item.code !== 'BKSA47127') } : table);
    expect(parseTranscript(row, profile, tables).rows[0].course.categoryId).toBe('');
  });
  it('2020년부터 기존 2026-2까지 정규·계절학기 27개를 보관한다', () => {
    expect(timetables).toHaveLength(27);
    expect(new Set(timetables.map(table => table.term)).size).toBe(27);
    for (let year = 2020; year <= 2025; year++) for (const term of ['1', '2', '여름', '겨울']) {
      expect(timetables.some(table => table.term === `${year}-${term}`)).toBe(true);
    }
    for (const term of ['2026-1', '2026-여름', '2026-2']) expect(timetables.some(table => table.term === term)).toBe(true);
    expect(timetables.find(table => table.term === '2026-2')!.courses).toHaveLength(208);
  });
  it('의사소통은 대응하는 기존 교육과정에서만 자동 분류한다', () => {
    const old = buildProfile(defaultAcademic(2020));
    const sample = timetables.find(table => table.term === '2020-1')!.courses.find(c => c.kind === '기초' && c.area === '의사소통')!;
    const c = parseTranscript(`2020 1학기 기초 ${sample.code} 가상의사소통 ${sample.credits} A`, old).rows[0].course;
    expect(c.categoryId).toBe('ge-communication');
    expect(classifyRow(c, '기초', profile).categoryId).toBe('');
  });
  it('과거 인문언어와 빈 영역은 임의 매핑하지 않는다', () => {
    const old = buildProfile(defaultAcademic(2020));
    const samples = timetables.flatMap(table => table.courses.filter(c => c.area === '인문언어' || c.area === '').map(c => ({ ...c, term: table.term })));
    expect(samples.length).toBeGreaterThan(0);
    for (const sample of samples) {
      const parsed = parseTranscript(`${sample.term.replace('-', ' ')}학기 ${sample.kind} ${sample.code} 가상미확인 ${sample.credits} A`, old).rows[0];
      expect(parsed.course.categoryId).toBe('');
      expect(parsed.needsConfirmation).toBe(true);
    }
  });
  it('같은 이름이어도 코드가 없으면 추측하지 않는다', () => {
    const parsed = parseTranscript(row.replace('BKSA47127', 'UNKNOWN99999'), profile).rows[0];
    expect(parsed.candidateCategoryId).toBe('');
    expect(parsed.course.categoryId).toBe('');
  });
  it('같은 코드여도 학점이 다르면 후보를 적용하지 않는다', () => {
    const parsed = parseTranscript(row.replace('1 P', '3 P'), profile).rows[0];
    expect(parsed.candidateCategoryId).toBe('');
  });
  it('원전공과 다전공 구분은 사용자에게 확인받는다', () => {
    const dual = buildProfile({ ...defaultAcademic(2025), secondaryDepartmentId: 'management', secondarySelectionYear: 2025 });
    const parsed = parseTranscript('2025 1학기 전선 NDGE12345 가상전공 3 A+', dual).rows[0];
    expect(parsed.course.categoryId).toBe('');
    expect(parsed.needsConfirmation).toBe(true);
  });
  it('단일전공 전선은 PDF 구분으로 분류한다', () => {
    expect(parseTranscript('2025 1학기 전선 NDGE12345 가상전공 3 A+', profile).rows[0].course.categoryId).toBe('primary-elective');
  });
  it('특별 인정·삭제 표시는 별도 확인하고 삭제 자격을 추측하지 않는다', () => {
    const parsed = parseTranscript(`${row} 특별인정`, profile).rows[0];
    expect(parsed.course.deletionEligibility).toBe('unknown');
    expect(parsed.note).toBe('특별인정');
  });
  it('모든 학기의 동참형학기제 P 인정은 확인 체크 없이 일반교양으로 반영한다', () => {
    for (const year of [2020, 2024, 2025, 2026]) for (const term of ['1학기', '2학기', '여름학기', '겨울학기']) {
      const parsed = parseTranscript(`${year} ${term} 일교 ZAAA58470 가상동참 1 P 동참형학기제인정학점`, profile).rows[0];
      expect(parsed.course.categoryId).toBe('ge-other');
      expect(parsed.course.deletionEligibility).toBe('ineligible');
      expect(parsed.note).toBe('');
      expect(parsed.needsConfirmation).toBe(false);
      expect(rowErrors(parsed, profile)).toEqual([]);
    }
  });
  it('동참형학기제라도 다른 인정문구·등급·학점이면 확인받는다', () => {
    for (const line of [
      '2025 1학기 일교 ZAAA58470 가상동참 1 P 다른인정',
      '2025 1학기 일교 ZAAA58470 가상동참 2 P 동참형학기제인정학점',
      '2025 1학기 일교 ZAAA58470 가상동참 1 A 동참형학기제인정학점',
    ]) expect(rowErrors(parseTranscript(line, profile).rows[0], profile)).toContain('확인 체크 필요');
  });
  it('불완전한 행과 총량 차이를 숨기지 않는다', () => {
    const parsed = parseTranscript(`${row}\n2025 2학기 전선 판독실패\n총 취득학점 : 10.0`, profile);
    expect(parsed.warnings).toHaveLength(2);
  });
  it('스캔 또는 빈 PDF에 해당하는 텍스트는 거절한다', () => {
    expect(() => parseTranscript('', profile)).toThrow('스캔 PDF');
  });
  it('F와 NP는 취득학점으로 합산하지 않는다', () => {
    const parsed = parseTranscript('2025 1학기 전선 TEST12345 가상실패 3 F\n2025 2학기 일교 TEST54321 가상NP 2 NP\n총 취득학점 : 0.0', profile);
    expect(parsed.rows[1].course.grade).toBe('N');
    expect(parsed.warnings).toEqual([]);
  });
  it('제외한 불확실한 행은 반영 검증에서 제외한다', () => {
    const parsed = parseTranscript(row, profile).rows[0];
    parsed.included = false;
    expect(rowErrors(parsed, profile)).toEqual([]);
  });
  it('중복 키는 학기와 학수번호를 함께 사용한다', () => {
    const c = parseTranscript(row, profile).rows[0].course;
    expect(courseKey(c)).not.toBe(courseKey({ ...c, semester: '2025-2' }));
    expect(courseKey(c)).toBe(courseKey({ ...c, grade: 'A+', name: '다른 표시명' }));
  });
  it('2020 의사소통 영역 합산은 해당 교육과정일 때만 적용한다', () => {
    const old = buildProfile(defaultAcademic(2020));
    const sample = timetables.find(table => table.term === '2026-2')!.courses.find(c => c.kind === '기초' && c.area === '글쓰기')!;
    const c = parseTranscript(`2026 2학기 기초 ${sample.code} 가상글쓰기 ${sample.credits} A`, old).rows[0].course;
    expect(classifyRow(c, '기초', old).categoryId).toBe('ge-communication');
  });
  it('시간표에는 교양 분류에 필요한 정보만 남긴다', () => {
    for (const table of timetables) {
      expect(table.term).toMatch(/^\d{4}-(1|2|여름|겨울)$/);
      expect(table.sha256).toHaveLength(64);
      for (const course of table.courses) expect(Object.keys(course).sort()).toEqual(['area', 'code', 'credits', 'kind', 'name']);
    }
  });
});
