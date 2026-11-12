# 分块路径重构：已知问题与残留债

| 项 | 状态 | 后续 |
| --- | --- | --- |
| Git 标签 | `r1-schema`…`r5-track-v1` 均待真实提交 SHA 后补打 | 用户提交后按批次打标签 |
| `format:check` 未纳入 `verify` | 历史债，本轮未扩 | 另开工具链任务 |
| `StagePage` 内部命名 | UI 已用「大块」；文件名仍 Stage | 无行为变化时再重命名 |
| 入口包接近上限 | budget ~177/180 KB gzip | 继续避免静态拉入 `content/index` |
| ID 无边界替换 | `sha256→shb-hash56` 已在 R5 修；`p50/p75/0x85ebca6b` 已在 R2a 修 | 禁止再对短 token 全局替换 |
| 迁移分层 | v1 historic `s6→a` 与 v3 `remapId`（含 v2 `s6→m3-*`、`p4-mN→m6+`）已拆开 | 草稿跟随进度原始 version |

补充：`npm run verify` 不含 `@visual` / `@python` / `format:check`；R5 已单独归档这三项结果。
