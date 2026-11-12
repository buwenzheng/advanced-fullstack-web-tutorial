# G-R2 报告：ID 迁移 + 目录合并

- 日期：2026-11-12
- 结论：**G-R2 通过**
- 标签建议：`r2-ids`（待用户可提交时打上）

## 验收

- [x] G-R2a 身份切换（见 `g-r2a-report.md`）
- [x] 目录仅为 `m1…b`（6 块）
- [x] sources + STAGE_LOADERS 按块 id
- [x] kind/chapters 挂内容
- [x] 旧 stage id 可重定向
- [x] p3/p4 物理并入 `p-m3-ship`（生产里程碑 `m6–m10`）
- [x] validate / typecheck / migration / vitest 绿
- [x] routes.json 重建（62）

## 命令

| 命令 | 结果 |
| --- | --- |
| content:validate | stages=6 lessons=45 projects=8 duration=3400 |
| test:migration | ok |
| vitest | 294 passed |

## 下一批

`21-r3-project-decouple.md`
