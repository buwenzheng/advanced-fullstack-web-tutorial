import type { Lesson, Project, Stage } from '../../content/types';

export type Accent = 'teal' | 'amber' | 'violet' | 'rose' | 'blue' | 'green';

export interface StageSummary {
  id: string;
  index: number;
  title: string;
  subtitle: string;
  duration: number;
  appendix: boolean;
  accent: Accent;
  lessonCount: number;
  projectId: string | null;
  draftCount: number;
}

export interface LessonSummary {
  id: string;
  stageId: string;
  title: string;
  subtitle: string;
  duration: number;
  status: string;
  checks: number;
  exercises: number;
}

export interface LessonContext {
  lesson: Lesson;
  stage: Stage;
  prev: Lesson | null;
  next: Lesson | null;
}

export interface Stats {
  mainStageCount: number;
  lessonCount: number;
  taskCount: number;
}

export interface MasteryValue {
  done: number;
  total: number;
  percent: number;
}

export interface MasteryView {
  course: MasteryValue;
  stage(stageId: string): MasteryValue;
  lesson(lessonId: string): boolean;
  nextLessonId: string | null;
}

export type { Lesson, Project, Stage };
