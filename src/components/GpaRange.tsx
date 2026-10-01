import { TrendingUp } from 'lucide-react';
import { formatGpa } from '../domain/engine';
import type { GoalResult } from '../domain/types';
import { Notice } from './ui';

export function GpaRange({ goal, currentGradedCredits, targetGpa, showExplanation = true }: {
  goal: GoalResult; currentGradedCredits: number; targetGpa: number | null; showExplanation?: boolean;
}) {
  const available = goal.minGpa !== null && goal.maxGpa !== null;
  const position = (gpa: number) => Math.max(0, Math.min(100, gpa / 4.5 * 100));
  const minimum = position(goal.minGpa ?? 0);
  const maximum = position(goal.maxGpa ?? 0);
  return <section className="panel range-card" aria-labelledby="range-heading">
    <div className="panel-heading"><h2 id="range-heading">이 계획의 평균평점 범위</h2><TrendingUp size={22}/></div>
    {available ? <>
      <div className="range-values"><strong>{formatGpa(goal.minGpa)}<span>최저 예상</span></strong><span className="muted">—</span><strong>{formatGpa(goal.maxGpa)}<span>최고 예상</span></strong></div>
      <div className="range-track" role="img" aria-label={`예상 누적 평균평점 범위 ${formatGpa(goal.minGpa)}부터 ${formatGpa(goal.maxGpa)}` + (targetGpa === null ? '' : `, 목표 ${targetGpa}`)}>
        <span className="range-band" style={{ left: `${minimum}%`, width: `${maximum - minimum}%` }}/>
        {targetGpa !== null && <span className="range-target" style={{ left: `${position(targetGpa)}%` }}><span style={{ transform: targetGpa === 0 ? 'translateX(0)' : targetGpa === 4.5 ? 'translateX(-100%)' : undefined }}>목표 {targetGpa.toFixed(2)}</span></span>}
      </div>
      <div className="range-labels small muted"><span>0.00</span><span>4.50</span></div>
      {showExplanation && <>
      <p className="small muted">현재 평점 산정 {currentGradedCredits}학점 + 앞으로 평점 반영 {goal.futureGradedCredits}학점 기준입니다. P/N·편입 인정 등 평점 미반영 학점은 제외합니다.</p>
      <p className="small muted">고정한 학기 목표는 유지하고, 나머지 평점 과목을 모두 F로 받는 경우부터 모두 A+로 받는 경우까지의 이론적 범위입니다.</p>
      <Notice>졸업을 보장하는 범위는 아닙니다. F를 받으면 해당 과목의 취득학점은 인정되지 않아 졸업까지 남은 학점이 늘어날 수 있습니다.</Notice>
      </>}
    </> : <p className="small muted">현재 성적이나 앞으로 이수할 평점 과목이 없어 예상 범위를 계산할 수 없습니다.</p>}
  </section>;
}
