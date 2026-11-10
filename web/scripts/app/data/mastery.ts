import type { Catalog } from '../../content/catalog';
import { store } from '../../state/store';
import type { ProgressState } from '../../state/store';
import { useProgress } from '../hooks/useProgress';
import { useCatalog } from './content';
import type { MasteryValue, MasteryView } from './types';

const EMPTY: MasteryValue = { done: 0, total: 0, percent: 0 };

function percent(done: number, total: number): number {
  return total ? Math.round((done / total) * 100) : 0;
}

export function masteryFromCatalog(catalog: Catalog, state: ProgressState): MasteryView {
  const tasksByLesson = new Map<string, Catalog['tasks'][number][]>();
  catalog.tasks.forEach((task) => {
    const list = tasksByLesson.get(task.lessonId) ?? [];
    list.push(task);
    tasksByLesson.set(task.lessonId, list);
  });

  const solved = (id: string) => Boolean(state.q[id]?.solved);
  const solvedPython = (id: string) => Boolean(state.q[`${id}@py`]?.solved);
  const lessonMastered = (lessonId: string): boolean => {
    if (state.l[lessonId]?.done) return true;
    const tasks = tasksByLesson.get(lessonId) ?? [];
    return tasks.length > 0 && tasks.every((task) => solved(task.id) || (task.python && solvedPython(task.id)));
  };

  const total = catalog.lessons.length;
  let done = 0;
  let nextLessonId: string | null = null;
  catalog.lessons.forEach((lesson) => {
    const mastered = lessonMastered(lesson.id);
    if (mastered) done += 1;
    else if (!nextLessonId) nextLessonId = lesson.id;
  });

  const stageValues = new Map<string, MasteryValue>();
  catalog.stages.forEach((stage) => {
    const lessons = catalog.lessons.filter((lesson) => lesson.stageId === stage.id);
    const stageDone = lessons.filter((lesson) => lessonMastered(lesson.id)).length;
    stageValues.set(stage.id, { done: stageDone, total: lessons.length, percent: percent(stageDone, lessons.length) });
  });

  return {
    course: { done, total, percent: percent(done, total) },
    stage: (stageId: string) => stageValues.get(stageId) ?? EMPTY,
    lesson: lessonMastered,
    nextLessonId: nextLessonId ?? catalog.lessons[0]?.id ?? null,
  };
}

export function useMastery(): MasteryView {
  useProgress();
  const catalog = useCatalog();
  return masteryFromCatalog(catalog, store.get());
}