import { s3L1 } from './s3-l1.js';
import { s3L2 } from './s3-l2.js';
import { s3L3 } from './s3-l3.js';
import { s3Resilience } from './s3-resilience.js';
import { project as p3 } from './project.js';
export { PYTHON_BLOCKS, PYTHON_TRACKS } from './python.js';

export const stage3 = {
  id: "s3",
  index: 3,
  title: "缓存、异步与韧性：让系统在压力下不崩",
  subtitle: "让接口从「能跑」到「扛得住」：缓存、队列、限流与韧性。",
  accent: "amber",
  duration: 340,
  goal: "让系统在热点、过载与下游故障下仍然可用，并能用数据证明。",
  outcome: [
    "能按场景选择缓存策略并处理穿透、击穿、雪崩",
    "能设计一条异步链路并说清投递语义、重试与死信",
    "能调限流、超时、重试与熔断参数，避免重试风暴",
    "能用压测数据证明保护生效，而不是只讲机制"
  ],
  keywords: ["缓存","Cache-Aside","消息队列","幂等消费","令牌桶","熔断","超时","压测"],
  lessons: [s3L1, s3L2, s3L3, s3Resilience],
  project: p3,
};
