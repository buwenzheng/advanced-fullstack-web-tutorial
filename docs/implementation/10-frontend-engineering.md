# 前端工程化改造方案（v3）：React 19 + Vite + TypeScript

> 状态：E0–E5 已执行并完成阶段标签；E6 的 Qoder Sites 私有发布于 2026-11-11 取消，v3 以纯静态产物交付并通过 GitHub Actions 发布到 GitHub Pages。
> 前置基线：v2.0.1（tag `v2.0.1`，原私有发布 release `01a1c34e-87a3-773c-86c3-f58087e01acd`）。
> 本方案取代 `00-master-plan.md` §1.3「不引入构建工具」的约束。
>
> **2026-11-11 变更说明**：站点归属旧 Qoder 账号，当前账号无权管理（`sites_request_failed`）。按用户决定取消 Qoder Site 发布，删除站点描述文件与线上发布专用产物；部署改为 GitHub Actions → GitHub Pages（`verify` 通过后自动发布，见 `.github/workflows/deploy.yml`），`functions/` 不随 Pages 发布。本文件 §3.3 发布行、§6 E6、§7 发布不变量、§8 站点风险、§9 发布 DoD、§11 E6 索引及 §12 中与站点发布相关的内容均以此说明为准；其余架构、质量门禁与兼容约束继续有效。E6.0/E6.1 的本地冻结与验证证据保留。

## 1. 结论

### 1.1 现状不是「生成的代码」，但已经触到维护上限

现有站点是无构建、零依赖、手写的原生 ES Modules 应用，不是生成器的产物：

- 97 个 JS 文件、30,856 行 JS、1,565 行 CSS；
- 手写 hash 路由、手写 `h()` DOM 渲染、手写代码高亮、手写迷你 SQL 引擎；
- 45 讲内容以结构化 JS 对象存放，约 1.6MB，启动时全量静态导入；
- 没有 `package.json`、构建、类型检查、Lint、单元测试、E2E、CI。

这套做法在 v2 是刻意选择：零依赖、可直接托管、任何环境都能改。但内容规模到 45 讲、3 万行后，成本已经超过收益：没有类型约束、视图靠命令式 DOM 拼接、每次改动只能靠人工浏览器回归、1.6MB 内容拖慢首屏、工具链与运行时各自维护一套加载逻辑。

结论：**保留内容资产与判题语义，重写工程层**。目标栈为 React 19 + Vite + TypeScript，内容层改为结构化 TS + Zod 构建期校验，采用渐进式迁移，v2.0.1 全程保持可运行、可回滚。

### 1.2 改造目标

| 目标 | 当前 | v3 验收 |
| --- | --- | --- |
| 类型安全 | 无 | TS strict，`tsc --noEmit` 0 错误 |
| 组件模型 | 手写 `h()` + 每页命令式拼装 | React 组件 + 路由级代码分割 |
| 内容校验 | 3 个手写审计脚本 | Zod schema + 审计脚本 + 构建前强制校验 |
| 自动化测试 | 仅内容/练习脚本 | Vitest 单元 + Playwright 66 路由 E2E + axe |
| 首屏内容 | 1.6MB 全量导入 | 目录索引 + 按阶段懒加载 + 搜索索引按需加载 |
| 构建与部署 | 手写静态文件 | Vite 构建 `dist/`，哈希产物，CI 校验 |
| 回归方式 | 人工浏览器 | 66 路由矩阵 + 视觉基线 + 控制台零异常门禁 |
| 回滚 | git 标签 | git 标签 + 现有 v2 release 双重基线 |

### 1.3 不做的事

- 不改课程内容语义、课时 ID、标题、时长、题目 ID、答案与测试；
- 不改 hash URL、`localStorage` 键、进度迁移规则；
- 不改 `functions/`（Deno 边缘函数）、不新增后端、不引入数据库；
- 不做 SSR/SSG、不做多语言 UI；部署到 GitHub Pages 时为公开静态站点，若需私有访问需改用其他托管；
- 不在迁移过程中发布半成品；v3 原计划在 E6 一次性私有发布（站点发布已于 2026-11-11 取消）；
- 不替换 Pyodide、SQL 引擎、代码高亮等判题语义（允许内部重构，行为必须一致）。

