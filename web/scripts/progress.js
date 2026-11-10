import { store } from './store.js';
import { allLessons } from './content/index.js';

export function lessonTasks(lesson) {
  return [...(lesson.checks || []), ...(lesson.exercises || [])];
}

export function trackId(task, language) {
  return language === 'python' ? `${task.id}@py` : task.id;
}

export function trackSolved(task, language) {
  return Boolean(store.answerOf(trackId(task, language))?.solved);
}

export function taskSolved(task) {
  if (store.answerOf(task.id)?.solved) return true;
  return Boolean(task.python) && trackSolved(task, 'python');
}

export function isLessonMastered(lesson) {
  if (store.lessonDone(lesson.id)) return true;
  const tasks = lessonTasks(lesson);
  if (!tasks.length) return false;
  return tasks.every(taskSolved);
}

export function stageMastery(stage) {
  const total = stage.lessons.length;
  const done = stage.lessons.filter(isLessonMastered).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function courseMastery() {
  const total = allLessons.length;
  const done = allLessons.filter(isLessonMastered).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function nextLesson() {
  return allLessons.find((lesson) => !isLessonMastered(lesson)) || allLessons[0] || null;
}
