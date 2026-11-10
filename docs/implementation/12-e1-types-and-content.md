# E1：类型体系与内容模型（Zod + TS 迁移）

> 上级：`10-frontend-engineering.md` §4、§6 E1、§7、§11-13。
> 目标：为内容、引擎、状态与工具建立单一类型事实源；把 80 个内容文件迁移到 TS；用 Zod 结构校验 + 语义校验锁死内容不变量。运行时行为、URL、`localStorage` 与 v2 完全一致。
> 工期：2–3 人日。完成定义：G-E1 通过，标签 `e1-typed`。

## 1. 阶段边界

### 1.1 本阶段做

- 新增 `web/scripts/content/schema.ts`、`types.ts`、`validate.ts`、`assemble.ts`、`sources.ts`，改造 `index.ts`；
- 80 个内容文件（45 课时 + 9 阶段索引 + 9 Python 映射 + 8 阶段项目 + 毕业项目 + 内容入口 + 7 个 AI 夹具）由 `.js` 改名为 `.ts`，数据载荷不变；
- Python 映射改为构建期严格对齐，并保留旧算法等价性守卫；
- 生成确定性的 `catalog.json` 与 `search-index.json`（本阶段只生成，不消费）；
- 引擎 TS 化：JS runner 拆分核心与 Worker、Python Worker 与 harness 拆分、SQL 引擎类型化；
- 状态 TS 化：`store` / `progress` / `migrate` / `lang` 移入 `state/`；
- `tools/*.mjs` 迁移为 `tools/*.ts`，统一用 `tsx` 运行，输出与 v2 逐行对齐；
- 单元测试：schema、语义校验、内容装配、Python 对齐、迁移夹具、状态、runner、SQL、Python harness。

### 1.2 本阶段不做

- 不写 React 组件、不引入 `main.tsx`、不改路由入口（E2/E3）；
- 不做阶段内容懒加载、不改搜索运行时（E3.5）；
- 不改 `web/scripts/views/*.js`、`web/scripts/app.js`、`web/scripts/ui.js`、`web/scripts/engine/exercise.js` 的业务逻辑，只允许改 import 路径；
- 不改 `web/index.html`、4 个 CSS 文件；
- 不改任何课程语义：标题、时长、顺序、区块文案、选项、答案、测试、练习 ID；
- 不改 hash URL、`localStorage` 键、迁移规则、`@py` 后缀；
- 不统一 JS/Python 两个 runner 对 starter 的语义差异（见 §4.9）；
- 不改 `functions/`、数据库、访问策略；不发布。

### 1.3 本阶段结束时的可运行形态

- v2 界面仍由 `web/index.html` + `app.js` + `views/*.js` 渲染，用户可见行为不变；
- 内容、引擎、状态、工具已是 TS，`npm run build` 通过，66 路由冒烟通过；
- 本地 v2 只通过 Vite（`npm run dev` / `npm run preview`）运行。TS 模块无法被浏览器以原生 ES Module 直接加载，因此「直接打开 `web/index.html`」不再是支持的本地运行方式；线上已发布的 v2 release 是冻结产物，不受影响；
- 不产生 `dist/` 之外的新发布入口，不上传站点。

## 2. 前置条件

| 检查 | 命令 | 通过标准 |
| --- | --- | --- |
| 阶段标签 | `git tag --list e0-baseline` | 输出 `e0-baseline` |
| 工作区 | `git status --short` | 无业务文件改动；仅方案文档可未跟踪 |
| Node | `node -v` | `v22.15.0`（或 ≥22.12 且与 E0 CI 一致） |
| npm | `npm --version` | ≥10 |
| 依赖 | `npm ci` | 0 error |
| E0 门禁 | `npm run verify` | 全绿 |
| Python 工具 | `python --version` | `Python 3.11.x`（`run-python-exercises` 依赖本机 Python） |
| 内容基线 | `node tools/content-snapshot.mjs` | `stages=9 lessons=45 projects=9 checks=135 exercises=79` |

任一项不满足，先停，不进入 E1。若 Node 版本与 E0 不一致，先切回 `22.15.0`，不要用新版本重算哈希。

## 3. 内容事实基线（校验契约）

以下数字来自 v2.0.1 运行时内容的实测值，是 `validate.ts` 与单测的断言目标。E1 不允许它们变化。

### 3.1 总量

| 项 | 值 |
| --- | --- |
| 阶段 | 9（`s0`–`s7` + `appendix`） |
| 课时 | 45 |
| 项目 | 9（8 个阶段项目 + `p-graduation`） |
| 检查题 | 135（90 single + 45 multi） |
| 练习 | 79（38 code + 39 design + 2 SQL） |
| 题目 ID | 214（135 + 79，全局唯一） |
| 里程碑 | 54 |
| 毕业项目模板 | 6 |
| 总时长 | 3400 分钟 |
| 内容文件 | 80 |
| Python 映射课时 | 34 |
| Python 代码块条目 | 60 |
| Python 练习轨道 | 38（覆盖全部 38 道 code 练习） |

### 3.2 阶段分布

| 阶段 | 课时数 | 检查题 | 练习 | 时长 |
| --- | --- | --- | --- | --- |
| `s0` | 3 | 9 | 6 | 170 |
| `s1` | 4 | 12 | 9 | 320 |
| `s2` | 4 | 12 | 8 | 300 |
| `s3` | 4 | 12 | 8 | 340 |
| `s4` | 4 | 12 | 8 | 310 |
| `s5` | 4 | 12 | 8 | 340 |
| `s6` | 4 | 12 | 8 | 330 |
| `s7` | 5 | 15 | 9 | 400 |
| `appendix` | 13 | 39 | 15 | 890 |

### 3.3 结构事实

- 每讲恰好 3 道检查题；练习数分布为 12 讲 × 1 + 32 讲 × 2 + 1 讲 × 3 = 79。
- 检查题：90 道 `single` 固定 4 个选项且恰好 1 个正确；45 道 `multi` 为 4–6 个选项且 3–5 个正确；`prompt === question`；`tag` / `explain` 非空。
- 练习：38 道 `code` 全部有 `hint` 与至少 1 个测试；39 道 `design` 中 32 道只有 `brief`、7 道只有 `prompt`、没有同时有或同时无，2 道带 `specs`；2 道 `sql` 均带 `tables/query/expected/solution/hint`。
- 区块共 491 个，使用 11 种类型（`list` 已实现但当前未使用）：`text 91`、`code 74`、`table 66`、`steps 47`、`analogy 45`、`pitfall 45`、`note 45`、`flow 28`、`case 26`、`compare 21`、`tip 3`。
- 代码块语言仅 4 种：`javascript 69`、`sql 3`、`bash 1`、`dockerfile 1`；74 个代码块都有 `lang` 与 `note`。
- 阶段 `s0`–`s7` 有项目且 `appendix` 项目为 `null`；附录是最后一项且 `index = 8`、`appendix = true`。
- 阶段主题色实际取值：`teal`、`blue`、`violet`、`amber`、`green`、`rose`。
- 所有课时 `status = 'ready'`；所有阶段/课时的数组字段均非空。
- 阶段项目里程碑只含 `id/title/desc/criteria`；毕业项目 11 个里程碑另含 `delivery/acceptance/evidence/reuse/related`。
- `project.templates` 只存在于毕业项目；其余项目没有该字段。

## 4. 关键设计决策

### 4.1 单一类型事实源

`schema.ts` 用 Zod 定义结构，`types.ts` 用 `z.infer` 导出 TS 类型；`assemble.ts`、视图、引擎只消费类型，不复制接口定义。禁止手写与 schema 重复的 `interface Lesson`。

### 4.2 两层校验

1. **结构层（Zod strict）**：未知字段、缺失字段、错误枚举、空字符串、错误判别值直接失败；
2. **语义层（`validate.ts`）**：数量、ID 唯一性、每讲 3 题、选项正确数、时长与清单、Python 对齐、项目引用、里程碑与模板统计。

