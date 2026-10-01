import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, GraduationCap, Sprout, Check } from 'lucide-react';
import { ACADEMIC_YEARS, getCurriculumYear, getSecondaryCurriculumYear, type StudentAcademic } from '../data/academic';
import { getDepartmentsForYear } from '../data/catalog';
import { defaultAcademic } from '../state';
import { Badge, Field, Notice } from './ui';

const years = ACADEMIC_YEARS.map(year => <option key={year} value={year}>{year}학년도</option>);

export function AcademicForm({ value, onChange }: { value: StudentAcademic; onChange: (value: StudentAcademic) => void }) {
  const update = (patch: Partial<StudentAcademic>) => onChange({ ...value, ...patch });
  const [role, setRole] = useState(value.primaryDepartmentId === 'computer' ? value.secondaryDepartmentId ? 'primary' : 'single' : 'secondary');
  const primaryYear = getCurriculumYear(value).year ?? value.entryYear;
  const secondaryYear = getSecondaryCurriculumYear(value).year ?? value.entryYear;
  const counterpartYear = role === 'secondary' ? primaryYear : secondaryYear;
  const departments = getDepartmentsForYear(counterpartYear).filter(department => department.departmentId !== 'computer');
  return <div className="stack">
    <div className="form-grid">
      <Field label="학번 기준 입학연도"><select value={value.entryYear} onChange={event => update({ entryYear: Number(event.target.value), curriculumYear: null })}>{years}</select></Field>
      <Field label="입학·학적 유형"><select value={value.admissionType} onChange={event => update({ admissionType: event.target.value as StudentAcademic['admissionType'], curriculumYear: null })}><option value="freshman">일반 신입학</option><option value="transfer">편입학</option><option value="major-change">전과</option></select></Field>
      {value.admissionType === 'transfer' && <>
        <Field label="실제 편입한 연도"><select value={value.transferAdmissionYear ?? ''} onChange={event => update({ transferAdmissionYear: event.target.value ? Number(event.target.value) : null })}><option value="">선택해 주세요</option>{years}</select></Field>
        <Field label="편입 학년"><select value={value.transferEntryGrade ?? ''} onChange={event => update({ transferEntryGrade: event.target.value ? Number(event.target.value) as 2 | 3 | 4 : null })}><option value="">선택해 주세요</option><option value="2">2학년</option><option value="3">3학년</option><option value="4">4학년</option></select></Field>
      </>}
      <Field label={value.admissionType === 'major-change' ? '전과 후 적용 교육과정' : '적용 교육과정'} hint="복학 등으로 교육과정을 변경했다면 학교에서 확인한 연도를 선택하세요."><select value={value.curriculumYear ?? ''} onChange={event => update({ curriculumYear: event.target.value ? Number(event.target.value) : null })}><option value="">{value.admissionType === 'major-change' ? '확인한 연도를 선택해 주세요' : '입학·편입 정보로 자동 매칭'}</option>{years}</select></Field>
      <Field label="전공 구성"><select value={role} onChange={event => {
        const next = event.target.value;
        setRole(next);
        update({ primaryDepartmentId: next === 'secondary' ? '' : 'computer', secondaryDepartmentId: next === 'single' ? null : next === 'secondary' ? 'computer' : '', secondarySelectionYear: null });
      }}><option value="single">컴퓨터공학과 단일전공</option><option value="primary">컴퓨터공학과 원전공 + 다른 복수전공</option><option value="secondary">다른 원전공 + 컴퓨터공학과 복수전공</option></select></Field>
      {role !== 'single' && <>
        <Field label="복수전공 선발연도" hint="복수전공은 입학연도가 아닌 선발연도 교육과정을 적용합니다."><select value={value.secondarySelectionYear ?? ''} onChange={event => update({ secondarySelectionYear: event.target.value ? Number(event.target.value) : null })}><option value="">선택해 주세요</option>{years}</select></Field>
        <Field label={role === 'secondary' ? '원전공 학과' : '복수전공 학과'}><select value={role === 'secondary' ? value.primaryDepartmentId : value.secondaryDepartmentId ?? ''} onChange={event => update(role === 'secondary' ? { primaryDepartmentId: event.target.value } : { secondaryDepartmentId: event.target.value })}><option value="">학과를 선택해 주세요</option>{departments.map(department => <option key={department.departmentId} value={department.departmentId}>{department.name}</option>)}</select></Field>
      </>}
    </div>
    {value.admissionType === 'transfer' && <Notice>편입 인정학점은 이수 기록에 별도로 표시해 주세요. 전적대 성적은 본교 평균평점에서 제외하며, 개인별 인정·면제 내역은 별도 확인합니다.</Notice>}
    {value.admissionType === 'major-change' && <Notice>이전 학과에서 이수한 과목은 전과 후 승인된 이수구분으로 입력해 주세요. 과목의 자동 재분류는 하지 않습니다.</Notice>}
    <div className="match-preview"><Check size={18}/><div><strong>{getCurriculumYear(value).year ? `${getCurriculumYear(value).year}학년도 교육과정` : '적용 교육과정 확인 필요'}</strong><span>{getCurriculumYear(value).unknownReasons.join(' ') || (value.entryYear === 2020 && value.primaryDepartmentId === 'computer' ? '2020학번은 당시 소프트웨어전공 교육과정에 매칭됩니다.' : '공식 요람에 수록된 졸업 기준으로 연결합니다.')}</span></div></div>
  </div>;
}

