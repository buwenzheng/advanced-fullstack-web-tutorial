# M9：全量回归与私有发布

> 依赖：G0-G7 全部通过。产出：45 讲全量回归、可访问性与安全检查、私有发布、发布后验证与回滚预案。G8 分两段：G8-A 发布前，G8-B 发布后。

## 1. 模块目标

- 用一套可重复的矩阵证明：内容完整、练习可跑、路由可达、状态正确、移动端可用、无密钥泄漏。
- 发布只做一件事：把已验证的 `web/` 静态产物发布到既有站点，保持私有，不换项目、不改后端语义。
- 发布不是终点：发布后必须做路由冒烟、控制台检查、实验台后端检查与访问范围确认。
- 任何一项失败都不发布；发布后失败按回滚预案处理，不用「再发一版试试」代替诊断。

## 2. 发布对象与固定约束

| 项 | 值 |
| --- | --- |
| 站点名称 | 后端进阶实验室 |
| projectId | `01a18744-0ff9-78c1-81e2-9a37aa9ec9c2` |
| siteId | `01a18744-0ffa-79fa-92d9-0ac6a3f812aa` |
| 站点描述文件 | `.后端进阶实验室.qoder.site` |
| 静态目录 | `web/`（`index.html` + `scripts/` + `styles/`） |
| 后端函数 | `functions/`（`handler.ts`、`index.ts`） |
| 访问范围 | **私有**，不改为公开 |
| 演示密钥 | `DEMO_SECRET` 为固定演示值，仅定义在 `functions/handler.ts`，不写入任何文档/前端，不改成生产密钥 |
| 发布方式 | 复用同一 projectId/siteId；内容变更使用**新的 actionId**；不新建站点 |

**硬规则**

- 不把 `webDirectory` 设为 `"."`；发布目录必须是 `web/`。
- 不删除或重建 projectId/siteId；不更换站点地址。
- 不提交、不打印、不写入任何真实 API key；AI 练习只用 mock。
- 发布前必须确认访问策略仍为私有；发布动作本身不改访问策略。
- 发布后若需变更内容，重新走 `prepare_site` + `publish_site`，不复用旧 action 的产物。

---

## 3. 全量回归矩阵

### R1 内容结构

| 检查 | 方法 | 预期 |
| --- | --- | --- |
| 阶段数 | `content-stats` / manifest | 8 个核心阶段 + 1 个附录 |
| 课时数 | 同上 | 45 讲（核心 32 + 附录 13） |
| 总时长 | 同上 | 3400 min（核心 2510 + 附录 890） |
| 每讲检查 | manifest | 每讲 3 道概念检查 |
| 代码题 | manifest | 代码讲均有 Node/Python 双轨；SQL 讲按课程表 |
| 方案题 | manifest | 阶段末/项目内方案题齐全 |
| 项目 | manifest | p0-p7 + 毕业项目，共 9 个 |
| ID 唯一 | `audit-content` | 无重复 lesson/task/project id |
| 先修存在 | `audit-content` | 所有引用的先修 ID 存在 |
| 状态 | manifest | 全部 `ready`，无 `draft` |

### R2 工具链

```bash
node tools/audit-content.mjs
node tools/run-js-exercises.mjs
node tools/run-python-exercises.mjs
node tools/run-sql-exercises.mjs
node tools/check-links.mjs
node tools/check-duplication.mjs
node tools/check-facts.mjs
node tools/content-stats.mjs
```

预期：全部退出码 0；0 失败；0 断链；0 未登记事实；统计与 manifest 一致。

### R3 路由矩阵

| 路由 | 数量 | 检查 |
| --- | --- | --- |
| `#/` | 1 | 总览渲染；阶段卡 9 个；CTA 指向下一讲 |
| `#/stage/<id>` | 9 | s0-s7 + appendix；课时列表、阶段目标、项目卡 |
| `#/lesson/<id>` | 45 | 标题、目标、块、检查、练习、上下讲 |
| `#/project/<id>` | 9 | p0-p7 + p-graduation；步骤、里程碑、清单 |
| `#/lab` | 1 | HTTP 实验台可发请求；错误可读 |
| `#/report` | 1 | 统计、阶段掌握度、待攻克、项目进度 |
| 未知路由 | 1 | 友好空状态，不白屏 |

