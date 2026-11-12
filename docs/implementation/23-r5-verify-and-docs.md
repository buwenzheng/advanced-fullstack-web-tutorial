# R5：全量验收、基线更新与文档收口

> 上级：`18-track-restructure.md`。  
> 执行手册：`execution-playbook.md`（影响半径 **L5**）。  
> 前置：G-R3 + G-R4（标签 `r3-projects`、`r4-nav`）。  
> 目标：证明分块路径版可维护、可回归、可发布；文档与规则对齐新事实源。  
> 工期：0.5–1 人日。完成定义：G-R5，标签 `r5-track-v1`。

## 0. 关联与顺序

```text
G-R4 ──► T-R5.1 verify ──► T-R5.2 视觉基线 ──► T-R5.3 手工矩阵
              │                                    │
              └────────► T-R5.4 文档/规则 ◄────────┘
                                │
                                ▼
                          T-R5.5 G-R5 + 目标对齐表
```

| 关联对象 | 关系 |
| --- | --- |
| R1–R4 | **只验收**，不开功能；失败则回对应批修，不在 R5「顺手改产品」 |
| R2 migrate | 必须回归五类夹具 |
| R4 导航 | 视觉基线更新的主因；内容页异常 diff 当缺陷 |
| 规划 §1.4 | 目标对齐复核表未勾不得打标签 |

## 1. 阶段边界

### 1.1 本阶段做

- 跑通完整门禁：`npm run verify`
- 本地专项：`npm run e2e:visual`（更新并入库 Windows 基线）、`npm run e2e:python`、`npx tsx tools/run-python-exercises.ts`（若 verify 未含）
- 手工矩阵：四路径入口、旧 ID 重定向、进度迁移注入、M2 双项目、E1 选修、X 档说明、工具箱分组、Lab/Report
- 更新文档：`README.md`、`.cursor/rules/*`（若存在）、`docs/content-schema.md` 废弃字段说明、`09-qa-release.md` 中过时「八阶段」表述
- 在 `00-master-plan.md` / `10-frontend-engineering.md` 顶部保留「历史」声明（若 R 批未写全）
- 归档 `docs/reviews/track-restructure/r5/g-r5-report.md`
- 打标签 `r5-track-v1`

### 1.2 本阶段不做

- 不开新功能/加厚项（真机部署课、案例扩写）
- 不改 `functions/`
- 不做与验收无关的大规模 format
- 不强制改 GitHub Pages 访问策略

### 1.3 结束形态

- 主分支（或发布分支）可 `npm ci && npm run verify` 复现绿灯
- 文档明确：现行目录以分块路径版为准；旧 M0–M9 / 线性叙事仅历史
- 视觉基线与当前导航一致

## 2. 前置条件

| 检查 | 通过标准 |
| --- | --- |
| 标签 | `r3-projects`、`r4-nav` 均存在 |
| 工作区 | 仅剩文档/基线类待提交或干净 |
| Node | `.nvmrc` 一致 |

## 3. 验收矩阵

### 3.1 自动化

| 命令 | 预期 |
| --- | --- |
| `npm run lint` | 0 error |
| `npm run typecheck` | 0 error |
| `npm run test:coverage` | 达既有阈值 |
| `npm run content:validate` | 45 讲 / 块结构 OK |
| `npm run audit:content` | 0 error |
| `npm run audit:exercises` | JS/SQL 全过；starter 失败策略保持 |
| `npm run build` | 成功；单 `dist/index.html` |
| `npm run budget` | 3 PASS |
| Playwright（verify 内） | 非 visual/python 全过 |
| `npm run e2e:visual` | 更新后 21/21（或现行张数） |
| `npm run e2e:python` | 通过 |
| `npx tsx tools/test-progress-migration.ts` | ok |

输出保存到 `docs/reviews/track-restructure/r5/`（`verify.txt`、`visual.txt`、`python.txt` 等）。

### 3.2 手工（最低）

| 项 | 步骤 | 预期 |
| --- | --- | --- |
| 路径 C | 总览点 AI 全栈 | 起点合理（M1 或提示 M4-Coding） |
| 路径 A | 结业文案 | 不要求 E1/X |
| 旧链 | 打开 `#/lesson/s0-l1` | 落到 `#/lesson/m1-http` |
| 旧阶段链 | 打开 `#/stage/s0`（R2b 后） | 落到 `#/stage/m1` |
| 迁移 | 注入 version1/2 进度 JSON 刷新 | version=3；键为新 ID |
| M3 章 | `#/stage/m3` | 两章与两项目可见 |
| E1 | 侧栏选修 | 不阻塞路径 B 结业文案 |
| X | 打开毕业项目 | 三档说明可读 |
| Lab/Report | 各开一次 | 无控制台 error |

