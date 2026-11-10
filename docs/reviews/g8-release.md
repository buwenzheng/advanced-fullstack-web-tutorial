# G8 门禁：全量回归与私有发布

## 1. 结论摘要

G8 通过（1 项登录态复验待用户在浏览器完成）。R1-R11 全量回归通过；45 讲在 ready 模式下 `draft=0`；站点已用新 action 发布，`published: true`，访问范围仍为 `private`；发布包包含 `web/` 与 `functions/`，函数 `app` 在本次 release 中 `is_active: true`。

发布过程中发现并修正了一次打包回归：M9 首次 `prepare_site` 漏传 `functionDirectory`，导致边缘函数未进入该次 release，`/functions/v1/app/*` 返回 409；已用新 action 重新打包发布，修正后该路径恢复为 401 登录门禁。首次 release 已被覆盖，不作为回滚目标。

| 项目 | 结果 |
| --- | --- |
| ready 模式审计 | lessons=45、draft=0、errors=0、warnings=0 |
| 练习题回归 | JS 38/38、Python 38/38、SQL 2/2；starter 全部失败 |
| 链接 / 重复 / 事实 | 0 断链 / 0 重复 / 0 未登记事实（total=10） |
| 路由 | 66 条已知路由 + 未知路由全部正常，0 控制台错误 |
| 响应式 | 390 / 768 / 1280 / 1440 无横向滚动；390 抽屉可用 |
| 可访问性 | 66 条路由单一 h1；0 个无名控件；对比度 0 失败；skip link、焦点环、toast、搜索键盘可用 |
| 性能 | 加载 399ms；路由平均 4.4ms、最大 13.7ms；无白屏 |
| 安全隐私 | 无真实密钥；`DEMO_SECRET` 只在 `functions/handler.ts`；发布包无 `docs/`、`backups/` |
| 改动边界 | 仅 7 个 web 文件修复；`functions/` 与快照逐字节一致 |
| 站点访问 | `private`，0 个访问目标，auth ready |

## 2. 发布记录

| 项 | 值 |
| --- | --- |
| 站点 | 后端进阶实验室 |
| URL | https://backend-for-frontend-0nmydpfsdfg.qoder.website |
| projectId | `01a18744-0ff9-78c1-81e2-9a37aa9ec9c2` |
| siteId | `01a18744-0ffa-79fa-92d9-0ac6a3f812aa` |
| 本次 actionId | `ee38f83f-58f6-4c6f-9ff8-1bdddf0190da` |
| deploymentId | `01a1c321-47fd-79ac-bdbe-3d825990d768` |
| releaseId | `01a1c321-a3b6-7976-b71c-4f5feb1adc0a` |
| artifactSha256 | `7b0f5dc81d7e65a23c4a9a9b40cccab908934b77f78463c27fc3eb60b51d7b73` |
| indexSha256 | `2f3cafd04376f6f199902a66e868dcaed4059c7cf1cd248a5b0dedfdd59bbdfe`（与本地 `web/index.html` 一致） |
| 发布时间 | 2026-11-10T01:45:25Z |
| 访问范围 | `private`（发布前后一致，未修改） |
| 函数 | `app` / edge / `database_access: none` / `is_active: true` |

被覆盖的首次 M9 发布（仅留档，不可回滚使用）：actionId `8da6818d-603d-419f-a190-a5c9745649d4`，releaseId `01a1c31b-bfe4-7d29-bcd4-89597fa981da`，deploymentId `01a1c31a-7f7b-7a3f-b266-7c5f0d75859e`。

上一版 release（回滚基线）：actionId `a42feff6-e275-448e-84cd-fac73f185549`，releaseId `01a1bef4-36c8-74c7-9f44-f5c8ce0d49ea`，deploymentId `01a1bef3-f64b-715a-a3ac-115d2742721a`。

### 2.1 发布后补丁：滚动条样式（2026-11-10）

- 现象：Qoder 预览画布中侧栏滚动条显示为浅色原生样式，`::-webkit-scrollbar` 自定义样式未被该环境采用；
- 修复：`web/styles/tokens.css` 为 `html` 增加标准 `scrollbar-color: var(--ink-650) transparent`，并为所有滚动容器声明 `scrollbar-width: thin`；内容与结构零改动；
- 验证：本地 Chrome 1027/1440 下侧栏与页面滚动条均为细暗条，横向溢出 0；`audit mode=ready lessons=45 draft=0 errors=0 warnings=0`；
- 发布：actionId `aa4fa5cb-6055-49ad-beff-738512ddf628`，deploymentId `01a1c34e-35e0-76c2-9bc1-33b49105e703`，releaseId `01a1c34e-87a3-773c-86c3-f58087e01acd`，artifactSha256 `35d49a082e92373906637110ac449738226686543065c13dbad2e55c0e5a7efd`，indexSha256 不变，发布完成 2026-11-10T02:34:27Z；
- 状态：站点仍为 `private`（0 访问目标），函数 `app` 已包含并发布。

