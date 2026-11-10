# G-E5 阶段报告：默认入口切换与旧代码清理

- 日期：2026-11-10
- 结论：**G-E5 通过**；标签 `e5-switch` 打在 T-E5.6 提交上；站点未发布（仍为 v2.0.1，描述文件未改），访问策略未触碰。
- 环境：G-E5 复核时 `node -v` = v22.15.0（与 `.nvmrc` 一致）、npm 10.9.2、Playwright 1.65.0 / Chromium。E5 任务卡开始时的环境记录为 v24.22.1，门禁结果不受影响，详见「残余风险」。
- 证据目录：`docs/reviews/frontend-engineering/e5/`

## 1. 提交列表（e4-qa..HEAD）

| 提交 | 任务 | 内容 |
| --- | --- | --- |
| `6f3cad8` | T-E5.0 | 冻结 E5 基线与删除清单（inventory、入口引用、视觉 SHA、verify 基线） |
| `7c119c3` | T-E5.1 | 切换默认入口到 React（`web/index.html` 换成单入口，head 逐字不变） |
| `26f33a6` | T-E5.2 | 单入口收敛与 E2E 适配（entryUrl、删除 smoke/parity、budget/manifest 键） |
| `c1b7ed9` | T-E5.3 | 删除 v2 运行时代码并清理配置（11 个文件、tsconfig、prettierignore） |
| `ec744d9` | T-E5.4 | 更新 README 与 v3 命令文档（README、00-master-plan、09-qa-release、known-issues） |
| `fe56fc5` | T-E5.5 | 全量验收（verify/视觉/Python/离线/手工矩阵证据） |
| 本次提交 | T-E5.6 | G-E5 门禁与阶段报告（本文件） |

## 2. 删除清单（T-E5.3）

`git diff --cached --diff-filter=D --stat`：11 个文件、2449 行删除——

```
dev_server.py                  |  16 --
web/scripts/app.js             | 388 --
web/scripts/engine/exercise.js | 610 --
web/scripts/ui.js              |  94 --
web/scripts/views/blocks.js    | 164 --
web/scripts/views/lab.js       | 520 --
web/scripts/views/lesson.js    | 118 --
web/scripts/views/overview.js  | 107 --
web/scripts/views/project.js   | 182 --
web/scripts/views/report.js    | 171 --
web/scripts/views/stage.js     |  79 --
```

配置清理：`tsconfig.json` 移除 `allowJs`/`checkJs` 与 `*.js` include；`.prettierignore` 移除 `web/scripts/**/*.js`。保留 `web/scripts/content/**`（含 `search.ts`）、`web/scripts/state/**`、`web/scripts/engine/{runner,python,sql}/**`。回滚：`git revert c1b7ed9`。

## 3. 门禁命令与结果

| 命令 | 退出码 | 结果 | 证据 |
| --- | --- | --- | --- |
| `npm run verify` | 0 | 单测 27 文件 / 287 通过；覆盖率 91.27 / 79.66 / 93.52 / 93.92；content ok（stages=9 lessons=45 projects=9 checks=135 exercises=79）；审计通过；构建成功；budget 3 PASS；Playwright 137 passed | `verify.txt`（exit=0 在第 418 行） |
| `npm run build` | 0 | 仅 `dist/index.html`；入口 `index-C20GHETo.js` 478.15 kB / gzip 151.28 kB；search-index 507.07 kB / gzip 199.34 kB | `visual-run.txt`、`offline-dist.txt` |
| `npx playwright test e2e/visual.spec.ts --project=chromium` | 0 | 21 passed (8.0s)；`git status --short e2e/__screenshots__` 为空；21 个基线 blob SHA 前后 diff 为空 | `visual-run.txt`、`visual.md`、`visual-sha-before.txt` |
| `npx playwright test --project=chromium --grep @python` | 0 | 1 passed (14.1s)：切换 Python 后刷新保持、可切回 Node | `python.txt` |
| `npx tsx tools/run-python-exercises.ts` | 0 | `python exercises=38 failing=0 starterFailing=38` | `python.txt` |
| `npx tsx tools/test-progress-migration.ts` | 0 | `progress migration ok: q/l/drafts mapped, graduation preserved, idempotent` | 本报告 §5 |
| `python -m http.server 8125 --directory dist` + §7.4 子 shell | 0 | 首页 200（1353 B，与 dist/index.html 逐字节一致）；入口 JS/CSS 均 200；`index.next.html` 不存在；`index*.html` 计数 1；`offline dist ok` | `offline-dist.txt` |
| 离线浏览器矩阵（§7.4/§7.5） | — | 总览/课时/实验台/报告/刷新/未知 hash 全部符合；存储三键与迁移/清空记录/懒加载/搜索索引/无效 ID 文案全部符合 | `manual-checks.md`、`offline-screenshots/*.png` |
| `npm run budget` | 0 | entry 147.4KB/180KB、lazy max 85.1KB/150KB、search 194.7KB/300KB，3 PASS | `budget-single-entry.txt`、`t-e5-3-budget.txt` |

