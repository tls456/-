import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, BookOpen, GraduationCap, Target, TrendingUp } from 'lucide-react';
import { remainingRequirements } from '../domain/dashboard';
import type { BuiltProfile } from '../domain/buildProfile';
import type { ScenarioResult, Semester } from '../domain/types';
import { Badge, Notice } from './ui';
import { GpaRange } from './GpaRange';

type Props = {
  result: Extract<ScenarioResult, { valid: true }>;
  profile: BuiltProfile;
  semesters: Semester[];
  targetGpa: number | null;
  onTargetChange: (value: number | null) => void;
  onNavigate: (page: 'courses' | 'plan' | 'rules') => void;
};

export function Dashboard({ result, profile, semesters, targetGpa, onTargetChange, onNavigate }: Props) {
  const [targetDraft, setTargetDraft] = useState(targetGpa === null ? '' : String(targetGpa));
  const [targetError, setTargetError] = useState('');
  const [planned, setPlanned] = useState(false);
  useEffect(() => { setTargetDraft(targetGpa === null ? '' : String(targetGpa)); setTargetError(''); }, [targetGpa]);
  const { before, after, deletion } = result;
  const goal = after.goal;
  const graduation = planned ? after.plannedGraduation : after.currentGraduation;
  const remaining = remainingRequirements({ ...after, currentGraduation: graduation }, profile, planned ? semesters.flatMap(semester => semester.courses) : []);
  function applyTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!targetDraft.trim()) { onTargetChange(null); setTargetError(''); return; }
    const target = Number(targetDraft);
    if (!/^\d+(\.\d{1,3})?$/.test(targetDraft) || target < 0 || target > 4.5) { setTargetError('0~4.5 사이, 소수 셋째 자리까지 입력해 주세요.'); return; }
    setTargetError(''); onTargetChange(target);
  }
  return <div className="stack dashboard dashboard-simple">
    {!deletion.applied && <Notice tone="error">선택한 학점포기는 적용되지 않았습니다. {deletion.reasons.join(' ')}</Notice>}
    {deletion.assumed && <Notice tone="warning">삭제 자격 확인 전 가정에 따른 결과입니다.</Notice>}
    <div className="next-action-grid">
      <section className="panel action-metric"><span><GraduationCap size={17}/>졸업까지 남은 총학점</span><strong>{after.currentGraduation.total?.missing ?? '확인 필요'}<small>{after.currentGraduation.total ? '학점' : ''}</small></strong><p>현재 {after.totals.C} / 졸업 기준 {after.currentGraduation.total?.required ?? '미확인'}학점</p></section>
      <section className="panel action-metric"><span><TrendingUp size={17}/>현재 평균평점</span><strong>{after.totals.gpa === null ? '—' : after.totals.gpaDisplay}<small>/ 4.50</small></strong></section>
      <section className="panel action-metric"><span><Target size={17}/>앞으로 받아야 할 평균평점</span><strong>{goal.requiredAverage === null ? '—' : goal.requiredAverageDisplay}</strong>{goal.status === 'impossible' && <Badge tone="red">현재 계획으로 목표 달성 불가</Badge>}</section>
      <section className="panel action-metric target-metric" aria-labelledby="goal-heading">
        <span id="goal-heading"><Target size={17}/>평점 목표</span>
      <form className="simple-goal-form" onSubmit={applyTarget} noValidate><label htmlFor="dashboard-target">목표 최종 평균평점</label><input id="dashboard-target" inputMode="decimal" value={targetDraft} onChange={event => setTargetDraft(event.target.value)} placeholder="3.50"/><button className="button primary" disabled={targetDraft === (targetGpa === null ? '' : String(targetGpa))}>적용</button>{targetError && <span role="alert" className="error-text">{targetError}</span>}</form>
        <button type="button" className="button ghost small" onClick={() => onNavigate('plan')}>수강계획 입력<ArrowRight size={16}/></button>
      </section>
    </div>
    <div className="dashboard-summary-grid">
    <section className="panel stack" aria-labelledby="remaining-heading">
      <div className="panel-heading"><div><h2 id="remaining-heading">어떤 구분을 몇 학점 더 들어야 하나요?</h2><p>부족한 구분만 표시합니다. 총학점과 영역 요건은 동시에 충족해야 합니다.</p></div><button className="button secondary small" onClick={() => onNavigate('rules')}><BookOpen size={15}/>기준 확인</button></div>
      <nav className="section-tabs" aria-label="남은 학점 계산 기준"><button aria-pressed={!planned} className={!planned ? 'active' : ''} onClick={() => setPlanned(false)}>현재 성적 기준</button><button aria-pressed={planned} className={planned ? 'active' : ''} onClick={() => setPlanned(true)}>계획까지 이수하면</button></nav>
      {planned && <Notice>계획 과목을 모두 이수·인정받는다는 가정입니다. 계획 후 남은 총학점: {graduation.total?.missing ?? '확인 필요'}학점.</Notice>}
      {remaining.areas.length > 0 ? <div className="remaining-list">{remaining.areas.map(area => <div className="remaining-item" key={area.id}><span>{area.label}</span><strong>{area.missing}학점 더 필요</strong><small>{area.earned} / {area.required}학점 이수</small></div>)}</div> : <p>확인된 영역별 최소학점은 충족했습니다. 총학점·필수과목·영역 수는 별도로 확인하세요.</p>}
      {graduation.missingRequiredCourses.length > 0 && <div className="stack compact"><h3>학점 외에 반드시 들어야 할 과목</h3>{graduation.missingRequiredCourses.map(course => <div className="status-row" key={course.id}><span>{course.label}</span><Badge tone="amber">{course.missingCount}과목 부족</Badge></div>)}</div>}
      {(graduation.unknownReasons.length > 0 || graduation.nonCreditRequirements.length > 0) && <Notice tone="warning">학점만으로 졸업을 확정할 수 없습니다. 필수과목 인정·졸업작품 등 별도 조건을 확인하세요.</Notice>}
      {graduation.unknownReasons.map((reason, i) => <Notice key={`unknown-${i}`} tone="warning">{reason}</Notice>)}
      <details><summary>학교 확인이 필요한 조건 보기</summary><div className="stack compact">{graduation.nonCreditRequirements.map((reason, i) => <p key={i} className="small muted">{reason}</p>)}</div></details>
    </section>
      <div className="stack dashboard-summary-right">
    <GpaRange goal={goal} currentGradedCredits={after.totals.W} targetGpa={targetGpa} showExplanation={false}/>
    <section className="panel stack" aria-labelledby="deletion-comparison-heading">
      <div className="panel-heading"><h2 id="deletion-comparison-heading">삭제 전후 비교</h2><button className="button secondary small" onClick={() => onNavigate('courses')}>삭제 과목 선택</button></div>
      <div className="table-scroll"><table className="comparison-table"><caption className="sr-only">선택한 학점포기 전후의 현재 평점과 남은 졸업학점</caption><thead><tr><th scope="col">항목</th><th scope="col">삭제 전</th><th scope="col">삭제 반영 후</th></tr></thead><tbody>
        <tr><th scope="row">현재 평균평점</th><td>{before.totals.gpaDisplay}</td><td><strong>{after.totals.gpaDisplay}</strong></td></tr>
        <tr><th scope="row">졸업까지 남은 이수 학점</th><td>{before.currentGraduation.total ? `${before.currentGraduation.total.missing}학점` : '확인 필요'}</td><td><strong>{after.currentGraduation.total ? `${after.currentGraduation.total.missing}학점` : '확인 필요'}</strong></td></tr>
      </tbody></table></div>
    </section>
      </div>
    </div>
    <details className="panel stack"><summary>학기별 평점 · 상세 계산</summary><div className="stack">
      <h3>학기별 필요한 평점</h3>{goal.semesters.map(semester => <p key={semester.id}>{semester.label} · 평점 과목 {semester.gradedCredits}학점 · {semester.targetDisplay}{semester.fixed ? ' (고정)' : ''}</p>)}
      {result.warnings.map((warning, i) => <p className="small muted" key={i}>{warning}</p>)}
    </div></details>
  </div>;
}
