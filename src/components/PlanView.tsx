import { useState, type FormEvent } from 'react';
import { CalendarDays, Plus, Pencil, Trash2, LockKeyhole, LockKeyholeOpen } from 'lucide-react';
import type { Semester, PlannedCourse, GoalResult } from '../domain/types';
import type { CategoryOption } from './CourseEditor';
import { Badge, Empty, Field, Modal, Notice } from './ui';

export function PlanView({ semesters, categories, goal, remainingCredits, onAddSemester, onRemoveSemester, onUpdateSemester, onAddCourse, onEditCourse, onRemoveCourse }: {
  semesters: Semester[]; categories: CategoryOption[]; goal: GoalResult | null; remainingCredits: number | null;
  onAddSemester: (label: string) => void; onRemoveSemester: (semester: Semester) => void;
  onUpdateSemester: (semester: Semester) => void; onAddCourse: (id: string) => void;
  onEditCourse: (id: string, course: PlannedCourse) => void; onRemoveCourse: (id: string, course: PlannedCourse) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [editingTarget, setEditingTarget] = useState<Semester | null>(null);
  const [target, setTarget] = useState('');
  const [error, setError] = useState('');
  const names = new Map(categories.map(item => [item.id, item.label]));
  const plannedCourses = semesters.flatMap(semester => semester.courses);
  const plannedCredits = plannedCourses.reduce((sum, course) => sum + course.credits, 0);
  const gradedCreditsTotal = plannedCourses.filter(course => course.graded).reduce((sum, course) => sum + course.credits, 0);
  function fixTarget(event: FormEvent) {
    event.preventDefault();
    if (!/^\d+(\.\d{1,3})?$/.test(target) || Number(target) > 4.5 || Number(target) < 0) { setError('0~4.5 범위의 소수 셋째 자리 이내 값으로 입력해 주세요.'); return; }
    if (editingTarget) onUpdateSemester({ ...editingTarget, fixedTarget: Number(target) });
    setEditingTarget(null); setError('');
  }
  return <div className="stack">
    <div className="page-intro"><div><h1>앞으로의 학기 계획</h1><p>한 학기의 목표를 고정하면, 나머지 학기에 필요한 성적을 다시 계산해요.</p></div><button className="button primary" onClick={() => { setLabel(''); setAdding(true); }}><Plus size={17}/>학기 추가</button></div>
    <div className="plan-overview panel"><CalendarDays size={24}/><div><strong>{semesters.length}개 학기 · {remainingCredits === null ? `${plannedCredits}학점 / 필요 학점 확인 필요` : `${plannedCredits}/${remainingCredits}학점 계획`}</strong><p>계획 이수 학점 / 졸업까지 남은 필요 학점</p><p>평점 반영 {gradedCreditsTotal} · 평점 미반영 {plannedCredits - gradedCreditsTotal}</p></div>{goal && <Badge tone={goal.status === 'impossible' ? 'red' : 'green'}>{goal.status === 'impossible' ? '현재 계획으로 달성 불가' : '계획 조정 가능'}</Badge>}</div>
    <Notice>자동 계획은 신청 학기부터 휴학·계절학기 없이 정규학기당 최대 18학점으로 배분한 가상 과목입니다. 처음에는 모두 평점 반영 과목이며, 전공·교양·필수과목 요건에는 반영하지 않습니다. 과목별 수정에서 실제 과목 구분과 P/N 여부를 변경하세요. 실제 수강신청을 대신하지 않습니다.</Notice>
    {goal?.status === 'impossible' && <Notice tone="warning">{goal.reason} 고정한 목표 또는 수강계획을 조정해 주세요.</Notice>}
    {semesters.length === 0 && <div className="panel"><Empty title="다음 학기를 그려 보세요" description="학기를 추가하고 이수할 과목을 계획하면 목표에 필요한 평균평점이 나타납니다." action={<button className="button primary" onClick={() => setAdding(true)}><Plus size={16}/>첫 학기 추가</button>}/></div>}
    <div className="semester-grid">{semesters.map((semester, index) => {
      const result = goal?.semesters.find(item => item.id === semester.id);
      const gradedCredits = semester.courses.filter(course => course.graded).reduce((sum, course) => sum + course.credits, 0);
      return <section className="panel semester-card" key={semester.id}>
        <div className="panel-heading"><div className="semester-title"><span className="step-number">{String(index + 1).padStart(2, '0')}</span><div><h2>{semester.label}</h2><span className="muted small">계획 {semester.courses.reduce((sum, course) => sum + course.credits, 0)} · 평점 반영 {gradedCredits}</span></div></div><button className="icon-button danger-hover" aria-label={`${semester.label} 계획 제거`} onClick={() => onRemoveSemester(semester)}><Trash2 size={16}/></button></div>
        <div className={`semester-target ${semester.fixedTarget !== null ? 'is-fixed' : ''}`}><div><span>{semester.fixedTarget !== null ? '내가 고정한 평균평점' : '목표 달성에 필요한 평균평점'}</span><strong>{gradedCredits === 0 ? '평점 대상 없음' : result?.targetDisplay ?? '목표 입력 필요'}</strong></div>{(gradedCredits > 0 || semester.fixedTarget !== null) && <button className="button subtle" onClick={() => {
          if (semester.fixedTarget !== null) onUpdateSemester({ ...semester, fixedTarget: null });
          else { setEditingTarget(semester); setTarget(''); setError(''); }
        }}>{semester.fixedTarget !== null ? <LockKeyhole size={16}/> : <LockKeyholeOpen size={16}/>} {semester.fixedTarget !== null ? '고정 해제' : '목표 고정'}</button>}</div>
        {gradedCredits === 0 && semester.fixedTarget !== null && <Notice tone="warning">평점 산정 과목이 없으므로 고정 목표를 해제해 주세요. 고정 해제 후 이 학기는 평점에 반영되지 않습니다.</Notice>}
        <div className="planned-courses">{semester.courses.map(course => <div className="planned-course" key={course.id}><div><strong>{course.name}</strong><span>{names.get(course.categoryId) ?? course.categoryId} · {course.credits} · {course.graded ? '평점 반영' : 'P/F'}</span></div><div className="row-actions"><button className="icon-button" aria-label={`${semester.label} ${course.name} 계획 수정`} onClick={() => onEditCourse(semester.id, course)}><Pencil size={14}/></button><button className="icon-button danger-hover" aria-label={`${semester.label} ${course.name} 계획 제거`} onClick={() => onRemoveCourse(semester.id, course)}><Trash2 size={14}/></button></div></div>)}</div>
        <button className="add-course-button" onClick={() => onAddCourse(semester.id)}><Plus size={16}/>계획 과목 추가</button>
      </section>;
    })}</div>
    <Notice>미고정 학기는 동일한 필요 평균평점을 사용하고 전체 성적은 과목 학점 수로 가중합니다. 졸업 요건이 부족해져도 계획 학점 수를 자동으로 늘리지 않습니다. 실제 수강 가능량·과목 개설 여부는 확인이 필요합니다.</Notice>
    {adding && <Modal title="남은 학기 추가" onClose={() => setAdding(false)}><form className="stack" onSubmit={event => { event.preventDefault(); if (label.trim()) { onAddSemester(label.trim()); setAdding(false); } }}><Field label="학기 이름"><input required maxLength={40} value={label} onChange={event => setLabel(event.target.value)} placeholder="예: 2027학년도 1학기"/></Field><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setAdding(false)}>취소</button><button className="button primary" type="submit">학기 추가</button></div></form></Modal>}
    {editingTarget && <Modal title={`${editingTarget.label} 목표 고정`} onClose={() => setEditingTarget(null)}><form className="stack" onSubmit={fixTarget}><Field label="목표 평균평점" error={error}><input type="number" min="0" max="4.5" step="0.001" value={target} onChange={event => setTarget(event.target.value)} required placeholder="예: 3.5"/></Field><Notice>고정한 기여분을 제외하고 다른 학기에 필요한 평균평점을 다시 계산합니다.</Notice><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setEditingTarget(null)}>취소</button><button className="button primary">고정하기</button></div></form></Modal>}
  </div>;
}
