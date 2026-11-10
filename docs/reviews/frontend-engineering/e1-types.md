# G-E1 类型与内容模型评审报告

- 阶段：E1 类型与内容模型（在 `e0-baseline` 上）
- 完成时间：2026-11-10
- 标签：`e1-typed`
- 结论：**通过**。内容/状态/引擎/工具完成 TypeScript strict 迁移；内容语义、哈希路由、`localStorage` 契约与判题答案级输出保持不变；66/66 路由冒烟通过，`dist` 无 Zod 运行时。

## 1. 环境与范围

| 项 | 值 |
| --- | --- |
| Node | v22.15.0 |
| npm | 10.9.2 |
| 基础标签 | `e0-baseline` |
| 内容基线哈希 | `f53ef3709599e7801fae93133bec6f9c3434ece3fb54b7491853c963ea24bab3` |
| 权威文档 | `docs/implementation/12-e1-types-and-content.md` |

执行任务卡：T-E1.0 基线证据 → T-E1.1 schema/types → T-E1.2 tools → T-E1.3 内容 TS 化 → T-E1.4 状态层 → T-E1.5 引擎 → T-E1.6 catalog/搜索索引 → T-E1.7 单测 → T-E1.8 门禁。

硬约束均未触碰：`functions/` 相对 `e0-baseline` 无 diff（`git diff --stat e0-baseline -- functions/` 为空）；未改课程内容语义、答案、`#/` 路由、`localStorage` 键（`bff-lab-progress-v1` / `bff-lab-drafts-v1` / `bff-lab-lang-v1`）、迁移正则 `^s6-l([1-6])(?=$|[-@]) → a$1`、版本 2 与 `@py` 规则；未发布；生成物未入库。

## 2. 交付内容

| 交付 | 位置 |
| --- | --- |
| Zod 结构模型与类型事实源 | `web/scripts/content/schema.ts`、`types.ts` |
| 内容装配与语义校验 | `web/scripts/content/sources.ts`、`assemble.ts`、`validate.ts` |
| 内容 TS 化 | 80 个 `.js → .ts`（9 阶段、45 课时、7 夹具、项目/毕业/索引） |
| 状态层 | `web/scripts/state/{store,migrate,lang,progress}.ts` |
| 引擎 | `engine/runner/{protocol,core,js.worker,index}.ts`、`engine/python/{index,harness}.ts`、`engine/sql/index.ts` |
| 工具迁移 | 13 个 `.mjs → .ts`；新增 `tools/{content-dump,validate-content,build-content}.ts` |
| 生成物（gitignored） | `web/generated/{catalog,search-index}.json`；`content:build` 可复现 |
| 单测 | `web/scripts/test/*.test.ts` 9 个文件、82 项 |

`content/index.ts` 公共 API 未变（`curriculum` / `allLessons` / `lessonById` / `stageById` / `stageLabel` / `findProject` / `graduationProject` / `PYTHON_BLOCKS` / `PYTHON_TRACKS`）；JS 导入方改用无扩展名说明符，内部 TS 文件保留 `.js` 说明符。

## 3. 门禁命令与退出码

完整输出：`docs/reviews/frontend-engineering/e1/gates.txt`。

