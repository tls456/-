import { test, expect } from '@playwright/test';
import { createDemo } from '../src/demo';
import { STORAGE_KEY } from '../src/state';

for (const action of ['pass-only', 'remove'] as const) {
  test(`고정 학기의 마지막 평점 과목을 ${action === 'remove' ? '제거' : '평점 미반영으로 변경'}해도 고정 해제로 복구할 수 있다`, async ({ page }) => {
    const state = createDemo();
    state.semesters = [{
      id: 'locked-semester', label: '검증용 고정 학기', fixedTarget: 3.5,
      courses: [{ id: 'last-graded', name: '마지막 평점 과목', categoryId: 'primary-elective', credits: 3, graded: true }],
    }];
    await page.addInitScript(({ key, saved }) => localStorage.setItem(key, JSON.stringify(saved)), { key: STORAGE_KEY, saved: state });
    await page.goto('/');
    await page.getByRole('button', { name: '학기별 계획', exact: true }).click();
    await expect(page.getByRole('button', { name: '고정 해제', exact: true })).toBeVisible();
    if (action === 'pass-only') {
      await page.getByRole('button', { name: '검증용 고정 학기 마지막 평점 과목 계획 수정', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('combobox', { name: '성적 방식', exact: true }).selectOption('pass');
      await dialog.getByRole('button', { name: '수정 사항 반영', exact: true }).click();
    } else {
      await page.getByRole('button', { name: '검증용 고정 학기 마지막 평점 과목 계획 제거', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: '계획 과목 제거', exact: true }).click();
    }
    await expect(page.getByText('평점 산정 과목이 없으므로 고정 목표를 해제해 주세요.', { exact: false })).toBeVisible();
    const unlock = page.getByRole('button', { name: '고정 해제', exact: true });
    await expect(unlock).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('평점 산정 과목이 없는 학기');
    await unlock.click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '고정 해제', exact: true })).toHaveCount(0);
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
    expect(saved.semesters[0].fixedTarget).toBeNull();
    expect(saved.semesters[0].courses).toHaveLength(action === 'remove' ? 0 : 1);
    await page.getByRole('button', { name: '나의 대시보드', exact: true }).click();
    await expect(page.getByRole('heading', { name: '졸업까지, 한눈에.' })).toBeVisible();
    await expect(page.getByRole('region', { name: '평점 목표', exact: true })).toBeVisible();
  });
}
