# E2：React 外壳（并行入口、路由与全局交互）

> 上级：`10-frontend-engineering.md` §3.2、§6 E2、§7、§11-13；前置：`12-e1-types-and-content.md`。
> 目标：在不改动 v2 默认入口的前提下，用 React 19 + React Router 7 搭出与 v2 一致的 66 路由外壳、侧栏、搜索、语言切换、抽屉、进度与重置流程；六个页面先以骨架接入，正文与练习留给 E3。
> 工期：1–2 人日。完成定义：G-E2 通过，标签 `e2-shell`。

## 1. 阶段边界

### 1.1 本阶段做

- 新增 `web/index.next.html`，与 `web/index.html` 并行存在；默认入口仍是 v2；
- 新增 `web/scripts/main.tsx`、`app/router.tsx`、`app/RouteErrorPage.tsx`；
- 新增 `app/shell/`：`AppShell`、`Topbar`、`Sidebar`、`SearchBox`、`LangSwitch`、`ToastProvider`、`ResetProgress`；
- 新增 `app/hooks/useProgress.ts`、`useLang.ts`，用 `useSyncExternalStore` 包装 E1 的 store/lang；
- 新增六个页面骨架：总览、阶段、课时、项目、实验台、报告；无效 ID 的空状态与 v2 文案一致；
- 路由切换的滚动复位与焦点管理、skip link、错误边界、Suspense 占位；
- Vite 多入口构建：`index.html`（v2）与 `index.next.html`（React）同时产出到 `dist/`；
- 组件测试（路由矩阵、搜索、外壳交互）与 Playwright React 外壳烟测。

### 1.2 本阶段不做

- 不迁移任何课程正文、12 类内容块、检查题、四类任务、项目正文、实验台与报告内容（E3）；
- 不做阶段内容懒加载、不消费 `web/generated/catalog.json` / `search-index.json`（E3.5）；
- 不改 `web/index.html`、`web/scripts/app.js`、`web/scripts/views/**`、`web/scripts/ui.js`、`web/scripts/engine/exercise.js`；
- 不改任何 CSS 文件；不新增 UI 库、CSS 框架、图标库；
- 不新增运行时依赖（React/React DOM/React Router 已在 E0 安装）；
- 不改 hash URL、`localStorage` 键、进度迁移规则、课程内容；
- 不切换默认入口、不删除旧代码（E5）；不发布、不改 `functions/`、不改访问策略。

### 1.3 本阶段结束时的可运行形态

- `npm run dev` 仍打开 v2：`web/index.html` + `app.js`；
- `npm run dev:next` 打开 React 外壳：`web/index.next.html`；
- `npm run build` 同时产出 `dist/index.html`（v2）与 `dist/index.next.html`（React）；
- React 外壳可解析 66 条路由，侧栏/搜索/语言/抽屉/重置与 v2 行为一致；六个页面是骨架，但标题、无效 ID 空状态与导航正确；
- 没有发布任何新版本。

## 2. 前置条件

| 检查 | 命令 | 通过标准 |
| --- | --- | --- |
| 阶段标签 | `git tag --list e1-typed` | 输出 `e1-typed` |
| 工作区 | `git status --short` | 无业务文件改动；仅方案文档可未跟踪 |
| Node | `node -v` | `v22.15.0`（与 E0/E1 一致） |
| 依赖 | `npm ci` | 0 error |
| E1 门禁 | `npm run verify` | 全绿 |
| 内容基线 | `npx tsx tools/content-snapshot.ts` | 与 E1 记录的快照一致 |
| 路由基线 | `node -e "const r=require('./e2e/routes.json'); if(!Array.isArray(r)||r.length!==66||!r.every(x=>typeof x==='string'&&x.startsWith('#/'))) process.exit(1); console.log('routes ok', r.length)"` | `routes ok 66` |
| 搜索函数 | `grep -n "export function lessonHaystack" web/scripts/content/search.ts` | 有输出（E1 已导出） |
| 语言类型 | `grep -n "export type LanguageId" web/scripts/state/lang.ts` | 有输出（E1 已导出） |
| 入口未被占用 | `ls web/index.next.html web/scripts/main.tsx` | 文件不存在（本阶段新建） |

`e2e/routes.json` 的契约是 66 个字符串，每条形如 `#/lesson/s0-l1`。若 E0 生成的 JSON 结构不同，先按该契约重新生成，不修改生成语义。

## 3. 外壳契约（必须与 v2 一致）

### 3.1 DOM、ID 与类名

现有 CSS 直接依赖下列选择器，React 必须原样产出：

| 选择器 | 约束 |
| --- | --- |
| `.app#app` | 最外层 grid：topbar/sidebar/main 三个区域 |
| `header.topbar` | 顶栏容器 |
| `#menu-toggle.icon-btn.topbar__menu` | `type="button"`、`aria-label="打开课程目录"`、`aria-expanded`、`aria-controls="sidebar"` |
| `a.brand` | `href="#/"`，`aria-label="返回学习总览"`，内部 SVG 与两行文字不变 |
| `.topbar__search` | 搜索容器；内部 `#search-input` 与 `#search-results` |
| `#search-input` | `type="search"`、`role="combobox"`、`aria-autocomplete="list"`、`aria-controls="search-results"`、`aria-expanded` |
| `#search-results.search-results` | `role="listbox"`，关闭时 `hidden` |
| `#lang-switch.lang-switch` | `role="group"`、`aria-label="代码语言轨道"`；按钮 `data-lang`、`aria-pressed` |
| `.topbar__actions` | 语言、实验台、报告、进度环 |
| `.topbar__link` | 两个链接，`href="#/lab"`、`href="#/report"` |
| `#progress-chip.progress-chip` | `title="总体完成度"` |
| `#progress-ring.progress-chip__value` | SVG circle，`r=15.5`，`stroke-dashoffset=97.4*(1-percent/100)` |
| `#progress-label` | `${percent}%` |
| `aside#sidebar.sidebar` | `aria-label="课程目录"`；打开时附加 `is-open` |
| `nav#sidebar-nav.sidebar__scroll` | 可滚动目录区 |
| `.rail-head` | `h2` 文案「学习路径」+ `#rail-count`（`done/total`） |
| `.stage-node[data-stage]` | 9 个阶段节点；状态类 `is-open` / `is-active` / `is-done` |
| `.stage-node__head` | `button`、`aria-expanded`；内部 pip/title/badge/chevron |
| `.stage-node__bar > i` | `width: percent%` |
| `.stage-node__lessons` | `ul`；每讲一个 `a.lesson-link[data-lesson]`，状态类 `is-done` / `is-current` |
| `.rail-section` + `.rail-link[data-rail]` | `lab` / `report` / `graduation` 三个链接 |
| `.sidebar__foot` | 说明文字 + `#reset-progress` 按钮 |
| `main#main.main` | `tabindex="-1"`，路由内容容器 |
| `#scrim.scrim` | 关闭时 `hidden`；`aria-hidden="true"` |
| `#toast-host.toast-host` | `role="status"`、`aria-live="polite"` |
| `.skip-link` | `href="#main"`，点击后聚焦 `main`，不改变 hash |

