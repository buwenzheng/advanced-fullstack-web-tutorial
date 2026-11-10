# E4：质量门禁（E2E 全矩阵、axe、视觉回归、覆盖率、包体预算与 CI）

> 上级：`10-frontend-engineering.md` §5、§6 E4、§7；前置：`14-e3-views-and-interaction.md`。
> 目标：把 E3 的“功能对等”升级为“持续可验证的质量”：React 入口 66 路由的控制台门禁、三档宽度的响应式与键盘门禁、7 个核心页面的 axe 扫描、21 张视觉基线、按目录分级的覆盖率阈值、入口/懒加载/搜索索引的包体预算，以及一条可在 CI 与本地复用的 `verify`。
> 工期：1–2 人日。完成定义：G-E4 通过，标签 `e4-qa`。

## 1. 阶段边界

### 1.1 本阶段做

- 新增 4 个 E2E 质量 spec：`routes`、`responsive`、`keyboard`、`a11y`；
- 把散落在 `shell.spec.ts` / `content.spec.ts` 的 66 路由循环收敛为唯一权威门禁；
- axe-core 扫描 7 个核心页面 × 2 个宽度，0 serious / 0 critical；
- 视觉回归：21 张基线入库，v2 与 React 共用同一组快照名，双入口对比；
- 覆盖率：Vitest 按 `engine` / `state` / `content` / `app` 分级阈值，`verify` 跑覆盖率；
- 包体：Vite manifest 驱动的预算脚本，入口 ≤ 180KB gzip、最大懒加载 chunk ≤ 150KB gzip、搜索索引 ≤ 300KB gzip；
- 懒加载网络证据升级为“请求必须属于入口闭包/阶段 chunk”的强断言；
- 更新 `package.json` scripts、`playwright.config.ts`、`vitest.config.ts`、`vite.config.ts`、CI workflow；
- 允许为通过 axe 而做**无视觉变化**的 DOM/ARIA 修复；颜色对比度问题只允许调整颜色 token，并同步重采视觉基线。

### 1.2 本阶段不做

- 不切换默认入口（`web/index.html` 仍是 v2）；不删除 v2 代码；不发布；
- 不改课程内容、练习答案、URL、`localStorage` 键与迁移规则；
- 不新增运行时依赖；不引入新的 UI/图表/测试框架；
- 不重做 E3 的正文对等验证（`parity.spec.ts` 继续作为回归保留）；
- 不为通过门禁而放宽阈值、添加 axe 全局豁免、给视觉对比加 mask；
- 不改 `functions/`、数据库、访问策略；
- 不把视觉基线改造成 Linux/Windows 双份（CI 不跑 `@visual`，见 §4.5）。

### 1.3 本阶段结束时的可运行形态

- `verify` 一条命令完成：lint → typecheck → 覆盖率单测 → 内容校验 → 内容审计 → 练习答案审计 → 构建 → 包体预算 → 无头 E2E（React）；
- 66 条 React 路由 0 控制台错误、每条恰好一个 `h1`；
- 390/768/1280 三档宽度无横向滚动，860px 断点的抽屉行为正确；
- skip link、路由焦点、搜索 combobox、侧栏折叠的键盘路径可用；
- 7 个核心页面在 1440/390 两个宽度下 axe 0 serious / 0 critical；
- v2 与 React 各自通过 21 张视觉快照；
- 包体、覆盖率、懒加载证据写入 `docs/reviews/frontend-engineering/e4/`；
- 仍是 v2 默认入口，未发布。

## 2. 前置条件

| 检查 | 命令 | 通过标准 |
| --- | --- | --- |
| 阶段标签 | `git tag --list e3-parity` | 输出 `e3-parity` |
| 工作区 | `git status --short` | 无业务文件改动；仅方案文档可未跟踪 |
| Node | `node -v` | `v22.15.0` |
| 依赖 | `npm ci` | 0 error |
| E3 门禁 | `npm run verify` | 全绿（视觉按 E3 命令单独执行） |
| 双入口 | `npm run build && ls dist/index.html dist/index.next.html` | 两个文件都存在 |
| 视觉基线 | `git ls-files e2e/__screenshots__ \| wc -l` | `21`，且文件已跟踪 |
| axe 依赖 | `npm ls @axe-core/playwright` | `4.14.0` |
| 路由清单 | `node -e "const r=require('./e2e/routes.json'); console.log(r.length)"` | `66` |
| 内容生成 | `npm run content:build && ls web/generated` | `catalog.json`、`search-index.json` 存在 |
| 懒加载 | `npx playwright test e2e/content.spec.ts --project=chromium -g "lazy\|search"` | 全过 |

若视觉基线未入库（`wc -l` 不是 21 或 `git ls-files` 为空），先按 E3 T-E3.0 重新生成并提交，再开始 E4。

## 3. 门禁设计

### 3.0 总原则

| 原则 | 要求 |
| --- | --- |
| 门禁对象 | 质量门禁默认只针对 **React 入口**（`/index.next.html`）；v2 只保留既有 smoke/shell 回归与视觉 oracle，因为 v2 将在 E5 删除 |
| 确定性 | 每个用例使用独立 context；需要干净进度的用例在 `addInitScript` 里 `localStorage.clear()`；不依赖上一条用例的存储 |
| 真实浏览器 | 质量门禁用 Playwright 跑 `dist` 的 preview，不用 jsdom 替代布局/焦点/axe |
| 禁止掩盖 | 不通过 `retries`、`test.fixme`、`grep` 排除、axe 规则禁用、视觉 mask 让门禁变绿；排除必须写明理由并进入 `known-issues.md` |
| 稳定性 | 失败时保留 trace、screenshot、playwright-report；CI 上传 7 天 |
| 一处失败 | 任一 spec 失败即 `verify` 失败；不允许“先合并后修” |

### 3.1 路由与控制台门禁（`e2e/routes.spec.ts`）

唯一权威的 66 路由门禁。E2 `shell.spec.ts` 与 E3 `content.spec.ts` 中的重复路由循环在本阶段删除，只保留各自的专项断言。

