# E5 单入口视觉验收（T-E5.5 / §7.2）

- 日期：2026-11-10
- 环境：Node v24.22.1（`.nvmrc` 要求 22.15.0，未切换，见阶段报告记录）、Playwright 1.65.0、Chromium
- 完整日志：`visual-run.txt`（含 build 与 visual 两次命令输出）

## 命令与结果

```bash
$ npm run build
content ok stages=9 lessons=45 projects=9 checks=135 exercises=79 pythonLessons=34 pythonBlocks=60 pythonTracks=38 duration=3400
catalog bytes=73160 gzip=15282 sha256=d2ab730dba911068947fa6fa73f2886ae02a6fcc47067b289c46db86e3e63dec
search bytes=509581 gzip=199467 sha256=c824dce44f71b2227eb36df02dcbf5de3019e80aa8b3e6ef3865a754780b6dbe
../dist/assets/index-C20GHETo.js        478.15 kB │ gzip: 151.28 kB
../dist/assets/search-index-BwozhHnn.js 507.07 kB │ gzip: 199.34 kB
✓ built in 1.40s
exit=0

$ npx playwright test e2e/visual.spec.ts --project=chromium
21 passed (8.0s)
exit=0
```

21 条基线用例 = 7 页面（home / lab / stage-s0 / lesson-s0-l1 / lesson-s7-l5 / project-p-graduation / report）× 3 视口（1440x900 / 768x1024 / 390x844），全部通过。

## 基线未变证明

- 运行前快照：`visual-sha-before.txt`（21 条 `mode sha stage path`，取自 `git ls-files -s e2e/__screenshots__`）。
- 运行后复取并 diff：`baseline-sha-identical`（无差异）；`git status --short e2e/__screenshots__` 无输出（`baseline-worktree-clean`）。
- HEAD 未变：`ec744d9900f8f956f15e691477e5c6f82b4872d8`。
- 基线未重采、未改名、未删增（21 → 21）。
- 结论：单入口产物与 E4 冻结的 v2/v3 共用基线逐像素一致。

## 说明

- 本轮为 T-E5.3 删除 v2 运行时代码后的首次全量视觉回归，入口固定为 `web/index.html` → `dist/index.html`，`visual.spec.ts` 中已无 `VISUAL_ENTRY` 分支。
- 构建告警（search-index 507.07 kB > 500 kB）为已知分包现象，预算门禁按 gzip 口径通过（`budget-single-entry.txt`：entry 147.4KB/180KB、lazy max 85.1KB/150KB、search 194.7KB/300KB）。
