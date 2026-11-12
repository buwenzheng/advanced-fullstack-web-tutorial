# R5 手工检查记录

范围来自 `docs/implementation/23-r5-verify-and-docs.md` §3.2。

## 矩阵

| 项 | 结果 | 证据 |
| --- | --- | --- |
| 路径 C | 通过 | 总览默认推荐 C、入口 `#/stage/m1`；`overview-page.test.tsx` + a11y/visual `#/` |
| 路径 A 结业文案 | 通过 | `PATH_COMPLETION_COPY` / `path-completion-map.md` 不要求 E1/X；块页文案 |
| 旧课时链 `#/lesson/s0-l1` | 通过 | `e2e/shell.spec.ts` 重定向到 `#/lesson/m1-http` |
| 旧阶段链 `#/stage/s0` | 通过 | `redirects.test.ts` + resolveStageRedirect→`m1` |
| 进度迁移注入 | 通过 | `test:migration` + interactions 旧进度夹具（version→3、新 ID） |
| M3 章与双项目 | 通过 | routes `#/stage/m3`、`#/project/p-m3-ship`、`#/project/p-m3-web`；StagePage 测 |
| E1 选修 | 通过 | routes `#/stage/e1`；路径 B 映射不含 E1 |
| X 三档 | 通过 | `#/project/x-linkhub` content/a11y/visual；project-page 测 |
| Lab / Report | 通过 | e2e content/interactions/a11y/visual 无失败 |

## 命令证据（2026-11-12）

- `npm run verify` → EXIT=0（含 134 Playwright 非 visual/python）
- `npm run e2e:visual --update-snapshots` → 21/21；复跑对比 21/21
- `npm run e2e:python` → 1/1
- `npx tsx tools/run-python-exercises.ts` → failing=0
- `npm run test:migration` → ok
