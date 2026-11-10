import type { Stage } from './types.js';

export interface CatalogStage {
  id: string;
  index: number;
  title: string;
  subtitle: string;
  duration: number;
  appendix: boolean;
  lessonCount: number;
  projectId: string | null;
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
