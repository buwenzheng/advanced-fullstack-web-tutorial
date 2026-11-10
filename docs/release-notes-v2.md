# 后端进阶实验室 · v2 发布说明

- 发布版本：v2.0.1（M0-M9 内容体系与全量回归；2026-11-10 补丁：滚动条样式兜底）
- 发布时间：2026-11-10
- 站点：后端进阶实验室（私有）
- 地址：https://backend-for-frontend-0nmydpfsdfg.qoder.website

## 1. 版本概览

| 维度 | 规模 |
| --- | --- |
| 阶段 | 9 个（S0-S7 + 附录） |
| 课时 | 45 讲（核心 32 讲 + 附录 13 讲），全部 ready |
| 项目 | 9 个（p0-p7 + p-graduation 毕业项目） |
| 学习时长 | 3400 分钟（核心 2510 + 附录 890） |
| 练习 | 38 道 JS、38 道 Python、2 道 SQL；另有方案题自检清单 |
| 搜索 | 全站标题、阶段、课时、正文关键词与项目索引 |

## 2. 本次发布包含

- 45 讲完整正文、代码块、检查项与练习，统一的内容清单与事实登记；
- Node.js / Python 双语言轨道，Python 由浏览器内 Pyodide 执行，断网可跑；
- 9 个阶段项目与毕业项目 LinkHub：交付物、可观察验收、证据清单、答辩模板；
- HTTP 实验室：内置模拟服务覆盖分页、校验、冲突、认证、权限、限流、条件请求、幂等、超时等场景；真实端点走同源 `/functions/v1/app`；
- 学习报告：课程掌握、答题、项目里程碑与待攻克题目；
- 进度本地持久化（`bff-lab-progress-v1`）与旧版进度迁移（`s6-l1..l6 → a1..a6`）。

## 3. 本次修复

- skip link 不再被 hash 路由劫持，可正确聚焦主内容；
- 实验台、学习报告、项目页补齐单一 h1；实验台请求路径补可访问名称；
- 弱文本对比度提升到 WCAG AA；
- 实验台在 941-1100px 区间改为单列，消除横向滚动；
- 发布打包固定包含 `web/` 与 `functions/`，避免边缘函数从 release 中丢失；
- 滚动条补充标准 `scrollbar-width` / `scrollbar-color` 兜底，预览环境中侧栏不再出现浅色原生滚动条。

## 4. 验证摘要

- 内容审计：`lessons=45 draft=0 errors=0 warnings=0`；
- 练习：JS 38/38、Python 38/38、SQL 2/2 通过，starter 全部失败；
- 路由：66 条已知路由全部正常，0 控制台错误；
- 响应式：390/768/1280/1440 无横向滚动，390 抽屉可用；
- 可访问性：单一 h1、0 无名控件、对比度 0 失败；
- 性能：加载 399ms，路由平均 4.4ms；
- 隐私：站点 `private`，匿名访问 401；发布包无密钥、无 `docs/`、无 `backups/`。

## 5. 发布信息

| 项 | 值 |
| --- | --- |
| actionId | `aa4fa5cb-6055-49ad-beff-738512ddf628` |
| releaseId | `01a1c34e-87a3-773c-86c3-f58087e01acd` |
| deploymentId | `01a1c34e-35e0-76c2-9bc1-33b49105e703` |
| artifactSha256 | `35d49a082e92373906637110ac449738226686543065c13dbad2e55c0e5a7efd` |
| 发布时间 | 2026-11-10T02:34:27Z（v2.0.1 补丁，仅 CSS） |
| 访问范围 | `private`（未变更） |

## 6. 已知限制

- 私有站点需 Qoder 账号登录；自动化回归无法完成登录，线上 `/functions/v1/app/health` 的登录态 200 未实测。复验：登录后打开 `#/lab` → 「真实端点」→ `GET /health`。
- Python 判题首次使用需联网加载 Pyodide，之后依赖浏览器缓存。
- 迷你 SQL 引擎是教学子集，不支持窗口函数、子查询、`UNION`、`RIGHT/FULL JOIN` 的实际执行。
- `DEMO_SECRET` 为固定演示值，仅存在于 `functions/handler.ts`；若站点未来公开，应迁移到平台 Secret 并轮换。

## 7. 回滚

- 回滚基线：releaseId `01a1c321-a3b6-7976-b71c-4f5feb1adc0a`（actionId `ee38f83f-58f6-4c6f-9ff8-1bdddf0190da`，M9 全量版）；更早基线 releaseId `01a1bef4-36c8-74c7-9f44-f5c8ce0d49ea`（actionId `a42feff6-e275-448e-84cd-fac73f185549`）；
- 源码：git 标签 `v2.0.1`（私有仓库 `advanced-fullstack-web-tutorial`）；发布源可由标签重建，本地 `backups/` 已移除；
- 平台支持按 release 回滚时优先使用平台操作；否则以备份为新源，新 action 重新 `prepare_site` + `publish_site`，`projectId/siteId` 不变；
- 详细步骤与验证矩阵见 `docs/reviews/g8-release.md` 第 8 节。