结构校验不承担业务规则；语义校验不重复类型检查。二者都在 Node/CI 中执行，运行时不执行。

### 4.3 Zod 只在构建与测试期

- `zod` 是 `devDependency`；
- `assemble.ts` 只能 `import type` 自 `types.ts`，不得 import `schema.ts` 或 `zod`；
- `content/index.ts` 不得 import `validate.ts`；
- `verbatimModuleSyntax: true` 已在 E0 开启，类型导入会被擦除；
- G-E1 用 `grep` 证明 `dist/assets` 中不存在 `ZodError` / `zod` 运行时字符串。

### 4.4 类型锚点只放在 19 个入口文件

- 9 个阶段索引：`export const stageN = {...} satisfies StageData;`；
- 9 个 Python 映射：`satisfies PythonBlockMap` / `PythonTrackMap`；
- 1 个毕业项目：`satisfies Project`。

45 个课时文件与 7 个夹具只改扩展名，不加 `satisfies`。它们的结构通过阶段索引的 `lessons` 数组与 `StageData` 逐层检查，避免在 45 个文件里制造无意义 diff。

### 4.5 内容内部 import 保持 `.js` 说明符

文件改名为 `.ts` 后，内部 `from './s6-l1.js'` 不改成无扩展名。TS 5.9（`moduleResolution: bundler`）、Vite、Vitest、`tsx` 都会把 `.js` 说明符解析到同名 `.ts` 文件。这样 80 个文件只发生改名与 19 处锚点修改，最大限度降低内容漂移风险。

旧 JS 文件（`app.js`、`views/*.js`、`engine/exercise.js`）导入已 TS 化的模块时改用无扩展名说明符（如 `../content/index`），因为 JS importer 不参与 TS 扩展名替换。

### 4.6 Python 映射严格对齐 + 旧算法等价守卫

旧 `withPythonBlocks()` 按「所有代码块的位置」取映射，只在语言为 JS 时应用，缺条目会静默跳过。E1 改为：

- 映射课时内的代码块必须全部是 JavaScript；
- 映射条目数必须等于该课 JS 代码块数；
- 每条必须有非空 `code` 与 `note`；
- 38 个 Python 轨道必须与 38 道 code 练习的 ID 集合完全相等。

同时实现一份旧算法（只在 `validate.ts` 与测试中使用），对所有 34 个映射课时逐块比较，证明新算法输出与 v2 完全一致。实测 v2 的 34 个映射课时均为纯 JS 代码块，因此等价性成立。

### 4.7 本阶段保持全量加载

`content/index.ts` 仍在模块初始化时装配全部 45 讲，v2 行为不变。`catalog.json` / `search-index.json` 只生成、不消费；懒加载与搜索索引接入在 E3.5，避免 E1 同时改变数据与加载时机。

### 4.8 引擎迁移保持判题语义

- JS runner：把 Worker 内的断言、日志、异步测试收集逻辑抽到 `runner/core.ts`，Worker 只做消息桥接；断言语义逐字保留（含 `assert.deepEqual` 与 `assert.equal` 等价、`assert.ok` 等价于函数本身、超时 6000ms、无测试时补 `代码执行` 通过项）；
- Python：继续使用 classic Blob Worker + `importScripts` 加载 Pyodide 0.29.5 CDN，因为这是 `importScripts` 唯一受支持的路径；只把 `pythonHarness()` 抽到 `python/harness.ts`；
- SQL：只做类型化与目录调整，词法/语法/执行/NULL/大小写语义不变。

### 4.9 已知的 runner 差异不修

CLI `tools/lib/js-runner.mjs` 与浏览器 Worker 对 3 道题的 starter 行为不同：`s0-l2-ex-1`、`s1-l3-ex-1`、`s1-schema-ex-1`。38 道题的参考答案在两边都通过。E1 不统一两者（统一会改变工具语义），只断言「答案级一致」，并把差异记入 `docs/reviews/frontend-engineering/known-issues.md`。

### 4.10 工具先于内容迁移

为了让每一步都可运行，任务顺序调整为：schema → 工具 `tsx` 化 → 内容改名 → 状态 → 引擎 → 生成物 → 单测。若先改内容，E0 的 `.mjs` 工具会因导入 `.js` 失败而失去校验能力。

## 5. 目标结构

```text
web/scripts/
  content/
    schema.ts                 # 新增：Zod 结构（12 类区块、题目、课时、阶段、项目）
    types.ts                  # 新增：z.infer 类型 + 运行时派生类型
    validate.ts               # 新增：语义校验 + 旧 Python 算法等价守卫
    assemble.ts               # 新增：装配、注入 stageId、严格 Python 对齐
    sources.ts                # 新增：9 个阶段输入 + 毕业项目
    index.ts                  # 改造：导出 curriculum/allLessons/...（API 不变）
    search.ts                 # 新增：区块文本提取 + 搜索文档生成
    stages/**                 # 80 个文件改名 .js → .ts；数据不变
    graduation.ts
  state/
    store.ts
    progress.ts
    migrate.ts
    lang.ts
  engine/
    runner/
      protocol.ts
      core.ts
      js.worker.ts
      index.ts
    python/
      index.ts
      harness.ts
    sql/
      index.ts
    exercise.js               # E1 保留，仅改 import
  test/
    content-schema.test.ts
    content-validate.test.ts
    content-assemble.test.ts
    state-migrate.test.ts
    state-store.test.ts
    state-progress.test.ts
    runner-core.test.ts
    sql-engine.test.ts
    python-harness.test.ts
tools/
  content-snapshot.ts
  content-dump.ts             # 新增：规范化内容 JSON，用于前后 diff
  validate-content.ts         # 新增：content:validate 入口
  build-content.ts            # 新增：catalog + search-index
  content-stats.ts
  audit-content.ts
  check-links.ts
  check-duplication.ts
  check-facts.ts
  run-js-exercises.ts
  run-sql-exercises.ts
  run-python-exercises.ts
  test-progress-migration.ts
  lib/content.ts
  lib/js-runner.ts
web/generated/                # gitignored
  catalog.json
  search-index.json
```

## 6. 任务卡

### T-E1.0 保护性基线与差异夹具

- **类型**：validation
- **依赖**：G-E0
- **产出**：
  - `tools/content-dump.ts`
  - `docs/reviews/frontend-engineering/e1/content-before.txt`
  - `docs/reviews/frontend-engineering/e1/content-before.json`
  - `docs/reviews/frontend-engineering/e1/routes-before.txt`
  - `docs/reviews/frontend-engineering/e1/stats-before.txt`
  - `docs/reviews/frontend-engineering/e1/<tool>-before.txt`（其余工具）
- **实现要求**：

`tools/content-dump.ts` 只做一件事：导入 `web/scripts/content/index.js` 的 `curriculum` 与 `graduationProject`，递归排序对象键（数组顺序不变），输出 2 空格缩进 JSON。它不写文件、不计算哈希，输出必须确定。

```ts
import { curriculum, graduationProject } from '../web/scripts/content/index.js';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(source).sort().map((key) => [key, canonical(source[key])]));
  }
  return value;
}

const payload = canonical({ curriculum, graduationProject });
process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
```

- **命令**：