**抽样**：每个阶段抽 2 讲（首讲 + 末讲），每个项目抽 1 个；45 讲全量用脚本检查 `lessonById` 可达。

### R4 判题引擎

| 类型 | 抽样 | 检查 |
| --- | --- | --- |
| JS 代码 | 每阶段 2 题 | 正常/边界/失败用例；6s 超时；错误可读 |
| Python 代码 | 每阶段 2 题 | Pyodide 加载；8s 超时；`@py` 进度独立 |
| SQL | 每阶段 1 题 | 结果集比对；NULL/大小写语义 |
| 方案题 | 每阶段 1 题 | 自检清单可勾选；进度记录 |
| 概念检查 | 每阶段 2 题 | 单选/多选；答错给解析；可重做 |

### R5 进度与状态

| 场景 | 操作 | 预期 |
| --- | --- | --- |
| 答题 | 答对/答错/重做 | `attempts`/`correct`/`solved` 正确；刷新不丢 |
| 课时掌握 | 全部任务通过 | 自动掌握；手动标记可覆盖 |
| 阶段掌握 | 完成部分课时 | 百分比正确；总览/侧栏/报告一致 |
| 项目里程碑 | 勾选/取消 | 项目进度与报告同步 |
| 语言轨道 | Node ↔ Python | 全局切换；进度 OR 合并；刷新保持 |
| 草稿 | 输入代码后切换课时 | 草稿恢复；清空后不复活 |
| 重置 | 清空学习记录 | 全部归零；语言偏好保留或明确重置 |
| 迁移 | 旧 `s6-l1..l6` + `@py` + drafts | 映射到 a1..a6；不丢进度 |
| 旧毕业进度 | `p-graduation.m.g1..g8` | 原键保留；不映射到 m1..m11；新报告只认 `m1..m11`，不虚增完成度 |

### R6 搜索

- 搜索「BFF」「SSR」「CSRF」「RUM」「RAG」「pgvector」「提示注入」「评估集」「AI Coding」「B+tree」「HyperLogLog」「Little 定律」「ADR」「KV cache」均能命中；
- 搜索结果可键盘上下选择、Enter 跳转、Esc 关闭；
- 搜索索引包含正文块文本，不只是标题；
- 无结果时有空状态。

### R7 响应式

| 宽度 | 检查 |
| --- | --- |
| 390px | 无横向滚动；侧栏抽屉可开合；代码块可横向滚动；表格不撑破 |
| 768px | 双栏/单栏切换正常；顶部搜索可用 |
| 1280px | 三栏布局正常；侧栏固定；内容最大宽度合理 |

### R8 可访问性

- [ ] 跳过链接可用，焦点落到主内容；
- [ ] 所有按钮/链接可键盘到达，焦点可见；
- [ ] 侧栏按钮 `aria-expanded` 正确；
- [ ] 搜索框 `role=combobox`、结果 `role=listbox`、键盘可用；
- [ ] 表单/输入有可访问名称；
- [ ] 标题层级每页一个 h1；
- [ ] 颜色对比度达到 WCAG AA（正文/次要文字/按钮）；
- [ ] `prefers-reduced-motion` 下动画降级；
- [ ] 200% 缩放无内容丢失；
- [ ] toast 有 `aria-live`，不打断阅读。

### R9 性能与稳定性

- 冷缓存首屏内容渲染 < 1.5s（本地静态服务）；
- 路由切换 < 300ms；
- 0 控制台错误；0 失败网络请求（mock/静态资源除外）；
- 连续切换 20 个路由无内存告警/白屏；
- Python 首次加载有明确 loading，失败有可读错误；
- 长课时（块最多的讲）滚动流畅，无布局跳动。

### R10 安全与隐私