```ts
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const routes = JSON.parse(readFileSync('e2e/routes.json', 'utf8')) as string[];
const ENTRY = '/index.next.html';

test.describe('React 66 路由质量门禁', () => {
  test.setTimeout(240_000);

  for (const route of routes) {
    test(`@routes ${route}`, async ({ page }) => {
      const issues: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') issues.push(`console: ${message.text()}`);
      });
      page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));

      const response = await page.goto(`${ENTRY}${route}`);
      expect(response?.ok(), `${route} 文档响应`).toBe(true);
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.locator('main h1')).toHaveCount(1);

      const text = (await page.locator('main').innerText()).trim();
      expect(text.length, `${route} 正文不能为空`).toBeGreaterThan(20);
      expect(issues, route).toEqual([]);
    });
  }
});
```

要求：

- 每条路由独立 `test`，失败可直接定位；`fullyParallel` 沿用全局配置；
- 控制台只收集 `error` 与未捕获异常；`warning` 不阻塞（React 生产构建不应有 warning，若出现按缺陷记录）；
- 不监听 `requestfailed`：路由快速切换会中止进行中的请求，属于正常行为；懒加载请求用 §6.5 的显式断言验证；
- `h1` 恰好一个：`toHaveCount(1)`，防止页面插入第二个标题；
- 正文长度 > 20：防止白屏但 `h1` 存在的假通过；
- 文档响应必须是 2xx；`baseURL` 指向 preview，`index.next.html` 必须可达。

### 3.2 响应式门禁（`e2e/responsive.spec.ts`）

7 个代表页面 × 3 档宽度，共 21 个断言；同时验证 860px 断点的外壳形态。

```ts
const PAGES = [
  '#/',
  '#/stage/s0',
  '#/lesson/s0-l1',
  '#/lesson/s7-l5',
  '#/project/p-graduation',
  '#/lab',
  '#/report',
];
const WIDTHS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
];

for (const route of PAGES) {
  for (const viewport of WIDTHS) {
    test(`@responsive ${viewport.width} ${route}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`/index.next.html${route}`);
      await expect(page.locator('main h1')).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${route} 横向溢出`).toBeLessThanOrEqual(1);

      const menuVisible = await page.locator('#menu-toggle').isVisible();
      const sidebarBox = await page.locator('#sidebar').boundingBox();
      if (viewport.width <= 860) {
        expect(menuVisible, '窄屏必须显示菜单按钮').toBe(true);
        expect(sidebarBox?.x ?? 0, '窄屏侧栏应收起').toBeLessThan(0);
      } else {
        expect(menuVisible, '宽屏必须隐藏菜单按钮').toBe(false);
        expect(sidebarBox?.x ?? 0, '宽屏侧栏应可见').toBeGreaterThanOrEqual(0);
      }
    });
  }
}
```

补充用例（只跑 390 宽度）：

- 点击 `#menu-toggle` → `#sidebar.is-open`、`#scrim` 可见、按钮 `aria-expanded=true`；
- 点击 `#scrim` → 抽屉关闭、`aria-expanded=false`；
- 从抽屉点进任意课时 → 路由变化后抽屉自动关闭；
- 窄屏下 `.codeblock pre`、`.tbl-wrap` 自身可横向滚动，但文档不产生横向滚动。

要求：

- 溢出判定留 1px 亚像素容差；
- 不使用“截断文本”来消除溢出；溢出属于布局缺陷，只允许最小 CSS 修复（`min-width:0`、`overflow-wrap:anywhere`、`max-width:100%`），且必须在报告里列出改动与影响的页面；
- 768 属于 860 断点以内，必须看到抽屉形态；1280 属于桌面形态。

### 3.3 键盘门禁（`e2e/keyboard.spec.ts`）

键盘路径必须与鼠标路径等价。

| 用例 | 步骤 | 断言 |
| --- | --- | --- |
| skip link | `Tab` 一次 | `.skip-link` 获焦 |
| skip link 激活 | 上一步后 `Enter` | `#main` 获焦，hash 不变成 `#main` |
| 路由焦点 | 点击侧栏进入课时 | `#main` 获焦；`window.scrollY === 0` |
| 搜索展开 | `#search-input` 输入 `LinkHub 短链服务` | `.search-hit` 1 条；`aria-expanded=true` |
| 搜索选择 | `ArrowDown` | 第一条 `.search-hit.is-active` |
| 搜索跳转 | `Enter` | URL 为 `#/project/p-graduation`，输入清空，结果隐藏 |
| 搜索关闭 | 重新输入后 `Escape` | 结果隐藏、`aria-expanded=false`、焦点仍在输入框 |
| 侧栏折叠 | 聚焦 `.stage-node__head` 后 `Enter` | 该阶段 `aria-expanded` 翻转，课时列表显隐一致 |
| 抽屉键盘 | 390 宽度下 `Tab` 到 `#menu-toggle`，`Enter` | 抽屉打开；`scrim` 可见 |
| 选择题键盘 | 聚焦第一个选项按 `Enter` / `Space` | 选中态变化与鼠标点击一致 |

代码骨架：

```ts
test('skip link 聚焦 main', async ({ page }) => {
  await page.goto('/index.next.html#/');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  expect(new URL(page.url()).hash).not.toBe('#main');
});

test('搜索键盘路径', async ({ page }) => {
  await page.goto('/index.next.html#/');
  const search = page.locator('#search-input');
  await search.focus();
  await page.keyboard.type('LinkHub 短链服务');
  await expect(page.locator('.search-hit')).toHaveCount(1);
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.search-hit.is-active')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/project\/p-graduation$/);
  await expect(search).toHaveValue('');
  await expect(page.locator('.search-hit')).toHaveCount(0);
});
```

要求：

- 所有焦点断言用 `toBeFocused()`，不用 `document.activeElement` 的字符串比较；
- 不新增 v2 没有的键盘行为；`Escape` 关闭抽屉不是 v2 行为，本阶段不引入；
- 若发现键盘路径被阻断（例如按钮没有 `type`、可点击 `div`），修 React 组件；不改 v2。

### 3.4 可访问性门禁（`e2e/a11y.spec.ts`）

页面与宽度：

- 7 个核心页面（同 §3.2）；
- 宽度：1440×900 与 390×844；
- 共 14 次扫描。

