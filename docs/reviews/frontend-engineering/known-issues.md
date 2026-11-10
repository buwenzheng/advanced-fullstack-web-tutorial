# 前端工程已知问题

- 更新时间：2026-11-10（E4 完成）
- 维护方式：阻塞门禁的问题必须修复；不阻塞的问题记录在此，按里程碑计划处理，期间保持现有行为不变。

## KI-1 Runner starter 行为差异（E1 记录，暂不统一）

- **现象**：CLI `tools/lib/js-runner.ts` 与浏览器 Worker 对 `s0-l2-ex-1`、`s1-l3-ex-1`、`s1-schema-ex-1` 的 starter 行为不同；38 道 JS 练习的参考答案在两边都通过。
- **影响**：仅影响「未作答 starter」时的提示结果，不影响答案判定、进度记录或课程语义。
- **原因**：CLI 与 Worker 的沙箱环境/超时/顶层 await 处理历史上不同；统一会改变工具语义，超出 E1「原样迁移」的约束。
- **现状**：E1 只断言答案级输出逐字节一致（`docs/reviews/frontend-engineering/e1/run-js-*.txt`），差异不阻塞 G-E1。
- **计划**：E6 后单独评估统一方案；在此之前不修改两侧 runner。

## KI-2 Python 轨道依赖 Pyodide CDN（v2 既有）

- **现象**：Python 判题通过 Blob Worker `importScripts` 加载 Pyodide 0.29.5，需要网络访问 CDN。
- **影响**：离线或 CDN 不可达时 Python 轨道不可用；JS/SQL 轨道不受影响。
- **现状**：与 v2 行为一致；页面在加载失败时给出错误提示。E1 手动验证包含活性探针（故意失败代码返回真实 `NameError`），可区分环境问题与代码问题。
- **E3 观测**：交互套件中语言切换用例耗时 13.4–22.0 s；G-E3 复跑期间出现一次 Python 用例瞬时失败，单条重跑与整套重跑均通过，判定为 CDN 延迟而非产品回归。
- **计划**：如需离线能力，在后续版本评估自托管 Pyodide 资源。

## KI-3 SQL 引擎为教学子集（v2 既有）

- **现象**：迷你 SQL 引擎不支持 `PRIMARY KEY` 约束解析、子查询、窗口函数等完整语法；tokenizer/parser 内部使用受控 `any`。
- **影响**：仅影响课程范围外的 SQL 写法；课程与 2 道 SQL 练习的语义与 v2 一致。
- **计划**：不在 E1 扩展语法；若后续课程需要，再补解析能力并同步单测。

## KI-4 E2 React 外壳骨架（已解决，E3）

- **状态**：已解决。E3 完成六页正文、12 类内容块、四类任务、实验台与报告迁移；React 入口与 v2 在 66 路由正文逐字对等、21 张视觉基线逐像素一致，搜索改用预生成索引并在聚焦后按需加载，阶段内容按阶段懒加载。
- **E2 记录（历史）**：六页只渲染标题、导航与空状态；搜索为内存全文遍历；React 入口 eager 体积约 331.92 kB（gzip 105.90 kB）。当时仅影响并行入口，v2 默认入口不受影响。
- **证据**：`docs/reviews/frontend-engineering/e3-parity.md`、`e3/parity-report.md`、`e3/t-e3.5-evidence.md`。

## KI-5 v2 侧栏 SVG 命名空间缺陷在 React 对等版本中复刻（E3 记录，E5 评估）

- **现象**：v2 `ui.js` 用 `document.createElement` 创建 `svg`，得到 HTML 命名空间元素；侧栏折叠箭头从未绘制。React 对等版本按「与 v2 已渲染像素一致」原则，将折叠箭头渲染为同尺寸空 `<span>`。v2 侧栏 rail 图标（lab/report/graduation）同样未绘制，React 版本可见，该区域不在 21 张视觉基线捕获范围内。
- **影响**：仅侧栏图标视觉；不影响导航、内容、进度与存储。
- **原因**：E3 约束为原样迁移，不修改 v2 运行时；修复 v2 会改变基线语义。
- **计划**：E4 视觉冻结/E5 单入口时复核 rail 图标；如需修复，在 E5 后单独立项并更新视觉基线。

## KI-6 React 组件内联样式重复（E3 记录，E4 评估）

- **现象**：E3 为逐像素对等保留 v2 的内联样式写法，多个组件存在相似样式对象。
- **影响**：可维护性；不阻塞任何门禁，运行行为与 v2 一致。
- **计划**：E4 质量阶段评估是否抽取共享样式；任何抽取必须视觉零差异（21 张基线 + 双入口）。

## KI-7 实验台真实端点本地不可用（E3 记录）

