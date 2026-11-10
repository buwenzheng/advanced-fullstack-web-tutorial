import { store } from './store.js';

export interface TrackableTask {
  id: string;
  python?: unknown;
}

export interface LessonLike {
  id: string;
  checks?: TrackableTask[];
  exercises?: TrackableTask[];
}

export interface Mastery {
  done: number;
  total: number;
  percent: number;
}

export function lessonTasks<T extends TrackableTask, U extends TrackableTask>(
  lesson: { checks?: T[]; exercises?: U[] },
): Array<T | U> {
  return [...(lesson.checks || []), ...(lesson.exercises || [])];
}

export function trackId(task: { id: string }, language: string): string {
  return language === 'python' ? `${task.id}@py` : task.id;
}

export function trackSolved(task: { id: string }, language: string): boolean {
  return Boolean(store.answerOf(trackId(task, language))?.solved);
}

export function taskSolved(task: TrackableTask): boolean {
  if (store.answerOf(task.id)?.solved) return true;
  return Boolean(task.python) && trackSolved(task, 'python');
}

export function isLessonMastered(lesson: LessonLike): boolean {
  if (store.lessonDone(lesson.id)) return true;
  const tasks = lessonTasks(lesson);
  if (!tasks.length) return false;
  return tasks.every((task) => taskSolved(task));
}

export function stageMasteryLessons(lessons: LessonLike[]): Mastery {
  const total = lessons.length;
  const done = lessons.filter((lesson) => isLessonMastered(lesson)).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function courseMasteryLessons(lessons: LessonLike[]): Mastery {
  const total = lessons.length;
  const done = lessons.filter((lesson) => isLessonMastered(lesson)).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function nextLessonFrom<T extends LessonLike>(lessons: T[]): T | null {
  return lessons.find((lesson) => !isLessonMastered(lesson)) || lessons[0] || null;
}
