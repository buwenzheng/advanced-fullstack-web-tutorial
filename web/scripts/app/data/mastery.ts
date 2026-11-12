import type { Catalog } from '../../content/catalog';
import { LEARNING_PATHS } from '../../content/paths';
import { store } from '../../state/store';
import type { ProgressState } from '../../state/store';
import { useProgress } from '../hooks/useProgress';
import { useCatalog } from './content';
import type { MasteryValue, MasteryView } from './types';

const EMPTY: MasteryValue = { done: 0, total: 0, percent: 0 };
const DEFAULT_PATH_ID = 'c';

function percent(done: number, total: number): number {
  return total ? Math.round((done / total) * 100) : 0;
}

export function masteryFromCatalog(
  catalog: Catalog,
  state: ProgressState,
  currentBlockId?: string,
): MasteryView {
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

  const activePath = state.meta.activePath ?? DEFAULT_PATH_ID;
  const path = LEARNING_PATHS.find((candidate) => candidate.id === activePath)
    ?? LEARNING_PATHS.find((candidate) => candidate.id === DEFAULT_PATH_ID)!;
  const pathLessonIds: string[] = [];
  path.steps.forEach((step) => {
    const block = catalog.stages.find((candidate) => candidate.id === step.blockId);
    const chapter = step.chapterId
      ? block?.chapters?.find((candidate) => candidate.id === step.chapterId)
      : null;
    const ids = chapter?.lessonIds
      ?? catalog.lessons.filter((lesson) => lesson.stageId === step.blockId).map((lesson) => lesson.id);
    ids.forEach((id) => {
      if (!pathLessonIds.includes(id)) pathLessonIds.push(id);
    });
  });

  const total = catalog.lessons.length;
  let done = 0;
  catalog.lessons.forEach((lesson) => {
    const mastered = lessonMastered(lesson.id);
    if (mastered) done += 1;
  });
  const nextOnPath = pathLessonIds.find((id) => !lessonMastered(id)) ?? null;
  const nextInBlock = currentBlockId
    ? catalog.lessons.find((lesson) => lesson.stageId === currentBlockId && !lessonMastered(lesson.id))?.id ?? null
    : null;
  const nextLessonId = nextOnPath
    ?? nextInBlock
    ?? catalog.lessons.find((lesson) => !lessonMastered(lesson.id))?.id
    ?? catalog.lessons[0]?.id
    ?? null;

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
    nextLessonId,
  };
}

export function useMastery(): MasteryView {
  useProgress();
  const catalog = useCatalog();
  return masteryFromCatalog(catalog, store.get());
}