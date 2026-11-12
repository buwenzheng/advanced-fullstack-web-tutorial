# G-R1 报告：Schema 与清单 v3

- 日期：2026-11-12
- 结论：**G-R1 通过**（代码与校验已绿；git 标签 `r1-schema` 待用户提交后打上）
- 策略：**A** — 清单先行、内容暂旧（`lessons[].id` 旧 ID + `newId`）

## 1. 变更文件

| 路径 | 说明 |
| --- | --- |
| `web/scripts/content/schema.ts` | `kind` / `chapters` / `projectIds` / path schemas |
| `web/scripts/content/types.ts` | 导出 BlockKind / Chapter / LearningPath 等 |
| `web/scripts/content/paths.ts` | **新建** 路径 A/B/C/D |
| `web/scripts/content/manifest.ts` | **新建** v3 解析与路径引用校验 |
| `web/scripts/content/validate.ts` | 按 blocks 扁平对照 + totals / toolbox / capstone |
| `web/scripts/content/catalog.ts` / `build.ts` | catalog 可选 `kind` / `chapterCount` |
| `docs/content-manifest.json` | version 3 |
| `docs/content-schema.md` | Block/Chapter/Path 与 v3 清单说明 |
| `tools/lib/content.ts` | Manifest v3 类型与导出 |
| `tools/audit-content.ts` / `content-stats.ts` | 对照 v3 |
| `web/scripts/test/paths.test.ts` | **新建** |
| `web/scripts/test/content-*.test.ts` | 适配 |
| `docs/reviews/track-restructure/**` | 基线 / preflight / 本报告 |

**未改**：`web/scripts/content/stages/**` 课时文件、`migrate.ts`、Overview/Sidebar UI。

## 2. 命令结果

| 命令 | 退出码 | 摘要 |
| --- | --- | --- |
| `npm run typecheck` | 0 | 通过 |
| `npm run content:validate` | 0 | stages=9 lessons=45 duration=3400 |
| `npm run content:build` | 0 | catalog/search 已生成 |
| `npm run audit:content` | 0 | errors=0 warnings=0 |
| `npm run test -- …paths/schema/validate/catalog` | 0 | 32 passed |
| `npx tsx tools/content-stats.ts` | （见下） | 与清单 totals 对齐 |

## 3. G-R1 清单

- [x] Zod 含 `kind`、`chapters`（可选）、路径类型
- [x] `paths.ts` 四路径与规划一致
- [x] manifest v3：45 讲、3400 分钟、旧→新对照齐全
- [x] `content:validate` + `content:build` + 相关单测通过
- [x] 内容仍为旧 ID（`#/lesson/s0-l1` 语义未改）
- [ ] git 标签 `r1-schema`（需先 commit；本环境未代为提交）

## 4. 回滚

还原本报告 §1 文件列表；`docs/curriculum-plan.md` 分块规划可保留。

## 5. 下一批

进入 R2 **之前**必须完成：`open-decisions.md` + `preflight-lock.md`；再执行 `20-r2-id-migration.md` 的 **R2a**。

## 6. 脚注（2026-11-12 二次复核）

本报告 §3「内容仍为旧 ID」描述的是 **G-R1 通过当时** 的状态。此后工作区曾出现未锁定即改课时/项目 ID 的半截改动，与本报告不再一致。处理方式见 `open-decisions.md` **D1**；在 D1 执行完毕并（如需要）恢复旧 ID 语义或改写本脚注之前，**不得宣称仍处于干净的 G-R1 可复现态**。