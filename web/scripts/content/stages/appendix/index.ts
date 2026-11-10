import type { LessonData, StageData } from '../../types.js';
import { a1 } from './a1.js';
import { a2 } from './a2.js';
import { a3 } from './a3.js';
import { a4 } from './a4.js';
import { a5 } from './a5.js';
import { a6 } from './a6.js';
import { a7 } from './a7.js';
import { a8 } from './a8.js';
import { a9 } from './a9.js';
import { a10 } from './a10.js';
import { a11 } from './a11.js';
import { a12 } from './a12.js';
import { a13 } from './a13.js';
export { PYTHON_BLOCKS, PYTHON_TRACKS } from './python.js';

export const stageAppendix = {
  id: "appendix",
  index: 8,
  appendix: true,
  title: "附录：数据结构、性能、架构、工程与 AI 基础设施",
  subtitle: "按后端系统里真实出现的位置讲：索引、缓存、队列、容量、故障与 AI 基础设施。",
  accent: "amber",
  duration: 890,
  goal: "补齐性能优化、基础设施、系统设计、工程效能与 AI 基础设施的底层素养，支撑资深工程师面试与架构判断。",
  outcome: [
    "能估算复杂度、容量与尾延迟，并用实验验证",
    "能解释索引、哈希、堆、环形缓冲与概率结构的工程取舍",
    "能处理 Linux/IO、反向代理、故障复盘与 ADR",
    "能解释推理服务、向量索引与 AI 成本模型的底座"
  ],
  keywords: ["复杂度","B+tree","LSM","堆","LRU","布隆过滤器","HyperLogLog","Little 定律","HNSW","KV cache"],
  lessons: [a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13] as LessonData[],
  project: null,
} satisfies StageData;
