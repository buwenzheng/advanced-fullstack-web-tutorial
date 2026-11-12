# R2：课时/项目 ID 迁移与进度 remap（R2a + R2b）

> 上级：`18-track-restructure.md`；对照表：`docs/curriculum-plan.md` §5。  
> 执行手册：`docs/reviews/track-restructure/execution-playbook.md`。  
> 前置：G-R1 + **计划锁定**（`open-decisions.md` + `preflight-lock.md`）。  
> 目标：内容、生成物、进度、草稿、路由切换到新 ID；旧书签可重定向；最终目录按大块。  
> 工期：合计约 1.5–2.5 人日。完成定义：**G-R2**（含 R2b），标签 `r2-ids`。

---

## 0. 拆批与关联总览

| 子批 | 影响半径 | 学员可见 | 文件系统 | 下游硬依赖本批产出 |
| --- | --- | --- | --- | --- |
| **R2a** | L1 | lesson/project 深链与进度键 | 目录仍 `s*` | R2b、R3（项目 id）、R4（链接）、R5（迁移回归） |
| **R2b** | L2 | `#/stage/m*` | 目录合并 + 双装配 | R3（块页数据）、R4（侧栏按块） |

```text
T-R2.0 id-map ──► T-R2.1 migrate ──► T-R2.2 内容改 ID ──► T-R2.3 generated/audit/routes
                         │                    │
                         ▼                    ▼
                   T-R2.4 redirect ◄──────────┘
                         │
                         ▼
                   T-R2.5 specs 清理 + 语义抽查 + E2E 冒烟 → G-R2a
                         │
                         ▼
                   T-R2.6 目录合并 + sources/LOADERS → T-R2.7 stage 重定向/chapters → G-R2
```

**禁止**：在 T-R2.0 未稳时批量改内容；在 G-R2a 前开目录合并；对正文做 `p5`/`a6`/`p7` 无词边界全局替换（已出事：`p50`/`p75`/哈希常量）。

---

## 1. R2a 任务卡（必须按序）

### T-R2.0 迁移表代码化

| 项 | 内容 |
| --- | --- |
| **实现** | `web/scripts/content/id-map.ts`：`LESSON_ID_MAP`/`PROJECT_ID_MAP`/`BLOCK_ID_MAP`/`remapId`/`mapHistoricAppendixId`；题目只换前缀；项目里程碑前缀同步；D2=A 时 `p3`/`p4`→`p-m3-ship` |
| **关联** | 上游：规划 §5、G-R1；下游：T-R2.1/2/4 全部消费；与 R3 brief 无文件重叠但 id 必须已是新语义 |
| **影响面** | L1；碰进度算法；不碰判题语义 |
| **序位** | R2a **第 1**；无 map 不准改内容 |
| **测试** | 单测：45 讲旧→新双向；`remapId('s0-l1-check-1')==='m1-http-check-1'`；`remapId('p50')` **不得**变成项目 id；`p3-m1`/`p4-m1`→`p-m3-ship-m1` |
| **Review** | 对照规划 §5 逐行勾；禁止短 id 子串替换策略写入报告 |
| **回滚** | 删/还原 `id-map.ts` |

### T-R2.1 进度与草稿迁移

| 项 | 内容 |
| --- | --- |
| **实现** | `migrate.ts`：v&lt;2→历史 s6→a；再全表 remap→v3；草稿 `migrateDraftMap`；项目记录并集合并；`store` blank version=3 |
| **关联** | 强依赖 T-R2.0；被 store 启动路径、R5 迁移回归消费；**不**改 localStorage 键名 |
| **影响面** | L1；学员本地进度 |
| **序位** | R2a **第 2**（可与内容改 ID 交错，但夹具须先绿） |
| **测试** | `test:migration` 五类夹具；`state-migrate.test.ts`；幂等；version≥3 no-op |
| **Review** | 夹具列表贴进 `r2/`；确认 p3+p4 并集符合 D2 |
| **回滚** | 还原 migrate/store；用户已写入 v3 时禁止半截发布 |

### T-R2.2 内容文件改 ID

| 项 | 内容 |
| --- | --- |
| **实现** | 按块顺序 m1→m2→m3→m4→e1→b→graduation：文件名、导出名、`id`、题 id、python 键、project id；**不改目录层级**；只改显式字段/键，**禁止**全文无边界 replace 短 id |
| **关联** | 依赖 T-R2.0；与 T-R2.3/4 同批收口；R3 将改 brief（本任务不改叙事） |
| **影响面** | L1；catalog/搜索/侧栏链接 |
| **序位** | R2a **第 3**；建议每块后跑 T0 |
| **测试** | 每块后 `content:validate`；整批后 `audit:content`；抽 1 讲跑 `audit:exercises` 或单题 suite |
| **Review** | 语义抽查 ≥3 讲：diff 仅 ID/路径/导出；发现 `p-e1-stats0`/`p-m4-ai5`/`b-probb` 类污染即停 |
| **回滚** | 按块还原；generated 需重建 |

### T-R2.3 生成物、审计、E2E 路由表

| 项 | 内容 |
| --- | --- |
| **实现** | `npm run content:build`；更新 `LESSON_ID_RE`/audit reuse 期望为新项目 id；`e2e/routes.json` 与 catalog 一致（可用 `tools/r2-write-routes-json.ts`） |
| **关联** | 依赖 T-R2.2；运行时 catalog 与校验双轨；R5 routes 冒烟依赖本产出 |
| **影响面** | L1；错则侧栏旧链/页面空 |
| **序位** | R2a **第 4**（内容改完立即做，勿隔夜） |
| **测试** | T0+T2+T4；`routes.json.length===66`（或现行公式写入报告） |
| **Review** | catalog 抽 5 个 lesson id；manifest.projects ⊆ catalog 项目 id |
| **回滚** | 重建 generated；还原 routes.json |

