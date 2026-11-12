# 改造前基线

- 日期：2026-11-12
- 分支：`main`（未另开 `track-restructure`；改动在工作区直接进行）
- Node：以 `.nvmrc` / 本机 `npm run typecheck` 环境为准

## 命令摘要

| 命令 | 结果 |
| --- | --- |
| `npm run content:validate` | ok · stages=9 lessons=45 projects=9 duration=3400 |
| `npm run typecheck` | 0 error |

完整 `npm run verify` 未在 R1 开批前重跑（耗时长）；R1 门禁以 content:validate / typecheck / 相关单测为准，全量 verify 留待 R5。

计划锁定后最小门禁见 [`lock-gate-2026-11-12.md`](./lock-gate-2026-11-12.md)（D3=A）。
