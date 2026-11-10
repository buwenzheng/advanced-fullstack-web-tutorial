import { s5L1 } from './s5-l1.js';
import { s5L2 } from './s5-l2.js';
import { s5L3 } from './s5-l3.js';
import { s5DataScale } from './s5-data-scale.js';
import { project as p5 } from './project.js';
export { PYTHON_BLOCKS, PYTHON_TRACKS } from './python.js';

export const stage5 = {
  id: "s5",
  index: 5,
  title: "架构与分布式：拆分的代价与数据的边界",
  subtitle: "架构决策是一次有代价的交换；先判断该不该拆，再谈怎么拆。",
  accent: "rose",
  duration: 340,
  goal: "能判断该不该拆，拆了之后能处理一致性、失败与数据扩展。",
  outcome: [
    "能写出拆分代价清单，而不是只列好处",
    "能用 Outbox 与幂等消费实现最终一致",
    "能解释部分失败、重试放大、分布式锁与超时预算",
    "能设计复制、分片与读写分离方案并说明取舍"
  ],
  keywords: ["模块边界","Outbox","Saga","最终一致","Fencing Token","复制延迟","分片","一致性哈希"],
  lessons: [s5L1, s5L2, s5L3, s5DataScale],
  project: p5,
};