- [ ] 仓库无真实 API key、token、私钥；
- [ ] 前端无 `eval` 以外的动态执行（沙箱执行仅用于练习）；
- [ ] 内容块不含 `<script>`、外链图片、追踪脚本；
- [ ] AI fixture 无个人信息、无受版权保护长文本；
- [ ] `DEMO_SECRET` 仅存在于 `functions/handler.ts`，未出现在前端/文档；
- [ ] 实验台请求不携带真实凭证；
- [ ] 站点访问范围仍为私有；
- [ ] 发布产物只包含 `web/` 静态文件，不包含 `docs/`、`backups/`、`.qoder.site` 描述文件。

### R11 文案一致性

- 总览不再出现「六个阶段」「高级全栈」等旧定位；
- 新定位为「八个核心阶段 + 附录」「资深全栈 + AI 工程 + AI Coding」；
- 附录标识为 `APPENDIX`，不与核心 S6 混淆；
- 课时数、练习数、时长与 manifest 一致；
- 项目链 p0 → p7 → 毕业项目的因果描述一致。

---

## 4. 本地预览

```bash
# 在项目根目录
python dev_server.py 8124 web
# 打开 http://127.0.0.1:8124/
```

- 使用 `web/` 作为根目录，保证相对路径与线上一致；
- 预览时禁用缓存（`dev_server.py` 已设置 `no-store`）；
- 每次内容批次完成后重启服务，避免模块缓存；
- 浏览器检查使用 390/768/1280 三档，记录截图与控制台。

---

## 5. G8-A 发布前评审门

### 5.1 前置条件

- [ ] G0-G7 全部通过，评审报告齐全；
- [ ] R1-R11 全量回归通过；
- [ ] `docs/content-manifest.json` 与代码一致；
- [ ] 备份完成：`backups/web-v2-<date>/`（含 `web/`、`functions/`、描述文件、manifest）；
- [ ] 访问策略确认为私有；
- [ ] 发布产物无密钥、无 docs/backups。

### 5.2 发布步骤

1. `get_context`：确认当前项目、站点目录与运行环境。
2. `get_site`：读取 projectId/siteId、当前 release、访问范围。
3. `get_site_access`：确认私有；若发现公开，先停止发布并修正访问策略，发布动作不负责改权限。
4. 生成新 `actionId`（UUID）；不复用旧 action。
5. `prepare_site`：
   - `projectRoot` 为项目根目录；
   - `webDirectory: "web"`；
   - `functionDirectory: "functions"`、`databaseAccess: "none"`、`spa: true`（本项目的固定输入；漏掉 `functionDirectory` 会把边缘函数从本次 release 中丢掉）；
   - `projectId`/`siteId` 使用既有值；
   - `actionId` 为新值。
6. `get_publish_status`：等待 draft ready / `canPublish: true`；若有 blocker，只修 blocker，不重复 prepare。
7. `publish_site`：发布该 action。
8. 按返回间隔轮询 `get_publish_status`，直到 `published: true`、失败或需要人工处理。
9. 记录 releaseId、发布 URL、时间、actionId 与检查结果。

**禁止**

- 用 `webDirectory: "."`；
- 新建 project/site；
- 为了「先上线」跳过 G8；
- 在 `prepare_site` 输入中夹带密钥或环境变量；
- 发布后直接改线上文件（必须重新走 prepare/publish）。

---

## 6. G8-B 发布后验证

### 6.1 冒烟矩阵

| 检查 | 方法 | 预期 |
| --- | --- | --- |
| 首页 | 打开站点根路径 | 总览正常；无白屏 |
| 阶段页 | 抽 s0/s6/appendix | 课时列表与项目卡正常 |
| 课时页 | 抽首讲/末讲/AI 讲 | 块、检查、练习正常 |
| 项目页 | 抽 p0/p6/p-graduation | 里程碑与清单正常 |
| 实验台 | 打开 `#/lab`，发 GET `/health` | 200；JSON 可读 |
| 后端函数 | `/functions/v1/app/health` | 200；service/version 正确 |
| 报告页 | 完成一题后打开 | 统计更新；无报错 |
| 控制台 | 全流程 | 0 错误；无失败资源 |
| 移动端 | 390px | 无横向滚动；抽屉可用 |
| 访问范围 | 退出登录/无痕窗口 | 私有站点不可匿名访问 |

