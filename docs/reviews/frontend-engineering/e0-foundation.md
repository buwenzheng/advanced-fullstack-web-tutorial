# G-E0 工程底座评审报告

- 阶段：E0 工程底座（shadow build）
- 完成时间：2026-11-10
- 标签：`e0-baseline`
- 结论：**通过**。v2 站点可由 Vite 原样构建；`web/`、`functions/` 相对 `v2.0.1` 无任何 diff；本地 `npm run verify` 全绿。

## 1. 前置检查（T-E0.0）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 工作区干净 | `git status --short` | 方案文档提交后无输出 |
| 基线标签 | `git rev-parse v2.0.1` | `aff10d1`（完整哈希见 baseline/git.txt） |
| Node | `node -v` | `v22.15.0` |
| npm | `npm --version` | `10.9.2` |
| registry | `npm view react version` | `19.3.1` |
| 内容审计 | `node tools/audit-content.mjs` | exit 0，errors=0 warnings=0 |
| JS 练习 | `node tools/run-js-exercises.mjs` | 38 道，failing=0 |
| SQL 练习 | `node tools/run-sql-exercises.mjs` | 2 道，failing=0 |

## 2. 保护性基线（T-E0.1）

新增 `tools/content-snapshot.mjs`（递归排序键 + SHA-256）与 `tools/route-matrix.mjs`（文本 / `--json` 字符串数组）。

```text
# docs/reviews/frontend-engineering/baseline/content-sha256.txt
sha256=f53ef3709599e7801fae93133bec6f9c3434ece3fb54b7491853c963ea24bab3
stages=9 lessons=45 projects=9 checks=135 exercises=79

# baseline/routes.txt
66 行
```

- `route-matrix.mjs --json` 输出 66 个字符串，首项 `#/`、末项 `#/report`，与 E2/E6 契约一致。
- `baseline/git.txt`：HEAD `877cc5d`、`v2.0.1` `aff10d1`。
- 依赖安装与 `npm ci` 后重跑哈希仍为 `f53ef370…`，内容未漂移。
- `baseline/stats.txt`：45 讲 / 3400 分钟。

## 3. 工程与依赖（T-E0.2）

- `package.json`：`type: module`、`private: true`、`engines.node >=22.12`；全部依赖精确版本，无 `^`/`~`。
- 直接依赖 29 个（3 runtime + 26 dev），`npm ls --depth=0` 无 missing / invalid。
- `npm ci` 由 lockfile 复现安装：exit 0，368 packages。
- `npm audit --omit=dev`：**0 vulnerabilities**（默认镜像不提供 audit 端点，改用 `registry.npmjs.org` + 本机代理执行）。
- `.nvmrc`：`22.15.0`；`.gitignore` 已追加 `node_modules/`、`dist/`、`coverage/`、`playwright-report/`、`test-results/`、`web/generated/`、`*.tsbuildinfo`、`.vite/`。

## 4. 构建与包体（T-E0.4）

`vite.config.ts`：`root: 'web'`、`base: './'`、`outDir: '../dist'`、无 sourcemap、target `baseline-widely-available`。

| 文件 | 原始 | gzip |
| --- | --- | --- |
| `dist/index.html` | 4,152 B | 1,934 B |
| `dist/assets/index-C7C4HMlC.css` | 42,552 B | 8,640 B |
| `dist/assets/index-CuUT27m2.js` | 1,422,361 B | 427,535 B |
| `dist/` 合计 | 1.5 MB | — |

- 102 个模块，构建 0.6 s；单入口单 chunk 为 v2 全量内容体积，E2/E3 路由懒加载后下降。
- 构建产物在 `http://127.0.0.1:4173/` 可预览；`s0-l1-ex-1` 填入答案后运行，提示「Node.js 轨道全部测试通过」，状态「已通过 · Node.js 轨道」，0 控制台错误（证据 `e0/exercise-check.txt`）。

## 5. 门禁结果（T-E0.3 / T-E0.6）

| 命令 | 结果 |
| --- | --- |
| `npm run lint` | exit 0，0 错误 |
| `npm run typecheck` | exit 0（应用 + node 两个项目） |
| `npm test` | exit 0，0 用例（`passWithNoTests`） |
| `npm run build` | exit 0，`dist/index.html` + 2 assets |
| `npx playwright test e2e/smoke.spec.ts --project=chromium` | 66/66 通过，0 控制台错误 |
| `npx playwright test e2e/visual.spec.ts --project=chromium` | 21/21 通过（生成后复跑稳定） |
| `npm run verify` | exit 0，153 passed / 21 skipped（mobile 视觉跳过） |
| `npm ci` | exit 0，lockfile 可复现 |
| 7 个内容/练习审计 | 全部 exit 0（`e0/audit.txt`） |

完整输出：`docs/reviews/frontend-engineering/e0/verify.txt`。

## 6. 冒烟与视觉基线（T-E0.5）