`#root` 只作为 React 挂载点，不新增样式；`.app` 仍是 grid 根。禁止为了 React 改任何 CSS 选择器。

### 3.2 路由表

| hash | React 路径 | 页面 | v2 行为 |
| --- | --- | --- | --- |
| `#/` | `/` | OverviewPage | 总览 |
| `#/stage/:id` | `/stage/:stageId` | StagePage | 阶段页 |
| `#/lesson/:id` | `/lesson/:lessonId` | LessonPage | 课时页 |
| `#/project/:id` | `/project/:projectId` | ProjectPage | 项目页（含毕业项目） |
| `#/lab` | `/lab` | LabPage | HTTP 实验台 |
| `#/report` | `/report` | ReportPage | 学习报告 |
| 其他 | `*` | OverviewPage | 未知路由回落总览，URL 不重写 |

- 66 条已知路由：`#/` 1 条 + 阶段 9 条 + 课时 45 条 + 项目 9 条 + `#/lab` + `#/report`。
- 阶段/课时/项目 ID 不存在时仍正常解析路由，由页面渲染空状态，不做重定向。

### 3.3 行为清单

| 行为 | v2 事实 | E2 要求 |
| --- | --- | --- |
| 路由切换 | `hashchange` 后渲染并 `scrollTo(0,0)` | 监听 `pathname`，滚动复位；初次加载也复位；后续切换聚焦 `main`（`preventScroll`） |
| 侧栏初始 | 所有阶段折叠 | 默认全折叠 |
| 侧栏激活 | 当前阶段自动展开并 `is-active`；当前课时 `is-current` | 相同；用户可手动折叠非当前阶段 |
| 阶段计数 | `stageMastery` 的 `done/total` 与百分比条 | 相同 |
| 总进度 | `courseMastery` 的 `done/total` 与百分比环 | 相同 |
| 搜索范围 | 阶段标题+keywords；课时全文 haystack；项目标题+brief；毕业项目额外 stack | 相同顺序、相同子标题、最多 12 条 |
| 搜索键盘 | ↑/↓ 循环、Enter 打开当前/第一条、Esc 关闭并 blur | 相同；无结果时 Enter 不导航 |
| 搜索鼠标 | 点击结果关闭并清空；点击外部关闭 | 相同 |
| 语言切换 | 写 `bff-lab-lang-v1`；切换后保持滚动位置 | 相同；不触发路由跳转 |
| 抽屉 | 移动端菜单按钮开、scrim 关、路由切换自动关 | 相同 |
| 重置进度 | `confirm` → `store.reset()` → 删除草稿键 → toast | 相同文案与顺序 |
| skip link | 点击聚焦 `main` 并滚到顶部 | 相同 |
| 无效课时 | 「找不到这一讲，可能是链接有误。」+ 返回总览 | 相同 |
| 无效阶段/项目 | 「找不到这个阶段。」/「找不到这个项目。」 | 相同 |

### 3.4 固定文案

以下文案必须逐字一致，不得改写：

- `打开课程目录`
- `返回学习总览`
- `搜索知识点、阶段、项目或 AI 主题…`
- `搜索课程内容`
- `没有匹配的课程内容`
- `学习路径`
- `HTTP 实验室`
- `学习报告`
- `毕业项目`
- `进度保存在本机浏览器，换设备不会同步。`
- `清空学习记录`
- `确定要清空全部学习记录吗？此操作不可撤销。`
- `学习记录已清空`
- `找不到这一讲，可能是链接有误。`
- `找不到这个阶段。`
- `找不到这个项目。`
- `跳到主要内容`

错误边界与 Suspense 的文案属于工程提示，不是课程内容，可按本文档写。

## 4. 关键设计决策

### 4.1 并行入口 + 多页构建

E2 不切换默认入口。`web/index.next.html` 与 `web/index.html` 同时构建：

```ts
build: {
  rollupOptions: {
    input: {
      main: htmlEntry('./web/index.html'),
      next: htmlEntry('./web/index.next.html'),
    },
  },
}
```

这样 E2–E4 可以用生产构建验证 React，而 v2 始终保持可访问、可回滚；E5 只做入口文件替换与旧代码删除。

### 4.2 路由形状与未知路由

使用 `createHashRouter`，保持 `#/lesson/s0-l1` 等 URL 不变。根路由渲染 `AppShell`，子路由渲染六个页面；`*` 子路由渲染 `OverviewPage`，**不做重定向**，与 v2「未知路由回落总览但 URL 不变」一致。

### 4.3 `useSyncExternalStore` 需要版本号

E1 的 `store` 在内存中原地修改 `state` 后 `emit()`，`store.get()` 每次返回同一个对象引用。直接把它当 `getSnapshot` 会让 React 认为没有变化。E2 给 store 增加一个只增不减的内存版本号：

```ts
let version = 0;

function emit() {
  version += 1;
  persist();
  listeners.forEach((fn) => fn(state));
}

export const store = {
  subscribe(fn) { /* 不变 */ },
  getVersion() { return version; },
  // ...其余 API 不变
};
```

`useProgress` 订阅 `store.getVersion`，版本变化后在 `useMemo` 中重算 `courseMastery` / `stageMastery`。版本号不写入 `localStorage`，不改变存储结构。

### 4.4 外壳 DOM 是契约，不是实现细节

CSS 已围绕 `#search-input`、`.stage-node__head`、`#progress-ring` 等选择器写成。React 重写时只替换渲染方式，不替换选择器；E2 不新增/修改任何 CSS。任何「必须改 CSS 才能显示」的情况都视为偏离，停止并报告。

### 4.5 搜索暂时使用内存全文

E1 已生成 `search-index.json`，但按计划 E3.5 才消费。E2 的 `searchCurriculum()` 直接遍历 `curriculum`，使用 E1 `content/search.ts` 的 `lessonHaystack()`（带缓存的全文提取），行为与 v2 等价；E3.5 只替换该函数的数据来源，不动 `SearchBox`。

### 4.6 页面骨架的边界

E2 的六个页面只负责：

- 解析参数、查内容、渲染唯一 `h1` 与最少量导航；
- 无效 ID 的空状态；
- 让 66 路由烟测有稳定的 `main h1`。

正文、内容块、检查题、练习、项目里程碑、实验台与报告全部留给 E3。骨架不引入临时组件库，也不提前实现 E3 的交互。

### 4.7 焦点与滚动

