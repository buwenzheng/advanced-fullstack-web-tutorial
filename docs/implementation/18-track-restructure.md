# 分块路径重构实施总纲（R0–R5）

> 上级事实源：`docs/curriculum-plan.md`（分块路径版，2026-11-12 定稿）。  
> 本文件是**现行**实施调度依据：回答按什么顺序改仓库、每批做什么、怎么验收、何时停。  
> 历史文档：`00-master-plan.md`（M0–M9 内容重建）、`10-frontend-engineering.md`（E0–E5/E6）仅作背景；与本文件冲突时以本文件 + 课程规划为准。

## 1. 目标与范围

### 1.1 最终交付物

一个仍可静态托管的课程站，目录与导航符合分块路径版规划：

- **4 主修大块** `m1`–`m4`（含 M3/M4 章结构）+ **选修** `e1` + **工具箱** `b` + **可选集成** `x-linkhub`
- 课时/项目 ID 全面语义化；旧 `s*`/`a*`/`p*` 经一次迁移映射
- 首页展示路径 A/B/C/D；侧栏按大块/章节；工具箱按主题分组
- 块内项目自洽；LinkHub 不再绑架主修路径
- `localStorage` **键名不变**（`bff-lab-progress-v1` 等）；结构内 ID 迁移到 meta.version≥3
- hash 路由形态不变：`#/`、`#/stage/:id`、`#/lesson/:id`、`#/project/:id`、`#/lab`、`#/report`；参数值为新 ID；旧 ID 可重定向一版
- 判题语义、练习答案、CSS 类名、`functions/` 不借机改写
- `npm run verify` 全绿；本地视觉与 Python 专项通过

### 1.2 策略

**保留正文与引擎，重组元数据与导航。**

| 对象 | 决策 |
| --- | --- |
| 课时正文/检查/练习 | 保留；改 ID、导出名、文件路径与必要解耦文案 |
| Zod / catalog / 搜索索引 | 扩展大块与 chapter 字段后重建 |
| 进度迁移 | 合并「历史 s6→a」与「本轮全量 remap」 |
| UI | 总览改路径卡片；侧栏改大块树；阶段页支持章 |
| 视觉 | 允许导航区有意变更；更新 Windows 基线，不把「旧线性叙事截图」当永久 oracle |
| 发布 | 随现有 GitHub Pages / `deploy.yml`；不改 `functions/` |

### 1.3 不做的事

- 不新增主修大块、不先扩课（点状加厚另开任务）
- 不重写 45 讲机制正文；不改练习测试语义（除 ID）
- 不引入 Redux/Zustand/Tailwind/新 UI 库
- 不改 `functions/`、`DEMO_SECRET`、运行时依赖集合
- 不在 R2 完成前删除旧 ID 文件（可先双写或一次切换，但夹具必须先绿）
- 不把 E1 改回主修默认路径

## 1.4 目标对齐（防偏移）

本重构服务的产品目标（来自规划，不可在 R 批内改口径）：

| 目标 | 重构后如何体现 | 哪一批负责 | 禁止的偏移 |
| --- | --- | --- | --- |
| 前端 → AI 时代资深全栈 | 路径 C 为默认推荐；M4-Coding 可早学 | R4 导航文案；R3 项目门槛 | 把 AI 又塞回附录/选修默认 |
| 可阶段结业，非一条主线刷完 | 路径 A/B/C/D + 块出口 | R3 项目自洽；R4 路径卡片 | UI 仍暗示必须 S0→S7 |
| E1 选修、X 自愿 | kind=elective；X 三档 | R3 + R4 | 默认路径强制 Outbox/毕业 |
| 机制与判题不漂 | 正文/测试语义冻结 | R2 只改 ID；R5 练习审计 | 借迁移「顺手优化」答案 |
| 交付质量可回归 | verify + 视觉/Python + 迁移夹具 | 每门 G-R*；R5 收口 | 跳过门禁堆下一批 |

**冻结期（R1–R5）**：不增删主修课时、不改路径定义、不加厚（真机部署课、案例扩写等）。目录级变更必须先改 `curriculum-plan.md` 并停当前批。

