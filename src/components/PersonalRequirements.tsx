import { useEffect, useState, type FormEvent } from 'react';
import { Check, Plus, Trash2, FileCheck2 } from 'lucide-react';
import type { StudentAcademic } from '../data/academic';
import type { BuiltProfile } from '../domain/buildProfile';
import { getPersonalContextKey, validatePersonalRequirements, type PersonalRequirements as PersonalData } from '../domain/personal';
import { Badge, Field, Notice } from './ui';

interface Props {
  academic: StudentAcademic;
  /** Unmodified, source-based profile. Never pass the already-overridden profile here. */
  profile: BuiltProfile;
  value: PersonalData | undefined;
  onChange: (value: PersonalData | undefined) => void;
}

function blank(academic: StudentAcademic): PersonalData {
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return { contextKey: getPersonalContextKey(academic), sourceNote: '', checkedAt: date, requiredCourses: [], areas: [], exemptRequirementIds: [], confirmedUnknownReasons: [], confirmedNonCreditRequirements: [] };
}

function clone(value: PersonalData): PersonalData {
  return {
    ...value,
    requiredCourses: value.requiredCourses.map((course) => ({ ...course, alternatives: [...course.alternatives] })),
    areas: value.areas.map((area) => ({ ...area, categoryIds: [...area.categoryIds] })),
    exemptRequirementIds: [...value.exemptRequirementIds],
    confirmedUnknownReasons: [...value.confirmedUnknownReasons],
    confirmedNonCreditRequirements: [...value.confirmedNonCreditRequirements],
  };
}

function whole(value: string, minimum: number): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : null;
}

