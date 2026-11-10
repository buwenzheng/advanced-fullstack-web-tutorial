# T-E4.4 视觉回归冻结与双入口验证

- 日期：2026-11-10
- 环境：Windows 10.0.22631 / Chromium（Playwright 1.65.0）/ Node v24.22.1（KI-8，.nvmrc 要求 22.15.0）
- 提交：`T-E4.4: 视觉回归冻结与双入口验证`（哈希见 `docs/reviews/frontend-engineering/e4-quality.md`）
- 结论：**通过**。v2 21/21、React 21/21；21 张基线全部被 git 跟踪；无 mask、无容差放宽、无基线条目删除。

## 1. 配置变更

`playwright.config.ts`：

- 新增全局 `expect.toHaveScreenshot = { animations: 'disabled', caret: 'hide', maxDiffPixels: 0 }`（§4.2）；
- 新增 `use.reducedMotion = 'reduce'`；
- 截图路径模板保持 `{testDir}/__screenshots__/{arg}{ext}`，截图名不变。

`e2e/visual.spec.ts`：

- 移除用例内重复的 `animations: 'disabled'`，统一由全局配置提供；
- 所有用例标题带 `@visual` 标签（保持既有命名，截图文件名不变）；
- 保留 `VISUAL_ENTRY` 环境变量以切换入口；v2 默认 `/`，React 为 `/index.next.html`。

## 2. 双入口结果

| 入口 | 命令 | 结果 | 证据 |
| --- | --- | --- | --- |
| v2 | `npm run build && npx playwright test e2e/visual.spec.ts --project=chromium` | 21 passed，exit 0 | `visual-v2-after.txt` |
| React | `VISUAL_ENTRY=index.next.html npx playwright test e2e/visual.spec.ts --project=chromium` | 21 passed，exit 0 | `visual-react-after.txt` |

基线跟踪：`git ls-files e2e/__screenshots__ | wc -l` → **21**（清单见 `visual-baseline-filelist.txt`）。

## 3. T-E4.3 颜色变化导致的重采样

T-E4.3 将代码注释色从 `#5A6B87` 改为 token `--code-comment: #7689A6`（对比度 3.23:1 → 4.91:1），两个入口共用该样式，旧基线仍含旧色。

- **更新了哪些**：`lesson-s0-l1` × 3 视口（1440x900 / 768x1024 / 390x844）实际改写；`lesson-s7-l5` × 3 视口执行了重采样但结果与旧基线逐字节相同，git 无改动。其余 15 张未触碰。
- **为什么**：§4.4 允许的第 1 种情形（axe 颜色 token 调整）。若不处理，旧基线会继续以“颜色阈值内”的方式掩盖已发生的渲染变化（详见下条）。
- **默认 update 模式不落盘的原因**：Playwright/pixelmatch 默认逐像素颜色阈值 0.2，注释色的单像素色差低于该阈值，`--update-snapshots`（changed 模式）认为快照未变化，6 passed 但文件未写。改用 `--update-snapshots=all` 强制重写后生效。
- **diff 审阅结论**：逐通道差 >8 的像素全部落在代码注释行（s0-l1 每视口 2 个 band），旧色 `#5A6B87` ×1154/1154/802 与新色 `#7689A6` ×1154/1154/802 一一对应；裁剪合成图人工复核（`resample-diff-s0-l1-1440x900.png`）确认字形位置、行高、背景、布局、内容不变，仅注释文字颜色变化。
- 完整数据：`visual-baseline-diff.txt`。

## 4. MCQ `<li>` 引入的视觉回归与修复

T-E4.3 为通过 axe `list` 规则，将 `.opt-list` 的选项按钮包进 `<li>`。课时页 quiz 位于 `.lblock` 内，命中 `.lblock ul li`（`padding-left: 20px` + `::before` 圆点），导致 React 入口 6 张课时基线失败（差异 15432/11944/15440/11947/15534/11946 像素）；v2 为 `<ul> > button` 结构，不受影响。

- **修复**：`web/styles/components.css` 增加作用域覆盖：
  ```css
  .lblock .opt-list > li { padding-left: 0; }
  .lblock .opt-list > li::before { content: none; }
  ```
  首次尝试 `.opt-list > li`（优先级 0,1,1）低于 `.lblock ul li`（0,1,2），像素数无变化；改用 `.lblock .opt-list > li`（0,2,1）后生效。
- **修复前**：React 6 failed / 15 passed（`visual-react-before-resample.txt`），v2 21 passed（`visual-resample-before.txt`）。
- **修复后**：React 21/21、v2 21/21（见 §2）。未调整基线以掩盖该差异，未使用 mask。

## 5. 约束遵守核对

- [x] 不使用 mask
- [x] `maxDiffPixels: 0` 未放宽
- [x] 未删除任何基线条目（21 张全部保留并跟踪）
- [x] 重采样仅限 §4.4 允许情形（T-E4.3 颜色 token）
- [x] diff 图已人工审阅并记录（§3）

## 6. 残余风险

1. **跨入口亚阈值渲染差异**：React 与 v2 顶栏在 y27-32 x1052-1058 约 30 px 存在低于 Playwright 颜色阈值的抗锯齿差异，门禁不报告。两入口对同一基线的判定均为通过；已在 `known-issues.md` 登记（KI-12），不阻塞 E4。
2. **平台字体差异**：21 张基线在本机 Windows/Chromium 采集；Linux CI 的字形栅格可能不同。按 §4.5，`@visual` 仅本地执行，CI 不跑视觉用例（T-E4.7 落地时确认），因此不作为 CI 门禁。
3. **基线语义依赖颜色阈值**：本次发现默认像素阈值会容忍低对比度变化；后续任何颜色调整必须按 §4.4 重采样，不能仅凭“视觉用例通过”判断无变化。

## 7. 证据文件

- `visual-v2-after.txt`：v2 全量 21 passed（命令与 EXIT 码）
- `visual-react-after.txt`：React 全量 21 passed（命令与 EXIT 码）
- `visual-resample-before.txt`：重采样前 v2 21 passed
- `visual-react-before-resample.txt`：MCQ 修复前 React 6 failed / 15 passed
- `visual-baseline-diff.txt`：重采样命令、diff 分组、颜色计数、人工审阅结论
- `visual-baseline-filelist.txt`：21 张跟踪基线清单
- `resample-diff-s0-l1-1440x900.png`：s0-l1 两处变化区的旧/新裁剪对比图（2x）