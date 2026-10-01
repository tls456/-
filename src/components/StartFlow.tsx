import { useState, type FormEvent } from 'react';
import { Field, Notice } from './ui';

export function StartFlow({ step, remainingCredits, onUpload, onTarget }: {
  step: 'pdf' | 'target'; remainingCredits: number | null;
  onUpload: () => void; onTarget: (target: number) => void;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^\d+(\.\d{1,3})?$/.test(value) || Number(value) > 4.5) {
      setError('0~4.5 사이, 소수 셋째 자리까지 입력해 주세요.'); return;
    }
    setError(''); onTarget(Number(value));
  }
  return <section className="panel stack">
    <p className="eyebrow">학번 확인 → 성적표 업로드 → 목표 평균평점 → 대시보드</p>
    <h1>{step === 'pdf' ? '성적표 PDF를 업로드해 주세요' : '목표 평균평점을 입력해 주세요'}</h1>
    {step === 'pdf' ? <><p>전체 성적을 읽어 현재 평점과 남은 졸업학점을 계산합니다.</p><button className="button primary" onClick={onUpload}>성적표 PDF 업로드</button></>
      : <><p>졸업까지 남은 총학점: <strong>{remainingCredits ?? '확인 필요'}학점</strong></p>
        <form className="stack" onSubmit={submit} noValidate><Field label="목표 최종 평균평점" error={error}><input inputMode="decimal" value={value} onChange={event => setValue(event.target.value)} placeholder="3.50" autoFocus/></Field><button className="button primary">필요한 평균평점 계산하기</button></form>
        <Notice>남은 학점은 모두 평점 과목으로 가정하고 정규학기당 최대 18학점으로 배분합니다. 가상 과목은 전공·교양·필수과목 요건을 충족하지 않습니다. 학기별 계획에서 실제 과목과 P/N 여부를 수정할 수 있습니다.</Notice></>}
  </section>;
}
