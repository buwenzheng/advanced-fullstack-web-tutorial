# 内容 Schema v2

> 本文件是 `web/scripts/content/` 的数据契约。`content/index.js` 的归一化函数、`tools/audit-content.mjs` 的校验规则、`docs/content-manifest.json` 的统计口径都必须与本文一致。字段口径冲突时，以 `docs/curriculum-plan.md` 的目录级字段为准；执行细节以 `docs/implementation/*` 为准。

## 1. 结构

```text
web/scripts/content/
  index.js                 # 合并、归一化、导出查询函数
  graduation.js            # 毕业项目
  stages/<stage>/index.js  # 阶段元数据 + 组装
  stages/<stage>/<lesson>.js
  stages/<stage>/project.js
  stages/<stage>/python.js # PYTHON_BLOCKS / PYTHON_TRACKS
```

- 每讲一个文件，只导出课时对象，不写副作用。
- 阶段 `index.js` 只做导入、阶段元数据与数组组装。
- 项目独立 `project.js`；附录阶段 `project` 为 `null`。
- 课时文件导出名用驼峰（如 `s0L1`、`s0Cli`、`a10`），对象 `id` 与文件名一致。

## 2. 阶段（stage）

```js
{
  id: 's0',                // s0..s7 | appendix
  index: 0,                // 0..8 连续
  title: '…',
  subtitle: '…',
  accent: 'teal',          // 设计系统色名
  duration: 170,           // 必须等于 lessons 时长之和
  goal: '…',
  outcome: ['…'],          // 3-5 条
  keywords: ['…'],
  lessons: [],             // 顺序即展示顺序
  project: null,           // 项目对象或 null
  appendix: true           // 仅 appendix 阶段
}
```

## 3. 课时（lesson）

```js
{
  id: 's0-l1',
  title: '…',
  subtitle: '…',
  duration: 55,
  status: 'draft' | 'ready',   // 缺省视为 ready；骨架必须显式 draft
  objectives: ['…'],           // ready 时 3-4 条
  keywords: ['…'],
  blocks: [],                  // ready 时 8-14 个
  checks: [],                  // ready 时 3 道
  exercises: []                // ready 时至少 1 道可验证练习
}
```

ID 规则：

- 核心课时：`^s[0-7]-(l\d+|cli|schema|perf|resilience|data-scale)$`
- 附录课时：`^a\d+$`
- ID 一经写入 `docs/content-manifest.json` 不可改动；确需改动时先改大纲与清单，再做进度迁移。

## 4. 内容块（block）

允许的类型固定为：`text`、`analogy`、`code`、`table`、`pitfall`、`tip`、`note`、`compare`、`list`、`flow`、`steps`、`case`。除 `case` 外不新增类型；需要新结构时先用现有类型表达。

| type | 必填字段 | 说明 |
| --- | --- | --- |
| `text` | `html` | 正文段落，可带 `title` |
| `analogy` | `html` | 前端类比，可带 `title` |
| `pitfall` | `html` | 常见坑，可带 `title` |
| `tip` | `html` | 实践建议，可带 `title` |
| `note` | `html` | 补充说明，可带 `title` |
| `list` | `items[]` | `ordered?: true` 时渲染为 `ol` |
| `steps` | `steps[{title,html,code?,note?}]` | 有序步骤 |
| `code` | `code` | `lang?`、`title?`、`note?`；JS 块可注入 `python`/`pythonNote` |
| `table` | `head[]`、`rows[][]` | 单元格支持行内 HTML |
| `compare` | `cols[{title,items[]}]` | 并列对比 |
| `flow` | `steps[{name,detail,body?}]` | 可展开的流程节点 |
| `case` | 见下 | 唯一新增块类型 |

### `case`

```js
{
  type: 'case',
  title: '一次线上事故的完整复盘',
  context: '背景与时间线',
  symptom: '用户看到什么、监控看到什么',
  cause: '根因，不是表象',
  fix: '止损与修复',
  prevention: '如何防止再次发生',
  metric: '可观察的指标变化（可选）'
}
```

