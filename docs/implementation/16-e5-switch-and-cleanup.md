# E5：默认入口切换与旧代码清理

> 上级：`10-frontend-engineering.md` §5、§6 E5、§7；前置：`15-e4-quality-gates.md`。
> 目标：把 React 应用从并行入口提升为唯一默认入口，删除 v2 运行时代码与 `dev_server.py`，把 E2E、包体预算、工具与文档全部收敛到单入口；不改变课程内容、hash URL、`localStorage` 键、视觉基线与 `functions/`。
> 工期：0.5–1 人日。完成定义：G-E5 通过，标签 `e5-switch`。

## 1. 阶段边界

### 1.1 本阶段做

- **入口切换**：重写 `web/index.html`，body 只保留 `noscript`、`#root` 与 `scripts/main.tsx`；静态外壳节点全部交给 React（`AppShell` / `Topbar` / `Sidebar` / `ToastProvider`）；
- **单入口收敛**：删除 `web/index.next.html`；`vite.config.ts` 回到单 HTML 入口；删除 `dev:next` / `preview:next`；
- **旧代码删除**：`web/scripts/app.js`、`web/scripts/ui.js`、`web/scripts/views/**`（7 个）、`web/scripts/engine/exercise.js`、`dev_server.py`；
- **E2E 收敛**：所有 spec 从 `/index.next.html` 指向 `/`；删除仅以 v2 为 oracle 的 `smoke.spec.ts` / `parity.spec.ts`；`visual.spec.ts` 删除 `VISUAL_ENTRY`；
- **工具收敛**：`tools/bundle-budget.ts` 与 `e2e/lib/manifest.ts` 的入口键从 `index.next.html` 改为 `index.html`；
- **配置清理**：`tsconfig.json` 删除 `allowJs` / `checkJs` 与 `*.js` include；`.prettierignore` 删除 `web/scripts/**/*.js`；
- **文档更新**：重写 `README.md`；更新 `00-master-plan.md` 的工程约束与预览命令；更新 `09-qa-release.md` 的本地预览、R10 产物描述与 v3 发布指向；
- **全量复验**：`npm run verify`、单入口视觉 21/21、Python 轨道、`dist/` 离线静态服务。

### 1.2 本阶段不做

- 不改 `web/styles/**`、`web/scripts/content/**` 的课程正文、练习答案、测试与文案；
- 不改 hash URL、`localStorage` 键（`bff-lab-progress-v1` / `bff-lab-drafts-v1` / `bff-lab-lang-v1`）与 `s6-l1..l6 → a1..a6` 迁移规则；
- 不删除 `web/scripts/content/index.ts`、`web/scripts/content/search.ts`、`web/generated/`、`e2e/__screenshots__/`、`e2e/routes.json`；
- 不重新生成视觉基线；入口切换必须逐像素匹配既有 21 张基线，任何 diff 按缺陷处理；
- 不新增/升级依赖；不改 `playwright.config.ts` 的端口、projects 与截图参数；
- 不改 `functions/`、数据库、访问策略、`.后端进阶实验室.qoder.site` 描述文件；
- 不执行 `prepare_site` / `publish_site`，不切换 `webDirectory`（E6 负责）；
- 不重写历史执行文档（E0–E4 保留原样），只在总纲与 QA 文档更新现行命令；
- 不做与切换无关的格式化或重构；`web/scripts/content/**` 仍排除在 Prettier 之外。

### 1.3 本阶段结束时的可运行形态

- `npm run dev` 直接打开 React 站点（5173），`npm run preview` 预览 `dist/`（4173）；
- `dist/` 只有一个 HTML 入口 `index.html`，不再产出 `index.next.html`；
- 66 条 hash 路由、12 类内容块、四类任务、HTTP 实验台、学习报告全部在默认入口可用；
- 仓库中不存在 v2 入口、视图、UI 工具与旧判题包装；`web/scripts/**` 下无 `.js` 文件；
- `npm run verify` 全绿；单入口视觉 21/21；`dist/` 可被任意静态服务器离线服务；
- 站点仍是 v2.0.1 的私有发布版本，未发布 v3。

## 2. 前置条件

| 检查 | 命令 | 通过标准 |
| --- | --- | --- |
| 阶段标签 | `git tag --list e4-qa` | 输出 `e4-qa` |
| 工作区 | `git status --short` | 无业务文件改动；仅方案文档可未跟踪 |
| Node | `node -v` | `v22.15.0` |
| Python | `python -V` | `3.11.x`（离线静态服务用） |
| 依赖 | `npm ci` | 0 error |
| E4 门禁 | `npm run verify` | 全绿 |
| 双入口 | `npm run build && ls dist/index.html dist/index.next.html` | 两个文件都存在 |
| 视觉基线 | `git ls-files e2e/__screenshots__ \| wc -l` | `21` |
| 双入口视觉 | `npx playwright test e2e/visual.spec.ts --project=chromium` 与 `VISUAL_ENTRY=index.next.html npx playwright test e2e/visual.spec.ts --project=chromium` | 21/21 + 21/21 |
| 路由清单 | `node -e "console.log(require('./e2e/routes.json').length)"` | `66` |
| E4 报告 | `ls docs/reviews/frontend-engineering/e4` | 覆盖率、包体、懒加载、a11y 报告齐全 |
| 生成物 | `ls web/generated` | `catalog.json`、`search-index.json` 存在 |
| 旧入口引用 | `git grep -n "index.next.html" -- e2e tools package.json vite.config.ts` | 仅 E2–E4 建立的预期引用，无其他来源 |

任一检查失败先修复基线，不进入 E5。E5 的删除动作不可在红灯状态下开始。

## 3. 入口切换设计

### 3.1 切换原则

1. **一次只扩大一步**：先把 `web/index.html` 换成 React 外壳，同时保留 `index.next.html` 一个提交，让构建仍产出两个 HTML、全部 E2E 仍可通过；下一任务再删除重复入口与多入口配置。禁止在同一个提交里既换入口又删旧代码。
2. **静态外壳不复制**：切换到 React 后，`index.html` 只负责文档头、`noscript`、`#root` 与模块脚本。`.skip-link`、`.app`、`.topbar`、`#sidebar`、`#main`、`#scrim`、`#toast-host` 全部由 React 渲染，HTML 中不得残留，否则会出现重复节点、双重 `h1` 或 E2E 选择器歧义。
3. **head 不变**：charset、viewport、title、description、theme-color、favicon、4 个 CSS 链接逐字保留。入口切换不允许顺带改 SEO、配色或字体。
4. **脚本只有一个**：`./scripts/main.tsx`。不得保留 `./scripts/app.js` 的 `defer`/`module` 形式，也不得用内联脚本做入口重定向。

### 3.2 `web/index.html` 最终内容

把现有 v2 的 `<head>` 原样保留，`<body>` 整体替换为以下内容（最终文件）：

```html
<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>后端进阶实验室 · AI 时代资深全栈</title>
<meta name="description" content="为有前端基础的同学设计的体系化进阶站：从请求、数据、API、缓存与韧性到生产化、分布式、全栈集成与 AI 应用，配可自动验证的练习与递进式项目，目标成为 AI 时代的资深全栈工程师。" />
<meta name="theme-color" content="#070B12" />
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230A0F19'/%3E%3Cpath d='M8 11l5 5-5 5' stroke='%232DD4BF' stroke-width='2.4' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M16 21h8' stroke='%23F5B544' stroke-width='2.4' stroke-linecap='round'/%3E%3C/svg%3E" />
<link rel="stylesheet" href="./styles/tokens.css" />
<link rel="stylesheet" href="./styles/layout.css" />
<link rel="stylesheet" href="./styles/components.css" />
<link rel="stylesheet" href="./styles/lesson.css" />
</head>
<body>
<noscript>
  <div class="noscript">这个学习站的讲解可以阅读，但练习需要在浏览器里执行 JavaScript。请启用 JavaScript 后再开始。</div>
</noscript>
<div id="root"></div>
<script type="module" src="./scripts/main.tsx"></script>
</body>
</html>
```

