import { useMemo } from 'react';
import { LEARNING_PATHS } from '../../content/paths';
import type { LearningPath } from '../../content/types';
import { useCatalog } from './content';
import type { BlockSummary, LessonSummary } from './types';

export type PathId = LearningPath['id'];

export const DEFAULT_PATH_ID: PathId = 'c';
export const GRADUATION_PROJECT_ID = 'x-linkhub';

/**
 * 学员可见结业声明逐字消费 R3 path-completion-map；这里不推导或扩写结业条件。
 */
export const PATH_COMPLETION_COPY: Readonly<Record<PathId, string>> = Object.freeze({
  a: '能独立交付可上线、可观测且可回滚的 API。',
  b: '能从可信 API 端到端交付用户可见产品。',
  c: '能交付可评估、可降级、可安全协作的 AI 全栈产品。',
  d: '能解释拆分代价，交付最终一致统计，并以 ADR 与答辩证据证明取舍。',
});

export function usePaths(): readonly LearningPath[] {
  return LEARNING_PATHS;
}

export function useBlocks(): BlockSummary[] {
  const catalog = useCatalog();
  return useMemo(() => catalog.stages.map((stage) => ({
    id: stage.id,
    index: stage.index,
    title: stage.title,
    subtitle: stage.subtitle,
    duration: stage.duration,
    appendix: stage.appendix,
    accent: stage.accent,
    lessonCount: stage.lessonCount,
    projectId: stage.projectId,
    projectIds: stage.projectIds ?? (stage.projectId ? [stage.projectId] : []),
    draftCount: catalog.lessons.filter(
      (lesson) => lesson.stageId === stage.id && lesson.status !== 'ready',
    ).length,
    kind: stage.kind ?? (stage.appendix ? 'toolbox' : 'required'),
    chapters: stage.chapters ?? [],
  })), [catalog]);
}

export function lessonIdsForPath(
  pathId: PathId,
  lessons: readonly LessonSummary[],
  blocks: readonly BlockSummary[],
): string[] {
  const path = LEARNING_PATHS.find((candidate) => candidate.id === pathId)
    ?? LEARNING_PATHS.find((candidate) => candidate.id === DEFAULT_PATH_ID)!;
  const byBlock = new Map(blocks.map((block) => [block.id, block]));
  const ids: string[] = [];
  for (const step of path.steps) {
    const block = byBlock.get(step.blockId);
    const chapter = step.chapterId
      ? block?.chapters.find((candidate) => candidate.id === step.chapterId)
      : null;
    const stepIds = chapter?.lessonIds
      ?? lessons.filter((lesson) => lesson.stageId === step.blockId).map((lesson) => lesson.id);
    for (const id of stepIds) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}
