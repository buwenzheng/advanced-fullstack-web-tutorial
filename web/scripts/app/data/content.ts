import { useMemo } from 'react';
import {
  allLessons,
  curriculum,
  findProject,
  graduationProject,
  lessonById,
  stageById,
} from '../../content/index';
import type {
  Accent,
  Lesson,
  LessonContext,
  LessonSummary,
  Project,
  Stage,
  StageSummary,
  Stats,
} from './types';

function toStageSummary(stage: Stage): StageSummary {
  return {
    id: stage.id,
    index: stage.index,
    title: stage.title,
    subtitle: stage.subtitle,
    duration: stage.duration,
    appendix: Boolean(stage.appendix),
    accent: stage.accent as Accent,
    lessonCount: stage.lessons.length,
    projectId: stage.project?.id ?? null,
    draftCount: stage.lessons.filter((lesson) => lesson.status !== 'ready').length,
  };
}

function toLessonSummary(lesson: Lesson): LessonSummary {
  return {
    id: lesson.id,
    stageId: lesson.stageId,
    title: lesson.title,
    subtitle: lesson.subtitle || '',
    duration: lesson.duration,
    status: lesson.status,
    checks: lesson.checks.length,
    exercises: lesson.exercises.length,
  };
}

export function getStages(): Stage[] {
  return curriculum;
}

export function getAllLessons(): Lesson[] {
  return allLessons;
}

export function useStageSummaries(): StageSummary[] {
  return useMemo(() => curriculum.map(toStageSummary), []);
}

export function useLessonSummaries(): LessonSummary[] {
  return useMemo(() => allLessons.map(toLessonSummary), []);
}

export function useStage(stageId: string): Stage | null {
  return useMemo(() => stageById(stageId), [stageId]);
}

export function useLesson(lessonId: string): LessonContext | null {
  return useMemo(() => {
    const lesson = lessonById(lessonId);
    if (!lesson) return null;
    const stage = stageById(lesson.stageId);
    if (!stage) return null;
    const index = stage.lessons.findIndex((item) => item.id === lesson.id);
    return {
      lesson,
      stage,
      prev: index > 0 ? stage.lessons[index - 1] ?? null : null,
      next: index >= 0 && index < stage.lessons.length - 1 ? stage.lessons[index + 1] ?? null : null,
    };
  }, [lessonId]);
}

export function useProject(projectId: string): Project | null {
  return useMemo(() => findProject(projectId), [projectId]);
}

export function useAllStages(): Stage[] {
  return useMemo(() => curriculum, []);
}

export function useGraduation(): Project {
  return useMemo(() => graduationProject, []);
}

export function useStats(): Stats {
  return useMemo(() => ({
    mainStageCount: curriculum.filter((stage) => !stage.appendix).length,
    lessonCount: allLessons.length,
    taskCount: allLessons.reduce(
      (sum, lesson) => sum + lesson.checks.length + lesson.exercises.length,
      0,
    ),
  }), []);
}
