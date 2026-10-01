import { chromium } from '@playwright/test';
import os from 'node:os';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR' });
try {
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  const computation = await page.evaluate(async () => {
    const { createDemo } = await import('/src/demo.ts');
    const { simulate } = await import('/src/domain/simulator.ts');
    const { GRADES } = await import('/src/data/academic.ts');
    const state = createDemo();
    const gradeLabels = ['C+', 'C', 'D+', 'D', 'F', 'N', 'C+', 'D'];
    const gradeMap = new Map(GRADES.map(grade => [grade.label, grade]));
    state.courses = Array.from({ length: 200 }, (_, index) => ({
      id: `performance-${index}`, name: `성능 검증 가상 과목 ${index + 1}`,
      categoryId: 'primary-elective', semester: '2025-2',
      credits: index % 4 + 1, grade: gradeLabels[index % gradeLabels.length],
      deletionEligibility: 'eligible',
    }));
    state.academic.baselineEarnedCredits = state.courses.reduce((sum, course) => sum + (gradeMap.get(course.grade).earned ? course.credits : 0), 0);
    state.semesters[0].fixedTarget = 3.5;
    state.selectedCourseIds = [];
    const original = JSON.stringify(state);
    for (let index = 0; index < 5; index++) simulate(state);
    const durations = [];
    let final;
    for (let index = 0; index < 20; index++) {
      const input = { ...state, selectedCourseIds: index % 2 ? ['performance-0'] : [] };
      const start = performance.now();
      const computed = simulate(input);
      durations.push(performance.now() - start);
      if (!computed.result.valid || !computed.result.deletion.applied) throw new Error('Invalid performance fixture');
      final = computed;
    }
    if (JSON.stringify(state) !== original) throw new Error('Simulation mutated its original input');
    localStorage.setItem('hakjeo-mojeomo:v1', original);
    return {
      records: state.courses.length,
      warmups: 5,
      measuredRuns: durations.length,
      averageMs: durations.reduce((sum, duration) => sum + duration, 0) / durations.length,
      maximumMs: Math.max(...durations),
      minimumMs: Math.min(...durations),
      durationsMs: durations,
      deletionCreditLimit: final.policy.creditLimit,
      confirmedCandidates: final.result.deletion.eligibility.filter(course => course.status === 'eligible').length,
      candidateChargeCredits: final.result.deletion.eligibility.filter(course => course.status === 'eligible').reduce((sum, course) => sum + course.chargeCredits, 0),
      additionalCombinationCredits: final.result.deletion.additionalMaxCredits,
      userAgent: navigator.userAgent,
    };
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '이수 과목 · 삭제', exact: true }).click();
  const checkbox = page.getByRole('checkbox', { name: '성능 검증 가상 과목 1 삭제 대상으로 선택', exact: true });
  await checkbox.waitFor();
  const ui = await checkbox.evaluate(async element => {
    const durations = [];
    for (let index = 0; index < 20; index++) {
      const expected = !element.checked;
      const start = performance.now();
      element.click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      durations.push(performance.now() - start);
      if (element.checked !== expected) throw new Error('UI did not apply the deletion selection');
    }
    return {
      measuredRuns: durations.length,
      averageMs: durations.reduce((sum, duration) => sum + duration, 0) / durations.length,
      maximumMs: Math.max(...durations),
      minimumMs: Math.min(...durations),
      durationsMs: durations,
      measurement: 'Checkbox DOM click through React rerender and two requestAnimationFrame callbacks; includes frame scheduling, excludes Playwright transport.',
    };
  });
  console.log(JSON.stringify({
    measuredAt: new Date().toISOString(),
    node: process.version,
    browser: await browser.version(),
    platform: `${os.type()} ${os.release()} ${os.arch()}`,
    cpu: os.cpus()[0]?.model,
    logicalCpus: os.cpus().length,
    totalMemoryGB: os.totalmem() / 1024 ** 3,
    computation,
    ui,
  }, null, 2));
} finally {
  await browser.close();
}
