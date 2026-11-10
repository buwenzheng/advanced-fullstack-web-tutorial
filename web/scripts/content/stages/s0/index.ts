import type { LessonData, StageData } from '../../types.js';
import { s0L1 } from './s0-l1.js';
import { s0L2 } from './s0-l2.js';
import { s0Cli } from './s0-cli.js';
import { project as p0 } from './project.js';
export { PYTHON_BLOCKS, PYTHON_TRACKS } from './python.js';

export const stage0 = {
  id: "s0",
  index: 0,
  title: "地基：请求、运行时与排障",
  subtitle: "在写第一行业务代码之前，先搞清楚浏览器和服务器之间到底发生了什么。",
  accent: "teal",
  duration: 170,
  goal: "在写业务代码之前，先能看见一次请求的完整路径，理解运行时为什么会被一行同步代码卡死，并掌握最基本的排障工具。",
  outcome: [
    "能口述一次慢请求的排查顺序：DNS、TCP、TLS、TTFB、响应各段分别怎么验证",
    "能解释同步代码为什么会阻塞事件循环，并写出不阻塞的调度方式",
    "能用 CLI 定位端口占用、进程状态与 DNS 解析问题"
  ],
  keywords: ["DNS","TCP","TLS","HTTP","事件循环","进程","端口","curl"],
  lessons: [s0L1, s0L2, s0Cli] as LessonData[],
  project: p0,
} satisfies StageData;
