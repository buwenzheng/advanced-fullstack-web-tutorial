# T-E4.3 axe 扫描与修复记录

- 日期：2026-11-10
- 提交：T-E4.3（哈希见 `git log`）
- 环境：Node v24.22.1（与 `.nvmrc` 22.15.0 不一致，见 KI-8）；Chromium（Playwright 1.65.0）；`npm run preview` @ http://127.0.0.1:4173

## 1. 命令与结果

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| `npm run build` | 0 | 构建通过（改动后复跑） |
| `npx playwright test e2e/a11y.spec.ts --project=chromium`（修复前） | 1 | 11/14 失败，输出见 `a11y-before.txt` |
| `npx playwright test e2e/a11y.spec.ts --project=chromium`（修复后） | 0 | 14/14 通过，输出见 `a11y-after.txt` |
| `npx playwright test e2e/tmp-a11y-inventory.spec.ts --project=chromium`（临时清点，未入库） | 0 | 0 moderate / 0 minor，输出见 `a11y-moderate.txt` |
| `npx vitest run web/scripts/test/tasks-mcq.test.tsx web/scripts/test/blocks.test.tsx` | 0 | 19/19 通过 |
| `npm run lint` | 0 | 0 error |
| `npm run typecheck` | 0 | 通过 |

扫描范围：7 页（`#/`、`#/stage/s0`、`#/lesson/s0-l1`、`#/lesson/s7-l5`、`#/project/p-graduation`、`#/lab`、`#/report`）× 1440×900 / 390×844，tags `wcag2a/wcag2aa/wcag21a/wcag21aa`。无 `disableRules`、无页面排除、无 `.axe-exclude`。

## 2. 修复清单（按“语义 → 可聚焦滚动区 → 颜色”顺序）

### 2.1 语义

| 规则 | 位置 | 修复 |
| --- | --- | --- |
| `label-content-name-mismatch` (serious) | 全部 1440 页 `.brand` | `aria-label` 改为包含可见文字：`后端进阶实验室 Backend for Frontend Engineers（返回学习总览）` |
| `list` (serious) | 课时页 `.opt-list` | 选项按钮外包 `<li>`，保持 `<ul> > <li> > button` 结构（`McqTask.tsx`） |
| `select-name` (critical) | `#/lab` HTTP 方法下拉框 | 增加 `aria-label="HTTP 方法"`（`LabRequestBuilder.tsx`） |

### 2.2 可聚焦滚动区（`scrollable-region-focusable`，serious）

为以下容器增加 `tabIndex={0}` + 可访问名称（不改变视觉）：

- `lesson/CodeCard.tsx`：`.codeblock pre` → `aria-label="代码块：{title}"`；
- `lesson/blocks/TableBlock.tsx`：`.tbl-wrap` → `aria-label="表格：{title}"`；
- `exercises/SqlTask.tsx`：查询结果 `.tbl-wrap` → `aria-label="查询结果表格"`；
- `exercises/CodeTask.tsx`：`.console-out` → `aria-label="运行日志"`；
- `lab/LabResponse.tsx`：响应头 `.tbl-wrap`、响应体 `.console-out`；
- `project/TemplateCard.tsx`：`.template-card__body` → `aria-label="模板代码：{title}"`。

工具冲突：`jsx-a11y/no-noninteractive-tabindex` 将上述 `tabIndex` 判为错误。处理为 7 处行级 `eslint-disable-next-line` + 原因注释，未改全局 ESLint 配置、未禁用 axe 规则（见 KI-11）。

### 2.3 颜色（`color-contrast`，serious）

课时页代码注释 `.tok-com` 前景 `#5A6B87`、背景 `--ink-900 #101A29`、字号 12.8px：对比度 **3.23:1**，低于 4.5:1。

- 新增 token：`web/styles/tokens.css` → `--code-comment: #7689A6;`
- `web/styles/components.css` → `.codeblock pre .tok-com { color: var(--code-comment); }`
- 修复后对比度计算（WCAG 相对亮度）：
  - `#7689A6`：L = 0.2126×0.1812 + 0.7152×0.2502 + 0.0722×0.3813 = **0.2450**
  - `#101A29`：L = 0.2126×0.0052 + 0.7152×0.0103 + 0.0722×0.0222 = **0.0101**
  - (0.2450+0.05)/(0.0101+0.05) = **4.91:1** ≥ 4.5:1

颜色值存放在 token 中，符合“只动 token”的约束；`.tok-com` 原为字面量，本次改为引用新 token（偏离说明见 §4）。

**通知 T-E4.4**：`components.css` / `tokens.css` 同时被 v2 与 React 入口使用，v2 代码注释颜色也随之变化。T-E4.4 必须对 **两个入口** 各重采样 21 张基线，并在 `visual.md` 记录“颜色变化导致的重采样”及差异复核结论。

## 3. 残余风险

- `<li>` 包裹选项按钮可能引入 1–2px 布局差异（`ul.opt-list` 的 list-style/padding），由 T-E4.4 双入口视觉基线确认；若出现差异，按视觉门禁流程处理，不调基线掩盖。
- 新增 `tabIndex` 增加了 Tab 停留点（符合 axe 要求），不影响未聚焦时的视觉。

## 4. 偏离与裁决

- 颜色修复只允许“在现有 token 上微调”，但 `.tok-com` 的颜色原本是硬编码字面量。处理方式为在 `tokens.css` 新增 `--code-comment` 并由 `components.css` 引用，颜色值集中到 token，符合约束意图。
- 行级 ESLint 豁免用于解决 axe 与 `jsx-a11y` 的规则冲突，已登记 KI-11；axe 判定逻辑未做任何豁免。