```ts
import AxeBuilder from '@axe-core/playwright';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

for (const route of PAGES) {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`@a11y ${viewport.width} ${route}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`/index.next.html${route}`);
      await expect(page.locator('main h1')).toBeVisible();
      await page.evaluate(async () => { await document.fonts.ready; });

      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      const blocking = results.violations.filter(
        (item) => item.impact === 'serious' || item.impact === 'critical',
      );
      const summary = blocking.map((item) => ({
        id: item.id,
        impact: item.impact,
        nodes: item.nodes.map((node) => node.target.join(' ')).slice(0, 5),
      }));
      expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
    });
  }
}
```

判定与修复顺序：

1. **只认 serious / critical**；moderate / minor 记录到报告，不阻塞；
2. 先修语义：缺失的可访问名称、错误的 ARIA、`div` 冒充按钮、图标未 `aria-hidden`、表头关系；
3. `scrollable-region-focusable`：给可横向滚动的 `.codeblock pre`、`.tbl-wrap`、`.console-out` 增加 `tabindex={0}` 与可访问名称（`aria-label`），不改变视觉；
4. `color-contrast`：
   - 只在现有 token 上微调颜色（`tokens.css`），不做布局改动；
   - 调整后必须重跑 §4 视觉基线，并在报告中记录“颜色变化导致的重采样”；
5. 不添加 `.axe-exclude`、不 `disableRules`、不缩小扫描页面集合；
6. 记录修复前后：`a11y-before.txt`（首次失败输出）与 `a11y-after.txt`（全绿输出）。

常见预期问题（按实际扫描为准）：

| 规则 | 可能位置 | 修复 |
| --- | --- | --- |
| `color-contrast` | `.tiny.muted`、`.search-hit span`、徽章文字 | 调亮 `--text-faint`/`--text-mute` 或加深背景 |
| `scrollable-region-focusable` | 代码块、表格、响应体 | 容器 `tabIndex={0}` + `aria-label` |
| `button-name` / `link-name` | 图标按钮、仅 SVG 的链接 | `aria-label` 或 `aria-hidden` 装饰图标 |
| `aria-allowed-attr` | 自定义 combobox | 按 ARIA 1.2 combobox 模式修正 |
| `landmark-unique` | 侧栏/主区重复 landmark | 补充 `aria-label` 区分 |
| `nested-interactive` | 链接内嵌按钮 | 拆开交互元素 |

### 3.5 与既有 spec 的职责切分

| spec | E4 之后职责 |
| --- | --- |
| `smoke.spec.ts` | v2 66 路由回归（保留） |
| `shell.spec.ts` | React 外壳行为：侧栏规模、搜索、语言、抽屉、重置（删除 66 路由循环） |
| `content.spec.ts` | React 内容标记、文本对等之外的专项、懒加载与搜索索引网络断言（删除重复路由循环） |
| `parity.spec.ts` | 66 路由正文逐字对等（保留，不在 E4 重复执行于每个门禁） |
| `interactions.spec.ts` | 练习/项目/实验台/报告/搜索交互；Python 用例加 `@python` 标签 |
| `routes.spec.ts` | **唯一** React 66 路由 + 控制台门禁 |
| `responsive.spec.ts` | 21 个布局断言 + 抽屉专项 |
| `keyboard.spec.ts` | 键盘路径 |
| `a11y.spec.ts` | axe 扫描 |
| `visual.spec.ts` | 21 张双入口视觉对比（`@visual`） |

## 4. 视觉回归

### 4.1 基线清单

沿用 E0/E3 的 7 页 × 3 宽度 = 21 张：

| 页面 | 路由 |
| --- | --- |
| 总览 | `#/` |
| 阶段 | `#/stage/s0` |
| 课时（知识块） | `#/lesson/s0-l1` |
| 课时（代码/练习） | `#/lesson/s7-l5` |
| 毕业项目 | `#/project/p-graduation` |
| 实验台 | `#/lab` |
| 报告 | `#/report` |

- 宽度：1440×900、768×1024、390×844；
- 文件位置：`e2e/__screenshots__/`；
- 已跟踪：`git ls-files e2e/__screenshots__` 必须 21 条；
- 基线内容：v2.0.1 的冻结渲染；React 必须逐像素匹配同一组文件（E3 已建立 `VISUAL_ENTRY`）。

### 4.2 稳定化设置

`playwright.config.ts` 增加全局截图期望，避免各 spec 重复：

```ts
expect: {
  toHaveScreenshot: {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixels: 0,
  },
},
use: {
  ...,
  reducedMotion: 'reduce',
},
```

`visual.spec.ts` 保留 E3 的：

- `localStorage.clear()` 后 `reload()`；
- 等待 `main h1`；
- `networkidle`；
- `document.fonts.ready`；
- `fullPage: true`；
- 测试标题不含 `ENTRY`（快照名稳定）。

### 4.3 双入口验证

```bash
npm run build
npx playwright test e2e/visual.spec.ts --project=chromium
VISUAL_ENTRY=index.next.html npx playwright test e2e/visual.spec.ts --project=chromium
```

预期：21/21 + 21/21。任一张 diff 都按缺陷处理，不允许 mask。

### 4.4 更新政策

- 只有以下情况允许更新基线：
  1. 通过 axe 的颜色 token 调整（T-E4.3）；
  2. E5 入口切换后基线文件名/加载态变化（E5 处理）；
  3. 明确的产品视觉变更（本项目为“零视觉变更”，默认不存在）。
- 更新命令：`npm run e2e:update`；
- 更新后必须人工查看 `playwright-report` 的 diff 图，并在报告中记录“哪几张、为什么”；
- 不允许在 PR 中“顺手”更新基线而不解释。

### 4.5 CI 与平台差异

Playwright 截图受操作系统字体渲染影响，Windows 生成的基线无法与 `ubuntu-latest` 逐像素一致。本项目策略：

- `visual.spec.ts` 全部用例标题带 `@visual`；
- CI 与 `verify` 使用 `--grep-invert "@visual|@python"` 排除；
- 视觉门禁在本地（Windows）执行，作为发布前必跑项；
- 在 `known-issues.md` 记录：“视觉基线为 Windows 基线，CI 不执行；如需 CI 视觉回归，后续以 Playwright Linux 容器重建基线”；
- 不允许为了 CI 通过而放宽容差到失去意义（`maxDiffPixels` 保持 0）。

## 5. 覆盖率门禁

### 5.1 `vitest.config.ts` 变更

E0 的全局阈值（70/70/60/70）升级为目录级阈值：

```ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'html', 'json-summary'],
  reportsDirectory: './coverage',
  include: [
    'web/scripts/app/**/*.{ts,tsx}',
    'web/scripts/engine/**/*.{ts,tsx}',
    'web/scripts/state/**/*.{ts,tsx}',
    'web/scripts/content/**/*.{ts,tsx}',
  ],
  exclude: [
    'web/scripts/content/stages/**',
    'web/scripts/content/**/*.d.ts',
  ],
  thresholds: {
    'web/scripts/engine/**': { lines: 85, functions: 85, statements: 85, branches: 70 },
    'web/scripts/state/**': { lines: 85, functions: 85, statements: 85, branches: 75 },
    'web/scripts/content/**': { lines: 85, functions: 85, statements: 85, branches: 70 },
    'web/scripts/app/**': { lines: 60, functions: 60, statements: 60, branches: 55 },
  },
},
```

