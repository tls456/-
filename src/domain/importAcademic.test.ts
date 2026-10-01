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
  it('PDF에 등록학기가 없으면 서로 다른 정규학기 수에 현재 학기 1을 더한다', () => {
    const result = proposal();
    expect(result.registeredSemesters).toBe(4);
    expect(result.registrationEstimated).toBe(true);
  });
  it('등록학기는 계절학기 개수로 세지 않는다', () => {
    const seasonal = text + '\n2025 여름학기 전선 TEST10004 가상계절 3 P';
    const result = proposal(seasonal.replace('취득학점 : 6', '취득학점 : 9'));
    expect(result.registeredSemesters).toBe(4);
    expect(result.baseline).toBeNull();
  });
  it('입학 후 경과한 학기나 누락된 학기를 채우지 않고 PDF에 등장한 학기만 센다', () => {
    expect(proposal(text.replace('2025 2학기 전선 TEST10002 가상2 3 P\n', '').replace('취득학점 : 6', '취득학점 : 3')).registeredSemesters).toBe(3);
    expect(proposal(text, { admissionType: 'transfer' }).registeredSemesters).toBe(4);
    expect(proposal(text, { admissionType: 'major-change' }).registeredSemesters).toBe(4);
  });
  it('같은 학기의 여러 과목은 한 번만 세며 F/P도 등록학기 기록으로 센다', () => {
    const result = proposal(`${text}\n2025 1학기 전선 TEST10004 같은학기 3 F`);
    expect(result.registeredSemesters).toBe(4);
  });
  it('등록학기 제안은 취득학점 총량 불일치 여부와 별개다', () => {
    expect(proposal(text.replace('취득학점 : 6', '취득학점 : 9')).registeredSemesters).toBe(4);
  });
  it('2차도 PDF의 정규학기 수에 1을 더하며 명시된 등록학기는 우선한다', () => {
    expect(proposal(text, { deletionRound: 'second' }).registeredSemesters).toBe(4);
    expect(proposal(`등록학기 수: 4\n${text}`, { deletionRound: 'second' }).registeredSemesters).toBe(4);
  });
  it('확인하지 않은 등록학기 추정값으로 포기 자격을 확정하지 않는다', () => {
    const policy = calculateDeletionPolicy({ ...academic, enrollmentStatus: 'enrolled', registeredSemesters: 4, registeredSemestersEstimated: true, baselineEarnedCredits: 60 }, { totalGraduationCredits: 132 });
    expect(policy.confirmed).toBe(false);
    expect(policy.unknownReasons?.join(' ')).toContain('추정');
  });
});
