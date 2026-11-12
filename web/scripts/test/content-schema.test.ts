import { describe, expect, it } from 'vitest';
import {
  chapterSchema,
  learningPathSchema,
  lessonSchema,
  projectSchema,
  stageSchema,
} from '../content/schema.js';
import { stageInputs } from '../content/sources.js';
import { graduationProject } from '../content/graduation.js';
import type { LessonData, Project } from '../content/types.js';
import { LEARNING_PATHS } from '../content/paths.js';

function lessons(): LessonData[] {
  return stageInputs.flatMap((input) => input.data.lessons);
}

function projects(): Project[] {
  return [
    ...stageInputs.flatMap((input) => input.data.projects ?? (input.data.project ? [input.data.project] : [])),
    graduationProject,
  ];
}

describe('content schema', () => {
  it('6 个内容块全部通过 strict schema', () => {
    expect(stageInputs).toHaveLength(6);
    for (const input of stageInputs) {
      expect(() => stageSchema.parse(input.data)).not.toThrow();
    }
  });

  it('45 讲与 8 个项目全部通过 strict schema', () => {
    expect(lessons()).toHaveLength(45);
    for (const lesson of lessons()) {
      expect(() => lessonSchema.parse(lesson)).not.toThrow();
    }
    expect(projects()).toHaveLength(8);
    for (const project of projects()) {
      expect(() => projectSchema.parse(project)).not.toThrow();
    }
  });

  it('未知字段被拒绝', () => {
    const lesson = structuredClone(lessons()[0]!) as LessonData & { extra?: unknown };
    lesson.extra = true;
    expect(() => lessonSchema.parse(lesson)).toThrow();
  });

  it('缺少必填字段被拒绝', () => {
    const lesson = structuredClone(lessons()[0]!) as Record<string, unknown>;
    delete lesson.title;
    expect(() => lessonSchema.parse(lesson)).toThrow();
  });

  it('错误枚举被拒绝', () => {
    const lesson = structuredClone(lessons()[0]!);
    (lesson.blocks[0] as { type: string }).type = 'unknown';
    expect(() => lessonSchema.parse(lesson)).toThrow();
  });

  it('空字符串被拒绝', () => {
    const lesson = structuredClone(lessons()[0]!);
    lesson.title = '';
    expect(() => lessonSchema.parse(lesson)).toThrow();
  });

  it('design 练习的结构允许 brief/prompt 可选，由语义校验裁决', () => {
    const design = lessons()
      .flatMap((lesson) => lesson.exercises)
      .find((exercise) => exercise.kind === 'design');
    expect(design).toBeTruthy();
    const clone = structuredClone(design!);
    expect(() => lessonSchema.parse({ ...lessons()[0]!, exercises: [clone] })).not.toThrow();
  });

  it('stage 可带 kind/chapters，且不影响现有内容块解析', () => {
    const withMeta = {
      ...structuredClone(stageInputs[0]!.data),
      kind: 'required' as const,
      chapters: [{ id: 'intro', title: '入门', lessonIds: [stageInputs[0]!.data.lessons[0]!.id] }],
    };
    expect(() => stageSchema.parse(withMeta)).not.toThrow();
    expect(() => chapterSchema.parse(withMeta.chapters[0])).not.toThrow();
  });

  it('learningPathSchema 接受四条静态路径', () => {
    for (const path of LEARNING_PATHS) {
      expect(() => learningPathSchema.parse(path)).not.toThrow();
    }
  });
});