- 初次加载：`window.scrollTo(0, 0)`，不抢焦点；
- 路由切换：先 `scrollTo(0, 0)`，再 `main.focus({ preventScroll: true })`，避免页面跳到旧滚动位置；
- 用 `useRef(pathname)` 记录上一次路径判断「是否真的切换」，不要用 `firstRender` 布尔值：StrictMode 会双调用挂载 effect，布尔值会把初次加载误判为切换并抢焦点；
- skip link：`preventDefault()` 后聚焦 `main` 并 `scrollIntoView({ block: 'start' })`，不能把 hash 改成 `#main`；
- 抽屉在 `pathname` 变化时关闭，与 v2 `render()` 末尾 `closeDrawer()` 一致；
- 语言切换不改变路径，因此不触发滚动复位。

### 4.8 StrictMode 与副作用清理

`main.tsx` 使用 `<StrictMode>`。所有 `useEffect` 必须可重复挂载/卸载：store 订阅、lang 订阅、document 点击监听、toast 定时器都要在 cleanup 中释放。开发模式下 StrictMode 会双调用 effect，这是验证清理是否正确的免费检查。

### 4.9 允许的无视觉差异可访问性增强

以下增强不改变 v2 的视觉与导航语义，E2 允许并建议实现：

- 当前课时/导航链接加 `aria-current="page"`；
- 搜索输入加 `aria-activedescendant`，结果项加 `role="option"` / `aria-selected`；
- `#scrim` 加 `aria-hidden="true"`；
- 侧栏阶段按钮已有 `aria-expanded`，保持；
- 页面唯一 `h1`，骨架页不得出现第二个 `h1`。

除此之外不新增交互、不改文案、不改布局。

### 4.10 错误边界与 Suspense

- 根路由 `errorElement` 捕获页面渲染异常，显示「页面加载失败，请刷新重试。」+ 返回总览；开发环境可显示 `Error.message`，生产构建不得包含堆栈；
- `AppShell` 的 `<main>` 内包一层 `<Suspense fallback={<PageFallback />}>`；E2 页面为静态导入，fallback 实际不出现，E3.5 引入懒加载后直接复用；
- 错误页不渲染课程内容，不写入存储。

## 5. 目标结构

```text
web/
  index.next.html                    # 新增：React 并行入口
  scripts/
    main.tsx                         # 新增：createRoot + RouterProvider
    app/
      router.tsx                     # 新增：routes + createHashRouter
      RouteErrorPage.tsx             # 新增：路由错误边界
      hooks/
        useProgress.ts               # 新增：store 版本 + 掌握度
        useLang.ts                   # 新增：语言轨道
      shell/
        AppShell.tsx                 # 新增：grid 外壳、skip link、scroll/focus、Suspense
        Topbar.tsx                   # 新增
        Sidebar.tsx                  # 新增
        SearchBox.tsx                # 新增
        LangSwitch.tsx               # 新增
        ToastProvider.tsx            # 新增
        toast-context.ts             # 新增：context 与类型
        useToast.ts                  # 新增：hook
        ResetProgress.tsx            # 新增
        search.ts                    # 新增：v2 搜索语义
      pages/
        OverviewPage.tsx             # 新增：骨架
        StagePage.tsx                # 新增：骨架
        LessonPage.tsx               # 新增：骨架
        ProjectPage.tsx              # 新增：骨架
        LabPage.tsx                  # 新增：骨架
        ReportPage.tsx               # 新增：骨架
        EmptyState.tsx               # 新增：空状态
    test/
      router.test.ts                 # 新增
      search.test.ts                 # 新增
      shell.test.tsx                 # 新增
e2e/
  shell.spec.ts                      # 新增
```

修改文件：

| 文件 | 改动 |
| --- | --- |
| `vite.config.ts` | 增加 `rollupOptions.input` 两个 HTML 入口；其余不变 |
| `package.json` | 增加 `dev:next`、`preview:next`；确认 `build` 已包含 `content:validate` |
| `web/scripts/state/store.ts` | 增加 `version` / `getVersion()`；导出 `DRAFT_KEY`（值不变） |
| `tsconfig.node.json` | 无需改动（`vite.config.ts` 已在 include） |

不新增任何依赖。

## 6. 任务卡

### T-E2.0 锁定外壳行为与路由基线

- **类型**：validation
- **依赖**：无（E1 门禁通过后）
- **产出**：
  - `docs/reviews/frontend-engineering/e2/contract.md`
  - `docs/reviews/frontend-engineering/e2/routes.txt`
  - 本任务不写业务代码
- **实现要求**：

1. 把 §3.1–§3.4 复制到 `contract.md`，逐项标注「v2 证据位置」（`web/index.html` 行号、`app.js` 函数名）；
2. 记录 66 条路由与 v2 的页面标题，作为 E2 烟测断言表；
3. 在 v2 浏览器里手工执行行为清单：阶段展开、当前课时、搜索键盘、语言刷新、抽屉、重置、skip link，并记录结果；
4. 记录 v2 基线：
   - `npx tsx tools/content-snapshot.ts` 输出；
   - `git rev-parse e1-typed`；
   - `npm run build` 产物中 `dist/index.html` 的脚本文件名；
   - 现有 React 相关依赖锁定版本（`npm ls react react-dom react-router`）。

- **命令**：

```bash
mkdir -p docs/reviews/frontend-engineering/e2
cp e2e/routes.json docs/reviews/frontend-engineering/e2/routes.txt
npx tsx tools/content-snapshot.ts | tee docs/reviews/frontend-engineering/e2/content-sha256.txt
npm ls react react-dom react-router
```

- **预期**：66 条路由；内容快照与 E1 一致；三个依赖版本分别为 19.3.1 / 19.3.1 / 7.18.5。
- **约束**：只记录，不修 v2 的任何行为；发现 v2 缺陷按总纲 §12.3 处理。
- **证据**：`contract.md` 含行为清单勾选结果与截图路径。
- **回滚**：删除 `docs/reviews/frontend-engineering/e2/`。
- **停止条件**：路由不是 66；依赖版本与 E0 锁定不一致；v2 基线本身白屏或有控制台错误。

### T-E2.1 并行入口、Vite 多入口与路由骨架

- **类型**：engine
- **依赖**：T-E2.0
- **产出**：
  - `web/index.next.html`
  - `web/scripts/main.tsx`
  - `web/scripts/app/router.tsx`
  - `web/scripts/app/RouteErrorPage.tsx`
  - `vite.config.ts` 修改
  - `package.json` scripts 修改
- **实现要求**：

1. `web/index.next.html` 与 `web/index.html` 的 head 保持一致（charset、viewport、title、description、theme-color、favicon、4 个 CSS），body 只保留：