## 2. 现状架构盘点

### 2.1 分层与规模

| 层 | 文件 | 行数 | 机制 | 主要问题 |
| --- | --- | --- | --- | --- |
| 入口/路由 | `web/scripts/app.js` | 388 | 手写 `hashchange` + 6 条路由 + 搜索 + 抽屉 + 语言切换 | 路由、搜索、全局交互耦合在一个文件 |
| 视图 | `web/scripts/views/*.js` | 1,341 | 每页函数直接拼 DOM，`page.__dispose` 手动清理 | 无组件复用、状态同步靠手写订阅 |
| DOM 工具 | `web/scripts/ui.js` | 约 200 | `h()`、`toast()`、自制高亮器 | 无类型、XSS 边界靠约定 |
| 内容 | `web/scripts/content/**` | 26,973（80 文件） | 45 讲对象 + 9 阶段项目 + 毕业项目 + 各阶段 Python 映射 | 全量静态导入 1.6MB；Python 映射按代码块位置对齐，错位静默 |
| 判题引擎 | `web/scripts/engine/*.js` | 1,791 | JS Worker 模板字符串、Pyodide Worker、迷你 SQL 引擎 | Runner 源码在字符串里，无法单测；Worker 生命周期手写 |
| 状态 | `store.js` / `progress.js` / `migrate.js` / `lang.js` | 约 270 | 自制发布订阅 + localStorage | 无类型；迁移逻辑仅靠夹具脚本 |
| 样式 | `web/styles/*.css` | 1,565 | 设计令牌 + 布局 + 组件 + 课时 | 可保留，缺 stylelint/视觉回归 |
| 工具 | `tools/*.mjs` + `tools/lib` | 1,017 | 直接 import 内容 JS 做审计/跑题 | 与运行时各有一套内容加载逻辑 |
| 后端 | `functions/index.ts` + `handler.ts` | Deno | 同源 `/functions/v1/app` 演示接口 | 不在本次范围 |

### 2.2 运行时事实

- 静态入口：`web/index.html` 直接 `<script type="module" src="./scripts/app.js">`；
- 部署产物：`web/` 原样上传 + `functions/`；Qoder Sites `webDirectory: "web"`；
- Python：Pyodide `0.29.5`，从 `cdn.jsdelivr.net` 加载，仅在切到 Python 轨道时初始化；
- JS 判题：Blob Worker，内含 `assert`/`deepEqual`/超时/日志采集；
- SQL 判题：自研词法/语法/执行器，覆盖课程子集；
- 内容统计：45 讲、9 阶段、9 项目、3400 分钟、38 道 JS + 38 道 Python + 2 道 SQL 练习；
- 路由总数：45 讲 + 9 阶段 + 9 项目 + 总览/实验台/报告 = 66 条。

### 2.3 为什么必须工程化

1. **内容与视图都在膨胀**：任何一次改版都要同时改 7 个视图与 3 万行内容文件，没有类型帮助定位。
2. **回归成本高**：v2 的 M9 全量回归靠临时脚本 + 人工浏览器；没有可重复的 E2E 门禁。
3. **首屏浪费**：打开任意一讲都要加载全部 45 讲内容，搜索索引也在内存里全量构建。
4. **Python 映射脆弱**：`withPythonBlocks()` 按代码块出现顺序对齐，缺一条不会报错，只会少显示一段 Python。
5. **工具链重复**：`tools/lib/content.mjs` 与 `content/index.js` 各自做归一化，规则容易漂移。

## 3. 目标架构

### 3.1 技术选型