必须逐字满足：

- 没有 `<a class="skip-link">`：由 `AppShell` 渲染；
- 没有 `header.topbar`、`aside#sidebar`、`main#main`、`#scrim`、`#toast-host`、`div.app#app`；
- 没有对 `app.js` 的引用；
- `<div id="root">` 恰好一个。

### 3.3 静态节点归属对照

| 旧 `web/index.html` 静态节点 | 切换后归属 | 切换后 HTML 中是否保留 |
| --- | --- | --- |
| `.skip-link` | `AppShell` | 否 |
| `header.topbar`、`#menu-toggle`、brand、搜索框、语言切换、实验室/报告链接、进度环 | `Topbar`（搜索与语言为独立组件） | 否 |
| `aside#sidebar`、`#sidebar-nav`、`#reset-progress` | `Sidebar` / `ResetProgress` | 否 |
| `main#main` | `AppShell` | 否 |
| `#scrim` | `AppShell` | 否 |
| `#toast-host` | `ToastProvider` | 否 |
| `div.app#app` | `AppShell` | 否 |
| `#root` | `main.tsx` 挂载点 | 是 |

### 3.4 保留 `index.next.html` 一个提交

T-E5.1 完成后：

- `web/index.html` 与 `web/index.next.html` 都指向 `./scripts/main.tsx`；
- Vite 仍按 E2 的双入口配置构建，`dist/` 同时产出两个 HTML；
- 默认入口 `/` 已是 React，`/index.next.html` 仍可访问；
- 该状态只用于让 E2E 与视觉验证连续通过，T-E5.2 立即删除重复入口。

不允许把该中间态发布或打标签。

### 3.5 验证命令

```bash
npm run build
find dist -maxdepth 1 -name "index*.html" -print
grep -c 'id="root"' dist/index.html
grep -c 'app.js' dist/index.html
```

预期：

- `dist/index.html` 与 `dist/index.next.html` 同时存在（中间态）；
- `id="root"` 计数为 `1`；
- `app.js` 计数为 `0`（`grep` 无匹配时退出码为 1，属于预期，不要加 `|| true` 掩盖其他错误）；
- 打开 `http://127.0.0.1:4173/#/` 与 `#/lesson/s0-l1` 正常；
- 控制台无错误。

### 3.6 回滚

- 本任务只改 `web/index.html`；`git revert <commit>` 即可恢复 v2 静态入口；
- 旧 JS 与 `index.next.html` 尚未删除，回滚不需要恢复其他文件；
- 不移动标签、不重写历史。

## 4. 单入口收敛

### 4.1 `vite.config.ts`

删除 `htmlEntry` 辅助函数、`fileURLToPath` 导入与 `rollupOptions.input`，回到 E0 的单入口形态：

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'web',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'baseline-widely-available',
    manifest: true,
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
```

要求：

- 保留 `manifest: true`（E4 包体与懒加载断言依赖 `dist/.vite/manifest.json`）；
- 保留 `root` / `base` / `outDir`；不改成项目根，不改到 `web/dist`（E6 回退方案才用）；
- 不再保留 `rollupOptions`；如果 Vite 默认入口找错文件，先检查 `root: 'web'` 与文件名，不得用多入口掩盖。

### 4.2 删除重复入口

```bash
git rm web/index.next.html
```

删除后：

```bash
npm run build
find dist -maxdepth 1 -name "index*.html" -print
```

预期只输出 `dist/index.html`。

### 4.3 `package.json` scripts 最终形态

在 E4 §7.1 基础上只做三处变化：`dev` 先构建内容；删除 `dev:next`、`preview:next`；其余保持不变。

其中 `dev` 的调整随 T-E5.1 一起提交：默认入口在切换那一刻起就依赖 `web/generated/`，不能等到 T-E5.2 才修。T-E5.2 只负责删除两个 `*:next` 脚本。

```json
{
  "scripts": {
    "dev": "npm run content:build && vite --open",
    "build": "npm run content:validate && npm run content:build && npm run typecheck && vite build",
    "preview": "vite preview",
    "lint": "eslint \"web/scripts/**/*.{ts,tsx}\" \"tools/**/*.ts\" \"e2e/**/*.ts\" \"*.config.{ts,js}\" --no-error-on-unmatched-pattern",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.node.json --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "content:validate": "tsx tools/validate-content.ts",
    "content:build": "tsx tools/build-content.ts",
    "content:snapshot": "tsx tools/content-snapshot.ts",
    "audit:content": "tsx tools/audit-content.ts",
    "audit:exercises": "tsx tools/run-js-exercises.ts && tsx tools/run-sql-exercises.ts",
    "audit:python": "tsx tools/run-python-exercises.ts",
    "check:links": "tsx tools/check-links.ts",
    "check:duplication": "tsx tools/check-duplication.ts",
    "check:facts": "tsx tools/check-facts.ts",
    "test:migration": "tsx tools/test-progress-migration.ts",
    "budget": "tsx tools/bundle-budget.ts",
    "e2e": "npm run build && playwright test --project=chromium",
    "e2e:visual": "playwright test e2e/visual.spec.ts --project=chromium",
    "e2e:python": "playwright test --project=chromium --grep @python",
    "e2e:update": "npm run build && playwright test --project=chromium --grep @visual --update-snapshots",
    "verify": "npm run lint && npm run typecheck && npm run test:coverage && npm run content:validate && npm run audit:content && npm run audit:exercises && npm run build && npm run budget && playwright test --project=chromium --grep-invert \"@visual|@python\""
  }
}
```

说明：

- `dev` 必须先 `content:build`：`web/generated/` 是 gitignored 的生成物，新克隆直接 `vite` 会缺 catalog 与搜索索引；
- `preview` 不重复构建，要求先执行 `npm run build`；这与 Playwright `webServer` 的行为一致；
- `build`、`verify` 的步骤顺序不变，E4 的覆盖率与包体门禁继续生效；
- 不新增 `clean`、`serve` 等脚本。

### 4.4 E2E 入口常量

新增 `e2e/lib/entry.ts`，作为唯一入口常量：

```ts
export const ENTRY = '/';

export const entryUrl = (route: string) => `${ENTRY}${route}`;
```

所有 spec 改为：

```ts
import { entryUrl } from './lib/entry';

await page.goto(entryUrl('#/lesson/s0-l1'));
```

替换规则：

| 旧写法 | 新写法 |
| --- | --- |
| `const reactUrl = (route: string) => \`/index.next.html${route}\`;` | `import { entryUrl } from './lib/entry';` |
| `page.goto('/index.next.html#/')` | `page.goto(entryUrl('#/'))` |
| `page.goto(\`/index.next.html${route}\`)` | `page.goto(entryUrl(route))` |
| `const ENTRY = '/index.next.html'` | 删除本地常量，统一导入 `entryUrl` |
| `await page.goto('/')`（旧 smoke） | 随 smoke 删除 |

`e2e/routes.spec.ts` 中 E4 的 `const ENTRY = '/index.next.html'` 与 `${ENTRY}${route}` 一并替换为 `entryUrl(route)`；不得保留第二个入口常量。

### 4.5 spec 处置表

