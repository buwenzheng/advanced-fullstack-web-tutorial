# 课时规格：m3-otel 日志、指标与追踪

## 0. 元数据

| 字段 | 值 |
| --- | --- |
| 课时 ID | `m3-otel` |
| 标题 | 日志、指标与追踪 |
| 所属阶段 | 阶段 4 · 生产化：可观测、性能与交付 |
| 时长 | 80 分钟 |
| 先修 | `m1-http`（请求链路）、`m3-queue`（异步任务） |
| 对应项目里程碑 | `p-m3-ship-m1` 可观测性 |
| 规格状态 | 已评审，待 M4 正文 |

## 1. 出口能力

1. 用结构化日志与 requestId 还原一次请求经过的服务、数据库与队列。
2. 用 RED/USE 指标体系回答「系统现在怎么样」，而不是堆指标。
3. 用 OpenTelemetry 的 trace/span 串起跨服务调用，并说明采样取舍。
4. 设计低噪声、可执行的告警与 runbook。

## 2. 学习者起点与常见误解

- 已经知道：`console.log`、浏览器 Network 面板、错误监控平台的基本使用。
- 常见误解：
  - 「日志越多越好。」——噪声会淹没信号，还会带来存储成本与 PII 风险。
  - 「平均值能代表延迟。」——平均值掩盖尾延迟，P99 才是用户感知。
  - 「指标标签越多越好。」——userId、URL 等高基数标签会让时间序列爆炸。
  - 「有 trace 就不需要日志。」——trace 看调用形状，日志看上下文与业务字段，二者靠 traceId 关联。
  - 「告警越多越安全。」——没有 runbook 的告警只会制造疲劳。

## 3. 范围边界

- 本讲只讲：后端结构化日志、RED/USE、trace/span、采样、告警设计。
- 本讲不讲：RUM 与前后端 trace 串联（m3-edge）、具体厂商平台配置、日志检索语法。
- 与相邻讲的分工：m3-perf 用这些指标定位瓶颈；m3-edge 讲前端与边缘观测。

## 4. 内容块大纲

| # | type | 标题 | 核心论点 |
| --- | --- | --- | --- |
| 1 | analogy | console.log 与生产可观测性 | 前端错误监控 vs 后端三支柱，类比在共享与成本处失效 |
| 2 | text | 三支柱各答什么问题 | 日志、指标、追踪的分工与成本 |
| 3 | code | 结构化日志与 requestId | JSON 字段、上下文传播、脱敏 |
| 4 | table | RED/USE | Rate/Errors/Duration 与 Utilization/Saturation/Errors |
| 5 | code | 指标注册表与分位数 | counter/gauge/histogram、标签排序、P50/P95/P99 |
| 6 | flow | 请求 → span → 日志 → 指标 | traceId/spanId 关联与每步失败表现 |
| 7 | pitfall | 高基数、PII、平均值、告警疲劳 | 现象、原因、发现、修复、预防 |
| 8 | steps | 为跳转接口设计告警 | 症状指标、阈值、持续时间、runbook |
| 9 | text（深挖） | 采样与关联 | head/tail sampling 与成本取舍 |
| 10 | note | 面试延伸 | P99 升高先看哪三个信号 |

必含检查：analogy、code、pitfall、table/flow/steps、深挖、面试延伸均满足。

## 5. 概念检查（3 题）

- C1 单选：P99 升高时优先看哪类信号（延迟分位 + 下游饱和度 + 错误率，而不是平均值）。
- C2 多选：高基数标签、PII、采样、平均值陷阱。
- C3 单选：告警应基于症状还是每个内部指标。

## 6. 代码题：指标注册表与分位数

契约：`createMetrics()` 返回 `{ counter, gauge, histogram, snapshot }`。

- `counter(name, labels)` 每次调用加 1，返回当前值；同 name 不同类型抛错。
- `gauge(name, value)` 覆盖写入，返回 value。
- `histogram(name, value)` 记录一个样本，返回样本数。
- 标签 key 排序稳定：`{b:2,a:1}` 与 `{a:1,b:2}` 是同一条序列。
- `snapshot()` 返回不可变快照；直方图给 `count/sum/p50/p95/p99`，空直方图为 0。
- 分位数用最近秩：`sorted[Math.ceil(p/100*n)-1]`。

测试（≥6）：计数与标签区分；gauge 覆盖；直方图分位；空直方图；类型冲突；快照不可变；标签顺序稳定。

Python 差异：dict + sorted；最近秩索引用 `math.ceil`；快照深拷贝；类型冲突抛 ValueError。

## 7. 方案题：LinkHub 可观测性方案

自检清单（≥6）：日志字段与脱敏；requestId 贯穿；RED 指标；关键 span；采样策略；告警与 runbook；看板；保留期与成本。

参考要点：跳转看 rate/errors/duration 与缓存命中；统计链路看队列深度与消费延迟；告警必须有 runbook 与负责人；日志不含 PII。

## 8. 事实清单

| 事实 | registry 对应 |
| --- | --- |
| OpenTelemetry 提供 trace/metric/log 的数据模型与 API | 「OpenTelemetry」条目，2026-11-09 |
| RED/USE 是方法论，不是标准 | 正文声明，不登记版本 |
| 分位数算法不同实现可能有差异 | 正文写「最近秩为教学口径」 |

## 9. 项目联动

为 `p-m3-ship-m1` 提供：结构化日志字段、requestId、RED 指标、关键 span、看板与告警 runbook。

## 10. 自检

- [x] objectives 4 条；
- [x] blocks 10 个，含类比/代码/坑/表格/流程/深挖/面试；
- [x] 3 道检查，含 1 道多选；
- [x] 代码题测试 7 条，solution 全过、starter 失败；
- [x] Python 轨测试数量一致；
- [x] 方案题清单 8 条；
- [x] 事实已登记；
- [x] 不写 RUM 与厂商配置。