```bash
mkdir -p docs/reviews/frontend-engineering/e1
npx tsx tools/content-dump.ts > docs/reviews/frontend-engineering/e1/content-before.json
node tools/content-snapshot.mjs > docs/reviews/frontend-engineering/e1/content-before.txt
node tools/route-matrix.mjs > docs/reviews/frontend-engineering/e1/routes-before.txt
node tools/content-stats.mjs > docs/reviews/frontend-engineering/e1/stats-before.txt
node tools/audit-content.mjs > docs/reviews/frontend-engineering/e1/audit-content-before.txt 2>&1
node tools/check-links.mjs > docs/reviews/frontend-engineering/e1/check-links-before.txt 2>&1
node tools/check-duplication.mjs > docs/reviews/frontend-engineering/e1/check-duplication-before.txt 2>&1
node tools/check-facts.mjs > docs/reviews/frontend-engineering/e1/check-facts-before.txt 2>&1
node tools/run-js-exercises.mjs > docs/reviews/frontend-engineering/e1/run-js-before.txt 2>&1
node tools/run-sql-exercises.mjs > docs/reviews/frontend-engineering/e1/run-sql-before.txt 2>&1
node tools/run-python-exercises.mjs > docs/reviews/frontend-engineering/e1/run-python-before.txt 2>&1
node tools/test-progress-migration.mjs > docs/reviews/frontend-engineering/e1/migration-before.txt 2>&1
wc -l docs/reviews/frontend-engineering/e1/routes-before.txt
```

- **预期**：

```text
content-before.txt 与 E0 基线哈希相同
stages=9 lessons=45 projects=9 checks=135 exercises=79
66 docs/reviews/frontend-engineering/e1/routes-before.txt
```

- **约束**：本任务只新增一个工具与证据文件，不改 `web/`。
- **证据**：`docs/reviews/frontend-engineering/e1-types.md` §基线。
- **回滚**：删除新增工具与 `e1/` 证据目录。
- **停止条件**：任何前置工具非 0 退出；哈希或计数与 E0 不一致；路由数不是 66。先修基线，不进入迁移。

### T-E1.1 Zod schema 与类型

- **类型**：engine
- **依赖**：T-E1.0
- **产出**：`web/scripts/content/schema.ts`、`web/scripts/content/types.ts`
- **实现要求**：

`schema.ts` 使用 `z.strictObject` 与判别联合，覆盖全部结构与枚举。骨架如下（可展开，但不得放宽为 `z.any()` / `passthrough()`）：

```ts
import { z } from 'zod';

const nonEmpty = z.string().min(1);
const testCaseSchema = z.strictObject({ name: nonEmpty, code: nonEmpty });
const pythonTrackSchema = z.strictObject({
  starter: nonEmpty,
  solution: nonEmpty,
  tests: z.array(testCaseSchema).min(1),
});

const textSchema = z.strictObject({
  type: z.literal('text'), title: nonEmpty, html: nonEmpty, note: nonEmpty.optional(),
});
const analogySchema = z.strictObject({ type: z.literal('analogy'), title: nonEmpty, html: nonEmpty });
const pitfallSchema = z.strictObject({ type: z.literal('pitfall'), title: nonEmpty, html: nonEmpty });
const noteSchema = z.strictObject({ type: z.literal('note'), title: nonEmpty, html: nonEmpty });
const tipSchema = z.strictObject({ type: z.literal('tip'), title: nonEmpty, html: nonEmpty });
const listSchema = z.strictObject({
  type: z.literal('list'), title: nonEmpty,
  items: z.array(nonEmpty).min(1), ordered: z.boolean().optional(),
});
const stepsSchema = z.strictObject({
  type: z.literal('steps'), title: nonEmpty,
  steps: z.array(z.strictObject({
    title: nonEmpty, html: nonEmpty, code: nonEmpty.optional(), note: nonEmpty.optional(),
  })).min(1),
});
const codeSchema = z.strictObject({
  type: z.literal('code'), title: nonEmpty,
  lang: z.enum(['javascript', 'bash', 'sql', 'dockerfile']),
  code: nonEmpty, note: nonEmpty,
  python: nonEmpty.optional(), pythonNote: nonEmpty.optional(),
});
const tableSchema = z.strictObject({
  type: z.literal('table'), title: nonEmpty,
  head: z.array(nonEmpty).min(1), rows: z.array(z.array(z.string())).min(1),
  note: nonEmpty.optional(),
});
const compareSchema = z.strictObject({
  type: z.literal('compare'), title: nonEmpty,
  cols: z.array(z.strictObject({ title: nonEmpty, items: z.array(nonEmpty).min(1) })).min(2),
  note: nonEmpty.optional(),
});
const flowSchema = z.strictObject({
  type: z.literal('flow'), title: nonEmpty,
  steps: z.array(z.strictObject({
    name: nonEmpty, detail: nonEmpty, body: nonEmpty.optional(),
  })).min(1),
});
const caseSchema = z.strictObject({
  type: z.literal('case'), title: nonEmpty,
  context: nonEmpty, symptom: nonEmpty, cause: nonEmpty,
  fix: nonEmpty, prevention: nonEmpty, metric: nonEmpty.optional(),
});

export const blockSchema = z.discriminatedUnion('type', [
  textSchema, analogySchema, pitfallSchema, noteSchema, tipSchema, listSchema,
  stepsSchema, codeSchema, tableSchema, compareSchema, flowSchema, caseSchema,
]);

const optionSchema = z.strictObject({ text: nonEmpty, correct: z.boolean() });
export const checkSchema = z.strictObject({
  id: nonEmpty, kind: z.literal('mcq'), type: z.enum(['single', 'multi']),
  tag: nonEmpty, prompt: nonEmpty, question: nonEmpty,
  options: z.array(optionSchema).min(2), explain: nonEmpty,
});

const exerciseBase = { id: nonEmpty, title: nonEmpty };
const codeExerciseSchema = z.strictObject({
  ...exerciseBase, kind: z.literal('code'), brief: nonEmpty, hint: nonEmpty,
  starter: nonEmpty, solution: nonEmpty,
  tests: z.array(testCaseSchema).min(1),
  python: pythonTrackSchema.optional(),
});
const designExerciseSchema = z.strictObject({
  ...exerciseBase, kind: z.literal('design'),
  brief: nonEmpty.optional(), prompt: nonEmpty.optional(),
  checklist: z.array(nonEmpty).min(1), reference: nonEmpty,
  specs: z.array(z.strictObject({ label: nonEmpty, value: nonEmpty })).min(1).optional(),
});
const sqlValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const sqlRowSchema = z.record(z.string(), sqlValueSchema);
const sqlExerciseSchema = z.strictObject({
  ...exerciseBase, kind: z.literal('sql'), brief: nonEmpty, hint: nonEmpty,
  tables: z.record(z.string(), z.array(sqlRowSchema)),
  query: nonEmpty, expected: z.array(sqlRowSchema), solution: nonEmpty,
});
export const exerciseSchema = z.discriminatedUnion('kind', [
  codeExerciseSchema, designExerciseSchema, sqlExerciseSchema,
]);

export const lessonSchema = z.strictObject({
  id: nonEmpty, title: nonEmpty, subtitle: nonEmpty,
  duration: z.number().int().positive(), status: z.literal('ready'),
  objectives: z.array(nonEmpty).min(1), keywords: z.array(nonEmpty).min(1),
  blocks: z.array(blockSchema).min(1),
  checks: z.array(checkSchema).length(3),
  exercises: z.array(exerciseSchema).min(1).max(3),
});

const milestoneSchema = z.strictObject({
  id: nonEmpty, title: nonEmpty, desc: nonEmpty, criteria: nonEmpty,
  delivery: nonEmpty.optional(), acceptance: z.array(nonEmpty).min(1).optional(),
  evidence: z.array(nonEmpty).min(1).optional(),
  reuse: z.array(nonEmpty).min(1).optional(), related: z.array(nonEmpty).min(1).optional(),
});
const templateSchema = z.strictObject({
  id: nonEmpty, title: nonEmpty, purpose: nonEmpty, when: nonEmpty, body: nonEmpty,
});
export const projectSchema = z.strictObject({
  id: nonEmpty, stageLabel: nonEmpty, title: nonEmpty, brief: nonEmpty, goal: nonEmpty,
  stack: z.array(nonEmpty).min(1), steps: z.array(nonEmpty).min(1),
  milestones: z.array(milestoneSchema).min(1),
  deliverables: z.array(nonEmpty).min(1), checklist: z.array(nonEmpty).min(1),
  stretch: z.array(nonEmpty).min(1),
  templates: z.array(templateSchema).min(1).optional(),
});

export const stageSchema = z.strictObject({
  id: nonEmpty, index: z.number().int().min(0).max(8),
  title: nonEmpty, subtitle: nonEmpty,
  accent: z.enum(['teal', 'blue', 'violet', 'amber', 'green', 'rose']),
  duration: z.number().int().positive(),
  appendix: z.literal(true).optional(),
  goal: nonEmpty, outcome: z.array(nonEmpty).min(1), keywords: z.array(nonEmpty).min(1),
  lessons: z.array(lessonSchema).min(1),
  project: projectSchema.nullable(),
});

const pythonBlockEntrySchema = z.strictObject({ code: nonEmpty, note: nonEmpty });
export const pythonBlockMapSchema = z.record(z.string(), z.array(pythonBlockEntrySchema));
export const pythonTrackMapSchema = z.record(z.string(), pythonTrackSchema);
```

