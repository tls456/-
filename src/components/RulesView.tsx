import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Download, Upload, Settings2, Calculator, RotateCcw, Database } from 'lucide-react';
import { GRADES, normalizeGrade, type AcademicDeletionPolicy, type StudentAcademic } from '../data/academic';
import type { BuiltProfile } from '../domain/buildProfile';
import type { Course } from '../domain/types';
import { RULE_VERSION, type AppState } from '../state';
import { Badge, Field, Notice, SourceLink } from './ui';

interface RulesViewProps {
  state: AppState;
  profile: BuiltProfile;
  policy: AcademicDeletionPolicy;
  onUpdate: (patch: Partial<AppState>) => void;
  onEditAcademic: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onReset: () => void;
  onDemo: () => void;
}

interface PolicyDraft {
  semesters: string;
  status: StudentAcademic['enrollmentStatus'];
  round: StudentAcademic['deletionRound'];
  applicationTerm: string;
  baseline: string;
  pending: string;
}

function draftFromState(state: AppState): PolicyDraft {
  return {
    semesters: state.academic.registeredSemesters?.toString() ?? '',
    status: state.academic.enrollmentStatus,
    round: state.academic.deletionRound,
    applicationTerm: state.applicationTerm,
    baseline: state.academic.baselineEarnedCredits?.toString() ?? '',
    pending: state.academic.priorPendingDeletionCredits.toString(),
  };
}

function integer(value: string, minimum: number): number | null | undefined {
  if (!value.trim()) return null;
  if (!/^\d+$/.test(value.trim())) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : undefined;
}

function termOrdinal(value: string): { order: number; seasonal: boolean } | null {
  const match = /^(\d{4})-(1|여름|2|겨울)$/.exec(value.trim());
  if (!match) return null;
  const offsets: Record<string, number> = { '1': 0, '여름': 1, '2': 2, '겨울': 3 };
  return { order: Number(match[1]) * 4 + offsets[match[2]], seasonal: ['여름', '겨울'].includes(match[2]) };
}

/** Sum posted earned credits only. Never treat deletion selection as an actual withdrawal. */
export function sumConfirmedEarnedCredits(courses: Course[], applicationTerm: string, round: StudentAcademic['deletionRound']):
  { credits: number | null; includedCount: number; excludedCount: number; error: string | null } {
  const failure = (error: string) => ({ credits: null, includedCount: 0, excludedCount: 0, error });
  const application = termOrdinal(applicationTerm);
  if (!application || application.seasonal) return failure('신청 학기를 YYYY-1 또는 YYYY-2 형식으로 먼저 확인해 주세요.');
  if (!courses.length) return failure('전체 확정 성적을 먼저 입력해 주세요.');
  let credits = 0;
  let includedCount = 0;
  let excludedCount = 0;
  const codes = new Set<string>();
  const names = new Set<string>();
  for (const course of courses) {
    const semester = termOrdinal(course.semester);
    if (!semester) return failure(`${course.name}: 이수 학기가 올바르지 않아 합산할 수 없습니다.`);
    const inPeriod = semester.order < application.order || (round === 'second' && semester.order === application.order);
    if (!inPeriod) { excludedCount++; continue; }
    if (semester.seasonal) return failure('계절학기의 취득학점 반영 시점은 자동 판단하지 않습니다. 학사시스템의 해당 차수 기준 총 취득학점을 직접 입력해 주세요.');
    if (!Number.isSafeInteger(course.credits) || course.credits <= 0) return failure(`${course.name}: 과목 학점 수를 양의 정수로 확인해 주세요.`);
    const grade = GRADES.find((item) => item.label === normalizeGrade(course.grade));
    if (!grade) return failure(`${course.name}: 확정된 성적 등급을 확인해 주세요.`);
    const code = course.courseCode?.trim().toUpperCase();
    const name = course.name.replace(/\s+/g, '').toLocaleLowerCase('ko-KR');
    if ((code && codes.has(code)) || (name && names.has(name))) return failure('동일 과목으로 보이는 기록이 있습니다. 중복수강·포기 반영 결과를 확인한 뒤 학사시스템의 총 취득학점을 직접 입력해 주세요.');
    if (code) codes.add(code);
    if (name) names.add(name);
    if (grade.earned) { credits += course.credits; includedCount++; }
    else excludedCount++;
  }
  if (!Number.isSafeInteger(credits)) return failure('정확하게 합산할 수 있는 범위를 초과했습니다.');
  return { credits, includedCount, excludedCount, error: null };
}