| spec | 处置 | 说明 |
| --- | --- | --- |
| `e2e/smoke.spec.ts` | **T-E5.1 删除** | 唯一职责是 v2 66 路由冒烟；v2 入口被替换后 oracle 消失，React 路由由 `routes.spec.ts` 唯一覆盖 |
| `e2e/parity.spec.ts` | **T-E5.1 删除** | v2 与 React 双入口逐页正文对等；v2 删除后无法运行，E3 的对等结论保留在报告与标签中 |
| `e2e/shell.spec.ts` | 保留并改入口 | React 外壳行为：侧栏规模、搜索、语言、抽屉、重置 |
| `e2e/content.spec.ts` | 保留并改入口 | 内容块、文本专项、懒加载与搜索索引网络断言 |
| `e2e/interactions.spec.ts` | 保留并改入口 | 四类任务、项目、实验台、报告；`@python` 标签不变 |
| `e2e/routes.spec.ts` | 保留并改入口 | 66 路由 + 控制台门禁 |
| `e2e/responsive.spec.ts` | 保留并改入口 | 三档宽度与抽屉 |
| `e2e/keyboard.spec.ts` | 保留并改入口 | skip link、焦点、combobox、MCQ |
| `e2e/a11y.spec.ts` | 保留并改入口 | axe 7 页 × 2 宽度 |
| `e2e/visual.spec.ts` | 保留并单入口化 | 删除 `VISUAL_ENTRY`；21 张基线不改名 |

删除前确认：

```bash
grep -R "smoke.spec\|parity.spec" .github docs tools e2e package.json --include=*.yml --include=*.json --include=*.ts --include=*.md
```

只允许命中历史 E0–E4 执行文档与对应阶段报告；CI workflow、`package.json`、`verify` 不得引用被删 spec。

### 4.6 `visual.spec.ts` 单入口化

删除：

```ts
const ENTRY = process.env.VISUAL_ENTRY || '';
```

页面跳转统一改为：

```ts
await page.goto(entryUrl(route));
```

要求：

- 测试标题继续不包含入口名，快照名保持 21 个不变；
- 不修改 `playwright.config.ts` 的 `expect.toHaveScreenshot`、`reducedMotion` 与截图路径；
- 不执行 `--update-snapshots`；21 张基线必须原样通过；
- 若出现 diff，先定位 CSS 注入顺序、字体加载或静态 shell 重复节点，禁止用更新基线掩盖；
- `verify` 继续排除 `@visual`：CI 是 Linux，基线是 Windows 生成的，逐像素不可比。E4 §12.2 所说的“默认入口视觉唯一基线”指**入口与文件唯一**，不是把视觉并入 CI；本地发布前仍必须单独执行 `npm run e2e:visual`。

### 4.7 工具入口键

`tools/bundle-budget.ts`：

```ts
const reactKey = Object.keys(manifest).find(
  (key) => manifest[key].isEntry && key.endsWith('index.html'),
);
if (!reactKey) throw new Error('manifest 中找不到 index.html 入口');
```

报告行改为：

```ts
['entry (index.html)', entryGzip, LIMITS.entry],
```

`e2e/lib/manifest.ts`：

```ts
const key = Object.keys(manifest).find(
  (item: string) => manifest[item].isEntry && item.endsWith('index.html'),
)!;
```

要求：

- 只改入口键与展示名，不改预算数值（180 / 150 / 300KB）与 gzip 等级；
- 不改 `entryClosure()` 的递归语义；
- 改完后 `npm run budget` 必须仍为三项 PASS，并与 E4 报告的入口 gzip 差异在 ±2KB 内；若明显变小，检查是否漏算共享 chunk。

### 4.8 验证命令

```bash
npm run build
npm run budget
npx playwright test e2e/routes.spec.ts --project=chromium
npx playwright test e2e/content.spec.ts e2e/interactions.spec.ts --project=chromium --grep-invert "@python"
npx playwright test e2e/visual.spec.ts --project=chromium
```

预期：

- `dist/` 只有 `index.html`；
- 包体三项 PASS；
- 66 路由全过、0 控制台错误；
- 内容与交互专项全过；
- 单入口视觉 21/21。

### 4.9 回滚

- `git revert` 本任务提交：恢复 `index.next.html`、双入口配置、`dev:next` / `preview:next`、E2E 常量与工具入口键；
- 视觉基线未改动，回滚不需要恢复快照；
- 若只想临时恢复双入口排查，重新应用 E2 的 `rollupOptions.input`，但不得提交。

## 5. 旧代码删除

### 5.1 删除清单

| 文件 | 替代物 | 删除前守卫 |
| --- | --- | --- |
| `web/scripts/app.js` | `web/scripts/main.tsx` + `app/router.tsx` + `app/shell/**` | `web/index.html` 不再引用；`grep -R "scripts/app.js" web e2e tools` 无输出 |
| `web/scripts/ui.js` | `app/lesson/CodeBlock.tsx` 等 E3 组件 | `grep -R "ui.js\|from './ui'" web/scripts --include=*.ts --include=*.tsx` 无输出 |
| `web/scripts/views/blocks.js` | `app/lesson/blocks/**` 与 `app/lesson/CodeBlock.tsx` | 无 TS/TSX 导入 |
| `web/scripts/views/lab.js` | `app/pages/LabPage.tsx` + `app/lab/**` | 同上 |
| `web/scripts/views/lesson.js` | `app/pages/LessonPage.tsx` + `app/lesson/**` + `app/exercises/**` | 同上；确认不再导入 `engine/exercise.js` |
| `web/scripts/views/overview.js` | `app/pages/OverviewPage.tsx` | 同上 |
| `web/scripts/views/project.js` | `app/pages/ProjectPage.tsx` + `app/project/**` | 同上 |
| `web/scripts/views/report.js` | `app/pages/ReportPage.tsx` + `app/report/**` | 同上 |
| `web/scripts/views/stage.js` | `app/pages/StagePage.tsx` | 同上 |
| `web/scripts/engine/exercise.js` | `engine/runner/index.ts`、`engine/python/index.ts`、`engine/sql/index.ts` | 删除 `views/` 后 `grep -R "engine/exercise" web/scripts e2e tools --include=*.ts --include=*.tsx` 无输出 |
| `dev_server.py` | `npm run dev` / `npm run preview` | `README.md`、`00-master-plan.md`、`09-qa-release.md` 已更新 |

> `web/scripts/engine/exercise.js` 是 v2 的 JS 包装层，内部转发 E1 的 `runner` / `python` / `sql`。E3 页面直接使用 E1 的 TS API，因此 E5 删除包装层，不删除被包装的实现。

执行：

```bash
git rm web/scripts/app.js web/scripts/ui.js
git rm -r web/scripts/views
git rm web/scripts/engine/exercise.js
git rm dev_server.py
```

`git rm -r web/scripts/views` 必须确认目录内只有 7 个 `.js` 文件，没有 E3 新增的 TSX：

```bash
find web/scripts/views -type f
```

预期只输出 `blocks.js`、`lab.js`、`lesson.js`、`overview.js`、`project.js`、`report.js`、`stage.js`。

### 5.2 保留清单

| 文件/目录 | 保留原因 |
| --- | --- |
| `web/scripts/content/index.ts` | 内容门面；构建、审计、测试仍使用 |
| `web/scripts/content/search.ts` | `lessonHaystack` 的单元测试仍使用；运行时搜索用 `app/shell/search-docs.ts` |
| `web/scripts/content/**` | 课程内容单一事实源，E5 不改 |
| `web/scripts/state/**` | store / progress / mastery-core / migrate / lang |
| `web/scripts/engine/runner/**`、`python/**`、`sql/**` | 三类判题实现 |
| `web/scripts/test/**` | 单元测试 |
| `web/generated/**` | 生成物，gitignored |
| `web/styles/**` | 零视觉变更，E5 不改 |
| `e2e/__screenshots__/**` | 21 张视觉基线 |
| `e2e/routes.json` | 66 路由清单 |
| `functions/**` | 边缘函数，与前端切换无关 |
| `tmp/**` | 历史备份目录，不随本阶段清理；不提交新文件 |