export function PersonalRequirements({ academic, profile, value, onChange }: Props) {
  const [draft, setDraft] = useState<PersonalData>(() => value ? clone(value) : blank(academic));
  const [reviewed, setReviewed] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [courseLabel, setCourseLabel] = useState('');
  const [courseCodes, setCourseCodes] = useState('');
  const [courseCount, setCourseCount] = useState('1');
  const [courseError, setCourseError] = useState('');
  const [areaTarget, setAreaTarget] = useState('new');
  const [areaLabel, setAreaLabel] = useState('');
  const [areaCredits, setAreaCredits] = useState('');
  const [areaCategories, setAreaCategories] = useState<string[]>([]);
  const [areaError, setAreaError] = useState('');
  const [exemptTarget, setExemptTarget] = useState('');
  const contextKey = getPersonalContextKey(academic);
  useEffect(() => {
    setDraft(value ? clone(value) : blank(academic));
    setReviewed(false);
    setErrors([]);
    setRemoveConfirm(false);
  }, [value]);
  useEffect(() => { setReviewed(false); }, [contextKey]);
  const changedContext = draft.contextKey !== contextKey;
  const existingAreas = profile.graduationRule.areas;
  const existingCourses = profile.graduationRule.requiredCourses;
  const labels = new Map([...existingAreas, ...existingCourses].map((item) => [item.id, item.label]));
  const categoryLabels = new Map(profile.categories.map((item) => [item.id, item.label]));
  const unknown = profile.graduationRule.unknownReasons;
  const nonCredit = profile.graduationRule.nonCreditRequirements ?? [];
  const staleUnknown = draft.confirmedUnknownReasons.filter((reason) => !unknown.includes(reason));
  const staleNonCredit = draft.confirmedNonCreditRequirements.filter((reason) => !nonCredit.includes(reason));
  const savedIssues = value ? validatePersonalRequirements(profile, academic, value) : [];
  const update = (patch: Partial<PersonalData>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
    setReviewed(false);
    setMessage('');
    setErrors([]);
  };
  const toggle = (field: 'confirmedUnknownReasons' | 'confirmedNonCreditRequirements', text: string, checked: boolean) => {
    update({ [field]: checked ? [...draft[field], text] : draft[field].filter((item) => item !== text) });
  };
  const addCourse = () => {
    const codes = [...new Set(courseCodes.trim().split(/[\s,;]+/).filter(Boolean).map((code) => code.toUpperCase()))];
    const count = whole(courseCount, 1);
    if (!courseLabel.trim() || !codes.length || count === null || count > codes.length) {
      setCourseError('요건 이름과 학수번호를 입력하고, 최소 이수 개수를 입력한 과목 수 이내의 양의 정수로 지정해 주세요.'); return;
    }
    update({ requiredCourses: [...draft.requiredCourses, { id: `personal-course-${crypto.randomUUID()}`, label: courseLabel.trim(), alternatives: codes, minimumCount: count }] });
    setCourseLabel(''); setCourseCodes(''); setCourseCount('1'); setCourseError('');
  };
  const addArea = () => {
    const minimum = whole(areaCredits, 0);
    const existing = existingAreas.find((area) => area.id === areaTarget);
    if (minimum === null || (areaTarget === 'new' && (!areaLabel.trim() || !areaCategories.length)) || (areaTarget !== 'new' && !existing)) {
      setAreaError('영역 이름과 인정할 과목 구분을 선택하고, 최소 학점을 0 이상의 정수로 입력해 주세요.'); return;
    }
    const area = existing
      ? { ...existing, minCredits: minimum, categoryIds: [...existing.categoryIds] }
      : { id: `personal-area-${crypto.randomUUID()}`, label: areaLabel.trim(), minCredits: minimum, categoryIds: areaCategories };
    update({ areas: [...draft.areas.filter((item) => item.id !== area.id), area] });
    setAreaTarget('new'); setAreaLabel(''); setAreaCredits(''); setAreaCategories([]); setAreaError('');
  };
  const apply = (event: FormEvent) => {
    event.preventDefault();
    const next = { ...clone(draft), contextKey, sourceNote: draft.sourceNote.trim() };
    const issues = validatePersonalRequirements(profile, academic, next);
    if (!reviewed) issues.unshift('현재 학적에 맞는 자료와 입력내용을 확인했다는 항목을 체크해 주세요.');
    if (courseLabel.trim() || courseCodes.trim() || areaLabel.trim() || areaCredits.trim() || areaCategories.length) issues.push('아직 추가하지 않은 과목·영역 입력이 있습니다. 추가 버튼을 누르거나 해당 입력을 비운 뒤 적용해 주세요.');
    if (exemptTarget) issues.push('선택한 면제 대상을 아직 목록에 추가하지 않았습니다. 추가 버튼을 누르거나 면제 대상 선택을 비워 주세요.');
    setErrors(issues);
    if (issues.length) { setMessage(''); return; }
    onChange(next);
    setMessage('개인 확인내용을 계산에 적용했습니다. 학교의 최종 졸업 판정을 의미하지 않습니다.');
  };

  return <section className="panel stack">
    <div className="panel-heading"><div><h2>학교에서 확인한 나의 요건</h2><p>편입·전과·복수전공의 개인별 인정 사항을 확인한 자료대로 반영하세요.</p></div><Badge tone={value && !savedIssues.length ? 'green' : 'amber'}>{value ? savedIssues.length ? '재확인 필요' : '개인 확인내용 적용' : '선택 입력'}</Badge></div>
    <Notice><FileCheck2 size={16}/>취득학점확인원, 학과의 확인 문서 등 근거가 있을 때만 입력해 주세요. 자료 자체를 업로드하거나 진위를 인증하는 기능은 아닙니다. 사용자 입력은 공식 규정과 구분해서 표시됩니다.</Notice>
    {(changedContext || savedIssues.length > 0) && <Notice tone="warning"><strong>이전에 저장한 내용은 보존되어 있습니다.</strong><p>학적·교육과정이나 확인 대상이 달라졌다면 이전 내용을 계산에 적용하지 않습니다. 아래 내용을 현재 학적에 맞게 고친 뒤 자료를 다시 확인하고 적용해 주세요.</p>{savedIssues.length > 0 && <ul>{savedIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}</Notice>}
    <form className="stack" onSubmit={apply} noValidate>
      <div className="form-grid">
        <Field label="확인자료와 확인 내용" hint="예: 2026-10-02 학과 확인 취득학점확인원, 원전공 필수 5과목 적용. 불필요한 개인정보는 적지 마세요."><textarea rows={3} maxLength={4000} value={draft.sourceNote} onChange={(event) => update({ sourceNote: event.target.value })} placeholder="자료명·확인 주체·적용 사항"/></Field>
        <Field label="학교 자료를 확인한 날짜"><input type="date" value={draft.checkedAt} onChange={(event) => update({ checkedAt: event.target.value })}/></Field>
      </div>

      <details open={draft.requiredCourses.length > 0}>
        <summary>개인 필수과목·선택필수 추가 ({draft.requiredCourses.length}개)</summary>
        <div className="stack">
          <p className="muted">한 과목이면 학수번호 1개, 선택필수이면 후보 번호와 최소 이수 개수를 입력하세요. 이수 과목·미래 계획에도 같은 학수번호를 입력해야 검사됩니다. 이 입력만으로 학점이 취득되거나 과목이 면제되지는 않습니다.</p>
          <div className="form-grid">
            <Field label="필수요건 이름"><input value={courseLabel} maxLength={1000} onChange={(event) => setCourseLabel(event.target.value)} placeholder="예: 학과 확인 자료구조 필수"/></Field>
            <Field label="학수번호" hint="여러 개는 쉼표나 줄바꿈으로 구분합니다."><textarea rows={2} value={courseCodes} onChange={(event) => setCourseCodes(event.target.value)} placeholder="예: NDGE15060"/></Field>
            <Field label="후보 중 최소 이수 개수"><input inputMode="numeric" value={courseCount} onChange={(event) => setCourseCount(event.target.value)}/></Field>
          </div>
          {courseError && <Notice tone="error">{courseError}</Notice>}
          <div><button type="button" className="button secondary" onClick={addCourse}><Plus size={16}/>필수요건 목록에 추가</button></div>
          {draft.requiredCourses.map((course) => <div key={course.id} className="panel-heading"><div><strong>{course.label}</strong><p>{course.alternatives.join(', ')} · {course.minimumCount ?? 1}개 이상 이수</p></div><button type="button" className="icon-button danger-hover" aria-label={`${course.label} 개인 요건 제거`} onClick={() => update({ requiredCourses: draft.requiredCourses.filter((item) => item.id !== course.id) })}><Trash2 size={16}/></button></div>)}
        </div>
      </details>

      <details open={draft.areas.length > 0}>
        <summary>영역별 최소학점 추가·변경 ({draft.areas.length}개)</summary>
        <div className="stack">
          <p className="muted">새 조건은 기존 요건에 추가됩니다. 기존 영역을 선택하면 그 영역의 최소학점만 바뀌며 과목 구분은 유지됩니다. 총 졸업학점이나 다른 영역 요건을 자동으로 낮추지는 않습니다.</p>
          <div className="form-grid">
            <Field label="적용할 영역"><select value={areaTarget} onChange={(event) => {
              const selected = existingAreas.find((area) => area.id === event.target.value);
              setAreaTarget(event.target.value); setAreaCredits(selected ? String(selected.minCredits) : ''); setAreaLabel(''); setAreaCategories([]);
            }}><option value="new">새 개인 영역 조건 추가</option>{existingAreas.map((area) => <option key={area.id} value={area.id}>{area.label} · 현재 {area.minCredits}학점</option>)}</select></Field>
            {areaTarget === 'new' && <Field label="개인 영역 이름"><input value={areaLabel} maxLength={1000} onChange={(event) => setAreaLabel(event.target.value)} placeholder="예: 다전공 전필 확인학점"/></Field>}
            <Field label="학교에서 확인한 최소학점"><input inputMode="numeric" value={areaCredits} onChange={(event) => setAreaCredits(event.target.value)} placeholder="예: 12"/></Field>
            {areaTarget === 'new' && <Field label="이 영역에 합산할 과목 구분" hint="여러 구분을 선택할 수 있습니다. PC에서는 Ctrl 또는 ⌘ 키로 추가 선택하세요."><select multiple size={6} value={areaCategories} onChange={(event) => setAreaCategories(Array.from(event.target.selectedOptions, (option) => option.value))}>{profile.categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></Field>}
          </div>
          {areaError && <Notice tone="error">{areaError}</Notice>}
          <div><button type="button" className="button secondary" onClick={addArea}><Plus size={16}/>영역 조건 목록에 반영</button></div>
          {draft.areas.map((area) => <div key={area.id} className="panel-heading"><div><strong>{area.label} · {area.minCredits}학점 이상</strong><p>{existingAreas.some((existing) => existing.id === area.id) ? '기존 영역 최소학점 변경' : '추가 조건'} · {area.categoryIds.map((id) => categoryLabels.get(id) ?? `현재 학적에 없는 구분 (${id})`).join(', ')}</p></div><button type="button" className="icon-button danger-hover" aria-label={`${area.label} 개인 영역 조건 제거`} onClick={() => update({ areas: draft.areas.filter((item) => item.id !== area.id) })}><Trash2 size={16}/></button></div>)}
        </div>
      </details>

      <details open={draft.exemptRequirementIds.length > 0}>
        <summary>학교가 승인한 기존 요건 면제 ({draft.exemptRequirementIds.length}개)</summary>
        <div className="stack">
          <Notice tone="warning">해당 요건의 공식 면제·대체 승인을 확인했을 때만 선택하세요. 과목 면제와 영역 학점 면제는 서로 다릅니다. 필수과목만 면제해도 그 영역의 최소학점은 남아 있으며, 대체 과목은 위 필수요건에 별도로 추가해야 합니다.</Notice>
          <Field label="승인받은 면제 대상"><select value={exemptTarget} onChange={(event) => setExemptTarget(event.target.value)}><option value="">면제받은 항목 선택</option><optgroup label="영역 학점 요건">{existingAreas.map((area) => <option key={area.id} value={area.id}>{area.label} · {area.minCredits}학점</option>)}</optgroup><optgroup label="필수과목·선택필수">{existingCourses.map((course) => <option key={course.id} value={course.id}>{course.label}</option>)}</optgroup></select></Field>
          <div><button type="button" className="button secondary" disabled={!exemptTarget || draft.exemptRequirementIds.includes(exemptTarget)} onClick={() => { update({ exemptRequirementIds: [...draft.exemptRequirementIds, exemptTarget] }); setExemptTarget(''); }}><Plus size={16}/>면제 대상에 추가</button></div>
          {draft.exemptRequirementIds.map((id) => <div key={id} className="panel-heading"><span>{labels.get(id) ?? `현재 학적에 없는 이전 면제 항목 (${id})`}</span><button type="button" className="icon-button danger-hover" aria-label={`${labels.get(id) ?? id} 면제 해제`} onClick={() => update({ exemptRequirementIds: draft.exemptRequirementIds.filter((item) => item !== id) })}><Trash2 size={16}/></button></div>)}
        </div>
      </details>

      <details open={unknown.length > 0 || staleUnknown.length > 0}>
        <summary>미확정 사항의 개인별 확인 ({draft.confirmedUnknownReasons.length}개 표시)</summary>
        <div className="stack"><p>해당 내용을 학교 자료와 위에 입력한 개인 요건으로 해결한 경우에만 체크해 주세요. 체크는 필수과목을 자동 추가하지 않습니다.</p>
          {unknown.map((reason) => <label key={reason} className="check-line"><input type="checkbox" checked={draft.confirmedUnknownReasons.includes(reason)} onChange={(event) => toggle('confirmedUnknownReasons', reason, event.target.checked)}/><span>{reason}<small>학교 자료와 위 입력으로 해당 내용을 확인했습니다.</small></span></label>)}
          {unknown.length === 0 && <p className="muted">현재 기본 프로필에 미확정으로 분류된 학점 요건이 없습니다.</p>}
          {staleUnknown.map((reason) => <div key={reason} className="panel-heading"><span>현재 내용과 다른 이전 확인: {reason}</span><button type="button" className="button secondary" onClick={() => toggle('confirmedUnknownReasons', reason, false)}>이전 표시 제거</button></div>)}
        </div>
      </details>

      <details open={draft.confirmedNonCreditRequirements.length > 0 || staleNonCredit.length > 0}>
        <summary>비학점 요건의 충족 확인 ({draft.confirmedNonCreditRequirements.length}개 표시)</summary>
        <div className="stack"><p>단순히 읽었다는 표시가 아닙니다. 논문·작품·인증 등의 충족 또는 공식 면제를 학교 자료로 확인한 항목만 선택하세요.</p>
          {nonCredit.map((requirement) => <label key={requirement} className="check-line"><input type="checkbox" checked={draft.confirmedNonCreditRequirements.includes(requirement)} onChange={(event) => toggle('confirmedNonCreditRequirements', requirement, event.target.checked)}/><span>{requirement}<small>이 요건의 충족 또는 면제 승인을 확인했습니다.</small></span></label>)}
          {nonCredit.length === 0 && <p className="muted">등록된 비학점 확인 항목이 없습니다.</p>}
          {staleNonCredit.map((reason) => <div key={reason} className="panel-heading"><span>현재 내용과 다른 이전 확인: {reason}</span><button type="button" className="button secondary" onClick={() => toggle('confirmedNonCreditRequirements', reason, false)}>이전 표시 제거</button></div>)}
        </div>
      </details>

      <label className="check-line"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)}/><span>현재 학적·교육과정에 적용되는 학교 자료를 확인했고, 위 추가·변경·면제·충족 내용이 그 자료와 일치합니다.</span></label>
      {!!errors.length && <Notice tone="error"><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></Notice>}
      {message && <p className="form-message" role="status">{message}</p>}
      <div className="button-row"><button className="button primary" type="submit"><Check size={16}/>{changedContext ? '현재 학적에 재확인하여 적용' : '개인 확인내용 적용'}</button><button type="button" className="button secondary" onClick={() => { setDraft(value ? clone(value) : blank(academic)); setReviewed(false); setErrors([]); setMessage(''); setCourseLabel(''); setCourseCodes(''); setCourseCount('1'); setAreaTarget('new'); setAreaLabel(''); setAreaCredits(''); setAreaCategories([]); setExemptTarget(''); setCourseError(''); setAreaError(''); }}>편집 내용 되돌리기</button>{value && <button type="button" className="button secondary danger-hover" onClick={() => setRemoveConfirm(true)}>저장된 개인 확인내용 삭제</button>}</div>
      {removeConfirm && <Notice tone="warning"><p>저장된 개인 확인내용을 제거하고 공식 기본 요건으로 돌아갈까요? 성적과 학기 계획은 유지됩니다.</p><div className="button-row"><button type="button" className="button secondary" onClick={() => setRemoveConfirm(false)}>취소</button><button type="button" className="button secondary danger-hover" onClick={() => { onChange(undefined); setRemoveConfirm(false); setMessage('개인 확인내용을 제거했습니다. 기본 공식 요건으로 계산합니다.'); }}>개인 확인내용 제거</button></div></Notice>}
    </form>
  </section>;
}
