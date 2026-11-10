import { s4L1 } from './s4-l1.js';
import { s4Perf } from './s4-perf.js';
import { s4L3 } from './s4-l3.js';
import { s4L4 } from './s4-l4.js';
import { project as p4 } from './project.js';
export { PYTHON_BLOCKS, PYTHON_TRACKS } from './python.js';

export const stage4 = {
  id: "s4",
  index: 4,
  title: "生产化：可观测、性能与交付",
  subtitle: "出问题时查得到，发新版本时退得回去。",
  accent: "green",
  duration: 310,
  goal: "让服务出问题时查得到、性能瓶颈说得清、版本发得出去也回得来。",
  outcome: [
    "能设计可定位的日志、指标与追踪，并用 requestId 还原一次请求",
    "能用压测与 profile 定位瓶颈，给出可复现的证据",
    "能把服务容器化并写出优雅退出与健康检查",
    "能设计可灰度、可回滚的发布流程"
  ],
  keywords: ["结构化日志","RED/USE","OpenTelemetry","压测","火焰图","优雅退出","Docker","金丝雀"],
  lessons: [s4L1, s4Perf, s4L3, s4L4],
  project: p4,
};