| 层 | 选型（精确版本） | 说明 |
| --- | --- | --- |
| 运行时 | React 19.3.1 + React DOM 19.3.1 | 组件模型成熟，生态与测试工具完整 |
| 路由 | React Router 7.18.5（`createHashRouter`） | 保持 `#/lesson/s0-l1` 等现有 URL 不变 |
| 构建 | Vite 7.3.8 + `@vitejs/plugin-react` 5.2.0 | 开发服务器、HMR、代码分割、哈希产物 |
| 语言 | TypeScript 5.9.3（strict） | 内容、引擎、状态、视图全量类型化 |
| 内容校验 | Zod 4.6.7（仅 devDependency） | 构建/测试期校验，不进运行时包 |
| 状态 | 现有 store + `useSyncExternalStore` | 状态很小，不引入 Redux/Zustand |
| 样式 | 保留现有 CSS 与设计令牌 | 类名不变，保证视觉零漂移；不引入 Tailwind/CSS-in-JS |
| 单测 | Vitest 5.1.0 + Testing Library 16.3.3 + jsdom 31 | 引擎、状态、内容 schema、组件 |
| E2E | Playwright 1.65.0 + `@axe-core/playwright` 4.14.0 | 66 路由、响应式、键盘、可访问性、视觉基线 |
| 质量 | ESLint 9.39.5 flat + typescript-eslint 8.72.2 + jsx-a11y 6.10.2；Prettier 3.9.10 | 0 错误门禁 |
| CI | GitHub Actions，Node 22.15.0 | `npm run verify`，无密钥 |
| 包管理 | npm（Node ≥ 22.12） | 锁 `package-lock.json`，版本登记到事实表 |

版本组合的兼容性依据（2026-11-10 用 `npm view` 核实）：

- TypeScript 选 5.9.3 而不是 7.0.2：typescript-eslint 8.72.2 的 peer 范围是 `>=4.8.4 <6.1.0`，尚不支持 TS 7；
- ESLint 选 9.39.5 而不是 10.14.0：`eslint-plugin-jsx-a11y` 6.10.2 的 peer 只声明到 ESLint 9；
- Vite 选 7.3.8 而不是 8.3.7：Vite 8 基于 Rolldown，`@vitejs/plugin-react` 6 还要求额外的 oxc/babel peer，迁移期不承担这层不确定性；
- React Router 选 7.18.5 而不是 8.5.1：7.x 的 `createHashRouter`/`RouterProvider` API 稳定，8.x 的破坏性变更与本次目标无关；
- Vitest 5.1.0 的 peer 明确支持 Vite 7，版本组合成立。

以上版本在 E0 以 `--save-exact` 写入 `package.json`，并登记到 `docs/facts/registry.md`。运行时依赖只有 `react`、`react-dom`、`react-router`；Zod、测试与构建工具全部是 devDependency。

### 3.2 目标结构

```text
package.json
vite.config.ts                  # root: 'web'，outDir: '../dist'，base: './'
tsconfig.json / tsconfig.node.json
eslint.config.js
playwright.config.ts
vitest.config.ts
web/                            # Vite root，仍是前端源码目录
  index.html                    # React 挂载点 + noscript
  scripts/
    main.tsx                    # 入口：RouterProvider
    app/
      router.tsx                # 6 条路由 + 错误边界 + Suspense
      shell/                    # Topbar / Sidebar / Search / LangSwitch / Drawer
    pages/                      # Overview / Stage / Lesson / Project / Lab / Report
    components/
      blocks/                   # 12 类内容块组件
      checks/                   # 单选/多选/点击检查
      exercises/                # code / design / mcq 练习
    content/
      types.ts                  # Lesson / Block / Check / Exercise / Stage / Project
      schema.ts                 # Zod schema（唯一类型来源，z.infer）
      stages/s0..s7/**          # 45 讲（.js → .ts，数据不变）
      stages/appendix/**
      graduation.ts
    engine/
      runner/                   # runner-core.ts（纯逻辑）+ js.worker.ts
      python/                   # pyodide.worker.ts + 桥接
      sql/                      # 词法/语法/执行器（TS 化）
    state/                      # store / progress / migrate / lang（TS + hooks）
    styles/                     # 现有 4 个 CSS 文件
    generated/                  # 构建生成：catalog.json、search-index.json（gitignore）
tools/                          # 内容快照、审计、练习执行、打包检查
functions/                      # 不变
dist/                           # Vite 构建产物（gitignore），可部署到任意静态服务器
```

### 3.3 运行与构建链路