- **现象**：live 模式请求外部端点，本地 `npm run preview` 无对应后端，无法稳定验证失败提示。
- **影响**：真实端点路径未纳入 G-E3 自动化；mock 模式与 10 个场景为必过。
- **计划**：E6 线上冒烟时验证真实端点；本地不阻塞。

## KI-8 Node 版本与 .nvmrc 不一致（E3 记录，E4 复核）

- **现象**：E3 时实机 Node v24.22.1，`.nvmrc` 要求 22.15.0。
- **E4 复核**：当前 shell 实测 v22.15.0，与 `.nvmrc` 一致；E4 全部门禁（单测、构建、E2E、覆盖率、包体）在该版本通过。
- **影响**：无已知；若后续环境退回旧版本，需在阶段报告注明实际版本，不跳过门禁。
- **计划**：CI/发布环境固定 22.15.0。

## KI-9 搜索索引 chunk 超过 Vite 500 kB 提示（E3 记录，E4 已量化并接受）

- **现象**：`search-index-*.js` raw 507.07 kB（gzip 199.34 kB），Vite 构建提示超过 500 kB；仅在搜索框聚焦后加载。
- **E4 处理**：T-E4.6 将 search-index 单列为独立预算（gzip ≤300KB），实测 199335B / 194.7KB PASS；懒加载强断言确认首页不请求、聚焦后才请求。
- **现状**：Vite raw 500 kB 提示仍在，属未压缩体积提示；门禁以 gzip 预算为准并已通过，不通过 manualChunks 隐藏。
- **影响**：未搜索用户无下载；首次搜索有一次约 195 kB gzip 请求。
- **计划**：若后续索引继续增长，接近 300KB 时再评估分词裁剪或分段加载。

## KI-10 axe 非阻塞问题为零（E4 记录）

- **现象**：14 次扫描（7 页 × 1440/390，tags `wcag2a/wcag2aa/wcag21a/wcag21aa`）中，serious/critical 修复后，moderate/minor 违规数同样为 0。
- **证据**：`docs/reviews/frontend-engineering/e4/a11y-moderate.txt`（`NON_BLOCKING_COUNT=0`）。
- **计划**：无需处理；后续新增页面若出现 moderate/minor，继续在此登记。

## KI-11 可滚动区域 `tabIndex` 与 lint 规则冲突（E4 记录，已接受）

- **现象**：E4 §3.4 要求为 `.codeblock pre`、`.tbl-wrap`、`.console-out` 增加 `tabIndex={0}`（axe `scrollable-region-focusable` 的标准修复），但 `jsx-a11y/no-noninteractive-tabindex` 会把 `<pre>/<div>` 上的 `tabIndex` 判为错误，两条规则直接冲突。
- **处理**：仅在 7 处滚动容器上加行级 `eslint-disable-next-line` 并附原因注释；未修改全局 ESLint 配置，未禁用任何 axe 规则，未缩小扫描页面集合。
- **依据**：可滚动容器需要键盘聚焦，axe 门禁反映真实可访问性结果；lint 规则不识别滚动容器语义。
- **计划**：若 eslint-plugin-jsx-a11y 后续支持滚动容器识别，移除行级豁免。

## KI-12 双入口顶栏亚阈值渲染差异（E4 记录，不阻塞）

- **现象**：T-E4.4 对比 v2 与 React 同一路由截图时，顶栏 y27-32 x1052-1058 约 30 px 存在抗锯齿差异；逐通道差 >8，但低于 Playwright/pixelmatch 默认逐像素颜色阈值 0.2。
- **影响**：两入口对同一基线的判定均为 21/21 通过；差异不可见于实际使用，不影响视觉对等结论。
- **现状**：未调整基线、未放宽 `maxDiffPixels`；E5 单入口后双入口对比自然消失，21 张基线继续作为唯一裁决。
- **证据**：`docs/reviews/frontend-engineering/e4/visual.md` §6；`visual-baseline-diff.txt` 记录了同源的阈值行为。

## KI-13 CI 未实际运行与平台排除策略（E4 记录）

- **现象**：`.github/workflows/verify.yml` 已按 T-E4.7 重写为单一 `npm run verify`，但本轮未获推送授权（执行规则 4），Actions 未运行；CI 中 `@visual` 因跨平台字体差异、`@python` 因 Pyodide CDN 依赖被排除。
- **影响**：workflow 语法、缓存与超时未经平台验证；视觉回归与 Python 轨在 CI 无覆盖。
- **现状**：本地 Windows 已完整跑通 G-E4 与 `npm run verify`（exit 0）；`@visual`/`@python` 由本地专项命令覆盖。
- **计划**：推送后确认 Actions 绿色并回填证据；E6 发布前本地手跑 `@python` 与双入口视觉。
