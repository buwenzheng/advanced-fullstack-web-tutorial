# E3 逐页契约与对等基线

- 冻结时间：2026-11-10
- 基准版本：`e2-shell`（v2.0.1 行为与 DOM 为准）
- 权威文档：`docs/implementation/14-e3-views-and-interaction.md`
- 内容快照：`f53ef3709599e7801fae93133bec6f9c3434ece3fb54b7491853c963ea24bab3`（与 E1 一致）
- 视觉基线：`e2e/__screenshots__/**` 21 张（v2 oracle，已按 T-E3.0 刷新）

## 1. 通用渲染规则（违反即偏离）

| 规则 | 要求 | v2 证据 |
| --- | --- | --- |
| 页面根节点 | 总览/阶段/项目/报告/实验台 `div.page`；实验台额外 `page--wide`；课时 `article.page`；无效课时 `div.page` | `views/overview.js:15`、`views/stage.js:21`、`views/lesson.js:50`、`views/project.js:42`、`views/lab.js:283`、`views/report.js:38` |
| 唯一标题 | `main` 内恰好一个 `h1` | 21 张基线 + `e2e/shell.spec.ts` |
| 链接 | 一律 `<a href="#/...">`，不用 `Link`/`navigate()` | v2 全部视图 |
| 按钮 | 一律 `type="button"` | `views/*.js`、`engine/exercise.js` |
| 类名 | 逐字保留 v2 类名与 `is-*` 状态类 | 见各页契约 |
| 内联样式 | 逐字复制 v2 | 见各页契约 |
| HTML 注入 | 仅 `<RichText>`；代码高亮例外 | `ui.js:11`、`engine/exercise.js:74` |
| 接口响应/草稿/笔记 | 按文本渲染 | `views/lab.js:503`、`views/project.js:160` |
| 图标 | SVG `viewBox`/`path` 与 v2 一致 | `views/lesson.js:8`、`views/app.js`、`views/project.js:86` |
| 键盘 | 保留原生 Tab 顺序 | v2 无自定义 tabindex |
| 语言切换 | 仅课时页按 `key={currentLang}` 整页重挂载 | `app.js:328-333`（`render()`） |

`RichText` 只接收构建期可信 HTML；实验台响应、草稿、笔记、用户名等运行时字符串不得传入。

## 2. 固定文案（逐字）

| 场景 | 文案 | v2 证据 |
| --- | --- | --- |
| 无效课时 | `找不到这一讲，可能是链接有误。` + `返回总览` | `views/lesson.js:16-17` |
| 无效阶段 | `找不到这个阶段。` | `views/stage.js:18` |
| 无效项目 | `找不到这个项目。` | `views/project.js:45` |
| 搜索无结果 | `没有匹配的课程内容` | `app.js:257` |
| 重置确认 | `确定要清空全部学习记录吗？此操作不可撤销。` | `app.js:344` |
| 重置成功 | `学习记录已清空` | `app.js:349` |
| MCQ 未选择 | `请先选择答案` | `engine/exercise.js:80` |
| 代码全过 | `${meta.label} 轨道全部测试通过` | `engine/exercise.js:304` |
| 代码部分通过 | `${passed}/${expected} 项测试通过` | `engine/exercise.js:308` |
| 代码执行数异常 | `测试未全部执行（${actual}/${expected}），请查看下方结果` | `engine/exercise.js:306` |
| 运行超时 | `运行超时，本次不计入练习记录` | `engine/exercise.js:302` |
| 运行环境未就绪 | `运行环境没有就绪，本次不计入练习记录` | `engine/exercise.js:302` |
| SQL 通过 | `正确` + `查询结果与预期完全一致。` | `engine/exercise.js:430` |
| SQL 不一致 | `结果与预期不一致` | `engine/exercise.js:422` |
| 场景载入 | `已载入场景：${title}` | `views/lab.js:305` |
| curl 复制 | `curl 命令已复制` | `views/lab.js:396` |
| 模板复制 | `已复制` / `复制失败` / `已复制：${title}` | `views/project.js:28-29` |
| 学习报告空态 | `目前没有待攻克的题目——要么你还没开始，要么你已经全部答对了。` | `views/report.js:137` |

E3.5 只允许新增加载态：`正在加载课程…`、`正在加载搜索索引…`。

## 3. 页面契约

### 3.1 总览 `#/`

