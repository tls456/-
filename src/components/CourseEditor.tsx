import { useState, type FormEvent } from 'react';
import type { Course, GradeDefinition, PlannedCourse } from '../domain/types';
import { Field, Modal, Notice } from './ui';

export type CategoryOption = { id: string; label: string };
export type CourseOption = { code: string; name: string; credits: number; categoryId: string };

type Props = {
  course?: Course | PlannedCourse;
  planned?: boolean;
  grades: GradeDefinition[];
  categories: CategoryOption[];
  catalog: CourseOption[];
  onSave: (course: Course | PlannedCourse) => void;
  onClose: () => void;
};

export function CourseEditor({ course, planned = false, grades, categories, catalog, onSave, onClose }: Props) {
  const existing = course as Course | undefined;
  const [draft, setDraft] = useState({
    id: course?.id ?? crypto.randomUUID(), courseCode: course?.courseCode ?? '', name: course?.name ?? '',
    semester: existing?.semester ?? '', categoryId: course?.categoryId ?? categories[0]?.id ?? '',
    credits: String(course?.credits ?? 3), grade: existing?.grade ?? 'A',
    eligibility: existing?.deletionEligibility ?? 'eligible', reason: existing?.deletionReason ?? '',
    transfer: existing?.transferCredit ?? false, graded: (course as PlannedCourse | undefined)?.graded ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const update = (patch: Partial<typeof draft>) => setDraft(previous => ({ ...previous, ...patch }));
  function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!draft.name.trim()) nextErrors.name = '과목명을 입력해 주세요.';
    if (!planned && !/^\d{4}-(1|2|여름|겨울)$/.test(draft.semester)) nextErrors.semester = '예: 2024-1, 2024-2, 2024-여름, 2024-겨울';
    if (!/^[1-9]\d*$/.test(draft.credits) || Number(draft.credits) > 1000) nextErrors.credits = '과목 학점 수는 1~1000 사이의 양의 정수여야 합니다. 소수 학점은 지원하지 않습니다.';
    if (!categories.some(category => category.id === draft.categoryId)) nextErrors.category = '과목 구분을 선택해 주세요.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const shared = { id: draft.id, courseCode: draft.courseCode.trim() || undefined, name: draft.name.trim(), categoryId: draft.categoryId, credits: Number(draft.credits) };
    onSave(planned ? { ...shared, graded: draft.graded } : { ...shared, semester: draft.semester, grade: draft.grade,
      deletionEligibility: draft.eligibility, deletionReason: draft.reason.trim() || undefined, transferCredit: draft.transfer });
  }
  return <Modal title={`${planned ? '계획' : '이수'} 과목 ${course ? '수정' : '추가'}`} onClose={onClose}>
    <form onSubmit={submit} className="stack">
      {catalog.length > 0 && <Field label="교육과정에서 찾아 채우기" hint="동일·대체 과목 인정은 본인의 이수구분을 확인해 주세요."><select value="" onChange={event => {
        const picked = catalog.find(item => `${item.categoryId}:${item.code}` === event.target.value);
        if (picked) update({ courseCode: picked.code, name: picked.name, credits: String(picked.credits), categoryId: picked.categoryId });
      }}><option value="">직접 입력 또는 과목 선택</option>{catalog.map(item => <option key={`${item.categoryId}:${item.code}`} value={`${item.categoryId}:${item.code}`}>{item.name} · {item.code}</option>)}</select></Field>}
      <Field label="과목명" error={errors.name}><input value={draft.name} maxLength={100} onChange={event => update({ name: event.target.value })} placeholder="예: 자료구조" /></Field>
      <div className="form-grid">
        <Field label="과목 코드" hint="필수 과목 확인에 사용합니다."><input value={draft.courseCode} maxLength={60} onChange={event => update({ courseCode: event.target.value })} placeholder="예: NDGE15060" /></Field>
        {!planned && <Field label="이수 학기" error={errors.semester}><input value={draft.semester} onChange={event => update({ semester: event.target.value })} placeholder="2024-1" /></Field>}
        <Field label="과목 구분" error={errors.category}><select value={draft.categoryId} onChange={event => update({ categoryId: event.target.value })}>{categories.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}</select></Field>
        <Field label="과목 학점 수" error={errors.credits}><input type="number" min="1" max="1000" step="1" value={draft.credits} onChange={event => update({ credits: event.target.value })} /></Field>
        {planned ? <Field label="성적 방식"><select value={draft.graded ? 'graded' : 'pass'} onChange={event => update({ graded: event.target.value === 'graded' })}><option value="graded">일반 등급 · 평점 반영</option><option value="pass">P/F · 평점 미반영</option></select></Field> : <Field label="취득 등급"><select value={draft.grade} onChange={event => update({ grade: event.target.value })}>{grades.map(grade => <option key={grade.label} value={grade.label}>{grade.label}{grade.points !== null ? ` · ${grade.points.toFixed(1)}` : ' · 평점 미반영'}</option>)}</select></Field>}
      </div>
      {!planned && <>
        <label className="check-label"><input type="checkbox" checked={draft.transfer} onChange={event => update({ transfer: event.target.checked })} />편입학 시 인정받은 과목 (본교 평균평점 제외·포기 불가)</label>
        <details className="details-box"><summary>개별 삭제 자격 보완</summary><div className="stack compact"><p className="muted small">등급·등록 학기·신청 차수는 자동 검사합니다. 별도로 확인할 사항이 있는 과목에 표시해 주세요.</p><Field label="추가 확인 상태"><select value={draft.eligibility} onChange={event => update({ eligibility: event.target.value as Course['deletionEligibility'] })}><option value="eligible">추가 제한 없음</option><option value="unknown">자격 확인 필요</option><option value="ineligible">삭제 불가 확인</option></select></Field><Field label="사유"><input value={draft.reason} onChange={event => update({ reason: event.target.value })} placeholder="확인이 필요한 내용을 입력하세요" /></Field></div></details>
        <Notice>재수강은 학교에서 최종 반영하는 성적 상태로 입력해 주세요. 같은 과목명의 기록도 각각 추가할 수 있습니다.</Notice>
      </>}
      {planned && <Notice>P/F 과목은 P를 취득한다는 가정으로 졸업 요건에 반영합니다. 미래 계획은 아직 이수하지 않은 조건부 결과입니다.</Notice>}
      <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>취소</button><button className="button primary" type="submit">{course ? '수정 사항 반영' : '과목 추가'}</button></div>
    </form>
  </Modal>;
}
