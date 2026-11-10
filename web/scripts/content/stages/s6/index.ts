import type { LessonData, StageData } from '../../types.js';
import { s6L1 } from './s6-l1.js';
import { s6L2 } from './s6-l2.js';
import { s6L3 } from './s6-l3.js';
import { s6L4 } from './s6-l4.js';
import { project as p6 } from './project.js';
export { PYTHON_BLOCKS, PYTHON_TRACKS } from './python.js';

export const stage6 = {
  id: "s6",
  index: 6,
  title: "全栈集成：把后端能力变成产品",
  subtitle: "契约、渲染、实时、安全与边缘——把后端能力组装成用户真正使用的产品。",
  accent: "blue",
  duration: 330,
  goal: "把 API、统计服务与 Web 层接成一个产品，并对端到端延迟、错误与安全负责。",
  outcome: [
    "能从 OpenAPI 生成类型客户端并在 CI 检查契约漂移",
    "能用 BFF 聚合消除请求瀑布，并设计部分失败降级",
    "能按页面选择渲染策略，并用 CWV 与 RUM 管理体验",
    "能设计会话、CSRF、CSP、实时链路与边缘缓存的安全边界"
  ],
  keywords: ["BFF","契约驱动","SSR","流式渲染","CWV","RUM","SSE","CSP","边缘缓存"],
  lessons: [s6L1, s6L2, s6L3, s6L4] as LessonData[],
  project: p6,
} satisfies StageData;