### 6.2 发布后专项

- [ ] 发布 URL 可访问，且是预期站点；
- [ ] `published: true`，release 与本次 action 对应；
- [ ] 站点仍为私有；
- [ ] 旧书签 `#/stage/s6`（核心 S6）与 `#/stage/appendix` 均可打开；
- [ ] 旧进度迁移在真实浏览器中生效（用 fixture 或手动造旧数据）；
- [ ] 搜索新关键词命中；
- [ ] 实验台后端与前端同源路径正常；
- [ ] 无 404 的静态资源；
- [ ] 页面标题/描述为新定位。

### 6.3 失败处理

| 现象 | 处理 |
| --- | --- |
| prepare 报 blocker | 只修 blocker；保留 action；必要时同 action 重试 |
| publish 失败 | 停止轮询；报告 safe_message；诊断后再决定新 action |
| 发布成功但页面 404 | 检查 `webDirectory` 与 `index.html` 路径；不要改 project |
| 发布成功但资源 404 | 检查相对路径与文件名大小写；修复后新 action |
| 后端函数 404 | 检查函数是否随站点后端部署；不要改前端绕过 |
| 访问范围变公开 | 立即停止扩散，修正访问策略；发布流程不授权改公开 |
| 线上回归 | 按第 7 节回滚 |

---

## 7. 回滚预案

1. **发布前备份**：`backups/web-v2-<date>/` 保留上一版 `web/`、`functions/`、描述文件与 manifest。
2. **平台回滚优先**：若 Sites 提供上一 release 回滚，使用平台操作；记录 releaseId 与时间。
3. **备份重发**：平台无回滚时，用备份目录作为源，生成新 action，`prepare_site` + `publish_site`；projectId/siteId 不变。
4. **验证回滚**：用 6.1 冒烟矩阵重跑；确认访问范围仍私有。
5. **记录**：回滚原因、影响、时间线、后续修复；写入 `docs/reviews/g8-release.md`。
6. **禁止**：删除站点、重建 project、改公开、用旧 action 冒充新版本。

---

## 8. G8 结论与交付

G8 通过需同时满足：

- G8-A 发布前检查全绿；
- 发布成功且 `published: true`；
- G8-B 冒烟矩阵全绿；
- 访问范围仍为私有；
- 发布记录、回滚预案、截图与命令输出归档。

**产出**

- `docs/reviews/g8-release.md`：回归矩阵结果、发布记录、冒烟结果、残余风险；
- `docs/release-notes-v2.md`：课程结构、45 讲、双轨练习、项目链、AI 质量门槛；
- `backups/web-v2-<date>/`：可回滚快照；
- 线上 URL 与 releaseId。

**残余风险模板**

| 风险 | 影响 | 缓解 | 触发信号 |
| --- | --- | --- | --- |
| Pyodide 首次加载慢 | 首题等待 | loading + 错误提示 | 加载 > 10s |
| 移动端长表格 | 阅读体验 | 横向滚动容器 | 390px 溢出 |
| 旧进度迁移遗漏 | 用户进度丢失 | fixture + 手动验证 | 旧 ID 未映射 |
| 后端函数与静态发布不同步 | 实验台失败 | 发布后检查 `/health` | 404/500 |

---

## 9. 交付判定

以下全部为「是」才算本轮完成：

- [ ] 45 讲全部 `ready`，3400 min，练习与项目齐全；
- [ ] 8 个工具全绿；
- [ ] 路由、判题、进度、迁移、搜索、响应式、可访问性、安全全部通过；
- [ ] G8-A 通过并成功发布；
- [ ] G8-B 冒烟通过，站点私有；
- [ ] 回滚快照与预案可用；
- [ ] 发布记录与 release notes 归档。

任何一项为「否」，不得对外声称「已上线」；只能报告当前状态与阻塞项。