## 4. G-E5 验收清单（§10）

### 10.1 入口与构建

- [x] `web/index.html` 只包含 head、`noscript`、`#root`、`main.tsx` 脚本（grep：root=1、main.tsx=1、noscript=1）；
- [x] `head` 与 E4 基线逐字一致：`diff <(e4-qa:web/index.next.html 的 head) <(当前 web/index.html 的 head)` 为空（`head-e4-identical`），含 title、description、theme-color、favicon、4 个 CSS（`rel="stylesheet"` 计数 4）；
- [x] `web/index.next.html` 已删除（`test ! -e` 通过）；
- [x] `vite.config.ts` 单入口且保留 `manifest: true`（`vite.config.ts:13`）；
- [x] `npm run build` 只产出 `dist/index.html`（`find dist -maxdepth 1 -name 'index*.html'` 仅 1 条）；
- [x] `dist/index.html` 中 `id="root"` 恰好 1 次、`app.js` 0 次（`root-count=1`、`appjs-count=0`）；
- [x] `package.json` 无 `dev:next` / `preview:next`（node 读取均为 none），`dev` = `npm run content:build && vite --open`。

### 10.2 旧代码与配置

- [x] `app.js`、`ui.js`、`views/**`、`engine/exercise.js`、`dev_server.py` 全部删除（逐一 `test -e` 为 deleted）；
- [x] `find web/scripts -type f -name "*.js"` 无输出（`js-under-web-scripts=[]`）；
- [x] `tsconfig.json` 无 `allowJs`/`checkJs`（grep 无命中），include 仅 `web/scripts/**/*.ts`、`*.tsx`；
- [x] `.prettierignore` 无 `web/scripts/**/*.js`（grep 无命中）；
- [x] `web/scripts/content/**`（含 `content/search.ts`）、`state/**`、`engine/{runner,python,sql}/**` 完整保留（逐一存在）。

### 10.3 E2E 与工具

- [x] 8/8 个 spec 使用 `e2e/lib/entry.ts` 的 `entryUrl`；全仓无 `index.next.html` / `dev:next` / `preview:next` / `dev_server` 引用；
- [x] `smoke.spec.ts`、`parity.spec.ts` 已删除，`.github`、`tools`、`package.json`、`e2e` 无引用；
- [x] `visual.spec.ts` 无 `VISUAL_ENTRY`；21 张基线未改名、未重采（blob SHA diff 为空）；
- [x] `tools/bundle-budget.ts:36,89,110` 与 `e2e/lib/manifest.ts:15,17` 入口键为 `index.html`；
- [x] 包体三项 PASS；入口 gzip 与 E4 差异在 ±2KB 内：E4 `151364B / 147.8KB`（2 文件闭包）→ E5 `150301B / 147.4KB`（1 文件闭包），差 −1063B / −0.4KB。

### 10.4 功能与兼容

- [x] `routes.spec.ts` 66/66（`verify.txt` 中 `@routes` 恰好 66 条全 ok）；routes.spec 对 console error 逐页断言（`e2e/routes.spec.ts:13-14`），0 失败；
- [x] 响应式 25、键盘 7、axe 14 全部通过（verify.txt 各 spec 全 ok）；
- [x] 四类任务、项目里程碑、实验台、报告可用（E2E：MCQ/代码题/SQL/模板/项目里程碑+笔记/实验台 429 与重置/报告统计均 ok；手工见 `manual-checks.md`）；
- [x] 进度、草稿、语言三把存储键不变：`web/scripts/state/store.ts:3` = `bff-lab-progress-v1`、`:4` = `bff-lab-drafts-v1`、`web/scripts/state/lang.ts:1` = `bff-lab-lang-v1`；
- [x] 旧进度迁移夹具通过（命令与输出见 §3）；
- [x] 首次打开总览不请求阶段 chunk；首次聚焦搜索才请求索引（`e2e/content.spec.ts:121`「lazy 入口闭包与阶段 chunk 强断言」通过；手工网络记录见 `manual-checks.md`）；
- [x] 未知路由回落总览且 URL 不变（`#/totally-unknown-route` 手工验证；截图 `offline-screenshots/unknown.png`）。

### 10.5 视觉与离线

- [x] 单入口视觉 21/21（见 §3）；
- [x] `git status --short e2e/__screenshots__` 为空（`baseline-worktree-clean`）；
- [x] 离线静态服务下首页与全部 `assets/*` 返回 200。端口说明：8124 被本机既有 `python -m http.server`（PID 52660）占用且无法结束，卡片命令原样改用 8125，断言相同（`offline-dist.txt` environment note）；
- [x] 离线服务下 `#/`、`#/lesson/s0-l1`、`#/lab`、`#/report` 与刷新均正常（`manual-checks.md` §7.4 表）；
- [x] `find dist -maxdepth 1 -name "index*.html" | wc -l` = 1。

### 10.6 文档与发布状态

