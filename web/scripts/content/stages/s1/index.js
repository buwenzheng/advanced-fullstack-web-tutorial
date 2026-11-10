import { s1L1 } from './s1-l1.js';
import { s1L2 } from './s1-l2.js';
import { s1L3 } from './s1-l3.js';
import { s1Schema } from './s1-schema.js';
import { project as p1 } from './project.js';
export { PYTHON_BLOCKS, PYTHON_TRACKS } from './python.js';

export const stage1 = {
  id: "s1",
  index: 1,
  title: "数据与持久化：从对象到可信任的数据",
  subtitle: "前端的数组活到页面刷新为止；后端的数据要活过进程重启、机器宕机和并发写入。",
  accent: "blue",
  duration: 320,
  goal: "把前端的对象变成能活过进程重启、并发写入和 schema 演进的数据。",
  outcome: [
    "能为一个业务域画出表与约束，并说清每个约束在防什么",
    "能用查询计划证明索引生效，并识别 N+1 与全表扫描",
    "能解释隔离级别与 MVCC，并为业务选择事务边界",
    "能写出可从空库与旧版库各跑一次的可回滚迁移"
  ],
  keywords: ["关系模型","SQL","索引","B+tree","EXPLAIN","事务","MVCC","迁移"],
  lessons: [s1L1, s1L2, s1L3, s1Schema],
  project: p1,
};
