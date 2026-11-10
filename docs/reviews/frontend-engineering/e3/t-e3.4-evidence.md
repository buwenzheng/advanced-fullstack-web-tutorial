# T-E3.4 证据：项目页、实验台与报告页

- 日期：2026-11-10
- 环境：Node v24.22.1（.nvmrc 要求 22.15.0，当前 shell 未切换，见阶段报告）；Chromium（Playwright 1.65.0）；Vite preview 127.0.0.1:4173（React 入口 `index.next.html`，v2 入口 `/`）

## 命令与退出码

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| `npx vitest run web/scripts/test/project-page.test.tsx web/scripts/test/lab.test.tsx web/scripts/test/report.test.tsx` | 0 | 3 files / 29 tests passed（4.18s） |
| `npm run lint` | 0 | 无告警 |
| `npm run typecheck` | 0 | 两个 tsconfig 均通过 |
| `npm run build` | 0 | `next-Du05iDuU.js` 396.85 kB（gzip 125.68）；`harness-C92I80H5.js` 1,347.97 kB（gzip 402.35）仍触发 >500 kB 警告，T-E3.5 懒加载处理 |
| `npx playwright test e2e/content.spec.ts --project=chromium -g "project|lab|report"` | 0 | 3 passed（2.1s） |

## 截图对照

路径：`docs/reviews/frontend-engineering/e3/`（1440x900 视口、fullPage、preview 构建、Playwright 驱动真实 Chromium、动画禁用、字体加载完成后截图）

- 毕业项目（`#/project/p-graduation`）：`v2-project-p-graduation-1440.png` / `v3-project-p-graduation-1440.png`
  - 两版 hero、11 个里程碑（含 11 个笔记框）、答辩模板库 6 张卡片（含模板正文）逐段一致；
  - e2e 验证交互：勾选第一个里程碑 → `.milestone.is-done`、hero 徽章 `里程碑进度 1/11`；刷新后仍为已完成（进度经 store 持久化）。
- 实验台（`#/lab`）：`v2-lab-1440.png` / `v3-lab-1440.png`
  - 10 个场景按钮（列表与分页 … 慢响应与超时）、请求构造器、响应/最近请求/教学箱布局一致；
  - 首屏差异（见「偏离与修复记录」）：「最近请求」空状态 `还没有请求记录。` v3 首屏渲染、v2 首屏不渲染；按契约 §3.7.1 执行。
- 限流 429：`v3-lab-429-1440.png`
  - 「触发限流（429）」场景连发 3 次：状态徽章 `429 Too Many Requests`、耗时 `99 ms`；响应头 `retry-after: 3`、`x-ratelimit-limit: 2`、`x-ratelimit-remaining: 0`；错误体 `rate_limited`；历史依次为 429/200/200。
- 幂等重放：`v3-lab-idempotent-1440.png`
  - 「幂等键（重复提交）」连发 2 次：状态 `201 Created`，追加 `span.badge.badge--violet` 文本 `幂等重放`；响应头 `idempotency-replayed: true`；历史两条 `POST /api/payments`。
- 报告（`#/report`）：`v2-report-1440.png` / `v3-report-1440.png`
  - 5 个统计（`0/45` 课程掌握、`0` 已作答、`0%` 通过率、`0/54` 项目里程碑、`0` 待攻克）、代码练习轨道 0/38 双轨、9 条阶段进度（0/15…0/13）、空错题提示、9 个项目进度卡（0/5…0/11）、接下来学什么 3 条，与 v2 逐段一致。
- 三页 v2/v3 采集过程 console/pageerror 计数均为 0。

## 对等要点验证（测试内固化）

- 项目页：无效 ID 显示空状态且不渲染 hero；阶段项目 hero（阶段 0、里程碑进度 0/5、3 个徽章）与 5 个里程碑（无笔记框）；毕业项目 11 个里程碑全部带笔记框、6 份模板；勾选/撤销里程碑联动徽章与 store；毕业笔记写回 `setMilestoneNote` 且重渲染恢复；模板复制成功（`已复制` + toast `已复制：${title}`）与失败（`复制失败`）分支，1600ms 后复位，卸载清理定时器。
- 实验台：10 个场景逐项填入方法/路径/请求头/请求体并更新教学箱与 toast；`runMock` 覆盖 400/401/403/404/409/422/429/304/201/204/幂等重放判定；`buildCurl` 生成与复制降级展示；历史最多 6 条；mock/真实端点 tabs 文案切换；重置恢复种子用户、默认请求、清空响应/历史/幂等表且 `rateLimitCount=0`，教学文案按当前模式恢复。
- 报告：空进度全 0 与空错题文案；答错题目进入待攻克列表（序号、标题、`已尝试 N 次`、重做徽章、链接）；设计题未完成显示 `自检清单未完成`；附录阶段序号 `A`；Python 轨道按 `taskId@py` 单独计数；阶段条按阶段题目总计分；项目卡含毕业项目共 9 个且进度/条形宽度正确；nextUp 取前 3 条未掌握课时；通过率在复答后更新。

## 偏离与修复记录

- 单测断言修正 5 处（不改实现、不改内容）：
  - 响应体 JSON 位于单个 `.console-out` 文本节点，`getByText('"total": 5')` 精确匹配失败 → 改为断言 `textContent` 包含；`rate_limited` 同理；
  - 429 的 `getByText('3')` 与页面其它文本歧义 → 改为读取 `retry-after` 表格行的最后一列；
  - 幂等徽章原期待首次发送后不存在 → 契约 §3.7.4 与 v2 `lab.js:494` 均为「存在 `idempotency-replayed` 响应头即显示」，首次值 `false` 也显示；测试改为首次 `false` + 第二次 `true` + 仅 1 个徽章；
  - 项目模板复制测试中 `userEvent.setup()` 会替换 `navigator.clipboard`，覆盖 beforeEach 注入的 mock → 在 setup 之后重新注入；
  - 报告测试在 `noUncheckedIndexedAccess` 下 `querySelectorAll(...)[i]` 可能为 undefined → 显式 `HTMLElement` 断言后再查询。
- v2 首屏实验台空状态：v2 `renderHistory` 只在场景点击/重置时调用（`lab.js:379`、`lab.js:407`），故 v2 首屏基线无 `还没有请求记录。`；契约 §3.7.1 明确要求「body 内历史或空状态」，v3 按契约首屏渲染。该差异记录为契约优先，T-E3.6 视觉对等比对时按已知差异处理。

## 残余风险

- 主 chunk 体积超预算警告仍在（T-E3.5 拆分）。
- 截图覆盖空进度报告；非空统计与错题列表由单测和 e2e（种子 localStorage）覆盖，T-E3.6 可补非空状态截图对照。
- 模板复制降级路径（textarea/execCommand）只经单测，未在真实浏览器手工触发；剪贴板成功路径由单测与真实点击覆盖。
- 真实端点模式不接后端（E3 约束），仅验证 tab 文案切换与本地失败提示逻辑。

## 提交

`T-E3.4: 项目页、实验台与报告页`（哈希见阶段报告）
