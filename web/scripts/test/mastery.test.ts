import { beforeEach, describe, expect, it } from 'vitest';
import { masteryFromCatalog } from '../app/data/mastery';
import { loadCatalog } from '../app/data/resources';
import { curriculum } from '../content/index';
import {
  courseMasteryLessons,
  isLessonMastered,
  nextLessonFrom,
  stageMasteryLessons,
} from '../state/mastery-core';
import { store } from '../state/store';

const allLessons = curriculum.flatMap((stage) => stage.lessons);

async function assertEquivalent(): Promise<void> {
  const catalog = await loadCatalog();
  const view = masteryFromCatalog(catalog, store.get());

  for (const lesson of allLessons) {
    expect(view.lesson(lesson.id), `lesson ${lesson.id}`).toBe(isLessonMastered(lesson));
  }
  for (const stage of curriculum) {
    expect(view.stage(stage.id), `stage ${stage.id}`).toEqual(stageMasteryLessons(stage.lessons));
  }
  expect(view.course).toEqual(courseMasteryLessons(allLessons));
  expect(view.nextLessonId).toBe(nextLessonFrom(allLessons)?.id ?? allLessons[0]?.id ?? null);
}

beforeEach(() => {
  localStorage.clear();
  store.reset();
});

describe('catalog 掌握度与 mastery-core 等价', () => {
  it('空进度：45 讲逐讲一致，课程/阶段/下一讲一致', async () => {
    await assertEquivalent();
  });

  it('仅手动标记课时：lessonDone 短路生效', async () => {
    store.setLessonDone('s2-l1', true);
    store.setLessonDone('appendix-l1', true);
    await assertEquivalent();

    const catalog = await loadCatalog();
    const view = masteryFromCatalog(catalog, store.get());
    expect(view.lesson('s2-l1')).toBe(true);
    expect(view.lesson('appendix-l1')).toBe(true);
  });

  it('完成某讲全部题目后视为掌握', async () => {
    const lesson = allLessons[0]!;
    [...lesson.checks, ...lesson.exercises].forEach((task) => store.recordAnswer(task.id, [], true));
    await assertEquivalent();

    const catalog = await loadCatalog();
    expect(masteryFromCatalog(catalog, store.get()).lesson(lesson.id)).toBe(true);
  });

  it('部分完成不视为掌握', async () => {
    const lesson = allLessons[0]!;
    store.recordAnswer(lesson.checks[0]!.id, [], true);
    await assertEquivalent();

    const catalog = await loadCatalog();
    expect(masteryFromCatalog(catalog, store.get()).lesson(lesson.id)).toBe(false);
  });

  it('Python 轨道题只能通过 @py 计分，脏 @py 不计入非 Python 题', async () => {
    const pythonLesson = allLessons.find((lesson) => lesson.exercises.some(
      (exercise) => exercise.kind === 'code' && Boolean(exercise.python),
    ))!;
    pythonLesson.checks.forEach((check) => store.recordAnswer(check.id, [], true));
    pythonLesson.exercises.forEach((exercise) => {
      const isPython = exercise.kind === 'code' && Boolean(exercise.python);
      store.recordAnswer(isPython ? `${exercise.id}@py` : exercise.id, [], true);
    });

    const plainLesson = allLessons.find((lesson) => lesson.id !== pythonLesson.id)!;
    const plainTask = plainLesson.checks[0]!;
    store.recordAnswer(`${plainTask.id}@py`, [], true);

    await assertEquivalent();

    const catalog = await loadCatalog();
    const view = masteryFromCatalog(catalog, store.get());
    expect(view.lesson(pythonLesson.id)).toBe(true);
    expect(view.lesson(plainLesson.id)).toBe(false);
  });

  it('混合进度：阶段与课程汇总、下一讲定位一致', async () => {
    store.setLessonDone('s0-l1', true);
    const s2 = curriculum.find((stage) => stage.id === 's2')!;
    const s2Lesson = s2.lessons[0]!;
    s2Lesson.checks.forEach((check) => store.recordAnswer(check.id, [], true));
    s2Lesson.exercises.slice(0, 1).forEach((exercise) => store.recordAnswer(exercise.id, [], true));

    await assertEquivalent();

    const catalog = await loadCatalog();
    const view = masteryFromCatalog(catalog, store.get());
    expect(view.nextLessonId).toBe('s0-l2');
    expect(view.stage(s2.id).done).toBe(0);
  });
});