`design` 的「`brief` / `prompt` 有且仅有一个」放在语义校验（§7.2 第 5 条），不放在 schema。原因是 `.superRefine()` 返回 `ZodEffects`，不能作为 `z.discriminatedUnion()` 的成员；结构层只判断字段形状，业务规则归 `validate.ts`。

`types.ts` 只导出类型：

```ts
import type { z } from 'zod';
import type {
  blockSchema, checkSchema, exerciseSchema, lessonSchema,
  projectSchema, stageSchema, pythonBlockMapSchema, pythonTrackMapSchema,
} from './schema.js';

export type Block = z.infer<typeof blockSchema>;
export type Check = z.infer<typeof checkSchema>;
export type Exercise = z.infer<typeof exerciseSchema>;
export type CodeExercise = Extract<Exercise, { kind: 'code' }>;
export type LessonData = z.infer<typeof lessonSchema>;
export type Lesson = LessonData & { stageId: string };
export type Project = z.infer<typeof projectSchema>;
export type StageData = z.infer<typeof stageSchema>;
export type Stage = Omit<StageData, 'lessons'> & { lessons: Lesson[] };
export type PythonBlockMap = z.infer<typeof pythonBlockMapSchema>;
export type PythonTrackMap = z.infer<typeof pythonTrackMapSchema>;

export interface StageInput {
  data: StageData;
  pythonBlocks: PythonBlockMap;
  pythonTracks: PythonTrackMap;
}
```

- **命令**：

```bash
npx tsc --noEmit -p tsconfig.json
npx tsc --noEmit -p tsconfig.node.json
```

- **预期**：0 错误。此时还没有内容引用 schema，仅证明文件自身可编译。
- **约束**：不修改任何内容文件；不把 schema 引入运行时入口。
- **证据**：报告记录两条命令退出码与 schema 行数。
- **回滚**：删除两个新文件。
- **停止条件**：Zod 4 API 与上述写法不兼容；需要放宽 strict 才能编译。先修 schema，不放宽校验。

### T-E1.2 工具迁移到 TS / tsx

- **类型**：engine
- **依赖**：T-E1.1
- **产出**：`tools/**/*.ts`、`tools/lib/content.ts`、`tools/lib/js-runner.ts`、更新后的 `package.json` scripts
- **实现要求**：

1. 13 个 `.mjs` 文件全部改名为 `.ts`（9 个现有 CLI + E0 新增的 `content-snapshot`、`route-matrix` + `tools/lib` 下的 2 个）：

```bash
for file in tools/*.mjs tools/lib/*.mjs; do
  git mv "$file" "${file%.mjs}.ts"
done
```

2. `tools/lib/content.ts` 改为静态导入：

```ts
import { curriculum, graduationProject } from '../../web/scripts/content/index.js';
export const content = { curriculum, graduationProject };
```

其余 `manifest` / `EXPECTED` 读取逻辑保持不变；`ROOT` 仍指向仓库根。

3. 所有相对导入保留 `.js` 说明符（`tsx` 会解析到 `.ts`）；Node 内置模块加 `node:` 前缀。
4. `tools/lib/js-runner.ts` 保持 Node `vm` + Node `assert` 语义，只加类型；不改执行顺序。
5. `package.json` 增加或替换：

```json
{
  "scripts": {
    "content:snapshot": "tsx tools/content-snapshot.ts",
    "audit:content": "tsx tools/audit-content.ts",
    "audit:exercises": "tsx tools/run-js-exercises.ts && tsx tools/run-sql-exercises.ts",
    "audit:python": "tsx tools/run-python-exercises.ts",
    "check:links": "tsx tools/check-links.ts",
    "check:duplication": "tsx tools/check-duplication.ts",
    "check:facts": "tsx tools/check-facts.ts",
    "test:migration": "tsx tools/test-progress-migration.ts"
  }
}
```

`content:validate` 与 `content:build` 的入口文件分别在 T-E1.3 与 T-E1.6 创建，到时再加入 scripts；本任务不引用尚不存在的文件。

- **命令**：

```bash
for tool in content-snapshot route-matrix content-stats audit-content check-links check-duplication check-facts run-js-exercises run-sql-exercises run-python-exercises test-progress-migration; do
  npx tsx "tools/$tool.ts" > "docs/reviews/frontend-engineering/e1/$tool-after-tools.txt" 2>&1
done
npx tsx tools/content-dump.ts > docs/reviews/frontend-engineering/e1/content-after-tools.json
```

- **预期**：每份 `*-after-tools.txt` 与对应 `*-before.txt` 内容一致；`content-after-tools.json` 与 `content-before.json` 逐字节一致。
- **约束**：不改工具的判断逻辑、输出文案与阈值；只改导入方式、类型与运行器。若输出包含耗时/随机值，先在报告中列出差异字段，再做归一化比较；不得直接删除断言。
- **证据**：报告附 12 组 `diff -u` 结论。
- **回滚**：`git revert` 本任务提交。
- **停止条件**：任一工具输出差异无法解释；`tsx` 不能解析 `.js → .ts`；Python 工具在本机不可运行。

### T-E1.3 内容 80 文件 TS 化与装配

- **类型**：engine
- **依赖**：T-E1.2
- **产出**：
  - 80 个 `.ts` 内容文件
  - 19 个类型锚点（9 阶段索引 + 9 Python 映射 + 毕业项目）
  - `web/scripts/content/sources.ts`
  - `web/scripts/content/assemble.ts`
  - `web/scripts/content/validate.ts`
  - 改造后的 `web/scripts/content/index.ts`
  - `tools/validate-content.ts` 与 `content:validate` script
- **实现要求**：

1. 改名并确认总数：

```bash
find web/scripts/content -type f -name '*.js' -print0 | while IFS= read -r -d '' file; do
  git mv "$file" "${file%.js}.ts"
done
find web/scripts/content -type f -name '*.ts' | wc -l
```

预期输出 `80`。

2. 阶段索引加锚点（示例 `stages/s6/index.ts`）：

```ts
import type { StageData } from '../../types.js';
// 原有 import 不变
export const stage6 = {
  // ...原数据逐字不变
} satisfies StageData;
```

`appendix/index.ts` 使用同一类型，`project: null` 与 `appendix: true` 通过 schema。

3. Python 映射加锚点（示例 `stages/s6/python.ts`）：

```ts
import type { PythonBlockMap, PythonTrackMap } from '../../types.js';

export const PYTHON_BLOCKS = {
  // ...原数据逐字不变
} satisfies PythonBlockMap;

export const PYTHON_TRACKS = {
  // ...原数据逐字不变
} satisfies PythonTrackMap;
```

4. `graduation.ts`：

```ts
import type { Project } from './types.js';
export const graduationProject = {
  // ...原数据逐字不变
} satisfies Project;
```

5. 45 个课时文件与 7 个夹具只改扩展名，不加任何类型断言；内部 import 说明符保持 `.js`。
6. 新建 `sources.ts`，复用当前 `index.js` 的 `import * as sN` 模式：