| # | 命令 | 结果 |
| --- | --- | --- |
| 1 | `npm run lint` | exit 0，0 error |
| 2 | `npx tsc --noEmit -p tsconfig.json` | exit 0 |
| 3 | `npx tsc --noEmit -p tsconfig.node.json` | exit 0 |
| 4 | `npm run content:validate` | exit 0；`content ok stages=9 lessons=45 projects=9 checks=135 exercises=79 pythonLessons=34 pythonBlocks=60 pythonTracks=38 duration=3400` |
| 5 | `npx tsx tools/content-snapshot.ts` | `sha256=f53ef370…24bab3`，与 E0 一致 |
| 6 | `diff -u e1/content-before.txt <(content-snapshot)` | exit 0，无差异 |
| 7 | `npx tsx tools/content-dump.ts > e1/content-after.json` + diff | exit 0，无差异 |
| 8 | `npm run audit:content` | exit 0；45 讲，draft=0，errors=0，warnings=0 |
| 9 | `npm run audit:exercises` | exit 0；JS 38 道 failing=0，SQL 2 道 failing=0；starterFailing=38（预期） |
| 10 | `npm run audit:python` | exit 0；38 道 failing=0；starterFailing=38（预期） |
| 11 | `npm run check:links` | exit 0；broken=0 |
| 12 | `npm run check:duplication` | exit 0；pairs=0 |
| 13 | `npm run check:facts` | exit 0；unregistered=0，total=10 |
| 14 | `npm run test:migration` | exit 0；`progress migration ok` |
| 15 | `npm run test` | exit 0；9 文件 / 82 项全绿 |
| 16 | `npm run build` | exit 0；`vite build` 105 模块 |
| 17 | `npx playwright test e2e/smoke.spec.ts --project=chromium` | 66/66 通过，0 控制台错误 |
| 18 | `grep -R "ZodError" dist/assets` | 未命中 |
| 19 | `grep -RE "from \"zod\"\|from 'zod'" dist/assets` | 未命中 |
| 20 | `du -sh dist/assets` | 1.5M |

## 4. 基线与行为对比

### 4.1 内容

- 规范化 JSON（排序键、数组保序）与 E0 `content-before.json` 逐字节一致；哈希 `f53ef370…` 不变。
- 校验统计：9 阶段 / 45 课时 / 9 项目 / 135 检查题 / 79 练习 / 214 题 / 54 里程碑 / 6 模板 / 3400 分钟；Python 34 映射课时 / 60 代码块 / 38 轨道。

### 4.2 判题答案级输出

| 套件 | 证据 | 结论 |
| --- | --- | --- |
| JS 38 道 | `e1/run-js-before.txt` vs `run-js-after.txt` | diff 为空 |
| SQL 2 道 | `e1/run-sql-before.txt` vs `run-sql-after.txt` | diff 为空 |
| Python 38 道 | `e1/run-python-before.txt` vs `run-python-after.txt` | diff 为空 |

浏览器手动验证（`e1/browser-run.txt`）：JS 练习 6/6 通过；Python 轨道 6/6 通过；将答案替换为缺 `import asyncio` 的 starter 后 6/6 失败（`name 'asyncio' is not defined`），证明结果来自真实 Pyodide 执行；恢复后再次 6/6 通过，页面 0 控制台错误。

### 4.3 catalog 与搜索索引

`e1/generated.txt`：

| 产物 | 字节 | gzip | SHA-256（稳定） |
| --- | --- | --- | --- |
| `catalog.json` | 73,160 | 15,282 | `d2ab730d…e63dec` |
| `search-index.json` | 509,581 | 199,467 | `c824dce4…6dbe` |

计数：stages 9 / lessons 45 / projects 9 / tasks 214；搜索文档 63（9 阶段 + 45 课时 + 9 项目）；连续两次生成 SHA-256 一致。体积门禁：catalog ≤32KB、search ≤300KB 均满足。本阶段未接入运行时。

## 5. 测试与覆盖

- `npm run test`：9 个测试文件，82 项全部通过；无未处理 Promise。
- `npx vitest run --coverage`：摘要见 `e1/coverage.txt`。

