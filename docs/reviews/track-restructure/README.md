# 分块路径重构 · 评审证据

对应实施总纲：`docs/implementation/18-track-restructure.md`。

## 前置与执行

| 文档 | 作用 |
| --- | --- |
| [`execution-playbook.md`](./execution-playbook.md) | **主入口**：关联矩阵、影响半径、测试阶梯、Review 协议 |
| [`plan-coverage-review.md`](./plan-coverage-review.md) | 覆盖度 × 仓库现状复核 |
| [`open-decisions.md`](./open-decisions.md) | D1–D4 决策冻结 |
| [`preflight-lock.md`](./preflight-lock.md) | 开码前检查单 |

**计划未锁定：禁止继续改课时 ID / migrate / 路由等功能代码。**  
**开任一任务前：读执行手册 + 对应 `20`–`23` 批次任务卡（含关联/测试/Review）。**

## 批次证据

| 目录 | 批次 | 门禁标签 |
| --- | --- | --- |
| `baseline/` | 改造前/锁定前基线 | — |
| `r1/` | Schema / manifest | `r1-schema` |
| `r2/` | ID 迁移（可含 `g-r2a-report.md` + `g-r2-report.md`） | `r2a-ids`（可选）→ `r2-ids` |
| `r3/` | 项目解耦 + `path-completion-map.md` | `r3-projects` |
| `r4/` | 路径导航 UI | `r4-nav` |
| `r5/` | 全量验收与文档 | `r5-track-v1` |

每批至少包含：`g-rN-report.md` 与关键命令输出摘要。未开始的目录可在执行时创建。