```text
开发：npm run dev            → Vite (web/) → HMR
校验：npm run content:validate → Zod 校验 45 讲/9 项目/全部题目
构建：npm run build          → content:validate → content:build → tsc --noEmit → vite build → dist/
预览：npm run preview        → vite preview (dist/)
验收：npm run verify         → lint + typecheck + unit + content audit + build + e2e
交付：dist/ 为纯静态产物，由 GitHub Actions 发布到 GitHub Pages，也可部署到任意静态服务器（原 Qoder Sites 发布已取消）
```

### 3.4 内容加载策略

当前 1.6MB 内容全量进入入口包。v3 拆成三层：

1. **目录索引（eager，小）**：阶段、课时标题/时长/状态/关键词、项目摘要、题目 ID 与标题；用于侧栏、报告、搜索命中跳转。
2. **课时正文（lazy，按阶段）**：`import('../content/stages/s7/index')` 动态加载，Vite 自动切成 9 个阶段 chunk；课时页只加载所属阶段。
3. **搜索索引（lazy，按需）**：构建期从全量内容生成 `search-index.json`，首次聚焦搜索框时动态加载；保留现有「正文关键词命中」能力。

Python 映射在内容装配时合并：保留现有 `PYTHON_BLOCKS`/`PYTHON_TRACKS` 编写方式，但改为**构建期严格对齐**——JS 代码块数量与 Python 条目数量不一致、条目缺 `code/note`、练习缺 `starter/solution/tests` 都直接失败，不再静默跳过。

## 4. 内容类型与校验

### 4.1 类型模型（Zod 定义，`z.infer` 导出）

| 类型 | 关键字段 |
| --- | --- |
| `Stage` | `id`、`title`、`subtitle`、`duration`、`appendix`、`lessons`、`project` |
| `Lesson` | `id`、`title`、`subtitle`、`duration`、`status`、`objectives`、`keywords`、`blocks`、`checks`、`exercises` |
| `Block`（12 种判别联合） | `text` / `analogy` / `pitfall` / `note` / `tip` / `list` / `steps` / `code` / `table` / `compare` / `flow` / `case` |
| `Check` | `kind: 'mcq'`、`type: 'single' \| 'multi' \| 'click'`、`prompt`、`options[{text, correct}]`、`explain`、`tag?` |
| `Exercise` | `code{starter, solution, tests[], hint?}` / `design{checklist[], reference}` / `mcq` |
| `PythonBlockMap` | `Record<LessonId, { code, note }[]>`，与 JS 代码块一一对应 |
| `PythonTrackMap` | `Record<ExerciseId, { starter, solution, tests[] }>` |

### 4.2 校验门禁

- `content:validate` 校验：45 讲、9 阶段、9 项目、每讲 3 道检查、题目 ID 唯一、Python 映射完整；
- 与 `docs/content-manifest.json` 逐项比对 ID、顺序、时长；
- 保留现有审计：断链、重复段落、事实登记、模板完整性；
- **内容快照哈希**：E0 从 v2.0.1 生成规范化内容 JSON 的 SHA-256，E1/E3 每次迁移后必须一致，证明「只改类型、不改内容」。

## 5. 工程化基建

### 5.1 npm scripts

| 脚本 | 作用 |
| --- | --- |
| `dev` | `content:build` + Vite 开发服务器 |
| `build` | `content:validate` + `tsc --noEmit` + `vite build` |
| `preview` | 预览 `dist/` |
| `lint` / `format` | ESLint / Prettier |
| `typecheck` | `tsc --noEmit` |
| `test` / `test:watch` | Vitest |
| `e2e` | Playwright（构建后跑 preview） |
| `content:build` | 生成 catalog 与搜索索引 |
| `content:validate` | Zod + 清单 + Python 对齐校验 |
| `audit:content` / `audit:exercises` | 迁移现有 tools 脚本，作为独立门禁 |
| `verify` | lint + typecheck + test + content:validate + audit + build + e2e |

### 5.2 测试矩阵

