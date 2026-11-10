# T-E4.5 覆盖率阈值与补测

- 日期：2026-11-10
- 环境：Windows 10.0.22631，Node v22.15.0（本轮实测与 `.nvmrc` 一致），Vitest 5.1.0，v8 覆盖率
- 结论：目录级阈值全部通过；`npm run test:coverage` exit 0；`npm test`、`npm run lint`、`npm run typecheck` 均 exit 0。

## 1. 配置变更

`vitest.config.ts` 按 E4 §5.1 落地：

- reporter 增加 `json-summary`，产出 `coverage/coverage-summary.json`；
- include 扩展为 `app` / `engine` / `state` / `content` 四个目录；
- exclude `web/scripts/content/stages/**` 与 `web/scripts/content/**/*.d.ts`；
- 阈值改为目录级：
  - `engine` 85/85/85/70
  - `state` 85/85/85/75
  - `content` 85/85/85/70
  - `app` 60/60/60/55
  - （lines/functions/statements/branches）
- `package.json` 增加 `"test:coverage": "vitest run --coverage"`，未改动其他脚本。

未将 `web/scripts/views/**`、`web/scripts/app.js`、`web/scripts/ui.js` 纳入统计（v2 代码，E5 删除）。

## 2. 门禁执行

首次运行（配置生效、补测前）：

- 命令：`npm run test:coverage`
- 退出码：1
- 实测：25 个测试文件 / 270 个测试通过，但
  - `web/scripts/engine/**` statements 84.25% < 85%（728/864）
  - `web/scripts/content/**` statements 82.64% < 85%（419/507）
- 完整输出：`docs/reviews/frontend-engineering/e4/coverage-before.txt`

补测后复跑：

- 命令：`npm run test:coverage`
- 退出码：0
- 实测：27 个测试文件 / 287 个测试通过，四目录阈值全部通过。
- 完整输出：`docs/reviews/frontend-engineering/e4/coverage-after.txt`

任务卡命令 `node -e "const s=require('./coverage/coverage-summary.json'); console.log(JSON.stringify(s.total,null,2))"` 输出：

```json
{
  "lines": { "total": 2158, "covered": 2027, "pct": 93.92 },
  "statements": { "total": 2558, "covered": 2335, "pct": 91.28 },
  "functions": { "total": 650, "covered": 608, "pct": 93.53 },
  "branches": { "total": 1972, "covered": 1571, "pct": 79.66 },
  "branchesTrue": { "total": 0, "covered": 0, "pct": 100 }
}
```

## 3. 目录覆盖率（补测后实测）

| 目录 | lines | functions | statements | branches | 阈值（L/F/S/B） | 结果 |
| --- | --- | --- | --- | --- | --- | --- |
| `web/scripts/app/**` | 92.46% | 89.66% | 90.51% | 77.40% | 60/60/60/55 | 通过 |
| `web/scripts/content/**` | 95.29% | 100.00% | 89.74% | 78.35% | 85/85/85/70 | 通过 |
| `web/scripts/engine/**` | 94.04% | 96.69% | 91.78% | 81.88% | 85/85/85/70 | 通过 |
| `web/scripts/state/**` | 100.00% | 100.00% | 99.31% | 92.71% | 85/85/85/75 | 通过 |

口径说明：上表按 `coverage/coverage-summary.json` 逐文件 `covered/total` 求和后四舍五入（与阈值检查同源，Vitest 阈值判定即基于汇总值）。Vitest 文本 reporter 的目录行因截断显示会略低（如本次 content statements 文本行 89.62% vs 汇总 89.74%）；`All files` 行与汇总一致（91.28/79.66/93.53/93.92）。

补测前对照（失败项，数字取自首次运行的 Vitest 阈值报错）：

- `content` statements 82.64%（419/507），缺 12 条；
- `engine` statements 84.25%（728/864，Vitest 截断显示），缺 7 条。

## 4. 补测文件清单与断言内容

### 4.1 `web/scripts/test/content-catalog.test.ts`（新增，9 个用例）

验证 `content/build.ts` 与 `content/index.ts` 的实际产物，而非只为执行语句：

- `buildCatalog()` 覆盖 9 阶段 / 45 课时 / 9 项目 / 214 题，所有 ID 唯一；
- 阶段与课时字段逐项与 `curriculum` 对齐（index、标题、时长、appendix、lessonCount、projectId、accent、keywords、题目计数）；
- 检查题映射为 `mcq`（python=false，title=prompt）；练习映射保留 `kind` 与 Python 标记（全部 code 练习均带 Python 轨道）；四类任务数量 135 + 79；
- 8 个阶段项目 + 毕业项目的 ID、stageLabel、里程碑数一致；
- `buildSearchIndex()` 生成 63 条文档（9 阶段 + 45 课时 + 9 项目），href 与 `#/<kind>/<id>` 完全一致；
- 阶段文档 sub/text 使用 `stageLabel` 与关键词；附录前缀为「附录」；课时 text 等于 `lessonHaystack`（同时覆盖缓存命中分支）；毕业项目 text 包含技术栈；
- `stageLabel(null | 普通 | 附录)`、`lessonById` / `stageById` / `findProject` 的命中与未命中路径。