## 3. G8-A 发布前门禁

- [x] `get_context` 确认项目根、描述文件与运行环境；
- [x] `get_site` 确认站点 active、`access_mode=private`、auth ready；
- [x] `get_site_access` 确认 `private`、0 targets，未改访问策略；
- [x] 内容与配置快照 `backups/web-v2-20261109/`（`web/`、`functions/`、描述文件、`docs/content-manifest.json`、README）；
- [x] R1-R11 全绿（见第 4 节）；
- [x] 发布产物无密钥、无 `docs/`、无 `backups/`（`prepare_site` 只打包 `web/` 与 `functions/`）；
- [x] `functions/` 未修改：与快照 `diff -rq` 无差异；
- [x] 复用既有 projectId/siteId，新 actionId，`webDirectory: "web"`，未新建站点。

## 4. R1-R11 回归结果

| 项 | 结果 |
| --- | --- |
| R1 内容结构 | 9 阶段 / 45 讲 / 9 项目；3400 分钟；38 JS + 38 Python + 2 SQL 题 |
| R2 工具链 | audit ready 0/0/0；links 0；duplication 0；facts 0；全部练习通过 |
| R3 路由 | 66 条已知路由全部渲染；未知顶层回总览；未知参数显示空状态 |
| R4 判题 | JS / Python / SQL 浏览器判题与 CLI 一致；Python 走 Pyodide，断网可跑 |
| R5 进度状态 | 掌握、答题、里程碑、草稿、重置、语言轨道与迁移矩阵通过 |
| R6 搜索 | 14 个关键词命中；↑↓/Enter/Esc 键盘可用 |
| R7 响应式 | 390/768/1280/1440 无横向滚动；实验台在 941-1100 区间已改为单列 |
| R8 可访问性 | 单一 h1；0 无名控件；对比度 0 失败；skip link 修复；焦点环可见 |
| R9 性能 | 加载 399ms；路由均值 4.4ms / 最大 13.7ms；101 次检查 × 200 次无白屏 |
| R10 安全隐私 | 仅演示夹具；无真实 API key；`DEMO_SECRET` 只在函数内；无外链追踪 |
| R11 文案一致 | 标题/描述/阶段名/课时数/“资深全栈”定位一致 |

本轮为修复回归缺陷做的最小改动（未改课程内容语义）：

- `web/scripts/app.js`：skip link 改为聚焦 `#main` 并滚动，避免被 hash 路由劫持；
- `web/scripts/views/lab.js`：页面标题提升为 h1；请求路径输入补 `aria-label`；
- `web/scripts/views/report.js`、`web/scripts/views/project.js`：页面标题提升为 h1；
- `web/styles/components.css`：适配 h1 选择器；
- `web/styles/lesson.css`：实验台在 ≤1100px 单列，修复 941-1100 区间横向溢出；
- `web/styles/tokens.css`：提升弱文本对比度（`--text-dim/--text-mute/--text-faint`）。

## 5. G8-B 发布后验证

冒烟在本地同源服务上执行，`web/index.html` 的 SHA-256 与线上 `indexSha256` 完全一致，因此验证对象与发布产物一致。

| 检查 | 方法 | 结果 |
| --- | --- | --- |
| 首页 | `#/` | h1 正常，1542 字符，0 横向滚动 |
| 阶段页 | `#/stage/s0`、`s6`、`appendix` | h1 与课时列表正常，0 空状态 |
| 课时页 | `#/lesson/s0-l1`、`s7-l5`、`a13` | h1 正常；内容块 14/16/14；a13 有 4 个练习 |
| 项目页 | `#/project/p0`、`p6`、`p-graduation` | 里程碑 5 / 6 / 11，清单正常 |
| 实验台 | `#/lab` | UI 正常；内置模拟服务可发请求；`/health` 属真实端点，匿名被 401 门禁拦截 |
| 后端函数 | `/functions/v1/app/health` | 函数 `app` 已随 release 部署且 active；本地直接调用 handler 返回 200（service=`backend-lab`，version=`1.0.0`）；线上匿名请求 401，登录态 200 未由自动化客户端实测 |
| 报告页 | 作答 1 题后打开 `#/report` | 统计更新为 1 题、0%、1 待攻克；无报错 |
| 控制台 | 66 条路由全流程 | 0 错误；100/100 静态资源返回 200 |
| 移动端 | 390px | 0 横向滚动；抽屉 `aria-expanded=true`，scrim 正常 |
| 访问范围 | 匿名请求 | `/`、`/index.html`、`/scripts/app.js` 均 401 `sites_gateway_login_required` |