约束：`title/context/symptom/cause/fix/prevention` 必填且非空；`metric` 可选。

## 5. 检查题（check）

`checks` 只放客观题，`kind: 'mcq'`。

```js
{
  id: 's0-l1-check-1',
  kind: 'mcq',
  type: 'single' | 'multi',   // 缺省 single
  prompt: '…',
  options: [{ text: '…', correct: true }],
  explain: '…'
}
```

- 单选题恰好 1 个 `correct`；多选题至少 2 个 `correct`。
- `explain` 非空，考决策与边界，不考名词。
- 同一课时的 check ID 与 exercise ID 全局唯一。

## 6. 练习（exercise）

`exercises` 是可验证任务，`kind` 为 `code`、`sql` 或 `design`。每讲至少 1 道；每个阶段至少 1 道 `design`。

### 6.1 代码题

```js
{
  id: 's0-l1-ex-1',
  kind: 'code',
  title: '…',
  brief: '…',                 // 题面，支持 HTML
  starter: 'function solve() {\n  // TODO\n}',
  tests: [{ name: '正常输入', code: 'assert.equal(solve(1), 2);' }],
  solution: 'function solve() { return 2; }',
  hint: '…',
  python: { starter, tests, solution, hint }  // 由 PYTHON_TRACKS 注入
}
```

- `starter/tests/solution` 齐全；测试至少 4 条，覆盖正常、边界、失败。
- `solution` 必须全部通过；`starter` 至少失败 1 条。
- 每道代码题必须有 Python track；进度按 `${task.id}`（Node）与 `${task.id}@py`（Python）分别记录，取 OR 合并。

### 6.2 SQL 题

```js
{
  id: 's1-l2-ex-1',
  kind: 'sql',
  title: '…',
  brief: '…',
  tables: { links: [{ id: 1, code: 'a' }] },
  expected: [{ code: 'a' }],
  solution: 'SELECT code FROM links',
  hint: '…'
}
```

- `tables/expected/solution` 齐全；`solution` 执行结果必须与 `expected` 精确一致。

### 6.3 方案题

```js
{
  id: 's2-l4-ex-2',
  kind: 'design',
  title: '…',
  prompt: '…',
  checklist: ['…'],       // ≥6 条，自评项
  reference: '…'          // 参考要点与反例，非空
}
```

## 7. 项目（project）

```js
{
  id: 'p0',
  stageLabel: '阶段 0 项目',
  title: '…',
  brief: '…',
  goal: '…',
  stack: ['…'],
  steps: ['…'],                              // ≥5
  milestones: [{ id, title, desc, criteria }], // ≥4，criteria 可观察
  deliverables: ['…'],                       // ≥5
  checklist: ['…'],                          // ≥5
  stretch: ['…']
}
```

毕业项目 ID 为 `p-graduation`，里程碑 ID 固定 `m1`…`m11`。

## 8. Python 映射

每个阶段 `python.js` 导出：

```js
export const PYTHON_BLOCKS = {
  's0-l1': [{ code: '…', note: '…' }]   // 按该讲 code 块顺序对齐
};

export const PYTHON_TRACKS = {
  's0-l1-ex-1': { starter: '…', tests: [], solution: '…', hint: '…' }
};
```

- `PYTHON_BLOCKS` 的数组索引对应课时内第 N 个 `code` 块；只对 `lang` 为 `javascript`（或缺省）的块生效。
- 键必须指向存在的课时/练习；不允许多余键。
- 注入由 `content/index.js` 完成，阶段文件不自行改写课时对象。

## 9. 归一化与统计

- `content/index.js` 负责：补 `stageId`、补默认 `title/duration/status`、注入 Python、把 `checks/exercises` 统一为数组、补项目空字段。
- `docs/content-manifest.json` 记录版本、阶段顺序、课时 ID/时长、毕业里程碑数与总计。
- 统计口径：45 讲；核心 32 讲 2510 分钟；附录 13 讲 890 分钟；总计 3400 分钟。
- `tools/content-stats.mjs` 与 `tools/audit-content.mjs` 都以此文件和清单为准。
