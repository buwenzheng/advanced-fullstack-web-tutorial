# 课时规格：m4-rag RAG、向量检索与工具调用

## 0. 元数据

| 字段 | 值 |
| --- | --- |
| 课时 ID | `m4-rag` |
| 标题 | RAG、向量检索与工具调用 |
| 所属阶段 | 阶段 7 · AI 应用与 AI Coding |
| 时长 | 85 分钟 |
| 先修 | `m4-llm`、`m2-tx`（索引）、`m3-cache`（缓存） |
| 对应项目里程碑 | `p-m4-ai-m2`、`p-m4-ai-m3` |

## 1. 出口能力

1. 解释 embedding、切分、向量索引与相似度，定位召回失败发生在哪一步。
2. 设计关键词 + 向量的混合检索，并在排序前完成租户过滤。
3. 用 rerank、引用与新鲜度让答案可追溯。
4. 区分受限工具与 text-to-SQL，守住不直连生产库、不生成任意 SQL。

## 2. 起点与误解

- 已经知道：SQL 与索引、应用缓存、BFF 聚合。
- 常见误解：
  - 「向量检索一定比关键词好」——精确编号、专有名词仍靠关键词。
  - 「先取 topK 再过滤权限」——会把其他租户文档带进上下文。
  - 「引用到文档就够了」——必须精确到块，否则无法核对。
  - 「让模型写 SQL 更灵活」——不可验证、越权、注入面大。

## 3. 范围边界

- 本讲只讲：embedding 与相似度、切分、pgvector 索引类型、混合检索、rerank、引用、受限工具。
- 不讲：HNSW/IVF 数学推导、模型训练、厂商评测、推理基础设施（b-ai-infra）。
- 与相邻讲分工：m2-tx 讲 B+tree 与索引；本讲讲向量检索与应用层权限；m4-eval 讲评估与注入。

## 4. 内容块大纲

| # | type | 标题 |
| --- | --- | --- |
| 1 | analogy | 图书馆找书 |
| 2 | text | embedding 与相似度 |
| 3 | code | 文档切分 |
| 4 | flow | 文档 → 切分 → 向量 → 索引 → 检索 → rerank → 引用 |
| 5 | table | pgvector / HNSW / IVF |
| 6 | code | 混合检索 |
| 7 | case | 语义搜索召回了其他租户文档 |
| 8 | pitfall | RAG 的五个坑 |
| 9 | compare | 受限工具 vs text-to-SQL |
| 10 | code | 受限统计工具 |
| 11 | steps | LinkHub 问数工具设计 |
| 12 | note | 面试延伸 |

## 5. 概念检查

- C1 单选：权限过滤应放在检索的哪个阶段。
- C2 多选：混合检索的必要性来源。
- C3 单选：问数为什么不应生成任意 SQL。

## 6. 代码题：切分 + 混合检索 + 受限工具

契约：

- `chunkDocument(text, { maxChars = 200, overlap = 40 })`：按句子/段落边界切分，块间重叠，返回 `[{ index, text, start, end }]`，不产生空块，重叠小于 maxChars。
- `hybridSearch({ query, docs, embed, keywordScore, tenantId, topK = 3, weights })`：
  - 先按租户过滤，再补齐 embedding（只对候选集调用 `embed`）。
  - 维度不一致抛 `DIM_MISMATCH`。
  - 余弦相似度与关键词分各自 min-max 归一化；`max === min` 归零。
  - `score = 0.7 * vec + 0.3 * kw`（可配）；按分数降序，同分按 `updatedAt` 降序、`id` 升序。
  - 返回 `[{ id, score, citation: { docId, chunkIndex } }]`；空查询或 `topK <= 0` 返回空数组。
- `runStatTool(call, { allowedMetrics, query, tenantId, maxLimit = 100, maxRangeDays = 90 })`：
  - 校验顺序：工具名 → 租户 → 参数类型与范围 → 指标白名单；失败抛 `TOOL_DENIED` 且带 `reason`。
  - 校验通过前不得调用 `query`。
  - 返回 `{ rows, basis: metric, rangeDays }`，rows 截断到 limit。

测试（12）：切分无空块；重叠正确；租户过滤在排序前；加权；同分按新鲜度；topK；未知指标；范围超限；行数超限；跨租户；正常口径；维度不一致。

Python 差异：`re` 切分；手写余弦；dict 排序；异常带 reason。

## 7. 方案题：LinkHub 语义搜索与问数

自检清单：文档来源与切分、embedding 版本、索引类型与参数、混合权重、rerank、引用格式、新鲜度、权限过滤、工具白名单、口径说明、降级。

## 8. 事实与夹具

- 事实：pgvector 支持 HNSW/IVF；不同 embedding 模型维度与语义空间不同；归一化后余弦与内积等价；HNSW 参数影响召回与内存。
- 夹具：`fixtures/ai/rag-docs.js`、`fixtures/ai/tool-cases.js`。
