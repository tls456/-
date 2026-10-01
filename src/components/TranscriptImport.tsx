import { useEffect, useRef, useState } from 'react';
import { GRADES } from '../data/academic';
import type { BuiltProfile } from '../domain/buildProfile';
import type { Course } from '../domain/types';
import { courseKey, parseTranscript, rowErrors, timetableSummary, type Transcript, type TranscriptRow } from '../domain/transcript';
import { Field, Modal, Notice } from './ui';

export function TranscriptImport({ profile, existing, onApply, onClose }: {
  profile: BuiltProfile; existing: Course[]; onApply: (courses: Course[], mode: 'append' | 'replace') => void; onClose: () => void;
}) {
  const [data, setData] = useState<Transcript | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'append' | 'replace'>('append');
  const [acknowledged, setAcknowledged] = useState(false);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  async function read(file: File) {
    const request = ++generation.current;
    setBusy(true); setError(''); setData(null); setAcknowledged(false); setReplaceConfirmed(false);
    try {
      const { extractPdfText } = await import('../pdf');
      const parsed = parseTranscript(await extractPdfText(file), profile);
      if (parsed.rows.length > 2000) throw new Error('한 번에 최대 2000개 과목까지 가져올 수 있습니다.');
      if (generation.current === request) setData(parsed);
    } catch (issue) {
      if (generation.current === request) setError(issue instanceof Error ? issue.message : '성적표를 읽지 못했습니다.');
    } finally { if (generation.current === request) setBusy(false); }
  }
  function edit(index: number, patch: Partial<TranscriptRow>) {
    setData(previous => previous ? { ...previous, rows: previous.rows.map((row, i) => i === index ? { ...row, ...patch } : row) } : previous);
  }
  function editCourse(index: number, patch: Partial<Course>) {
    if (data) edit(index, { course: { ...data.rows[index].course, ...patch } });
  }
  const existingKeys = new Set(existing.map(courseKey));
  const selected = data?.rows.filter(row => row.included) ?? [];
  const pending = selected.filter(row => mode === 'replace' || !existingKeys.has(courseKey(row.course)));
  const duplicateCount = selected.length - pending.length;
  const candidates = pending.filter(row => row.candidateCategoryId);
  const confirmableCandidates = candidates.filter(row => row.course.categoryId === row.candidateCategoryId && !row.note && !row.course.transferCredit);
  const duplicateKeys = new Set<string>();
  let internalDuplicates = false;
  for (const row of pending) { const key = courseKey(row.course); if (duplicateKeys.has(key)) internalDuplicates = true; duplicateKeys.add(key); }
  const errors = pending.flatMap(row => rowErrors(row, profile));
  const ready = !!data && !busy && pending.length > 0 && errors.length === 0 && !internalDuplicates
    && (!data.warnings.length || acknowledged) && (mode !== 'replace' || replaceConfirmed)
    && (mode === 'replace' ? pending.length : existing.length + pending.length) <= 2000;
  return <Modal title="성적표 PDF 가져오기" wide onClose={onClose}><div className="stack transcript-import">
    <Notice>PDF는 이 브라우저에서만 읽습니다. 파일 원본·이름·학번은 저장하거나 외부에 전송하지 않습니다. 확정한 과목은 기존 자동 저장 설정을 따릅니다. 스캔·암호 PDF는 지원하지 않습니다.</Notice>
    <Field label="성적표 PDF"><input type="file" accept="application/pdf,.pdf" disabled={busy} onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ''; if (file) void read(file);
    }}/></Field>
    {busy && <p role="status">과목 표를 읽고 시간표 자료와 비교하고 있습니다…</p>}
    {error && <Notice tone="error">{error}</Notice>}
    <p className="muted small">개발자가 등록한 시간표: {timetableSummary || '없음'}. 과목명이 아닌 학수번호·이수구분으로 매칭합니다.</p>
    {data && <>
      <div className="import-summary"><strong>추출 {data.rows.length}과목 · {data.rows.reduce((sum, row) => sum + row.course.credits, 0)}학점</strong><span>성적표 총 취득학점: {data.reportedCredits ?? '미확인'} · 총 평균평점: {data.reportedGpa ?? '미확인'}</span></div>
      <Notice>다른 학기의 시간표는 분류 후보만 제공합니다. 후보를 선택하고 각 과목의 확인 체크를 해 주세요. 인정·삭제 표시가 있는 과목은 학교에서 최종 반영된 기록인지 확인하고, 이미 삭제된 기록은 포함을 해제하세요. 편입 인정은 별도로 체크합니다.</Notice>
      {data.warnings.length > 0 && <Notice tone="warning"><ul>{data.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul><label className="check-label"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)}/>누락·총량 차이를 확인했고 필요한 수정 또는 제외를 했습니다.</label></Notice>}
      <Field label="반영 방식"><select aria-label="반영 방식" value={mode} onChange={event => { setMode(event.target.value as typeof mode); setReplaceConfirmed(false); }}><option value="append">기존 성적에 추가 (동일 학기·학수번호는 건너뜀)</option><option value="replace">기존 이수 성적 전체 교체</option></select></Field>
      {mode === 'replace' && <Notice tone="warning"><label className="check-label"><input type="checkbox" checked={replaceConfirmed} onChange={event => setReplaceConfirmed(event.target.checked)}/>기존 이수 과목 {existing.length}개와 삭제 선택을 교체합니다. 필요한 기록을 백업했고 교체에 동의합니다.</label>학적·개인별 요건·미래 학기 계획은 유지됩니다.</Notice>}
      {duplicateCount > 0 && <Notice>기존 기록과 중복되는 {duplicateCount}개는 추가하지 않습니다. 등급이 달라도 덮어쓰지 않습니다. 수정이 필요하면 기존 과목을 수정하거나 전체 교체를 선택하세요.</Notice>}
      {internalDuplicates && <Notice tone="error">가져올 기록 안에 동일 학기·학수번호가 중복됩니다. 재수강·중복 행을 확인하고 불필요한 기록의 포함을 해제해 주세요.</Notice>}
      {candidates.length > 0 && <div className="stack compact">
        <button className="button secondary" onClick={() => setData(previous => previous ? { ...previous, rows: previous.rows.map(row => candidates.includes(row) ? { ...row, course: { ...row.course, categoryId: row.candidateCategoryId }, confirmed: false } : row) } : previous)}>시간표 분류 후보 {candidates.length}개 일괄 선택</button>
        {confirmableCandidates.length > 0 && <label className="check-label"><input type="checkbox" checked={confirmableCandidates.every(row => row.confirmed)} onChange={event => {
          const checked = event.target.checked;
          setData(previous => previous ? { ...previous, rows: previous.rows.map(row => confirmableCandidates.includes(row) ? { ...row, confirmed: checked } : row) } : previous);
        }}/>아래 다른 학기 시간표 후보 {confirmableCandidates.length}개의 영역을 모두 검토했고 해당 분류 적용을 확인합니다. (특별 인정·삭제 표시는 별도 확인)</label>}
      </div>}
      <div className="import-rows">{data.rows.map((row, index) => {
        const duplicate = mode === 'append' && existingKeys.has(courseKey(row.course));
        const issues = rowErrors(row, profile);
        return <section className="import-row" key={row.course.id}>
          <div className="import-row-heading"><label className="check-label"><input aria-label={`${index + 1}번 과목 포함`} type="checkbox" checked={row.included} onChange={event => edit(index, { included: event.target.checked })}/><strong>{index + 1}. {row.course.name}</strong></label><span className="muted small">성적표 구분: {row.kind}{duplicate ? ' · 기존 기록과 중복' : ''}</span></div>
          <div className="form-grid">
            <Field label={`${index + 1}번 과목명`}><input value={row.course.name} maxLength={100} onChange={event => editCourse(index, { name: event.target.value })}/></Field>
            <Field label={`${index + 1}번 학수번호`}><input value={row.course.courseCode ?? ''} maxLength={60} onChange={event => {
              edit(index, { course: { ...row.course, courseCode: event.target.value, categoryId: '' }, candidateCategoryId: '', classification: '코드 변경: 과목 구분을 다시 확인해 주세요.', needsConfirmation: true, confirmed: false });
            }}/></Field>
            <Field label={`${index + 1}번 이수 학기`}><input value={row.course.semester} onChange={event => edit(index, { course: { ...row.course, semester: event.target.value, categoryId: '' }, candidateCategoryId: '', classification: '학기 변경: 과목 구분을 다시 확인해 주세요.', needsConfirmation: true, confirmed: false })}/></Field>
            <Field label={`${index + 1}번 학점`}><input type="number" min="1" step="1" value={row.course.credits} onChange={event => editCourse(index, { credits: Number(event.target.value) })}/></Field>
            <Field label={`${index + 1}번 등급`}><select value={row.course.grade} onChange={event => editCourse(index, { grade: event.target.value })}>{GRADES.map(grade => <option key={grade.label}>{grade.label}</option>)}</select></Field>
            <Field label={`${index + 1}번 과목 구분`} hint={row.classification}><select value={row.course.categoryId} onChange={event => edit(index, { course: { ...row.course, categoryId: event.target.value }, needsConfirmation: true, confirmed: false })}><option value="">확인 필요 · 선택해 주세요</option>{profile.categories.map(item => <option key={item.id} value={item.id}>{item.label}{item.id === row.candidateCategoryId ? ' (시간표 후보)' : ''}</option>)}</select></Field>
          </div>
          {row.candidateCategoryId && <button className="button secondary" onClick={() => edit(index, { course: { ...row.course, categoryId: row.candidateCategoryId }, confirmed: false })}>시간표 분류 후보 선택</button>}
          {row.note && <p className="muted small">성적표 인정/삭제 표시: {row.note}</p>}
          <label className="check-label"><input type="checkbox" checked={row.course.transferCredit ?? false} onChange={event => edit(index, { course: { ...row.course, transferCredit: event.target.checked, deletionEligibility: event.target.checked ? 'ineligible' : row.note ? 'unknown' : 'eligible' }, needsConfirmation: true, confirmed: false })}/>편입 인정학점 (본교 GPA 제외·포기 불가)</label>
          {(row.needsConfirmation || row.note) && <label className="check-label"><input aria-label={`${index + 1}번 분류와 인정 상태 확인`} type="checkbox" checked={row.confirmed} onChange={event => edit(index, { confirmed: event.target.checked })}/>선택한 영역과 최종 성적 반영·인정 상태를 확인했습니다.</label>}
          {row.included && !duplicate && issues.length > 0 && <p className="error-text">{issues.join(' · ')}</p>}
        </section>;
      })}</div>
      <p className="muted small">반영 예정 {pending.length}개. 재수강·학점포기 이력 및 삭제 한도의 기준 취득학점은 가져오기 후 적용 규칙에서 확인하세요.</p>
      <div className="modal-actions"><button className="button secondary" onClick={onClose}>취소</button><button className="button primary" disabled={!ready} onClick={() => {
        if (ready) onApply(pending.map(row => ({ ...row.course, id: crypto.randomUUID() })), mode);
      }}>확인한 성적 반영</button></div>
    </>}
  </div></Modal>;
}
