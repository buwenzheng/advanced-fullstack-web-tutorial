import type { LessonData, StageData } from '../../types.js';
import { bBigO } from './b-bigO.js';
import { bHash } from './b-hash.js';
import { bBtree } from './b-btree.js';
import { bHeap } from './b-heap.js';
import { bLru } from './b-lru.js';
import { bProb } from './b-prob.js';
import { bCapacity } from './b-capacity.js';
import { bLinux } from './b-linux.js';
import { bSysdesign } from './b-sysdesign.js';
import { bAdr } from './b-adr.js';
import { bQuality } from './b-quality.js';
import { bIncident } from './b-incident.js';
import { bAiInfra } from './b-ai-infra.js';
export { PYTHON_BLOCKS, PYTHON_TRACKS } from './python.js';

export const stageB = {
  id: 'b',
  index: 5,
  kind: 'toolbox',
  appendix: true,
  chapters: [
    { id: 'dsa', title: '数据结构', lessonIds: ['b-bigO', 'b-hash', 'b-btree', 'b-heap', 'b-lru', 'b-prob'] },
    { id: 'perf', title: '性能与基础设施', lessonIds: ['b-capacity', 'b-linux'] },
    { id: 'design', title: '设计与工程', lessonIds: ['b-sysdesign', 'b-adr', 'b-quality', 'b-incident'] },
    { id: 'ai', title: 'AI 基础设施', lessonIds: ['b-ai-infra'] },
  ],
  title: '工具箱',
  subtitle: '按后端系统里真实出现的位置讲：索引、缓存、队列、容量、故障与 AI 基础设施。',
  accent: 'amber',
  duration: 890,
  goal: '补齐性能优化、基础设施、系统设计、工程效能与 AI 基础设施的底层素养。',
  outcome: [
    '能估算复杂度、容量与尾延迟，并用实验验证',
    '能解释常用数据结构与概率结构的工程取舍',
    '能处理 Linux/IO、系统设计、故障复盘与 AI 基础设施问题',
  ],
  keywords: ['复杂度', 'B+tree', 'LSM', '堆', 'LRU', '布隆过滤器', 'Little 定律', 'HNSW', 'KV cache'],
  lessons: [bBigO, bHash, bBtree, bHeap, bLru, bProb, bCapacity, bLinux, bSysdesign, bAdr, bQuality, bIncident, bAiInfra] as LessonData[],
  project: null,
} satisfies StageData;
