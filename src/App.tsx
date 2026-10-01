import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sprout, LayoutDashboard, BookOpen, CalendarDays, Settings2, ArrowUpRight, ChevronRight, Menu, X, HardDrive, Check, Play, RotateCcw, CircleHelp } from 'lucide-react';
import { GRADES } from './data/academic';
import { simulate } from './domain/simulator';
import type { Course, PlannedCourse, Semester } from './domain/types';
import { createDemo } from './demo';
import { emptyState, loadState, parseSavedState, RULE_VERSION, STORAGE_KEY, type AppState } from './state';
import { Onboarding, AcademicForm } from './components/AcademicForm';
import { CourseEditor } from './components/CourseEditor';
import { Dashboard } from './components/Dashboard';
import { CoursesView } from './components/CoursesView';
import { PlanView } from './components/PlanView';
import { RulesView } from './components/RulesView';
import { PersonalRequirements } from './components/PersonalRequirements';
import { TranscriptImport } from './components/TranscriptImport';
import { Badge, Modal, Notice } from './components/ui';

type Page = 'dashboard' | 'courses' | 'plan' | 'rules';
type Editor = { type: 'course'; course?: Course } | { type: 'planned'; semesterId: string; course?: PlannedCourse };
type Confirmation = { title: string; body: string; action: () => void; label: string };
const navItems = [
  { id: 'dashboard' as const, label: '나의 대시보드', icon: LayoutDashboard },
  { id: 'courses' as const, label: '이수 과목 · 삭제', icon: BookOpen },
  { id: 'plan' as const, label: '학기별 계획', icon: CalendarDays },
  { id: 'rules' as const, label: '적용 규칙 · 설정', icon: Settings2 },
];

