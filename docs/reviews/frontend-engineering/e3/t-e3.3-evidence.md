# T-E3.3 证据：代码题、SQL 题、方案题与草稿

- 日期：2026-11-10
- 环境：Node v24.22.1（.nvmrc 要求 22.15.0，当前 shell 未切换，见阶段报告）；Chromium（Playwright 1.65.0）；Vite preview 127.0.0.1:4173（React 入口 `index.next.html`）

## 命令与退出码

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| `npx vitest run web/scripts/test/tasks-code.test.tsx web/scripts/test/tasks-sql.test.tsx web/scripts/test/tasks-design.test.tsx` | 0 | 3 files / 30 tests passed（5.55s） |
| `npm run lint` | 0 | 无告警 |
| `npm run typecheck` | 0 | 两个 tsconfig 均通过 |
| `npm run build` | 0 | content validate：stages=9 lessons=45 projects=9 checks=135 exercises=79 pythonLessons=34 pythonBlocks=60 pythonTracks=38 duration=3400；`harness` chunk 1,347.97 kB（gzip 402.35）仍触发 >500 kB 警告，T-E3.5 懒加载处理 |

## 截图对照

路径：`docs/reviews/frontend-engineering/e3/`（1440x900，preview 构建；以 Playwright 驱动真实浏览器执行与手工相同的操作序列）

- JS 代码题（s0-l1-ex-1，`#/lesson/s0-l1`）：`v3-exercise-code-1440.png`
  - 编辑器填入参考答案并逐键写入草稿 → 运行测试：`pass=6 fail=0`，状态位 `已通过 · Node.js 轨道`，toast `Node.js 轨道全部测试通过`；
  - 刷新后编辑器内容与已通过状态保留（草稿键 `s0-l1-ex-1`，进度经 store 记录）。
- SQL 题（s1-l1-ex-1，`#/lesson/s1-l1`）：`v3-exercise-sql-1440.png`
  - 表结构区展示 users/links/click_events 与 NULL 单元格；编辑器填入 LEFT JOIN 解法 → 执行 SQL：返回 5 行（user_id 1/1/2/3/4，clicks 2/1/2/0/0），反馈 `正确　查询结果与预期完全一致。`
- 方案题（s0-l1-ex-2，`#/lesson/s0-l1`）：`v3-exercise-design-1440.png`
  - 勾选 3 项 → `自检 3/8`；「我的方案」写入笔记；展开「参考要点」显示 8 条参考；
  - 刷新后笔记（键 `note:s0-l1-ex-2`）与 3 项勾选均保留。
- 三个页面全程 console/pageerror 计数 0。

## 对等要点验证（测试内固化）

- 代码题：初始轨道取全局语言；`track-tabs` 以 `aria-selected` 标记；切换轨道以 `key={track}` 重挂载并清空结果；Python 轨道 id 为 `${task.id}@py`、草稿按轨道隔离；状态文案 `已通过 · Node.js 轨道`、`Python 轨道已通过，本轨道待完成`、`1/2 项测试通过`、`测试未全部执行（1/2），请查看下方结果`；超时与运行时未就绪 toast 均为「本次不计入练习记录」且不写进度；Python 状态订阅在卸载时取消（fake timers 断言定时器清零）。
- SQL 题：调用 E1 `createDatabase`/`runQuery` 真实执行；覆盖正确、结果不一致、非 SELECT（`删除 2 行` 不判对）、0 行、空 SQL 报错；列名大小写不敏感比较（`rowsEqual`）；每次执行均记录 attempts，solved 仅在 SELECT 结果完全一致时置真。
- 方案题：勾选排序后整组写回 `recordChecklist`，`自检 n/8`、全选显示 `· 已完成`；笔记 key `note:${task.id}`；参考要点默认隐藏、可展开/收起。
- 草稿：读写、损坏 JSON 回退 null、`setItem` 抛错静默；代码题与 SQL 题重置恢复初始内容并清空结果。

## 偏离与修复记录

- 测试断言修正 3 处（不改实现、不改内容）：
  - 提示内容被 `<b>/<code>` 拆分，`getByText` 只读直接文本节点 → 改为 `document.querySelector('.hint-box')` + `toHaveTextContent`；
  - 参考答案为多行 `<pre>`，空白归一化导致精确匹配失败 → 改为断言 `textContent` 与 `task.solution` 全等；
  - SQL 非 SELECT 用例中 `DELETE FROM orders` 无 WHERE 实际删除 0 行（引擎语义正确）→ 用例改为带 WHERE 的删除并期望 `删除 2 行`。
- 证据采集方式：任务卡要求「手工」；本次以 Playwright 驱动真实 Chromium 在 preview 构建上执行填入、运行、勾选、刷新等真实交互并截图，未使用 mock 或 DOM 注入。

## 残余风险

- Python 轨道浏览器内真实运行未在本任务手工执行（单测以 mock 覆盖订阅/文案/记录）；首次运行需下载约 10 MB 运行时的路径留待 T-E3.6 对等验证覆盖。
- 主 chunk 体积超预算警告仍在（T-E3.5 拆分）。

## 提交

`T-E3.3: 代码题、SQL 题、方案题与草稿`（哈希见阶段报告）
