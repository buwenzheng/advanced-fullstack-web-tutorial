# E2 外壳契约与 v2 行为基线

> 基线提交：`e1-typed` = 849564edb3757ea2a162bd189f8b7ff093e71036
> 基线内容快照：`sha256=f53ef3709599e7801fae93133bec6f9c3434ece3fb54b7491853c963ea24bab3`
> 基线构建：`dist/index.html` 脚本 `assets/index-CjFYhlU8.js`
> 依赖：react 19.3.1 / react-dom 19.3.1 / react-router 7.18.5（`dependencies.txt`）
> 路由：66 条（`routes.txt`，`routes 66`）

## 1. DOM、ID 与类名契约

| 选择器 | 约束 | v2 证据位置 |
| --- | --- | --- |
| `.app#app` | 最外层 grid：topbar/sidebar/main 三个区域 | `web/index.html:22` |
| `header.topbar` | 顶栏容器 | `web/index.html:23` |
| `#menu-toggle.icon-btn.topbar__menu` | `type="button"`、`aria-label="打开课程目录"`、`aria-expanded`、`aria-controls="sidebar"` | `web/index.html:24`；`app.js:334-337` |
| `a.brand` | `href="#/"`，`aria-label="返回学习总览"`，内部 SVG 与两行文字不变 | `web/index.html:28-36` |
| `.topbar__search` | 搜索容器；内部 `#search-input` 与 `#search-results` | `web/index.html:38-42` |
| `#search-input` | `type="search"`、`role="combobox"`、`aria-autocomplete="list"`、`aria-controls="search-results"`、`aria-expanded` | `web/index.html:40` |
| `#search-results.search-results` | `role="listbox"`，关闭时 `hidden` | `web/index.html:41`；`app.js:247-276` |
| `#lang-switch.lang-switch` | `role="group"`、`aria-label="代码语言轨道"`；按钮 `data-lang`、`aria-pressed` | `web/index.html:45`；`app.js:279-298` |
| `.topbar__actions` | 语言、实验台、报告、进度环 | `web/index.html:44` |
| `.topbar__link` | 两个链接，`href="#/lab"`、`href="#/report"` | `web/index.html:46-53` |
| `#progress-chip.progress-chip` | `title="总体完成度"` | `web/index.html:54` |
| `#progress-ring.progress-chip__value` | SVG circle，`r=15.5`，`stroke-dashoffset=97.4*(1-percent/100)` | `web/index.html:57`；`app.js:121-124` |
| `#progress-label` | `${percent}%` | `web/index.html:59`；`app.js:124` |
| `aside#sidebar.sidebar` | `aria-label="课程目录"`；打开时附加 `is-open` | `web/index.html:64`；`app.js:301-310` |
| `nav#sidebar-nav.sidebar__scroll` | 可滚动目录区 | `web/index.html:65`；`app.js:41-99` |
| `.rail-head` | `h2` 文案「学习路径」+ `#rail-count`（`done/total`） | `app.js:44-46`、`app.js:101-104` |
| `.stage-node[data-stage]` | 9 个阶段节点；状态类 `is-open` / `is-active` / `is-done` | `app.js:51`、`app.js:106-119`、`app.js:127-138` |
| `.stage-node__head` | `button`、`aria-expanded`；内部 pip/title/badge/chevron | `app.js:52-64` |
| `.stage-node__bar > i` | `width: percent%` | `app.js:66`、`app.js:112-113` |
| `.stage-node__lessons` | `ul`；每讲一个 `a.lesson-link[data-lesson]`，状态类 `is-done` / `is-current` | `app.js:68-79`、`app.js:115-118`、`app.js:135-137` |
| `.rail-section` + `.rail-link[data-rail]` | `lab` / `report` / `graduation` 三个链接 | `app.js:87-96`、`app.js:139-141` |
| `.sidebar__foot` | 说明文字 + `#reset-progress` 按钮 | `web/index.html:66-69` |
| `main#main.main` | `tabindex="-1"`，路由内容容器 | `web/index.html:72` |
| `#scrim.scrim` | 关闭时 `hidden`；`aria-hidden="true"` | `web/index.html:75`；`app.js:306-310` |
| `#toast-host.toast-host` | `role="status"`、`aria-live="polite"` | `web/index.html:76`；`ui.js` toast |
| `.skip-link` | `href="#main"`，点击后聚焦 `main`，不改变 hash | `web/index.html:16`；`app.js:338-342` |

## 2. 路由表

