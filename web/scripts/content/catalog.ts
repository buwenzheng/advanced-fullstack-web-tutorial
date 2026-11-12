import type { Chapter, Stage } from './types.js';

export interface CatalogStage {
  id: string;
  index: number;
  title: string;
  subtitle: string;
  duration: number;
  appendix: boolean;
  /** R1+：有则输出；旧 stage 内容可缺省 */
  kind?: Stage['kind'];
  chapterCount?: number;
  chapters?: Chapter[];
  lessonCount: number;
  projectId: string | null;
  projectIds?: string[];
  accent: Stage['accent'];
}

export interface CatalogLesson {
  id: string;
  stageId: string;
  title: string;
  subtitle: string;
  duration: number;
  status: string;
  keywords: string[];
  checks: number;
  exercises: number;
}

export interface CatalogProject {
  id: string;
  stageLabel: string;
  title: string;
  milestones: number;
}

export interface CatalogTask {
  id: string;
  kind: 'mcq' | 'code' | 'design' | 'sql';
  title: string;
  lessonId: string;
  stageId: string;
  python: boolean;
}

export interface Catalog {
  version: 1;
  stages: CatalogStage[];
  lessons: CatalogLesson[];
  projects: CatalogProject[];
  tasks: CatalogTask[];
}
