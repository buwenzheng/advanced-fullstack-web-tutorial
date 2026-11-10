# E2 交付报告：React 外壳（并行入口、66 路由与全局交互）

- 阶段：E2（前置 `e1-typed`）
- 日期：2026-11-10
- 结论：**G-E2 通过**；标签 `e2-shell`；默认入口仍为 v2，未发布。
- 基线提交：`e1-typed` = `849564edb3757ea2a162bd189f8b7ff093e71036`
- 环境：Node `v22.15.0`，npm `10.9.2`，Windows 10.0.22631

## 1. 交付范围

新增并行入口 `web/index.next.html` 与 React 19 + React Router 7 外壳，与 v2（`web/index.html` + `app.js`）同时构建：

- `web/scripts/main.tsx`、`app/router.tsx`、`app/RouteErrorPage.tsx`；
- `app/shell/`：`AppShell`、`Topbar`、`Sidebar`、`SearchBox`、`LangSwitch`、`ToastProvider`、`ResetProgress`、`search.ts`；
- `app/hooks/`：`useProgress`、`useLang`（`useSyncExternalStore` 接入 E1 store/lang）；
- 六个页面骨架与 `EmptyState`：总览、阶段、课时、项目、实验台、报告；
- 组件测试与 Playwright React 外壳烟测；
- Vite 双入口构建；`dev:next` / `preview:next` 脚本；
- `store.ts` 增加内存版本号与 `DRAFT_KEY` 导出（不持久化版本号）。

未改动：`web/index.html`、`app.js`、`views/**`、`ui.js`、`exercise.js`、所有 CSS、课程内容、hash URL、localStorage 键与迁移规则、`functions/`；未切换默认入口、未发布。

## 2. 依赖

`npm ls react react-dom react-router --depth=0`：

```text
react@19.3.1
react-dom@19.3.1
react-router@7.18.5
```

无新增依赖。

## 3. 提交

| 任务 | 提交 | 说明 |
| --- | --- | --- |
| T-E2.0 | `9027bba` | 锁定 v2 契约、66 路由与行为基线 |
| T-E2.1 | `7167a40` | 并行入口、Vite 多入口与路由骨架 |
| T-E2.2 | `84b802f` | store 版本号与 `useProgress` / `useLang` |
| T-E2.3 | `1eef1cc` | 完整外壳、侧栏、语言、抽屉、进度环与重置 |
| T-E2.3 修复 | `683cc41` | 用派生状态替代 effect 内 setState，修复 hooks lint |
| T-E2.4 | `fc201bb` | 搜索 combobox、12 条上限与键盘交互 |
| T-E2.5 | `74917c5` | 六个页面骨架、无效 ID 空状态与唯一 h1 |
| T-E2.6 | `765d027` | 路由矩阵、搜索、外壳组件测试与 React 烟测 |

## 4. 命令与退出码

完整日志：`docs/reviews/frontend-engineering/e2/gates.txt`。

| 命令 | 结果 |
| --- | --- |
| `npm run lint` | exit 0，0 error |
| `npx tsc --noEmit -p tsconfig.json` | exit 0 |
| `npx tsc --noEmit -p tsconfig.node.json` | exit 0 |
| `npx tsx tools/content-snapshot.ts` | `sha256=f53ef370…24bab3`，与 E1 一致 |
| `diff -u e1/content-before.txt <(content-snapshot)` | exit 0（无差异） |
| `npm run test` | 12 个文件 / **166 tests passed** |
| `npm run build` | exit 0 |
| `find dist -maxdepth 1 -name 'index*.html'` | `dist/index.html`、`dist/index.next.html` |
| `npx playwright test e2e/smoke.spec.ts --project=chromium` | **66 passed**（v2） |
| `npx playwright test e2e/shell.spec.ts --project=chromium` | **3 passed**（React 66 路由 / 侧栏搜索语言 / 移动端抽屉） |
| `git diff --exit-code e1-typed -- web/index.html web/scripts/app.js web/scripts/views web/styles` | exit 0（默认入口与样式零 diff） |
| `grep -R "ZodError\|from \"zod\"" dist/assets` | 无命中 |
| `du -sh dist/assets` | 1.8M |