```html
<noscript>
  <div class="noscript">这个学习站的讲解可以阅读，但练习需要在浏览器里执行 JavaScript。请启用 JavaScript 后再开始。</div>
</noscript>
<div id="root"></div>
<script type="module" src="./scripts/main.tsx"></script>
```

2. `main.tsx`：

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from './app/router';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('缺少 #root 挂载点');

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
```

3. `router.tsx` 导出 `routes` 与 `router`，便于单测：

```tsx
import { createHashRouter, type RouteObject } from 'react-router';
import { AppShell } from './shell/AppShell';
import RouteErrorPage from './RouteErrorPage';
import OverviewPage from './pages/OverviewPage';
import StagePage from './pages/StagePage';
import LessonPage from './pages/LessonPage';
import ProjectPage from './pages/ProjectPage';
import LabPage from './pages/LabPage';
import ReportPage from './pages/ReportPage';

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'stage/:stageId', element: <StagePage /> },
      { path: 'lesson/:lessonId', element: <LessonPage /> },
      { path: 'project/:projectId', element: <ProjectPage /> },
      { path: 'lab', element: <LabPage /> },
      { path: 'report', element: <ReportPage /> },
      { path: '*', element: <OverviewPage /> },
    ],
  },
];

export const router = createHashRouter(routes);
```

4. `vite.config.ts` 只增加入口解析与 `rollupOptions.input`：

```ts
import { fileURLToPath } from 'node:url';

const htmlEntry = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// 在 build 中追加：
rollupOptions: {
  input: {
    main: htmlEntry('./web/index.html'),
    next: htmlEntry('./web/index.next.html'),
  },
},
```

不要把 `root` 改成项目根，不要把 `outDir` 改成 `web/dist`（E6 回退方案才用）。

5. `RouteErrorPage.tsx`：

```tsx
import { Link, useRouteError } from 'react-router';