- [x] `README.md` 命令与目录结构与实际一致（T-E5.4 重写并 `npx prettier --check README.md` exit 0；`t-e5-4-doc-diff.txt`）；
- [x] `00-master-plan.md`、`09-qa-release.md` 无 `dev_server` / `index.next.html` / `dev:next`（grep exit 1，`t-e5-4-doc-guard.txt`）；
- [x] `known-issues.md` 含 E5 条目（「E5 入口切换」小节 + KI-14 格式债）；
- [x] 站点仍为私有 v2.0.1，未执行 prepare/publish（`.后端进阶实验室.qoder.site` 相对 `v2.0.1` 与 `e4-qa` 的 diff 均为空，工作区干净；releaseId 仍为 v2.0.1 的 `01a1c34e-87a3-773c-86c3-f58087e01acd`；E5 未调用任何 prepare/publish。限制：本会话 `list_sites` 返回空、`get_site` 返回 `sites_request_failed`，无法在线复核访问策略，见残余风险）；
- [x] 未修改 `functions/`（`git diff --stat e4-qa HEAD -- functions/` 为空）、数据库、访问策略与站点描述文件；
- [x] 证据目录齐全（§7.6 八份：`inventory-before.txt`、`entry-head-diff.txt`、`deleted-files.txt`、`verify.txt`、`offline-dist.txt`、`visual.md`、`python.txt`、`g5-report.md`）；`e5-switch` 标签在本次 T-E5.6 提交后打上。

## 5. 手工兼容矩阵（摘要，详见 `manual-checks.md`）

- 进度 `bff-lab-progress-v1` 刷新保留；草稿 `bff-lab-drafts-v1` 跨课时保留；语言 `bff-lab-lang-v1` 刷新保持；清空记录文案/Toast/归零与 v2 一致；三键名与迁移规则未变。
- 实验台内置场景 200（108ms、JSON）、历史与重置正常；真实端点在离线静态服务下如实 404，控制台仅 1 条该主动 404 错误，属预期。
- 无效 ID 文案与 v2 契约逐字一致（`e3/contract.md:31-33`）。

## 6. 与 E4 的差异

| 维度 | E4（e4-qa） | E5（本报告） |
| --- | --- | --- |
| 入口 | v2 默认 + React `index.next.html` 并行 | 仅 `web/index.html` → `dist/index.html` |
| 构建产物 | 2 个 HTML；入口闭包 2 文件（harness + next），151364B | 1 个 HTML；入口闭包 1 文件，150301B（−1063B，±2KB 内） |
| 视觉 | 双入口各 21/21 | 单入口 21/21，基线零变化 |
| E2E | smoke 66 + parity 66 重复覆盖 | 两者删除，routes 66 保留；verify 137 passed |
| 入口配置 | E2E/预算按 `index.next.html` 适配 | 8 specs `entryUrl`；budget/manifest 键 `index.html` |
| v2 运行时 | 保留（回滚路径） | 删除 11 文件 2449 行；`git revert c1b7ed9` 可回滚 |
| 已知问题 | KI-1…KI-13 | 新增 KI-14（格式债）；KI-12 双入口差异自然消失 |

## 7. 残余风险与限制

1. **端口 8124**：被本机既有静态服务占用且无法结束，离线验收改用 8125。属本机环境，不影响仓库产物；E6 线上冒烟不依赖该端口。
2. **站点管理权限**：本会话无站点管理权限（`list_sites` 空、`get_site` 失败），无法在线复核 v2.0.1 的 private 访问策略；以描述文件未变、releaseId 未变、未调用 prepare/publish 作为「未发布」证据。E6 执行 prepare 前必须复核站点状态并取得用户确认。
3. **format:check 仍有既有格式债**（KI-14）：95 个文件在 E5 前即未格式化，未纳入 verify；E5 仅保证 README 格式化。计划 v3.0.0 后单独提交纯格式化变更。
4. **CI 未实际运行**（KI-13）：workflow 已存在但未推送；本轮全部门禁在本地 Windows 通过。
5. **Python 依赖 CDN**（KI-2）：`@python` 不在 verify 内，已单独执行通过；Pyodide 0.29.5 仍从 CDN 加载。
6. **Node 版本记录**：E5 开始时记录为 v24.22.1，G-E5 复核时实测 v22.15.0（与 `.nvmrc` 一致）；全部门禁未跳过。

## 8. 发布状态与回滚

- 未发布：未执行任何 `prepare_site` / `publish_site`；线上仍为 v2.0.1；`functions/`、数据库、访问策略、站点描述文件均未改动。
- 回滚：以 `e5-switch` 标签为基线，`git revert c1b7ed9` 可恢复 v2 运行时；`git revert <T-E5.1..T-E5.4 各提交>` 可退回双入口；标签本身可用 `git tag -d e5-switch` 撤销后重打。线上回滚路径保持 v2.0.1 release（描述文件中 releaseId 未变）。
- E6 预览入口：`dist/` 已为单入口 v3 产物，待 E6 冻结审计与线上发布确认。