## 5. 66 路由与 0 控制台错误

`e2e/shell.spec.ts` 遍历 `e2e/routes.json` 的 66 条 hash 路由（`#/` 1 + 阶段 9 + 课时 45 + 项目 9 + `#/lab` + `#/report`），逐条断言 `main h1` 可见并收集 `console.error` / `pageerror`：

```text
ok 1 [chromium] › React shell › 66 条路由可解析且无控制台错误
ok 2 [chromium] › React shell › 侧栏、搜索与语言轨道
ok 3 [chromium] › 移动端抽屉 › 菜单打开、scrim 关闭
3 passed
```

无效 ID 与未知路由由组件测试覆盖：

- `/lesson/not-exist` → 「找不到这一讲，可能是链接有误。」+ 返回总览；
- `/stage/not-exist` → 「找不到这个阶段。」；
- `/project/not-exist` → 「找不到这个项目。」；
- `/unknown-route` → 总览且 `pathname` 保持 `/unknown-route`（不重定向）。

## 6. 行为记录

| 行为 | 证据 |
| --- | --- |
| 9 个阶段、45 个课时、`#rail-count=0/45` | `shell.test.tsx`「侧栏规模」；e2e 侧栏断言 |
| 当前课时 `is-current` + `aria-current`，s0 自动展开并 `is-active` | `shell.test.tsx`「当前课时」 |
| 标记 s0-l1 后总计数 `1/45`、s0 徽标 `1/3` | `shell.test.tsx`「进度联动」 |
| 搜索阶段优先、课时全文、毕业项目、≤12 条、子标题 | `search.test.ts` 6 项 |
| 搜索 ↓ + Enter 进入 p-graduation，输入清空、结果隐藏 | `shell.test.tsx`「搜索键盘」；e2e |
| 搜索空态「没有匹配的课程内容」 | `shell.test.tsx` |
| Python 写入 `bff-lab-lang-v1`、`aria-pressed` 同步、刷新保持 | `shell.test.tsx`；e2e |
| 390px 抽屉打开、scrim 关闭 | `shell.test.tsx`；e2e |
| 重置确认文案、进度归零、草稿删除、toast | `shell.test.tsx`「重置」；截图 `reset-toast.png` |
| skip link 聚焦 `main` 且 hash 不变 | v2 基线 `baseline-v2.txt`；实现为 `preventDefault` + `focus` + `scrollIntoView` |
| 路由切换滚动复位、焦点 `main`（初次不抢焦点） | `AppShell` 中 `useRef(pathname)` 判定，StrictMode 双调用安全 |
| 当前阶段/课时、项目与 lab/report 链接状态 | `Sidebar` 派生状态；e2e 当前课时 |

## 7. 截图

保存在 `docs/reviews/frontend-engineering/e2/`：

| 文件 | 视口 | 内容 |
| --- | --- | --- |
| `overview-1440.png` | 1440×900 | 总览 + 侧栏 + 顶栏 |
| `overview-768.png` | 768×1024 | 平板布局 |
| `overview-390.png` | 390×844 | 手机布局（侧栏收起） |
| `search-1440.png` | 1440×900 | 搜索「LinkHub 短链服务」结果 |
| `drawer-390.png` | 390×844 | 抽屉打开 + scrim |
| `reset-toast.png` | 1440×900 | 重置后的 toast |

另有 v2 基线证据：`baseline-v2.txt`（2 passed）、`routes.txt`、`content-sha256.txt`、`dependencies.txt`、`e1-typed.txt`、`contract.md`。

## 8. 包体变化（仅记录，不设门禁）

| 产物 | 大小 | gzip |
| --- | --- | --- |
| `dist/index.html`（v2） | 4.23 kB | 1.96 kB |
| `dist/index.next.html`（React） | 1.41 kB | 0.96 kB |
| `assets/main-*.js`（v2 入口） | 90.36 kB | 30.85 kB |
| `assets/next-*.js`（React 入口） | 331.92 kB | 105.90 kB |
| `assets/progress-*.js`（v2/React 共享内容块） | 1,327.24 kB | 394.76 kB |
| `assets/progress-*.css` | 42.55 kB | 8.64 kB |
| `assets/js.worker-*.js` | 2.55 kB | — |

