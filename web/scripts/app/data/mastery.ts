import {
  courseMasteryLessons,
  isLessonMastered,
  nextLessonFrom,
  stageMasteryLessons,
} from '../../state/mastery-core';
import { useProgress } from '../hooks/useProgress';
import { getAllLessons, getStages } from './content';
import type { MasteryValue, MasteryView } from './types';

const EMPTY: MasteryValue = { done: 0, total: 0, percent: 0 };

export function useMastery(): MasteryView {
  useProgress();

  const lessons = getAllLessons();
  const stages = getStages();
  const stageValues = new Map(stages.map((stage) => [stage.id, stageMasteryLessons(stage.lessons)]));
  const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const next = nextLessonFrom(lessons);

  return {
    course: courseMasteryLessons(lessons),
    stage: (stageId: string) => stageValues.get(stageId) ?? EMPTY,
    lesson: (lessonId: string) => {
      const lesson = lessonById.get(lessonId);
      return lesson ? isLessonMastered(lesson) : false;
    },
    nextLessonId: next ? next.id : null,
  };
}