| 层 | 工具 | 覆盖 |
| --- | --- | --- |
| 内容 | Zod + Vitest | 45 讲 schema、Python 对齐、清单一致、ID 唯一 |
| 引擎 | Vitest | runner 断言/超时/日志、SQL 词法/执行、Python 代码映射 |
| 状态 | Vitest + fake localStorage | 进度、草稿、语言、`s6-l* → a1..a6` 迁移夹具 |
| 组件 | Testing Library | 12 类内容块、检查题、练习交互、搜索键盘 |
| E2E | Playwright | 66 路由、0 控制台错误、390/768/1280 无横向滚动、键盘导航、axe 0 serious |
| 视觉 | Playwright 截图 | 总览/课时/实验台/报告在 3 个宽度的基线对比 |
| 包体 | 自定义 Node 脚本 | 入口 JS ≤ 180KB gzip、最大懒加载 chunk ≤ 150KB gzip、搜索索引 ≤ 300KB gzip |

覆盖率门槛：引擎与状态 ≥ 85% 行；组件 ≥ 60%；内容 schema 100% 课时。

### 5.3 CI

GitHub Actions `verify.yml`（push / PR）：

```text
node 22 → npm ci → lint → typecheck → test
        → content:validate → audit scripts → build
        → playwright install chromium → e2e
        → bundle budget check
```

Python 轨道 E2E 依赖 jsDelivr 网络，设为「允许失败并记录」，不阻塞主门禁；本地发布前必须手跑一次。

## 6. 迁移阶段

采用 strangler：v2 代码保持可运行，React 应用并行开发，全部 66 路由对齐后再切换入口。每个阶段结束打标签，失败只回退该阶段。

### E0 工程底座（0.5–1 人日）

- E0.1 `package.json` + lockfile + Node engines；安装 Vite/TS/ESLint/Prettier/Vitest/Playwright；
- E0.2 `vite.config.ts`：root `web/`、outDir `../dist`、base `./`；先用现有 `app.js` 做 shadow build，证明 Vite 能原样构建 v2；
- E0.3 `tsconfig`（先 `allowJs`）、ESLint flat + jsx-a11y、Prettier、Vitest、Playwright 骨架；
- E0.4 基线采集：66 路由清单、7 个核心页面 × 3 宽度的截图、内容快照 SHA-256、当前包体报告；
- E0.5 CI `verify.yml` 骨架。

**门禁 G-E0**：`npm run build` 产出的 `dist/` 与 v2.0.1 行为一致；66 路由 0 控制台错误；审计脚本全过；基线文件写入 `docs/reviews/frontend-engineering/baseline/`。标签 `e0-baseline`。

### E1 类型与内容模型（2–3 人日）

- E1.1 `content/types.ts` + `schema.ts`（Zod 判别联合）；
- E1.2 内容 80 个文件 `.js → .ts`，只做类型标注（`satisfies Lesson/Stage`），数据逐字节不变；
- E1.3 构建期内容装配：Python 映射严格对齐、catalog 与搜索索引生成；
- E1.4 引擎/状态 TS 化：`runner-core.ts` + `js.worker.ts` 拆分、Pyodide worker、SQL 引擎、store/progress/migrate/lang；
- E1.5 审计工具改从 TS 内容导入（`tsx`），输出与 v2 一致；
- E1.6 单测：schema、Python 对齐、迁移夹具、SQL、runner。

**门禁 G-E1**：`tsc --noEmit` 0；`content:validate` 45/9/全部题目通过；内容快照哈希与 E0 一致；审计输出与 v2 一致；单测全绿。标签 `e1-typed`。

> 旧 `views/*.js` 不在 E1 转 TS，E3 会被 React 页面整体替换，避免重复投入。

### E2 React 外壳（1–2 人日）

- E2.1 `main.tsx` + `router.tsx`：6 条路由、错误边界、Suspense、路由切换焦点与滚动复位；
- E2.2 Shell：Topbar、Sidebar（阶段树 + 进度计数）、搜索 combobox、语言切换、抽屉、skip link、toast、清空进度；
- E2.3 状态 hooks：`useProgress` / `useLang`（`useSyncExternalStore` 包装现有 store）；
- E2.4 六个页面骨架，React 应用通过 `web/index.next.html` 并行运行，v2 入口保持默认。