## 1.5 课程模块 ↔ 工程批次（勿与旧 M0–M9 混淆）

课程大块（规划）：`m1`–`m4`、`e1`、`b`、`x`。  
工程批次（本总纲）：`R0`–`R5`。二者字母无关。

| 课程关系 | 工程上何时落实 |
| --- | --- |
| 块内先修（如 M2←M1） | R4：弱提示；不门锁 |
| M3 两章、M4 两章 | R1 清单 chapters → R2 内容挂章 → R4 展示 |
| M2 双项目、M3 多项目 | R2 改项目 ID；R3 写自洽 brief |
| 路径 C：M1→M4-Coding→… | R1 `paths.ts` → R4 默认/推荐逻辑 |
| E1 / X 非主链 | R3 文案 + R4 徽章；R5 手工矩阵抽查 |
| 工具箱按需 | R2 目录 `b/`；R4 分组侧栏 |

## 2. 批次地图

| 批次 | 名称 | 主要产出 | 依赖 | 评审门 | 预估 |
| --- | --- | --- | --- | --- | --- |
| **R0** | 规划定稿 | `curriculum-plan.md` | — | 已通过 | 已完成 |
| **R1** | Schema 与清单 | 类型/Zod/manifest/装配约定 | R0 | G-R1 | 0.5–1 日 |
| **R2a** | 身份切换 | 课时/项目/题目 ID、migrate v3、重定向、generated、specs 对齐；**阶段目录仍可 s\*** | G-R1 | G-R2a | 1–1.5 日 |
| **R2b** | 目录合并 | `stages/s*`→`m1…b`；stage.id=块 id；sources + STAGE_LOADERS；`kind`/`chapters` 写入内容；p3/p4 物理合并（按开放决策） | G-R2a | G-R2（=R2b 收口） | 0.5–1 日 |
| **R3** | 项目解耦 | 块内项目 brief、去硬耦合文案、X 结业档、路径结业映射表 | G-R2 | G-R3 | 1 日 |
| **R4** | 路径导航 UI | 总览路径、侧栏大块、章标题、下一讲策略 | **G-R3**（串行） | G-R4 | 1–1.5 日 |
| **R5** | 全量验收与文档 | verify、视觉/Python、目标对齐复核、文档 | G-R4 | G-R5 | 0.5–1 日 |

> 对外仍称「R2」；对内执行必须按 **R2a → R2b**。未过 G-R2a 不得开目录合并。

### 2.1 依赖图（质量优先：默认串行）

```text
R0 ──> R1 ──> R2a ──> R2b ──> R3 ──> R4 ──> R5
                 \__________________/
                        合称 R2
```

**为何不并行 R3/R4**：路径卡片与「继续学习」若链到仍写「必须接 LinkHub 主线」的项目 brief，会造成目标叙事自相矛盾。故 **R4 依赖 G-R3**。不允许以「文件不重叠」为由提前画路径 UI。

**顺序理由（防返工）**：

1. R1 先立契约，避免搬家时类型/清单各说各话。  
2. R2a 先统一**内容身份**（学员可见的 lesson/project id），夹具与重定向先绿。  
3. R2b 再并目录与块 id，避免「ID 与文件夹同时炸」无法审 diff。  
4. R3 先解耦项目叙事，再画路径（R4）。  
5. R5 只验收与收口，不开功能。

### 2.2 详细文档索引

| 批次 | 文档 |
| --- | --- |
| 总纲（本文件） | `18-track-restructure.md` |
| **执行手册（关联/顺序/测试/Review）** | [`../reviews/track-restructure/execution-playbook.md`](../reviews/track-restructure/execution-playbook.md) |
| R1 | `19-r1-schema-manifest.md` |
| R2（a/b） | `20-r2-id-migration.md` |
| R3 | `21-r3-project-decouple.md` |
| R4 | `22-r4-path-navigation.md` |
| R5 | `23-r5-verify-and-docs.md` |
| 任务卡模板 | `templates/batch-task.md` |
| 评审报告模板 | `templates/review-report.md` |