证据：`web/scripts/views/overview.js:14-106`。

- `section.hero > div.hero__inner`：`span.eyebrow` `Backend for Frontend Engineers`；`h1`（含 `<em>`）`把前端的手感，<em>接后端的世界</em>`；`p.hero__lede` 第 28 行整段；`.hero__stats` 四格 `${mainStages.length} + 1` / `阶段 + 附录`、`${allLessons.length}` / `课程讲解`、`${taskCount}` / `可验证练习`、`${done}/${total}` / `已掌握`；`.hero__cta` 主按钮 `done ? '继续学习' : '从第一讲开始'`（`#/lesson/${next.id}`，无 next 时 `#/`），次按钮 `打开 HTTP 实验室` → `#/lab`。
- `section.section`：`h2` `这套课程怎么运转` + 第 43 行说明段；`.compare` 三列，列标题与 9 条 `<li>` HTML 逐字复制第 46-63 行。
- `section.section`：`h2` `学习路径` + 第 70 行说明段；`.stage-grid` 9 张 `a.stage-card`，按 `curriculum` 顺序。
- 阶段卡：`style=--accent:${ACCENT_VAR[stage.accent] || 'var(--teal)'}`；`.stage-card__top` 左 `APPENDIX` / `STAGE ${String(index).padStart(2,'0')}`，右 `span.badge.badge--muted` `${percent}%`；`h3`/`p`；`.stage-card__bar > i` `width:${percent}%`；`.stage-card__meta` `${lessons.length} 讲`、`·`、附录 `性能、架构与 AI 基础设施` / 有项目 `含阶段项目` / 空；有草稿追加 `· ${draftCount} 讲制作中`。
- 毕业项目面板：`section.section > div.panel`，`panel__head` 内 `h2` `毕业项目：LinkHub 短链服务`，右 `span.badge.badge--amber` `资深全栈`；`panel__body` 第 102 行段落；主按钮 `查看毕业项目` → `#/project/p-graduation`。
- 数据：`useStats()`、`useStageSummaries()`、`useMastery()`；`nextLessonId` 等于 v2 `nextLesson()`（第一讲未掌握；全部掌握返回第一讲；无课时 `null`）。

### 3.2 阶段 `#/stage/:stageId`

证据：`web/scripts/views/stage.js:15-79`。

- 无效 ID：`div.page > div.empty-state`，文本 `找不到这个阶段。`，无返回按钮。
- `section.stage-hero` `style=--accent:${accent}`（缺省 teal）：`span.stage-hero__num` `APPENDIX` / `STAGE XX`；`h1` title；`p` subtitle；`.stage-hero__tags` 依次 `formatDuration(duration)`、`${lessons.length} 讲`、附录 `附录 · 性能、架构、工程与 AI 基础设施`、`已完成 ${done}/${total}`、每个 keyword `badge badge--blue`。
- 左列 `.list-stack`：`section__head`（`margin-bottom:0`）`h2` `本阶段课程` + 说明 `按顺序学；标为草稿的讲次会在后续模块补齐正文与练习。`；每讲 `a.lesson-row`：`span.lesson-row__num` 附录 `A.${i+1}` / 普通 `${index}.${i+1}`；标题/副标题；右侧 `formatDuration(duration)`；`status !== 'ready'` 时 `badge badge--muted` `草稿`，否则 `${checks+exercises} 题`；已掌握 `badge badge--teal` `已掌握`。
- 右列 `aside.list-stack`：阶段目标卡（`h3` `阶段目标` + `p` goal）；有 `outcome` 时达成标准卡（`h3` `达成标准` + `ul > li`）；有 `project` 时 `a.panel`（`display:block;padding:16px;text-decoration:none;color:inherit`）→ `#/project/{id}`，`span.eyebrow` `阶段项目`、`h3`（`font-size:15px;margin:8px 0 6px`）、`p.tiny.muted`（`line-height:1.7`）brief。
- 布局：`div.split[style="margin-top:28px"]` 左 `.list-stack` 右 `aside.list-stack`。

### 3.3 课时 `#/lesson/:lessonId`

证据：`web/scripts/views/lesson.js:12-118`、`views/blocks.js`、`engine/exercise.js`。