```ts
import * as s0 from './stages/s0/index.js';
// ...s1..s7、appendix
import type { StageInput } from './types.js';

export const stageInputs: StageInput[] = [
  { data: s0.stage0, pythonBlocks: s0.PYTHON_BLOCKS, pythonTracks: s0.PYTHON_TRACKS },
  // ...9 个阶段，顺序必须为 s0,s1,s2,s3,s4,s5,s6,s7,appendix
];
```

7. `assemble.ts` 只允许 `import type`：

```ts
import type { Block, Lesson, LessonData, Project, Stage, StageInput } from './types.js';

export function normalizeProject(project: Project | null): Project | null {
  if (!project) return null;
  return {
    ...project,
    goal: project.goal || '',
    stack: project.stack || [],
    steps: project.steps || [],
    milestones: project.milestones || [],
    deliverables: project.deliverables || [],
    checklist: project.checklist || [],
    stretch: project.stretch || [],
  };
}

function assertAlignment(lessonId: string, blocks: Block[], entries: unknown[]): void {
  const codeBlocks = blocks.filter((block) => block.type === 'code');
  const jsBlocks = codeBlocks.filter((block) => (block.lang ?? 'javascript') === 'javascript');
  if (codeBlocks.length !== jsBlocks.length) {
    throw new Error(`[content] ${lessonId}: Python 映射课时包含非 JS 代码块`);
  }
  if (entries.length !== jsBlocks.length) {
    throw new Error(`[content] ${lessonId}: Python 映射 ${entries.length} 条，JS 代码块 ${jsBlocks.length} 个`);
  }
}

export function assembleContent(inputs: readonly StageInput[]): Stage[] {
  // 按阶段顺序装配；注入 stageId；严格对齐 Python 代码块；注入 Python 轨道
  // 任一映射缺失/多余/空条目直接 throw，不静默跳过
}
```

装配细节：

- 课时 `stageId = stage.id`；
- 仅对 `input.pythonBlocks[lesson.id]` 存在的课时执行 `assertAlignment`；不存在映射的课时跳过；
- 对齐时按代码块顺序注入 `{ python: entry.code, pythonNote: entry.note }`；
- `pythonTracks` 的每个键必须命中一道 `kind === 'code'` 的练习，否则 throw；命中后注入 `python: track`；
- 38 个 code 练习必须全部有轨道，否则 throw；
- 输出对象字段顺序尽量保持 v2（`...lesson, stageId, title, duration, status, blocks, checks, exercises`），但等价性以规范化 JSON 为准。

8. `index.ts` 保持原导出 API 完全不变：

```ts
export const curriculum: Stage[] = assembleContent(stageInputs);
export const allLessons: Lesson[] = curriculum.flatMap((stage) => stage.lessons);
export function lessonById(id: string): Lesson | null { /* ... */ }
export function stageById(id: string): Stage | null { /* ... */ }
export function stageLabel(stage: Stage | null): string { /* ... */ }
export function findProject(id: string): Project | null { /* ... */ }
export const graduationProject: Project = /* normalizeProject(...) */;
export const PYTHON_BLOCKS = /* 合并 9 个阶段 */;
export const PYTHON_TRACKS = /* 合并 9 个阶段 */;
```

9. 新建 `validate.ts`，按 §7.2 实现全部语义规则与旧 Python 算法守卫；新建 `tools/validate-content.ts` 作为 CLI 入口，并加入 script：

```json
{
  "scripts": {
    "content:validate": "tsx tools/validate-content.ts",
    "build": "npm run content:validate && npm run typecheck && vite build"
  }
}
```

`build` 从本任务起强制先校验内容，避免 E2 之后用未校验内容构建。

10. 更新旧 JS 导入方（只改说明符，不改逻辑）：

- `web/scripts/app.js`：`./content/index.js` → `./content/index`；
- `web/scripts/views/lesson.js`、`overview.js`、`project.js`、`report.js`、`stage.js`：`../content/index.js` → `../content/index`。

- **命令**：

```bash
npx tsc --noEmit -p tsconfig.json
npm run content:validate
npx tsx tools/content-dump.ts > docs/reviews/frontend-engineering/e1/content-after.json
diff -u docs/reviews/frontend-engineering/e1/content-before.json docs/reviews/frontend-engineering/e1/content-after.json
npx tsx tools/content-snapshot.ts
npx tsx tools/route-matrix.ts > docs/reviews/frontend-engineering/e1/routes-after.txt
diff -u docs/reviews/frontend-engineering/e1/routes-before.txt docs/reviews/frontend-engineering/e1/routes-after.txt
npm run build
npx playwright test e2e/smoke.spec.ts --project=chromium
```

- **预期**：

```text
tsc 0 错误
content ok stages=9 lessons=45 projects=9 checks=135 exercises=79 pythonLessons=34 pythonBlocks=60 pythonTracks=38 duration=3400
content-before/after 无差异
sha256 与 E0 基线相同
routes 66 行且无差异
66/66 烟测通过，0 控制台错误
```

- **约束**：数据文件不得手工重排字段、改引号、改缩进之外的任何字节；禁止顺手修文案。阶段索引只加类型导入与 `satisfies`。
- **证据**：报告附 `diff` 为空、哈希一致、烟测 66/66。
- **回滚**：`git revert` 本任务提交（一次提交包含全部改名与装配）。
- **停止条件**：`diff` 有任何差异；哈希变化；tsc 报错指向内容字段；66 路由冒烟失败。先修迁移，不改基线。

### T-E1.4 状态层 TS 化

- **类型**：engine
- **依赖**：T-E1.3
- **产出**：
  - `web/scripts/state/store.ts`
  - `web/scripts/state/progress.ts`
  - `web/scripts/state/migrate.ts`
  - `web/scripts/state/lang.ts`
  - 更新后的旧 JS 导入方与 `tools/test-progress-migration.ts`
- **实现要求**：

1. 移动文件：

```bash
mkdir -p web/scripts/state
git mv web/scripts/store.js web/scripts/state/store.ts
git mv web/scripts/progress.js web/scripts/state/progress.ts
git mv web/scripts/migrate.js web/scripts/state/migrate.ts
git mv web/scripts/lang.js web/scripts/state/lang.ts
```

T-E1.3 只改内容目录，状态文件此时仍是 `.js`，因此一次改名并移动。`store.ts` 内部的 `./migrate.js` 说明符保持不变，同目录解析到 `migrate.ts`。

2. 类型模型：

```ts
export interface AnswerRecord {
  picked: number[] | null;
  correct: boolean;
  attempts: number;
  solved: boolean;
}
export interface LessonRecord { done: boolean }
export interface ProjectRecord { m: Record<string, boolean>; note?: string; milestoneNotes?: Record<string, string> }
export interface ProgressState {
  q: Record<string, AnswerRecord>;
  l: Record<string, LessonRecord>;
  p: Record<string, ProjectRecord>;
  meta: { version: 2; startedAt: number };
}
```

以 v2 实际字段为准；`picked` 在选择题里可能是数组，设计题自检可能记录其他结构，先用联合类型覆盖现有写入路径，再用测试锁定。

3. `store.ts` / `progress.ts` / `migrate.ts` / `lang.ts` 的导出名、函数签名、键名、事件顺序保持不变：

- 额外补齐语言类型，供 E2 的 hooks 使用（运行时值不变）：

```ts
export type LanguageId = 'javascript' | 'python';
export const LANGUAGES: ReadonlyArray<{
  id: LanguageId; label: string; short: string; file: string; runtime: string;
}> = [/* 现有两项 */];
export const lang: {
  get(): LanguageId;
  set(value: LanguageId): void;
  subscribe(fn: (value: LanguageId) => void): () => void;
};
```

