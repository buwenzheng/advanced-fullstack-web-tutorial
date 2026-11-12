# 分块路径重构 · 执行手册（关联度 / 顺序 / 测试 / Review）

> 上级：`docs/implementation/18-track-restructure.md`  
> 用途：回答「这一步改什么、碰谁、为何此时做、测什么、谁审、不过怎么办」。  
> **开码前**：本手册 + 对应批次文档 + `open-decisions` / `preflight-lock` 已齐。

---

## 1. 影响半径分级（排执行序的尺子）

| 级别 | 含义 | 典型改动 | 默认测什么 |
| --- | --- | --- | --- |
| **L0 契约** | 类型/清单形状；学员不可见或几乎不可见 | Zod、`paths.ts`、manifest 结构 | `content:validate`、schema 单测 |
| **L1 身份** | 学员可见 ID、进度键、深链 | lesson/project id、migrate、redirect | migrate 夹具、redirect 测、catalog、单测 |
| **L2 装配** | 加载路径/目录；一错全站空页 | `sources`、STAGE_LOADERS、目录合并 | validate + 打开 `#/lesson/*` + `#/stage/*` |
| **L3 叙事** | 文案承诺与结业定义 | project brief、耦合句、结业映射表 | 耦合扫描、人工抽查、项目页 |
| **L4 导航** | 首页/侧栏/下一讲 | Overview、Sidebar、mastery next | 组件测、axe、budget、E2E shell |
| **L5 收口** | 回归与发布可信度 | verify、视觉、文档 | 全量门禁 + 目标对齐表 |

**排序原则**：先低半径后高半径；同半径内先「被依赖方」后「消费方」；任何任务失败不得跳到更高半径。

```text
L0 ──► L1 ──► L2 ──► L3 ──► L4 ──► L5
R1     R2a    R2b    R3     R4     R5
```

---

## 2. 批次关联矩阵（谁碰谁）

|  | R1 | R2a | R2b | R3 | R4 | R5 |
| --- | --- | --- | --- | --- | --- | --- |
| **输出给下游** | kind/chapters/paths 契约；manifest v3 | 新 lesson/project id；migrate v3；redirect | 块 id 目录与加载；chapters 挂内容 | 自洽 brief；path-completion-map | 路径 UI；activePath | 标签与文档真相 |
| **强依赖上游** | R0 | G-R1 + 计划锁定 | G-R2a | G-R2 | **G-R3** | G-R4 |
| **禁止抢跑** | — | 未锁计划 | 未完成身份 | 未完成目录/ID | 未完成叙事解耦 | 未完成导航 |
| **主要文件面** | schema/manifest/paths/validate | stages 文件名+id、migrate、redirects、generated、specs、e2e routes | stages 目录搬家、sources、STAGE_LOADERS | project.ts、graduation、正文耦合句 | app/pages、Sidebar、mastery | docs、基线、verify 证据 |
| **与判题关系** | 无 | **只改 ID 字符串**；禁无边界替换污染答案 | 无语义 | 可改 brief/html 句；禁改 tests/solution 语义 | 无 | 审计确认未漂 |
| **与进度关系** | 无 | **核心**：v3 remap | 块 id 若写入进度则同步 | 无（除非里程碑 id 文案） | meta.activePath | 夹具回归 |
| **与 UI 关系** | 无强制 | 仅 redirect/空状态 | stage 路由取值 | 项目页徽章/多项目入口 | **核心** | 视觉基线 |

### 2.1 关键「假并行」陷阱

| 若并行… | 会发生 |
| --- | --- |
| R4 ∥ R3 | 路径宣传阶段结业，项目仍写「必须跟 LinkHub」 |
| R2b ∥ R2a | 课新/目录新同时炸，diff 不可审，半截难回滚 |
| R3 文案 ∥ 未稳 ID | 全文二次替换 |
| R5 视觉 ∥ R4 未定 | 基线白刷两次 |

---

## 3. 统一任务卡字段（每张卡必须写全）

执行任何 `T-R*` 前，卡内至少含：

| 字段 | 说明 |
| --- | --- |
| **实现要点** | 具体改哪些文件/字段/算法；禁止含糊「改一下」 |
| **关联任务** | 上游依赖 ID、下游消费者、同批并行禁区 |
| **影响面** | L0–L5；学员是否可见；是否碰进度/判题 |
| **执行序位** | 本批内第几步；为何不能提前 |
| **测试** | 命令 + 预期；单测/夹具/手工至少一类 |
| **Review** | 自检清单 + 报告落点；红灯停止条件 |
| **回滚** | 回到哪一标签/SHA |

模板：`docs/implementation/templates/batch-task.md`（已同步字段）。

---

## 4. 统一测试阶梯（每任务结束至少爬到对应层）

| 层 | 命令/动作 | 适用 |
| --- | --- | --- |
| T0 | `content:validate` | 任何碰 content/manifest |
| T1 | `test:migration` + migrate 单测 | 碰进度/草稿键 |
| T2 | `audit:content`（必要时 `audit:exercises`） | 碰练习/项目/毕业 |
| T3 | 相关 Vitest 文件 | 碰 app/state/content API |
| T4 | `typecheck` | 碰 TS 导出/路径 |
| T5 | Playwright 抽样（非 visual） | 碰路由/重定向/壳 |
| T6 | `npm run verify` + visual/python | **仅 R5**（或显式补基线） |

**规则**：任务声明的影响面决定最低测试层；例如 L1 任务至少到 T1+T3；L4 至少到 T3+T5。

---

## 5. 统一 Review 协议

### 5.1 任务级（每个 T-* 结束）

1. 自检：约束未破（判题语义、键名、路由形态）。  
2. 贴命令退出码到当日笔记或 batch 证据文件。  
3. 若 diff 含「练习 solution/tests 非 ID 变更」→ **立即停**，单独说明。  

### 5.2 门级（G-R*）

1. 按批次文档验收清单逐项勾。  
2. 写 `g-rN-report.md`（或 `g-r2a-report.md`）。  
3. 打标签（或记 SHA）。  
4. **门未过禁止开下一影响半径。**

### 5.3 Review 提问清单（防目标偏移）

- 是否仍服务「路径组合 / 阶段结业 / AI 全栈默认推荐」？  
- E1/X 是否仍非默认强制？  
- 是否借迁移「优化」了答案或机制正文？  
- 下游批次的输入契约是否已更新（例：R3 的 path-completion-map）？

---

## 6. 现行工作区位置（对照）

| 项 | 状态 |
| --- | --- |
| 计划锁定 | 已通过（D1–D4） |
| R2a | **进行中**：身份大体完成；剩 specs 双份、语义抽查、E2E 冒烟等（见 `r2/g-r2a-progress.md`） |
| R2b–R5 | **未开** |

**下一步合法动作**：只允许完成 R2a 剩余债 → 出 `g-r2a-report.md` → 再开 R2b。  
不得跳到 R3/R4「先改文案/导航」。

---

## 7. 各批深链

| 批 | 详细任务卡（含实现/关联/测试） |
| --- | --- |
| R2a/R2b | `docs/implementation/20-r2-id-migration.md` |
| R3 | `docs/implementation/21-r3-project-decouple.md` |
| R4 | `docs/implementation/22-r4-path-navigation.md` |
| R5 | `docs/implementation/23-r5-verify-and-docs.md` |
