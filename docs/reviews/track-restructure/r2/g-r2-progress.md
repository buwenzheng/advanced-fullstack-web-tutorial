# G-R2 进度

## R2b 目录合并

- 已将内容目录收敛为 `m1`、`m2`、`m3`、`m4`、`e1`、`b`，并删除旧 `s0`–`s7`、`appendix` 目录。
- M2 同时装配 `p-m2-data`、`p-m2-api`；M3 同时装配 `p-m3-ship`、`p-m3-web`。
- `p-m3-ship` 合并原 s3/s4 里程碑，生产化里程碑重编号为 `p-m3-ship-m6`–`m10`。
- `sources.ts` 与运行时 `STAGE_LOADERS` 均只加载六个新块；旧 stage 路由通过 `BLOCK_ID_MAP` 重定向。
- Python 映射按来源模块通过 `Object.assign` 合并；内容目录、搜索、报告与项目加载支持 `stage.projects`。
- 已重建 catalog/search 与 `e2e/routes.json`（62 条唯一路由）。

## 验证

- `npm run content:build`：通过。
- `npm run content:validate`：通过（6 块、45 讲、8 项目）。
- `npm run typecheck`：通过。
- `npm run test:migration`：通过。
- `npx vitest run`：通过（29 files，294 tests）。
