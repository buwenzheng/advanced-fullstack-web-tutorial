import type { LessonData, StageData } from '../../types.js';
import { s2L1 } from './s2-l1.js';
import { s2L2 } from './s2-l2.js';
import { s2L3 } from './s2-l3.js';
import { s2L4 } from './s2-l4.js';
import { project as p2 } from './project.js';
export { PYTHON_BLOCKS, PYTHON_TRACKS } from './python.js';

export const stage2 = {
  id: "s2",
  index: 2,
  title: "API 设计与契约：把实现藏起来",
  subtitle: "后端真正的产品形态不是数据库，而是这份契约。",
  accent: "violet",
  duration: 300,
  goal: "把接口从「能跑」变成「第三方敢依赖」。",
  outcome: [
    "能按 HTTP 语义设计资源、方法与状态码",
    "能设计统一、可枚举、可处理的错误契约",
    "能实现认证、授权与多租户隔离，并覆盖越权测试",
    "能把分页、幂等、限流与 OpenAPI 契约写成可验证的工程产物"
  ],
  keywords: ["REST","HTTP 语义","错误契约","JWT","RBAC","多租户","幂等键","OpenAPI"],
  lessons: [s2L1, s2L2, s2L3, s2L4] as LessonData[],
  project: p2,
} satisfies StageData;
