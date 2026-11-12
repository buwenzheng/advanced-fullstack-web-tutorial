import { learningPathSchema } from './schema.js';
import type { LearningPath } from './types.js';

/**
 * 四条学习路径（规划 §3）。blockId 使用新大块 ID；
 * R1 内容文件仍按旧 stage 组织，路径供 R4 导航与清单校验使用。
 */
export const LEARNING_PATHS: LearningPath[] = [
  {
    id: 'a',
    title: '后端补齐',
    blurb: '前端要独立写 API 并上线：地基 → 后端交付 → 生产（M3 章1）。',
    steps: [{ blockId: 'm1' }, { blockId: 'm2' }, { blockId: 'm3', chapterId: 'ship' }],
  },
  {
    id: 'b',
    title: '全栈交付',
    blurb: '端到端产品感：在路径 A 基础上完成 M3 产品章（BFF/渲染/安全/边缘）。',
    steps: [
      { blockId: 'm1' },
      { blockId: 'm2' },
      { blockId: 'm3', chapterId: 'ship' },
      { blockId: 'm3', chapterId: 'product' },
    ],
  },
  {
    id: 'c',
    title: 'AI 全栈',
    blurb: 'AI 时代主目标：M1 后先插入 AI Coding，再后端与生产产品，最后产品 AI。',
    steps: [
      { blockId: 'm1' },
      { blockId: 'm4', chapterId: 'coding' },
      { blockId: 'm2' },
      { blockId: 'm3' },
      { blockId: 'm4', chapterId: 'product' },
    ],
  },
  {
    id: 'd',
    title: '资深加深',
    blurb: '在路径 B 或 C 结业后选修分布式，并用工具箱与集成毕业收束。',
    steps: [
      { blockId: 'm1' },
      { blockId: 'm2' },
      { blockId: 'm3' },
      { blockId: 'e1' },
      { blockId: 'b', chapterId: 'design' },
      { blockId: 'x' },
    ],
  },
];

export const PATH_IDS = LEARNING_PATHS.map((path) => path.id);

export function getLearningPath(id: string): LearningPath | undefined {
  return LEARNING_PATHS.find((path) => path.id === id);
}

export function parseLearningPaths(value: unknown): LearningPath[] {
  if (!Array.isArray(value)) throw new Error('paths 必须是数组');
  return value.map((entry, index) => {
    const parsed = learningPathSchema.safeParse(entry);
    if (!parsed.success) {
      throw new Error(`paths[${index}] 无效: ${parsed.error.message}`);
    }
    return parsed.data;
  });
}
