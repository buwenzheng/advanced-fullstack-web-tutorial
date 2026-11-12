# 课时规格：m3-edge 边缘部署、特性开关与全栈可观测性

## 0. 元数据

| 字段 | 值 |
| --- | --- |
| 课时 ID | `m3-edge` |
| 标题 | 边缘部署、特性开关与全栈可观测性 |
| 所属阶段 | 阶段 6 · 全栈集成 |
| 时长 | 80 分钟 |
| 先修 | `m3-cache`（应用缓存）、`m3-otel`（日志/指标/追踪）、`m3-render`（渲染） |
| 对应项目里程碑 | `p-m3-web-m6` |

## 1. 出口能力

1. 设计 CDN/边缘缓存策略，理解 stale-while-revalidate 与个性化的冲突。
2. 识别边缘函数的限制：运行时、CPU 时间、状态、一致性、日志。
3. 用特性开关做灰度与即时回滚，并控制开关债。
4. 用 RUM + 前后端 trace 串联定位端到端问题，定义发布健康度。

## 2. 学习者起点与常见误解

- 已经知道：HTTP 缓存头、Redis 应用缓存、后端日志/指标/追踪、SSR 与 CWV。
- 常见误解：
  - 「CDN 缓存只是个加速开关。」——缓存键与 Vary 决定会不会把个性化内容串给别的用户。
  - 「SWR 期间要同步等刷新。」——SWR 的意义是先返回旧值，后台单飞刷新。
  - 「边缘函数就是小号服务器。」——CPU 时间、状态、日志与冷启动都受限。
  - 「开关加了就完事。」——没有所有者与过期时间的开关会变成永久分支。
  - 「有 RUM 就能定位后端慢。」——RUM 只看到浏览器侧，必须与 traceId 串联。

## 3. 范围边界

- 本讲只讲：边缘缓存、边缘函数限制、特性开关、RUM 与服务端 trace 串联、发布健康度。
- 本讲不讲：Redis 应用缓存（m3-cache）、后端三支柱（m3-otel）、CDN 厂商配置教程。
- 与相邻讲的分工：s3 讲应用层缓存；s4 讲服务端可观测；本讲讲边缘层、发布控制与浏览器侧真实用户数据。

## 4. 内容块大纲

| # | type | 标题 | 核心论点 |
| --- | --- | --- | --- |
| 1 | analogy | 前置仓与店内现做 | CDN 缓存 vs 边缘函数 |
| 2 | text | 边缘缓存层级 | 缓存键、Vary、Cookie 污染、个性化 bypass |
| 3 | code | 边缘缓存决策 | TTL、SWR、单飞刷新、过期回源 |
| 4 | table | 边缘函数限制 | 运行时、CPU、内存、状态、日志、冷启动 |
| 5 | code | 特性开关判定 | 白名单、百分比分桶、租户、kill switch |
| 6 | flow | 发布 → 灰度 → 健康度 → 扩量/回滚 | 每步判定条件 |
| 7 | text | RUM 与服务端 trace | 采集内容、采样、traceparent、端到端分段 |
| 8 | code | RUM 与服务端 trace 合并（跨层） | traceId 对齐、最大缺口、缺失标记 |
| 9 | case | CDN 缓存了个人看板 | 缓存键缺用户维度；修复与预防 |
| 10 | pitfall | 边缘与发布的五个坑 | Set-Cookie 被缓存、Vary 缺失、开关嵌套、RUM 采样偏差、trace 断链 |
| 11 | steps | LinkHub 发布健康度看板 | 指标、阈值、观察窗、回滚条件 |
| 12 | note | 面试延伸 | 用户说「页面慢」，如何用 RUM + trace 定位 |

## 5. 概念检查（3 题）

- C1 单选：个性化页面能否被 CDN 缓存、正确做法。
- C2 多选：特性开关的治理要求。
- C3 单选：有 RUM 但服务端无 trace，先查哪一层。

## 6. 代码题：边缘缓存 + trace 合并（跨层：浏览器 → 服务端）

契约：

- `createEdgeCache({ ttlMs, swrMs, now, load, onRefreshError })`：返回 `{ get, whenIdle }`；`get` 为异步。
  - `age = now() - storedAt`；`age <= ttlMs` → `{ value, state: 'fresh' }`。
  - `ttlMs < age <= ttlMs + swrMs` → 立即返回旧值 `{ value, state: 'stale' }` 并触发一次后台刷新；同一 key 单飞，期间所有请求拿旧值且不再触发。
  - `age > ttlMs + swrMs` → 等待 `load` 返回 `{ value, state: 'miss' }`；失败直接抛出且不写缓存。
  - `bypass` 直接回源并更新缓存，返回 `{ value, state: 'bypass' }`。
  - 刷新成功替换缓存；失败保留旧值、调用 `onRefreshError(error, key)`；失败落定后下一次 stale 可再次触发。
  - `whenIdle()` 返回在所有在途后台刷新落定后 resolve 的 Promise；`now` 可注入，测试不用真实计时器。
- `joinTrace(rum, server)`：`rum = { traceId, lcpMs, marks }`；`server = { traceId, spans: [{ name, startMs, durationMs }] }`。
  - traceId 不匹配或缺失 → `{ traceId, totalMs: null, segments: [], largestGap: null, incomplete: true }`。
  - span 按 `startMs` 升序；`segments = [{ name, startMs, endMs, durationMs }]`。
  - `end = max(最后一个 span 结束, rum.lcpMs)`；`totalMs = end`。
  - 缺口包含开头等待（0 → 第一个 span 起点）、相邻 span 间隙、结尾渲染等待（最后 span 结束 → end）；`largestGap` 取最大值；无 span 时标记 `incomplete: true`。

测试（9）：新鲜命中；SWR 返回旧值并后台刷新；同 key 单飞；SWR 过期回源 miss；bypass；刷新失败保留旧值且可重试；trace 正常合并与总时长；trace 缺失/不匹配标记 incomplete；span 乱序排序。

Python 差异：`asyncio.create_task` 表示后台刷新；`whenIdle()` 用 `asyncio.gather`；`now` 注入；测试用可控 Future 与 `asyncio.sleep(0)`。

## 7. 方案题：LinkHub 发布健康度与边缘策略

自检清单（11）：缓存键；TTL/SWR；个性化；边缘函数职责；开关层级与所有者；灰度比例；健康指标；回滚阈值；RUM 采样；trace 串联；隐私与脱敏。

参考要点：边缘只做可缓存与轻逻辑；个性化必须进入缓存键或 bypass；开关必须有 kill switch 与过期时间；健康度看症状指标；RUM 与服务端用同一 traceId。

## 8. 事实清单

| 事实 | registry 对应 |
| --- | --- |
| SWR 语义来自 RFC 5861 | 「stale-while-revalidate」条目，2026-11-09 |
| 边缘运行时能力差异大 | 「边缘运行时」条目，2026-11-09 |
| traceparent 属于 W3C Trace Context | 「traceparent」条目，2026-11-09 |

## 9. 项目联动

支撑 `p-m3-web-m6`：个性化不进公共缓存；开关可灰度/回滚；RUM 与 trace 可串联；发布健康度可读。

## 10. 自检

- [x] objectives 4 条；
- [x] blocks 12 个，含 analogy/code/flow/table/case/pitfall；
- [x] 3 道检查，含 1 道多选；
- [x] 代码题 9 条测试；
- [x] Python 轨 9 条测试；
- [x] 方案题清单 11 条；
- [x] 不重复 m3-cache 与 m3-otel。