- 无效 ID：`div.page` + `div.empty-state` `找不到这一讲，可能是链接有误。` + `p[style="margin-top:16px"] > a.btn.btn--ghost.btn--sm[href="#/"]` `返回总览`。
- `header.lesson-head > .lesson-head__meta`：阶段徽章 `a.badge.badge--teal`（附录 `stage.title`，否则 `${stageLabel(stage)} · ${stage.title}`）→ `#/stage/{id}`；`formatDuration`（`badge badge--muted`）；`${checks.length} 道检查点 · ${exercises.length} 道练习`（`badge badge--muted`）；草稿 `badge badge--amber` `草稿`；非草稿 `已验证 ${solved}/${total}`（全对 teal，否则 muted）；非草稿且已掌握 `badge badge--teal` `本讲已掌握`。
- `h1` title；有 subtitle 时 `p.lesson-head__lede`。
- 草稿：`.draft-banner`（`strong` `本讲内容建设中` + 第 68 行段落）。
- 非草稿且有 objectives：`.objectives`（`h3` `学完这一讲，你能做到` + 每项 `li` 勾选 SVG `viewBox="0 0 20 20"` `<path d="M4 10.5l4 4 8-9"/>`）。
- `.lesson-body` 逐块渲染。
- 概念检查：`section.lblock[style="margin-top:40px"]`，`h3.lblock__title` `概念检查`，说明 `p.muted.tiny[style="margin:-4px 0 14px"]` `答对会自动记录，可以随时重做。`。
- 本讲练习：`section.lblock[style="margin-top:36px"]`，`h3` `本讲练习`，说明 `练习在浏览器里真实运行：代码会被执行，SQL 会被解析，结果自动比对。`。
- 底部 `div[style="margin-top:32px;display:flex;gap:12px;flex-wrap:wrap;align-items:center"]`：掌握按钮 + 有阶段项目时 `a.btn.btn--ghost.btn--sm` `进入阶段项目：${title}`。
- 掌握按钮：`store.lessonDone(id)` 为真 → `btn btn--sm btn--primary` `已掌握` 显示；未手动且未自动 → `btn btn--sm btn--ghost` `标记为已掌握` 显示；未手动但任务全过 → 同上但隐藏；草稿 → 隐藏。点击 `store.setLessonDone(id, !done)`。
- `nav.lesson-nav[aria-label="课程翻页"]`：prev `← 上一讲` + strong；next `下一讲 →` + strong（`is-next`）；无 prev/next 且有阶段项目时 `本阶段结束 →` + 项目标题（`is-next`）。
- 语言：`article.page` 以 `key={currentLang}` 重挂载。

### 3.4 12 类内容块

证据：`web/scripts/views/blocks.js:59-163`、`ui.js:47-94`。

| type | 组件 | DOM 契约 |
| --- | --- | --- |
| text | TextBlock | `section.lblock`；有 title 时 `h3.lblock__title`；`RichText` |
| analogy | CalloutBlock variant=analogy | `div.callout.callout--analogy`；icon `⇄`；title 默认 `前端类比`；`RichText` |
| pitfall | CalloutBlock variant=pitfall | icon `!`，默认 `常见坑` |
| note | CalloutBlock variant=note | icon `i`，默认 `补充` |
| tip | CalloutBlock variant=tip | icon `✓`，默认 `实践建议` |
| list | ListBlock | `section.lblock`；可选标题；`ordered === true` 用 `ol`，否则 `ul`；每项 `li` RichText |
| steps | StepsBlock | `section.lblock`；`.steps[role=list]`；每项 `div.steps__item[role=listitem]`：`span.steps__idx` 两位序号、`div.steps__body > div.steps__name/div.steps__text`、可选 `pre.steps__code`、可选 `div.steps__note` |
| code | CodeBlock | 见 §3.4.1 |
| table | TableBlock | `section.lblock`；`div.tbl-wrap > table.tbl`；`thead th` 文本；`tbody td` RichText |
| compare | CompareBlock | `section.lblock`；`div.compare`；每列 `div.compare__col > h4 + ul > li` RichText |
| flow | FlowBlock | `section.lblock`；`div.flow`；每步外层 `div`：`button.flow__step[type=button]`（`span.flow__idx`、`span.flow__name`、`span.flow__detail` RichText、`span.tiny.muted` `点击展开`）+ `div.flow__detail[style="display:none;margin-top:8px;color:var(--text-dim)"]` |
| case | CaseBlock | `section.lblock > div.case`；`div.case__head`（`span.case__tag` `案例复盘`、`h3.case__title`）；`context/symptom/cause/fix/prevention` → `div.case__row.case__row--{field}`（label `背景/现象/根因/止损与修复/预防`，`div.case__body` RichText）；有 metric 时 `div.case__metric`（label `指标变化` + RichText） |

