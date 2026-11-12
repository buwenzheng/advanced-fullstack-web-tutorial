import type { LessonData, StageData } from '../../types.js';
import { m4Llm } from './m4-llm.js';
import { m4Rag } from './m4-rag.js';
import { m4Eval } from './m4-eval.js';
import { m4CodingSystem } from './m4-coding-system.js';
import { m4CodingTeam } from './m4-coding-team.js';
import { project as stageProject } from './project.js';
export { PYTHON_BLOCKS, PYTHON_TRACKS } from './python.js';

export const stageM4 = {
  id: 'm4',
  index: 3,
  kind: 'required',
  chapters: [
    { id: 'coding', title: 'AI Coding', lessonIds: ['m4-coding-system', 'm4-coding-team'] },
    { id: 'product', title: '产品 AI', lessonIds: ['m4-llm', 'm4-rag', 'm4-eval'] },
  ],
  title: 'AI 工程',
  subtitle: '把模型接进产品，也把 AI Coding 变成可验证的研发系统。',
  accent: 'violet',
  duration: 400,
  goal: '把模型接进产品，也把 AI Coding 变成可验证的研发系统；不训练模型，不推导深度学习数学。',
  outcome: [
    '能实现流式 LLM 网关，处理路由、超时、重试、幂等与成本',
    '能设计带权限过滤、引用与评估的 RAG 与受限工具',
    '能评估 AI 功能与 AI 协作系统，并留下可复盘证据',
  ],
  keywords: ['LLM', 'SSE', 'RAG', 'pgvector', '提示注入', '评估集', 'AI Coding', 'Agent', 'MCP'],
  lessons: [m4Llm, m4Rag, m4Eval, m4CodingSystem, m4CodingTeam] as LessonData[],
  project: stageProject,
} satisfies StageData;
