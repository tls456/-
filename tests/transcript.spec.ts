import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';

test('가상 PDF는 후보 확인 후 일괄 반영하고 재가져오기 중복을 건너뛴다', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('예: 202312345').fill('202599999');
  await page.getByRole('button', { name: '교육과정 찾기' }).click();
  await page.getByRole('button', { name: '나의 졸업 계획 시작' }).click();
  await page.getByRole('button', { name: '이수 과목 · 삭제', exact: true }).click();
  await page.getByRole('button', { name: '성적표 PDF 가져오기' }).click();
  await page.getByLabel('성적표 PDF', { exact: true }).setInputFiles(resolve('tests/fixtures/transcript.pdf'));
  await expect(page.locator('.import-summary')).toContainText('추출 3과목');
  const apply = page.getByRole('button', { name: '확인한 성적 반영', exact: true });
  await expect(apply).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: '시간표 분류 후보 1개 일괄 선택', exact: true }).click();
  await page.getByRole('checkbox', { name: /아래 다른 학기 시간표 후보 1개의 영역을 모두 검토/ }).check();
  await expect(apply).toBeEnabled();
  await apply.click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('hakjeo-mujeomu:v1')!));
  expect(saved.courses).toHaveLength(3);
  expect(saved.courses[0].categoryId).toBe('ge-advanced-science');
  expect(saved.courses[1].categoryId).toBe('ge-humanities');
  await page.getByRole('button', { name: '성적표 PDF 가져오기' }).click();
  await page.getByLabel('성적표 PDF', { exact: true }).setInputFiles(resolve('tests/fixtures/transcript.pdf'));
  await expect(page.getByText('기존 기록과 중복되는 3개는 추가하지 않습니다.', { exact: false })).toBeVisible();
  await expect(apply).toBeDisabled();
  await page.getByLabel('반영 방식', { exact: true }).selectOption('replace');
  await expect(apply).toBeDisabled();
  await page.getByRole('button', { name: '시간표 분류 후보 선택', exact: true }).click();
  await page.getByRole('checkbox', { name: '1번 분류와 인정 상태 확인' }).check();
  await page.getByRole('checkbox', { name: /기존 이수 과목 3개와 삭제 선택을 교체/ }).check();
  await apply.click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hakjeo-mujeomu:v1')!).courses.length)).toBe(3);
});

test('잘못된 PDF는 입력을 변경하지 않고 오류를 보여 준다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /가상 성적으로 시연/ }).click();
  await page.getByRole('button', { name: '이수 과목 · 삭제', exact: true }).click();
  const before = await page.evaluate(() => localStorage.getItem('hakjeo-mujeomu:v1'));
  await page.getByRole('button', { name: '성적표 PDF 가져오기' }).click();
  await page.getByLabel('성적표 PDF', { exact: true }).setInputFiles({ name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('Not a PDF') });
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('hakjeo-mujeomu:v1'))).toBe(before);
});
