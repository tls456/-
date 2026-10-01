import { describe, expect, it } from 'vitest';
import { defaultAcademic } from '../state';
import { buildProfile } from './buildProfile';
import { parseTranscript } from './transcript';
import { proposeImportAcademic } from './importAcademic';
import { calculateDeletionPolicy } from '../data/academic';

const academic = defaultAcademic(2025);
const profile = buildProfile(academic);
const text = '2025 1학기 전선 TEST10001 가상1 3 A\n2025 2학기 전선 TEST10002 가상2 3 P\n2026 1학기 전선 TEST10003 가상3 3 F\n총 취득학점 : 6';
function proposal(value = text, patch = {}, term = '2026-2') {
  const transcript = parseTranscript(value, profile);
  return proposeImportAcademic(transcript, transcript.rows.map(row => row.course), { ...academic, ...patch }, term);
}

describe('성적표의 학적 자동 입력 제안', () => {
  it('P는 취득학점에 포함하고 F는 제외한다', () => expect(proposal().baseline).toBe(6));
  it('성적표 총량과 일치하지 않으면 자동 확정하지 않는다', () => expect(proposal(text.replace('취득학점 : 6', '취득학점 : 9')).baseline).toBeNull());
  it('1차는 이전 학기, 2차는 당해 학기까지 합산한다', () => {
    const full = text.replace('3 F', '3 A').replace('취득학점 : 6', '취득학점 : 9');
    expect(proposal(full, { deletionRound: 'first' }, '2026-1').baseline).toBe(6);
    expect(proposal(full, { deletionRound: 'second' }, '2026-1').baseline).toBe(9);
  });
  it('PDF에 명시된 등록학기 수는 추정값과 구분한다', () => {
    const result = proposal(`등록학기 수: 5\n${text}`);
    expect(result.registeredSemesters).toBe(5);
    expect(result.registrationEstimated).toBe(false);
  });
  it('연속 이수 기록이 있어도 PDF에 없는 등록학기는 추정하지 않는다', () => {
    const result = proposal();
    expect(result.registeredSemesters).toBeNull();
    expect(result.registrationEstimated).toBe(false);
  });
  it('등록학기는 계절학기 개수로 세지 않는다', () => {
    const seasonal = text + '\n2025 여름학기 전선 TEST10004 가상계절 3 P';
    const result = proposal(seasonal.replace('취득학점 : 6', '취득학점 : 9'));
    expect(result.registeredSemesters).toBeNull();
    expect(result.baseline).toBeNull();
  });
  it('누락된 정규학기와 편입·전과는 등록학기를 추정하지 않는다', () => {
    expect(proposal(text.replace('2025 2학기 전선 TEST10002 가상2 3 P\n', '').replace('취득학점 : 6', '취득학점 : 3')).registeredSemesters).toBeNull();
    expect(proposal(text, { admissionType: 'transfer' }).registeredSemesters).toBeNull();
    expect(proposal(text, { admissionType: 'major-change' }).registeredSemesters).toBeNull();
  });
  it('확인하지 않은 등록학기 추정값으로 포기 자격을 확정하지 않는다', () => {
    const policy = calculateDeletionPolicy({ ...academic, enrollmentStatus: 'enrolled', registeredSemesters: 4, registeredSemestersEstimated: true, baselineEarnedCredits: 60 }, { totalGraduationCredits: 132 });
    expect(policy.confirmed).toBe(false);
    expect(policy.unknownReasons?.join(' ')).toContain('추정');
  });
});
