import { z } from 'zod';
import { LEARNING_PATHS } from './paths.js';

const nonEmpty = z.string().min(1);

export const manifestLessonSchema = z.strictObject({
  id: nonEmpty,
  /** R2 起 id 为新语义；legacyId 保留旧 ID 供迁移/重定向 */
  legacyId: nonEmpty.optional(),
  /** @deprecated R1 过渡字段；R2 flip 后删除 */
  newId: nonEmpty.optional(),
  duration: z.number().int().positive(),
});

export const manifestChapterSchema = z.strictObject({
  id: nonEmpty,
  title: nonEmpty,
  lessonIds: z.array(nonEmpty).min(1),
});

export const manifestBlockSchema = z.strictObject({
  id: nonEmpty,
  kind: z.enum(['required', 'elective', 'toolbox']),
  title: nonEmpty,
  duration: z.number().int().positive(),
  chapters: z.array(manifestChapterSchema).default([]),
  lessons: z.array(manifestLessonSchema).min(1),
  projects: z.array(nonEmpty).default([]),
});

export const manifestPathStepSchema = z.strictObject({
  blockId: nonEmpty,
  chapterId: nonEmpty.optional(),
});

export const manifestPathSchema = z.strictObject({
  id: z.enum(['a', 'b', 'c', 'd']),
  title: nonEmpty,
  blurb: nonEmpty.optional(),
  steps: z.array(manifestPathStepSchema).min(1),
});

export const contentManifestSchema = z.strictObject({
  version: z.literal(3),
  paths: z.array(manifestPathSchema).length(4),
  blocks: z.array(manifestBlockSchema).min(1),
  toolbox: z.strictObject({
    id: z.literal('b'),
    groups: z.array(nonEmpty).min(1),
  }),
  capstone: z.strictObject({
    id: nonEmpty,
    legacyId: nonEmpty,
    milestones: z.number().int().positive().optional(),
  }),
  totals: z.strictObject({
    lessons: z.number().int().positive(),
    minutes: z.number().int().positive(),
    /** 非 toolbox（主修+选修）分钟，兼容旧口径 coreMinutes */
    coreMinutes: z.number().int().nonnegative(),
    /** toolbox 分钟，兼容旧口径 appendixMinutes */
    appendixMinutes: z.number().int().nonnegative(),
    requiredMinutes: z.number().int().nonnegative().optional(),
    electiveMinutes: z.number().int().nonnegative().optional(),
  }),
});

export type ContentManifestV3 = z.infer<typeof contentManifestSchema>;
export type ManifestBlock = z.infer<typeof manifestBlockSchema>;
export type ManifestLessonRef = z.infer<typeof manifestLessonSchema>;

export function parseContentManifest(value: unknown): ContentManifestV3 {
  return contentManifestSchema.parse(value);
}

export function tryParseContentManifest(value: unknown): ContentManifestV3 | null {
  const result = contentManifestSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function flattenManifestLessons(doc: ContentManifestV3): ManifestLessonRef[] {
  return doc.blocks.flatMap((block) => block.lessons);
}

export function manifestLessonMap(doc: ContentManifestV3): Map<string, ManifestLessonRef & { blockId: string }> {
  const map = new Map<string, ManifestLessonRef & { blockId: string }>();
  for (const block of doc.blocks) {
    for (const lesson of block.lessons) {
      map.set(lesson.id, { ...lesson, blockId: block.id });
    }
  }
  return map;
}

/** 校验 paths.ts 与清单 paths 的 block/chapter 引用 */
export function assertPathsAgainstBlocks(doc: ContentManifestV3): string[] {
  const errors: string[] = [];
  const blockById = new Map(doc.blocks.map((block) => [block.id, block]));
  const pathSources = [
    ...doc.paths.map((path) => ({ source: `manifest.paths.${path.id}`, steps: path.steps })),
    ...LEARNING_PATHS.map((path) => ({
      source: `paths.ts.${path.id}`,
      steps: path.steps.map((step) => ({ blockId: step.blockId, chapterId: step.chapterId })),
    })),
  ];

  for (const { source, steps } of pathSources) {
    for (const step of steps) {
      if (step.blockId === 'x' || step.blockId === doc.capstone.id) continue;
      const block = blockById.get(step.blockId);
      if (!block) {
        errors.push(`${source}: 未知 blockId ${step.blockId}`);
        continue;
      }
      if (step.chapterId) {
        const chapter = block.chapters.find((entry) => entry.id === step.chapterId);
        if (!chapter) errors.push(`${source}: block ${step.blockId} 无 chapter ${step.chapterId}`);
      }
    }
  }
  return errors;
}
