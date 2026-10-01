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
    const parsed = parseTranscript(row, profile).rows[0];
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
    const sample = timetables[0].courses.find(c => c.kind === '기초' && c.area === '글쓰기')!;
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
