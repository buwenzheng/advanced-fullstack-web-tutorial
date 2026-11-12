import type { LessonData, StageData } from '../../types.js';
import { m3Cache } from './m3-cache.js';
import { m3Queue } from './m3-queue.js';
import { m3Ratelimit } from './m3-ratelimit.js';
import { m3Resilience } from './m3-resilience.js';
import { m3Otel } from './m3-otel.js';
import { m3Perf } from './m3-perf.js';
import { m3Container } from './m3-container.js';
import { m3Cicd } from './m3-cicd.js';
import { m3Bff } from './m3-bff.js';
import { m3Render } from './m3-render.js';
import { m3Realtime } from './m3-realtime.js';
import { m3Edge } from './m3-edge.js';
import { project as shipProject } from './project.js';
import { project as webProject } from './project-web.js';
export { PYTHON_BLOCKS, PYTHON_TRACKS } from './python.js';

export const stageM3 = {
  id: 'm3',
  index: 2,
  kind: 'required',
  chapters: [
    {
      id: 'ship',
      title: '生产',
      lessonIds: ['m3-cache', 'm3-queue', 'm3-ratelimit', 'm3-resilience', 'm3-otel', 'm3-perf', 'm3-container', 'm3-cicd'],
    },
    { id: 'product', title: '产品', lessonIds: ['m3-bff', 'm3-render', 'm3-realtime', 'm3-edge'] },
  ],
  projectIds: ['p-m3-ship', 'p-m3-web'],
  title: '生产与产品',
  subtitle: '让系统扛得住、查得到、发得出，再把后端能力组装成产品。',
  accent: 'amber',
  duration: 980,
  goal: '把后端服务交付为可运营、可回滚、可观测的全栈产品。',
  outcome: [
    '能让系统在热点、过载和下游故障时保持可用',
    '能用可观测、压测、容器与 CI/CD 完成生产交付',
    '能用 BFF、渲染、实时与边缘能力组装端到端产品',
  ],
  keywords: ['缓存', '队列', '限流', 'OpenTelemetry', 'Docker', 'BFF', 'SSR', '边缘缓存'],
  lessons: [m3Cache, m3Queue, m3Ratelimit, m3Resilience, m3Otel, m3Perf, m3Container, m3Cicd, m3Bff, m3Render, m3Realtime, m3Edge] as LessonData[],
  projects: [shipProject, webProject],
  project: shipProject,
} satisfies StageData;
