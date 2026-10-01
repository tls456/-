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
      <section className="panel action-metric"><span><GraduationCap size={17}/>졸업까지 남은 총학점</span><strong>{after.currentGraduation.total?.missing ?? '확인 필요'}<small>{after.currentGraduation.total ? '학점' : ''}</small></strong><p>현재 {after.totals.C} / 졸업 기준 {after.currentGraduation.total?.required ?? '미확인'}학점</p><p>학점포기 선택이 적용된 현재 성적 기준</p></section>
      <section className="panel action-metric"><span><TrendingUp size={17}/>현재 평균평점</span><strong>{after.totals.gpa === null ? '—' : after.totals.gpaDisplay}<small>/ 4.50</small></strong><p>평점 산정 학점 {after.totals.W}학점 · P/편입 인정 제외</p></section>
      <section className="panel action-metric"><span><Target size={17}/>앞으로 받아야 할 평균평점</span><strong>{goal.requiredAverage === null ? '—' : goal.requiredAverageDisplay}</strong><p>{goal.freeGradedCredits ? `미고정 계획 ${goal.freeGradedCredits}학점 기준` : '평점 과목을 학기 계획에 추가해 주세요'}</p>{goal.status === 'impossible' && <Badge tone="red">현재 계획으로 목표 달성 불가</Badge>}</section>
    </div>
    <section className="panel stack" aria-labelledby="goal-heading">
      <div className="panel-heading"><h2 id="goal-heading">평점 목표</h2><button className="button secondary" onClick={() => onNavigate('plan')}>수강계획 입력<ArrowRight size={16}/></button></div>
      <form className="simple-goal-form" onSubmit={applyTarget} noValidate><label htmlFor="dashboard-target">목표 최종 평균평점</label><input id="dashboard-target" inputMode="decimal" value={targetDraft} onChange={event => setTargetDraft(event.target.value)} placeholder="3.50"/><button className="button primary" disabled={targetDraft === (targetGpa === null ? '' : String(targetGpa))}>적용</button>{targetError && <span role="alert" className="error-text">{targetError}</span>}</form>
      <p className="small muted">{goal.reason} 처음에는 졸업까지 남은 학점을 모두 평점 과목으로 가정해 계산합니다. 학기별 계획에서 P/N 여부·학점·과목 구분을 수정하면 수정한 평점 과목 계획을 기준으로 다시 계산합니다.</p>
      <p className="small muted">필요 평균평점 = (목표 평점 × 최종 평점 산정 학점 − 현재 누적 평점 합계) ÷ 앞으로 이수할 평점 학점. 기존 P/N·편입 인정학점은 현재 평점 산정 학점에서 제외합니다.</p>
    </section>
    <GpaRange goal={goal} currentGradedCredits={after.totals.W} targetGpa={targetGpa}/>
    <section className="panel stack" aria-labelledby="deletion-comparison-heading">
      <div className="panel-heading"><h2 id="deletion-comparison-heading">삭제 전후 비교</h2><button className="button secondary small" onClick={() => onNavigate('courses')}>삭제 과목 선택</button></div>
      <div className="table-scroll"><table className="comparison-table"><caption className="sr-only">선택한 학점포기 전후의 현재 평점과 남은 졸업학점</caption><thead><tr><th scope="col">항목</th><th scope="col">삭제 전</th><th scope="col">삭제 반영 후</th></tr></thead><tbody>
        <tr><th scope="row">현재 평균평점</th><td>{before.totals.gpaDisplay}</td><td><strong>{after.totals.gpaDisplay}</strong></td></tr>
        <tr><th scope="row">졸업까지 남은 이수 학점</th><td>{before.currentGraduation.total ? `${before.currentGraduation.total.missing}학점` : '확인 필요'}</td><td><strong>{after.currentGraduation.total ? `${after.currentGraduation.total.missing}학점` : '확인 필요'}</strong></td></tr>
      </tbody></table></div>
    </section>
    <section className="panel stack" aria-labelledby="remaining-heading">
      <div className="panel-heading"><div><h2 id="remaining-heading">어떤 구분을 몇 학점 더 들어야 하나요?</h2><p>부족한 구분만 표시합니다. 총학점과 영역 요건은 동시에 충족해야 합니다.</p></div><button className="button secondary small" onClick={() => onNavigate('rules')}><BookOpen size={15}/>기준 확인</button></div>
      <nav className="section-tabs" aria-label="남은 학점 계산 기준"><button aria-pressed={!planned} className={!planned ? 'active' : ''} onClick={() => setPlanned(false)}>현재 성적 기준</button><button aria-pressed={planned} className={planned ? 'active' : ''} onClick={() => setPlanned(true)}>계획까지 이수하면</button></nav>
      {planned && <Notice>계획 과목을 모두 이수·인정받는다는 가정입니다. 계획 후 남은 총학점: {graduation.total?.missing ?? '확인 필요'}학점.</Notice>}
      {remaining.areas.length > 0 ? <div className="remaining-list">{remaining.areas.map(area => <div className="remaining-item" key={area.id}><span>{area.label}</span><strong>{area.missing}학점 더 필요</strong><small>{area.earned} / {area.required}학점 이수</small></div>)}</div> : <p>확인된 영역별 최소학점은 충족했습니다. 총학점·필수과목·영역 수는 별도로 확인하세요.</p>}
      {remaining.aggregates.map(area => <p className="small muted" key={area.id}>{area.label}: 합계 기준으로 {area.missing}학점 더 필요 ({area.earned}/{area.required}). 위 구분의 학점과 중복되는 합계이며 별도 추가 학점이 아닙니다.</p>)}
      {remaining.diversity.map(group => <Notice key={group.id} tone="warning"><strong>{group.label}: 서로 다른 {group.missingCount}개 영역 더 필요</strong><p>아직 채우지 않은 영역 중 선택하세요: {group.choices.map(choice => `${choice.label} (${choice.missing}학점 이상)`).join(', ')}. 나열된 모든 영역이 필수인 것은 아닙니다.</p></Notice>)}
      <p className="small muted">영역별 부족학점은 서로 겹칠 수 있으므로 단순 합산하지 않습니다. 심화교양은 학점 합계와 서로 다른 영역 수를 함께 충족해야 합니다.</p>
      {graduation.missingRequiredCourses.length > 0 && <div className="stack compact"><h3>학점 외에 반드시 들어야 할 과목</h3>{graduation.missingRequiredCourses.map(course => <div className="status-row" key={course.id}><span>{course.label}</span><Badge tone="amber">{course.missingCount}과목 부족</Badge></div>)}</div>}
      {(graduation.unknownReasons.length > 0 || graduation.nonCreditRequirements.length > 0) && <Notice tone="warning">학점만으로 졸업을 확정할 수 없습니다. 필수과목 인정·졸업작품 등 별도 조건을 확인하세요.</Notice>}
      {graduation.unknownReasons.map((reason, i) => <Notice key={`unknown-${i}`} tone="warning">{reason}</Notice>)}
      <details><summary>학교 확인이 필요한 조건 보기</summary><div className="stack compact">{graduation.nonCreditRequirements.map((reason, i) => <p key={i} className="small muted">{reason}</p>)}</div></details>
    </section>
    <details className="panel stack"><summary>학기별 평점 · 상세 계산</summary><div className="stack">
      <h3>학기별 필요한 평점</h3>{goal.semesters.map(semester => <p key={semester.id}>{semester.label} · 평점 과목 {semester.gradedCredits}학점 · {semester.targetDisplay}{semester.fixed ? ' (고정)' : ''}</p>)}
      {result.warnings.map((warning, i) => <p className="small muted" key={i}>{warning}</p>)}
    </div></details>
  </div>;
}
