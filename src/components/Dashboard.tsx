import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, BookOpen, Check, CircleHelp, Flag, GraduationCap, Layers3, SlidersHorizontal, Sparkles, Target, TrendingUp } from 'lucide-react';
import { formatGpa } from '../domain/engine';
import type { GoalStatus, GraduationResult, ScenarioResult } from '../domain/types';
import { Badge, Empty, Notice, Progress } from './ui';

type ValidResult = Extract<ScenarioResult, { valid: true }>;
type Props = {
  result: ValidResult;
  targetGpa: number | null;
  onTargetChange: (value: number | null) => void;
  onNavigate: (page: 'courses' | 'plan' | 'rules') => void;
};
type Stage = 'before' | 'after' | 'planned';

const goalLabels: Record<GoalStatus, { label: string; tone: 'green' | 'amber' | 'red' | 'neutral' }> = {
  'no-target': { label: '목표를 설정해 주세요', tone: 'neutral' },
  'no-gpa': { label: '평점 산정 대상 없음', tone: 'neutral' },
  impossible: { label: '현재 계획으로 달성 불가', tone: 'red' },
  'already-secured': { label: '계획 가정상 성적 목표 충족', tone: 'green' },
  possible: { label: '성적 목표 달성 가능', tone: 'green' },
  met: { label: '예상 평균평점이 목표 이상', tone: 'green' },
  'not-met': { label: '예상 평균평점이 목표 미만', tone: 'amber' },
};

function GraduationBadge({ graduation }: { graduation: GraduationResult }) {
  if (graduation.status === 'unverified') return <Badge tone="amber">별도 확인 필요</Badge>;
  if (graduation.status === 'insufficient') return <Badge tone="amber">학점·과목 요건 부족</Badge>;
  return <Badge tone="green">{graduation.conditional ? '모두 이수 시 학점·과목 요건 충족' : '학점·과목 요건 충족'}</Badge>;
}

function GraduationDetails({ graduation }: { graduation: GraduationResult }) {
  const creditRows = [...(graduation.total ? [graduation.total] : []), ...graduation.areas];
  return <div className="stack">
    {graduation.conditional && <p className="small muted">계획한 과목을 모두 이수하여 해당 영역의 학점으로 인정받을 때의 조건부 결과입니다.</p>}
    {creditRows.length > 0 && <div className="stack">
      {creditRows.map((row, index) => <div className="requirement-row" key={`${row.id}-${index}`}>
        <div className="status-row"><span>{row.label}</span><strong>{row.earned}<span className="muted"> / {row.required}</span></strong></div>
        <Progress value={row.earned} max={row.required} tone={row.missing > 0 ? 'amber' : 'green'}/>
        <div className="status-row small"><span className="muted">이수 학점 수</span><span>{row.missing > 0 ? `${row.missing}학점 더 필요` : '입력된 학점 기준 충족'}</span></div>
      </div>)}
    </div>}
    {!graduation.total && <Notice tone="warning">총 졸업 이수 학점 수가 확인되지 않아 총학점 충족 여부를 판정할 수 없습니다.</Notice>}
    {graduation.categoryDiversity.length > 0 && <div className="detail-list">
      <h3 className="detail-heading">교양 이수 영역</h3>
      {graduation.categoryDiversity.map((group, index) => <div className="requirement-row" key={`${group.id}-${index}`}>
        <div className="status-row"><span>{group.label}</span><Badge tone={group.missingCount ? 'amber' : 'green'}>{group.completedCount} / {group.requiredCount}영역</Badge></div>
        {group.missingCount > 0 && <p className="small muted">서로 다른 {group.missingCount}개 영역을 더 이수해야 합니다.</p>}
      </div>)}
    </div>}
    <div className="detail-list">
      <h3 className="detail-heading">필수 과목·선택 필수 그룹</h3>
      {graduation.missingRequiredCourses.length === 0
        ? <p className="small muted">확인된 기준에서 미이수 필수 과목이 발견되지 않았습니다.</p>
        : graduation.missingRequiredCourses.map((course, index) => <div className="requirement-row" key={`${course.id}-${index}`}>
          <div className="status-row"><strong>{course.label}</strong><Badge tone="amber">{course.missingCount}과목 부족</Badge></div>
          <p className="small muted">{course.minimumCount && course.minimumCount > 1 ? `${course.minimumCount}개 선택 필수 중 ${course.completedCount}개 이수 · ` : ''}인정 코드: {course.alternatives.join(' / ')}</p>
        </div>)}
    </div>
    {(graduation.unknownReasons.length > 0 || graduation.nonCreditRequirements.length > 0) && <div className="detail-list">
      <h3 className="detail-heading"><CircleHelp size={16}/> 반드시 별도 확인할 조건</h3>
      {graduation.unknownReasons.map((reason, index) => <Notice key={`unknown-${index}`} tone="warning">{reason}</Notice>)}
      {graduation.nonCreditRequirements.map((requirement, index) => <div className="requirement-row" key={`non-credit-${index}`}><div className="status-row"><span>{requirement}</span><Badge tone="amber">미판정</Badge></div></div>)}
      <p className="small muted">위 조건은 이수 학점 수만으로 판정할 수 없습니다. 학교의 최종 졸업 판정을 대신하지 않습니다.</p>
    </div>}
  </div>;
}