要求：

- `engine` / `state` 对齐总纲 §5.2 的 ≥85% 行；
- `app` 对齐“组件 ≥60%”；
- 内容 schema 的“100% 课时”不靠行覆盖率表达，而由 `content:validate` 的 `lessons=45` 与 `schema` 校验保证；
- 排除 `content/stages/**`（纯数据，无可执行分支）与 `content/types.ts` 中的纯类型文件（若被 include 且无运行时，加入 exclude）；
- 不把 `web/scripts/views/**`、`web/scripts/app.js`、`web/scripts/ui.js` 纳入覆盖率：它们是 E5 要删除的 v2 代码；
- 不用 `/* v8 ignore */` 或 `c8 ignore` 刷阈值；确需忽略的分支必须写明原因。

### 5.2 脚本与执行

```json
{
  "scripts": {
    "test": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

执行：

```bash
npm run test:coverage
node -e "const s=require('./coverage/coverage-summary.json'); console.log(JSON.stringify(s.total,null,2))"
```

预期：阈值全过；`coverage-summary.json` 写入报告；`app` 低于 60% 时先补测试，不降阈值。

### 5.3 补测优先级

若未达标，按以下顺序补：

1. `app/data/**`（门面与掌握度）、`app/shell/**`（搜索、抽屉、重置）；
2. `app/lesson/blocks/**` 的未知类型与可选字段；
3. `app/exercises/**` 的失败路径（超时、运行时异常、空结果）；
4. `app/lab/mock-server.ts` 的状态码分支；
5. `app/report/report-model.ts` 的空进度与脏数据。

禁止写无断言快照来凑覆盖率。

## 6. 包体预算与懒加载

### 6.1 预算

| 指标 | 上限 | 说明 |
| --- | --- | --- |
| React 入口静态闭包 JS | 180KB gzip | `index.next.html` 的 entry + 全部静态 imports |
| 单个懒加载 JS chunk | 150KB gzip | 任一非入口闭包的 `.js` 产物 |
| 搜索索引 | 300KB gzip | `search-index.json` 产物 |
| 报告项：CSS | 只报告 | 不设上限，记录 entry CSS gzip |
| 报告项：全部 JS 总量 | 只报告 | 用于趋势观察 |

预算来自总纲 §5.2；E4 只执行，不改数字。

### 6.2 生成 manifest

`vite.config.ts`：

```ts
build: {
  outDir: '../dist',
  emptyOutDir: true,
  sourcemap: false,
  target: 'baseline-widely-available',
  manifest: true,
},
```

产物：`dist/.vite/manifest.json`，包含 `isEntry`、`imports`、`dynamicImports`、`css`。

### 6.3 `tools/bundle-budget.ts`

纯 Node，读取 manifest 与文件，不依赖浏览器。

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const MANIFEST = path.join(DIST, '.vite/manifest.json');
const LIMITS = { entry: 180 * 1024, lazy: 150 * 1024, search: 300 * 1024 };

type ManifestItem = {
  file: string;
  isEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
  css?: string[];
};
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Record<string, ManifestItem>;

function gzipBytes(file: string): number {
  return gzipSync(readFileSync(path.join(DIST, file)), { level: 9 }).length;
}

const reactKey = Object.keys(manifest).find(
  (key) => manifest[key].isEntry && key.endsWith('index.next.html'),
);
if (!reactKey) throw new Error('manifest 中找不到 index.next.html 入口');

const staticClosure = new Set<string>();
(function walk(key: string) {
  const item = manifest[key];
  if (!item || staticClosure.has(item.file)) return;
  staticClosure.add(item.file);
  (item.imports ?? []).forEach(walk);
})(reactKey);

const sumGzip = (files: Iterable<string>) =>
  [...files].reduce((total, file) => total + gzipBytes(file), 0);

const entryGzip = sumGzip(staticClosure);
const lazyGzip = Object.keys(manifest)
  .map((key) => manifest[key])
  .filter((item) => item.file.endsWith('.js') && !staticClosure.has(item.file))
  .map((item) => ({ file: item.file, gzip: gzipBytes(item.file) }));
const maxLazy = lazyGzip.sort((a, b) => b.gzip - a.gzip)[0] ?? { file: '-', gzip: 0 };
const searchItem = Object.entries(manifest).find(([key]) => key.includes('search-index.json'));
if (!searchItem) throw new Error('manifest 中找不到 search-index.json');
const searchGzip = gzipBytes(searchItem[1].file);

const rows = [
  ['entry (index.next.html)', entryGzip, LIMITS.entry],
  [`lazy max (${maxLazy.file})`, maxLazy.gzip, LIMITS.lazy],
  ['search index', searchGzip, LIMITS.search],
] as const;

for (const [name, value, limit] of rows) {
  const status = value <= limit ? 'PASS' : 'FAIL';
  console.log(
    `${status} ${name.padEnd(36)} ${(value / 1024).toFixed(1)}KB / ${(limit / 1024).toFixed(0)}KB`,
  );
}
const failed = rows.some(([, value, limit]) => value > limit);
process.exit(failed ? 1 : 0);
```

补充要求：

- 入口闭包必须递归展开 `imports`（React、router、共享 chunk 都在闭包里），不能只算 entry 单文件；
- `lazyGzip` 排除入口闭包；CSS 与 JSON 不计入 JS chunk；
- 输出机器可读报告：`--json` 模式写 `docs/reviews/frontend-engineering/e4/bundle.json`（文件、gzip、上限、是否通过）；
- 脚本失败只报告超限项，不自动修改预算或拆包；拆包属于实现变更，回到任务卡评估；
- 脚本必须在 `npm run build` 之后运行，缺失 manifest 时直接失败。

### 6.4 脚本接入

```json
{
  "scripts": {
    "budget": "tsx tools/bundle-budget.ts"
  }
}
```

### 6.5 懒加载强断言（升级 E3）

新增 `e2e/lib/manifest.ts`，在测试端读取同一份 manifest：

```ts
import { readFileSync } from 'node:fs';

export function entryClosure(): Set<string> {
  const manifest = JSON.parse(readFileSync('dist/.vite/manifest.json', 'utf8'));
  const key = Object.keys(manifest).find(
    (item) => manifest[item].isEntry && item.endsWith('index.next.html'),
  )!;
  const files = new Set<string>();
  (function walk(current: string) {
    const item = manifest[current];
    if (!item || files.has(item.file)) return;
    files.add(item.file);
    (item.imports ?? []).forEach(walk);
  })(key);
  return files;
}
```

断言：

| 场景 | 期望 |
| --- | --- |
| 打开 `#/` | 所有 JS 响应路径的 basename 都在 `entryClosure()` 内 |
| 进入 `#/lesson/s0-l1` | 出现 ≥1 个不在闭包内的 JS 响应 |
| 同阶段切到 `#/lesson/s0-l2` | 非闭包 JS 响应集合与上一步相同（不重复下载） |
| 切到 `#/lesson/s1-l1` | 新增 1 个不在闭包内的 JS 响应 |
| 打开 `#/` 后 | 没有 `search-index` 产物请求 |
| 聚焦 `#search-input` 并输入 | 出现 `search-index` 产物请求；结果渲染正确 |

实现放在 `e2e/content.spec.ts` 的 `lazy|search` 用例中，替换 E3 的“阶段 chunk 数量”弱断言。要求用 `page.on('response')` 收集 URL，在断言前 `waitForLoadState('networkidle')`。

## 7. 脚本、verify 与 CI

### 7.1 `package.json` scripts（E4 最终形态）

```json
{
  "scripts": {
    "dev": "vite",
    "dev:next": "npm run content:build && vite --open /index.next.html",
    "build": "npm run content:validate && npm run content:build && npm run typecheck && vite build",
    "preview": "vite preview",
    "preview:next": "vite preview --open /index.next.html",
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

- `verify` 不重复 `build`：构建只做一次，随后直接跑 E2E；
- `e2e` 保留“构建 + 跑 chromium”的人体工学入口；本地完整跑会包含 `@visual`，视觉基线在 Windows 上必须通过；
- CI 与 `verify` 排除 `@visual`（平台差异）与 `@python`（外网 CDN）；
- `e2e:update` 只更新视觉，不跑其他 spec；
- `audit:python` 不进入 `verify`（依赖本机 Python 与 CDN 包），发布前本地手跑；
- 任何 script 名变更必须同步 `README.md` 与 E5 文档。

### 7.2 CI workflow（`.github/workflows/verify.yml`）

```yaml
name: verify
on:
  push:
    branches: [main]
  pull_request:
concurrency:
  group: verify-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22.15.0'
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run verify
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: |
            playwright-report/
            coverage/
          retention-days: 7
```

要求：

- `verify` 是唯一权威命令；workflow 不再逐条复制步骤，避免本地/CI 漂移；
- Playwright 浏览器在 `verify` 之前安装；
- 失败上传 Playwright 报告与覆盖率；
- 不加 `continue-on-error`；Python/CDN 用例已被 `@python` 排除；
- 首次推送若因网络失败，保留本地 `verify` 输出并在 G-E4 报告中说明；
- 不使用仓库密钥；本阶段无外部服务依赖。

### 7.3 Python 轨道策略

- Python 代码题依赖 jsDelivr 的 Pyodide，CI 不保证可达；
- `e2e/interactions.spec.ts` 中所有 Python 用例标题加 `@python`；
- CI/`verify` 通过 `--grep-invert` 排除；
- 发布前本地执行：

```bash
npm run build
npx playwright test --project=chromium --grep @python
npx tsx tools/run-python-exercises.ts
```

- 本地 Python 用例失败时不得发布，除非确认是外部 CDN 故障并记录到 `known-issues.md`；
- JS/SQL 用例不带标签，始终作为必过门禁。

## 8. 目标结构与改动清单

```text
e2e/
  routes.spec.ts                 # 新增：66 路由 + 控制台门禁
  responsive.spec.ts             # 新增：7 页 × 3 宽度 + 抽屉
  keyboard.spec.ts               # 新增：skip link、搜索、侧栏、抽屉、选择题
  a11y.spec.ts                   # 新增：axe 7 页 × 2 宽度
  lib/
    manifest.ts                  # 新增：入口闭包读取
  shell.spec.ts                  # 修改：移除 66 路由循环
  content.spec.ts                # 修改：移除重复路由循环；懒加载强断言
  interactions.spec.ts           # 修改：Python 用例加 @python
  visual.spec.ts                 # 修改：@visual 标签；沿用 VISUAL_ENTRY
tools/
  bundle-budget.ts               # 新增：包体预算
docs/reviews/frontend-engineering/e4/
  inventory.txt                  # 新增：门禁清单
  a11y-before.txt                # 新增：首次扫描输出
  a11y-after.txt                 # 新增：修复后输出
  bundle.json                    # 新增：包体报告
  e4-quality.md                  # 新增：G-E4 报告
```

修改文件：

| 文件 | 改动 |
| --- | --- |
| `playwright.config.ts` | `expect.toHaveScreenshot` 稳定化；`use.reducedMotion: 'reduce'` |
| `vitest.config.ts` | 覆盖率 include/exclude 与目录级阈值；增加 `json-summary` reporter |
| `vite.config.ts` | `build.manifest: true` |
| `package.json` | `test:coverage`、`budget`、`e2e:visual`、`e2e:python`、`e2e:update`、`verify` |
| `.github/workflows/verify.yml` | 改为单一 `npm run verify` |
| `e2e/shell.spec.ts` | 删除 66 路由循环（由 `routes.spec.ts` 接管） |
| `e2e/content.spec.ts` | 删除重复路由循环；懒加载改为 manifest 闭包断言 |
| `e2e/interactions.spec.ts` | Python 用例加 `@python` |
| `e2e/visual.spec.ts` | describe/test 标题加 `@visual` |
| `web/scripts/app/**` | 条件性：axe 修复（ARIA、`tabIndex`、可访问名称） |
| `web/styles/tokens.css` | 条件性：仅颜色对比度调整 |

不新增运行时依赖；`@axe-core/playwright` 已在 E0 安装。

## 9. 任务卡

### T-E4.0 冻结门禁清单与现状测量

- **类型**：validation
- **依赖**：E3 门禁通过
- **产出**：
  - `docs/reviews/frontend-engineering/e4/inventory.txt`
  - `docs/reviews/frontend-engineering/e4/baseline.txt`
- **实现要求**：

1. 列出现有 spec 与用例数、66 路由、21 张基线、当前 `dist` 体积；
2. 记录 E3 之后仍存在的重复门禁（shell/content 的 66 循环）与计划合并方式；
3. 记录当前运行时依赖与 axe 版本，确认无新增依赖；
4. 记录 Windows 视觉基线策略（CI 排除 `@visual`）作为既定约束。

- **命令**：

```bash
mkdir -p docs/reviews/frontend-engineering/e4
git tag --list e3-parity
npx playwright test --list | tee docs/reviews/frontend-engineering/e4/specs.txt
git ls-files e2e/__screenshots__ | wc -l
npm run build
du -sh dist
find dist/assets -name '*.js' -o -name '*.css' | wc -l
npm ls @axe-core/playwright
```

- **预期**：`e3-parity` 存在；21 张基线已跟踪；构建成功；清单写入 `inventory.txt`。
- **约束**：只测量，不改代码；不重新生成基线。
- **证据**：`inventory.txt` / `baseline.txt`。
- **回滚**：删除 `e4/` 目录。
- **停止条件**：基线未跟踪；`e3-parity` 不存在；构建失败。

### T-E4.1 路由与控制台门禁

- **类型**：validation
- **依赖**：T-E4.0
- **产出**：
  - `e2e/routes.spec.ts`
  - `e2e/lib/console.ts`（如需要）
  - 修改 `e2e/shell.spec.ts`、`e2e/content.spec.ts`
- **实现要求**：

1. 按 §3.1 实现 66 路由门禁；
2. 删除 `shell.spec.ts` 的 66 循环，保留外壳行为；
3. 删除 `content.spec.ts` 的重复路由循环，保留内容标记与懒加载；
4. 控制台错误不设白名单；确需白名单时必须在代码注释与 `known-issues.md` 同时记录原因和移除阶段；
5. 单跑与重复跑各一次，确认无 flake。

- **命令**：

```bash
npm run build
npx playwright test e2e/routes.spec.ts --project=chromium
npx playwright test e2e/routes.spec.ts --project=chromium --repeat-each=2
npx playwright test e2e/shell.spec.ts e2e/content.spec.ts --project=chromium
```

- **预期**：66/66；重复跑仍 66/66；shell/content 专项全过。
- **约束**：不修改页面代码；不把失败路由改为跳过。
- **证据**：三次运行输出；失败截图（若有）。
- **回滚**：删除 `routes.spec.ts`，恢复两个 spec。
- **停止条件**：任一控制台错误；页面白屏；重复跑出现 flake。

### T-E4.2 响应式与键盘门禁

- **类型**：validation
- **依赖**：T-E4.1
- **产出**：
  - `e2e/responsive.spec.ts`
  - `e2e/keyboard.spec.ts`
- **实现要求**：

1. 按 §3.2 实现 21 个布局断言与 4 个抽屉专项；
2. 按 §3.3 实现键盘用例；
3. 溢出问题用最小 CSS 修复（`min-width:0` 等），不得改布局结构；修复后重跑 §4 视觉基线；
4. 键盘路径缺陷只修 React 组件，不改 v2；
5. 记录 390/768/1280 的截图到报告。

- **命令**：

```bash
npm run build
npx playwright test e2e/responsive.spec.ts --project=chromium
npx playwright test e2e/keyboard.spec.ts --project=chromium
```

- **预期**：21/21 + 抽屉专项；键盘用例全过；无横向滚动。
- **约束**：不改文案；不隐藏内容来消除溢出；不新增交互。
- **证据**：两份 spec 输出；三档宽度截图。
- **回滚**：删除两个 spec 与条件性修复。
- **停止条件**：任一宽度横向滚动；抽屉无法键盘打开；焦点丢失。

### T-E4.3 axe 扫描与修复

- **类型**：validation
- **依赖**：T-E4.2
- **产出**：
  - `e2e/a11y.spec.ts`
  - `docs/reviews/frontend-engineering/e4/a11y-before.txt`
  - `docs/reviews/frontend-engineering/e4/a11y-after.txt`
  - 条件性：`web/scripts/app/**` 的 ARIA/`tabIndex` 修复、`tokens.css` 颜色调整
- **实现要求**：

1. 按 §3.4 实现扫描；首次运行保存完整输出到 `a11y-before.txt`；
2. 按“语义 → 可聚焦滚动区 → 颜色”的顺序修复；
3. 每次修复后重跑 14 个扫描，直到 0 serious / 0 critical；
4. moderate/minor 记录到 `known-issues.md`，不阻塞；
5. 若调整颜色，记录 token 前后值与对比度计算，并通知 T-E4.4 重采样。

- **命令**：

```bash
npm run build
npx playwright test e2e/a11y.spec.ts --project=chromium | tee docs/reviews/frontend-engineering/e4/a11y-before.txt
# 修复后
npx playwright test e2e/a11y.spec.ts --project=chromium | tee docs/reviews/frontend-engineering/e4/a11y-after.txt
```

- **预期**：14/14 扫描通过；无 `disableRules`；无页面排除。
- **约束**：不引入 axe 全局配置；不改布局；颜色调整只动 token。
- **证据**：before/after 输出；修复文件 diff；对比度计算。
- **回滚**：revert 本任务提交，删除 a11y spec。
- **停止条件**：需要布局改版才能通过；需要禁用规则；对比度修复导致信息层级丢失。

### T-E4.4 视觉回归冻结与双入口验证

- **类型**：validation
- **依赖**：T-E4.3
- **产出**：
  - 修改 `playwright.config.ts`、`e2e/visual.spec.ts`
  - 已跟踪的 21 张基线（必要时按 T-E4.3 重采样）
  - `docs/reviews/frontend-engineering/e4/visual.md`
- **实现要求**：

1. 按 §4.2 增加全局截图稳定化设置；
2. `visual.spec.ts` 的所有用例加 `@visual`；截图名保持不变；
3. 双入口各跑一次，21/21；
4. 如 T-E4.3 改色，双入口同时重采样，并在 `visual.md` 记录 diff 审阅结论；
5. 确认 `git ls-files e2e/__screenshots__` 为 21。

- **命令**：

```bash
npm run build
npx playwright test e2e/visual.spec.ts --project=chromium
VISUAL_ENTRY=index.next.html npx playwright test e2e/visual.spec.ts --project=chromium
git ls-files e2e/__screenshots__ | wc -l
```

- **预期**：21/21 + 21/21；基线全部跟踪。
- **约束**：不使用 mask；不放宽 `maxDiffPixels`；不删除失败基线条目。
- **证据**：两次运行输出；`visual.md`；`git ls-files` 清单。
- **回滚**：revert 视觉配置与基线提交（需保留旧基线）。
- **停止条件**：任一 diff；基线未跟踪；需要 mask 才能通过。

### T-E4.5 覆盖率阈值与补测

- **类型**：engine
- **依赖**：T-E4.1
- **产出**：
  - `vitest.config.ts` 修改
  - 补充的组件/数据测试
  - `coverage/coverage-summary.json`（不提交，报告引用）
- **实现要求**：

1. 按 §5.1 修改覆盖率配置；
2. 跑 `npm run test:coverage`，按 §5.3 补测直到达标；
3. 不降低阈值、不添加 ignore；
4. 报告记录四个目录的 lines/functions/branches/statements 实际值。

- **命令**：

```bash
npm run test:coverage
node -e "const s=require('./coverage/coverage-summary.json'); console.log(JSON.stringify(s.total,null,2))"
npm run test
```

- **预期**：engine/state/content ≥85% 行，app ≥60% 行；普通 `npm run test` 不受影响。
- **约束**：不为了覆盖率写无断言测试；不把 v2 代码纳入统计。
- **证据**：覆盖率摘要；补测文件清单；阈值配置 diff。
- **回滚**：恢复 E0 阈值（仅作为临时回退，必须记录）。
- **停止条件**：阈值需要下调才能通过；补测需要改业务语义。

### T-E4.6 包体预算与懒加载强断言

- **类型**：engine
- **依赖**：T-E4.4
- **产出**：
  - `vite.config.ts`（manifest）
  - `tools/bundle-budget.ts`
  - `e2e/lib/manifest.ts`
  - 修改 `e2e/content.spec.ts`
  - `docs/reviews/frontend-engineering/e4/bundle.json`
- **实现要求**：

1. 按 §6.2–§6.4 实现预算脚本与输出；
2. 按 §6.5 用 manifest 闭包替换弱断言；
3. 记录入口闭包文件、最大懒加载 chunk、搜索索引的实际 gzip；
4. 超限时先分析原因（共享模块、误引入、内容未懒加载），再决定拆包；不直接改预算。

- **命令**：

```bash
npm run build
npm run budget
npx playwright test e2e/content.spec.ts --project=chromium -g "lazy|search"
node -e "const m=require('./dist/.vite/manifest.json'); console.log(Object.keys(m).length)"
```

- **预期**：三项预算 PASS；懒加载断言 6/6；`bundle.json` 写入报告。
- **约束**：不把未通过项写成“参考值”；不通过 `manualChunks` 隐藏超限模块。
- **证据**：预算输出；manifest 摘要；网络请求列表。
- **回滚**：删除预算脚本与 manifest 配置，恢复 E3 弱断言。
- **停止条件**：入口超 180KB 且无法在 E4 范围内解释；搜索索引超 300KB；懒加载请求重复。

### T-E4.7 verify 与 CI 整合

- **类型**：engine
- **依赖**：T-E4.5、T-E4.6
- **产出**：
  - `package.json` scripts
  - `.github/workflows/verify.yml`
  - 修改 `e2e/interactions.spec.ts`（`@python`）
- **实现要求**：

1. 按 §7.1 写入 scripts；
2. 按 §7.2 重写 workflow；
3. 按 §7.3 给 Python 用例加标签并验证排除逻辑；
4. 本地完整跑一次 `npm run verify`；
5. 推送后确认 Actions 绿色（网络受限时记录本地证据）。

- **命令**：

```bash
npm run verify
npx playwright test --project=chromium --list --grep-invert "@visual|@python" | tail -5
npx playwright test --project=chromium --list --grep "@visual" | tail -5
npx playwright test --project=chromium --list --grep "@python" | tail -5
git -c http.proxy=http://127.0.0.1:7890 push
```

- **预期**：本地 `verify` 全绿；三类标签的用例集合正确；CI 绿色。
- **约束**：不添加密钥；不使用 `continue-on-error`；不跳过 Python 的本地发布前手跑。
- **证据**：`verify` 输出；Actions 链接/截图；标签清单。
- **回滚**：恢复 E3 的 scripts 与 workflow。
- **停止条件**：CI 需要外部服务；`verify` 时长 > 20 分钟且无法拆分；本地与 CI 结果不一致。

### T-E4.8 G-E4 门禁、报告与标签

- **类型**：review
- **依赖**：T-E4.0–T-E4.7
- **产出**：
  - `docs/reviews/frontend-engineering/e4-quality.md`
  - 更新 `docs/reviews/frontend-engineering/known-issues.md`
  - 标签 `e4-qa`
- **执行顺序**：

```bash
# 1. 静态与内容
npm run lint
npm run typecheck
npm run content:validate
npm run audit:content
npm run audit:exercises

# 2. 覆盖率与构建
npm run test:coverage
npm run build
npm run budget

# 3. React 质量门禁
npx playwright test e2e/routes.spec.ts --project=chromium
npx playwright test e2e/responsive.spec.ts --project=chromium
npx playwright test e2e/keyboard.spec.ts --project=chromium
npx playwright test e2e/a11y.spec.ts --project=chromium

# 4. 双入口视觉（本地 Windows）
npx playwright test e2e/visual.spec.ts --project=chromium
VISUAL_ENTRY=index.next.html npx playwright test e2e/visual.spec.ts --project=chromium

# 5. 对等与交互回归
npx playwright test e2e/parity.spec.ts --project=chromium
npx playwright test e2e/interactions.spec.ts --project=chromium --grep-invert "@python"

# 6. v2 不回退
npx playwright test e2e/smoke.spec.ts --project=chromium
npx playwright test e2e/shell.spec.ts --project=chromium

# 7. 一条命令复验
npm run verify
```

- **预期**：

```text
lint 0 error；typecheck 0 error
content:validate 45/45；audit:content / audit:exercises 通过
覆盖率：engine/state/content ≥85% 行；app ≥60% 行
构建产出 dist/index.html 与 dist/index.next.html
包体：entry ≤180KB、lazy ≤150KB、search ≤300KB gzip
React 66/66；响应式 21/21；键盘全过；axe 0 serious
视觉 21/21 + 21/21
正文对等 66/66；v2 66/66
npm run verify 退出码 0
```

- **报告必须包含**：环境（Node/OS）、命令与退出码、66 路由结果、响应式/键盘/axe 结果、视觉基线数量与 diff 结论、覆盖率四目录数值、包体三项数值、懒加载网络证据、CI 运行结果、已知问题（moderate a11y、CI 无视觉、Python CDN）、残余风险、提交哈希。
- **标签**：

```bash
git tag -a e4-qa -m "E4 质量门禁：66 路由、响应式、键盘、axe、视觉、覆盖率、包体与 CI"
```

- **约束**：不发布；不切换默认入口；不删除 v2；不改 `functions/`。
- **停止条件**：任一门禁失败；axe 仍有 serious；包体超限；覆盖率未达标；视觉 diff 无法解释。

## 10. G-E4 验收清单

### 10.1 路由与控制台

- [ ] 66 条 React 路由全部 200，`main h1` 可见且唯一
- [ ] 每条路由 0 `console.error`、0 `pageerror`
- [ ] 失败路由可单条重跑定位
- [ ] shell/content 不再重复跑 66 循环

### 10.2 响应式

- [ ] 390/768/1280 均无横向滚动（±1px）
- [ ] 860px 以内显示菜单按钮、侧栏收起
- [ ] 860px 以上隐藏菜单按钮、侧栏常驻
- [ ] 抽屉打开/遮罩关闭/路由关闭正确
- [ ] 代码块与表格只在自身容器内滚动

### 10.3 键盘

- [ ] skip link 首个 Tab 可达，Enter 聚焦 `#main`
- [ ] 路由切换后 `#main` 获焦且滚动复位
- [ ] 搜索 `↓` / `Enter` / `Esc` 路径完整
- [ ] 侧栏折叠可按 Enter 操作
- [ ] 抽屉可由键盘打开
- [ ] 选择题可用键盘作答

### 10.4 可访问性

- [ ] 7 页 × 2 宽度 = 14 次 axe 扫描
- [ ] 0 serious、0 critical
- [ ] 无 `disableRules`、无页面排除
- [ ] 修复只涉及 ARIA/`tabIndex`/颜色 token
- [ ] moderate/minor 已记录

### 10.5 视觉

- [ ] 21 张基线已入库且跟踪
- [ ] v2 21/21
- [ ] React 21/21
- [ ] 无 mask、无容差放宽
- [ ] 颜色变化（如有）已记录并双入口重采样

### 10.6 覆盖率与包体

- [ ] `engine` ≥85% 行
- [ ] `state` ≥85% 行
- [ ] `content` ≥85% 行
- [ ] `app` ≥60% 行
- [ ] 入口 ≤180KB gzip
- [ ] 最大懒加载 chunk ≤150KB gzip
- [ ] 搜索索引 ≤300KB gzip
- [ ] 初次加载不请求阶段 chunk 与搜索索引
- [ ] 同阶段切换不重复下载
- [ ] 跨阶段新增 1 个阶段 chunk
- [ ] 搜索聚焦后才请求索引

### 10.7 工程化

- [ ] `npm run verify` 一条命令全绿
- [ ] CI workflow 只调用 `verify`
- [ ] `@visual` / `@python` 排除逻辑正确
- [ ] 失败上传 playwright-report 与 coverage
- [ ] 本地 Windows 视觉门禁在发布前执行

## 11. 风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| 66 路由逐条测试导致 CI 变慢 | 反馈周期长 | 每条独立但并行；chromium 单浏览器；20 分钟超时；必要时按 stage 分片 |
| Windows/Linux 字体差异 | CI 视觉红 | `@visual` 仅在本地跑；known-issues 记录；后续容器化 |
| axe 颜色对比度触发大面积 token 调整 | 视觉基线全变 | 只调 token 且同步双入口重采样；记录对比度计算；不改布局 |
| `scrollable-region-focusable` 涉及大量容器 | DOM 改动面大 | 统一封装可聚焦滚动容器组件；只加 `tabIndex`/`aria-label` |
| 覆盖率阈值导致补测膨胀 | 工期超支 | 先覆盖数据门面/搜索/报告纯函数；不为 100% 而测实现细节 |
| 包体超限 | 首屏变慢 | 用 manifest 定位超限模块；优先拆共享依赖，不调预算 |
| 懒加载断言依赖 chunk 命名 | 易碎 | 断言基于 manifest 闭包而非文件名模式 |
| 抽屉/搜索键盘行为与 v2 不一致 | 用户困惑 | 只测试 v2 已有行为；Escape 关抽屉等增强不做 |
| CI 无 Python CDN | Python 用例红 | `@python` 排除；发布前本地手跑并记录 |
| `verify` 与 CI 漂移 | 本地绿 CI 红 | workflow 只调用 `npm run verify`；Playwright 安装前置 |
| 视觉基线误更新 | 回归被掩盖 | `e2e:update` 仅限审阅过的变更；报告中列出 diff |

## 12. 回滚与交接

### 12.1 回滚

- 每个任务一个提交，失败 `git revert <commit>`；
- 质量门禁只新增测试/脚本/配置，不改业务功能，回滚风险低；
- 若 axe 修复涉及颜色，回滚时同步恢复基线；
- 若 `verify` 集成导致阻塞，可临时恢复 E3 的 `verify`，但必须在 `known-issues.md` 记录原因与恢复计划；
- 最坏情况回退到 `e3-parity`；不删除已发布 v2.0.1。

### 12.2 交给 E5 的输入

E5 开始时必须满足：

- `e4-qa` 标签存在，工作区干净；
- `npm run verify` 全绿；
- React 入口 66 路由、响应式、键盘、axe 全过；
- 双入口视觉 21/21 + 21/21；
- 覆盖率与包体报告写入 `docs/reviews/frontend-engineering/e4/`；
- `known-issues.md` 含：CI 不跑视觉、Python CDN、moderate a11y；
- E5 可直接执行：
  1. `web/index.html` 指向 `scripts/main.tsx`，删除 `index.next.html` 双入口；
  2. 删除 v2 `app.js`、`views/**`、`ui.js`、旧 `engine/exercise.js`；
  3. 移除 `dev_server.py`；
  4. 更新 `README.md`、`00-master-plan.md`、`09-qa-release.md`；
  5. 把 `verify` 中的 `@visual` 排除策略改为“默认入口视觉唯一基线”。

E5 不得删除 `e2e/__screenshots__`，基线继续作为 React 唯一入口的视觉门禁。