证据目录：`docs/reviews/track-restructure/r1/` … `r5/`。

### 2.3 关联度 → 执行序（摘要）

完整矩阵见执行手册。此处只钉死调度规则：

| 影响半径 | 批次 | 未完成时禁止 |
| --- | --- | --- |
| L0 契约 | R1 | 开 R2a |
| L1 身份 | R2a | 开 R2b / 改叙事 UI |
| L2 装配 | R2b | 开 R3（块页按块） |
| L3 叙事 | R3 | 开 R4 |
| L4 导航 | R4 | 开 R5 视觉收口 |
| L5 收口 | R5 | 宣称重构完成 |

每张任务卡必须含：**实现要点、关联上下游、影响面、序位、测试、Review、回滚**（见模板）。

## 3. 统一执行协议

### 3.0 计划锁定（前置门禁）

在开 R2a 功能改动前，必须同时满足：

1. [`docs/reviews/track-restructure/open-decisions.md`](../reviews/track-restructure/open-decisions.md) D1–D4 已填决议。  
2. [`docs/reviews/track-restructure/preflight-lock.md`](../reviews/track-restructure/preflight-lock.md) 全勾。  
3. [`plan-coverage-review.md`](../reviews/track-restructure/plan-coverage-review.md) 二次复核结论已读。

**计划未锁定时禁止**：改 `web/scripts/content/stages/**`、改学员可见 ID、改 `migrate`、改路由重定向、改 `web/generated/**`、为迁 ID 而批量改测试。允许：只改 `docs/**` 计划/评审、补证据摘要。

若发生「未锁定即改码」：立即停码；按 D1 恢复或标注 WIP；修订 G-R* 报告脚注，不得假装门已过。

### 3.1 硬规则

1. **目录级字段只改规划**：增删课时/改路径先改 `curriculum-plan.md`。
2. **一次只推进一个评审门**：门未过不进下一批。
3. **失败即停**：`content:validate`、审计、单测、迁移夹具任一红灯，先修当前批。
4. **兼容契约**：`localStorage` 键名、hash 路由六形态、判题语义、`functions/` 不变。
5. **证据入库**：每批写入 `docs/reviews/track-restructure/rN/`，含命令输出摘要与决策记录。
6. **回滚**：每批打 git 标签；失败回退该标签，不跨批修补。
7. **双装配同改**：凡改阶段/块加载，必须同时核对 `content/sources.ts`（校验装配）与 `app/data/resources.ts` 的 STAGE_LOADERS（运行时懒加载）。

### 3.2 任务卡

执行任务使用 `templates/batch-task.md`，ID 形如 `T-R1.1`、`T-R2.3`。  
缺「关联 / 测试 / Review」字段的任务卡视为**未就绪**，不得开干。

### 3.3 标签约定

| 门 | 标签 |
| --- | --- |
| G-R1 | `r1-schema` |
| G-R2a | `r2a-ids`（可选中间标签） |
| G-R2 | `r2-ids`（**含 R2b**；对外完成标签） |
| G-R3 | `r3-projects` |
| G-R4 | `r4-nav` |
| G-R5 | `r5-track-v1`（本重构完成标签） |

## 4. 评审门摘要

| 门 | 必须通过 |
| --- | --- |
| **G-R1** | Zod/类型含 `kind`/`chapters`；manifest 新结构；策略 A 下内容仍旧 ID 时可 validate；单测 schema 绿；**须打标签或记 SHA** |
| **G-R2a** | 45 讲 lesson/project/题目/python 键为新语义；migrate v3 五类夹具；旧 lesson/project hash 可重定向；manifest lesson/project 与内容一致；generated 重建；audit+相关单测绿；specs 无「只旧不新」；**允许**阶段目录仍为 `s*` |
| **G-R2** | G-R2a + 目录按大块；`sources` 与 STAGE_LOADERS 按 `m1…b`；内容写入 `kind`/`chapters`；stage 路由取值=块 id（旧 stage id 可重定向）；p3/p4 按 D2 完成 |
| **G-R3** | 各块项目 brief 自洽（含先修/非目标）；无 LinkHub 硬耦合句；X 三档；**路径结业映射表**入库；报告/掌握文案不要求学完全部主修 |
| **G-R4** | 四路径；默认推荐路径 C（可配置）；侧栏大块+章；E1/B 语义；下一讲尊重 activePath；弱先修提示不拦截；axe/budget |
| **G-R5** | verify + 视觉 + Python；**目标对齐复核表**（§1.4）全勾；文档一致；known-issues |

