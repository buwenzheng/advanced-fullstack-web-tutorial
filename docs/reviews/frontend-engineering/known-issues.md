# 前端工程已知问题

- 更新时间：2026-11-10（E1 交付时）
- 维护方式：阻塞门禁的问题必须修复；不阻塞的问题记录在此，按里程碑计划处理，期间保持现有行为不变。

## KI-1 Runner starter 行为差异（E1 记录，暂不统一）

- **现象**：CLI `tools/lib/js-runner.ts` 与浏览器 Worker 对 `s0-l2-ex-1`、`s1-l3-ex-1`、`s1-schema-ex-1` 的 starter 行为不同；38 道 JS 练习的参考答案在两边都通过。
- **影响**：仅影响「未作答 starter」时的提示结果，不影响答案判定、进度记录或课程语义。
- **原因**：CLI 与 Worker 的沙箱环境/超时/顶层 await 处理历史上不同；统一会改变工具语义，超出 E1「原样迁移」的约束。
- **现状**：E1 只断言答案级输出逐字节一致（`docs/reviews/frontend-engineering/e1/run-js-*.txt`），差异不阻塞 G-E1。
- **计划**：E6 后单独评估统一方案；在此之前不修改两侧 runner。

## KI-2 Python 轨道依赖 Pyodide CDN（v2 既有）

- **现象**：Python 判题通过 Blob Worker `importScripts` 加载 Pyodide 0.29.5，需要网络访问 CDN。
- **影响**：离线或 CDN 不可达时 Python 轨道不可用；JS/SQL 轨道不受影响。
- **现状**：与 v2 行为一致；页面在加载失败时给出错误提示。E1 手动验证包含活性探针（故意失败代码返回真实 `NameError`），可区分环境问题与代码问题。
- **计划**：如需离线能力，在后续版本评估自托管 Pyodide 资源。

## KI-3 SQL 引擎为教学子集（v2 既有）

- **现象**：迷你 SQL 引擎不支持 `PRIMARY KEY` 约束解析、子查询、窗口函数等完整语法；tokenizer/parser 内部使用受控 `any`。
- **影响**：仅影响课程范围外的 SQL 写法；课程与 2 道 SQL 练习的语义与 v2 一致。
- **计划**：不在 E1 扩展语法；若后续课程需要，再补解析能力并同步单测。