- `e2e/routes.json`：66 条，类型 `string[]`，元素形如 `#/lesson/s0-l1`。
- `e2e/smoke.spec.ts`：逐路由 `goto`、断言 `main h1` 可见、收集 `console.error` 与 `pageerror` 并断言为空；失败由 Playwright 自动截图到 `test-results/`。
- `e2e/visual.spec.ts`：7 页面 × 3 视口 = 21 张，`fullPage`、关闭动画、等待字体；仅 chromium 项目运行，标题含 `@visual`。
- 基线文件：`e2e/__screenshots__/<slug>-<viewport>.png`，共 21 张（13 MB）。
  - 页面：`home`、`stage-s0`、`lesson-s0-l1`、`lesson-s7-l5`、`project-p-graduation`、`lab`、`report`
  - 视口：`1440x900`、`768x1024`、`390x844`

## 7. 与 v2.0.1 的行为差异

```text
git diff --stat v2.0.1 -- web functions
（无输出）
```

- 业务源码与边缘函数零改动；新增的 `web/scripts/test/setup.ts` 仅为测试装配。
- 构建只做打包与哈希命名，不改路由、文案、练习判题、存储键与迁移逻辑。
- 唯一构建告警为单 chunk > 500 kB，属于后续阶段的优化项，不是行为差异。

## 8. 偏差记录

| 偏差 | 原因 | 处置 |
| --- | --- | --- |
| `vite.config.ts` 的 `server`/`preview` 显式 `host: '127.0.0.1'` | Windows 下 Vite 仅监听 `::1`，Playwright 的 `127.0.0.1` 连不上 | 只改配置，不改业务；本地与 CI 行为一致 |
| 视觉用例标题加 `@visual`，CI 用 `--grep-invert "@visual"` | 视觉基线由 Windows 生成，Ubuntu runner 字体渲染必然不同 | 与 E4「CI 排除 @visual」的约定对齐；E0 文档已同步 |
| 视觉等待字体改用 `page.waitForFunction('document.fonts.status === "loaded"')` | `tsconfig.node.json` 只有 ES2023，无 DOM 类型 | 字符串表达式不引入 DOM lib，保持 node 工具链类型干净 |
| `npm audit` 使用官方 registry | 当前镜像未实现 audit 接口 | 0 漏洞；默认镜像限制写入报告 |
| 第一次 `npm ci` 失败后重试 | 预览服务器占用 `node_modules` 文件 | 停止预览进程后 exit 0，不属于环境缺陷 |
| `jsdom@31.0.0` engines 要求 Node ≥22.22.2 | 方案锁定版本与 Node 22.15.0 不一致 | 按方案保留版本；实测 jsdom 可正常实例化，风险见 §9 |

## 9. 残余风险

| 风险 | 影响 | 缓解 | 触发信号 |
| --- | --- | --- | --- |
| 旧 JS 未纳入 Lint/格式化 | 旧代码质量问题暂时不可见 | E1 转 TS strict 后纳入 | E1 typecheck 报错集中出现 |
| Vitest 当前 0 用例 | 覆盖率阈值尚未生效 | E1/E2 起补单测，E4 启用覆盖率门禁 | `test:coverage` 无数据 |
| 单 chunk 1.42 MB / 427 KB gzip | 首屏下载偏大 | E2/E3 路由懒加载 + E4 包体门禁 | `npm run budget` 超限 |
| 视觉基线仅 Windows 有效 | CI 无法验证视觉 | CI 排除 `@visual`，发布前本地跑 | CI 出现视觉 diff |
| jsdom 31 的 engines 警告 | 新环境升级 Node 时可能出现兼容问题 | 统一 `.nvmrc` 22.15.0；E1 若失败再评估 | jsdom 初始化报错 |
| Playwright 浏览器下载依赖代理 | 新机器首次安装可能超时 | 记录使用本机 7890 代理 | `playwright install` 卡住 |

## 10. G-E0 门禁清单

- [x] `git status` 仅包含预期新增/修改文件
- [x] `npm ci` 可从 lockfile 复现安装
- [x] `npm run lint` 0 错误
- [x] `npm run typecheck` 0 错误
- [x] `npm test` 退出码 0
- [x] `npm run build` 成功，`dist/` 可 `npm run preview`
- [x] 66/66 路由冒烟通过，0 控制台错误
- [x] 21 张视觉基线生成并提交
- [x] 内容快照哈希与基线一致（`f53ef370…`）
- [x] 现有 7 个内容/练习审计脚本全部通过
- [x] 本报告完成
- [x] 标签 `e0-baseline` 创建

## 11. 证据索引

- `baseline/git.txt`、`baseline/content-sha256.txt`、`baseline/routes.txt`、`baseline/stats.txt`
- `e0/verify.txt`、`e0/npm-ci.txt`、`e0/audit.txt`、`e0/sizes.txt`、`e0/exercise-check.txt`
- `e2e/routes.json`、`e2e/smoke.spec.ts`、`e2e/visual.spec.ts`、`e2e/__screenshots__/**`
- 配置：`package.json`、`package-lock.json`、`tsconfig*.json`、`eslint.config.js`、`.prettierrc.json`、`.prettierignore`、`vitest.config.ts`、`playwright.config.ts`、`vite.config.ts`、`.github/workflows/verify.yml`
