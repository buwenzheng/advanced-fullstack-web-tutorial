# E5 手工验收记录（T-E5.5 / §7.4、§7.5）

- 日期：2026-11-10
- 被测产物：`npm run build` 生成的 `dist/`（单入口，`npm run build` exit=0，见 `offline-dist.txt`）
- 静态服务：`python -m http.server 8125 --directory dist`（卡片命令为 8124，该端口被本机既有 python http.server 占用且无法结束，改用 8125；断言相同，详见 `offline-dist.txt` 的 environment note）
- 浏览器：Chromium（内置 Browser 面板，视口隐藏；交互经 DOM 程序化触发，布局以 Playwright 1440x900 截图复核）
- curl 断言结果：见 `offline-dist.txt`（首页 200/1353 B 与 `dist/index.html` 逐字节一致；`assets/index-C20GHETo.js`、`assets/index-BqIDEzqA.css` 均 200；`index.next.html` 不存在；`index*.html` 计数 1）

## §7.4 离线 dist 浏览器检查

| 路由 | 结果 | 证据 |
| --- | --- | --- |
| `#/` | 总览渲染：hero「把前端的手感，接后端的世界」、9 阶段卡片、侧栏进度 0/45；无 404；控制台无错误 | `offline-screenshots/overview.png`（326006 B） |
| `#/lesson/s0-l1` | 课时正文渲染：h1「从 URL 到响应：请求的四段旅程」、检查题与练习齐全 | `offline-screenshots/lesson.png`（348577 B） |
| `#/lab` | 实验台可用：内置「列表与分页」场景发送成功（200 OK, 108 ms, `content-type: application/json; charset=utf-8`，JSON items 响应）；历史「200 GET /api/users?page=1&limit=3 108 ms」；重置后响应区清空、历史显示「还没有请求记录。」、场景提示复位 | `offline-screenshots/lab.png`（246373 B） |
| `#/report` | 报告数值正常：0/45、0、0%、0/54、0 | `offline-screenshots/report.png`（239958 B） |
| 课时页刷新 | hash 路由不经过服务器路径：服务器只收到 `GET /`，直接加载 `#/lesson/s0-l1` 仍渲染同一课时（离线服务无 SPA 回退也可用） | `offline-screenshots/lesson.png` |
| 未知 hash `#/totally-unknown-route` | 回落总览，URL 保持 `#/totally-unknown-route` 不变 | `offline-screenshots/unknown.png`（326006 B，与 overview.png 同尺寸同内容） |

附带：`#/lab` 的「真实端点」页签针对本地静态服务发送 `GET http://127.0.0.1:8125/functions/v1/app/users?page=1&limit=3`，如实得到 404（14 ms，`server: SimpleHTTP/0.6 Python/3.11.9`，HTML 错误体），实验台提示了环境差异。控制台因此恰好有 1 条错误——即该主动 404，属预期行为，非缺陷。

## §7.5 兼容性手工核对

| 项目 | 操作 | 结果 |
| --- | --- | --- |
| 进度存储 | 完成 `s0-l1-check-1` 检查题后刷新 | `bff-lab-progress-v1` 保留已答记录，刷新后状态恢复 |
| 草稿 | 在 `s0-l1-ex-2` 代码题输入 `E5-OFFLINE-DRAFT-CHECK`，切换课时再返回 | `bff-lab-drafts-v1` 为 `{"note:s0-l1-ex-2":"E5-OFFLINE-DRAFT-CHECK"}`，草稿保留 |
| 语言轨道 | 切换 Python 后刷新 | `bff-lab-lang-v1` 保持 `"python"`；对应 E2E `@python` 1 passed（见 `python.txt`） |
| 旧进度迁移 | `npx tsx tools/test-progress-migration.ts`（仓库根目录） | `progress migration ok: q/l/drafts mapped, graduation preserved, idempotent`，exit=0 |
| 清空记录 | 点击「清空学习记录」 | confirm 文案 `确定要清空全部学习记录吗？此操作不可撤销。`；确认后 `bff-lab-progress-v1` 变为 `{"q":{},"l":{},"p":{},"meta":{"version":2,"startedAt":...}}`，`bff-lab-drafts-v1` 被移除（读取为 null），`bff-lab-lang-v1` 保留 `"python"`；`#toast-host` 出现「学习记录已清空」；报告归零（0 已答 / 0%），侧栏 0/45 |
| 懒加载 | 首次打开总览记录网络 | 仅请求入口 `index-C20GHETo.js`、CSS 与 `js.worker`，无任何 `s0…s7` 阶段 chunk；进入 `s0-l1` 课时后才请求 `s0-xX3Chzul.js` |
| 搜索索引 | 总览初始不聚焦搜索框，再首次聚焦 | 初始不请求 `search-index-BwozhHnn.js`；首次聚焦后才请求（gzip 199.34 kB） |
| 实验台 | 见 §7.4 内置场景/真实端点/重置三行 | 响应、历史、重置均正常 |
| 未知课时/阶段/项目 | 手工输入 `#/lesson/does-not-exist`、`#/stage/does-not-exist`、`#/project/does-not-exist` | 文案与 v2 冻结契约逐字一致：课时「找不到这一讲，可能是链接有误。」+「返回总览」链接（`#/`）；阶段「找不到这个阶段。」；项目「找不到这个项目。」（对照 `docs/reviews/frontend-engineering/e3/contract.md` 第 31–33 行） |

## 存储键核对

三个键名全程未变：`bff-lab-progress-v1`、`bff-lab-drafts-v1`、`bff-lab-lang-v1`；进度数据结构仍为 `meta.version=2`。

## 缺陷判定（总纲 §12.3）

- 阻塞缺陷：无。
- 非阻塞/环境项：
  1. 端口 8124 被本机既有 `python -m http.server`（PID 52660）占用且无法在本会话结束，改用 8125 完成等价断言（`offline-dist.txt` 已记录）。属本机环境，非仓库产物缺陷。
  2. `#/lab` 真实端点 404：离线静态服务不提供 `/functions/v1/*` 后端，实验台如实展示 404 并提示环境差异，属预期行为。
- 视觉：21/21，基线 SHA 未变（见 `visual.md`）。
- Python：E2E `@python` 1 passed；`run-python-exercises` 38 题 failing=0（`python.txt`）。

## 截图清单

| 文件 | 字节数 |
| --- | --- |
| `offline-screenshots/overview.png` | 326006 |
| `offline-screenshots/lesson.png` | 348577 |
| `offline-screenshots/lab.png` | 246373 |
| `offline-screenshots/report.png` | 239958 |
| `offline-screenshots/unknown.png` | 326006 |

截图命令：`npx playwright screenshot --viewport-size=1440,900 --wait-for-timeout=3000 "http://127.0.0.1:8125/#/..." <file>`（exit=0）。
