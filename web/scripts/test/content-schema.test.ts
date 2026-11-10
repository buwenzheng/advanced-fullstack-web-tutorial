import { describe, expect, it } from 'vitest';
import { lessonSchema, projectSchema, stageSchema } from '../content/schema.js';
import { stageInputs } from '../content/sources.js';
import { graduationProject } from '../content/graduation.js';
import type { LessonData, Project } from '../content/types.js';

function lessons(): LessonData[] {
  return stageInputs.flatMap((input) => input.data.lessons);
}

function projects(): Project[] {
  return [
    ...stageInputs.map((input) => input.data.project).filter((project): project is Project => project !== null),
    graduationProject,
  ];
}

describe('content schema', () => {
  it('9 个阶段全部通过 strict schema', () => {
    expect(stageInputs).toHaveLength(9);
    for (const input of stageInputs) {
      expect(() => stageSchema.parse(input.data)).not.toThrow();
    }
  });

  it('45 讲与 9 个项目全部通过 strict schema', () => {
    expect(lessons()).toHaveLength(45);
    for (const lesson of lessons()) {
      expect(() => lessonSchema.parse(lesson)).not.toThrow();
    }
    expect(projects()).toHaveLength(9);
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
});