| 范围 | Stmts | Branch | Funcs | Lines |
| --- | --- | --- | --- | --- |
| runner/** | 93.18% | 83.14% | 96.77% | **98.21%** |
| state/** | 99.27% | 90.62% | 100% | **100%** |
| 合计 | 96.28% | 87.02% | 98.73% | **99.1%** |

覆盖率 include 收敛为 `web/scripts/engine/runner/**/*.ts` 与 `web/scripts/state/**/*.ts`，阈值 lines/functions/statements 85、branches 70；`runner/**` 与 `state/**` 行覆盖均 ≥85%。

## 6. 问题与修复

| 问题 | 处理 |
| --- | --- |
| SQL 引擎 TS 化后约 25 个隐式 any/索引错误 | 仅在 tokenizer/parser/行结构的内部实现使用显式 `any`/`Record<string, any>`，公共 API 保持强类型；文件头注明原因 |
| ESLint：`prefer-rest-params`、`no-new-func`、`no-unused-expressions` | fakeConsole 改 rest 参数；删除多余指令；SQL parser 改纯调用 |
| 文档骨架缺 runner `protocol.ts` | 新增 `runner/protocol.ts`，`core`/`index` 从该文件导入并 re-export 类型 |
| runner-core 测试初版日志级别与断言文案不符 | 以现有 `fmt` 行为为准修正测试期望（字符串原样输出），未改业务代码 |
| `content-validate.test.ts` 使用 `node:fs` 导致应用 tsconfig 失败 | 改为静态 JSON import（应用配置无 Node 类型），测试语义不变 |

与文档的已知偏差（均不改变运行时行为，已由测试与哈希守护）：

1. **schema 增加 `testCaseSchema.async`（可选布尔）**：v2 内容夹具已含 `async` 标记；若 strict schema 拒绝会丢失字段，因此作为附加可选字段保留。
2. **Python 映射不变量调整为「条目数 = JS 代码块数」**：`s4-l3` 含 `dockerfile` 代码块，而旧算法只为 JS 代码块注入 Python；逐块 deepEqual 仍覆盖 34 个映射课时（`content-assemble.test.ts`）。
3. **`design` 的 `brief`/`prompt` 互斥**由语义校验（`validate.ts`）保证，而非结构 schema；schema 测试断言「结构允许」，语义测试断言「拒绝」，两层职责清晰。
4. **阶段输入的课时数组使用 `LessonData[]`**：`stageId` 在装配阶段注入，类型边界在 `assemble.ts` 收口。

## 7. 残余风险

1. **Runner starter 差异（文档要求记录）**：CLI `tools/lib/js-runner.ts` 与浏览器 Worker 对 `s0-l2-ex-1`、`s1-l3-ex-1`、`s1-schema-ex-1` 的 starter 行为不同；38 道题参考答案在两边均通过。E1 只断言答案级一致，不统一二者（统一会改变工具语义）。详见 `known-issues.md`。
2. **Pyodide CDN 依赖**：Python 轨道仍需从 CDN 加载 Pyodide 0.29.5；离线时不可用。该行为与 v2 一致；活性探针可区分「环境失败」与「代码失败」。
3. **SQL 引擎为教学子集**：不支持 `PRIMARY KEY` 约束解析等完整 SQL 语法；内部保留受控 `any`，静态检查弱于其他模块。行为与 v2 相同。
4. **catalog/搜索索引尚未接入运行时**：按计划在 E2/E3 接入；当前仅保证生成确定性与体积门禁。
5. **构建单 chunk 警告**：`dist/assets/index-*.js` 1,417.43 kB（gzip 425.34 kB），Vite 提示 >500 kB。这是 v2 全量单入口的既有形态，E2/E3 路由与视图迁移后拆分。
6. **`starterFailing=38` 属预期**：练习 starter 故意不可通过；审计只要求参考答案 failing=0。

## 8. 提交与标签

| 任务 | 提交 |
| --- | --- |
| T-E1.0 保护性基线与差异夹具 | `be4a84f` |
| T-E1.1 Zod 内容 schema 与类型事实源 | `35d44c0` |
| T-E1.2 tools 迁移 TypeScript/tsx | `706ffdf` |
| T-E1.3 内容 TS 化、装配/语义校验 | `007d156` |
| T-E1.4 状态层迁移 | `fad58cd` |
| T-E1.5 引擎迁移 | `bdff231` |
| T-E1.6 catalog 与搜索索引 | `f6e3281` |
| T-E1.7 单元测试与覆盖率门禁 | `3202b6b` |
| T-E1.8 报告、known-issues、标签 | 本报告所在提交 |

标签：`e1-typed`（指向 T-E1.8 提交）。`v2.0.1` 与 `e0-baseline` 保留。

## 9. 门禁结论

**G-E1 通过。** 静态检查、内容校验与基线哈希、7 项审计、迁移夹具、82 项单测与覆盖率、构建、产物无 Zod、66/66 路由冒烟均满足预期。无阻塞问题；剩余差异与风险已记入 `known-issues.md`，可在 E2 起按计划处理。
