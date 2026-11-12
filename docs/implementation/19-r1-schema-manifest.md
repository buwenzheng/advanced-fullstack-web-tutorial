# R1：Schema、清单与装配约定

> 上级：`18-track-restructure.md`；目录：`docs/curriculum-plan.md` §2、§4、§5。  
> 执行手册：`execution-playbook.md`（影响半径 **L0**）。  
> 目标：让类型系统与清单表达「大块 / 章 / 路径」，**尚未**批量改课时文件 ID。  
> 工期：0.5–1 人日。完成定义：G-R1 通过，标签 `r1-schema`。  
> 状态：已通过（见 `r1/g-r1-report.md`）；下文保留为契约说明与回看关联。

## 0. 关联（回看）

| 下游 | 消费本批什么 |
| --- | --- |
| R2a | manifest v3 外形、paths、validate 规则；策略 A 的 legacy/newId 过渡 |
| R2b | chapters/kind 字段约定 |
| R4 | `paths.ts` 四路径静态定义 |

## 1. 阶段边界

### 1.1 本阶段做

- 扩展 `web/scripts/content/schema.ts` / `types.ts`：大块 `kind`、可选 `chapters`、多项目挂载、路径元数据
- 重写 `docs/content-manifest.json` 为新结构（可与旧内容 ID 并存一版，见 §3）
- 更新 `assemble.ts` / `catalog.ts` / `build.ts` / `validate.ts` 与相关 tools，使 **旧 ID 内容** 仍能通过校验（过渡）或明确「manifest 先写新、内容仍旧」的双轨规则
- 新增 `web/scripts/content/paths.ts`（或等价）：四条学习路径的静态定义
- 单测：schema、catalog 形状、路径 steps 引用的 block/chapter 存在
- 证据写入 `docs/reviews/track-restructure/r1/`

### 1.2 本阶段不做

- 不重命名 `stages/s0/**` 等课时文件（R2）
- 不改 `migrate.ts` 业务映射（R2）
- 不改 Overview/Sidebar UI（R4）
- 不改编项目里程碑文案（R3）
- 不更新视觉基线

### 1.3 结束时可运行形态

- `npm run content:validate` 与 `npm run test`（内容相关）绿灯
- 站点行为对学员仍可与改造前一致（旧 ID）
- 代码内已具备新模型类型，R2 只做数据搬家

## 2. 前置条件

| 检查 | 通过标准 |
| --- | --- |
| R0 | `curriculum-plan.md` 含 M1–M4 / E1 / B / X 与对照表 |
| 基线 | `docs/reviews/track-restructure/baseline/` 有 verify 摘要或注明日期 |
| 工作区 | 建议分支 `track-restructure` |
| 命令 | `npm run content:validate`、`npm run typecheck` 当前绿 |

## 3. 过渡策略（二选一，开批前写进 review）

**推荐 A：清单先行、内容暂旧**

- manifest 使用新 block id（`m1`…），但 `lessons[].id` **暂时仍写旧 id**，并增加 `legacy: true` 或 `migrationStatus: "pending"` 字段（仅工具用，不进学员 UI）
- 或：manifest 完全新结构，`validate` 增加 `--legacy-ids` 模式，R1 默认开

**备选 B：R1 只改类型，manifest 仍旧**

- 类型加 optional 字段；manifest 外形不变
- R2 一次性改 manifest + 内容

任选其一后，G-R1 验收命令必须写死，避免口口相传。

**本实施文档默认采用推荐 A**：manifest 新外形 + lesson 行暂留旧 ID + `mapsTo` 指向新 ID（只读对照），R2 再把文件与 id 字段翻成新值。

### 3.1 推荐 manifest 外形（示例）

```json
{
  "version": 3,
  "paths": [
    {
      "id": "c",
      "title": "AI 全栈",
      "steps": [
        { "blockId": "m1" },
        { "blockId": "m4", "chapterId": "coding" },
        { "blockId": "m2" },
        { "blockId": "m3" },
        { "blockId": "m4", "chapterId": "product" }
      ]
    }
  ],
  "blocks": [
    {
      "id": "m1",
      "kind": "required",
      "title": "地基",
      "duration": 170,
      "chapters": [],
      "lessons": [
        { "id": "s0-l1", "newId": "m1-http", "duration": 55 }
      ],
      "projects": ["p0"]
    }
  ],
  "toolbox": { "id": "b", "groups": ["dsa", "perf", "design", "ai"] },
  "capstone": { "id": "x-linkhub", "legacyId": "p-graduation" },
  "totals": { "lessons": 45, "minutes": 3400 }
}
```