- 存储键：`bff-lab-progress-v1`、`bff-lab-drafts-v1`、`bff-lab-lang-v1`；
- 迁移：`^s6-l([1-6])(?=$|[-@]) → a$1`，版本 2，幂等，新键优先；
- `@py` 轨道 ID 规则不变；
- `store.get()` 返回同一内存对象，订阅回调收到同一引用。

4. 更新导入：

- `app.js`：`./store.js` → `./state/store`，`./progress.js` → `./state/progress`，`./lang.js` → `./state/lang`；
- `views/blocks.js`、`lesson.js`、`overview.js`、`project.js`、`report.js`、`stage.js`；
- `engine/exercise.js`：`../store.js` → `../state/store`，`../lang.js` → `../state/lang`；
- `tools/test-progress-migration.ts`：`../web/scripts/migrate.js` → `../web/scripts/state/migrate.js`。

- **命令**：

```bash
npx tsc --noEmit -p tsconfig.json
npx tsc --noEmit -p tsconfig.node.json
npm run test:migration
npm run build
npx playwright test e2e/smoke.spec.ts --project=chromium
```

- **预期**：迁移夹具输出 `progress migration ok: ...`；66 路由通过；0 控制台错误。
- **约束**：不改 `localStorage` 键、版本号、迁移正则、`@py` 规则；不改 store 的写入时机。
- **证据**：报告附迁移夹具新旧输出 diff、烟测结果。
- **回滚**：`git revert` 本任务提交。
- **停止条件**：迁移夹具失败；旧进度无法读取；`localStorage` 键变化。

### T-E1.5 引擎 TS 化

- **类型**：engine
- **依赖**：T-E1.4
- **产出**：
  - `web/scripts/engine/runner/protocol.ts`
  - `web/scripts/engine/runner/core.ts`
  - `web/scripts/engine/runner/js.worker.ts`
  - `web/scripts/engine/runner/index.ts`
  - `web/scripts/engine/python/index.ts`
  - `web/scripts/engine/python/harness.ts`
  - `web/scripts/engine/sql/index.ts`
  - 更新 import 的 `web/scripts/engine/exercise.js`
  - 更新 SQL 导入的 `tools/audit-content.ts`、`tools/run-sql-exercises.ts`
- **实现要求**：

1. JS runner：

- `core.ts` 导出 `executeSuite(code: string, tests: string): Promise<RunResult>`，内部逐字保留 v2 的 `fmt`、`fakeConsole`、`deepEqual`、`AssertionError`、`assert.*`、`__run`、`finish` 语义；
- `js.worker.ts` 只做：

```ts
import { executeSuite } from './core.js';
self.onmessage = async (event: MessageEvent<{ code: string; tests: string }>) => {
  self.postMessage(await executeSuite(event.data.code, event.data.tests));
};
```

- `index.ts` 每次运行创建独立 module worker：

```ts
const worker = new Worker(new URL('./js.worker.js', import.meta.url), { type: 'module' });
```

超时 6000ms、terminate、错误回退文案与 v2 一致；
- 删除未使用的 `escapeHtml` 导出（先 `grep -R "escapeHtml" web tools` 确认 0 引用）。

2. Python：

- `harness.ts` 原样迁移 `pythonHarness(tests)`，输出字符串逐字节一致；
- `python/index.ts` 保留经典 Blob Worker + `importScripts(PYODIDE_URL + 'pyodide.js')`，Pyodide 版本 0.29.5 与 CDN 地址不变；
- 导出 `pythonStatus/onPythonStatus/pythonReady/pythonLoadError/warmPython/runPythonTests` 不变；
- `exercise.js` 从 `./python/index` 导入运行时 API，从 `./python/harness` 导入 `pythonHarness`。

3. SQL：

- `sql/index.ts` 只加类型（`SqlValue`、`SqlRow`、`Database`、`QueryOutcome`），不改 tokenizer/parser/执行器；
- 导出 `createDatabase/runQuery/rowsEqual` 不变。

4. 更新 `exercise.js` 导入：

```js
import { runTests } from './runner/index';
import { createDatabase, runQuery, rowsEqual } from './sql/index';
import { runPythonTests, pythonReady, pythonLoadError, warmPython, onPythonStatus } from './python/index';
import { pythonHarness } from './python/harness';
```

`exercise.js` 是 JS importer，全部使用无扩展名说明符；同时删除文件内原有的 `pythonHarness` 函数定义，避免两份实现。

5. 更新工具 SQL 导入路径为 `../web/scripts/engine/sql/index.js`。

- **命令**：

```bash
npx tsc --noEmit -p tsconfig.json
npm run audit:exercises
npm run audit:python
npx tsx tools/run-js-exercises.ts > docs/reviews/frontend-engineering/e1/run-js-after.txt 2>&1
npx tsx tools/run-sql-exercises.ts > docs/reviews/frontend-engineering/e1/run-sql-after.txt 2>&1
npx tsx tools/run-python-exercises.ts > docs/reviews/frontend-engineering/e1/run-python-after.txt 2>&1
diff -u docs/reviews/frontend-engineering/e1/run-js-before.txt docs/reviews/frontend-engineering/e1/run-js-after.txt
diff -u docs/reviews/frontend-engineering/e1/run-sql-before.txt docs/reviews/frontend-engineering/e1/run-sql-after.txt
diff -u docs/reviews/frontend-engineering/e1/run-python-before.txt docs/reviews/frontend-engineering/e1/run-python-after.txt
npm run build
npx playwright test e2e/smoke.spec.ts --project=chromium
```

- **预期**：38 道 JS 答案全过；2 道 SQL 全过；38 道 Python 轨道全过；三份输出 diff 为空；66 路由通过。
- **约束**：不统一 CLI 与浏览器 runner；不改断言文案、超时、并发语义；不改 Pyodide 版本与 CDN。
- **证据**：报告附三份 diff；浏览器内手动跑 1 道 JS 与 1 道 Python 练习的截图或控制台记录（Python 需要网络）。
- **回滚**：`git revert` 本任务提交。
- **停止条件**：任一答案级结果变化；Worker 无法启动；Python CDN 加载失败且无法区分环境问题与代码问题。

### T-E1.6 生成 catalog 与搜索索引

- **类型**：engine
- **依赖**：T-E1.5
- **产出**：
  - `web/scripts/content/search.ts`
  - `tools/build-content.ts`
  - `web/generated/catalog.json`（gitignored）
  - `web/generated/search-index.json`（gitignored）
- **实现要求**：

1. `search.ts` 严格复刻 v2 `app.js` 的 `blockText` 与 `lessonHaystack`：

```ts
export function blockText(block: Block): string {
  const parts: Array<string | undefined> = [
    block.title,
    'html' in block ? block.html : undefined,
    'note' in block ? block.note : undefined,
    'code' in block ? block.code : undefined,
  ];
  if ('items' in block) parts.push(...block.items);
  if ('head' in block) parts.push(...block.head);
  if ('rows' in block) block.rows.forEach((row) => parts.push(...row));
  if ('steps' in block) block.steps.forEach((step) => parts.push(
    'name' in step ? step.name : undefined,
    'title' in step ? step.title : undefined,
    'detail' in step ? step.detail : undefined,
    'body' in step ? step.body : undefined,
    'html' in step ? step.html : undefined,
  ));
  if ('cols' in block) block.cols.forEach((col) => parts.push(col.title, ...col.items));
  if (block.type === 'case') parts.push(block.context, block.symptom, block.cause, block.fix, block.prevention, block.metric);
  return parts.filter(Boolean).join(' ');
}
```

`lessonHaystack` 必须导出并保留 v2 的缓存语义，供 E2 的搜索直接调用：

