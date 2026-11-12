import { z } from 'zod';

const nonEmpty = z.string().min(1);
const testCaseSchema = z.strictObject({ name: nonEmpty, code: nonEmpty, async: z.boolean().optional() });
const pythonTrackSchema = z.strictObject({
  starter: nonEmpty,
  solution: nonEmpty,
  tests: z.array(testCaseSchema).min(1),
});

const textSchema = z.strictObject({
  type: z.literal('text'),
  title: nonEmpty,
  html: nonEmpty,
  note: nonEmpty.optional(),
});
const analogySchema = z.strictObject({
  type: z.literal('analogy'),
  title: nonEmpty,
  html: nonEmpty,
});
const pitfallSchema = z.strictObject({
  type: z.literal('pitfall'),
  title: nonEmpty,
  html: nonEmpty,
});
const noteSchema = z.strictObject({ type: z.literal('note'), title: nonEmpty, html: nonEmpty });
const tipSchema = z.strictObject({ type: z.literal('tip'), title: nonEmpty, html: nonEmpty });
const listSchema = z.strictObject({
  type: z.literal('list'),
  title: nonEmpty,
  items: z.array(nonEmpty).min(1),
  ordered: z.boolean().optional(),
});
const stepsSchema = z.strictObject({
  type: z.literal('steps'),
  title: nonEmpty,
  steps: z
    .array(
      z.strictObject({
        title: nonEmpty,
        html: nonEmpty,
        code: nonEmpty.optional(),
        note: nonEmpty.optional(),
      }),
    )
    .min(1),
});
const codeSchema = z.strictObject({
  type: z.literal('code'),
  title: nonEmpty,
  lang: z.enum(['javascript', 'bash', 'sql', 'dockerfile']),
  code: nonEmpty,
  note: nonEmpty,
  python: nonEmpty.optional(),
  pythonNote: nonEmpty.optional(),
});
const tableSchema = z.strictObject({
  type: z.literal('table'),
  title: nonEmpty,
  head: z.array(nonEmpty).min(1),
  rows: z.array(z.array(z.string())).min(1),
  note: nonEmpty.optional(),
});
const compareSchema = z.strictObject({
  type: z.literal('compare'),
  title: nonEmpty,
  cols: z
    .array(z.strictObject({ title: nonEmpty, items: z.array(nonEmpty).min(1) }))
    .min(2),
  note: nonEmpty.optional(),
});
const flowSchema = z.strictObject({
  type: z.literal('flow'),
  title: nonEmpty,
  steps: z
    .array(
      z.strictObject({
        name: nonEmpty,
        detail: nonEmpty,
        body: nonEmpty.optional(),
      }),
    )
    .min(1),
});
const caseSchema = z.strictObject({
  type: z.literal('case'),
  title: nonEmpty,
  context: nonEmpty,
  symptom: nonEmpty,
  cause: nonEmpty,
  fix: nonEmpty,
  prevention: nonEmpty,
  metric: nonEmpty.optional(),
});

export const blockSchema = z.discriminatedUnion('type', [
  textSchema,
  analogySchema,
  pitfallSchema,
  noteSchema,
  tipSchema,
  listSchema,
  stepsSchema,
  codeSchema,
  tableSchema,
  compareSchema,
  flowSchema,
  caseSchema,
]);

const optionSchema = z.strictObject({ text: nonEmpty, correct: z.boolean() });
export const checkSchema = z.strictObject({
  id: nonEmpty,
  kind: z.literal('mcq'),
  type: z.enum(['single', 'multi']),
  tag: nonEmpty,
  prompt: nonEmpty,
  question: nonEmpty,
  options: z.array(optionSchema).min(2),
  explain: nonEmpty,
});

const exerciseBase = { id: nonEmpty, title: nonEmpty };
const codeExerciseSchema = z.strictObject({
  ...exerciseBase,
  kind: z.literal('code'),
  brief: nonEmpty,
  hint: nonEmpty,
  starter: nonEmpty,
  solution: nonEmpty,
  tests: z.array(testCaseSchema).min(1),
  python: pythonTrackSchema.optional(),
});
const designExerciseSchema = z.strictObject({
  ...exerciseBase,
  kind: z.literal('design'),
  brief: nonEmpty.optional(),
  prompt: nonEmpty.optional(),
  checklist: z.array(nonEmpty).min(1),
  reference: nonEmpty,
  specs: z.array(z.strictObject({ label: nonEmpty, value: nonEmpty })).min(1).optional(),
});
const sqlValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const sqlRowSchema = z.record(z.string(), sqlValueSchema);
const sqlExerciseSchema = z.strictObject({
  ...exerciseBase,
  kind: z.literal('sql'),
  brief: nonEmpty,
  hint: nonEmpty,
  tables: z.record(z.string(), z.array(sqlRowSchema)),
  query: nonEmpty,
  expected: z.array(sqlRowSchema),
  solution: nonEmpty,
});
export const exerciseSchema = z.discriminatedUnion('kind', [
  codeExerciseSchema,
  designExerciseSchema,
  sqlExerciseSchema,
]);

