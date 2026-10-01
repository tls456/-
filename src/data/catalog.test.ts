import { describe, expect, it } from 'vitest';
import {
  DEPARTMENT_CURRICULA,
  GENERAL_EDUCATION_BY_YEAR,
  SUPPORTED_YEARS,
  getDepartmentCurriculum,
  getDepartmentsForYear,
} from './catalog';
import { REQUIRED_COURSES_BY_YEAR } from './required-courses';

describe('official GLOCAL curriculum corpus', () => {
  it('covers the seven supported admission years and every total-table row', () => {
    expect(SUPPORTED_YEARS).toEqual([2020,2021,2022,2023,2024,2025,2026]);
    expect(DEPARTMENT_CURRICULA).toHaveLength(225);
    expect(SUPPORTED_YEARS.map((year) => getDepartmentsForYear(year).length)).toEqual([27,28,30,30,36,36,38]);
    expect(new Set(DEPARTMENT_CURRICULA.map((d) => `${d.year}:${d.departmentId}`)).size).toBe(225);
  });

  it('preserves all verified computer engineering curriculum changes', () => {
    const expected = [
      [2020,35,18,48,4,1], [2021,35,15,51,5,0], [2022,35,15,51,5,0],
      [2023,35,15,51,5,0], [2024,35,12,54,4,0], [2025,31,3,63,1,0], [2026,31,3,63,1,0],
    ];
    for (const [year,general,required,elective,courseCount,groupCount] of expected) {
      const d = getDepartmentCurriculum('computer',year)!;
      expect(d, `${year} computer`).toMatchObject({totalCredits:132,generalCredits:general,majorRequiredCredits:required,majorElectiveCredits:elective,majorCredits:66,doubleMajorCredits:40});
      expect(d.requiredCourses).toHaveLength(courseCount);
      expect(d.requiredCourseGroups).toHaveLength(groupCount);
      expect(d.unknownReasons).toEqual([]);
    }
    expect(getDepartmentCurriculum('computer',2020)?.name).toBe('소프트웨어전공');
    expect(getDepartmentCurriculum('computer',2025)?.requiredCourses.map((c) => c.code)).toEqual(['NDGE15060']);
  });

  it('reconciles explicit and choose-N mandatory courses against official credit totals', () => {
    const conflicts: {year:number;name:string;tableCredits:number;courseCredits:number}[] = [];
    for (const d of DEPARTMENT_CURRICULA) {
      const choices = new Map(d.requiredCourseChoices.map((c) => [c.code,c]));
      const selectedCredits = d.requiredCourseGroups.reduce((sum,g) => {
        const possibleCredits = new Set(g.codes.map((code) => choices.get(code)?.credits));
        expect(possibleCredits.size, `${d.year} ${d.name} ${g.id}: uniform choice credits`).toBe(1);
        expect(choices.get(g.codes[0]), `${d.year} ${d.name} ${g.id}: choice exists`).toBeDefined();
        return sum + choices.get(g.codes[0])!.credits * g.minCount;
      },0);
      const actual = d.requiredCourses.reduce((sum,c) => sum+c.credits,0)+selectedCredits;
      expect(d.majorRequiredCredits+d.majorElectiveCredits, `${d.year} ${d.name}: major split`).toBe(d.majorCredits);
      if (actual !== d.majorRequiredCredits) conflicts.push({year:d.year,name:d.name,tableCredits:d.majorRequiredCredits,courseCredits:actual});
    }
    // The official 2020 summary and department tables conflict; never silently normalize either.
    expect(conflicts).toEqual([{year:2020,name:'패션디자인전공',tableCredits:2,courseCredits:14}]);
    expect(getDepartmentCurriculum('패션디자인전공',2020)?.unknownReasons.join(' ')).toContain('총괄표');
  });

  it('keeps common mandatory credits and choice groups distinct from each other', () => {
    const cs = getDepartmentCurriculum('computer',2020)!;
    expect(cs.commonRequiredCredits).toBe(6);
    expect(cs.requiredCourseGroups).toEqual([{id:'ict-common-two',label:'ICT융합공학부 공통필수 3과목 중 2과목',codes:['NDFA57957','NDFA15312','NDFA11989'],minCount:2}]);
    expect(cs.requiredCourseChoices.every((c) => c.category === 'major-common')).toBe(true);
    expect(getDepartmentCurriculum('경영학과',2021)?.requiredCourseGroups[0]).toMatchObject({minCount:4});
    expect(getDepartmentCurriculum('생명공학과',2022)?.requiredCourseGroups.map((g) => g.minCount)).toEqual([2,1]);
    expect(getDepartmentCurriculum('생명공학과',2023)?.requiredCourseGroups.map((g) => g.minCount)).toEqual([1]);
    expect(DEPARTMENT_CURRICULA.reduce((sum,d) => sum+d.requiredCourseGroups.length,0)).toBe(11);
  });

  it('contains unique, well-formed mandatory codes and fully named group choices', () => {
    for (const d of DEPARTMENT_CURRICULA) {
      const courses = [...d.requiredCourses,...d.requiredCourseChoices];
      expect(new Set(courses.map((c) => c.code)).size, `${d.year} ${d.name}: duplicate course`).toBe(courses.length);
      for (const c of courses) {
        expect(c.code).toMatch(/^[A-Z]{4}\d{5}$/);
        expect(c.name.trim().length).toBeGreaterThan(0);
        expect(c.name).not.toMatch(/전필|전선|학수번호/);
        expect(c.credits).toBeGreaterThan(0);
      }
      for (const g of d.requiredCourseGroups) {
        expect(g.minCount).toBeGreaterThan(0);
        expect(g.minCount).toBeLessThanOrEqual(g.codes.length);
        expect(g.codes.every((code) => d.requiredCourseChoices.some((c) => c.code === code))).toBe(true);
      }
    }
  });

  it('retains a source page for every extracted mandatory course and its curriculum', () => {
    for (const d of DEPARTMENT_CURRICULA) {
      const raw = Object.values(REQUIRED_COURSES_BY_YEAR[d.year]).flat();
      for (const c of d.requiredCourses) {
        const original = raw.find(([code]) => code === c.code);
        expect(original, `${d.year} ${d.name} ${c.code}: source row`).toBeDefined();
        expect(d.sources.some((s) => s.pdfPage === original![3])).toBe(true);
      }
      for (const s of d.sources) {
        expect(s.url).toContain('www.kku.ac.kr');
        expect(s.pdfPage).toBeGreaterThan(0);
        expect(s.printedPage).toBeGreaterThan(0);
        expect(s.pdfPage).toBeGreaterThan(s.printedPage);
      }
    }
  });

  it('does not turn unavailable double-major credits into a guessed number', () => {
    for (const year of SUPPORTED_YEARS) {
      expect(getDepartmentCurriculum('유아교육과',year)?.doubleMajorCredits).toBeNull();
      expect(getDepartmentCurriculum('간호학과',year)?.doubleMajorCredits).toBeNull();
    }
    expect(getDepartmentCurriculum('경영학과',2026)?.doubleMajorCredits).toBe(45);
    expect(getDepartmentCurriculum('computer',2019)).toBeUndefined();
  });

  it('preserves the 2025 general-education change and four-area breadth requirement', () => {
    for (const year of SUPPORTED_YEARS) {
      const general = GENERAL_EDUCATION_BY_YEAR[year];
      expect(general.totalCredits).toBe(year >= 2025 ? 31 : 35);
      expect(general.coreCredits).toBe(year >= 2025 ? 14 : 18);
      expect(general.advancedCredits).toBe(8);
      expect(general.advancedMinimumAreaCount).toBe(4);
      expect(general.areas.some((a) => a.id === 'ge-ai')).toBe(year >= 2025);
    }
  });
});