```ts
const haystackCache = new Map<string, string>();

export function lessonHaystack(lesson: Lesson): string {
  const cached = haystackCache.get(lesson.id);
  if (cached !== undefined) return cached;
  const parts: Array<string | undefined> = [lesson.title, lesson.subtitle, ...(lesson.keywords || [])];
  lesson.blocks.forEach((block) => parts.push(blockText(block)));
  lesson.checks.forEach((check) => parts.push(check.prompt || check.question, check.explain, ...check.options.map((option) => option.text)));
  lesson.exercises.forEach((exercise) => parts.push(exercise.title, exercise.brief, exercise.prompt));
  const text = parts.filter(Boolean).join(' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  haystackCache.set(lesson.id, text);
  return text;
}
```

2. `catalog.json` 形状固定：

```ts
interface Catalog {
  version: 1;
  stages: Array<{ id: string; index: number; title: string; subtitle: string; duration: number; appendix: boolean; lessonCount: number; projectId: string | null; accent: 'teal' | 'blue' | 'violet' | 'amber' | 'green' | 'rose' }>;
  lessons: Array<{ id: string; stageId: string; title: string; subtitle: string; duration: number; status: string; keywords: string[]; checks: number; exercises: number }>;
  projects: Array<{ id: string; stageLabel: string; title: string; milestones: number }>;
  tasks: Array<{ id: string; kind: 'mcq' | 'code' | 'design' | 'sql'; title: string; lessonId: string; stageId: string; python: boolean }>;
}
```

`accent` 取阶段原值；`python` 为 `Boolean(task.kind === 'code' && task.python)`。这两个字段由本阶段生成器一次产出，E3 外壳与掌握度直接消费，不再改契约。

3. `search-index.json` 是 63 条文档（9 阶段 + 45 课时 + 9 项目）：

```ts
interface SearchDocument {
  kind: 'stage' | 'lesson' | 'project';
  id: string;
  href: string;
  title: string;
  sub: string;
  text: string;
}
```

- 阶段：`title` + `keywords` 作为 `text`；
- 课时：`lessonHaystack`；
- 项目：`title + brief`；毕业项目额外拼 `stack`。

4. 生成器输出字节数与原/ gzip 大小：

```ts
console.log(`catalog bytes=${catalogBytes} gzip=${catalogGzip}`);
console.log(`search bytes=${searchBytes} gzip=${searchGzip}`);
```

5. `build-content.ts` 必须幂等：连续跑两次，两个文件的 SHA-256 相同。
6. `.gitignore` 已包含 `web/generated/`（E0 已修正）；不得提交生成物。
7. 加入生成入口：

```json
{
  "scripts": {
    "content:build": "tsx tools/build-content.ts"
  }
}
```

`build` 暂不串联 `content:build`（E2 的入口还不消费生成物）；E3 接入懒加载时再把 `content:build` 加入 `build` 与 `dev:next`。

- **命令**：

```bash
npm run content:build
sha256sum web/generated/catalog.json web/generated/search-index.json > /tmp/gen1.txt
npm run content:build
sha256sum web/generated/catalog.json web/generated/search-index.json > /tmp/gen2.txt
diff -u /tmp/gen1.txt /tmp/gen2.txt
node -e "const c=require('./web/generated/catalog.json'); console.log(c.stages.length,c.lessons.length,c.projects.length,c.tasks.length)"
node -e "const c=require('./web/generated/catalog.json'); console.log(c.stages.every(s=>s.accent), c.tasks.every(t=>typeof t.python==='boolean'))"
node -e "console.log(require('./web/generated/search-index.json').length)"
```

- **预期**：

```text
9 45 9 214
true true
63
catalog gzip ≤ 32KB；search gzip ≤ 300KB（实测基线约 15KB / 199KB）
两次生成哈希一致
```

- **约束**：本任务不接入运行时；不为了缩小体积删减搜索正文；不改 v2 搜索行为。
- **证据**：报告记录大小、条数、两次哈希。
- **回滚**：删除生成器与 `web/generated/`，恢复 `.gitignore`（若改过）。
- **停止条件**：catalog 条数不是 9/45/9/214；搜索文档不是 63；生成不确定；搜索 gzip 超 300KB。

### T-E1.7 单元测试

- **类型**：validation
- **依赖**：T-E1.6
- **产出**：`web/scripts/test/*.test.ts` 9 个测试文件；必要时更新 `vitest.config.ts` 覆盖率 include
- **实现要求**：

| 文件 | 必测内容 |
| --- | --- |
| `content-schema.test.ts` | 9 个阶段/45 讲/9 项目全部通过 strict schema；未知字段、缺字段、错误枚举、空字符串、design 双字段/无字段被拒绝 |
| `content-validate.test.ts` | 全部语义断言（§7.2）；清单 ID/顺序/时长一致；故障注入逐条报错 |
| `content-assemble.test.ts` | stageId 注入；Python 块注入顺序；缺条目/多条/非 JS 代码块/未命中练习/轨道缺失均 throw；34 个映射课时新旧算法逐块 deepEqual |
| `state-migrate.test.ts` | 迁移现有夹具 + 幂等 + 新旧键碰撞 + 草稿映射 + version 2 |
| `state-store.test.ts` | fake localStorage：读取、写入、订阅、reset、里程碑、项目笔记、损坏 JSON 回退 |
| `state-progress.test.ts` | `@py` 轨道、lessonTasks、isLessonMastered、stage/course mastery |
| `runner-core.test.ts` | assert.equal/deepEqual/strictEqual/throws/rejects/ok；同步与异步测试；console 日志级别；执行异常；无测试时补通过项 |
| `sql-engine.test.ts` | SELECT/WHERE/ORDER/LIMIT/JOIN/GROUP、NULL、大小写、错误；至少覆盖 2 道 SQL 练习 |
| `python-harness.test.ts` | harness 字符串缩进/空行/测试名/`__run` 注册；对 2 个样例逐字节快照 |

- **命令**：

```bash
npm run test
npx vitest run --coverage
```

- **预期**：全部测试通过；`runner/**` 与 `state/**` 行覆盖 ≥85%；无未处理 Promise。
- **约束**：测试只断言现有行为；不为通过测试改业务代码。需要改行为时回到对应任务卡。
- **证据**：报告附测试数、通过数、覆盖率摘要。
- **回滚**：删除测试与覆盖率配置改动。
- **停止条件**：测试暴露 v2 行为缺陷。若阻塞门禁，按总纲 §12.3 最小修复并记录；否则记入 known-issues。

### T-E1.8 G-E1 门禁与交付

- **类型**：validation
- **依赖**：T-E1.7
- **产出**：
  - `docs/reviews/frontend-engineering/e1-types.md`
  - 更新 `docs/reviews/frontend-engineering/known-issues.md`
  - 标签 `e1-typed`
- **执行顺序**：

```bash
# 1. 静态
npm run lint
npx tsc --noEmit -p tsconfig.json
npx tsc --noEmit -p tsconfig.node.json

# 2. 内容
npm run content:validate
npx tsx tools/content-snapshot.ts
diff -u docs/reviews/frontend-engineering/e1/content-before.txt <(npx tsx tools/content-snapshot.ts)
npx tsx tools/content-dump.ts > docs/reviews/frontend-engineering/e1/content-after.json
diff -u docs/reviews/frontend-engineering/e1/content-before.json docs/reviews/frontend-engineering/e1/content-after.json

# 3. 审计
npm run audit:content
npm run audit:exercises
npm run audit:python
npm run check:links
npm run check:duplication
npm run check:facts
npm run test:migration

# 4. 单测与构建
npm run test
npm run build

# 5. 路由与资源
npx playwright test e2e/smoke.spec.ts --project=chromium
grep -R "ZodError" dist/assets && exit 1 || true
grep -R "from \"zod\"\|from 'zod'" dist/assets && exit 1 || true
du -sh dist/assets
```

- **预期**：

```text
lint 0 error
tsc 两份配置均 0
content ok stages=9 lessons=45 projects=9 checks=135 exercises=79 pythonLessons=34 pythonBlocks=60 pythonTracks=38 duration=3400
快照与 E0 完全一致
content-before/after 无 diff
审计 0 error
单测全绿；覆盖率达标
66/66 烟测通过；0 控制台错误
dist 中无 Zod 运行时
```