**门禁 G-E2**：React 外壳 66 路由可解析；侧栏/搜索/键盘行为与 v2 一致；0 控制台错误。标签 `e2-shell`。

### E3 视图与交互迁移（2–3 人日）

- E3.1 总览页、阶段页；
- E3.2 课时页 + 12 类内容块组件 + 代码轨道切换 + 检查题；
- E3.3 练习组件：代码运行/重置/草稿/结果、SQL 执行、方案题自检清单、选择题；
- E3.4 项目页 + 毕业项目模板复制；实验台；学习报告；
- E3.5 阶段内容懒加载 + 搜索索引按需加载；
- E3.6 视觉基线对比与逐页功能清单。

**门禁 G-E3**：现有功能 100% 对齐（逐页 checklist）；四类任务（mcq/code/sql/design）可运行；进度/草稿/旧进度迁移夹具通过；视觉差异仅允许加载态；0 控制台错误。标签 `e3-parity`。

### E4 质量门禁（1–2 人日）

- E4.1 E2E：66 路由 + 控制台门禁 + 响应式 + 键盘 + axe；
- E4.2 视觉回归基线入库；
- E4.3 包体预算与懒加载验证；
- E4.4 CI 全量跑通；覆盖率达标。

**门禁 G-E4**：`npm run verify` 全绿；axe 0 serious；包体达标；视觉基线稳定。标签 `e4-qa`。

### E5 切换与清理（0.5–1 人日）

- E5.1 默认入口切到 React；删除仅以 v2 为 oracle 的 `smoke.spec.ts` / `parity.spec.ts`；`dev` 先构建内容；
- E5.2 单入口收敛：删除 `web/index.next.html`、`dev:next` / `preview:next`，E2E 常量与工具入口键改为 `index.html`；
- E5.3 删除 v2 运行时与配置：`app.js`、`views/*`、`ui.js`、`engine/exercise.js`、`dev_server.py`，清理 `allowJs`；
- E5.4 更新 `README.md`、`00-master-plan.md`、`09-qa-release.md` 的命令与目录说明；
- E5.5 全量 `verify` + 单入口视觉 / Python + 离线 `dist` 复验；
- E5.6 G-E5 报告与标签 `e5-switch`。

**门禁 G-E5**：无旧入口引用；`verify` 全绿；`dist/` 可离线静态服务。标签 `e5-switch`。

### E6 私有发布 v3.0.0（0.5 人日）

> 2026-11-11 状态变更：E6.1–E6.3（prepare、publish、线上冒烟）不再执行；E6.4 的发布说明与 `v3.0.0` 标签未执行。站点发布与线上验收取消，E6.0/E6.1 的本地冻结与验证证据仍有效。

- E6.1 `prepare_site`：同一 projectId/siteId，`webDirectory: "dist"`、`functionDirectory: "functions"`、`databaseAccess: "none"`、`spa: true`、新 actionId；
- E6.2 `publish_site` 并确认 `published: true`、访问范围仍为 `private`、函数 `app` 正常；
- E6.3 线上冒烟：66 路由（登录态）、四类任务（mcq/code/sql/design）、进度迁移；
- E6.4 `docs/release-notes-v3.md`、评审报告、标签 `v3.0.0`。

**门禁 G-E6（已取消，2026-11-11）**：原要求为发布成功且私有、线上冒烟通过、回滚路径确认；站点发布取消后不再适用。

总工期：约 7–12 人日（单人对现有代码熟悉，不含课程内容修订）。

## 7. 不变量与兼容

| 项 | 要求 |
| --- | --- |
| URL | `#/`、`#/stage/:id`、`#/lesson/:id`、`#/project/:id`、`#/lab`、`#/report` 不变 |
| 进度存储 | `bff-lab-progress-v1`、`bff-lab-drafts-v1`、`bff-lab-lang-v1` 键名与结构不变 |
| 旧进度迁移 | `s6-l1..l6 → a1..a6`，题目 ID 含 `@py` 后缀，迁移只执行一次，夹具测试保留 |
| 内容 | 课时/题目 ID、标题、时长、顺序、答案、测试不变；快照哈希证明 |
| 判题语义 | JS 断言/超时、Python Pyodide 行为、SQL 语义与 v2 一致 |
| 后端 | `functions/` 不改；`DEMO_SECRET` 不变；不新增数据库 |
| 发布（已取消） | 原计划：始终私有；复用 projectId/siteId；新 actionId；打包必须含 `dist` + `functions`；2026-11-11 起不再执行 |
| 回滚 | v2.0.1 标签与现有 release 保留；任一阶段失败只回退该阶段标签 |