### 5.3 配置清理

**`tsconfig.json`**：删除 `allowJs`、`checkJs` 与 `*.js` include：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["web/scripts/**/*.ts", "web/scripts/**/*.tsx"],
  "exclude": ["node_modules", "dist", "web/generated"]
}
```

**`.prettierignore`**：删除 `web/scripts/**/*.js`，其余保留：

```text
node_modules/
dist/
coverage/
playwright-report/
test-results/
docs/
web/scripts/content/**
web/styles/**
```

保留 `web/scripts/content/**` 与 `web/styles/**`：前者是 2.7 万行课程内容，格式化会产生无意义 diff 并增加内容漂移风险；后者本阶段零改动。E5 不做全仓格式化。

**`eslint.config.js` / `vitest.config.ts` / `tsconfig.node.json`**：不需要改动。理由：

- ESLint 只匹配 `web/scripts/**/*.{ts,tsx}`，E5 后仍然正确；
- Vitest include 为 `web/scripts/**/*.test.{ts,tsx}` 与 `tools/**/*.test.ts`；
- `tsconfig.node.json` 的 include 全部是 `.ts`，继承删除后的 `allowJs` 不产生缺口。

改完后必须运行：

```bash
npm run lint
npm run typecheck
```

若 `tsc` 报 `.js` 模块找不到，说明仍有 TS 文件导入已删除的 JS；按导入链修到 TS 实现，不允许重新打开 `allowJs`。

### 5.4 依赖守卫

```bash
# 1. 旧入口与旧运行时引用
grep -R "index.next.html\|scripts/app.js\|scripts/ui.js\|engine/exercise\|dev_server" web e2e tools package.json vite.config.ts playwright.config.ts README.md

# 2. web/scripts 下不得再有 .js
find web/scripts -type f -name "*.js"

# 3. 视图目录必须不存在
test ! -d web/scripts/views
```

预期：命令 1 无输出；命令 2 无输出；命令 3 退出码 0。

命令 1 的扫描范围不含 `docs/`：历史执行文档保留 `index.next.html` 的原始描述是允许的；但 `README.md` 与现行 QA/总纲文档必须在 T-E5.4 更新完毕。

### 5.5 验证命令

```bash
npm run content:validate
npm run typecheck
npm run lint
npm run build
npm run budget
npx playwright test e2e/routes.spec.ts --project=chromium
```

预期：内容校验 0 error；类型检查 0 error；lint 0 error；构建只产出一个 HTML；包体 PASS；66 路由全过。

### 5.6 回滚

- `git revert` 本任务提交；`git rm` 的删除会一并恢复；
- 配置清理与删除在同一提交，避免出现“文件已删但 tsconfig 仍 include JS”的中间态；
- 恢复后重新执行 `npm ci` 不必要（依赖未变）。

## 6. 文档更新

### 6.1 `README.md` 全文

当前 README 只有两行，无法支撑 v3 的日常开发与发布。T-E5.4 用以下内容整体替换：

```markdown
# 后端进阶实验室

面向有前端基础工程师的体系化进阶课程站点：从请求、数据、API、缓存与韧性，到生产化、分布式、全栈集成与 AI 应用，配可自动验证的练习与递进式项目。

## 内容规模

- 8 个核心阶段 + 1 个附录，共 45 讲；
- 9 个项目（p0–p7 + 毕业项目），54 个里程碑；
- 214 个任务：检查题、代码题、SQL 题与方案题；
- 12 类内容块；JavaScript / Python 双代码轨道；内置 HTTP 实验台与学习报告。

## 技术栈

- React 19 + React Router 7（hash 路由，旧链接不变）
- Vite 7 + TypeScript 5.9（strict）
- Zod 4 内容校验
- Vitest + Testing Library；Playwright（含 axe 与视觉回归）

## 环境

Node.js 22.15.0（见 `.nvmrc`），npm。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm ci` | 安装依赖 |
| `npm run dev` | 开发服务器，http://127.0.0.1:5173/ |
| `npm run build` | 内容校验 + 生成 + 类型检查 + 构建到 `dist/` |
| `npm run preview` | 预览构建产物，http://127.0.0.1:4173/ |
| `npm run verify` | 本地完整门禁（不跑视觉与 Python CDN 用例） |
| `npm run test` | 单元测试 |
| `npm run test:coverage` | 单元测试 + 覆盖率阈值 |
| `npm run e2e` | 构建后运行 Playwright（chromium） |
| `npm run e2e:visual` | 21 张视觉基线（Windows 本地） |
| `npm run e2e:python` | Python 轨道（需要外网 CDN） |
| `npm run content:validate` | 内容结构校验 |
| `npm run content:build` | 生成 `web/generated/` 目录与搜索索引 |
| `npm run audit:content` | 课程内容审计 |
| `npm run audit:exercises` | JS / SQL 答案级审计 |
| `npm run budget` | 入口、懒加载与搜索索引包体预算 |

`dev` 与 `build` 会自动执行 `content:build`；直接运行 `vite` 前请确保 `web/generated/` 存在。

## 目录结构

```text
web/
  index.html                 # 唯一 HTML 入口
  styles/                    # 设计令牌与页面样式
  scripts/
    main.tsx                 # React 挂载
    app/
      router.tsx             # 路由表
      shell/                 # 外壳、搜索、语言、抽屉、toast
      pages/                 # 六个页面
      data/                  # 数据门面与懒加载资源
      lesson/                # 12 类内容块、高亮、代码块
      exercises/             # MCQ / 代码 / SQL / 方案题
      project/               # 里程碑与模板
      lab/                   # HTTP 实验台
      report/                # 报告模型
    state/                   # 进度、草稿、语言、迁移
    content/                 # 课程内容与 Zod 校验（单一事实源）
    engine/                  # JS / Python / SQL 判题
    test/                    # Vitest
  generated/                 # catalog 与搜索索引（gitignored）