- **报告必须包含**：环境、命令与退出码、基线对比、测试与覆盖、浏览器烟测、问题与修复、残余风险（至少记录 runner starter 差异）、门禁结论、提交哈希。
- **标签**：

```bash
git tag -a e1-typed -m "E1 类型与内容模型：Zod/TS 内容、引擎、状态与工具迁移"
```

- **约束**：不发布；不修改 `functions/`；不把生成物提交入库。
- **停止条件**：任一门禁失败；内容哈希变化；66 路由失败；dist 出现 Zod。

## 7. 校验器规则明细

### 7.1 `validate.ts` 输入输出

```ts
export interface ContentStats {
  stages: number; lessons: number; projects: number;
  checks: number; exercises: number; tasks: number;
  pythonLessons: number; pythonBlocks: number; pythonTracks: number;
  milestones: number; templates: number; duration: number;
}
export interface ValidationIssue { path: string; message: string }
export function validateContent(
  inputs: readonly StageInput[],
  graduation: Project,
  manifest: unknown,
): { stats: ContentStats; issues: ValidationIssue[] };
```

`tools/validate-content.ts`：

- 读取 `docs/content-manifest.json`；
- 调用 `validateContent`；
- 打印 `content ok ...` 并 `exit 0`，或逐行打印 `path: message` 并 `exit 1`；
- 不写任何文件。

### 7.2 语义不变量

必须逐条实现并单测：

1. 总量：9/45/9/135/79/214/54/6/34/60/38，总时长 3400。
2. 阶段：ID 为 `s0..s7,appendix`；`index` 为 0..8 且唯一；`appendix` 只能是最后一项；`s0..s7` 项目非空，`appendix` 项目为 `null`。
3. 课时：ID 全局唯一；每讲 3 道检查题；练习 1–3 道；时长为正整数；`status` 为 `ready`。
4. 检查题：ID 全局唯一；`single` 恰好 4 个选项且恰好 1 个 `correct`；`multi` 4–6 个选项且 3–5 个 `correct`；至少 1 个错误选项；`prompt === question`；`tag` / `explain` 非空。
5. 练习：ID 全局唯一；`code` 有 hint 和 ≥1 测试；`design` 的 `brief`/`prompt` 有且仅有一个；`sql` 的 `expected` 为数组且 `query`/`solution` 非空。
6. 区块：类型在 12 种内；`table.rows` 每行长度等于 `head` 长度；`compare.cols ≥ 2`；`steps/flow` 非空；代码块语言在 4 种内；`code` 块计数 74。
7. Python：映射键 34；条目 60；轨道 38；映射键必须命中课时；轨道键集合必须等于全部 code 练习 ID 集合；映射课时代码块必须全为 JS；条目数等于 JS 代码块数；`code`/`note` 非空；新旧算法输出逐块一致。
8. 项目：ID 唯一；里程碑 ID 在项目内唯一；毕业项目 11 个里程碑且含 5 个详细字段；阶段项目里程碑只含 4 个基础字段；`templates` 仅毕业项目有，数量 6。
9. 清单：阶段 ID/顺序/时长与 `docs/content-manifest.json` 一致；`totals.lessons=45`、`totals.minutes=3400`、核心与附录时长分别一致。
10. 引用：里程碑 `reuse`（若存在）必须指向已存在的项目 ID；项目 `stack`/`steps` 等不解析 HTML。

### 7.3 旧 Python 算法等价守卫

在 `validate.ts` 中实现仅供校验使用的旧算法：

```ts
function legacyAttach(lesson: LessonData, mapping: Array<{ code: string; note: string }>): Block[] {
  let codeIndex = 0;
  return lesson.blocks.map((block) => {
    if (block.type !== 'code') return block;
    const entry = mapping[codeIndex];
    codeIndex += 1;
    if (!entry || (block.lang || 'javascript') !== 'javascript') return block;
    return { ...block, python: entry.code, pythonNote: entry.note };
  });
}
```

对 34 个映射课时的 `legacyAttach` 结果与 `assembleContent` 结果做 `deepStrictEqual`。任何差异都是迁移错误，不是内容错误。

### 7.4 规范化与哈希

- 内容快照工具与 `content-dump` 使用同一套「递归排序对象键、数组保持顺序」规则；
- 哈希输入为 `{ curriculum, graduationProject }` 的规范化 JSON；
- 换行符统一 `\n`，文件末尾一个换行；
- 不用 `JSON.stringify` 的默认对象顺序直接算哈希，避免字段顺序导致假差异。

## 8. 测试矩阵与覆盖

| 层 | 工具 | 覆盖 | 门禁 |
| --- | --- | --- | --- |
| 结构 | Vitest + Zod | 全量内容、故障注入 | 100% 内容文件解析 |
| 语义 | Vitest | §7.2 十条 | 0 issue |
| 装配 | Vitest | 19 个锚点、34 个映射课时、38 条轨道 | 0 throw（合法内容） |
| 迁移 | Vitest + 脚本 | 旧 ID、草稿、幂等、碰撞 | 全过 |
| 状态 | Vitest | store/progress/lang | 行覆盖 ≥85% |
| Runner | Vitest | 断言、异步、日志、异常 | 行覆盖 ≥85% |
| SQL | Vitest + 工具 | 2 道练习与核心语法 | 2/2 |
| Python | 脚本 + harness 快照 | 38 条轨道 | 38/38（本机 Python） |
| 浏览器 | Playwright 烟测 | 66 路由 | 66/66，0 控制台错误 |

## 9. 风险与对策

| 风险 | 表现 | 对策 |
| --- | --- | --- |
| 改名导致导入失败 | Vite/tsx 解析不到 `.js → .ts` | §4.5 规则；先工具后内容；每步构建 |
| 内容在迁移中漂移 | 字段/转义/顺序变化 | 规范化 JSON diff + 快照哈希 + Zod + 审计四线 |
| Zod 进入运行时 | 入口包变大 | `import type` + `verbatimModuleSyntax` + dist grep |
| 严格 Python 对齐误伤 | 合法内容被拒 | 旧算法等价守卫；34 课时逐块比较 |
| Runner 重构改变判题 | 超时/异步/日志差异 | 核心逐字迁移；38 题答案级 diff；known-issues |
| Worker 打包方式变化 | Vite 产物找不到 worker | module worker + `new URL(..., import.meta.url)`；构建后烟测 |
| 状态类型与旧数据不符 | 读取旧进度报错 | 迁移夹具 + fake localStorage + 宽松读取、严格写入 |
| 工具输出不稳定 | diff 噪音 | 记录允许差异字段；不删断言；确定性输出 |
| 阶段战线过长 | 半成品 | 每任务独立提交；G-E1 后可暂停，v2 仍可构建运行 |

## 10. 回滚与交接

### 10.1 回滚

- 每个任务一个提交；失败时 `git revert <commit>`，不要 `reset --hard`。
- 内容改名与装配在同一个提交内，避免出现「文件已改、入口未改」的中间态。
- 最坏情况回退到 `e0-baseline` 标签；回退前先保存 `docs/reviews/frontend-engineering/e1/` 证据。
- 不删除 v2.0.1 标签与已发布 release。

### 10.2 交给 E2 的输入

E2 开始时必须满足：

- `e1-typed` 标签存在，工作区干净；
- `content/index.ts` 导出 API 与 v2 完全一致，`types.ts` 可供 React 页面直接导入；
- `state/*` 已是 TS，E2 可用 `useSyncExternalStore` 包装；
- `web/generated/` 可重复生成，但 E2 不消费；
- 已知问题清单包含 runner starter 差异；
- 报告明确记录：本阶段未改任何课程语义、未发布、未动 `functions/`。

E2 的第一条命令应是：

```bash
git checkout e1-typed
npm ci
npm run verify
```