### 4.1 质量不变量（跨批，失败即停）

1. 练习 `solution`/`tests` 语义不变（允许只改 ID 字符串）。  
2. `localStorage` 键名三件套不变。  
3. hash 路由六形态不变。  
4. 45 讲 / 3400 min / 检查与练习数量门槛不降。  
5. 路径 A 可不学 E1/X；路径 C 含 M4 两章门槛。  
6. 不引入新运行时依赖与 UI 库。

## 5. 数据模型要点（跨批共识）

```text
TrackBlock (原 Stage 升级)
  id: m1|m2|m3|m4|e1|b
  kind: required | elective | toolbox
  chapters?: [{ id, title, lessonIds[] }]   # m2/m3/m4/b 使用
  lessons[]
  projects?: Project[] | project: Project | null   # m2 可挂两项目；实现时选一：projectIds[] 优先

LearningPath
  id: a|b|c|d
  title, blurb
  steps: [{ blockId, chapterId?, required }]

Lesson / Exercise / Check
  id 改为新语义；其余字段不变
```

装配与懒加载：**按大块**懒加载正文（`m1`…`b`），与现「按 stage」同构，仅 ID 与分桶变化。

题目 ID（**以现网为准**）：检查题 `{lessonId}-check-N`，练习 `{lessonId}-ex-N`；Python 轨道键保留 `@py` 后缀规则，**只替换课时前缀**。历史进度里可能出现 `-c1` / `-e1` 等旧缩写——迁移函数只换前缀，不强制改写后缀形态；新内容禁止再引入 `-c-N` 新口径。

## 6. 风险登记

| 风险 | 缓解 |
| --- | --- |
| 进度丢失 | v3 迁移夹具 + 手工注入旧 JSON 验收 |
| 搜索/报告断链 | R2 后重建 generated；E2E 搜关键词 |
| 视觉大面积红 | R4 明确「导航有意变更」；R5 更新基线并归档前后 SHA |
| R3/R4 并行冲突 | 约定 R3 只动 `content/**` 与项目文案；R4 只动 `app/**` 与文案常量 |
| manifest 与内容漂移 | validate 强制对照 `curriculum-plan` 对照表或生成清单 |

## 7. 工期与人力

合计约 **4–6.5 人日**（熟练单 Agent）。R0 已完成。不包含点状加厚（真机部署档、案例扩写等）。

## 8. 开始条件

### 8.1 R0→R1（历史）

- [x] `docs/curriculum-plan.md` 分块路径版已定稿（R0）
- [x] R1 已执行（见 `r1/g-r1-report.md`）；标签/SHA 仍可能待补

### 8.2 开 R2a 之前（现行阻塞）

- [ ] `open-decisions.md` D1–D4 已决议  
- [ ] `preflight-lock.md` 全勾  
- [ ] 按 D1 处理脏工作区（回退或收敛声明）  
- [ ] `r1-schema` 标签或等价 SHA 锚点已记录  
- [ ] 按 D3 处理 verify 基线  
- [ ] Node 与 `.nvmrc` 一致（22.15.x）

**现行入口**：先完成 §8.2，再打开 `20-r2-id-migration.md` 的 **R2a**；不要从半截工具脚本「接着改」。

### 8.3 评审文档索引（前置）

| 文档 | 作用 |
| --- | --- |
| `docs/reviews/track-restructure/plan-coverage-review.md` | 覆盖度与缺口 |
| `docs/reviews/track-restructure/open-decisions.md` | 必须拍板的决策 |
| `docs/reviews/track-restructure/preflight-lock.md` | 开码前检查单 |