未知类型：`section.lblock` + `未知内容块：${type}`。

#### 3.4.1 代码与双轨

- 无 python：`CodeCard`（`div.codeblock > div.codeblock__bar`（`span.codeblock__lang` + 可选 title）+ `pre > code` 高亮 + 可选 `.codeblock__note`）。
- 有 python：`div.code-tracks > div.code-tracks__head`（`div.code-tabs[role=tablist][aria-label="语言实现"]`，两个 `button.code-tab[type=button][role=tab]`：`span.code-tab__dot.code-tab__dot--javascript/--python` + `languageLabel(id)`；右侧 `span.tiny.muted` `同一概念的两种实现`）+ 两个面板（非当前加 `hidden`）。
- 初始轨道 `lang.get() === 'python' ? 'python' : 'javascript'`；tab 点击只改本地状态。
- 高亮器逐字移植 `ui.js`：`escapeHtml` 只替换 `& < >`；占位符 `@@PH${index}@@`；类名 `tok-key/tok-num/tok-com/tok-str`；`sql` 用 SQL_RULES、`python` 用 PY_RULES、其余 JS_RULES。

### 3.5 任务组件

证据：`web/scripts/engine/exercise.js:19-611`。

- MCQ：`div.quiz`；`quiz__head`（`badge badge--blue` `多选题`/`单选题` + `span.tiny.muted` `task.tag || '概念检查'`）；`p.quiz__q` RichText；有 hint `p.quiz__hint` `提示：${hint}`；`ul.opt-list > button.opt[type=button]`（`span.opt__key` A-F + `span` RichText）；选择 `is-picked`；判定后正确项 `is-right` + `span.opt__mark` `✓ 正确`，选中错误项 `is-wrong` + `✗ 你的选择`；反馈 `div.quiz__feedback.is-right/.is-wrong`，内容 `<b>答对了</b>　`/`<b>答错了</b>　` + explain；提交隐藏、重试显示；保存正确恢复；保存错误禁用、`上次答错`、不揭示正确项。
- 代码：`div.exercise`；head `badge badge--amber` `代码题` + `h3` `task.title || '完成实现'` + 可选 `div.track-tabs[role=tablist][aria-label="练习语言"]` + 状态位；轨道主体 `key={track}`；`textarea[spellcheck=false][aria-label="${title || '代码编辑器'}"]`；`code-editor__bar` meta.file/meta.runtime；四个按钮；运行/重置/提示/参考答案；测试列表、日志、toast、Python 订阅与 `warmPython()`，全部按 §3.5.2。
- SQL：`div.exercise`；head `badge badge--violet` `SQL 题` + `h3` `task.title || '写出查询'` + 状态；`p.exercise__brief` RichText；`div.sql-console` 表结构；编辑器 `textarea[aria-label="SQL 编辑器"]`；按钮与结果反馈按 §3.5.3。
- 方案：`div.exercise`；head `badge badge--teal` `方案题` + `h3` `task.title || '设计方案'`；`p.exercise__brief`；`dl.exercise__specs`；自检清单 `div.aside-card[style="margin-top:14px"]`；我的方案 `div.aside-card[style="margin-top:12px"]`；参考要点切换按 §3.5.4。
- 草稿键 `bff-lab-drafts-v1`；方案题键 `note:${task.id}`；挂载读一次、输入写、异常静默。

### 3.6 项目 `#/project/:projectId`

证据：`web/scripts/views/project.js:41-181`。

