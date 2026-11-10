import { use, useMemo } from 'react';
import type { Catalog, CatalogLesson, CatalogStage } from '../../content/catalog';
import {
  loadAllStages,
  loadCatalog,
  loadGraduation,
  loadLessonContext,
  loadProject,
  loadStage,
} from './resources';
import type {
  Accent,
  LessonContext,
  LessonSummary,
  Project,
  Stage,
  StageSummary,
  Stats,
} from './types';

export function useCatalog(): Catalog {
  return use(loadCatalog());
}

function toStageSummary(stage: CatalogStage, draftCount: number): StageSummary {
  return {
    id: stage.id,
    index: stage.index,
    title: stage.title,
    subtitle: stage.subtitle,
    duration: stage.duration,
    appendix: Boolean(stage.appendix),
    accent: stage.accent as Accent,
    lessonCount: stage.lessonCount,
    projectId: stage.projectId,
    draftCount,
  };
}

function toLessonSummary(lesson: CatalogLesson): LessonSummary {
  return {
    id: lesson.id,
    stageId: lesson.stageId,
    title: lesson.title,
    subtitle: lesson.subtitle,
    duration: lesson.duration,
    status: lesson.status,
    checks: lesson.checks,
    exercises: lesson.exercises,
  };
}

export function useStageSummaries(): StageSummary[] {
  const catalog = useCatalog();
  return useMemo(() => {
    const drafts = new Map<string, number>();
    catalog.lessons.forEach((lesson) => {
      if (lesson.status !== 'ready') drafts.set(lesson.stageId, (drafts.get(lesson.stageId) ?? 0) + 1);
    });
    return catalog.stages.map((stage) => toStageSummary(stage, drafts.get(stage.id) ?? 0));
  }, [catalog]);
}

export function useLessonSummaries(): LessonSummary[] {
  const catalog = useCatalog();
  return useMemo(() => catalog.lessons.map(toLessonSummary), [catalog]);
}

export function useStage(stageId: string): Stage | null {
  return use(loadStage(stageId));
}

export function useLesson(lessonId: string): LessonContext | null {
  return use(loadLessonContext(lessonId));
}

export function useProject(projectId: string): Project | null {
  return use(loadProject(projectId));
}

export function useAllStages(): Stage[] {
  return use(loadAllStages());
}

export function useGraduation(): Project {
  return use(loadGraduation());
}

export function useGraduationId(): string | null {
  const catalog = useCatalog();
  return catalog.projects.find((project) => project.stageLabel === '毕业项目')?.id ?? null;
}

export function useStats(): Stats {
  const catalog = useCatalog();
  return useMemo(
    () => ({
      mainStageCount: catalog.stages.filter((stage) => !stage.appendix).length,
      lessonCount: catalog.lessons.length,
      taskCount: catalog.tasks.length,
    }),
    [catalog],
  );
}