export function Dashboard({ result, targetGpa, onTargetChange, onNavigate }: Props) {
  const [targetDraft, setTargetDraft] = useState(targetGpa === null ? '' : String(targetGpa));
  const [targetError, setTargetError] = useState('');
  const [stage, setStage] = useState<Stage>('planned');
  useEffect(() => { setTargetDraft(targetGpa === null ? '' : String(targetGpa)); setTargetError(''); }, [targetGpa]);
  const { before, after, deletion } = result;
  const goal = after.goal;
  const goalState = goalLabels[goal.status];
  const graduation = stage === 'before' ? before.currentGraduation : stage === 'after' ? after.currentGraduation : after.plannedGraduation;
  const currentDifference = before.totals.gpa !== null && after.totals.gpa !== null ? after.totals.gpa - before.totals.gpa : null;
  const rangeAvailable = goal.minGpa !== null && goal.maxGpa !== null;
  const rangeMin = Math.max(0, Math.min(100, (goal.minGpa ?? 0) / 4.5 * 100));
  const rangeMax = Math.max(0, Math.min(100, (goal.maxGpa ?? 0) / 4.5 * 100));
  const anySelection = deletion.selectedCourseIds.length > 0;
  const targetDirty = targetDraft !== (targetGpa === null ? '' : String(targetGpa));

  function applyTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (targetDraft.trim() === '') { onTargetChange(null); setTargetError(''); return; }
    const target = Number(targetDraft);
    if (!/^\d+(\.\d{1,3})?$/.test(targetDraft) || !Number.isFinite(target) || target < 0 || target > 4.5) {
      setTargetError('목표는 0~4.5 사이, 소수 셋째 자리까지 입력해 주세요.');
      return;
    }
    setTargetError('');
    onTargetChange(target);
  }

  return <div className="stack dashboard">
    <section className="panel goal-feature" aria-labelledby="goal-heading">
      <div className="goal-feature-top">
        <div><span className="eyebrow"><Sparkles size={14}/> MY NEXT CHAPTER</span><h2 id="goal-heading">다음 학기의 나를 설계해요</h2><p>목표와 수강계획 사이, 필요한 성적을 확인하세요.</p></div>
        <Badge tone={goalState.tone}>{goalState.label}</Badge>
      </div>
      <div className="goal-comparison">
        <form className="goal-editor" onSubmit={applyTarget} noValidate>
          <label htmlFor="dashboard-target">목표 최종 평균평점</label>
          <div className="status-row"><input id="dashboard-target" type="text" inputMode="decimal" value={targetDraft} onChange={event => setTargetDraft(event.target.value)} placeholder="3.50" aria-invalid={Boolean(targetError)} aria-describedby={targetError ? 'target-error' : 'target-hint'}/><span className="goal-out-of">/ 4.50</span><button type="submit" className="button secondary" disabled={!targetDirty && !targetError}>적용</button></div>
          {targetError ? <span className="small error-text" id="target-error" role="alert">{targetError}</span> : <span className="small" id="target-hint">0~4.5 · 빈 값 적용 시 목표 해제</span>}
        </form>
        <ArrowRight className="goal-arrow" size={24} aria-hidden="true"/>
        <div className="goal-value"><span>앞으로 필요한 평균평점</span><strong>{goal.requiredAverage === null ? '—' : goal.requiredAverageDisplay}</strong><span className="small">{goal.requiredAverage === null ? goal.freeGradedCredits === 0 ? '미고정 평점 과목 없음' : '목표를 입력해 주세요' : `${goal.freeGradedCredits}학점의 미고정 계획 기준`}</span></div>
      </div>
      <div className="goal-explanation"><Target size={16}/><p>{goal.reason}</p></div>
      <div className="status-row"><span className="small">{goal.futureCredits}학점 계획 중 평점 산정 {goal.futureGradedCredits}학점</span><button type="button" className="button ghost" onClick={() => onNavigate('plan')}>학기 계획 조정<ArrowUpRight size={16}/></button></div>
    </section>

    {!deletion.applied && <Notice tone="error"><strong>선택한 삭제는 적용되지 않았습니다.</strong><ul>{deletion.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul><span>아래 삭제 후 결과는 원본 기록을 유지한 값입니다.</span></Notice>}
    {deletion.assumed && <Notice tone="warning"><strong>자격 확인 전 가정</strong> · 확인되지 않은 삭제 자격을 허용한 비교입니다. 실제 삭제 가능 여부를 확인해 주세요.</Notice>}

    <div className="metric-grid">
      <section className="metric-card"><span className="metric-label"><GraduationCap size={17}/> 이수 학점 수</span><strong className="metric-value">{after.totals.C}<small>학점</small></strong><span className="metric-caption">삭제 전 {before.totals.C}학점{anySelection && deletion.applied ? ` · ${before.totals.C - after.totals.C}학점 감소` : ''}</span></section>
      <section className="metric-card"><span className="metric-label"><Layers3 size={17}/> 평점 산정 학점 수</span><strong className="metric-value">{after.totals.W}<small>학점</small></strong><span className="metric-caption">P/N·편입 인정학점은 평점 제외</span></section>
      <section className="metric-card"><span className="metric-label"><TrendingUp size={17}/> 현재 평균평점</span><strong className="metric-value">{after.totals.gpa === null ? '—' : after.totals.gpaDisplay}<small>{after.totals.gpa !== null ? '/ 4.50' : '산정 대상 없음'}</small></strong><span className="metric-caption">{currentDifference !== null && currentDifference !== 0 ? <>{currentDifference > 0 ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}{Math.abs(currentDifference).toFixed(2)} {currentDifference > 0 ? '상승' : '하락'} · </> : null}삭제 전 {before.totals.gpa === null ? '산정 대상 없음' : before.totals.gpaDisplay}</span></section>
      <section className="metric-card"><span className="metric-label"><Flag size={17}/> 계획 반영 총 이수</span><strong className="metric-value">{after.totals.C + goal.futureCredits}<small>학점</small></strong><span className="metric-caption">계획 과목을 모두 이수할 때</span></section>
    </div>

    <div className="dashboard-grid">
      <section className="panel" aria-labelledby="comparison-heading">
        <div className="panel-heading"><div><span className="eyebrow">BEFORE & AFTER</span><h2 id="comparison-heading">삭제하면 무엇이 달라질까요?</h2></div><button type="button" className="button secondary small" onClick={() => onNavigate('courses')}><SlidersHorizontal size={15}/>과목 선택</button></div>
        <p className="small muted">동일한 수강계획으로 삭제 선택 전후를 비교합니다.</p>
        <div className="table-scroll"><table className="comparison-table"><caption className="sr-only">동일한 미래 수강계획을 적용한 삭제 전후 결과</caption><thead><tr><th scope="col">비교 항목</th><th scope="col">삭제 전</th><th scope="col">삭제 후</th></tr></thead><tbody>
          <tr><th scope="row">이수 학점 수</th><td>{before.totals.C}</td><td>{after.totals.C}</td></tr>
          <tr><th scope="row">평점 산정 학점 수</th><td>{before.totals.W}</td><td>{after.totals.W}</td></tr>
          <tr><th scope="row">현재 평균평점</th><td>{before.totals.gpaDisplay}</td><td>{after.totals.gpaDisplay}</td></tr>
          <tr><th scope="row">필요 평균평점</th><td>{before.goal.requiredAverage === null ? '해당 없음' : before.goal.requiredAverageDisplay}</td><td><strong>{goal.requiredAverage === null ? '해당 없음' : goal.requiredAverageDisplay}</strong></td></tr>
          <tr><th scope="row">예상 최종 평균평점</th><td>{before.goal.projectedGpa === null ? '산정되지 않음' : before.goal.projectedGpaDisplay}</td><td>{goal.projectedGpa === null ? '산정되지 않음' : goal.projectedGpaDisplay}</td></tr>
          <tr><th scope="row">계획 후 총학점 부족</th><td>{before.plannedGraduation.total ? `${before.plannedGraduation.total.missing}학점` : '확인 필요'}</td><td>{after.plannedGraduation.total ? `${after.plannedGraduation.total.missing}학점` : '확인 필요'}</td></tr>
        </tbody></table></div>
        <div className="detail-list">
          <div className="status-row"><span className="small muted">삭제 선택</span><strong>{deletion.selectedCourseIds.length}과목 · 과목 학점 수 {deletion.selectedCourseCredits}</strong></div>
          <div className="status-row"><span className="small muted">이번 한도 소진 학점 수</span><strong>{deletion.selectedChargeCredits}학점</strong></div>
          <div className="status-row"><span className="small muted">기준 한도에서 이미 소진한 양</span><span>{deletion.usedCredits}학점</span></div>
          <div className="status-row"><span className="small muted">선택 후 남은 삭제 한도</span><span>{deletion.remainingCreditLimit === null ? deletion.candidateState === 'unverified' ? '규칙 확인 필요' : '한도 없음' : `${deletion.remainingCreditLimit}학점${deletion.candidateState === 'unverified' ? ' · 참고값' : ''}`}</span></div>
          <div className="status-row"><span className="small muted">실제로 추가 선택 가능한 최대</span><strong>{deletion.additionalMaxCredits === null ? '확정할 수 없음' : `${deletion.additionalMaxCredits}학점`}</strong></div>
          {deletion.remainingCourseLimit !== null && <div className="status-row"><span className="small muted">남은 삭제 과목 수</span><span>{deletion.remainingCourseLimit}과목</span></div>}
          <p className="small muted">F/N 등 미이수 과목은 과목 학점 수가 있어도 삭제 한도 소진은 0일 수 있습니다.</p>
          {deletion.candidateState === 'no-candidates' && <p className="small muted">현재 추가로 선택할 수 있는 확정된 후보가 없습니다.</p>}
          {deletion.candidateState === 'no-combination' && <p className="small muted">후보 과목은 있지만 남은 한도와 제한을 만족하는 조합이 없습니다.</p>}
          {deletion.candidateState === 'unverified' && <Notice tone="warning">삭제 규칙 또는 자격이 확인되지 않아 확정 최대값을 표시하지 않습니다.</Notice>}
          {deletion.additionalMaxCredits === 0 && (deletion.additionalSelectableCourseCount ?? 0) > 0 && <Notice>학점 한도를 소진하지 않는 과목 {deletion.additionalSelectableCourseCount}개는 추가 선택할 수 있습니다.</Notice>}
        </div>
      </section>

      <div className="stack">
        <section className="panel range-card" aria-labelledby="range-heading">
          <div className="panel-heading"><div><span className="eyebrow">YOUR POSSIBILITIES</span><h2 id="range-heading">이 계획의 평균평점 범위</h2></div><TrendingUp size={22}/></div>
          {rangeAvailable ? <>
            <div className="range-values"><strong>{formatGpa(goal.minGpa)}<span>최저 예상</span></strong><span className="muted">—</span><strong>{formatGpa(goal.maxGpa)}<span>최고 예상</span></strong></div>
            <div className="range-track" role="img" aria-label={`예상 누적 평균평점 범위 ${formatGpa(goal.minGpa)}부터 ${formatGpa(goal.maxGpa)}` + (targetGpa === null ? '' : `, 목표 ${targetGpa}`)}>
              <span className="range-band" style={{ left: `${rangeMin}%`, width: `${Math.max(0.7, rangeMax - rangeMin)}%` }}/>
              {targetGpa !== null && <span className="range-target" style={{ left: `${targetGpa / 4.5 * 100}%` }}><span>목표 {targetGpa.toFixed(2)}</span></span>}
            </div>
            <div className="range-labels small muted"><span>0.00</span><span>4.50</span></div>
            <p className="small muted">고정한 학기 목표는 유지하고, 나머지 평점 과목에 최저·최고 등급을 적용했습니다.</p>
            <Notice>졸업 충족을 보장하는 범위가 아닙니다. 최저 성적에 F가 포함되면 해당 과목의 이수 학점 수는 인정되지 않을 수 있습니다.</Notice>
          </> : <Empty title="아직 계산할 성적이 없어요" description="현재 성적이나 미래 평점 과목을 입력하면 예상 범위가 나타납니다." action={<button type="button" className="button secondary" onClick={() => onNavigate('courses')}>이수 과목 입력<ArrowRight size={15}/></button>}/>}
        </section>
        <section className="panel" aria-labelledby="semester-overview-heading">
          <div className="panel-heading"><h2 id="semester-overview-heading">학기별 성적 가이드</h2><button className="button ghost small" type="button" onClick={() => onNavigate('plan')}>계획 보기<ArrowUpRight size={15}/></button></div>
          {goal.semesters.length === 0 ? <Empty title="남은 학기를 추가해 주세요" description="학기별 평점 과목과 P/N 과목을 구분해 계획할 수 있어요." action={<button type="button" className="button secondary" onClick={() => onNavigate('plan')}>학기 계획하기<ArrowRight size={15}/></button>}/> : <div className="stack">{goal.semesters.map(semester => <div className="requirement-row" key={semester.id}><div className="status-row"><div><strong>{semester.label}</strong><p className="small muted">전체 {semester.credits}학점 · 평점 산정 {semester.gradedCredits}학점</p></div><div><strong>{semester.target === null ? '—' : semester.targetDisplay}</strong>{semester.fixed && <Badge tone="neutral">고정</Badge>}</div></div>{semester.gradedCredits === 0 && <p className="small muted">평점 미반영 학기</p>}</div>)}</div>}
          <p className="small muted">필요 최소 평균은 소수 셋째 자리까지 올림합니다. 내부 계산에는 반올림하지 않은 값을 사용합니다.</p>
        </section>
      </div>
    </div>

    <section className="panel" aria-labelledby="graduation-heading">
      <div className="panel-heading"><div><span className="eyebrow">GRADUATION CHECKLIST</span><h2 id="graduation-heading">졸업 요건, 하나씩 확인해요</h2></div><button className="button secondary small" type="button" onClick={() => onNavigate('rules')}><BookOpen size={15}/>적용 기준·출처</button></div>
      <div className="graduation-summary">
        <div><span className="small muted">현재 이수 기준</span><GraduationBadge graduation={before.currentGraduation}/></div>
        <div><span className="small muted">삭제 선택 반영</span><GraduationBadge graduation={after.currentGraduation}/></div>
        <div><span className="small muted">미래 계획까지 반영</span><GraduationBadge graduation={after.plannedGraduation}/></div>
      </div>
      <nav className="section-tabs" aria-label="졸업 요건 비교 시점">
        {([{ id: 'before', label: '현재 이수' }, { id: 'after', label: '삭제 후' }, { id: 'planned', label: '계획 반영' }] as const).map(item => <button type="button" key={item.id} className={stage === item.id ? 'active' : ''} aria-pressed={stage === item.id} onClick={() => setStage(item.id)}>{item.label}{stage === item.id && <Check size={14}/>}</button>)}
      </nav>
      <div className="status-row section-heading"><h3>{stage === 'before' ? '현재 기록의 졸업 요건' : stage === 'after' ? '삭제를 반영한 졸업 요건' : '계획을 모두 이수했을 때'}</h3><GraduationBadge graduation={graduation}/></div>
      <GraduationDetails graduation={graduation}/>
    </section>

    <details className="panel calculation-notes"><summary>계산 가정과 표시 기준</summary><div className="stack">{result.warnings.map((warning, index) => <p className="small muted" key={index}>{warning}</p>)}<p className="small muted">평균평점은 소수 둘째 자리로 반올림합니다. 필요한 최소 평균평점은 셋째 자리로 올림하며, 실제 등급 조합에서 정확히 같은 평균이 만들어지는지는 보장하지 않습니다.</p></div></details>
  </div>;
}
