import { useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Undo2, Check } from 'lucide-react';
import type { Course, ScenarioResult } from '../domain/types';
import type { CategoryOption } from './CourseEditor';
import { Badge, Empty, Notice } from './ui';

type ValidResult = Extract<ScenarioResult, { valid: true }>;
export function CoursesView({ courses, categories, result, selectedIds, onToggle, onAdd, onEdit, onRemove, onClear }: {
  courses: Course[]; categories: CategoryOption[]; result: ValidResult | null; selectedIds: string[];
  onToggle: (id: string) => void; onAdd: () => void; onEdit: (course: Course) => void; onRemove: (course: Course) => void; onClear: () => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const names = new Map(categories.map(item => [item.id, item.label]));
  const eligibility = new Map(result?.deletion.eligibility.map(item => [item.courseId, item]) ?? []);
  const visible = useMemo(() => courses.filter(course => `${course.name} ${course.courseCode ?? ''} ${course.semester}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || filter === 'selected' && selectedIds.includes(course.id) || filter === 'eligible' && eligibility.get(course.id)?.status === 'eligible')), [courses, query, filter, selectedIds, result]);
  const deletion = result?.deletion;
  return <div className="stack">
    <div className="page-intro"><div><h1>이수 과목과 삭제 시뮬레이션</h1><p>지나온 기록은 그대로 두고, 다른 가능성을 비교해 보세요.</p></div><button className="button primary" onClick={onAdd}><Plus size={17}/>과목 추가</button></div>
    {deletion && <div className="deletion-strip">
      <div><span>선택한 과목</span><strong>{selectedIds.length}<small>개</small></strong></div>
      <div><span>선택 과목 학점 수</span><strong>{deletion.selectedCourseCredits}</strong></div>
      <div><span>이번 한도 사용량</span><strong>{deletion.selectedChargeCredits}</strong></div>
      <div><span>남은 삭제 한도</span><strong>{deletion.remainingCreditLimit ?? '확인 필요'}</strong></div>
      <div><span>추가 선택 최대 (한도 사용량 기준)</span><strong>{deletion.additionalMaxCredits ?? '확인 필요'}</strong></div>
      <button className="button secondary" onClick={onClear} disabled={selectedIds.length === 0}><Undo2 size={16}/>선택 되돌리기</button>
    </div>}
    {deletion && deletion.reasons.length > 0 && <Notice tone="warning">{deletion.reasons.join(' ')}</Notice>}
    {deletion?.candidateState === 'no-candidates' && <Notice>현재 확인된 삭제 대상 과목이 없습니다.</Notice>}
    {deletion?.candidateState === 'no-combination' && <Notice>삭제 후보는 있지만 현재 남은 한도로 추가 선택할 수 있는 조합이 없습니다.</Notice>}
    {deletion?.candidateState === 'unverified' && <Notice tone="warning">삭제 한도나 자격이 확인되지 않았습니다. 적용 규칙에서 등록 학기·기준 취득학점 수를 입력해 주세요.</Notice>}
    {deletion?.additionalMaxCredits === 0 && (deletion.additionalSelectableCourseCount ?? 0) > 0 && <Notice>F·N 등 한도를 사용하지 않는 과목 {deletion.additionalSelectableCourseCount}개는 추가 선택할 수 있습니다.</Notice>}
    <div className="panel course-panel">
      <div className="table-toolbar"><div className="search-input"><Search size={17}/><input aria-label="과목 검색" placeholder="과목명, 코드, 학기로 검색" value={query} onChange={event => setQuery(event.target.value)}/></div><div className="table-filters"><select aria-label="과목 필터" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">전체 과목 ({courses.length})</option><option value="eligible">삭제 가능 과목</option><option value="selected">선택한 과목</option></select></div></div>
      {courses.length === 0 ? <Empty title="나의 첫 기록을 채워 주세요" description="확정된 성적을 입력하면 현재 평균평점과 졸업까지의 거리를 계산해 드려요." action={<button className="button primary" onClick={onAdd}><Plus size={16}/>이수 과목 추가</button>}/> : <div className="table-scroll"><table className="course-table"><thead><tr><th>삭제 선택</th><th>과목명</th><th>이수 학기</th><th>과목 구분</th><th>과목 학점 수</th><th>등급</th><th>삭제 자격</th><th><span className="sr-only">입력 관리</span></th></tr></thead><tbody>{visible.map(course => {
        const item = eligibility.get(course.id);
        const selected = selectedIds.includes(course.id);
        const status = item?.status ?? 'unknown';
        return <tr key={course.id} className={selected ? 'selected-row' : ''}>
          <td><input type="checkbox" aria-label={`${course.name} 삭제 대상으로 선택`} checked={selected} disabled={!selected && (!result || status !== 'eligible')} onChange={() => onToggle(course.id)}/></td>
          <td><strong>{course.name}</strong><small>{course.courseCode || '직접 입력'}{course.transferCredit && ' · 편입 인정'}</small></td>
          <td className="nowrap">{course.semester}</td><td><span className="category-label">{names.get(course.categoryId) ?? `미확인 구분: ${course.categoryId}`}</span></td>
          <td>{course.credits}</td><td><span className={`grade-pill ${['F', 'N', 'D', 'D+'].includes(course.grade) ? 'grade-low' : ''}`}>{course.grade}</span></td>
          <td><Badge tone={status === 'eligible' ? 'green' : status === 'ineligible' ? 'neutral' : 'amber'}>{selected ? <><Check size={12}/>선택됨</> : status === 'eligible' ? '가능' : status === 'ineligible' ? '불가' : '확인 필요'}</Badge>{item && item.reasons.length > 0 && <small className="eligibility-reason">{item.reasons.join(' ')}</small>}</td>
          <td><div className="row-actions"><button className="icon-button" onClick={() => onEdit(course)} aria-label={`${course.name} 입력 수정`}><Pencil size={15}/></button><button className="icon-button danger-hover" onClick={() => onRemove(course)} aria-label={`${course.name} 입력 과목 제거`}><Trash2 size={15}/></button></div></td>
        </tr>;
      })}</tbody></table>{visible.length === 0 && <p className="empty-search">검색 조건에 맞는 과목이 없습니다.</p>}</div>}
      <div className="table-footer"><span>총 {courses.length}개 이수 기록 · 검색 결과 {visible.length}개</span><span>삭제 선택은 시뮬레이션에만 반영됩니다.</span></div>
    </div>
    <Notice>‘입력 과목 제거’는 잘못 입력한 기록을 지우는 기능입니다. ‘삭제 대상으로 선택’은 원본 기록을 유지한 채 학점포기 결과를 비교합니다. F·N 과목은 한도 사용량이 0입니다.</Notice>
  </div>;
}