export const lessonSchema = z.strictObject({
  id: nonEmpty,
  title: nonEmpty,
  subtitle: nonEmpty,
  duration: z.number().int().positive(),
  status: z.literal('ready'),
  objectives: z.array(nonEmpty).min(1),
  keywords: z.array(nonEmpty).min(1),
  blocks: z.array(blockSchema).min(1),
  checks: z.array(checkSchema).length(3),
  exercises: z.array(exerciseSchema).min(1).max(3),
});

const milestoneSchema = z.strictObject({
  id: nonEmpty,
  title: nonEmpty,
  desc: nonEmpty,
  criteria: nonEmpty,
  group: nonEmpty.optional(),
  delivery: nonEmpty.optional(),
  acceptance: z.array(nonEmpty).min(1).optional(),
  evidence: z.array(nonEmpty).min(1).optional(),
  reuse: z.array(nonEmpty).min(1).optional(),
  related: z.array(nonEmpty).min(1).optional(),
});
const templateSchema = z.strictObject({
  id: nonEmpty,
  title: nonEmpty,
  purpose: nonEmpty,
  when: nonEmpty,
  body: nonEmpty,
});
export const projectSchema = z.strictObject({
  id: nonEmpty,
  stageLabel: nonEmpty,
  title: nonEmpty,
  brief: nonEmpty,
  goal: nonEmpty,
  prerequisites: z.array(nonEmpty).min(1),
  nonGoals: z.array(nonEmpty).min(1),
  xRelation: nonEmpty,
  stack: z.array(nonEmpty).min(1),
  steps: z.array(nonEmpty).min(1),
  milestones: z.array(milestoneSchema).min(1),
  deliverables: z.array(nonEmpty).min(1),
  checklist: z.array(nonEmpty).min(1),
  stretch: z.array(nonEmpty).min(1),
  completionTiers: z.array(z.strictObject({
    id: nonEmpty,
    title: nonEmpty,
    milestoneIds: z.array(nonEmpty).min(1),
    note: nonEmpty,
  })).min(1).optional(),
  templates: z.array(templateSchema).min(1).optional(),
});

/** 大块内章节（M2/M3/M4/B）；R1 起可选，内容文件可暂不填 */
export const chapterSchema = z.strictObject({
  id: nonEmpty,
  title: nonEmpty,
  lessonIds: z.array(nonEmpty).min(1),
});

export const blockKindSchema = z.enum(['required', 'elective', 'toolbox']);

export const pathStepSchema = z.strictObject({
  blockId: nonEmpty,
  chapterId: nonEmpty.optional(),
  required: z.boolean().optional(),
});

export const learningPathSchema = z.strictObject({
  id: z.enum(['a', 'b', 'c', 'd']),
  title: nonEmpty,
  blurb: nonEmpty,
  steps: z.array(pathStepSchema).min(1),
});

export const stageSchema = z.strictObject({
  id: nonEmpty,
  index: z.number().int().min(0).max(8),
  title: nonEmpty,
  subtitle: nonEmpty,
  accent: z.enum(['teal', 'blue', 'violet', 'amber', 'green', 'rose']),
  duration: z.number().int().positive(),
  /** @deprecated 用 kind === 'toolbox'；R1 仍可读 */
  appendix: z.literal(true).optional(),
  /** R1 可选；内容文件改 ID 前可缺省 */
  kind: blockKindSchema.optional(),
  chapters: z.array(chapterSchema).optional(),
  /** 多项目挂载（如 M2）；与 project 并存时以内容为准，R2/R3 收敛 */
  projectIds: z.array(nonEmpty).min(1).optional(),
  /**
   * 块内多项目实体（R2b+）。若提供，catalog/findProject 以本数组为准；
   * `project` 可置为 projects[0] 或 null（兼容旧单项目读取）。
   */
  projects: z.array(projectSchema).min(1).optional(),
  goal: nonEmpty,
  outcome: z.array(nonEmpty).min(1),
  keywords: z.array(nonEmpty).min(1),
  lessons: z.array(lessonSchema).min(1),
  project: projectSchema.nullable(),
});

const pythonBlockEntrySchema = z.strictObject({ code: nonEmpty, note: nonEmpty });
export const pythonBlockMapSchema = z.record(z.string(), z.array(pythonBlockEntrySchema));
export const pythonTrackMapSchema = z.record(z.string(), pythonTrackSchema);