### 3.3 目标对齐复核（必须写入 g-r5-report）

对照 `18-track-restructure.md` §1.4 逐行勾选：路径 C 推荐、阶段结业、E1/X 非默认、判题未漂、门禁未跳。任一未勾不得打 `r5-track-v1`。

## 4. 文档收口清单

| 文件 | 动作 |
| --- | --- |
| `README.md` | 目录说明改为大块/路径；内容维护步骤；指向 `18-track-restructure.md` |
| `docs/curriculum-plan.md` | §7 落地顺序补链接到 19–23 |
| `docs/content-schema.md` | Block/Chapter/Path；标记 appendix 废弃 |
| `docs/content-style.md` | 「阶段」用语可保留教学语义；补充「按块生产」一句 |
| `.cursor/rules/project-invariants.mdc` 等 | 兼容契约：ID 可变但键名/路由形态不变；权威文档顺序含新总纲 |
| `docs/implementation/00-master-plan.md` | 顶部历史横幅（若未加） |
| `docs/reviews/track-restructure/known-issues.md` | 新建：残留债（如 Prettier 债、KI 延续） |

## 5. 任务卡

### T-R5.1 自动化门禁

| 项 | 内容 |
| --- | --- |
| **实现** | `npm run verify`；保存 `r5/verify.txt`；另跑 migration |
| **关联** | 聚合 R1–R4 所有契约；失败定位回对应批 |
| **影响面** | L5 |
| **序位** | **第 1**；不过则停 |
| **测试** | verify 全绿；`test:migration` |
| **Review** | 退出码 0；摘要入库 |
| **回滚** | 不打标签；回缺陷批 |

### T-R5.2 视觉基线更新

| 项 | 内容 |
| --- | --- |
| **实现** | `e2e:visual` / update；列出变更文件 |
| **关联** | 主因 R4；勿掩盖内容页回归 |
| **影响面** | L5 |
| **序位** | verify 绿后 |
| **测试** | 视觉全过或已知债登记 |
| **Review** | 仅导航有意变更；内容页 diff 当 bug |
| **回滚** | 基线与代码同进同退 |

### T-R5.3 手工矩阵

| 项 | 内容 |
| --- | --- |
| **实现** | §3.2 表勾选 → `r5/manual-checks.md` |
| **关联** | 覆盖旧链重定向、路径 C、E1/X、迁移注入 |
| **影响面** | L5 |
| **序位** | 与 5.2 可交错 |
| **测试** | 手工步骤本身 |
| **Review** | 每项有预期结果记录 |
| **回滚** | n/a |

### T-R5.4 文档与规则

| 项 | 内容 |
| --- | --- |
| **实现** | §4 文档清单；known-issues |
| **关联** | 与线上行为一致；声明加厚不在本门 |
| **影响面** | L5 文档 |
| **序位** | 验收主体绿后 |
| **测试** | 链接可点；无「仍写八阶段必修」残留 |
| **Review** | 权威文档顺序正确 |
| **回滚** | 文档级还原 |

### T-R5.5 G-R5 报告与标签

| 项 | 内容 |
| --- | --- |
| **实现** | `g-r5-report.md` + §1.4 目标对齐全勾 + `r5-track-v1` |
| **关联** | 宣告重构完成；列出未做加厚 |
| **测试** | §6 清单 |
| **Review** | 任一未勾不得打标签 |

## 6. G-R5 验收清单

- [ ] verify + 视觉 + Python + 迁移夹具全绿  
- [ ] 手工矩阵全勾  
- [ ] README / schema / 规则 / 旧总纲横幅一致  
- [ ] known-issues 登记残留  
- [ ] 标签 `r5-track-v1`  

## 7. 回滚

回退至 `r4-nav`（或合并前最后绿提交）。已更新的视觉基线与代码必须同进同退。

## 8. 完成后的推荐后续（不在本门内）

1. LinkHub 外部工程轨仓库（交付加厚）  
2. 真机部署可选验收档落地页  
3. B-Design 案例扩写  
4. 将 `format:check` 纳入 verify（历史债）  

以上需新开实施文档，不膨胀 R5。
