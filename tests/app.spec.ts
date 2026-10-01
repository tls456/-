import { test, expect, type Page } from '@playwright/test';

async function openDemo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /가상 성적으로 시연/ }).click();
  await expect(page.getByRole('heading', { name: '졸업까지, 한눈에.' })).toBeVisible();
}

test('학번 입력 후 2020 교육과정에 매칭하고 전체 학번은 저장하지 않는다', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('예: 202312345').fill('201912345');
  await page.getByRole('button', { name: '교육과정 찾기' }).click();
  await expect(page.getByRole('alert')).toContainText('2020~2026');
  await page.getByPlaceholder('예: 202312345').fill('202012345');
  await page.getByRole('button', { name: '교육과정 찾기' }).click();
  await expect(page.getByText('2020학번은 당시 소프트웨어전공 교육과정에 매칭됩니다.')).toBeVisible();
  await page.getByRole('button', { name: '나의 졸업 계획 시작' }).click();
  await expect(page.getByRole('heading', { name: '적용 규칙과 데이터' })).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem('hakjeo-mujeomu:v1'));
  expect(saved).toContain('2020');
  expect(saved).not.toContain('202012345');
});

test('가상 성적에서 F를 삭제 선택·해제하고 새로고침하면 계획을 복원한다', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('button', { name: '이수 과목 · 삭제', exact: true }).click();
  const checkbox = page.getByRole('checkbox', { name: '[가상] 프로그래밍 응용 삭제 대상으로 선택', exact: true });
  await expect(checkbox).toBeEnabled();
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  await page.reload();
  await page.getByRole('button', { name: '이수 과목 · 삭제', exact: true }).click();
  await expect(checkbox).toBeChecked();
  await checkbox.uncheck();
  await expect(checkbox).not.toBeChecked();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('이수 과목 추가·수정과 입력 제거는 삭제 시뮬레이션과 독립적이다', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('button', { name: '이수 과목 · 삭제', exact: true }).click();
  await page.getByRole('button', { name: '과목 추가', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('과목명', { exact: true }).fill('브라우저 검증 과목');
  await dialog.getByPlaceholder('2024-1').fill('2025-1');
  await dialog.getByLabel('과목 학점 수', { exact: true }).fill('3');
  await dialog.getByRole('button', { name: '과목 추가', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: '브라우저 검증 과목' })).toBeVisible();
  await page.getByRole('button', { name: '브라우저 검증 과목 입력 수정' }).click();
  await dialog.getByLabel('과목명', { exact: true }).fill('수정한 검증 과목');
  await dialog.getByRole('button', { name: '수정 사항 반영' }).click();
  await page.getByRole('button', { name: '수정한 검증 과목 입력 과목 제거' }).click();
  await dialog.getByRole('button', { name: '입력 과목 제거', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: '수정한 검증 과목' })).toHaveCount(0);
});

test('학기 목표를 고정·해제하고 새 학기를 추가할 수 있다', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('button', { name: '학기별 계획', exact: true }).click();
  await page.getByRole('button', { name: '목표 고정', exact: true }).first().click();
  await page.getByRole('dialog').getByLabel('목표 평균평점', { exact: true }).fill('3.5');
  await page.getByRole('button', { name: '고정하기', exact: true }).click();
  await expect(page.getByRole('button', { name: '고정 해제', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: '고정 해제', exact: true }).click();
  await page.getByRole('button', { name: '학기 추가', exact: true }).click();
  await page.getByRole('dialog').getByLabel('학기 이름', { exact: true }).pressSequentially('2027 여름학기');
  await page.getByRole('dialog').getByRole('button', { name: '학기 추가', exact: true }).click();
  await expect(page.getByRole('heading', { name: '2027 여름학기' })).toBeVisible();
});

test('모바일에서 메뉴·계획 화면이 문서 너비를 넘지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDemo(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: '메뉴 열기' }).click();
  await page.getByRole('button', { name: '학기별 계획', exact: true }).click();
  await expect(page.getByRole('heading', { name: '앞으로의 학기 계획' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: '메뉴 열기' }).click();
  await page.getByRole('button', { name: '이수 과목 · 삭제', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('개인 확인자료를 적용·복원하고 교육과정 변경 시 이전 자료 적용을 보류한다', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('button', { name: '적용 규칙 · 설정', exact: true }).click();
  const personal = page.locator('#personal-requirements');
  await personal.getByPlaceholder('자료명·확인 주체·적용 사항').fill('가상 검증용 학과 확인자료: 필수 한 과목 추가');
  await personal.locator('summary').filter({ hasText: '개인 필수과목·선택필수 추가' }).click();
  await personal.getByLabel('필수요건 이름', { exact: true }).fill('검증용 개인 필수');
  await personal.getByPlaceholder('예: NDGE15060', { exact: true }).fill('TEST-PERSONAL-REQ');
  await personal.getByRole('button', { name: '필수요건 목록에 추가' }).click();
  await personal.getByRole('checkbox', { name: '현재 학적·교육과정에 적용되는 학교 자료를 확인했고, 위 추가·변경·면제·충족 내용이 그 자료와 일치합니다.' }).check();
  await personal.getByRole('button', { name: '개인 확인내용 적용', exact: true }).click();
  await page.getByRole('button', { name: '나의 대시보드', exact: true }).click();
  await expect(page.getByText('검증용 개인 필수', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('검증용 개인 필수', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '학적 정보 수정', exact: true }).click();
  await page.getByRole('dialog').getByRole('combobox', { name: '학번 기준 입학연도', exact: true }).selectOption('2024');
  await page.getByRole('button', { name: '적용하고 재계산' }).click();
  await expect(page.getByText('검증용 개인 필수', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/개인 확인내용 미적용:/).first()).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('hakjeo-mujeomu:v1')!));
  expect(saved.personalRequirements.requiredCourses[0].label).toBe('검증용 개인 필수');
});