- 无效 ID：`div.page > div.empty-state` `找不到这个项目。`。
- `section.project-hero`：`span.eyebrow` `${stageLabel || '阶段项目'}`；`h1[style="margin-top:8px"]`；`p` brief；操作行 `div[style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center"]`，`badge badge--amber` `里程碑进度 ${done}/${total}` + 每个 stack `badge badge--muted`。
- 左列：goal 卡 `h3` `你要交付什么`；steps 卡 `h3` `实施路线`；里程碑 `div.panel`（head `h3` `里程碑清单` + `span.tiny.muted` `做完一项就勾上，进度保存在本机`；`ul.milestone-list > li.milestone[.is-done]`）。
- 里程碑项：`button.milestone__box[type=button][aria-label="标记 ${title} 完成"]` + SVG；title/desc/delivery/acceptance/evidence/reuse/related/criteria；仅 `p-graduation` 有 `textarea.milestone__note`。
- 右列：交付物/验收自评/进阶挑战卡；项目笔记 `div.aside-card` + `textarea`（`min-height:170px`）。
- 模板区：`section.panel[style="margin-top:28px"]`，head `h3` `答辩模板库` + `${templates.length} 份模板；复制到 docs/ 后逐项填写`；`div.template-grid > article.template-card`（`h4` + `复制模板` 按钮、purpose、`使用时机：${when}`、`pre.template-card__body > code`）；复制 1600ms 恢复、卸载清理。

### 3.7 实验台 `#/lab`

证据：`web/scripts/views/lab.js:282-520`。

- `div.page.page--wide`；标题区 `h1` `HTTP 实验室` + 说明；`div.tabs[style="width:280px"]` 两个 `button.tab`（`内置模拟服务` / `真实端点`）。
- 左列 10 个场景按钮（顺序与文案见 §3.7.2）；右列请求构造器、响应、最近请求；底部教学箱。
- 请求构造器：`div.panel`；head `h3` `请求构造器` + 右侧 `复制为 curl`/`重置`；`select` GET/POST/PUT/PATCH/DELETE + `input.mono.lab-path-input[aria-label="请求路径"]`；请求头行（Header/Value + `×`）、`+ 添加请求头`；`textarea.mono` 占位 `{ }`；`发送请求` + 说明。
- 响应：状态徽章、耗时、幂等重放徽章、响应头表、`div.console-out`（空 body `(空响应体)`）。
- 历史最多 6 条，不可点击。
- 模拟服务路由、种子用户、状态码映射、教学模式文案按文档 §3.7.2–3.7.5 逐字实现；`runMock` 纯函数；真实端点 8 秒超时。
- 重置恢复请求、seed、清空历史/响应/幂等表、`rateLimitCount = 0`，教学文案按当前模式恢复。

### 3.8 报告 `#/report`

证据：`web/scripts/views/report.js:37-171`。

- 标题区 `h1` `学习报告` + 说明；5 张统计卡 `stat-grid`：`${done}/${total}` 课程掌握（is-teal）、`${answeredCount}` 已作答（is-violet）、`${accuracy}%` 通过率（is-amber）、`${doneMilestones}/${totalMilestones}` 里程碑、`${wrongCount}` 待攻克（is-rose）。
- `collectTasks`/`mergeAnswers`/`accuracy`/`wrongList`/项目集合/`mastery` 逐字对齐 `report.js`。
- 代码双轨（存在带 Python 的代码题时）：两条 `bar-row`，label `Node.js 轨道`/`Python 轨道`，颜色 teal/blue。
- 9 行阶段掌握度，附录 label 为 `stage.title`，否则 `${stageLabel} · ${title}`。
- 待攻克题目：`a.lesson-row` + 序号（附录 `A`）、`task.prompt || task.question || '概念检查'` / `task.title || '练习'`、sub（design `自检清单未完成`，否则 `已尝试 ${attempts} 次`）、`badge badge--rose` `重做`；空态文案见 §2。
- 项目进度 9 条；接下来学什么最多 3 条。

## 4. §7 逐页功能清单（v2 手工核对）

核对方式：v2 入口 21 张基线截图 + E0/E2 66 路由烟测 + 逐页 DOM 检查。勾选表示 v2 oracle 已确认，React 侧在 T-E3.6 逐项复验。

### 4.1 总览 `#/`

- [x] 唯一 `h1`，含 `<em>` 的标题结构一致
- [x] 4 个统计数字正确（8 + 1 / 45 / 214 / 已掌握）
- [x] CTA 文案随进度切换；下一讲链接正确
- [x] 课程运转三列 9 条 `<li>` 文案一致
- [x] 9 张阶段卡顺序、accent 色、百分比、草稿数量正确
- [x] 毕业项目面板文案与按钮正确
- [x] 侧栏与总览的阶段百分比一致

### 4.2 阶段 `#/stage/:id`

