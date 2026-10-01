import { buildProfile } from './domain/buildProfile';
import { GRADES } from './data/academic';
import { defaultAcademic, emptyState, type AppState } from './state';
import type { Course, PlannedCourse } from './domain/types';

/** Entirely fictional grades. Official course names/codes come from the selected handbook. */
export function createDemo(): AppState {
  const academic = { ...defaultAcademic(2023), registeredSemesters: 7, enrollmentStatus: 'enrolled' as const };
  const profile = buildProfile(academic);
  const courses: Course[] = profile.courseOptions.map((item, index) => ({
    id: `demo-course-${index}`, courseCode: item.code, name: item.name, categoryId: item.categoryId, credits: item.credits,
    semester: `${2023 + Math.floor(index / 8)}-${index % 2 + 1}`, grade: ['A', 'B+', 'A+', 'C', 'B'][index % 5], deletionEligibility: 'eligible',
  }));
  // Synthetic electives are explicitly named, so no invented school catalog is implied.
  const extraNames = ['웹 서비스 설계', '소프트웨어 프로젝트', '알고리즘 응용', '데이터 분석', '컴퓨터 네트워크', '모바일 앱 제작', '프로그래밍 실습', '클라우드 실습', '인공지능 응용', '사용자 경험 설계', '융합 프로젝트', '정보 시스템 설계', '데이터 시각화', '개발 방법론', '컴퓨팅 탐구', '팀 프로젝트', '응용 프로그래밍', '컴퓨터 과학 탐구', '네트워크 응용', '데이터 활용 실습', '시스템 개발', '산업 소프트웨어', '컴퓨팅 세미나', '인터페이스 설계'];
  for (const [index, name] of extraNames.entries()) {
    courses.push({ id: `demo-elective-${index}`, name: `[가상] ${name}`, categoryId: 'primary-elective', credits: 3, semester: `${2023 + Math.floor(index / 8)}-${index % 2 + 1}`, grade: ['B+', 'A', 'B+', 'C+', 'A', 'B'][index % 6], deletionEligibility: 'eligible' });
  }
  for (const [index, category] of profile.categories.filter(item => item.id.startsWith('ge-advanced-')).slice(0, 4).entries()) {
    courses.push({ id: `demo-general-${index}`, name: `[가상] ${category.label} 탐구`, categoryId: category.id, credits: 2, semester: '2025-2', grade: 'A', deletionEligibility: 'eligible' });
  }
  courses.push({ id: 'demo-failed', name: '[가상] 프로그래밍 응용', categoryId: 'primary-elective', credits: 3, semester: '2025-2', grade: 'F', deletionEligibility: 'eligible' });
  courses.push({ id: 'demo-pass', name: '[가상] 봉사 활동', categoryId: 'ge-activity', credits: 2, semester: '2025-2', grade: 'P', deletionEligibility: 'eligible' });
  const earnedGrades = new Set(GRADES.filter(grade => grade.earned).map(grade => grade.label));
  const baseline = courses.reduce((sum, course) => sum + (earnedGrades.has(course.grade) ? course.credits : 0), 0);
  const state = emptyState({ ...academic, baselineEarnedCredits: baseline });
  const planned = (index: number, categoryId: string, name: string, credits = 3, graded = true): PlannedCourse => ({ id: `demo-plan-${index}`, name: `[가상] ${name}`, categoryId, credits, graded });
  return {
    ...state, demo: true, courses, targetGpa: 3.5,
    semesters: [
      { id: 'demo-semester-1', label: '2026학년도 2학기', fixedTarget: null, courses: [planned(0, 'primary-elective', '전공 심화 프로젝트'), planned(1, 'primary-elective', '응용 컴퓨팅'), planned(2, 'primary-elective', '캡스톤 실습'), planned(3, 'general-free', '자유선택 탐구'), planned(4, 'ge-practical', '진로 설계', 2, false)] },
      { id: 'demo-semester-2', label: '2027학년도 1학기', fixedTarget: null, courses: [planned(5, 'primary-elective', '소프트웨어 실무'), planned(6, 'primary-elective', '시스템 프로젝트'), planned(7, 'primary-elective', '종합 설계'), planned(8, 'general-free', '융합 탐구')] },
    ],
  };
}