| hash | React 路径 | 页面 | v2 行为 | 证据 |
| --- | --- | --- | --- | --- |
| `#/` | `/` | OverviewPage | 总览 | `app.js:24-30`、`app.js:169-170` |
| `#/stage/:id` | `/stage/:stageId` | StagePage | 阶段页 | `app.js:154-155` |
| `#/lesson/:id` | `/lesson/:lessonId` | LessonPage | 课时页 | `app.js:156-157` |
| `#/project/:id` | `/project/:projectId` | ProjectPage | 项目页（含毕业项目） | `app.js:158-159` |
| `#/lab` | `/lab` | LabPage | HTTP 实验台 | `app.js:160-161` |
| `#/report` | `/report` | ReportPage | 学习报告 | `app.js:162-163` |
| 其他 | `*` | OverviewPage | 未知路由回落总览，URL 不重写 | `app.js:24-30` |

- 66 条已知路由：`#/` 1 条 + 阶段 9 条 + 课时 45 条 + 项目 9 条 + `#/lab` + `#/report`（见 `routes.txt`）。
- 阶段/课时/项目 ID 不存在时仍正常解析路由，由页面渲染空状态，不做重定向。

## 3. 行为清单与 v2 实测结果

自动化基线脚本：`e2e/baseline-check.spec.ts`（临时脚本，执行后删除）；输出 `baseline-v2.txt`。

| 行为 | v2 事实 | E2 要求 | v2 实测 |
| --- | --- | --- | --- |
| 路由切换 | `hashchange` 后渲染并 `scrollTo(0,0)` | 监听 `pathname`，滚动复位；初次加载也复位；后续切换聚焦 `main`（`preventScroll`） | 通过（源码 `app.js:34-38`） |
| 侧栏初始 | 所有阶段折叠 | 默认全折叠 | 通过 |
| 侧栏激活 | 当前阶段自动展开并 `is-active`；当前课时 `is-current` | 相同；用户可手动折叠非当前阶段 | 通过（s0 `is-open`/`is-active`，s0-l1 `is-current`） |
| 阶段展开 | 点击头部切换 `is-open`/`aria-expanded` | 相同 | 通过（s1 展开再折叠） |
| 阶段计数 | `stageMastery` 的 `done/total` 与百分比条 | 相同 | 通过 |
| 总进度 | `courseMastery` 的 `done/total` 与百分比环 | 相同 | 通过（初始 `0/45`，重置后 `0/45`） |
| 搜索范围 | 阶段标题+keywords；课时全文 haystack；项目标题+brief；毕业项目额外 stack | 相同顺序、相同子标题、最多 12 条 | 通过（`LinkHub 短链服务` 唯一命中） |
| 搜索键盘 | ↑/↓ 循环、Enter 打开当前/第一条、Esc 关闭并 blur | 相同；无结果时 Enter 不导航 | 通过（↓ + Enter 进入 p-graduation，输入清空） |
| 搜索鼠标 | 点击结果关闭并清空；点击外部关闭 | 相同 | 通过（源码 `app.js:260-267`、`app.js:354-359`） |
| 语言切换 | 写 `bff-lab-lang-v1`；切换后保持滚动位置 | 相同；不触发路由跳转 | 通过（Python 刷新后仍 `aria-pressed=true`） |
| 抽屉 | 移动端菜单按钮开、scrim 关、路由切换自动关 | 相同 | 通过（390px 打开/关闭） |
| 重置进度 | `confirm` → `store.reset()` → 删除草稿键 → toast | 相同文案与顺序 | 通过（`1/45` → `0/45`，草稿键变为 null，toast 文案出现） |
| skip link | 点击聚焦 `main` 并滚到顶部 | 相同 | 通过（焦点 `main`，hash 不变） |
| 无效课时 | 「找不到这一讲，可能是链接有误。」+ 返回总览 | 相同 | 通过（源码 `lesson.js`） |
| 无效阶段/项目 | 「找不到这个阶段。」/「找不到这个项目。」 | 相同 | 通过（源码 `stage.js`/`project.js`） |

## 4. 固定文案

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

## 5. 基线产物

| 文件 | 内容 |
| --- | --- |
| `routes.txt` | 66 条路由原文 |
| `content-sha256.txt` | 内容快照哈希与计数 |
| `e1-typed.txt` | 基线提交哈希 |
| `dependencies.txt` | React/React DOM/React Router 锁定版本 |
| `baseline-v2.txt` | v2 行为自动化基线（2 passed） |

E2 最终截图（React 入口）保存在本目录，见 `docs/reviews/frontend-engineering/e2-shell.md`。
