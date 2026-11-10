# T-E3.2 证据：课时页、12 类内容块与检查题

- 日期：2026-11-10
- 环境：Node v24.22.1（.nvmrc 要求 22.15.0，当前 shell 未切换，见阶段报告）；Chromium（Playwright 1.65.0）；Vite preview 127.0.0.1:4173

## 命令与退出码

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| `npx vitest run web/scripts/test/blocks.test.tsx web/scripts/test/lesson-page.test.tsx web/scripts/test/tasks-mcq.test.tsx` | 0 | 3 files / 24 tests passed |
| `npx playwright test e2e/content.spec.ts --project=chromium -g "lesson"` | 0 | 4 passed（s0-l1、s7-l5、a1 正文与检查题；双轨切换 + MCQ 反馈） |
| `npm run typecheck` | 0 | 两个 tsconfig 均通过 |
| `npm run lint` | 0 | 无告警 |
| `npm run build` | 0 | content validate：stages=9 lessons=45 projects=9 checks=135 exercises=79 pythonLessons=34 pythonBlocks=60 pythonTracks=38 duration=3400；`mastery-core` chunk 1,327.23 kB（gzip 394.75）触发 >500 kB 警告，T-E3.5 懒加载处理 |

## 截图对照

路径：`docs/reviews/frontend-engineering/e3/`（1440x900，fullPage）

- s0-l1：`v2-lesson-s0-l1-1440.png` / `v3-lesson-s0-l1-1440.png`
- s7-l5：`v2-lesson-s7-l5-1440.png` / `v3-lesson-s7-l5-1440.png`
- 附录 a1：`v2-lesson-a1-1440.png` / `v3-lesson-a1-1440.png`

手工比对结论（s0-l1、a1 逐屏；s7-l5 由 E2E 断言 h1、正文首块、3 道检查题、导航与零控制台错误）：

- 标题、副标题、时长/题目元信息、objectives 列表、12 类 block 的次序与文本一致；
- 概念检查 3 题（1 单选 + 2 多选）的题干、选项、按钮一致；
- 「本讲练习」「标记为已掌握」、上一讲/下一讲导航位置一致；
- 已知差异：v3 练习区当前为代码题/方案题占位（T-E3.3 产出）；顶部外壳统计样式差异属 T-E3.1 范围，非本任务变更。

## 对等要点验证（测试内固化）

- 高亮器 6 组输入输出与 v2 `highlightCode` 逐字一致（JS 注释/字符串/数字、Python 三引号、SQL 注释）。
- 双轨代码块：初始轨道取全局语言；tab 切换只改本地状态；切换语言整页重挂载后轨道重置，已作答记录保留。
- MCQ：单选/多选/未选择提示/答错重试（attempts 累加、marks 渲染）/保存态恢复（答对禁用、答错显示上次答错）。
- 草稿课时：显示横幅、隐藏 objectives 与「标记为已掌握」，正文块完整。
- 导航：`本阶段结束` 项目链接仅在无 prev 且无 next 时渲染（contract.md 行 195）。

## 偏离与修复记录

- `e2e/content.spec.ts` 原为 T-E3.6 产出，但 T-E3.2 命令引用它；本任务创建最小 lesson 范围版本，T-E3.6 扩展为全量套件（偏离已按总纲 §12.2 记录）。
- 测试断言修正 3 处（不改实现）：`display:none` 按钮不可经 role 查询 → `document.querySelector`；s0-l1-check-1 选项数为 4 而非 3；s7-l5 为末讲但仍有上一讲，按契约不渲染项目链接 → 断言改为 `.lesson-nav a` 首个可见。
- ESLint `no-irregular-whitespace`：模板字符串内 U+3000 改为 `\u3000` 转义，渲染输出不变。

## 残余风险

- 代码题/方案题/ SQL 题仍未实现，练习区显示占位（T-E3.3）。
- 像素级视觉回归未在本任务执行（T-E3.6 统一冻结对比）。
- 主 chunk 体积超预算警告（T-E3.5 拆分）。

## 提交

`T-E3.2: 课时页、12 类内容块与检查题`（哈希见阶段报告）
