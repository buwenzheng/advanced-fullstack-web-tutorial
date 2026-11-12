# 课时规格：m4-coding-system AI Coding 的系统模型：任务、上下文与验证

## 0. 元数据

| 字段 | 值 |
| --- | --- |
| 课时 ID | `m4-coding-system` |
| 标题 | AI Coding 的系统模型：任务、上下文与验证 |
| 所属阶段 | 阶段 7 · AI 应用与 AI Coding |
| 时长 | 80 分钟 |
| 先修 | `m3-cicd`（CI/CD）、`m4-eval`（评估与门槛） |
| 对应项目里程碑 | `p-m4-ai-m7` |

## 1. 出口能力

1. 用五层模型（任务/上下文/执行/验证/系统）定位 AI Coding 缺口。
2. 用任务分类矩阵判断该不该交给 AI、交到什么程度。
3. 写最小充分上下文：仓库规则、相关文件、契约、验收测试、负向约束。
4. 用独立证据验证变更，识别测试作弊、范围蔓延与静默行为变更。

## 2. 起点与误解

- 已经知道：测试、CI、代码评审、契约与发布。
- 常见误解：
  - 「AI 说测试通过就是通过」——必须独立执行并检查测试是否被改。
  - 「上下文越多越好」——过期与无关上下文会稀释关键约束。
  - 「任务卡就是提示词」——任务卡是可验收的工程契约。
  - 「大 diff 说明产出多」——范围越大，验证成本与风险越高。

## 3. 范围边界

- 本讲只讲：五层模型、任务矩阵、上下文工程、七步循环、验证门、失败 taxonomy、任务卡。
- 不讲：模型原理、工具评测、万能提示词、具体 IDE/CLI 产品。
- 与相邻讲分工：m4-coding-team 讲团队系统与 Agent 落地；本讲讲个人到团队的控制回路。

## 4. 内容块大纲

| # | type | 标题 |
| --- | --- | --- |
| 1 | analogy | 实习生与资深工程师 |
| 2 | text | 五层模型 |
| 3 | table | 任务分类矩阵 |
| 4 | text | 上下文工程 |
| 5 | flow | 七步循环 |
| 6 | code | AI 变更验证门 |
| 7 | case | 删掉失败测试让 CI 变绿 |
| 8 | pitfall | AI Coding 的五个坑 |
| 9 | table | 失败 taxonomy |
| 10 | steps | 写一份 AI 协作任务卡 |
| 11 | text | 深挖：验证的独立性 |
| 12 | note | 面试延伸 |

## 5. 概念检查

- C1 单选：架构决策在任务矩阵的哪个象限。
- C2 多选：最小充分上下文的组成。
- C3 单选：AI 声称测试通过但 CI 没跑时的正确动作。

## 6. 代码题：AI 变更验证门（跨角色：执行 → 验证）

契约：`reviewAICodeChange(change, policy)` 返回 `{ verdict, findings }`，findings 按严重度降序、同严重度按 code 升序。

- block：`TEST_DELETED`、`TESTS_NOT_RUN`、`TEST_FAILED`、`UNEXPECTED_DEP`、`FORBIDDEN_PATH`、`OUT_OF_SCOPE`、`SECRET_LEAK`。
- warn：`TOO_MANY_FILES`、`DIFF_TOO_LARGE`、`TESTS_SKIPPED`、`BEHAVIOR_CHANGE_WITHOUT_TESTS`、`EMPTY_CHANGE`。
- 密钥模式：私钥块、`sk-`、AWS `AKIA`、GitHub `ghp_`；不做熵检测。
- 空变更判 warn；禁止路径优先于允许路径；验证门不调用模型。

测试（13）：正常通过；删测试；跳过测试；测试失败；新依赖；禁止路径；越界路径；密钥；文件数；行数；排序；空变更；行为变更无测试。

## 7. 方案题：AI 协作任务卡

自检清单：任务分类、目标与非目标、相关文件与契约、验收测试、负向约束、允许修改路径、工具权限、回滚方式、失败记录。

## 8. 事实与夹具

- 事实：LLM 代码失败模式与模型版本相关；不同工具能力边界不同；AI Coding 度量无统一标准；本讲不评价具体工具。
- 夹具：`fixtures/ai/ai-diffs.js`。
