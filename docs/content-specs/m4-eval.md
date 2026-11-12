# 课时规格：m4-eval AI 功能评估、安全与成本

## 0. 元数据

| 字段 | 值 |
| --- | --- |
| 课时 ID | `m4-eval` |
| 标题 | AI 功能评估、安全与成本 |
| 所属阶段 | 阶段 7 · AI 应用与 AI Coding |
| 时长 | 80 分钟 |
| 先修 | `m4-rag`、`m3-realtime`（Web 安全，仅作边界） |
| 对应项目里程碑 | `p-m4-ai-m5`、`p-m4-ai-m6` |

## 1. 出口能力

1. 建立离线评估集与回归门槛，覆盖事实性、引用、拒答与注入。
2. 识别 LLM-as-judge 偏差，知道何时必须人工抽检。
3. 区分直接/间接提示注入，建立「不可信内容不进指令层」的边界。
4. 用缓存、批量、路由、预算与降级控制成本。

## 2. 起点与误解

- 已经知道：RAG 与工具调用、Web 安全基础、测试与 CI。
- 常见误解：
  - 「评估集全过就上线」——可能分布漂移或评估集泄漏。
  - 「加一句提示词就能防注入」——工具权限与参数校验才是主防线。
  - 「注入只来自用户输入」——网页正文、文档、邮件与工具返回都能携带指令。
  - 「成本只看单次调用」——租户与时间窗口的累计成本才可控。

## 3. 范围边界

- 本讲只讲：离线/在线评估、指标与门槛、LLM-as-judge 偏差、直接/间接注入、工具授权、成本控制。
- 不讲：内容审核产品、法律合规细节、Web 安全基础（m3-realtime）、模型训练。
- 与相邻讲分工：m3-realtime 讲会话、CSRF、CSP；本讲讲 AI 功能的评估、注入与成本。

## 4. 内容块大纲

| # | type | 标题 |
| --- | --- | --- |
| 1 | analogy | 考试与评估集 |
| 2 | text | 离线评估与在线评估 |
| 3 | code | 评估结果汇总与门槛 |
| 4 | table | 评估维度 |
| 5 | case | 评估集全过、线上却翻车 |
| 6 | text | 提示注入 |
| 7 | code | 工具授权 |
| 8 | flow | 不可信内容 → 隔离 → 工具白名单 → 参数校验 → 输出审查 |
| 9 | pitfall | AI 安全的五个坑 |
| 10 | table | 成本控制 |
| 11 | steps | 设计注入测试集 |
| 12 | note | 面试延伸 |

## 5. 概念检查

- C1 单选：评估集全过但线上差，最先怀疑什么。
- C2 多选：间接提示注入的入口。
- C3 单选：模型要求调用危险工具时的正确防线。

## 6. 代码题：评估门槛 + 工具授权

契约：

- `runEvaluation(cases, runner, thresholds)`：
  - 单 case 失败码：`RUNNER_ERROR`、`DISALLOWED_TOOL`、`SHOULD_REFUSE`、`UNEXPECTED_REFUSAL`、`MISSING_CITATION`。
  - 指标：`passRate`、`citationRate`、`refusalAccuracy`、`injectionBlockRate`；后三项分母为 0 时记 1。
  - 四项全部 `>=` 阈值才 `pass: true`；空评估集 `pass: false` 且 `EMPTY_EVALUATION`。
  - 输出 `{ pass, metrics, failures: [{ caseId, code, detail }] }`。
- `authorizeToolCall(call, policy)`：
  - 返回 `{ allowed, reason }`，任何情况都不抛异常。
  - 顺序：工具白名单 → 租户 → 未知字段（含 `sql`/`query`/`where`）→ limit 上限 → metric 白名单。
  - reason ∈ `OK`、`UNKNOWN_TOOL`、`TENANT_MISMATCH`、`ARBITRARY_FIELD`、`LIMIT_EXCEEDED`、`METRIC_NOT_ALLOWED`、`INVALID_ARGUMENT`。

测试（11）：全通过；缺引用；应拒答却回答；注入调用禁止工具；阈值边界；空评估集；正常工具放行；未知工具；跨租户；超行数；任意 SQL 字段。

## 7. 方案题：LinkHub AI 评估与注入测试

自检清单：评估集规模与来源、四类用例、阈值、回归 CI、LLM-as-judge 范围、人工抽检、注入入口、工具权限、PII、租户隔离、成本上限、降级。

## 8. 事实与夹具

- 事实：LLM-as-judge 存在位置/长度/风格偏差；评估集可能泄漏；提示注入没有一句话根治；不同模型鲁棒性不同。
- 夹具：`fixtures/ai/eval-set.js`、`fixtures/ai/injection-corpus.js`、`fixtures/ai/tool-cases.js`。
