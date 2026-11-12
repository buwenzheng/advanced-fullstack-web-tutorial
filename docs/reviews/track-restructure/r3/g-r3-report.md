# G-R3 项目解耦验收报告

日期：2026-11-12  
批次：R3 project decouple  
状态：通过

## 交付检查

- [x] T-R3.0：`path-completion-map.md` 已按路径 A/B/C/D 填入 catalog 中真实项目与里程碑 ID。
- [x] T-R3.1：M1/M2/M3/M4 七个主修项目 brief 均含目标、里程碑、显式先修、非目标及与 X 的关系。
- [x] T-R3.2：`p-e1-stats` 可从 M2 域模型独立起步；`x-linkhub` 提供页面可见、机器可读的全栈 / AI 全栈 / 分布式三档结业。
- [x] `p-m3-ship` 分为缓存与异步（m1–m5）、可观测与发布（m6–m10）两组；真机/VPS 部署为选做，不阻挡结业。
- [x] T-R3.3：完成耦合扫描；阻塞项为 0，保留命中均为算法或运行时安全约束。
- [x] T-R3.4：阶段页展示 M2/M3 多项目入口及 E1 选修徽章；项目页展示先修、非目标、X 关系与 X 三档说明。
- [x] 未实现 R4 路径总览卡。
- [x] 未修改练习测试、solution 或断言语义。

## 验证结果

| 命令 | 结果 |
| --- | --- |
| `npm run content:validate` | 通过：6 stages / 45 lessons / 8 projects |
| `npm run typecheck` | 通过 |
| `npm run content:build` | 通过；catalog 与 search 产物已重建 |
| `npx vitest run` | 通过：29 files / 294 tests |

## 证据

- 路径映射：`docs/reviews/track-restructure/r3/path-completion-map.md`
- 耦合扫描：`docs/reviews/track-restructure/r3/coupling-scan.txt`
- X 三档元数据：`web/scripts/content/graduation.ts` 的 `completionTiers`
- 项目边界元数据：project schema 的 `prerequisites`、`nonGoals`、`xRelation`

## 遗留债务

- 毕业项目为兼容既有进度仍保留数据 ID `m1`–`m11`；规划 X1–X10 与数据 ID 的唯一映射已写入 `path-completion-map.md`。R4 应消费该映射，不应按编号猜测。
- 未创建 Git 标签；当前工作树包含前序 R2 的大量未提交改动，待整体提交后再标记 `r3-projects` 更安全。