覆盖提升：`content/build.ts` 0/29 → 29/29；`content/index.ts` 14/21 → 21/21；`content/search.ts` 维持 35/36（97.22%），未覆盖分支对应课程内容中未出现的可选块字段（`items` / `body`）。

### 4.2 `web/scripts/test/python-runtime.test.ts`（新增，7 个用例）

用可编程 `FakeWorker` 与 `URL.createObjectURL/revokeObjectURL` 桩驱动 `engine/python/index.ts` 的真实状态机：

- 状态订阅立即回调；`warmPython` 复用同一 Worker；ready 后 `pythonReady()=true`；退订后不再收到通知；
- `runPythonTests` 投递 `{type:'run', id, source}`，payload 解析为 results/logs，空日志行被过滤、缺失字段归一化为空数组；
- `ok:false` 无 error 时回退「Python 执行失败」；坏 JSON 报「Python 返回结果无法解析」；未知 id 被忽略；
- `fatal` 消息拒绝所有挂起任务、终止 Worker、记录 `pythonLoadError`，后续执行直接拒绝；
- `onerror` 有/无 message 分别映射「Python 沙箱异常：…」与「Worker 异常」；
- 加载超时与执行超时给出不同文案，并重置为 idle（回归了 `wasReady` 判断逻辑）；
- Worker 构造抛错时拒绝为「当前浏览器无法创建 Python 沙箱」，warm 后记录不可用原因。

覆盖提升：`engine/python/index.ts` 语句 35/98 → 98/98，分支 9/56 → 48/56；`engine` 目录 statements 84.25% → 91.78%。

### 4.3 `web/scripts/test/runner-core.test.ts`（追加 1 个用例）

- 动态导入 `engine/runner/js.worker.ts`，验证 Worker 入口收到 `{code,tests}` 后执行套件并回传完整 `RunResult`（含日志级别）。
- 覆盖提升：`js.worker.ts` 0/2 → 2/2。

## 5. 未覆盖项与理由（不阻塞门禁）

- `content/validate.ts` 84.14% statements：剩余为防篡改错误分支（如重复题 ID、非法题型、manifest 字段错配）。现有 10 个用例已覆盖每类规则的代表性路径；继续穷举需大量构造脏内容，不属于“业务语义测试”。
- `content/fixtures/ai/injection-corpus.ts` 0/2：该 fixture 当前未被任何运行时模块引用（E3 对等迁移保留下来的语料文件），不写“导入即覆盖”的空断言。
- `content/catalog.ts`、`content/types.ts`、`engine/runner/protocol.ts` 0/0：纯类型/接口，无可执行语句。
- `engine/sql/index.ts` 89.8% statements：剩余为课程范围外的 SQL 语法错误分支（见 KI-3），按 E1 约束不在本阶段扩展语法。
- `app` 目录整体 90.51% statements，阈值 60% 为组件下限；未覆盖项集中在 v2 兼容的错误提示与工具函数分支，不影响门禁。

## 6. 约束核对

- 未添加 `/* v8 ignore */` / `c8 ignore`（全仓库 grep 无匹配）；
- 未下调任何阈值，未缩小 include 范围；
- 新增测试均包含真实断言，无无断言快照；
- v2 代码（views、app.js、ui.js）未纳入统计；
- 未修改业务实现、课程内容、题目 ID、存储键或 URL；
- 未提交 `coverage/` 目录（仅提交摘要证据文本）。

## 7. 残余风险

- 覆盖率按目录聚合，单文件可低于目录阈值（如 `build.ts` 已在补测后达标，但仍可能有新增文件摊薄）；新增代码需同步测试。
- `python-runtime.test.ts` 使用 Worker 桩，真实 Pyodide 加载路径仍依赖 CDN（KI-2）；线上行为由 E6 冒烟覆盖。
- Node 版本：本轮 shell 实测 v22.15.0；若在 v24 环境复跑，覆盖率数值可能因 v8 instrumentation 略有波动，以命令退出码为准。

## 8. 证据文件

- `docs/reviews/frontend-engineering/e4/coverage-before.txt`（补测前，exit 1）
- `docs/reviews/frontend-engineering/e4/coverage-after.txt`（补测后，exit 0）
- 阈值配置 diff：`vitest.config.ts`、`package.json`（本任务提交）
- 补测文件：`web/scripts/test/content-catalog.test.ts`、`web/scripts/test/python-runtime.test.ts`、`web/scripts/test/runner-core.test.ts`
- 提交哈希：见 `docs/reviews/frontend-engineering/e4-quality.md` 阶段报告