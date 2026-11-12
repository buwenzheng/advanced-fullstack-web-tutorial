import catalogData from '../../generated/catalog.json';
import {
  BLOCK_ID_MAP,
  invertMap,
  LESSON_ID_MAP,
  PROJECT_ID_MAP,
  remapId,
} from '../content/id-map.js';
import type { Catalog } from '../content/catalog.js';

const catalog = catalogData as unknown as Catalog;

const LESSON_IDS = new Set(catalog.lessons.map((lesson) => lesson.id));
const STAGE_IDS = new Set(catalog.stages.map((stage) => stage.id));
const PROJECT_IDS = new Set([
  ...catalog.projects.map((project) => project.id),
  ...catalog.stages.flatMap((stage) => stage.projectIds ?? (stage.projectId ? [stage.projectId] : [])),
]);

const LEGACY_LESSON_TO_NEW = LESSON_ID_MAP;
const LEGACY_PROJECT_TO_NEW = PROJECT_ID_MAP;
const LEGACY_STAGE_TO_NEW = BLOCK_ID_MAP;

/** 新 ID → 旧 ID（仅用于文档/调试；路由用正向 remap） */
export const NEW_LESSON_TO_LEGACY = invertMap(LESSON_ID_MAP);

function hasLesson(id: string): boolean {
  return LESSON_IDS.has(id);
}

function hasProject(id: string): boolean {
  return PROJECT_IDS.has(id);
}

function hasStage(id: string): boolean {
  return STAGE_IDS.has(id);
}

/**
 * 旧书签 → 新课时 ID。仅当目标存在于 catalog 时返回，避免半截迁移 404。
 * 注意：禁止依赖 content/index（会把全部 stage 打进入口包）。
 */
export function resolveLessonRedirect(lessonId: string): string | null {
  if (!lessonId || hasLesson(lessonId)) return null;
  const mapped = remapId(lessonId);
  if (mapped !== lessonId && hasLesson(mapped)) return mapped;
  const fromTable = LEGACY_LESSON_TO_NEW[lessonId];
  if (fromTable && hasLesson(fromTable)) return fromTable;
  return null;
}

export function resolveProjectRedirect(projectId: string): string | null {
  if (!projectId || hasProject(projectId)) return null;
  const mapped = remapId(projectId);
  if (mapped !== projectId && hasProject(mapped)) return mapped;
  const fromTable = LEGACY_PROJECT_TO_NEW[projectId];
  if (fromTable && hasProject(fromTable)) return fromTable;
  return null;
}

/**
 * 旧阶段目录跳转到合并后的内容块；仅当目标 stage 已存在时才跳转。
 */
export function resolveStageRedirect(stageId: string): string | null {
  if (!stageId || hasStage(stageId)) return null;
  const mapped = remapId(stageId);
  if (mapped !== stageId && hasStage(mapped)) return mapped;
  const fromTable = LEGACY_STAGE_TO_NEW[stageId];
  if (fromTable && hasStage(fromTable)) return fromTable;
  return null;
}
