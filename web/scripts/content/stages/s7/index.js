import { s7L1 } from './s7-l1.js';
import { s7L2 } from './s7-l2.js';
import { s7L3 } from './s7-l3.js';
import { s7L4 } from './s7-l4.js';
import { s7L5 } from './s7-l5.js';
import { project as p7 } from './project.js';
export { PYTHON_BLOCKS, PYTHON_TRACKS } from './python.js';

export const stage7 = {
  id: "s7",
  index: 7,
  title: "AI 应用与 AI Coding：把模型接进产品与研发",
  subtitle: "把模型接进产品，也把 AI Coding 变成可验证的研发系统。",
  accent: "violet",
  duration: 400,
  goal: "把模型接进产品，也把 AI Coding 变成可验证的研发系统；不训练模型，不推导深度学习数学。",
  outcome: [
    "能实现流式 LLM 网关，处理路由、超时、重试、幂等与成本",
    "能设计带权限过滤、引用与评估的 RAG 与受限工具",
    "能评估 AI 功能的准确性、注入风险与成本，并接入 CI",
    "能用五层模型与七步循环系统化 AI 协作，并留下可复盘证据"
  ],
  keywords: ["LLM","SSE","RAG","pgvector","提示注入","评估集","AI Coding","Agent","MCP"],
  lessons: [s7L1, s7L2, s7L3, s7L4, s7L5],
  project: p7,
};