发布后专项：

- [x] `published: true`，release 与当前 action 对应；
- [x] 站点仍为私有；
- [x] 旧书签 `#/stage/s6`、`#/stage/appendix` 可打开；
- [x] 旧进度迁移在真实浏览器生效：`s6-l1→a1`、`s6-l2→a2`、草稿 `s6-l3→a3`，`p` 保留，`meta.version=2`；
- [x] 搜索新关键词「幂等」命中 12 条；
- [x] 无 404 静态资源；
- [x] 标题/描述为新定位（「后端进阶实验室 · AI 时代资深全栈」）。

## 6. 发布过程异常与修正

1. M9 首次 `prepare_site` 只传了 `projectRoot/webDirectory/projectId/actionId`，漏掉 `functionDirectory`、`databaseAccess`、`spa`。
2. 发布后 `/functions/v1/app/*`（包括不存在的函数名）统一返回 409 `sites_gateway_supabase_not_ready`；`get_site(include: functions)` 显示 `functions: []`。对比历史发布参数，确认是该次 release 未打包函数。
3. 用新 action `ee38f83f-58f6-4c6f-9ff8-1bdddf0190da`，按固定输入重新 `prepare_site`：`webDirectory: "web"`、`functionDirectory: "functions"`、`databaseAccess: "none"`、`spa: true`，`projectId` 不变；ready 后同 action 重试写入描述文件。
4. `publish_site` 成功，`get_site(include: functions)` 显示 `app` active；匿名访问 `/functions/v1/app/health` 由 409 变为 401，符合私有站点门禁预期。
5. 同步修正 `docs/implementation/09-qa-release.md` 的发布步骤，补充上述固定输入，避免后续 release 再次漏打包。

## 7. 遗留项与残余风险

1. **登录态后端复验（唯一未闭环项）**：私有站点要求 Qoder 账号登录，自动化浏览器无法完成登录，因此未实测线上 `/functions/v1/app/health` 的 200 响应。部署状态、函数 active 状态与 handler 本地 200 均已验证。复验方式：登录站点后打开 `#/lab` → 「真实端点」→ `GET /health`，应返回 200 且 `service=backend-lab`、`version=1.0.0`。
2. Python 判题依赖 CDN 加载 Pyodide；首次进入 Python 轨道需联网，之后浏览器缓存可用。
3. 迷你 SQL 引擎仍是教学子集：不支持窗口函数、子查询、`UNION`、`RIGHT/FULL JOIN` 的实际执行；正文已标注。
4. `DEMO_SECRET` 为固定演示值，仅定义在 `functions/handler.ts`；站点为私有，风险受限。如未来改为公开站点，应迁移到平台 Secret 并轮换。

## 8. 回滚预案（可执行）

1. **平台回滚优先**：若 Sites 控制台提供按 release 回滚，直接回滚到 `01a1bef4-36c8-74c7-9f44-f5c8ce0d49ea`，记录时间与操作人。当前 MCP 未暴露回滚工具，未执行平台回滚。
2. **备份重发**（平台无回滚时）：
   - 源：`backups/web-v2-20261109/`（含 `web/`、`functions/`、描述文件、manifest）；
   - 新 actionId；`projectRoot` 指向备份目录，`webDirectory: "web"`，`functionDirectory: "functions"`，`databaseAccess: "none"`，`spa: true`，`projectId` 不变；
   - `prepare_site` → 等 `canPublish: true` → `publish_site` → 轮询 `published: true`；
   - 按第 5 节冒烟重跑，确认仍为 private。
3. **禁止**：删除站点、重建 project、改公开、复用旧 action 冒充新版本。
4. 回滚后记录原因、影响、时间线、后续修复到本文件。

## 9. 归档

- 快照：`backups/web-v2-20261109/`
- 发布参数与 release：`.后端进阶实验室.qoder.site`
- 回归与发布结论：本文件
- 发布说明：`docs/release-notes-v2.md`
- 计划：`docs/implementation/09-qa-release.md`