原发布输入的唯一变化：`webDirectory` 从 `"web"` 改为 `"dist"`。该发布路径已于 2026-11-11 取消；`dist/` 现作为纯静态产物交付，可直接部署到任意静态服务器。

## 8. 风险与对策

| 风险 | 表现 | 对策 |
| --- | --- | --- |
| 内容在 TS 化中漂移 | 字段丢失、转义变化、顺序变化 | 逐字节快照哈希 + Zod + 现有审计三线校验 |
| React 重写视觉回归 | 类名/结构变化导致样式错位 | CSS 与类名不变；E0 视觉基线；E3 逐页 diff |
| 路由/深链破坏 | 旧书签失效 | hash URL 保持不变；66 路由矩阵；旧进度夹具 |
| Worker 重构影响判题 | 超时/日志/断言行为变化 | 先抽纯逻辑单测，再替换 Worker 包装；四类任务全量跑题 |
| 首屏仍过大 | 内容/索引进入入口包 | catalog 与正文分离；懒加载；包体预算 CI 门禁 |
| Pyodide 网络/打包问题 | Worker 加载失败 | 版本锁定；Worker 用 Vite 原生方式打包；E2E 标注网络依赖 |
| localStorage 破坏 | 用户进度丢失 | 键名不变；迁移夹具；发布前手工注入旧数据验证 |
| 静态托管差异 | 打包失败/404 | `base: './'` 相对路径；本地 preview 验证；任意静态服务器可部署 |
| 迁移战线过长 | 半成品长期并行 | 每阶段可独立回退；允许在 E1 后暂停（已获得类型与构建收益） |
| CI 环境差异 | 本地过、CI 挂 | Node 22 锁定；Playwright 固定版本；无密钥、无外部服务 |

## 9. 验收标准（v3 DoD）

- [ ] `npm ci && npm run verify` 从零可复现通过；
- [ ] `tsc --noEmit` 0 错误；ESLint 0 错误；Prettier 已格式化；
- [ ] Zod 校验 45 讲/9 阶段/9 项目/全部检查与练习通过；内容快照与 v2.0.1 一致；
- [ ] 单测覆盖率达标；Python 映射对齐测试覆盖全部课时；
- [ ] Playwright 66 路由 0 控制台错误；390/768/1280 无横向滚动；键盘可完成导航与答题；
- [ ] axe 0 serious/critical；单一 h1、对比度、可访问名称保持 v2 水平；
- [ ] 入口 JS ≤ 180KB gzip；最大懒加载 chunk ≤ 150KB gzip；搜索索引 ≤ 300KB gzip；
- [ ] 视觉基线与 v2.0.1 一致（仅允许加载态差异）；
- [ ] 旧进度夹具迁移正确；四类任务在浏览器内可运行；
- [ ] README/总纲/QA 文档更新；交付说明与评审报告齐全；
- ~~v3.0.0 私有发布成功，访问范围 private~~：2026-11-11 取消站点发布，改为 `dist/` 纯静态交付；`functions/` 未被改动。

## 10. 执行顺序（历史记录）

1. 打保护标签 `v2.0.1`（已存在），确认工作区干净；
2. 执行 E0.1–E0.5，产出基线文件与 `dist/` shadow build；
3. G-E0 通过后再做 E1 类型化，未过门不写 React 代码；
4. 任一阶段失败：回退到该阶段标签，保留评审记录，不跨阶段修补。

## 11. 执行文档索引

本文件是总纲；真正执行时只读「总纲 + 当前阶段文档」，不跨阶段预读实现细节，避免提前引入后续设计。