React 入口为 eager 加载，E3.5 引入阶段懒加载后预期下降；E4 再设门禁。

## 9. 问题与修复

1. **React Hooks lint（`react-hooks/set-state-in-effect`）**：Sidebar 的「当前阶段自动展开」与 AppShell 的「路由变化关闭抽屉」最初在 effect 内直接 setState。改为派生状态：
   - Sidebar：`openStages` / `collapsedStages` 两个集合，`expanded = openStages.has(id) || (isActive && !collapsedStages.has(id))`；
   - AppShell：抽屉状态携带打开时的 `pathname`，路径变化后 `drawerOpen` 自然为 false。
   行为不变，避免级联渲染，StrictMode 双调用安全。
2. **T-E2.1 阶段占位**：路由骨架需要页面与 AppShell 才能编译，T-E2.1 先提交最小页面；T-E2.3/T-E2.5 替换为完整外壳与骨架页。最终状态一致，提交边界见 §3。
3. **共享 chunk 命名**：内容模块被 v2 与 React 入口同时引用，Rollup 以 `progress-*.js` 命名共享块；`dist/index.html` 仍指向 v2 的 `main-*.js`，v2 行为未变（66/66 烟测）。

## 10. 残余风险

- **页面仍是骨架**：正文、12 类内容块、检查题、练习、项目里程碑、实验台与报告均留待 E3；当前页面只保证唯一 `h1`、导航与空状态；
- **搜索仍是内存全文**：每次输入遍历 45 讲并复用 E1 `lessonHaystack` 缓存；E3.5 才切换到预生成索引；
- **未接懒加载**：六个页面静态导入，Suspense 占位当前不会出现；React 入口 eager 体积约 331.92 kB（gzip 105.90 kB）+ 共享内容块；
- **默认入口未切换**：`/` 仍加载 v2；React 入口仅在 `/index.next.html`，E5 才切换与清理；
- **既有问题**：见 `known-issues.md` KI-1（runner starter 差异）、KI-2（Pyodide CDN）、KI-3（SQL 教学子集）、KI-4（E2 外壳骨架与内存搜索）。

## 11. E2 验收清单

- [x] React 入口 `#/` 渲染总览骨架，唯一 `h1`（e2e + 截图）
- [x] 9 个阶段、45 个课时、9 个项目、`#/lab`、`#/report` 全部可解析（66/66 e2e）
- [x] 未知路由显示总览且 URL 不变（组件测试）
- [x] 无效阶段/课时/项目空状态文案（组件测试）
- [x] 当前阶段自动展开、`is-active`；当前课时 `is-current` + `aria-current`（组件测试）
- [x] 阶段计数、总计数、进度环随 store 更新（组件测试）
- [x] 搜索顺序/子标题/12 条上限/空态/键盘/外部关闭/点击清空（单测 + e2e）
- [x] 语言切换 `aria-pressed`、localStorage、刷新保持（单测 + e2e）
- [x] 抽屉 390px 打开/关闭（组件测试 + e2e + 截图）
- [x] 重置确认、归零、草稿删除、toast（组件测试 + 截图）
- [x] skip link 聚焦 `main`、hash 不变（实现 + v2 基线）
- [x] 路由切换滚动复位、焦点 `main`（实现；StrictMode 安全）
- [x] v2 默认入口、样式、66 烟测零回归（diff + smoke）
- [x] `dist/index.html` 与 `dist/index.next.html` 同时存在（构建）
- [x] 0 控制台错误（React 66 路由 e2e）

## 12. 门禁结论与交接

G-E2 全部通过，标签 `e2-shell`，工作区干净；未发布、未改 `functions/`、未切换默认入口。

交给 E3 的稳定接口：

- `routes`（`app/router.tsx`）与六个页面路径；
- `AppShell`、`Topbar`、`Sidebar`、`SearchBox`、`LangSwitch`、`ToastProvider`、`useToast`、`useProgress`、`useLang`；
- `searchCurriculum(query)` 入口；`EmptyState` 可复用；
- 页面仍为骨架、搜索为内存全文、未接懒加载、React 入口非默认。

E3 第一条命令：

```bash
git checkout e2-shell
npm ci
npm run verify
```