- [x] 无效 ID 空状态
- [x] 普通阶段序号 `STAGE XX`；附录 `APPENDIX`
- [x] 时长/讲数/附录徽章/已完成/keywords 顺序正确
- [x] 课时行序号（`1.1` 与 `A.1`）、时长、题数、草稿、已掌握徽章
- [x] 阶段目标、达成标准、阶段项目卡
- [x] 课时行点击进入正确课时

### 4.3 课时 `#/lesson/:id`

- [x] 无效 ID 空状态与返回
- [x] 阶段徽章文案（普通/附录）与链接
- [x] 时长、题数、草稿、已验证、已掌握徽章
- [x] 草稿横幅；草稿不显示 objectives 与掌握按钮
- [x] objectives 勾选图标与文本
- [x] 12 类 block 渲染（按内容实际出现）
- [x] 代码块双轨 tab、初始语言、hidden 面板
- [x] 概念检查/本讲练习两块标题与说明
- [x] 掌握按钮三种状态与写入
- [x] 阶段项目链接
- [x] prev/next/本阶段结束导航
- [x] 语言切换后代码轨道重置、草稿保留

### 4.4 任务组件

- [x] MCQ 单选/多选、未选择 toast、判定样式、重试、保存态
- [x] 代码题 JS 运行、Python 运行（网络可用时）、超时、结果列表、日志、提示、参考答案、重置
- [x] SQL 题执行、正确/错误/非 SELECT/0 行、提示、参考答案
- [x] 方案题勾选、状态、笔记、参考要点
- [x] 所有草稿刷新后保留
- [x] 所有记录写入同一 `bff-lab-progress-v1`，v2 可读取

### 4.5 项目 `#/project/:id`

- [x] 无效 ID 空状态
- [x] hero 阶段标签、标题、brief、里程碑进度、stack
- [x] 目标/实施路线
- [x] 里程碑勾选、进度实时变化、刷新保持
- [x] 验收/证据/复用/关联/一句话验收
- [x] 毕业项目里程碑笔记
- [x] 交付物/验收自评/进阶挑战
- [x] 项目笔记持久化
- [x] 6 份模板、复制成功/失败、1600ms 恢复

### 4.6 实验台 `#/lab`

- [x] 10 个场景按钮与请求填充
- [x] 教学文案初始/模拟/真实/场景切换
- [x] 请求头增删、请求体、方法切换
- [x] 列表分页、201+Location、422 字段、409、401、403、429+Retry-After、304、幂等重放、慢响应
- [x] 响应状态徽章颜色、耗时、响应头表、响应体、空响应体
- [x] 历史最多 6 条
- [x] curl 生成与复制
- [x] 重置恢复种子与初始文案
- [x] 真实端点失败提示（本地预览）

### 4.7 报告 `#/report`

- [x] 5 张统计卡数字与色调
- [x] 空进度全 0，无 NaN
- [x] 代码双轨进度（Node/Python）
- [x] 9 个阶段掌握度条与链接
- [x] 待攻克题目列表与空态
- [x] 9 个项目进度条（8 阶段 + 毕业）
- [x] 接下来学什么最多 3 条
- [x] 附录阶段标签正确

## 5. 内容清单（inventory.txt）

- 12 类 block：text=91、analogy=45、pitfall=45、note=45、tip=3、list=0、steps=47、code=74、table=66、compare=21、flow=28、case=26
- 4 类 task：mcq=135、code=38、sql=2、design=39（共 214）
- 45 讲草稿 0；项目 9；里程碑 54；模板 6
- 内容快照与 E1 一致：`f53ef370…24bab3`

## 6. 对等基线与差异处理

- 视觉 oracle：`e2e/__screenshots__/**` 21 张，测试名不含 `ENTRY`，v2 与 React 共用同一组快照名。
- 视觉测试先 `localStorage.clear()` → reload，保证动态区域（进度、草稿、历史）为空。
- 不允许 mask；任何像素差异按缺陷处理；v2 自身缺陷只记录不顺手修。
- 文本对等：`main.innerText` 归一化空白后逐字比较。
- DOM oracle：`v2-probe.txt`（`#/`、两阶段、三课时、毕业项目、实验台、报告）记录根元素标签/类名、h1、块与任务数量；课时根为 `ARTICLE.page`，其余为 `DIV.page`，实验台为 `page page--wide`。