export default function App() {
  const [restored] = useState(loadState);
  const [state, setState] = useState<AppState | null>(restored.state);
  const [page, setPage] = useState<Page>('dashboard');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [importingPdf, setImportingPdf] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [academicDraft, setAcademicDraft] = useState<AppState['academic'] | null>(null);
  const [toast, setToast] = useState('');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [planChanged, setPlanChanged] = useState(false);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const computed = useMemo(() => state ? simulate(state) : null, [state]);
  const update = useCallback((patch: Partial<AppState>) => {
    if (patch.semesters) setPlanChanged(true);
    setState(previous => previous ? { ...previous, ...patch, ruleVersion: RULE_VERSION } : previous);
  }, []);
  const closeEditor = useCallback(() => setEditor(null), []);
  const closeConfirmation = useCallback(() => setConfirmation(null), []);
  const closeAcademic = useCallback(() => setAcademicDraft(null), []);
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(''), 6000);
  }, []);
  useEffect(() => () => { if (toastTimeout.current) clearTimeout(toastTimeout.current); }, []);
  useEffect(() => {
    if (!state) return;
    try {
      if (state.saveEnabled) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); setSaved(true); }
      else { localStorage.removeItem(STORAGE_KEY); setSaved(false); }
      setSaveError('');
    } catch { setSaved(false); setSaveError('브라우저 저장 공간에 기록하지 못했습니다. 설정에서 JSON 백업을 내려받아 주세요.'); }
  }, [state]);
  function navigate(next: Page) { setPage(next); setSidebarOpen(false); window.scrollTo({ top: 0, behavior: 'instant' }); }
  function demo() {
    const apply = () => { setState(createDemo()); navigate('dashboard'); setConfirmation(null); notify('가상 성적 예시를 불러왔습니다. 실제 학생의 성적이 아닙니다.'); };
    if (state) setConfirmation({ title: '가상 성적으로 바꿀까요?', body: '현재 입력과 저장본이 시연용 가상 데이터로 바뀝니다. 필요한 기록은 먼저 JSON으로 백업해 주세요.', label: '예시 불러오기', action: apply });
    else apply();
  }
  function reset() {
    setConfirmation({ title: '저장한 계획을 초기화할까요?', body: '이 브라우저에 저장한 과목, 규칙 선택, 목표와 학기 계획을 모두 제거합니다. 내려받은 JSON 백업 파일은 유지됩니다.', label: '전체 초기화', action: () => {
      try { localStorage.removeItem(STORAGE_KEY); } catch { notify('브라우저 저장본을 지우지 못했습니다. 브라우저 사이트 데이터 설정을 확인해 주세요.'); return; }
      setState(null); setConfirmation(null); setPage('dashboard'); setSaved(false); setSidebarOpen(false);
    } });
  }
  function exportState() {
    if (!state) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `학저무저무-${new Date().toISOString().slice(0, 10)}.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); notify('계획 백업을 내려받았습니다. 성적 정보가 포함되어 있으니 개인 공간에 보관해 주세요.');
  }
  async function importState(file: File) {
    try {
      if (file.size > 5_000_000) throw new Error('5MB 이하의 백업 파일만 불러올 수 있습니다.');
      const imported = parseSavedState(await file.text());
      const test = simulate(imported);
      if (!test.result.valid) throw new Error(test.result.issues[0]?.message ?? '입력값을 검증하지 못했습니다.');
      setConfirmation({ title: '백업 파일을 불러올까요?', body: `현재 기록을 ${imported.academic.entryYear}학번의 이수 과목 ${imported.courses.length}개, 학기 계획 ${imported.semesters.length}개로 교체합니다.`, label: '백업 복원', action: () => {
        setState({ ...imported, ruleVersion: RULE_VERSION }); setConfirmation(null); navigate('dashboard'); notify('백업을 복원하고 현재 규칙 버전으로 재계산했습니다.');
      } });
    } catch (error) { notify(error instanceof Error ? error.message : '백업 파일을 읽지 못했습니다.'); }
  }
  function toggleDeletion(id: string) {
    if (!state) return;
    const nextIds = state.selectedCourseIds.includes(id) ? state.selectedCourseIds.filter(item => item !== id) : [...state.selectedCourseIds, id];
    const next = simulate({ ...state, selectedCourseIds: nextIds });
    if (!next.result.valid) { notify(next.result.issues[0]?.message ?? '입력값을 확인해 주세요.'); return; }
    if (!next.result.deletion.applied && !state.selectedCourseIds.includes(id)) { notify(next.result.deletion.reasons.join(' ')); return; }
    update({ selectedCourseIds: nextIds });
  }
  function saveCourse(course: Course | PlannedCourse) {
    if (!state || !editor) return;
    const replace = <T extends { id: string }>(items: T[], value: T) => items.some(item => item.id === value.id) ? items.map(item => item.id === value.id ? value : item) : [...items, value];
    if (editor.type === 'course') update({ courses: replace(state.courses, course as Course) });
    else update({ semesters: state.semesters.map(semester => semester.id === editor.semesterId ? { ...semester, courses: replace(semester.courses, course as PlannedCourse) } : semester) });
    setEditor(null); notify('입력을 반영하고 다시 계산했습니다.');
  }
  function removeCourse(course: Course) {
    if (!state) return;
    setConfirmation({ title: '입력 과목을 제거할까요?', body: `‘${course.name}’의 입력 기록을 제거합니다. 삭제 시뮬레이션을 하려면 표의 체크박스로 선택해 주세요.`, label: '입력 과목 제거', action: () => {
      update({ courses: state.courses.filter(item => item.id !== course.id), selectedCourseIds: state.selectedCourseIds.filter(id => id !== course.id) }); setConfirmation(null);
    } });
  }
  function removeSemester(semester: Semester) {
    if (!state) return;
    setConfirmation({ title: '학기 계획을 제거할까요?', body: `${semester.label}의 계획 과목 ${semester.courses.length}개와 고정 목표를 제거합니다.`, label: '학기 계획 제거', action: () => { update({ semesters: state.semesters.filter(item => item.id !== semester.id) }); setConfirmation(null); } });
  }
  if (!state || !computed) return <><Onboarding restoreError={restored.error} onDemo={demo} onStart={academic => { setState(emptyState(academic)); setPage('rules'); }}/>{toast && <div className="toast" role="status">{toast}<button onClick={() => setToast('')} aria-label="알림 닫기"><X size={16}/></button></div>}</>;
  const { result, profile, officialProfile, policy } = computed;
  const valid = result.valid ? result : null;
  const currentTitle = navItems.find(item => item.id === page)?.label;
  return <div className="app-shell">
    {sidebarOpen && <button className="sidebar-backdrop" aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)}/>}
    <aside className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}>
      <a className="brand" href="#" onClick={event => { event.preventDefault(); navigate('dashboard'); }}><span className="brand-symbol"><Sprout size={25}/></span><span>학저무저무<small>나의 졸업 설계</small></span></a>
      <div className="campus-label">KONKUK GLOCAL<span>컴퓨터공학과 졸업 플래너</span></div>
      <nav className="nav-items" aria-label="주 메뉴">{navItems.map(item => <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)} aria-current={page === item.id ? 'page' : undefined}><item.icon size={19}/><span>{item.label}</span>{page === item.id && <span className="nav-dot"/>}</button>)}</nav>
      <div className="sidebar-note"><Sprout size={22}/><strong>한 학기씩, 나의 속도로.</strong><p>작은 계획이 모여<br/>다음의 나를 만듭니다.</p></div>
      <div className="sidebar-bottom"><div className="local-status"><HardDrive size={16}/><span>{saved ? '이 브라우저에 저장됨' : state.saveEnabled ? '저장 상태 확인 필요' : '자동 저장 꺼짐'}<small>다른 기기와 동기화되지 않아요</small></span></div><button onClick={() => navigate('rules')} className="button subtle"><CircleHelp size={15}/>적용 기준과 출처 보기</button></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="메뉴 열기" onClick={() => setSidebarOpen(true)}><Menu size={21}/></button><span>나의 졸업 설계</span><ChevronRight size={14}/><strong>{currentTitle}</strong></div><div className="topbar-actions"><Badge tone="green">{state.academic.entryYear}학번</Badge><button className="avatar-button" title="학적 정보 수정" aria-label="학적 정보 수정" onClick={() => setAcademicDraft({ ...state.academic })}>KU</button></div></header>
      <main className="main-content">
        {state.demo && <div className="demo-banner"><span><Play size={15}/><strong>시연 모드</strong> 가상 성적과 수강계획입니다.</span><button onClick={reset}>내 기록으로 시작<ArrowUpRight size={14}/></button></div>}
        {saveError && <Notice tone="warning">{saveError}</Notice>}
        {planChanged && page === 'dashboard' && <Notice>수강계획이 변경되었습니다. 삭제 전후 모두 현재 수강계획을 기준으로 다시 비교한 결과입니다.</Notice>}
        {state.ruleVersion !== RULE_VERSION && <Notice>규칙 버전이 갱신되어 현재 입력으로 다시 계산했습니다. 적용 기준을 확인해 주세요.</Notice>}
        {!result.valid && <Notice tone="error"><strong>입력을 수정해야 계산할 수 있습니다.</strong><ul>{result.issues.map((issue, index) => <li key={`${issue.path}-${index}`}>{issue.message}</li>)}</ul></Notice>}
        {page === 'dashboard' && <><div className="page-intro"><div><span className="eyebrow">MY GRADUATION PLAN</span><h1>졸업까지, 한눈에.</h1><p>{profile.curriculumYear ?? '미확인'}학년도 · {profile.primary?.name ?? '학과 확인 필요'}{profile.secondary ? ` + ${profile.secondary.name}` : ''}</p></div><button className="button secondary" onClick={() => navigate('courses')}><BookOpen size={17}/>내 과목 관리</button></div>{valid ? <Dashboard result={valid} targetGpa={state.targetGpa} onTargetChange={targetGpa => update({ targetGpa })} onNavigate={navigate}/> : <button className="button primary" onClick={() => navigate('courses')}>입력 과목 확인하기</button>}</>}
        {page === 'courses' && <CoursesView courses={state.courses} categories={profile.categories} result={valid} selectedIds={state.selectedCourseIds} onToggle={toggleDeletion} onAdd={() => setEditor({ type: 'course' })} onImportPdf={() => setImportingPdf(true)} onEdit={course => setEditor({ type: 'course', course })} onRemove={removeCourse} onClear={() => update({ selectedCourseIds: [] })}/>}
        {page === 'plan' && <PlanView semesters={state.semesters} categories={profile.categories} goal={valid?.after.goal ?? null} onAddSemester={label => {
          if (state.semesters.length >= 30) { notify('한 계획에 최대 30개 학기까지 입력할 수 있습니다.'); return; }
          update({ semesters: [...state.semesters, { id: crypto.randomUUID(), label, courses: [], fixedTarget: null }] });
        }} onRemoveSemester={removeSemester} onUpdateSemester={semester => update({ semesters: state.semesters.map(item => item.id === semester.id ? semester : item) })} onAddCourse={semesterId => setEditor({ type: 'planned', semesterId })} onEditCourse={(semesterId, course) => setEditor({ type: 'planned', semesterId, course })} onRemoveCourse={(semesterId, course) => setConfirmation({ title: '계획 과목을 제거할까요?', body: `‘${course.name}’을 미래 수강계획에서 제거합니다.`, label: '계획 과목 제거', action: () => { update({ semesters: state.semesters.map(semester => semester.id === semesterId ? { ...semester, courses: semester.courses.filter(item => item.id !== course.id) } : semester) }); setConfirmation(null); } })}/>}
        {page === 'rules' && <div className="stack"><Notice>편입·전과·복수전공의 학교 확인자료가 있다면 <a href="#personal-requirements">개인별 요건 입력</a>에서 필수 과목과 인정 기준을 보완할 수 있습니다.</Notice><RulesView state={state} profile={profile} policy={policy} onUpdate={update} onEditAcademic={() => setAcademicDraft({ ...state.academic })} onExport={exportState} onImport={importState} onReset={reset} onDemo={demo}/><div id="personal-requirements"><PersonalRequirements academic={state.academic} profile={officialProfile} value={state.personalRequirements} onChange={personalRequirements => update({ personalRequirements })}/></div></div>}
        <footer className="app-footer"><span><Sprout size={13}/>학저무저무</span><p>입력한 과목·학점 요건에 대한 시뮬레이션입니다. 실제 학점포기 신청이나 학교의 최종 졸업 판정은 변경하지 않습니다.</p><span>공식 자료 확인일 2026.10.02</span></footer>
      </main>
    </div>
    {editor && <CourseEditor course={editor.course} planned={editor.type === 'planned'} grades={GRADES} categories={profile.categories} catalog={profile.courseOptions} onSave={saveCourse} onClose={closeEditor}/>}
    {importingPdf && <TranscriptImport profile={profile} existing={state.courses} onClose={() => setImportingPdf(false)} onApply={(courses, mode) => {
      update({ courses: mode === 'replace' ? courses : [...state.courses, ...courses], selectedCourseIds: mode === 'replace' ? [] : state.selectedCourseIds, demo: false });
      setImportingPdf(false); notify(`${courses.length}개 성적을 반영했습니다. 학적과 기준 취득학점은 적용 규칙에서 확인해 주세요.`);
    }}/>}
    {academicDraft && <Modal title="학적·교육과정 수정" wide onClose={closeAcademic}><div className="stack"><AcademicForm value={academicDraft} onChange={setAcademicDraft}/><Notice>교육과정이 바뀌면 결과를 다시 계산합니다. 기존 과목은 새 기준에 맞는 이수구분인지 확인해 주세요.</Notice><div className="modal-actions"><button className="button secondary" onClick={closeAcademic}>취소</button><button className="button primary" onClick={() => {
      if (academicDraft.primaryDepartmentId !== 'computer' && academicDraft.secondaryDepartmentId !== 'computer') { notify('컴퓨터공학과가 포함된 조합을 선택해 주세요.'); return; }
      update({ academic: academicDraft, confirmedChecks: [] }); setAcademicDraft(null); notify('교육과정과 계산 결과를 갱신했습니다.');
    }}>적용하고 재계산<Check size={16}/></button></div></div></Modal>}
    {confirmation && <Modal title={confirmation.title} onClose={closeConfirmation}><p className="confirmation-body">{confirmation.body}</p><div className="modal-actions"><button className="button secondary" onClick={closeConfirmation}>취소</button><button className="button primary" onClick={confirmation.action}>{confirmation.label}</button></div></Modal>}
    {toast && <div className="toast" role="status">{toast}<button onClick={() => setToast('')} aria-label="알림 닫기"><X size={16}/></button></div>}
  </div>;
}