export function Onboarding({ onStart, onDemo, restoreError }: { onStart: (academic: StudentAcademic) => void; onDemo: () => void; restoreError: string | null }) {
  const [studentId, setStudentId] = useState('');
  const [academic, setAcademic] = useState<StudentAcademic | null>(null);
  const [error, setError] = useState('');
  function next(event: FormEvent) {
    event.preventDefault();
    const year = Number(studentId.slice(0, 4));
    if (!/^\d{4,12}$/.test(studentId) || !ACADEMIC_YEARS.includes(year as typeof ACADEMIC_YEARS[number])) { setError('2020~2026으로 시작하는 학번 또는 입학연도 4자리를 입력해 주세요.'); return; }
    setError(''); setAcademic(defaultAcademic(year));
  }
  function start(event: FormEvent) {
    event.preventDefault();
    if (!academic) return;
    const match = getCurriculumYear(academic);
    if (!match.year) { setError(match.unknownReasons.join(' ')); return; }
    if (academic.primaryDepartmentId !== 'computer' && academic.secondaryDepartmentId !== 'computer') { setError('컴퓨터공학과가 포함된 전공 조합을 선택해 주세요.'); return; }
    if (academic.secondaryDepartmentId !== null && (!academic.secondaryDepartmentId || !academic.primaryDepartmentId || !getSecondaryCurriculumYear(academic).year)) { setError('복수전공 학과와 선발연도를 모두 선택해 주세요.'); return; }
    onStart(academic);
  }
  return <main className="welcome">
    <div className="welcome-art">
      <a className="brand" href="#"><span className="brand-symbol"><Sprout size={25}/></span><span>학저무저무<small>나의 졸업 설계</small></span></a>
      <div className="welcome-message"><span className="eyebrow">YOUR NEXT CHAPTER</span><h1>목표는 선명하게,<br/>졸업은 가볍게.</h1><p>지나온 학기를 돌아보고,<br/>앞으로의 가능성을 계획해 보세요.</p></div>
      <div className="journey-art" aria-hidden="true"><span className="journey-line"/><div className="journey-node one"><span>지금의 나</span><i>3.24</i></div><div className="journey-node two"><span>다음 학기</span><i>↗</i></div><div className="journey-node three"><GraduationCap size={36}/><span>목표에 한 걸음</span></div></div>
      <div className="welcome-campus">KONKUK UNIVERSITY <span>GLOCAL CAMPUS</span></div>
    </div>
    <div className="welcome-form">
      <div className="welcome-form-inner">
        <Badge tone="green">컴퓨터공학과 · 2020–2026학번</Badge>
        <div className="welcome-title"><h2>{academic ? '나에게 맞는 교육과정' : '학번으로 시작해 볼까요?'}</h2><p>{academic ? '학적에 따라 적용 기준이 달라져요. 아래 정보를 확인해 주세요.' : '입학연도를 확인해 나에게 맞는 졸업 요건을 찾아드려요.'}</p></div>
        {restoreError && <Notice tone="warning">{restoreError}</Notice>}
        {!academic ? <form onSubmit={next} className="stack">
          <Field label="학번" hint="전체 학번은 저장하지 않습니다. 입학연도 4자리만 입력해도 됩니다." error={error}><input className="student-id-input" inputMode="numeric" autoComplete="off" autoFocus placeholder="예: 202312345" value={studentId} onChange={event => setStudentId(event.target.value)} maxLength={12}/></Field>
          <button type="submit" className="button primary large">교육과정 찾기<ArrowRight size={19}/></button>
          <div className="divider"><span>먼저 둘러보고 싶다면</span></div>
          <button type="button" className="button secondary large" onClick={onDemo}>가상 성적으로 시연해 보기<ArrowUpIcon/></button>
          <p className="privacy-note">학교 계정이나 비밀번호는 필요하지 않아요.<br/>입력한 성적은 이 브라우저에서만 계산합니다.</p>
        </form> : <form onSubmit={start} className="stack"><AcademicForm value={academic} onChange={setAcademic}/>{error && <Notice tone="error">{error}</Notice>}<div className="modal-actions"><button type="button" className="button secondary" onClick={() => { setAcademic(null); setError(''); }}><ArrowLeft size={17}/>이전</button><button type="submit" className="button primary">나의 졸업 계획 시작<ArrowRight size={17}/></button></div></form>}
      </div>
    </div>
  </main>;
}

function ArrowUpIcon() { return <span aria-hidden="true">↗</span>; }