e2e/                         # Playwright、路由清单、视觉基线
tools/                       # 内容生成、审计、包体预算
functions/                   # Qoder Sites 边缘函数
docs/                        # 课程、实施、评审与发布文档
```

## 内容维护

1. 修改 `web/scripts/content/**` 下的 TypeScript 内容；
2. 运行 `npm run content:validate`；
3. 运行 `npm run content:build`（`dev` / `build` 会代跑）；
4. 运行 `npm run verify`。

课程 ID、练习答案、hash URL、`localStorage` 键与旧进度迁移规则都是兼容契约，不要为了“整洁”改动。

## 测试与平台

- 视觉基线是 Windows 基线，CI 不执行 `@visual`；发布前在本地执行 `npm run e2e:visual`；
- Python 题依赖 jsDelivr 的 Pyodide，CI 不执行 `@python`；发布前本地执行 `npm run e2e:python` 与 `npx tsx tools/run-python-exercises.ts`；
- 其余门禁在 CI 与本地执行同一份 `npm run verify`。

## 部署

- `dist/` 是纯静态站点，可部署到任意静态服务器；
- 正式发布使用 Qoder Sites 私有站点，`functions/` 为边缘函数目录，不涉及数据库；
- 不提交 `dist/`、`web/generated/`、任何密钥；站点始终保持私有。

## 文档

- 课程与发布文档：`docs/`
- 前端工程化迁移总纲：`docs/implementation/10-frontend-engineering.md`
- 执行文档：E0–E6（`docs/implementation/11-*` 至 `17-*`）
```

要求：

- 不写 siteId / projectId / actionId / 发布 URL；
- 不写 `DEMO_SECRET` 的值；
- 命令名必须与 T-E5.2 的 `package.json` 一致；
- 目录结构与 E5 完成后的实际结构一致。

### 6.2 `00-master-plan.md`

该文档记录 v2 的内容计划；E5 只更新已经被工程化改造取代的现行约束与命令，不改课程清单、阶段划分与内容决策。

**替换 1**（§1.3 不做的事）：

旧：

```markdown
- 不引入构建工具、框架、数据库或付费 API；
```

新：

```markdown
- 不引入数据库或付费 API；前端工程化自 v3 起由 React 19 + Vite + TypeScript 承担，详见 `10-frontend-engineering.md`；
```

**替换 2**（§5.3 环境与命令）：

旧：

```markdown
- 本地预览：`python dev_server.py`，默认端口以脚本输出为准。
- 所有工具必须零第三方依赖，只用 Node 标准库与 Python 标准库。
```

新：

```markdown
- 本地预览：`npm run build && npm run preview`（默认 4173）；开发模式 `npm run dev`（5173）。
- 运行时依赖仅 React、React Router 与 Zod；工具链依赖固定在 `package.json` 的 devDependencies；不引入付费 API。
```

其余“Node.js 22+；Python 3.11+”一行保留。

### 6.3 `09-qa-release.md`

**替换 §4 本地预览整节**：

````markdown
## 4. 本地预览

```bash
# 开发模式（自动生成内容目录与搜索索引）
npm run dev
# 打开 http://127.0.0.1:5173/

# 生产构建预览
npm run build
npm run preview
# 打开 http://127.0.0.1:4173/
```

- 源码根目录是 `web/`，构建产物是 `dist/`，预览与线上使用同一份相对路径；
- `npm run dev` / `npm run build` 会先执行 `content:build`，内容修改后无需手工生成；
- 浏览器检查使用 390/768/1280 三档，记录截图与控制台；
- 发布前的最终检查使用 `dist/` 的离线静态服务，见 `16-e5-switch-and-cleanup.md` §7.4。
````

删除旧的三条：`web/` 作为根目录、`no-store`、每次内容批次后重启。新的 `dev` 已覆盖内容生成与热更新。

**替换 R10 产物检查项**：

旧：

```markdown
- [ ] 发布产物只包含 `web/` 静态文件，不包含 `docs/`、`backups/`、`.qoder.site` 描述文件。
```

新：

```markdown
- [ ] 发布产物只包含构建目录（v2 为 `web/`，v3 为 `dist/`）的静态文件，不包含 `docs/`、`backups/`、`web/generated/`、`.qoder.site` 描述文件。
```

**在 §5.2 发布步骤标题下增加提示**：

```markdown
> v3.0.0 起发布输入改为 `webDirectory: "dist"`，完整流程见 `17-e6-release-v3.md`；本节保留为 v2 发布与回滚依据。
```

E5 不改 §5.2 的 `webDirectory: "web"` 与既有 projectId/siteId 说明；发布输入在 E6 一次性切换。

### 6.4 `known-issues.md`

在 `docs/reviews/frontend-engineering/known-issues.md` 追加：

```markdown
## E5 入口切换

- 视觉基线为 Windows 基线，CI 不执行 `@visual`；单入口切换后仍在本地执行 21 张对比。
- E2–E4 执行文档中的 `index.next.html`、`VISUAL_ENTRY`、`dev:next` 为历史命令，现行命令以本文件与 `package.json` 为准。
- `web/scripts/content/**` 不在 Prettier 范围内，属于内容防漂移策略，不是遗漏。
```

### 6.5 文档守卫

```bash
grep -n "dev_server\|index.next.html\|dev:next\|preview:next" README.md docs/implementation/00-master-plan.md docs/implementation/09-qa-release.md
```

预期无输出。历史 E0–E4 文档不参与该守卫。

## 7. 全量验证

### 7.1 `verify`

```bash
npm run verify
```

必须全绿。它覆盖：

- ESLint 与两套 tsconfig；
- 覆盖率单测（engine/state/content/app 分级阈值）；
- 内容校验、内容审计、JS/SQL 答案审计；
- 生产构建（单入口）；
- 包体预算；
- 除 `@visual` 与 `@python` 外的全部 Playwright 用例。

失败时不允许通过放宽阈值、跳过用例或 `--no-verify` 解决；先定位是否由入口切换或删除引起。

### 7.2 单入口视觉

```bash
npm run build
npx playwright test e2e/visual.spec.ts --project=chromium
```

预期 21/21。基线文件不新增、不删除、不重命名；`git status --short e2e/__screenshots__` 必须为空。

### 7.3 Python 轨道

```bash
npm run build
npx playwright test --project=chromium --grep @python
npx tsx tools/run-python-exercises.ts
```

预期：浏览器内 Python 用例全过；38 道 Python 轨道答案全过。失败若由 CDN 不可达引起，记录到 `known-issues.md` 并保留证据；不得静默跳过。

### 7.4 离线 `dist` 静态服务

`vite preview` 自带 SPA 行为，不能证明产物可被普通静态服务器托管。用 Python 标准库起一个不做回退的静态服务器：

```bash
npm run build
python -m http.server 8124 --directory dist
```

另开终端：

```bash
(
  set -e
  curl -sf http://127.0.0.1:8124/ | grep -q 'id="root"'
  for asset in $(grep -o 'assets/[^"]*' dist/index.html); do
    curl -sf "http://127.0.0.1:8124/$asset" >/dev/null
  done
  ! grep -q 'index.next.html' dist/index.html
  test "$(find dist -maxdepth 1 -name 'index*.html' | wc -l)" -eq 1
  echo "offline dist ok"
)
```

命令整体在子 shell 中执行，任一断言失败即退出，不会关闭当前终端。

预期：

- 首页返回 200 且包含 `id="root"`；
- `index.html` 引用的所有 `assets/*` 均返回 200（说明 `base: './'` 生效，无绝对路径）；
- 首页不包含 `index.next.html`；
- HTML 文件数量为 `1`。

浏览器手工检查（每次硬刷新，DevTools 保持打开）：

| 路由 | 检查 |
| --- | --- |
| `http://127.0.0.1:8124/#/` | 总览渲染；无 404；控制台无错误 |
| `http://127.0.0.1:8124/#/lesson/s0-l1` | 正文、检查题、练习正常 |
| `http://127.0.0.1:8124/#/lab` | 实验台可发请求 |
| `http://127.0.0.1:8124/#/report` | 报告数值正常 |
| 在课时页刷新 | 仍停留在同一 hash 路由 |
| 任意未知 hash | 回落总览且 URL 不变 |

静态服务器不执行 SPA 回退；本项目使用 hash 路由，因此上述路径都不需要服务器重写。若出现 404，检查是否误用了 history 路由或绝对资源路径。

### 7.5 兼容性手工核对

| 项目 | 方法 | 预期 |
| --- | --- | --- |
| 进度存储 | 完成一道检查题，刷新 | `bff-lab-progress-v1` 保留，状态恢复 |
| 草稿 | 在代码题输入后切换课时再返回 | `bff-lab-drafts-v1` 保留 |
| 语言轨道 | 切换 JavaScript / Python，刷新 | `bff-lab-lang-v1` 保留 |
| 旧进度迁移 | `npx tsx tools/test-progress-migration.ts` | `progress migration ok` |
| 清空记录 | 顶部“清空学习记录” | confirm 文案、toast、进度归零与 v2 一致 |
| 懒加载 | 首次打开总览 | 不请求阶段 chunk；进入课时后才请求 |
| 搜索索引 | 首次聚焦搜索框 | 此时才请求搜索索引 |
| 实验台 | 发送内置场景与真实端点 | 响应、历史、重置正常 |
| 未知课时/阶段/项目 | 手工输入无效 ID | 文案与 v2 一致 |

### 7.6 证据

写入 `docs/reviews/frontend-engineering/e5/`：

- `inventory-before.txt`：删除前 `web/scripts` 文件清单；
- `entry-head-diff.txt`：切换前后 `<head>` 对比（应为空）；
- `deleted-files.txt`：`git show --stat` 的删除列表；
- `verify.txt`：`npm run verify` 输出；
- `offline-dist.txt`：离线静态服务命令与结果；
- `visual.md`：21 张单入口对比结论；
- `python.txt`：Python 轨道结果；
- `g5-report.md`：G-E5 总结，含提交列表、命令输出摘要与剩余风险。

## 8. 目标结构与改动清单

### 8.1 完成后的目录

```text
web/
  index.html                       # 唯一入口（React）
  styles/                          # 不变
  scripts/
    main.tsx
    app/
      router.tsx
      RouteErrorPage.tsx
      hooks/
      shell/
      pages/
      data/
      lesson/
        blocks/
      exercises/
      project/
      lab/
      report/
    state/
    content/
    engine/
      runner/
      python/
      sql/
    test/
  generated/                       # gitignored
e2e/
  lib/
    entry.ts                       # 新增：唯一入口常量
    manifest.ts                    # 修改：index.html
  routes.json
  shell.spec.ts
  content.spec.ts
  interactions.spec.ts
  routes.spec.ts
  responsive.spec.ts
  keyboard.spec.ts
  a11y.spec.ts
  visual.spec.ts
  __screenshots__/                 # 21 张，不变
tools/
  ...
functions/                         # 不变
docs/
dist/                              # gitignored
```

### 8.2 修改文件

| 文件 | 改动 |
| --- | --- |
| `web/index.html` | 替换为 React 单入口 |
| `vite.config.ts` | 删除多入口，保留单入口与 manifest |
| `package.json` | 删除 `dev:next` / `preview:next`；`dev` 先构建内容 |
| `tsconfig.json` | 删除 `allowJs` / `checkJs` 与 JS include |
| `.prettierignore` | 删除 `web/scripts/**/*.js` |
| `e2e/lib/entry.ts` | 新增入口常量 |
| `e2e/lib/manifest.ts` | 入口键改为 `index.html` |
| `e2e/*.spec.ts` | 全部改用 `entryUrl`；删除 `smoke` / `parity`；视觉去 `VISUAL_ENTRY` |
| `tools/bundle-budget.ts` | 入口键与展示名改为 `index.html` |
| `README.md` | 全文重写 |
| `00-master-plan.md` | 工程约束、预览与工具依赖说明 |
| `09-qa-release.md` | 本地预览、R10 产物、v3 发布指向 |
| `docs/reviews/frontend-engineering/known-issues.md` | 追加 E5 条目 |

### 8.3 删除文件

```text
web/index.next.html
web/scripts/app.js
web/scripts/ui.js
web/scripts/views/blocks.js
web/scripts/views/lab.js
web/scripts/views/lesson.js
web/scripts/views/overview.js
web/scripts/views/project.js
web/scripts/views/report.js
web/scripts/views/stage.js
web/scripts/engine/exercise.js
dev_server.py
e2e/smoke.spec.ts
e2e/parity.spec.ts
```

### 8.4 明确不改

- `web/styles/**`、`web/scripts/content/**`、`web/scripts/state/**`、`web/scripts/engine/{runner,python,sql}/**`；
- `e2e/__screenshots__/**`、`e2e/routes.json`、`playwright.config.ts`、`vitest.config.ts`、`eslint.config.js`、`.github/workflows/verify.yml`；
- `functions/**`、数据库与访问策略、站点描述文件；
- `docs/implementation/11-*.md` 至 `15-*.md` 的历史命令。

## 9. 任务卡

### T-E5.0 冻结基线与删除清单

- **类型**：infra
- **依赖**：E4 完成
- **产出**：
  - `docs/reviews/frontend-engineering/e5/inventory-before.txt`
  - `docs/reviews/frontend-engineering/e5/entry-refs-before.txt`
  - `docs/reviews/frontend-engineering/e5/visual-sha-before.txt`
- **实现要求**：

1. 确认 `e4-qa` 标签与干净工作区；
2. 记录删除前清单：

```bash
mkdir -p docs/reviews/frontend-engineering/e5
git ls-files web/scripts | sort > docs/reviews/frontend-engineering/e5/inventory-before.txt
git grep -n "index.next.html" -- e2e tools package.json vite.config.ts > docs/reviews/frontend-engineering/e5/entry-refs-before.txt || true
git ls-files -s e2e/__screenshots__ | sort -k4 > docs/reviews/frontend-engineering/e5/visual-sha-before.txt
```

3. 确认 E4 报告齐全，记录 `npm run verify` 的最后一次全绿输出；
4. 备份当前 `<head>`：

```bash
mkdir -p docs/reviews/frontend-engineering/e5
sed -n '/<head>/,/<\/head>/p' web/index.html > docs/reviews/frontend-engineering/e5/head-before.html
```

- **命令**：上述命令 + `npm run verify`
- **预期**：证据文件生成；verify 全绿；视觉基线索引不变。
- **约束**：不修改任何业务文件；不提前删除。
- **证据**：三份 before 文件与 verify 输出。
- **回滚**：删除 `docs/reviews/frontend-engineering/e5/` 下本任务新增文件。
- **停止条件**：工作区不干净；标签缺失；verify 红灯。

### T-E5.1 切换默认入口到 React

- **类型**：feature
- **依赖**：T-E5.0
- **产出**：
  - 重写后的 `web/index.html`
  - `package.json`（仅 `dev` 脚本）
  - 删除 `e2e/smoke.spec.ts`、`e2e/parity.spec.ts`
  - `docs/reviews/frontend-engineering/e5/entry-head-diff.txt`
- **实现要求**：

1. 按 §3.2 整体替换 `web/index.html`；
2. 确认 body 中只有 `noscript`、`#root`、`main.tsx` 脚本；
3. 把 `dev` 改为 `npm run content:build && vite --open`，其余 scripts 不动；
4. 删除 `smoke.spec.ts` 与 `parity.spec.ts`：v2 入口被替换后，两者的 oracle 已不存在，必须在同一提交退场，避免留下“测的是 React 却声称测 v2”的假门禁；
5. 保留 `index.next.html` 一个提交，Vite 配置暂不改；
6. 生成 `<head>` 对比：

```bash
sed -n '/<head>/,/<\/head>/p' web/index.html > docs/reviews/frontend-engineering/e5/head-after.html
diff -u docs/reviews/frontend-engineering/e5/head-before.html docs/reviews/frontend-engineering/e5/head-after.html > docs/reviews/frontend-engineering/e5/entry-head-diff.txt || true
```

7. 构建并检查：

```bash
npm run build
find dist -maxdepth 1 -name "index*.html" -print
grep -c 'id="root"' dist/index.html
```

8. 打开默认入口手工验证 `#/`、`#/stage/s0`、`#/lesson/s0-l1`、`#/lab`、`#/report`，控制台无错误；
9. 本任务不删除任何旧运行时代码，不删除 `index.next.html`。

- **命令**：上述命令 + `npm run verify`
- **预期**：head diff 为空；两个 HTML 仍产出；默认入口是 React；`verify` 全绿（既有 E2E 仍指向 `index.next.html`，包体仍以它为入口，均有效）。
- **约束**：除删除 smoke/parity 外不改其他 E2E；不改 CSS、页面组件与 Vite 配置。
- **证据**：head diff、构建输出、verify 输出、默认入口截图。
- **回滚**：`git revert` 本任务提交，恢复 v2 `index.html`、`dev` 脚本与两个 spec。
- **停止条件**：默认入口白屏；`#root` 不存在；出现重复 `h1`、重复 `#main` 或控制台错误；`shell.spec.ts` 失败且原因不是尚未切换的预期。

### T-E5.2 单入口收敛与 E2E 适配

- **类型**：infra
- **依赖**：T-E5.1
- **产出**：
  - `vite.config.ts`（单入口）
  - `package.json` scripts
  - `e2e/lib/entry.ts`
  - 更新后的全部 spec
  - 删除 `web/index.next.html`
  - `tools/bundle-budget.ts`、`e2e/lib/manifest.ts`
- **实现要求**：

1. 按 §4.1 删除多入口；
2. `git rm web/index.next.html`；
3. 按 §4.3 删除 `dev:next` / `preview:next`；
4. 新增 `e2e/lib/entry.ts`，按 §4.4 替换所有入口常量；
5. 按 §4.6 单入口化 `visual.spec.ts`；
6. 按 §4.7 更新工具入口键；
7. 确认 `smoke.spec.ts` 与 `parity.spec.ts` 已在 T-E5.1 删除，`grep -R "smoke.spec\|parity.spec"` 只命中历史文档；
8. 确认 `grep -R "index.next.html" e2e tools package.json vite.config.ts` 无输出；
9. 确认 `find dist -maxdepth 1 -name "index*.html" | wc -l` 为 `1`。

- **命令**：

```bash
npm run build
npm run budget
npx playwright test e2e/routes.spec.ts --project=chromium
npx playwright test e2e/content.spec.ts e2e/interactions.spec.ts e2e/shell.spec.ts e2e/responsive.spec.ts e2e/keyboard.spec.ts e2e/a11y.spec.ts --project=chromium --grep-invert "@python"
npx playwright test e2e/visual.spec.ts --project=chromium
```

- **预期**：单 HTML；预算三项 PASS；66 路由与全部质量门禁通过；视觉 21/21。
- **约束**：不改预算数值；不改基线；不删其他 spec；不改 Playwright 配置；不碰业务组件。
- **证据**：构建输出、budget 输出、六份 Playwright 报告、视觉报告。
- **回滚**：`git revert` 本任务提交，恢复双入口与 E2E 常量；`smoke` / `parity` 已在 T-E5.1 删除，若需一并恢复，按时间倒序 revert T-E5.2、T-E5.1。
- **停止条件**：视觉出现任何 diff；66 路由有控制台错误；预算入口闭包明显变小；仍有 `index.next.html` 引用。

### T-E5.3 删除 v2 运行时代码与配置清理

- **类型**：infra
- **依赖**：T-E5.2
- **产出**：
  - 删除 11 个 v2 文件（§5.1）
  - 更新 `tsconfig.json`、`.prettierignore`
  - `docs/reviews/frontend-engineering/e5/deleted-files.txt`
- **实现要求**：

1. 按 §5.1 逐项运行删除前守卫；
2. 执行 `git rm`；
3. 按 §5.3 更新 tsconfig 与 prettierignore；
4. 运行 §5.4 三条依赖守卫；
5. 不删除 §5.2 的保留清单；
6. 记录删除清单：

```bash
git show --stat --oneline HEAD > docs/reviews/frontend-engineering/e5/deleted-files.txt
```

- **命令**：

```bash
npm run content:validate
npm run typecheck
npm run lint
npm run build
npm run budget
npx playwright test e2e/routes.spec.ts --project=chromium
```

- **预期**：守卫全部通过；类型检查与 lint 0 error；构建单入口；包体 PASS；66 路由通过。
- **约束**：不删除 `content/search.ts`、`content/index.ts`、`web/generated/`、视觉基线；不重新打开 `allowJs`；不格式化内容。
- **证据**：删除清单、守卫输出、构建与路由结果。
- **回滚**：`git revert` 本任务提交，恢复删除文件与配置。
- **停止条件**：仍存在 TS 导入旧 JS；删除导致测试需要重写判题逻辑；`find web/scripts -name '*.js'` 非空。

### T-E5.4 文档与命令更新

- **类型**：docs
- **依赖**：T-E5.3
- **产出**：
  - 重写后的 `README.md`
  - 更新后的 `00-master-plan.md`、`09-qa-release.md`
  - 追加后的 `known-issues.md`
- **实现要求**：

1. 按 §6.1 整体替换 README；
2. 按 §6.2 做两处替换；
3. 按 §6.3 替换 §4、R10 检查项并添加 §5.2 提示；
4. 按 §6.4 追加 known-issues；
5. 运行 §6.5 文档守卫；
6. 不修改 E0–E4 历史执行文档。

- **命令**：

```bash
grep -n "dev_server\|index.next.html\|dev:next\|preview:next" README.md docs/implementation/00-master-plan.md docs/implementation/09-qa-release.md
npm run format:check
```

- **预期**：守卫无输出；格式检查通过（README 与两份文档不在 Prettier 忽略范围内时按仓库规则处理）。
- **约束**：README 不写站点 ID、发布 URL 与密钥；不承诺尚未完成的 v3 发布。
- **证据**：三份文档 diff、守卫输出。
- **回滚**：`git revert` 本任务提交。
- **停止条件**：README 命令与 `package.json` 不一致；历史执行文档被误改。

### T-E5.5 全量验收

- **类型**：qa
- **依赖**：T-E5.4
- **产出**：
  - `verify.txt`
  - `offline-dist.txt`
  - `visual.md`
  - `python.txt`
- **实现要求**：

1. 按 §7.1 跑 `npm run verify`；
2. 按 §7.2 跑单入口视觉；
3. 按 §7.3 跑 Python 轨道；
4. 按 §7.4 起离线静态服务并完成 curl 与浏览器检查；
5. 按 §7.5 完成兼容性手工核对；
6. 记录所有输出到 `docs/reviews/frontend-engineering/e5/`；
7. 发现缺陷按总纲 §12.3 判断是否阻塞：阻塞项修复后重跑全部门禁，不阻塞项写入 known-issues。

- **命令**：

```bash
npm run verify
npm run build
npx playwright test e2e/visual.spec.ts --project=chromium
npx playwright test --project=chromium --grep @python
npx tsx tools/run-python-exercises.ts
python -m http.server 8124 --directory dist
```

- **预期**：verify 全绿；视觉 21/21；Python 全过；离线服务所有资源 200；手工矩阵全部符合。
- **约束**：不改阈值、不跳过用例、不更新基线；离线服务器只用于验收，不作为发布服务。
- **证据**：四份输出与手工核对表。
- **回滚**：若发现阻塞缺陷，回到对应任务修复；不在验收任务里直接大改。
- **停止条件**：任一必过门禁红灯；视觉 diff 无法解释；离线资源 404；进度/草稿/语言存储键变化。

### T-E5.6 G-E5 门禁、报告与标签

- **类型**：release-gate
- **依赖**：T-E5.5
- **产出**：
  - `docs/reviews/frontend-engineering/e5/g5-report.md`
  - 标签 `e5-switch`
- **实现要求**：

1. 按 §10 逐项勾选；
2. 写 `g5-report.md`：提交列表、删除清单、verify/视觉/Python/离线结果、剩余风险、与 E4 的差异；
3. 确认未发布、访问策略仍为私有；
4. 打标签：

```bash
git tag -a e5-switch -m "E5 默认入口切换与旧代码清理"
```

5. 不推送标签（除非用户明确要求）。

- **命令**：

```bash
git status --short
git tag --list e5-switch
```

- **预期**：工作区干净；标签存在；报告完整。
- **约束**：G-E5 未全绿不得打标签；标签不替代 E6 发布。
- **证据**：`g5-report.md` 与标签。
- **回滚**：`git tag -d e5-switch`；修复后重新打标签。
- **停止条件**：任一验收项未勾选；仍有旧入口引用；站点被发布或改为公开。

## 10. G-E5 验收清单

### 10.1 入口与构建

- [ ] `web/index.html` 只包含 head、`noscript`、`#root`、`main.tsx` 脚本；
- [ ] `head` 与 E4 基线逐字一致（含 title、description、theme-color、favicon、4 个 CSS）；
- [ ] `web/index.next.html` 已删除；
- [ ] `vite.config.ts` 为单入口且保留 `manifest: true`；
- [ ] `npm run build` 只产出 `dist/index.html`；
- [ ] `dist/index.html` 中 `id="root"` 恰好一次、`app.js` 零次；
- [ ] `package.json` 无 `dev:next` / `preview:next`，`dev` 先执行 `content:build`。

### 10.2 旧代码与配置

- [ ] `app.js`、`ui.js`、`views/**`、`engine/exercise.js`、`dev_server.py` 全部删除；
- [ ] `find web/scripts -type f -name "*.js"` 无输出；
- [ ] `tsconfig.json` 无 `allowJs` / `checkJs`，include 只含 TS/TSX；
- [ ] `.prettierignore` 无 `web/scripts/**/*.js`；
- [ ] `web/scripts/content/**`、`search.ts`、`state/**`、`engine/{runner,python,sql}/**` 完整保留。

### 10.3 E2E 与工具

- [ ] 所有 spec 使用 `e2e/lib/entry.ts` 的 `entryUrl`，无 `index.next.html`；
- [ ] `smoke.spec.ts`、`parity.spec.ts` 已删除，CI 与 `verify` 无引用；
- [ ] `visual.spec.ts` 无 `VISUAL_ENTRY`，21 张基线未改名、未重采；
- [ ] `tools/bundle-budget.ts` 与 `e2e/lib/manifest.ts` 入口键为 `index.html`；
- [ ] 包体三项 PASS，入口 gzip 与 E4 差异在 ±2KB 内。

### 10.4 功能与兼容

- [ ] `routes.spec.ts` 66/66，0 控制台错误；
- [ ] 响应式、键盘、axe 门禁全过；
- [ ] 四类任务、项目里程碑、实验台、报告可用；
- [ ] 进度、草稿、语言三把存储键不变；
- [ ] 旧进度迁移夹具通过；
- [ ] 首次打开总览不请求阶段 chunk；首次聚焦搜索才请求索引；
- [ ] 未知路由回落总览且 URL 不变。

### 10.5 视觉与离线

- [ ] 单入口视觉 21/21；
- [ ] `git status --short e2e/__screenshots__` 为空；
- [ ] `python -m http.server 8124 --directory dist` 下首页与全部 `assets/*` 返回 200；
- [ ] 离线服务下 `#/`、`#/lesson/s0-l1`、`#/lab`、`#/report` 与刷新均正常；
- [ ] `find dist -maxdepth 1 -name "index*.html" | wc -l` 为 `1`。

### 10.6 文档与发布状态

- [ ] `README.md` 的命令与目录结构与实际一致；
- [ ] `00-master-plan.md`、`09-qa-release.md` 无 `dev_server` / `index.next.html` / `dev:next`；
- [ ] `known-issues.md` 含 E5 条目；
- [ ] 站点仍为私有 v2.0.1，未执行 prepare/publish；
- [ ] 未修改 `functions/`、数据库、访问策略与站点描述文件；
- [ ] 证据目录齐全，`e5-switch` 标签已打。

## 11. 风险与对策

| 风险 | 表现 | 对策 |
| --- | --- | --- |
| 静态外壳重复渲染 | 两个 `#main` / 两个 `h1` / 重复 skip link | §3.2 只保留 `#root`；E2E 的 `toHaveCount(1)` 拦住 |
| head 被顺手改写 | title、description、CSS 链接变化 | T-E5.1 的 `<head>` diff 必须为空 |
| 漏改 E2E 入口 | 测试 404 或仍测 `index.next.html` | `grep -R "index.next.html" e2e tools` 必须无输出 |
| 删除后仍有 JS 导入 | tsc 报模块找不到 | 按导入链修到 TS 实现，不恢复 `allowJs` |
| 视觉出现 diff | 21 张中任意一张失败 | 检查 CSS 注入顺序、字体、重复节点；禁止更新基线 |
| 预算入口键错误 | 脚本抛 `manifest 中找不到` | 检查 `dist/.vite/manifest.json` 的 key 与 `isEntry` |
| 入口闭包漏算 | 预算突然变小 | 与 E4 报告对比；检查 `entryClosure` 递归 |
| 离线静态服务 404 | 资源使用绝对路径 | 保持 `base: './'`；检查 `dist/index.html` 的 `src`/`href` |
| `dev` 缺生成物 | 新克隆启动报 catalog 不存在 | `dev` 必须先 `content:build` |
| 文档残留旧命令 | 新人按 README 跑 `dev_server.py` | §6.5 文档守卫；历史文档除外 |
| 误发布 | 提前 prepare/publish | E5 明令禁止；G-E5 检查访问策略与发布状态 |

## 12. 回滚与交接

### 12.1 回滚

- 每个任务一个提交，失败按任务 `git revert`；
- T-E5.1 回滚即可恢复 v2 入口，旧代码此时仍在；
- T-E5.3 删除面最大，回滚该提交恢复全部 v2 文件与配置；
- 最坏情况回到 `e4-qa`：

```bash
git revert --no-edit <T-E5.3> <T-E5.2> <T-E5.1>
```

按提交时间倒序执行；不要使用 `git reset --hard`。

- 视觉基线未改动，回滚不涉及快照；
- 已发布 v2.0.1 不受影响；E5 不发布，因此不存在线上回滚需求。

### 12.2 交给 E6 的输入

E6 开始时必须满足：

- `e5-switch` 标签存在，工作区干净；
- `npm run verify` 全绿；
- `dist/` 只有一个 `index.html`，可被普通静态服务器离线服务；
- 21 张视觉基线单入口 21/21；
- Python 轨道全过；
- `README.md`、`00-master-plan.md`、`09-qa-release.md` 已更新；
- `known-issues.md` 含 E5 条目；
- 站点仍是私有 v2.0.1，未切换 `webDirectory`。

E6 直接执行：

1. 新 actionId，`webDirectory: "dist"`、`functionDirectory: "functions"`、`databaseAccess: "none"`、`spa: true`；
2. 复用既有 projectId / siteId；
3. `prepare_site` → `publish_site` → `published: true`；
4. 线上 66 路由、四类任务、进度迁移、实验台与报告冒烟；
5. 发布说明 `docs/release-notes-v3.md`、评审报告与标签 `v3.0.0`。

E5 不删除 `functions/`、不修改站点描述文件、不改变访问策略；这些是 E6 的边界。
