# 课时规格：m3-container 进程、容器与配置

## 0. 元数据

| 字段 | 值 |
| --- | --- |
| 课时 ID | `m3-container` |
| 标题 | 进程、容器与配置 |
| 所属阶段 | 阶段 4 · 生产化：可观测、性能与交付 |
| 时长 | 80 分钟 |
| 先修 | `m1-cli`（进程、退出码、信号） |
| 对应项目里程碑 | `p-m3-ship-m3` 容器化、`p-m3-ship-m4` CI/CD |

## 1. 出口能力

1. 处理 SIGTERM/SIGINT，做到优雅退出与在途请求排空。
2. 写多阶段、非 root、带健康检查的 Dockerfile。
3. 按环境管理配置与密钥，理解来源与优先级。
4. 解释容器生命周期、探针与重启策略，并能定位 OOMKilled 与信号未送达。

## 2. 学习者起点与常见误解

- 已经知道：`Ctrl-C` 能停止进程、退出码 0 表示成功、Docker 能打包应用。
- 常见误解：
  - 「`docker stop` 会立刻杀掉容器。」——它先发 SIGTERM，等待超时后才 SIGKILL。
  - 「进程收到 SIGTERM 就会立刻退出。」——可以捕获并排空，也可以被忽略。
  - 「健康检查通过就代表能接流量。」——liveness 与 readiness 语义不同。
  - 「密钥放在环境变量最安全。」——环境变量会进进程列表、日志与崩溃转储。
  - 「容器有 CPU limit 就一定有足够算力。」——超限会被节流，延迟升高但利用率看起来不高。

## 3. 范围边界

- 本讲只讲：信号与优雅退出、容器镜像、配置与密钥、探针与资源限制。
- 本讲不讲：Linux IO 内核、反向代理与负载均衡细节（b-linux）、Kubernetes 完整运维。
- 与相邻讲的分工：m1-cli 提供进程基础；本讲把这些知识用于部署；b-linux 深入基础设施。

## 4. 内容块大纲

| # | type | 标题 | 核心论点 |
| --- | --- | --- | --- |
| 1 | analogy | 关闭浏览器标签与服务 SIGTERM | 先停止接新活，再清理在途 |
| 2 | text | 进程生命周期与信号 | SIGTERM 可捕获，SIGKILL 不可；退出码与排空 |
| 3 | code | 优雅退出协调器 | 状态机、幂等、超时强制 |
| 4 | flow | 构建 → 镜像 → 容器 → 探针 → 重启 | 每步的失败现象 |
| 5 | code | 多阶段 Dockerfile | 非 root、健康检查、exec form |
| 6 | table | 配置来源与优先级 | 命令行、环境变量、文件、默认值、密钥 |
| 7 | pitfall | PID 1 不转发信号与密钥进镜像 | 现象、原因、发现、修复、预防 |
| 8 | steps | 容器化 LinkHub API | 构建、探针、优雅退出、回滚 |
| 9 | text（深挖） | cgroups、内存上限与 CPU 节流 | 为 b-linux 埋伏笔，不展开内核 |
| 10 | note | 面试延伸 | 容器里为什么收不到 SIGTERM；如何零中断发布 |

## 5. 概念检查（3 题）

- C1 单选：SIGTERM 与 SIGKILL 的区别。
- C2 多选：Dockerfile 最佳实践。
- C3 单选：配置优先级与密钥管理。

## 6. 代码题：优雅退出协调器

契约：`createShutdown({ server, timeoutMs, onDrain, scheduler })`。

- `scheduler` 注入 `{ setTimeout, clearTimeout }`，默认使用全局定时器；测试用假调度器手动推进。
- `shutdown()` 返回 Promise；状态 `running → draining → closed`；重复调用返回同一 Promise。
- 调用后立即拒绝新请求（`isAccepting()` 为 false）；`server.close` 回调后执行 `onDrain`。
- `onDrain` 成功返回 `{ forced: false }`；抛错返回 `{ forced: false, error }` 并进入 closed。
- 超过 `timeoutMs` 返回 `{ forced: true, reason: 'TIMEOUT' }`，迟到的 close 回调不得再执行排空。
- 状态不可逆；关闭后再次调用返回同一结果。

测试（7）：正常排空；重复调用同一 Promise；超时强制关闭；排空抛错；draining 拒绝新请求；状态不可逆；超时后忽略迟到回调。

Python 差异：`asyncio`、可注入调度器、`state()`/`is_accepting()` 命名；超时与错误用 dict 返回。

## 7. 方案题：部署配置审查

自检清单（10）：多阶段构建；非 root；只读文件系统；健康检查；资源限制；配置优先级；密钥；日志输出；退出码；回滚。

参考要点：镜像不可变；配置外置；密钥不落盘；探针区分 liveness/readiness；关闭顺序为停止接新请求 → 排空 → 关闭依赖。

## 8. 事实清单

| 事实 | registry 对应 |
| --- | --- |
| POSIX 信号：SIGTERM 可捕获，SIGKILL 不可 | 「POSIX 信号」条目，2026-11-09 |
| Docker 多阶段构建与非 root 用户 | 「Docker」条目，2026-11-09 |
| Kubernetes 探针语义（概念级） | 「Kubernetes 探针」条目，2026-11-09 |

## 9. 项目联动

为 `p-m3-ship-m3` 提供：多阶段非 root Dockerfile、健康检查、优雅退出验证；为 `p-m3-ship-m4` 提供镜像摘要与回滚依据。

## 10. 自检

- [x] objectives 4 条；
- [x] blocks 10 个，含类比/两个代码/坑/流程/表格/深挖/面试；
- [x] 3 道检查，含 1 道多选；
- [x] 代码题测试 7 条，solution 全过、starter 失败；
- [x] Python 轨测试数量一致；
- [x] 方案题清单 10 条；
- [x] 不展开 Linux IO 与反向代理。
