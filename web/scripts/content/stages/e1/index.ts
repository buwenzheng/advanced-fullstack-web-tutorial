import type { LessonData, StageData } from '../../types.js';
import { e1Modular } from './e1-modular.js';
import { e1Consistency } from './e1-consistency.js';
import { e1Failures } from './e1-failures.js';
import { e1Datascale } from './e1-datascale.js';
import { project as stageProject } from './project.js';
export { PYTHON_BLOCKS, PYTHON_TRACKS } from './python.js';

export const stageE1 = {
  id: 'e1',
  index: 4,
  kind: 'elective',
  chapters: [],
  title: '分布式与数据边界',
  subtitle: '架构决策是一次有代价的交换；先判断该不该拆，再谈怎么拆。',
  accent: 'rose',
  duration: 340,
  goal: '能判断该不该拆，拆了之后能处理一致性、失败与数据扩展。',
  outcome: [
    '能写出拆分代价清单，而不是只列好处',
    '能用 Outbox 与幂等消费实现最终一致',
    '能处理部分失败、重试放大、分布式锁与数据扩展',
  ],
  keywords: ['模块边界', 'Outbox', 'Saga', '最终一致', 'Fencing Token', '复制延迟', '分片', '一致性哈希'],
  lessons: [e1Modular, e1Consistency, e1Failures, e1Datascale] as LessonData[],
  project: stageProject,
} satisfies StageData;