| 阶段 | 执行文档 | 覆盖 | 门禁 |
| --- | --- | --- | --- |
| E0 | `11-e0-engineering-foundation.md` | npm 工程、Vite shadow build、TS/Lint/Vitest/Playwright、66 路由与视觉基线、CI | G-E0 |
| E1 | `12-e1-types-and-content.md` | Zod 类型、80 个内容文件 TS 化、内容装配、引擎/状态 TS 化、工具迁移、单测 | G-E1 |
| E2 | `13-e2-react-shell.md` | React 入口、hash 路由、Topbar/Sidebar/搜索/语言切换/抽屉、状态 hooks | G-E2 |
| E3 | `14-e3-views-and-interaction.md` | 6 个页面、12 类内容块、检查题、四类任务、项目页、实验台、报告、懒加载 | G-E3 |
| E4 | `15-e4-quality-gates.md` | 66 路由 E2E、控制台门禁、axe、响应式、视觉回归、包体预算、CI 全量 | G-E4 |
| E5 | `16-e5-switch-and-cleanup.md` | 默认入口切换、删除旧代码、文档更新、全量复验 | G-E5 |
| E6 | `17-e6-release-v3.md` | 已取消（2026-11-11）：原计划 `dist/` 打包、私有发布、线上冒烟、v3.0.0 标签与发布说明；本地验证证据保留 | — |

执行顺序固定为 E0 → E1 → E2 → E3 → E4 → E5；E6 站点发布已取消（2026-11-11）。每个阶段结束时必须提交该阶段文档中列出的证据，并打阶段标签。

## 12. 变更控制与偏离判定

### 12.1 允许的变更

- 任务卡明确列出的文件、依赖、脚本与配置；
- 为满足门禁而做的修复，但必须写进本阶段评审报告的「问题与修复」；
- 文档中明确标注「可选」的增强项，且不改变验收标准。

### 12.2 必须停下来报告的偏离

出现以下任一情况，停止执行，更新本方案并取得确认后再继续：

- 想改课程内容语义、课时/题目 ID、标题、时长、答案或测试；
- 想改 hash URL、`localStorage` 键、进度迁移规则；
- 想新增课程、页面、功能（暗色主题、i18n、SSR、PWA、后端接口等）；
- 想引入框架（Vue/Next/Astro）、状态库（Redux/Zustand）、UI 库、CSS 框架或任何未列出的运行时依赖；
- 想降低任何验收标准、跳过门禁、跳过视觉/可访问性检查；
- ~~想在 E6 之前发布，或把站点改为公开~~（站点发布已于 2026-11-11 取消，此条不再适用）；
- 想修改 `functions/`、数据库或访问策略。

### 12.3 发现旧缺陷时

迁移期发现 v2 已有缺陷时：

1. 先判断是否阻塞当前阶段门禁；
2. 不阻塞：记入 `docs/reviews/frontend-engineering/known-issues.md`，保持行为不变，后续单独修；
3. 阻塞：只做最小修复，补回归测试，写入本阶段报告，并同步更新内容快照差异说明。

禁止借迁移之名顺手重构、改文案、调样式或“优化”课程内容。

### 12.4 每个任务的自检三问

- 这个改动是否在任务卡的「产出」列表里？
- 是否改变了 10 §7 的任一不变量？
- 如果现在回滚到上一个阶段标签，站点是否仍可运行？

任一答案为「否」或「不确定」，先停。

## 13. 证据与报告规范

每个阶段报告写入 `docs/reviews/frontend-engineering/<phase>.md`，必须包含：

1. 执行环境：日期、Node/npm、依赖锁定版本、分支与起始提交；
2. 命令与输出摘要：每条门禁命令一行，附退出码与实际数字；
3. 基线对比：内容快照哈希、包体大小、路由数、测试数量；
4. 浏览器证据：截图路径、视口、控制台错误数；
5. 问题与修复：现象、根因、修复、复验；
6. 残余风险：明确写「无」或列出；
7. 门禁结论：通过 / 有条件通过 / 不通过；
8. 标签与提交：阶段标签名、提交哈希。

「已检查」「正常」不算证据；必须能指向命令输出、截图或报告章节。