### T-R2.4 旧 ID 重定向

| 项 | 内容 |
| --- | --- |
| **实现** | `app/redirects.ts` + Lesson/Project（Stage 可空操作直至 R2b）；仅当目标存在于 catalog 才 Navigate |
| **关联** | 依赖 T-R2.0 + T-R2.2/3；E2E 可保留部分旧 URL 作回归；R5 手工矩阵含旧链 |
| **影响面** | L1；书签兼容 |
| **序位** | R2a **第 5**；可与 T-R2.3 后紧接 |
| **测试** | `redirects.test.ts`；可选 Playwright：`#/lesson/s0-l1` 最终 `#/lesson/m1-http` |
| **Review** | hooks 顺序合法（勿在 early return 后调 hook） |
| **回滚** | 去掉 Navigate，恢复空状态页 |

### T-R2.5 R2a 收口（specs / 抽查 / 冒烟 / 报告）

| 项 | 内容 |
| --- | --- |
| **实现** | 删除 `content-specs` 旧名双份（新 id 文件为权威）；写语义抽查记录；Playwright chromium 非 visual 冒烟；`g-r2a-report.md` |
| **关联** | 收束 T-R2.0–4；**通过后才允许 R2b**；R3 依赖稳定项目 id |
| **影响面** | L1 收口 |
| **序位** | R2a **最后** |
| **测试** | T0–T5 最低集：validate、audit:content、migration、vitest、typecheck、playwright 抽样 |
| **Review** | G-R2a 清单全勾；标签 `r2a-ids`（可选） |
| **回滚** | 不进 R2b；修债 |

#### G-R2a 验收清单

- [ ] 45 讲内容 id = 新语义；manifest 一致  
- [ ] manifest.projects 与 catalog 一致  
- [ ] python 键对齐；migrate 五类夹具 + 幂等  
- [ ] 旧 lesson/project hash 可重定向  
- [ ] specs 无「仅旧名有正文」  
- [ ] 语义抽查 ≥3 讲已记录  
- [ ] validate / audit:content / typecheck / test / test:migration 绿  
- [ ] Playwright 冒烟通过或失败项记 known 且不挡身份正确性  
- [ ] `g-r2a-report.md`  

---

## 2. R2b 任务卡（G-R2a 之后）

### T-R2.6 目录合并 + 双装配

| 项 | 内容 |
| --- | --- |
| **实现** | `s0→m1`；`s1+s2→m2`；`s3+s4+s6→m3`；`s7→m4`；`s5→e1`；`appendix→b`；同步改 `sources.ts` **与** `resources.ts` STAGE_LOADERS；D2=A 物理合并 p3/p4 文件 |
| **关联** | 强依赖 G-R2a；R4 侧栏按块；漏改 LOADERS → 校验绿页面空 |
| **影响面** | L2 |
| **序位** | R2b **第 1** |
| **测试** | T0+T3+T4；手动打开 `#/stage/m1`…`#/stage/b` |
| **Review** | 两入口 loader 键集合相等；无残留权威 `stages/s0` |
| **回滚** | `r2a-ids` / R2a 末 SHA |

### T-R2.7 stage 重定向 + kind/chapters

| 项 | 内容 |
| --- | --- |
| **实现** | 内容写入 `kind`/`chapters`；`#/stage/s0`→`#/stage/m1`；D4=A 保留 param 名 `stageId` |
| **关联** | 依赖 T-R2.6；R4 章标题展示消费 chapters |
| **影响面** | L2 |
| **序位** | R2b **第 2** |
| **测试** | redirect 测；catalog chapterCount；抽 M3 两章 lessonIds |
| **Review** | 与 manifest chapters 一致 |
| **回滚** | 同 T-R2.6 |

### T-R2.8 G-R2 报告

| 项 | 内容 |
| --- | --- |
| **实现** | `g-r2-report.md` + 标签 `r2-ids` |
| **关联** | 解锁 R3 |
| **测试** | G-R2 清单 |
| **Review** | 门审提问清单（execution-playbook §5.3） |

#### G-R2 验收清单

- [ ] G-R2a 仍绿  
- [ ] 目录与加载仅为 `m1…b`  
- [ ] `#/stage/m3` 可开且有章数据  
- [ ] 旧 stage id 可重定向  
- [ ] p3/p4 物理合并按 D2 完成  
- [ ] 证据与 `r2-ids`  

---

## 3. 本批不做（防范围漂移）

- 不改编项目叙事解耦（R3）  
- 不改总览路径 UI（R4）  
- 不更新视觉基线（R5）  
- 不改 localStorage **键名**  
- 不加厚课  

---

## 4. 与其它批次的接口契约

| 交给下游的契约 | 消费者 |
| --- | --- |
| 稳定 lesson/project id | R3 brief、R4 链接、R5 矩阵 |
| migrate v3 幂等 | R5 |
| path 仍为 `#/stage/:stageId`（取值新 id） | R4/R5 |
| chapters 挂在内容块上（R2b 后） | R4 BlockPage/Sidebar |

| 本批需要上游提供 | 来源 |
| --- | --- |
| 对照表与路径定义 | `curriculum-plan.md` |
| manifest/paths 类型 | G-R1 |
| D1–D4 决议 | `open-decisions.md` |

---

## 5. 回滚总则

- R2a 失败 → `r1-schema` 或 D1 锚点；重建 generated。  
- R2b 失败 → `r2a-ids`。  
- 已有用户 v3 数据时：禁止向生产推半截迁移。
