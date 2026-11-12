import { describe, expect, it } from 'vitest';
import { assembleContent } from '../content/assemble.js';
import { stageInputs } from '../content/sources.js';
import type { Block, LessonData, StageInput } from '../content/types.js';

function cloneInputs(): StageInput[] {
  return stageInputs.map((input) => structuredClone(input));
}

function legacyAttach(
  lesson: LessonData,
  mapping: Array<{ code: string; note: string }>,
): Block[] {
  let codeIndex = 0;
  return lesson.blocks.map((block) => {
    if (block.type !== 'code') return block;
    const entry = mapping[codeIndex];
    codeIndex += 1;
    if (!entry || (block.lang || 'javascript') !== 'javascript') return block;
    return { ...block, python: entry.code, pythonNote: entry.note };
  });
}

describe('content assemble', () => {
  it('注入 stageId 并保持 6 块 45 讲', () => {
    const stages = assembleContent(stageInputs);
    expect(stages).toHaveLength(6);
    const lessons = stages.flatMap((stage) => stage.lessons);
    expect(lessons).toHaveLength(45);
    for (const stage of stages) {
      for (const lesson of stage.lessons) {
        expect(lesson.stageId).toBe(stage.id);
      }
    }
  });

  it('Python 代码块按 JS 代码块顺序注入', () => {
    const stages = assembleContent(stageInputs);
    const lesson = stages.flatMap((stage) => stage.lessons).find((item) => item.id === 'm1-http')!;
    const input = stageInputs.find((stage) => stage.data.lessons.some((item) => item.id === 'm1-http'))!;
    const entries = input.pythonBlocks['m1-http']!;
    const jsBlocks = lesson.blocks.filter(
      (block) => block.type === 'code' && (block.lang || 'javascript') === 'javascript',
    );
    expect(jsBlocks).toHaveLength(entries.length);
    jsBlocks.forEach((block, index) => {
      expect(block.type === 'code' ? block.python : undefined).toBe(entries[index]!.code);
      expect(block.type === 'code' ? block.pythonNote : undefined).toBe(entries[index]!.note);
    });
  });

  it('34 个映射课时的新旧算法逐块 deepEqual', () => {
    const stages = assembleContent(stageInputs);
    const assembled = new Map(stages.flatMap((stage) => stage.lessons).map((lesson) => [lesson.id, lesson]));
    let checked = 0;
    for (const input of stageInputs) {
      for (const [lessonId, entries] of Object.entries(input.pythonBlocks)) {
        const lesson = input.data.lessons.find((item) => item.id === lessonId)!;
        expect(assembled.get(lessonId)!.blocks).toEqual(legacyAttach(lesson, entries));
        checked += 1;
      }
    }
    expect(checked).toBe(34);
  });

  it('非要 JS 代码块不参与 Python 注入（m3-container）', () => {
    const stages = assembleContent(stageInputs);
    const lesson = stages.flatMap((stage) => stage.lessons).find((item) => item.id === 'm3-container')!;
    const codeBlocks = lesson.blocks.filter((block) => block.type === 'code');
    expect(codeBlocks.length).toBeGreaterThan(1);
    const jsBlocks = codeBlocks.filter((block) => (block.lang || 'javascript') === 'javascript');
    const otherBlocks = codeBlocks.filter((block) => (block.lang || 'javascript') !== 'javascript');
    expect(jsBlocks.every((block) => block.type === 'code' && block.python)).toBe(true);
    expect(otherBlocks.every((block) => block.type === 'code' && block.python === undefined)).toBe(true);
  });

  it('映射条目数不匹配时抛错', () => {
    const inputs = cloneInputs();
    const input = inputs.find((stage) => Object.keys(stage.pythonBlocks).length > 0)!;
    const lessonId = Object.keys(input.pythonBlocks)[0]!;
    input.pythonBlocks[lessonId] = [];
    expect(() => assembleContent(inputs)).toThrow(/Python 映射 0 条/);
  });

  it('缺少 Python 轨道时抛错', () => {
    const inputs = cloneInputs();
    const input = inputs.find((stage) => Object.keys(stage.pythonTracks).length > 0)!;
    delete input.pythonTracks[Object.keys(input.pythonTracks)[0]!];
    expect(() => assembleContent(inputs)).toThrow(/缺少 Python 轨道/);
  });

  it('多余 Python 轨道时抛错', () => {
    const inputs = cloneInputs();
    const input = inputs.find((stage) => Object.keys(stage.pythonTracks).length > 0)!;
    const sample = input.pythonTracks[Object.keys(input.pythonTracks)[0]!]!;
    input.pythonTracks['not-a-task'] = structuredClone(sample);
    expect(() => assembleContent(inputs)).toThrow(/没有对应的代码练习/);
  });
});