export function RulesView({ state, profile, policy, onUpdate, onEditAcademic, onExport, onImport, onReset, onDemo }: RulesViewProps) {
  const [draft, setDraft] = useState(() => draftFromState(state));
  const [errors, setErrors] = useState<Partial<Record<keyof PolicyDraft, string>>>({});
  const [completeGrades, setCompleteGrades] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sumError, setSumError] = useState<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setDraft(draftFromState(state));
    setErrors({});
  }, [state.academic, state.applicationTerm]);
  useEffect(() => { setCompleteGrades(false); }, [state.courses]);
  const update = <K extends keyof PolicyDraft>(key: K, value: PolicyDraft[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setMessage(null);
    setSumError(null);
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  };
  const savePolicy = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Partial<Record<keyof PolicyDraft, string>> = {};
    const semesters = integer(draft.semesters, 1);
    const baseline = integer(draft.baseline, 0);
    const pending = integer(draft.pending, 0);
    if (semesters === undefined) nextErrors.semesters = '1 이상의 정수로 입력해 주세요. 모르면 비워 두세요.';
    if (baseline === undefined) nextErrors.baseline = '0 이상의 정수로 입력해 주세요. 모르면 비워 두세요.';
    if (pending == null) nextErrors.pending = '없으면 0, 있으면 학점 수를 0 이상의 정수로 입력해 주세요.';
    if (!/^\d{4}-(1|2)$/.test(draft.applicationTerm.trim())) nextErrors.applicationTerm = '예: 2026-1 또는 2026-2';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { setMessage(null); return; }
    onUpdate({
      applicationTerm: draft.applicationTerm.trim(),
      academic: {
        ...state.academic,
        registeredSemesters: semesters ?? null,
        enrollmentStatus: draft.status,
        deletionRound: draft.round,
        baselineEarnedCredits: baseline ?? null,
        priorPendingDeletionCredits: pending!,
      },
    });
    setMessage('삭제 규칙 입력을 적용했습니다. 실제 학점포기를 신청한 것은 아닙니다.');
  };
  const sumBaseline = () => {
    if (!completeGrades) return;
    const result = sumConfirmedEarnedCredits(state.courses, draft.applicationTerm, draft.round);
    setSumError(result.error);
    if (result.credits == null) return;
    setDraft((previous) => ({ ...previous, baseline: String(result.credits) }));
    setErrors((previous) => ({ ...previous, baseline: undefined }));
    setMessage(`${result.includedCount}개 과목의 취득학점 ${result.credits}학점을 채웠습니다. 범위 밖·미취득 ${result.excludedCount}개는 제외했습니다. 아래 ‘삭제 규칙 적용’을 눌러 반영해 주세요.`);
  };
  const academic = state.academic;
  const admissionLabels = { freshman: '신입학', transfer: '편입학', 'major-change': '전과' };
  const unknown = [...new Set([...profile.graduationRule.unknownReasons, ...(policy.unknownReasons ?? [])])];
  const courseNames = new Map(profile.courseOptions.map((course) => [course.code, course.name]));
  const remainingCap = policy.confirmed && policy.creditLimit != null ? Math.max(0, policy.creditLimit - policy.usedCredits) : null;

  return <div className="stack">
    <div className="page-intro"><div><h1>적용 규칙과 데이터</h1><p>어떤 기준으로 계산하는지, 직접 확인할 수 있어요.</p></div><Badge tone="green">GLOCAL · 2020–2026</Badge></div>

    <section className="panel stack">
      <div className="panel-heading"><div><h2>나의 교육과정</h2><p>학번 전체는 저장하지 않고 교육과정 매칭에 필요한 연도만 사용합니다.</p></div><button className="button secondary" onClick={onEditAcademic}><Settings2 size={16}/>학적 정보 수정</button></div>
      <dl className="form-grid">
        <div className="field"><dt>입학 기준</dt><dd>{academic.entryYear}학번 · {admissionLabels[academic.admissionType]}</dd></div>
        <div className="field"><dt>원전공</dt><dd>{profile.primary?.name ?? '확인 필요'}</dd></div>
        <div className="field"><dt>원전공 교육과정</dt><dd>{profile.curriculumYear == null ? '확인 필요' : `${profile.curriculumYear}학년도`}</dd></div>
        <div className="field"><dt>다전공</dt><dd>{academic.secondaryDepartmentId ? `${profile.secondary?.name ?? '학과 확인 필요'} · ${profile.secondaryYear ?? '선발연도 확인 필요'}` : '선택하지 않음'}</dd></div>
      </dl>
      <Notice>신입학은 입학연도, 다전공은 선발연도가 기준입니다. 편입·전과·교육과정 변경은 학교에서 확인한 적용연도와 인정 내역이 필요합니다. 외국인·해외대학 등 특별전형의 별도 요건은 자동 확정하지 않습니다.</Notice>
    </section>

    <section className="panel stack">
      <div className="panel-heading"><div><h2>취득학점포기 계산 기준</h2><p>학사시스템의 취득학점확인원과 신청 공지를 기준으로 입력해 주세요.</p></div><Badge tone={policy.confirmed && !policy.blockedReasons?.length ? 'green' : 'amber'}>{policy.blockedReasons?.length ? '신청 제한 확인' : policy.confirmed ? '계산 기준 입력됨' : '입력·확인 필요'}</Badge></div>
      <form className="stack" onSubmit={savePolicy} noValidate>
        <div className="form-grid">
          <Field label="현재 등록학기 수" hint="이번 학기 포함. 편입 인정학기도 포함합니다." error={errors.semesters}><input inputMode="numeric" type="text" placeholder="예: 7" value={draft.semesters} onChange={(event) => update('semesters', event.target.value)}/></Field>
          <Field label="신청·처리 기간의 학적 상태"><select value={draft.status} onChange={(event) => update('status', event.target.value as PolicyDraft['status'])}><option value="unknown">확인하지 않음</option><option value="enrolled">재학</option><option value="leave">휴학</option></select></Field>
          <Field label="신청 차수"><select value={draft.round} onChange={(event) => update('round', event.target.value as PolicyDraft['round'])}><option value="first">1차 · 이전 학기까지</option><option value="second">2차 · 당해 학기 포함</option></select></Field>
          <Field label="신청 학기" hint="실제 신청 기간은 학교 공지를 확인해 주세요." error={errors.applicationTerm}><input type="text" placeholder="2026-2" value={draft.applicationTerm} onChange={(event) => update('applicationTerm', event.target.value)}/></Field>
          <Field label="기준 총 취득학점" hint={draft.round === 'first' ? '이전 학기까지의 취득학점. F/N 제외, P 포함.' : '당해 학기 확정 성적까지 포함한 취득학점. F/N 제외, P 포함.'} error={errors.baseline}><input inputMode="numeric" type="text" placeholder="미확인" value={draft.baseline} onChange={(event) => update('baseline', event.target.value)}/></Field>
          <Field label="기준 취득학점에 미반영된 신청량" hint="이미 확정 삭제된 학점은 다시 빼지 않습니다. 미처리 F/N은 0학점으로 셉니다." error={errors.pending}><input inputMode="numeric" type="text" value={draft.pending} onChange={(event) => update('pending', event.target.value)}/></Field>
        </div>
        <div className="stack">
          <label className="check-line"><input type="checkbox" checked={completeGrades} onChange={(event) => setCompleteGrades(event.target.checked)}/>편입 인정학점을 포함한 전체 확정 성적을 빠짐없이 입력했습니다.</label>
          <div><button type="button" className="button secondary" disabled={!completeGrades || !state.courses.length} onClick={sumBaseline}><Calculator size={16}/>입력한 확정 성적 합산해서 사용</button></div>
          <small className="muted">시뮬레이션으로 선택한 삭제 과목은 합산에서 빼지 않습니다. 편입 인정학점은 취득학점에 포함하되 GPA에는 반영하지 않습니다. 계절학기·중복수강은 공식 합계를 직접 확인합니다.</small>
        </div>
        {sumError && <Notice tone="warning">{sumError}</Notice>}
        {message && <p className="form-message" role="status">{message}</p>}
        <div><button className="button primary" type="submit">삭제 규칙 적용</button></div>
      </form>
      <div className="notice"><Calculator size={18}/><div><strong>현재 적용된 계산식</strong><p>총 취득학점 {policy.baselineEarnedCredits ?? '미확인'} − {policy.referenceSemesters ?? '미확인'}학기 수료인정학점 {policy.completionCreditFloor ?? '미확인'} = 삭제 총한도 {policy.creditLimit ?? '미확인'}학점</p><p>미처리 신청량 {policy.usedCredits}학점을 제외한 한도: {remainingCap == null ? '확인 필요' : `${remainingCap}학점`}. 음수 한도는 0으로 처리하며, 현재 삭제 선택량은 과목 화면에서 추가로 반영합니다.</p></div></div>
      <p className="muted">예: 현재 등록 7학기라면 1차는 6학기, 2차는 7학기 수료 기준입니다. C+ 이하와 N만 대상이며, F/N은 취득학점이 없어 한도 사용량이 0입니다. P 및 편입 인정학점은 포기 대상이 아닙니다.</p>
      {policy.blockedReasons?.map((reason) => <Notice key={reason} tone="error">{reason}</Notice>)}
      <Notice tone="warning"><strong>공식 자료의 문구 차이 · 사용자 확인 기준</strong><p>{policy.notices.join(' ')}</p><p>요람의 수강신청 상한을 추가 적용하지 않는 기준으로 선택되었습니다. 이 앱은 학교 신청이나 승인 여부를 대신하지 않습니다.</p></Notice>
    </section>

    <section className="panel stack">
      <div className="panel-heading"><div><h2>졸업 요건에 적용한 데이터</h2><p>총학점, 영역, 필수과목은 서로 겹치는 조건이므로 표의 숫자를 단순 합산하지 않습니다.</p></div><Badge>총 {profile.graduationRule.totalCredits ?? '미확인'}학점</Badge></div>
      <div className="table-scroll"><table><thead><tr><th scope="col">검사 영역</th><th scope="col">최소 학점 수</th></tr></thead><tbody>{profile.graduationRule.areas.map((area) => <tr key={area.id}><td>{area.label}</td><td>{area.minCredits}학점</td></tr>)}</tbody></table></div>
      {profile.graduationRule.categoryDiversity?.map((group) => <p key={group.id}>{group.label}: {group.categoryIds.length}개 영역 중 최소 {group.minCount}개, 각 영역 {group.minCreditsPerCategory ?? 1}학점 이상</p>)}
      <details><summary>자동 검사하는 필수과목·선택필수 ({profile.graduationRule.requiredCourses.length}개 조건)</summary><div className="stack">{profile.graduationRule.requiredCourses.map((course) => <div key={course.id}><strong>{course.label}</strong><p>{course.alternatives.map((code) => `${courseNames.get(code) ?? code} (${code})`).join(' / ')}{course.alternatives.length > 1 && ` 중 ${course.minimumCount ?? 1}개 이상`}</p></div>)}{profile.graduationRule.requiredCourses.length === 0 && <p>현재 학적 정보로 확정한 필수과목 조건이 없습니다. 필수과목이 없다는 뜻은 아닙니다.</p>}</div></details>
      <details><summary>성적 환산표와 GPA 반영</summary><div className="table-scroll"><table><thead><tr><th scope="col">등급</th><th scope="col">환산 평점</th><th scope="col">취득학점</th><th scope="col">GPA 분모</th></tr></thead><tbody>{GRADES.map((grade) => <tr key={grade.label}><td>{grade.label}</td><td>{grade.points ?? '제외'}</td><td>{grade.earned ? '포함' : '제외'}</td><td>{grade.points == null ? '제외' : '포함'}</td></tr>)}</tbody></table></div><p>편입 인정 성적은 등급과 무관하게 GPA에서 제외합니다. NP는 N으로 통일하며, 원점수로 등급을 추정하지 않습니다. 확정된 학점포기 과목은 원본 성적 입력에서 제외해 주세요.</p></details>
      {profile.notices.length > 0 && <details><summary>교육과정 해석과 주의사항</summary><ul>{profile.notices.map((notice) => <li key={notice}>{notice}</li>)}</ul></details>}
    </section>

    <section className="panel stack">
      <div className="panel-heading"><div><h2>별도로 확인할 요건</h2><p>자동 계산 결과와 학교의 최종 졸업 판정은 다릅니다.</p></div></div>
      {unknown.length > 0 ? <Notice tone="warning"><ul>{unknown.map((reason) => <li key={reason}>{reason}</li>)}</ul></Notice> : <Notice>입력한 일반 교육과정의 학점 기준은 매칭되었습니다. 개인별 인정·대체 과목과 아래 비학점 요건은 학교에서 확인해 주세요.</Notice>}
      {!!profile.graduationRule.nonCreditRequirements?.length && <div><h3>학점만으로 확인할 수 없는 요건</h3><ul>{profile.graduationRule.nonCreditRequirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul></div>}
    </section>

    <section className="panel stack">
      <div className="panel-heading"><div><h2>공식 근거</h2><p>확인일 2026. 10. 02. · 규칙 버전 {RULE_VERSION}</p></div></div>
      <details><summary>규정·공지·요람 출처 {profile.sources.length}개 보기</summary><div className="stack">{profile.sources.map((source) => <div key={source.id}><SourceLink href={source.url}>{source.title}</SourceLink><p>{source.locator}{source.revision && ` · 개정 ${source.revision}`}{source.publishedAt && ` · 게시 ${source.publishedAt}`}{source.pdfPage != null && `PDF ${source.pdfPage}쪽${source.printedPage != null ? ` (책자 ${source.printedPage}쪽)` : ''}`}</p>{source.pdfUrl && <SourceLink href={`${source.pdfUrl}#page=${source.pdfPage ?? 1}`}>원문 PDF</SourceLink>}</div>)}</div></details>
    </section>

    <section className="panel stack">
      <div className="panel-heading"><div><h2>내 데이터 관리</h2><p>성적은 서버나 학교 시스템으로 전송하지 않습니다.</p></div><Database size={22}/></div>
      <label className="check-line"><input type="checkbox" checked={state.saveEnabled} onChange={(event) => onUpdate({ saveEnabled: event.target.checked })}/>이 브라우저에 자동 저장</label>
      <p className="muted">저장 위치는 이 기기·브라우저의 localStorage입니다. 다른 기기와 동기화되지 않으며, 브라우저 데이터 삭제나 비공개 창 종료로 사라질 수 있습니다. 공용 기기에서는 저장을 꺼 주세요.</p>
      <Notice>자동 저장을 끄면 브라우저 저장본은 제거되지만 현재 화면의 입력은 유지됩니다. 필요한 기록은 먼저 JSON 백업을 내려받으세요. 백업에는 입력한 성적·학적·계획이 포함되므로 직접 안전하게 보관해 주세요.</Notice>
      <div className="button-row">
        <button className="button secondary" onClick={onExport}><Download size={16}/>JSON 백업</button>
        <button className="button secondary" onClick={() => importInput.current?.click()}><Upload size={16}/>백업 불러오기</button>
        <button className="button secondary" onClick={onDemo}>예시 데이터로 살펴보기</button>
        <button className="button secondary danger-hover" onClick={onReset}><RotateCcw size={16}/>입력 초기화</button>
      </div>
      <input ref={importInput} className="sr-only" type="file" accept="application/json,.json" aria-label="불러올 JSON 백업 파일" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.target.value = ''; }}/>
      <small className="muted">불러오기·예시 데이터·초기화는 현재 입력을 바꾸는 기능입니다. 학사시스템의 실제 성적에는 영향을 주지 않습니다.</small>
    </section>
  </div>;
}
