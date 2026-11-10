import { beforeEach, describe, expect, it, vi } from 'vitest';
import { allLessons } from '../content/index.js';
import { lang, LANGUAGES, languageLabel, languageMeta } from '../state/lang.js';
import {
  courseMastery,
  isLessonMastered,
  lessonTasks,
  nextLesson,
  stageMastery,
  taskSolved,
  trackId,
  trackSolved,
} from '../state/progress.js';
import { store } from '../state/store.js';
import type { Lesson, Stage } from '../content/types.js';

const fakeLesson = {
  id: 'fake-lesson',
  stageId: 's0',
  checks: [{ id: 'fake-c1', kind: 'mcq' }, { id: 'fake-c2', kind: 'mcq' }],
  exercises: [{ id: 'fake-e1', kind: 'code' }],
} as unknown as Lesson;

const fakeStage = {
  id: 'fake-stage',
  lessons: [{ id: 'fake-l1' }, { id: 'fake-l2' }],
} as unknown as Stage;

beforeEach(() => {
  localStorage.clear();
  store.reset();
});

describe('state progress', () => {
  it('lessonTasks 合并检查题与练习', () => {
    expect(lessonTasks(fakeLesson).map((task) => task.id)).toEqual(['fake-c1', 'fake-c2', 'fake-e1']);
    expect(lessonTasks({ ...fakeLesson, checks: [], exercises: [] } as unknown as Lesson)).toEqual([]);
  });

  it('@py 轨道独立计分', () => {
    expect(trackId({ id: 'task' }, 'javascript')).toBe('task');
    expect(trackId({ id: 'task' }, 'python')).toBe('task@py');
    expect(trackSolved({ id: 'task' }, 'python')).toBe(false);
    store.recordAnswer('task@py', [0], true);
    expect(trackSolved({ id: 'task' }, 'python')).toBe(true);
    expect(trackSolved({ id: 'task' }, 'javascript')).toBe(false);
    expect(taskSolved({ id: 'task', python: {} })).toBe(true);
  });

  it('所有题目解决或手工标记后课时掌握', () => {
    expect(isLessonMastered(fakeLesson)).toBe(false);
    store.recordAnswer('fake-c1', [0], true);
    store.recordAnswer('fake-c2', [0], true);
    expect(isLessonMastered(fakeLesson)).toBe(false);
    store.recordAnswer('fake-e1', [0], true);
    expect(isLessonMastered(fakeLesson)).toBe(true);

    store.reset();
    store.setLessonDone('fake-lesson', true);
    expect(isLessonMastered(fakeLesson)).toBe(true);
  });

  it('无题目的课时不会被自动判定掌握', () => {
    const empty = { id: 'empty', checks: [], exercises: [] } as unknown as Lesson;
    expect(isLessonMastered(empty)).toBe(false);
  });

  it('阶段与全课程掌握度', () => {
    expect(stageMastery(fakeStage)).toEqual({ done: 0, total: 2, percent: 0 });
    store.setLessonDone('fake-l1', true);
    expect(stageMastery(fakeStage)).toEqual({ done: 1, total: 2, percent: 50 });
    expect(stageMastery({ ...fakeStage, lessons: [] } as unknown as Stage)).toEqual({ done: 0, total: 0, percent: 0 });

    expect(courseMastery().total).toBe(45);
    expect(courseMastery().done).toBe(0);
    store.setLessonDone(allLessons[0]!.id, true);
    expect(courseMastery()).toMatchObject({ done: 1, total: 45 });
  });

  it('nextLesson 跳到第一个未掌握课时', () => {
    expect(nextLesson()!.id).toBe(allLessons[0]!.id);
    store.setLessonDone(allLessons[0]!.id, true);
    expect(nextLesson()!.id).toBe(allLessons[1]!.id);
  });

  it('语言轨道读写、订阅与元数据', () => {
    expect(LANGUAGES).toHaveLength(2);
    expect(lang.get()).toBe('javascript');
    const seen: string[] = [];
    const unsubscribe = lang.subscribe((value) => seen.push(value));
    lang.set('python');
    expect(lang.get()).toBe('python');
    expect(localStorage.getItem('bff-lab-lang-v1')).toBe('python');
    lang.set('python');
    lang.set('rust' as never);
    expect(seen).toEqual(['python']);
    unsubscribe();
    lang.set('javascript');
    expect(seen).toEqual(['python']);
    expect(lang.get()).toBe('javascript');

    expect(languageLabel('python')).toBe('Python');
    expect(languageLabel('custom')).toBe('custom');
    expect(languageMeta('python').short).toBe('Python');
    expect(languageMeta('custom').id).toBe('javascript');
  });

  it('语言写入失败保留内存态', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    lang.set('python');
    expect(lang.get()).toBe('python');
    spy.mockRestore();
    lang.set('javascript');
  });

  it('语言读取失败回退 javascript', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.resetModules();
    const reloaded = await import('../state/lang.js');
    expect(reloaded.lang.get()).toBe('javascript');
    spy.mockRestore();
  });
});
