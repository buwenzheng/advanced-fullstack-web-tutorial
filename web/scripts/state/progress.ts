import { store } from './store.js';
import { allLessons } from '../content/index';
import type { Check, Exercise, Lesson, Stage } from '../content/types.js';
import type { LanguageId } from './lang.js';

export interface TrackableTask {
  id: string;
  python?: unknown;
}

export function lessonTasks(lesson: Lesson): Array<Check | Exercise> {
  return [...(lesson.checks || []), ...(lesson.exercises || [])];
}

export function trackId(task: { id: string }, language: LanguageId): string {
  return language === 'python' ? `${task.id}@py` : task.id;
}

export function trackSolved(task: { id: string }, language: LanguageId): boolean {
  return Boolean(store.answerOf(trackId(task, language))?.solved);
}

export function taskSolved(task: TrackableTask): boolean {
  if (store.answerOf(task.id)?.solved) return true;
  return Boolean(task.python) && trackSolved(task, 'python');
}

export function isLessonMastered(lesson: Lesson): boolean {
  if (store.lessonDone(lesson.id)) return true;
  const tasks = lessonTasks(lesson);
  if (!tasks.length) return false;
  return tasks.every((task) => taskSolved(task));
}

export interface Mastery {
  done: number;
  total: number;
  percent: number;
}

export function stageMastery(stage: Stage): Mastery {
  const total = stage.lessons.length;
  const done = stage.lessons.filter((lesson) => isLessonMastered(lesson)).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function courseMastery(): Mastery {
  const total = allLessons.length;
  const done = allLessons.filter((lesson) => isLessonMastered(lesson)).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function nextLesson(): Lesson | null {
  return allLessons.find((lesson) => !isLessonMastered(lesson)) || allLessons[0] || null;
}