R2 完成后删除 `newId` / `legacyId` 过渡字段，`lessons[].id` 即为新 ID。

## 4. 数据模型变更明细

### 4.1 Stage → Block

| 字段 | 变更 |
| --- | --- |
| `id` | 允许 `m1`–`m4`、`e1`、`b`（R1 清单用新；内容文件 R2 再跟） |
| `kind` | 新增：`required` \| `elective` \| `toolbox` |
| `index` | 保留排序；工具箱可固定靠后 |
| `appendix: boolean` | **废弃**；用 `kind === 'toolbox'` 替代（R1 可读两者，R4 后删 appendix） |
| `chapters` | 可选：`{ id: string; title: string; lessonIds: string[] }[]` |
| `project` | 保留单项目；新增可选 `projects: Project[]` 或 `projectIds: string[]`（M2 双项目）。实现选一种，Zod 判别后全仓统一 |

### 4.2 Path

仅存在于 `paths.ts` + manifest `paths`；不进每讲正文。

### 4.3 Catalog

`CatalogStage` 改名或别名 `CatalogBlock`，增加 `kind`、`chapterCount`；生成搜索索引时 stageId 字段在 R2 后变为 blockId（R1 可仍输出旧 stage id）。

## 5. 任务卡

### T-R1.0 冻结与证据目录

- **类型**：validation  
- **产出**：`docs/reviews/track-restructure/r1/preflight.md`；确认过渡策略 A/B  
- **验收**：写明采用 A 或 B；列出将改文件清单  

### T-R1.1 扩展 Zod 与类型

- **类型**：engine  
- **输入**：`curriculum-plan.md` §2、§5；现有 `schema.ts`  
- **产出**：`schema.ts`、`types.ts` 变更；必要时 `docs/content-schema.md` 增补「Block/Chapter/Path」一节  
- **约束**：不删旧字段读取能力；`lessonSchema` 的 id 正则放宽为「旧或新」或改为 `string.min(1)` + 清单校验  
- **验收**：`npm run typecheck`；新增/更新 `content-schema.test.ts`  

### T-R1.2 路径静态表

- **类型**：content  
- **产出**：`web/scripts/content/paths.ts`（路径 A/B/C/D 与 steps）  
- **约束**：文案与规划 §3 一致；不引用未在规划中的 block  
- **验收**：单测断言四路径 steps 的 blockId/chapterId 合法  

### T-R1.3 重写 content-manifest

- **类型**：content  
- **产出**：`docs/content-manifest.json` version 3（或约定号）  
- **约束**：45 讲、时长合计 3400；对照表全覆盖；过渡字段齐全  
- **验收**：JSON 可被 validate 加载；`totals.lessons === 45`  

### T-R1.4 装配 / 校验 / 生成适配

- **类型**：engine  
- **产出**：`assemble.ts`、`validate.ts`、`build.ts`、`catalog.ts`、`tools/validate-content.ts`、`tools/build-content.ts`、审计脚本入口适配  
- **约束**：现有 `stages/s*/**` 在未改 ID 前仍能装配；禁止打断 `npm run dev`  
- **验收**：`npm run content:validate`；`npm run content:build`；`npm run test` 内容相关用例绿  

### T-R1.5 G-R1 报告与标签

- **类型**：review  
- **产出**：`docs/reviews/track-restructure/r1/g-r1-report.md`；标签 `r1-schema`  
- **验收**：报告含策略选择、文件列表、命令退出码；门禁清单全勾  

## 6. G-R1 验收清单

- [ ] Zod 含 `kind`、`chapters`（可选）、路径类型  
- [ ] `paths.ts` 四路径与规划一致  
- [ ] manifest v3 课时数/分钟正确，旧→新对照齐全  
- [ ] `content:validate` + `content:build` + 相关单测通过  
- [ ] 学员可见路由与旧 ID 行为未破坏（抽查 `#/lesson/s0-l1`）  
- [ ] 证据与标签完成  

## 7. 回滚

```text
git reset --hard r1-schema^   # 若标签打在门禁提交上则回退该提交
# 或按 g-r1-report 列出的文件 checkout 上一提交
```

不删 `curriculum-plan.md` 新版。

## 8. 下一批评审入口

G-R1 通过后进入 `20-r2-id-migration.md`。禁止在 G-R1 前批量改名课时文件。