export default function RouteErrorPage() {
  const error = useRouteError();
  const detail = import.meta.env.DEV && error instanceof Error ? error.message : '';

  return (
    <div className="app" id="app">
      <main className="main" id="main" style={{ gridArea: '1 / 1 / -1 / -1' }}>
        <div className="page" role="alert">
          <div className="empty-state">页面加载失败，请刷新重试。</div>
          {detail ? <p style={{ marginTop: 12 }}>{detail}</p> : null}
          <p style={{ marginTop: 16 }}>
            <Link className="btn btn--ghost btn--sm" to="/">返回总览</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
```

6. `package.json` 增加：

```json
{
  "scripts": {
    "dev:next": "vite --open /index.next.html",
    "preview:next": "vite preview --open /index.next.html"
  }
}
```

`dev`、`build`、`preview` 不改名；`build` 必须已包含 `npm run content:validate` 与 `npm run typecheck`（E1 已建立，若缺失在本任务补齐并记录）。

- **命令**：

```bash
npm run build
find dist -maxdepth 1 -name "index*.html" -print
grep -o 'assets/[^"]*\.js' dist/index.next.html | head
npx vite preview --port 4173 &
```

- **预期**：
  - `dist/index.html` 与 `dist/index.next.html` 同时存在；
  - `dist/index.next.html` 引用带哈希的 JS；
  - 打开 `http://127.0.0.1:4173/index.next.html#/` 显示总览骨架，无白屏；
  - 打开 `http://127.0.0.1:4173/` 仍是 v2。
- **约束**：`web/index.html` 与 v2 JS 零改动；不新增依赖；不改 CSS。
- **证据**：两个 HTML 路径、React 入口脚本名、浏览器截图。
- **回滚**：删除新入口与 `app/`，还原 `vite.config.ts` / `package.json`。
- **停止条件**：Vite 无法解析 TSX；`dist/index.html` 被 React 覆盖；构建只产出一个 HTML；v2 入口行为变化。

### T-E2.2 状态 hooks 与 store 版本号

- **类型**：engine
- **依赖**：T-E2.1
- **产出**：
  - `web/scripts/app/hooks/useProgress.ts`
  - `web/scripts/app/hooks/useLang.ts`
  - `web/scripts/state/store.ts` 修改
- **实现要求**：

1. `store.ts` 增加内存版本号并导出草稿键：

```ts
export const DRAFT_KEY = 'bff-lab-drafts-v1';

let version = 0;

function emit() {
  version += 1;
  persist();
  listeners.forEach((fn) => fn(state));
}

export const store = {
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  getVersion() { return version; },
  // ...原有方法保持不变
};
```

2. `useProgress.ts`：

```ts
import { useMemo, useSyncExternalStore } from 'react';
import { store } from '../../state/store';
import { courseMastery, isLessonMastered, stageMastery } from '../../state/progress';

export function useProgress() {
  const version = useSyncExternalStore(store.subscribe, store.getVersion, () => 0);

  return useMemo(() => ({
    version,
    course: courseMastery(),
    stage: stageMastery,
    lessonDone: isLessonMastered,
  }), [version]);
}
```

3. `useLang.ts`：

```ts
import { useSyncExternalStore } from 'react';
import { lang, type LanguageId } from '../../state/lang';

export function useLang() {
  const current = useSyncExternalStore(lang.subscribe, lang.get, () => 'javascript' as LanguageId);
  return { current, set: lang.set };
}
```

- **命令**：

```bash
npx tsc --noEmit -p tsconfig.json
npm run test
```

- **预期**：tsc 0；现有 E1 状态测试全绿；`store.getVersion()` 在每次 `recordAnswer`、`setLessonDone`、`reset` 后递增。
- **约束**：版本号不持久化；`localStorage` 结构不变；不改变 store 原有方法的签名与语义。
- **证据**：单测中断言版本递增；报告记录 `localStorage` 键未变。
- **回滚**：还原 `store.ts`，删除两个 hook。
- **停止条件**：为了订阅而把 store 改成不可变结构（会波及 E1 测试）；`useSyncExternalStore` 出现无限重渲染；存储键变化。

### T-E2.3 Shell 静态结构与全局交互

- **类型**：feature
- **依赖**：T-E2.2
- **产出**：
  - `web/scripts/app/shell/AppShell.tsx`
  - `web/scripts/app/shell/Topbar.tsx`
  - `web/scripts/app/shell/Sidebar.tsx`
  - `web/scripts/app/shell/LangSwitch.tsx`
  - `web/scripts/app/shell/ToastProvider.tsx`
  - `web/scripts/app/shell/toast-context.ts`
  - `web/scripts/app/shell/useToast.ts`
  - `web/scripts/app/shell/ResetProgress.tsx`
- **实现要求**：

1. `AppShell.tsx` 负责 grid 外壳、skip link、抽屉状态、滚动复位、焦点、Suspense、ToastProvider：

```tsx
import { Suspense, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { ToastProvider } from './ToastProvider';
import Topbar from './Topbar';
import Sidebar from './Sidebar';

function PageFallback() {
  return <div className="page"><div className="empty-state" role="status">正在加载…</div></div>;
}

function ShellLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const lastPathname = useRef(pathname);

  useEffect(() => {
    const isRouteChange = lastPathname.current !== pathname;
    lastPathname.current = pathname;
    window.scrollTo(0, 0);
    setDrawerOpen(false);
    if (isRouteChange) mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          mainRef.current?.focus();
          mainRef.current?.scrollIntoView({ block: 'start' });
        }}
      >
        跳到主要内容
      </a>
      <div className="app" id="app">
        <Topbar drawerOpen={drawerOpen} onToggleDrawer={() => setDrawerOpen((open) => !open)} />
        <Sidebar open={drawerOpen} />
        <main className="main" id="main" tabIndex={-1} ref={mainRef}>
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <div
        className="scrim"
        id="scrim"
        hidden={!drawerOpen}
        aria-hidden="true"
        onClick={() => setDrawerOpen(false)}
      />
    </>
  );
}

export function AppShell() {
  return (
    <ToastProvider>
      <ShellLayout />
    </ToastProvider>
  );
}
```

2. `Topbar.tsx` 保持 §3.1 的 DOM；品牌 SVG、菜单 SVG、搜索图标、两个链接图标与 v2 完全一致。进度环：

```tsx
const progress = useProgress();
const offset = 97.4 * (1 - progress.course.percent / 100);
// <circle id="progress-ring" ... style={{ strokeDashoffset: String(offset) }} />
// <span id="progress-label">{progress.course.percent}%</span>
```

3. `Sidebar.tsx`：

- 用 `matchPath('/stage/:stageId', pathname)` 与 `matchPath('/lesson/:lessonId', pathname)` 计算当前阶段；
- 阶段默认全部折叠；当前阶段在 effect 中加入 `openStages`；
- 点击阶段头切换 `aria-expanded` 与 `is-open`；
- 阶段节点状态：`is-active`（当前阶段）、`is-done`（`mastery.done === mastery.total && mastery.total > 0`）；
- 课时链接状态：`is-done`（`progress.lessonDone`）、`is-current`（当前课时）；加 `aria-current="page"`；
- 徽标 `${mastery.done}/${mastery.total}`，进度条宽度 `${mastery.percent}%`；
- `.rail-head` 的 `#rail-count` 为 `${course.done}/${course.total}`；
- `data-stage`、`data-lesson`、`data-rail` 原样保留；
- `graduation` 链接的 `is-current` 行为与 v2 相同（v2 只对 `lab` / `report` 命中，保持，不额外修复）。

4. `LangSwitch.tsx` 使用 `LANGUAGES` 与 `useLang()`，按钮文本为 `item.short`，`title` 为 `切换到 ${item.label} 轨道`，`aria-pressed` 与 `is-active` 同步。

5. Toast：

```ts
// toast-context.ts
import { createContext } from 'react';
export type Notify = (message: string) => void;
export const ToastContext = createContext<Notify>(() => {});
```

```tsx
// ToastProvider.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ToastContext } from './toast-context';

interface ToastItem { id: number; message: string; leaving: boolean; }
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<number[]>([]);

  const notify = useCallback((message: string) => {
    const id = nextId++;
    setItems((prev) => [...prev, { id, message, leaving: false }]);
    const leave = window.setTimeout(() => {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, leaving: true } : item)));
    }, 2400);
    const remove = window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 2620);
    timers.current.push(leave, remove);
  }, []);

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toast-host" id="toast-host" role="status" aria-live="polite">
        {items.map((item) => (
          <div
            key={item.id}
            className="toast"
            style={item.leaving ? { opacity: 0, transform: 'translateY(6px)' } : undefined}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
```

```ts
// useToast.ts
import { useContext } from 'react';
import { ToastContext } from './toast-context';
export function useToast() {
  return useContext(ToastContext);
}
```

6. `ResetProgress.tsx`：

```tsx
import { DRAFT_KEY, store } from '../../state/store';
import { useToast } from './useToast';

export default function ResetProgress() {
  const notify = useToast();

  return (
    <div className="sidebar__foot">
      <p>进度保存在本机浏览器，换设备不会同步。</p>
      <button
        className="text-btn"
        id="reset-progress"
        type="button"
        onClick={() => {
          if (!window.confirm('确定要清空全部学习记录吗？此操作不可撤销。')) return;
          store.reset();
          localStorage.removeItem(DRAFT_KEY);
          notify('学习记录已清空');
        }}
      >
        清空学习记录
      </button>
    </div>
  );
}
```

- **命令**：

```bash
npm run dev:next
```

手工检查路径：

```text
http://127.0.0.1:5173/index.next.html#/
http://127.0.0.1:5173/index.next.html#/lesson/s0-l1
http://127.0.0.1:5173/index.next.html#/stage/s0
```

- **预期**：
  - 桌面三栏布局与 v2 一致；390px 下侧栏隐藏、菜单按钮出现；
  - 9 个阶段、45 个课时链接、阶段/总进度数字正确；
  - 当前课时链接 `is-current`，所在阶段自动展开；
  - 菜单按钮开抽屉、scrim 关闭、导航后自动关闭；
  - 语言按钮切换 `aria-pressed` 并写 `bff-lab-lang-v1`；
  - 重置弹确认，确认后进度归零、草稿键删除、toast 出现；
  - skip link 聚焦 `main` 且 hash 不变；
  - 0 控制台错误。
- **约束**：不改 CSS；不引入图标库；所有 SVG 从 v2 复制；不实现搜索（下一任务）。
- **证据**：桌面 1440、平板 768、手机 390 截图；抽屉打开截图；重置前后 localStorage 截图/记录。
- **回滚**：删除 `app/shell/*` 中本任务文件，还原 `store.ts`。
- **停止条件**：必须修改 CSS 才能对齐；DOM ID/类名与 §3.1 不一致；StrictMode 下出现重复监听/重复 toast；重置后草稿未删除。

### T-E2.4 搜索 combobox

- **类型**：feature
- **依赖**：T-E2.3
- **产出**：
  - `web/scripts/app/shell/search.ts`
  - `web/scripts/app/shell/SearchBox.tsx`
  - `Topbar.tsx` 接入搜索
- **实现要求**：

1. `search.ts` 严格复刻 v2 的搜索顺序、子标题与 12 条上限：

```ts
import { curriculum, graduationProject, stageLabel } from '../../content/index';
import { lessonHaystack } from '../../content/search';

export type SearchHitType = 'stage' | 'lesson' | 'project';

export interface SearchHit {
  type: SearchHitType;
  title: string;
  sub: string;
  to: string;
}

export function searchCurriculum(query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];

  curriculum.forEach((stage) => {
    if (
      stage.title.toLowerCase().includes(q)
      || (stage.keywords || []).some((keyword) => keyword.toLowerCase().includes(q))
    ) {
      hits.push({
        type: 'stage',
        title: stage.title,
        sub: `${stageLabel(stage)} · ${stage.subtitle}`,
        to: `/stage/${stage.id}`,
      });
    }

    stage.lessons.forEach((lesson) => {
      if (lessonHaystack(lesson).includes(q)) {
        hits.push({
          type: 'lesson',
          title: lesson.title,
          sub: `${stageLabel(stage)} · ${lesson.subtitle || ''}`,
          to: `/lesson/${lesson.id}`,
        });
      }
    });

    if (stage.project && `${stage.project.title} ${stage.project.brief}`.toLowerCase().includes(q)) {
      hits.push({
        type: 'project',
        title: stage.project.title,
        sub: '阶段项目',
        to: `/project/${stage.project.id}`,
      });
    }
  });

  const graduationText = `${graduationProject.title} ${graduationProject.brief} ${(graduationProject.stack || []).join(' ')}`;
  if (graduationText.toLowerCase().includes(q)) {
    hits.push({
      type: 'project',
      title: graduationProject.title,
      sub: '毕业项目',
      to: `/project/${graduationProject.id}`,
    });
  }

  return hits.slice(0, 12);
}
```

2. `SearchBox.tsx`：

- 受控 `query`、`open`、`active`；
- 输入时 `open = Boolean(next.trim())`，`active = -1`；
- `focus` 时有值则重新打开；
- `ArrowDown` / `ArrowUp` 循环，`Enter` 打开 `hits[active] ?? hits[0]`，随后清空、关闭、blur、`navigate(to)`；
- `Escape` 关闭并 blur；
- document `click` 判断是否在 `.topbar__search` 外，外部关闭；
- 结果为空且打开时显示 `.search-empty`「没有匹配的课程内容」；
- 结果项使用 `<Link role="option" aria-selected>`，类名 `search-hit`，激活项加 `is-active`；
- 输入加 `aria-activedescendant`，结果项 id 为 `search-hit-${index}`；
- 点击结果清空、关闭、blur；
- 搜索输入/结果容器复用 v2 的 id 与类名，不改 CSS。

3. 搜索图标、placeholder、`aria-label` 与 §3.4 完全一致。

- **命令**：

```bash
npm run dev:next
```

手工查询（每条都检查结果顺序与子标题）：

```text
地基                  → 阶段 s0 在最前
事件循环              → s0-l2 命中（阶段 s0 也在结果中）
LinkHub 数据层        → 阶段项目 p1
LinkHub 短链服务      → 毕业项目 p-graduation
不存在的词            → 没有匹配的课程内容
```

> 「短链服务」不是唯一查询：它还会命中附录 a6，因此 E2E 的键盘导航使用唯一查询「LinkHub 短链服务」。

- **预期**：
  - 结果最多 12 条，顺序为「阶段 → 该阶段课时 → 该阶段项目 → … → 毕业项目」；
  - ↑/↓ 高亮循环并可滚动到可视区；
  - Enter 打开当前项；无结果时 Enter 不导航；
  - 点击外部/Esc 关闭；点击结果后输入框清空；
  - 0 控制台错误。
- **约束**：不接入 `web/generated/search-index.json`；不改搜索正文；不改 v2 `app.js`。
- **证据**：搜索结果截图（阶段/课时/项目/空结果各一）、键盘操作录屏或步骤记录。
- **回滚**：删除 `search.ts` / `SearchBox.tsx`，Topbar 恢复无搜索版本。
- **停止条件**：搜索结果顺序或子标题与 v2 不同；需要改 E1 `lessonHaystack` 算法；combobox 键盘行为无法与 v2 对齐。

### T-E2.5 六个页面骨架与无效路由

- **类型**：feature
- **依赖**：T-E2.1
- **产出**：
  - `web/scripts/app/pages/OverviewPage.tsx`
  - `web/scripts/app/pages/StagePage.tsx`
  - `web/scripts/app/pages/LessonPage.tsx`
  - `web/scripts/app/pages/ProjectPage.tsx`
  - `web/scripts/app/pages/LabPage.tsx`
  - `web/scripts/app/pages/ReportPage.tsx`
  - `web/scripts/app/pages/EmptyState.tsx`
- **实现要求**：

1. 每个页面默认导出组件，且只渲染一个 `h1`；
2. 参数查询使用 E1 API：`stageById` / `lessonById` / `findProject` / `stageLabel`；
3. 无效 ID 的空状态文案与 v2 一致：

```tsx
// EmptyState.tsx
import { Link } from 'react-router';

export default function EmptyState({ text, back = false }: { text: string; back?: boolean }) {
  return (
    <div className="page">
      <div className="empty-state">{text}</div>
      {back ? (
        <p style={{ marginTop: 16 }}>
          <Link className="btn btn--ghost btn--sm" to="/">返回总览</Link>
        </p>
      ) : null}
    </div>
  );
}
```

4. 页面骨架要求：

| 页面 | 必须渲染 |
| --- | --- |
| 总览 | `h1` + 一句说明 + 指向 `#/lesson/s0-l1` 与 `#/lab` 的链接 |
| 阶段 | `h1` 阶段标题 + 副标题 + 全部课时链接 + 阶段项目链接（有则显示） |
| 课时 | `eyebrow` 阶段标签 + `h1` 课时标题 + 副标题 + 时长 + 「正文…将在 E3 迁移」说明 |
| 项目 | `eyebrow` + `h1` 项目标题 + `brief` + 里程碑数量 + E3 说明 |
| 实验台 | `h1`「HTTP 实验室」+ E3 说明 |
| 报告 | `h1`「学习报告」+ E3 说明 |

5. `RouteErrorPage` 已在 T-E2.1 建立；本任务不重复实现。
6. 骨架可以使用现有 `hero`、`stage-hero`、`badge`、`btn` 类，但不实现内容块、练习、里程碑交互。

- **命令**：

```bash
npm run dev:next
```

逐条打开：

```text
#/
#/stage/s0
#/stage/appendix
#/lesson/s0-l1
#/lesson/s7-l5
#/project/p-graduation
#/lab
#/report
#/stage/not-exist
#/lesson/not-exist
#/project/not-exist
#/unknown-route
```

- **预期**：
  - 66 条已知路由都有且只有一个 `main h1`；
  - 无效阶段/项目显示对应空状态；无效课时显示空状态 + 返回总览；
  - 未知路由显示总览，URL 不变；
  - 所有链接可导航，无控制台错误。
- **约束**：不渲染课程正文/检查题/练习；不添加临时组件库；不改内容。
- **证据**：六个页面 + 三个无效态的截图；每页 `h1` 文本记录。
- **回滚**：删除 `pages/*`，路由恢复为单总览占位。
- **停止条件**：任何页面需要改用 E3 才有的组件；无效路由被重定向导致 URL 变化；一个页面出现多个 `h1`。

### T-E2.6 组件测试与 React 外壳烟测

- **类型**：validation
- **依赖**：T-E2.2、T-E2.3、T-E2.4、T-E2.5
- **产出**：
  - `web/scripts/test/router.test.ts`
  - `web/scripts/test/search.test.ts`
  - `web/scripts/test/shell.test.tsx`
  - `e2e/shell.spec.ts`
- **实现要求**：

1. `router.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { matchRoutes } from 'react-router';
import { routes } from '../app/router';
import { allLessons, curriculum, graduationProject } from '../content/index';

const paths = [
  '/',
  ...curriculum.map((stage) => `/stage/${stage.id}`),
  ...allLessons.map((lesson) => `/lesson/${lesson.id}`),
  ...curriculum.flatMap((stage) => (stage.project ? [`/project/${stage.project.id}`] : [])),
  `/project/${graduationProject.id}`,
  '/lab',
  '/report',
];

describe('router', () => {
  it('覆盖 66 条路由', () => {
    expect(paths).toHaveLength(66);
  });

  it.each(paths)('匹配 %s', (path) => {
    expect(matchRoutes(routes, path)).not.toBeNull();
  });

  it('未知路径回落到总览', () => {
    expect(matchRoutes(routes, '/nope')?.at(-1)?.route.path).toBe('*');
  });
});
```

2. `search.test.ts`：

- `searchCurriculum('   ')` 返回 `[]`；
- `searchCurriculum('地基')[0].to === '/stage/s0'`；
- `searchCurriculum('事件循环')` 命中 `/lesson/s0-l2`；
- `searchCurriculum('LinkHub 短链服务')` 命中 `/project/p-graduation`；
- 宽泛查询结果长度 ≤ 12；
- 项目子标题为「阶段项目」/「毕业项目」。

3. `shell.test.tsx` 用 `createMemoryRouter(routes)` 渲染，覆盖：

| 用例 | 断言 |
| --- | --- |
| 侧栏规模 | `.stage-node` 9 个、`.lesson-link` 45 个、`#rail-count` 为 `0/45` |
| 当前课时 | `/lesson/s0-l1` 下该链接有 `is-current`，s0 阶段 `is-active` 且 `aria-expanded=true` |
| 进度联动 | `store.setLessonDone('s0-l1', true)` 后 `#rail-count` 变为 `1/45`，s0 徽标 `1/3` |
| 搜索键盘 | 输入「LinkHub 短链服务」→ ↓ → Enter，memory router `pathname` 为 `/project/p-graduation`，输入清空、结果隐藏 |
| 搜索空态 | 输入「不存在的词」显示「没有匹配的课程内容」 |
| 语言轨道 | 点击 Python 后 `aria-pressed=true`，`localStorage['bff-lab-lang-v1']==='python'` |
| 抽屉 | 点击 `#menu-toggle` 后 `#sidebar.is-open`、scrim 非 hidden；点击 scrim 关闭 |
| 重置 | 预置进度与草稿 → 点击重置（confirm=true）→ `0/45`、草稿删除、toast 文案出现 |
| 无效 ID | `/lesson/not-exist` 显示「找不到这一讲，可能是链接有误。」 |

测试环境前置：`window.scrollTo`、`HTMLElement.prototype.scrollIntoView`、`window.confirm` 用 `vi.fn()` 替换；每个用例 `localStorage.clear()`、`store.reset()`、`lang.set('javascript')`。

4. `e2e/shell.spec.ts`：

```ts
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const routes = JSON.parse(readFileSync('e2e/routes.json', 'utf8')) as string[];
const reactUrl = (route: string) => `/index.next.html${route}`;

test.describe('React shell', () => {
  test.setTimeout(180_000);

  test('66 条路由可解析且无控制台错误', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    for (const route of routes) {
      await page.goto(reactUrl(route));
      await expect(page.locator('main h1')).toBeVisible();
      expect(errors, route).toEqual([]);
    }
  });

  test('侧栏、搜索与语言轨道', async ({ page }) => {
    await page.goto('/index.next.html#/lesson/s0-l1');
    await expect(page.locator('.stage-node')).toHaveCount(9);
    await expect(page.locator('.lesson-link')).toHaveCount(45);
    await expect(page.locator('.lesson-link.is-current')).toContainText('从 URL 到响应');

    const search = page.locator('#search-input');
    await search.fill('LinkHub 短链服务');
    await expect(page.locator('.search-hit')).toHaveCount(1);
    await search.press('ArrowDown');
    await search.press('Enter');
    await expect(page).toHaveURL(/#\/project\/p-graduation$/);
    await expect(search).toHaveValue('');

    await page.getByRole('button', { name: 'Python' }).click();
    await expect(page.getByRole('button', { name: 'Python' })).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Python' })).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('移动端抽屉', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('菜单打开、scrim 关闭', async ({ page }) => {
    await page.goto('/index.next.html#/');
    await page.getByRole('button', { name: '打开课程目录' }).click();
    await expect(page.locator('#sidebar')).toHaveClass(/is-open/);
    await expect(page.locator('#scrim')).toBeVisible();
    await page.locator('#scrim').click({ position: { x: 380, y: 400 } });
    await expect(page.locator('#sidebar')).not.toHaveClass(/is-open/);
  });
});
```

- **命令**：

```bash
npm run test
npm run build
npx playwright test e2e/shell.spec.ts --project=chromium
npx playwright test e2e/smoke.spec.ts --project=chromium
```

- **预期**：
  - 组件测试全绿；路由测试 66/66 匹配；
  - React 外壳 66/66 可解析，0 控制台错误；
  - 移动端抽屉用例通过；
  - v2 烟测 66/66 仍通过。
- **约束**：测试只断言本文档规定的行为；不为通过测试改可见行为；不跳过失败用例。
- **证据**：测试数量与通过数、Playwright HTML 报告路径、失败截图（如有）。
- **回滚**：删除新增测试与 `e2e/shell.spec.ts`。
- **停止条件**：66 路由中有任一失败；控制台错误来自 React/路由/Hook；v2 烟测因共享 chunk 回归。

### T-E2.7 G-E2 门禁与交付

- **类型**：validation
- **依赖**：T-E2.6
- **产出**：
  - `docs/reviews/frontend-engineering/e2-shell.md`
  - `docs/reviews/frontend-engineering/e2/` 截图证据
  - 更新 `known-issues.md`（如有）
  - 标签 `e2-shell`
- **执行顺序**：

```bash
# 1. 静态
npm run lint
npx tsc --noEmit -p tsconfig.json
npx tsc --noEmit -p tsconfig.node.json

# 2. 内容不变
npx tsx tools/content-snapshot.ts
diff -u docs/reviews/frontend-engineering/e1/content-before.txt <(npx tsx tools/content-snapshot.ts)

# 3. 单测
npm run test

# 4. 构建
npm run build
find dist -maxdepth 1 -name "index*.html" -print

# 5. 浏览器
npx playwright test e2e/smoke.spec.ts --project=chromium
npx playwright test e2e/shell.spec.ts --project=chromium

# 6. 默认入口未变
git diff --exit-code e1-typed -- web/index.html web/scripts/app.js web/scripts/views web/styles
```

- **预期**：

```text
lint 0 error
tsc 两份配置均 0
内容快照与 E1 一致
单测全绿（E1 的 9 个测试文件 + E2 的 3 个）
dist/index.html 与 dist/index.next.html 同时存在
v2 烟测 66/66
React 外壳烟测 66/66
v2 默认入口与样式零 diff
```

- **浏览器证据**（保存到 `docs/reviews/frontend-engineering/e2/`）：

| 文件 | 视口 | 内容 |
| --- | --- | --- |
| `overview-1440.png` | 1440×900 | 总览 + 侧栏 + 顶栏 |
| `overview-768.png` | 768×1024 | 平板布局 |
| `overview-390.png` | 390×844 | 手机布局（侧栏收起） |
| `search-1440.png` | 1440×900 | 搜索「LinkHub 短链服务」结果 |
| `drawer-390.png` | 390×844 | 抽屉打开 + scrim |
| `reset-toast.png` | 1440×900 | 重置后的 toast |

可用 `npx playwright screenshot --viewport-size="1440,900" "http://127.0.0.1:4173/index.next.html#/" docs/reviews/frontend-engineering/e2/overview-1440.png` 生成；预览服务器用 `npm run preview` 另开终端。

- **报告必须包含**：
  1. 环境与提交；
  2. 依赖版本；
  3. 命令与退出码；
  4. 66 路由结果与 0 控制台错误证据；
  5. 侧栏/搜索/语言/抽屉/重置的行为记录；
  6. 截图路径；
  7. 内容快照与 v2 默认入口零 diff；
  8. 包体变化（React 入口 eager 大小，仅记录，不设门禁）；
  9. 问题与修复；
  10. 残余风险（至少：页面仍是骨架、搜索仍是内存全文、未接懒加载）；
  11. 门禁结论。
- **标签**：

```bash
git tag -a e2-shell -m "E2 React 外壳：并行入口、66 路由、Shell、搜索与状态 hooks"
```

- **约束**：不发布；不切换默认入口；不改 `functions/`；不删除旧代码。
- **停止条件**：任一门禁失败；v2 默认入口差异；内容快照变化；需要改 CSS 或 URL 才能通过。

## 7. E2 行为验收清单

逐项打勾并附证据（测试名或截图）：

- [ ] React 入口 `#/` 渲染总览骨架，唯一 `h1`；
- [ ] 9 个阶段、45 个课时链接、9 个项目路由、`#/lab`、`#/report` 全部可解析；
- [ ] 未知路由显示总览且 URL 不变；
- [ ] 无效阶段/课时/项目显示对应空状态文案；
- [ ] 当前阶段自动展开并 `is-active`；当前课时 `is-current` + `aria-current`；
- [ ] 阶段计数、总计数、进度环随 store 更新；
- [ ] 搜索：阶段/课时/项目顺序、子标题、12 条上限、空态、↑/↓/Enter/Esc、点击外部、点击结果清空；
- [ ] 语言切换：`aria-pressed`、`localStorage`、刷新后保持、滚动位置不变；
- [ ] 抽屉：390px 打开/关闭/导航后关闭；
- [ ] 重置：确认文案、进度归零、草稿删除、toast；
- [ ] skip link 聚焦 `main`、hash 不变；
- [ ] 路由切换滚动到顶、焦点落在 `main`；
- [ ] v2 默认入口、v2 样式、v2 烟测零回归；
- [ ] `dist/index.html` 与 `dist/index.next.html` 同时存在；
- [ ] 0 控制台错误。

## 8. 风险与对策

| 风险 | 表现 | 对策 |
| --- | --- | --- |
| store 快照引用不变 | 进度/侧栏不更新 | 版本号 + `useSyncExternalStore`；单测断言 |
| CSS 选择器漂移 | 顶栏/侧栏错位 | §3.1 契约；E2 禁止改 CSS；逐页截图 |
| 搜索行为漂移 | 顺序/子标题/键盘不同 | 直接复用 v2 逻辑与 E1 `lessonHaystack`；固定文案 |
| 抽屉/焦点副作用 | StrictMode 重复监听 | effect cleanup；组件测试在 StrictMode 外 + 手工 dev 验证 |
| 多入口构建回归 v2 | `dist/index.html` 被覆盖 | 两个入口显式命名；v2 烟测必跑 |
| `main` 抢焦点 | 屏幕阅读器体验差 | 初次不聚焦；仅路由切换聚焦；skip link 单独处理 |
| 搜索全文性能 | 每次输入遍历 45 讲 | E1 `lessonHaystack` 缓存；E3.5 换预生成索引 |
| React 入口过大 | 首屏慢 | E2 接受（eager），E3.5 懒加载；E4 包体门禁 |
| 错误边界泄露堆栈 | 生产显示内部信息 | 仅 `import.meta.env.DEV` 显示 message |
| 页面骨架被误当最终版 | E3 重复实现/漏项 | 报告明确「骨架」；E3 逐页替换并对照 v2 |

## 9. 回滚与交接

### 9.1 回滚

- 每个任务一个提交；失败用 `git revert <commit>`。
- 最坏回退到 `e1-typed`；回退前保存 `docs/reviews/frontend-engineering/e2/`。
- 不删除 `e1-typed` 标签，不发布。

### 9.2 交给 E3 的输入

E3 开始时必须满足：

- `e2-shell` 标签存在，工作区干净；
- `web/index.next.html` 可运行，66 路由 0 控制台错误；
- `app/router.tsx` 的 `routes` 稳定；E3 只替换 `pages/*` 内容，不改路由表；
- `AppShell`、`Topbar`、`Sidebar`、`SearchBox`、`LangSwitch`、`ToastProvider`、`useToast`、`useProgress`、`useLang` API 稳定；
- 搜索入口固定为 `searchCurriculum(query)`，E3.5 可替换数据源而不动组件；
- `EmptyState` 可供 E3 复用；
- 报告记录：页面为骨架、搜索为内存全文、未接懒加载、未发布、未动 `functions/`。

E3 的第一条命令应是：

```bash
git checkout e2-shell
npm ci
npm run verify
```
