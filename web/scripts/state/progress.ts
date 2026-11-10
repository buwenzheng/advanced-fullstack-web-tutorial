import { allLessons } from '../content/index';
import {
  courseMasteryLessons,
  nextLessonFrom,
  stageMasteryLessons,
} from './mastery-core.js';
import type { Mastery } from './mastery-core.js';
import type { Lesson, Stage } from '../content/types.js';

export {
  isLessonMastered,
  lessonTasks,
  taskSolved,
  trackId,
  trackSolved,
} from './mastery-core.js';
export type { Mastery, TrackableTask } from './mastery-core.js';

export function stageMastery(stage: Stage): Mastery {
  return stageMasteryLessons(stage.lessons);
}

export function courseMastery(): Mastery {
  return courseMasteryLessons(allLessons);
}

export function nextLesson(): Lesson | null {
  return nextLessonFrom(allLessons);
}
