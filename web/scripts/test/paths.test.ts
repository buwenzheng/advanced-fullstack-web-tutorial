import { describe, expect, it } from 'vitest';
import manifest from '../../../docs/content-manifest.json';
import {
  assertPathsAgainstBlocks,
  parseContentManifest,
} from '../content/manifest.js';
import { LEARNING_PATHS, PATH_IDS, getLearningPath } from '../content/paths.js';
import { learningPathSchema } from '../content/schema.js';

describe('learning paths', () => {
  it('四条路径 id 为 a/b/c/d 且通过 schema', () => {
    expect(PATH_IDS).toEqual(['a', 'b', 'c', 'd']);
    for (const path of LEARNING_PATHS) {
      expect(() => learningPathSchema.parse(path)).not.toThrow();
    }
  });

  it('getLearningPath 可按 id 取回', () => {
    expect(getLearningPath('c')?.title).toBe('AI 全栈');
    expect(getLearningPath('z')).toBeUndefined();
  });

  it('路径 steps 的 block/chapter 能在清单 blocks 中解析', () => {
    const doc = parseContentManifest(manifest);
    expect(assertPathsAgainstBlocks(doc)).toEqual([]);
  });

  it('路径 C 在 M1 后插入 m4/coding', () => {
    const path = getLearningPath('c')!;
    expect(path.steps.map((step) => [step.blockId, step.chapterId ?? null])).toEqual([
      ['m1', null],
      ['m4', 'coding'],
      ['m2', null],
      ['m3', null],
      ['m4', 'product'],
    ]);
  });
});
