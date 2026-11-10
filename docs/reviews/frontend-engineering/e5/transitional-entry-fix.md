# T-E5.1 过渡态入口闭包解析修复

- 日期：2026-11-10
- 现象：`web/index.html` 切换为 React 入口后，`npm run verify` 在 `npm run budget` 失败（exit 1）：
  - `FAIL manifest 中找不到 index.next.html 入口`
  - `dist/.vite/manifest.json` 中不存在 `index.html` 或 `index.next.html` 键
- 根因：Vite 7.3.8 在 `build.rollupOptions.preserveEntrySignatures=false` 下，两个 HTML 入口引用同一脚本时，会把两个 HTML facade 入口合并为同一个 chunk（`assets/main-DSzuuuF3.js`），manifest 只记录合并后的 chunk，不再保留 HTML 键。E4 及以前 `index.html` 是 v2 脚本入口，与 React 入口模块图不同，因此 manifest 同时保留两个 HTML 键。
- 对照实验（`tmp/vite-diag.config.ts`，输出 `tmp/dist-diag-*`）：
  - 单入口：manifest 有 `index.html`（`name=main`、`isEntry=true`）
  - 双入口共享 `main.tsx`：manifest 无任何 HTML / `isEntry` 键
  - 双入口 + 中间模块 `import './main'`：仍无 HTML 键
  - 双入口 + 中间模块带 `export`：仍无 HTML 键
- 最小修复（按总纲 §12.3 阻塞缺陷处理）：
  - `tools/bundle-budget.ts` 与 `e2e/lib/manifest.ts` 在找不到 HTML 入口键时，从产物 `dist/index.next.html` 的 `<script type="module" src>` 解析入口 chunk，再按 `manifest[].file` 定位；
  - 静态闭包递归语义、预算数值（180 / 150 / 300KB）与 gzip 等级均未改变。
- 验证（`npm run verify`，exit 0）：
  - entry 147.4KB / 180KB（E4 基线 147.8KB，差 -0.4KB，在 ±2KB 内）
  - lazy max 85.1KB / 150KB；search 194.7KB / 300KB
  - 单测 287 通过；E2E 137 通过
- 后续：T-E5.2 收敛为单入口后，manifest 恢复 `index.html` 键；届时按 §4.7 将入口键改为 `index.html`，并移除本过渡回退。
