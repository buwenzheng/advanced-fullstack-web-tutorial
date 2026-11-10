# E3：视图与交互迁移（六页、内容块、练习、实验台与报告）

> 上级：`10-frontend-engineering.md` §3.2、§6 E3、§7、§11-13；前置：`13-e2-react-shell.md`。
> 目标：把 E2 的六个骨架页替换为与 v2.0.1 行为、文案、DOM 结构完全对等的 React 实现：12 类内容块、检查题、四类任务组件、项目页、HTTP 实验台、学习报告；E3.5 再把阶段内容改为按需加载、搜索索引改为首次聚焦后加载。
> 工期：2–3 人日。完成定义：G-E3 通过，标签 `e3-parity`。

## 1. 阶段边界

### 1.1 本阶段做

- 新增 `app/data/` 数据门面：`useStageSummaries` / `useLessonSummaries` / `useStage` / `useLesson` / `useProject` / `useAllStages` / `useMastery` / `useStats`；E3.1 用 E1 的同步内容实现，E3.5 只替换该门面内部为懒加载；
- 重写六个页面：总览、阶段、课时、项目、实验台、报告；
- 12 类内容块 React 组件（`text` / `analogy` / `pitfall` / `note` / `tip` / `list` / `steps` / `code` / `table` / `compare` / `flow` / `case`）；
- 代码块高亮器与 JS/Python 双轨切换；
- 四类任务组件：`mcq`、`code`、`sql`、`design`，含草稿、答案记录、提示、参考答案、测试结果、重置；
- 项目页里程碑、项目笔记、毕业项目模板复制；
- HTTP 实验台：10 个教学场景、内置模拟服务、真实端点、curl 复制、响应与历史；
- 学习报告：统计卡、代码双轨进度、阶段掌握度、待攻克题目、项目进度、接下来学什么；
- E3.5：阶段内容懒加载、catalog 驱动外壳、搜索索引按需加载；
- 组件测试、交互 E2E、66 路由正文对等测试、视觉基线对比。

### 1.2 本阶段不做

- 不改 hash URL、`localStorage` 键、旧进度迁移规则、课程内容、练习答案与测试；
- 不改 `web/index.html`、`web/scripts/app.js`、`web/scripts/views/**`、`web/scripts/ui.js`、`web/scripts/engine/exercise.js`（v2 保持可运行，直到 E5 删除）；
- 不改任何 CSS 文件；不新增 UI 库、CSS 框架、图标库；不新增运行时依赖；
- 不切换默认入口（`web/index.html` 仍是 v2）；不删除旧代码；不发布；
- 不改 `functions/`、数据库、访问策略；
- 不做 E4 的质量门禁扩展（覆盖率策略、a11y 自动扫描、性能预算的完整版留到 E4；E3.6 只做对等验证）。

### 1.3 本阶段结束时的可运行形态

- `npm run dev` 仍是 v2；`npm run dev:next` 是完整的 React 站点；
- `npm run build` 同时产出 `dist/index.html`（v2）与 `dist/index.next.html`（完整 React）；
- React 入口的 66 条路由与 v2 逐页正文一致；JS/SQL/方案题可真实作答并写入同一份 `localStorage`；
- 初次打开 `#/` 不请求任何阶段内容 chunk；首次聚焦搜索框后才请求搜索索引；
- 未发布任何版本。

## 2. 前置条件

| 检查 | 命令 | 通过标准 |
| --- | --- | --- |
| 阶段标签 | `git tag --list e2-shell` | 输出 `e2-shell` |
| 工作区 | `git status --short` | 无业务文件改动；仅方案文档可未跟踪 |
| Node | `node -v` | `v22.15.0` |
| 依赖 | `npm ci` | 0 error |
| E2 门禁 | `npm run verify` | 全绿 |
| 双入口 | `npm run build && ls dist/index.html dist/index.next.html` | 两个文件都存在 |
| React 外壳 | `npx playwright test e2e/shell.spec.ts --project=chromium` | 66/66 通过 |
| 内容基线 | `npx tsx tools/content-snapshot.ts` | 与 E1 记录的快照一致 |
| E1 内容 API | `grep -n "export function lessonById\|export function stageById\|export function findProject" web/scripts/content/index.ts` | 三个函数都有 |
| 引擎 API | `grep -n "export function runTests" web/scripts/engine/runner/index.ts` | 有输出 |
| 搜索函数 | `grep -n "export function lessonHaystack" web/scripts/content/search.ts` | 有输出 |
| 生成脚本 | `grep -n '"content:build"' package.json` | 有输出（E1 T-E1.6 的生成器入口） |
| 视觉基线 | `ls e2e/__screenshots__` | 存在 E0 生成的 21 张基线 |

若 `content:build` script 尚未写入 `package.json`，先按 `12-e1-types-and-content.md` T-E1.6 补齐 `"content:build": "tsx tools/build-content.ts"`，不改生成器语义。

## 3. 页面与组件契约

### 3.0 通用渲染规则

以下规则适用于所有页面与组件，违反即视为偏离：

| 规则 | 要求 |
| --- | --- |
| 页面根节点 | 总览/阶段/项目/报告/实验台：`div.page`；实验台额外 `page--wide`；课时：`article.page`；无效课时：`div.page` |
| 唯一标题 | 每个页面在 `main` 内恰好一个 `h1` |
| 链接 | 课程内跳转一律 `<a href="#/...">`，不用 `Link`、不调用 `navigate()`；让浏览器产生与 v2 相同的 hash 变化 |
| 按钮 | 一律 `type="button"`；样式类与 v2 相同 |
| 类名 | 逐字保留 v2 类名（含 `is-*` 状态类） |
| 内联样式 | v2 的内联样式是视觉契约的一部分，逐字复制；E3 不做样式重构 |
| HTML 注入 | 只通过统一的 `<RichText>` 注入；内容来自构建期可信文件；禁止把用户输入、草稿、接口响应传入 `RichText` |
| 接口响应 | 实验台响应体、请求体、草稿、笔记一律按文本渲染（`textContent` 等价），不做 HTML 注入 |
| 图标 | 内联 SVG 的 `viewBox`、`path` 与 v2 一致 |
| 键盘 | 保留 v2 的按钮/链接原生键盘行为；新增的可访问性属性不得改变 Tab 顺序 |
| 语言切换 | 只有课时页随语言轨道整页重挂载（`key={currentLang}`），与 v2 `render()` 行为一致；其余页面不因语言切换重挂载 |

`RichText` 契约：

```tsx
type RichTextProps = {
  html?: string | null;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
};

export function RichText({ html, as: Tag = 'div', className, style }: RichTextProps) {
  if (!html) return null;
  return <Tag className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}
```

允许一个组件内联使用 `dangerouslySetInnerHTML` 的唯一场景：代码高亮结果（`highlightCode` 的输出）。除此之外必须走 `RichText`。

### 3.1 总览页（`#/`）

DOM 顺序与 v2 `web/scripts/views/overview.js` 完全一致。

| 区域 | 结构 | 文案/数值 |
| --- | --- | --- |
| `section.hero > div.hero__inner` | `span.eyebrow` | `Backend for Frontend Engineers` |
| | `h1`（含 `<em>`） | `把前端的手感，<em>接后端的世界</em>` |
| | `p.hero__lede` | v2 overview.js 第 28 行整段，逐字 |
| | `.hero__stats` 四格 | `${mainStages.length} + 1` / `阶段 + 附录`；`${allLessons.length}` / `课程讲解`；`${taskCount}` / `可验证练习`；`${done}/${total}` / `已掌握` |
| | `.hero__cta` | 主按钮：`done ? '继续学习' : '从第一讲开始'`，`href` 为 `next ? '#/lesson/' + next.id : '#/'`；次按钮 `打开 HTTP 实验室` → `#/lab` |
| `section.section` 课程运转 | `h2` | `这套课程怎么运转` |
| | 说明段落 | `每一讲都是「讲清 → 验证 → 落地」三段式。练习不是选择题凑数：代码会在沙箱里真跑，SQL 会被解析并比对结果。` |
| | `.compare` 三列 | 列标题与 `<li>` HTML 逐字复制 overview.js 第 46–63 行 |
| `section.section` 学习路径 | `h2` | `学习路径` |
| | 说明段落 | overview.js 第 70 行整段，逐字 |
| | `.stage-grid` | 9 张 `a.stage-card`，顺序为 `curriculum` 顺序（含附录） |
| 阶段卡 | `style=--accent:${ACCENT_VAR[stage.accent]}` | 见下表 |
| | `.stage-card__top` | 左：`APPENDIX` 或 `STAGE ${index 两位}`；右：`badge badge--muted` 文本 `${percent}%` |
| | `h3` / `p` | `stage.title` / `stage.subtitle` |
| | `.stage-card__bar > i` | `width:${percent}%` |
| | `.stage-card__meta` | `${lessons.length} 讲`、`·`、附录 `性能、架构与 AI 基础设施`，否则有项目 `含阶段项目`，否则空；有草稿时追加 `· ${draftCount} 讲制作中` |
| 毕业项目面板 | `section.section > div.panel` | `panel__head` 内 `h2` 文案 `毕业项目：LinkHub 短链服务`，右侧 `badge badge--amber` 文本 `资深全栈` |
| | `panel__body` | 段落逐字复制 overview.js 第 102 行；主按钮 `查看毕业项目` → `#/project/p-graduation` |

`ACCENT_VAR`：

```ts
const ACCENT_VAR = {
  teal: 'var(--teal)', amber: 'var(--amber)', violet: 'var(--violet)',
  rose: 'var(--rose)', blue: 'var(--blue)', green: 'var(--green)',
} as const;
```

数据来源统一走门面：

```tsx
const stats = useStats();          // { mainStageCount, lessonCount, taskCount, done, total }
const stages = useStageSummaries();
const mastery = useMastery();
const next = mastery.nextLessonId ? { id: mastery.nextLessonId } : null;
```

`nextLessonId` 语义必须等于 v2 `nextLesson()`：按 `allLessons` 顺序找第一讲未掌握；全部掌握时返回第一讲；无课时返回 `null`。

### 3.2 阶段页（`#/stage/:stageId`）

无效 ID：`div.page > div.empty-state`，文本 `找不到这个阶段。`，无返回按钮。

有效阶段的结构：

| 区域 | 结构 | 约束 |
| --- | --- | --- |
| `section.stage-hero` | `style=--accent:${accent}` | `accent` 缺省 `teal` |
| | `span.stage-hero__num` | `APPENDIX` 或 `STAGE ${String(index).padStart(2, '0')}` |
| | `h1` | `stage.title` |
| | `p` | `stage.subtitle` |
| | `.stage-hero__tags` | 依次：`formatDuration(duration)`、`${lessons.length} 讲`、附录徽章 `附录 · 性能、架构、工程与 AI 基础设施`、`已完成 ${done}/${total}`、每个 keyword 一个 `badge badge--blue` |
| 左列 `.list-stack` | `section__head` | `h2` `本阶段课程` + 说明段落 `按顺序学；标为草稿的讲次会在后续模块补齐正文与练习。` |
| | 每讲 `a.lesson-row` | `span.lesson-row__num`：附录 `A.${i+1}`，否则 `${stage.index}.${i+1}` |
| | | 标题/副标题：`lesson.title` / `lesson.subtitle || ''` |
| | | 右侧：`formatDuration(duration)`；`status !== 'ready'` 时 `badge badge--muted` 文本 `草稿`，否则 `${checks+exercises} 题`；已掌握时 `badge badge--teal` 文本 `已掌握` |
| 右列 `aside.list-stack` | 阶段目标卡 | `h3` `阶段目标`；`p` `stage.goal` |
| | 达成标准卡（有 `outcome` 时） | `h3` `达成标准`；`ul > li` 文本 |
| | 阶段项目卡（有 `project` 时） | `a.panel` → `#/project/{id}`；`span.eyebrow` `阶段项目`；`h3` 项目标题；`p` 项目 `brief` |

阶段页需要完整阶段对象（keywords、goal、outcome、project），因此使用 `useStage(stageId)`；无效 ID 时 `useStage` 返回 `null`，渲染空状态。

### 3.3 课时页（`#/lesson/:lessonId`）

无效 ID：

```tsx
<div className="page">
  <div className="empty-state">找不到这一讲，可能是链接有误。</div>
  <p style={{ marginTop: 16 }}>
    <a className="btn btn--ghost btn--sm" href="#/">返回总览</a>
  </p>
</div>
```

有效课时：

| 区域 | 结构 | 约束 |
| --- | --- | --- |
| `header.lesson-head` | `.lesson-head__meta` | 阶段徽章 `a.badge.badge--teal`：附录 `stage.title`，否则 `${stageLabel(stage)} · ${stage.title}` → `#/stage/{id}` |
| | | `formatDuration(lesson.duration)`（`badge badge--muted`） |
| | | `${checks.length} 道检查点 · ${exercises.length} 道练习`（`badge badge--muted`） |
| | | 草稿时 `badge badge--amber` 文本 `草稿` |
| | | 非草稿：`已验证 ${solved}/${total}`，全对 `badge--teal`，否则 `badge--muted` |
| | | 非草稿且已掌握：`badge badge--teal` 文本 `本讲已掌握` |
| | `h1` / `p.lesson-head__lede` | `lesson.title` / `lesson.subtitle`（有则渲染） |
| 草稿横幅 | `.draft-banner` | `strong` `本讲内容建设中`；`p` `M0 已锁定本讲的 ID、时长与项目归属，正文、检查题与练习会在后续模块补齐。当前可先浏览阶段目标与项目验收标准。` |
| 目标 | `.objectives`（仅非草稿且非空） | `h3` `学完这一讲，你能做到`；每条 `li` 前有勾选 SVG |
| 正文 | `.lesson-body` | 逐块渲染 §3.4 |
| 概念检查 | `section.lblock`（有检查题时，`margin-top:40px`） | `h3.lblock__title` `概念检查`；说明 `答对会自动记录，可以随时重做。`；逐题 `<TaskRenderer>` |
| 本讲练习 | `section.lblock`（有练习时，`margin-top:36px`） | `h3.lblock__title` `本讲练习`；说明 `练习在浏览器里真实运行：代码会被执行，SQL 会被解析，结果自动比对。`；逐题 `<TaskRenderer>` |
| 底部操作 | `div`（`margin-top:32px`） | 掌握按钮：见下；阶段项目链接 `进入阶段项目：${project.title}` |
| 翻页 | `nav.lesson-nav[aria-label="课程翻页"]` | 有上一讲：`← 上一讲` + 标题；有下一讲：`下一讲 →` + 标题（`is-next`）；**上一讲与下一讲都不存在**且有阶段项目：`本阶段结束 →` + 项目标题（`is-next`，v2 仅在单讲阶段的边界出现） |

掌握按钮状态（与 v2 `refreshMeta()` 一致）：

| 条件 | 类 | 文本 | 显示 |
| --- | --- | --- | --- |
| `store.lessonDone(id) === true` | `btn btn--sm btn--primary` | `已掌握` | 显示 |
| 未手动标记、也未自动掌握 | `btn btn--sm btn--ghost` | `标记为已掌握` | 显示 |
| 未手动标记、但任务全过 | `btn btn--sm btn--ghost` | `标记为已掌握` | 隐藏 |
| 草稿 | `btn btn--sm btn--ghost` | `标记为已掌握` | 隐藏 |

点击行为：`store.setLessonDone(lesson.id, !store.lessonDone(lesson.id))`。

数据：

```tsx
const context = useLesson(lessonId); // { lesson, stage, prev, next } | null
const mastery = useMastery();
const tasks = lessonTasks(lesson);
const solved = tasks.filter((task) => taskSolved(task)).length;
```

`taskSolved` / `lessonTasks` 来自 E3.1 新增的 `state/mastery-core.ts`（`state/progress.ts` 改为委托同一组纯函数），不得在 React 里重写判题语义。`mastery-core.ts` 只依赖 `state/store`，**禁止** import `content/index`（否则会把全量课程拉回首屏，E3.5 的懒加载失效）。

课时页必须用语言轨道作为整页 key，复刻 v2 在 `lang.subscribe` 时 `render()` 的行为：

```tsx
const { current } = useLang();
return (
  <article className="page" key={current}>
    {/* ... */}
  </article>
);
```

这把「切语言 → 代码块/练习回到新轨道 → 草稿与已记录答案保持不变」的语义一次性对齐，无需在每个代码组件里写语言副作用。

### 3.4 12 类内容块

文件与类名一一对应，禁止合并语义或改名：

| `block.type` | 组件 | DOM 契约 |
| --- | --- | --- |
| `text` | `TextBlock` | `section.lblock`；有 `title` 时 `h3.lblock__title`；正文 `RichText` |
| `analogy` | `CalloutBlock variant="analogy"` | `div.callout.callout--analogy`；`div.callout__icon` 文本 `⇄`；`div.callout__title` 默认 `前端类比`；`div` 内 `RichText` |
| `pitfall` | `CalloutBlock variant="pitfall"` | 同上，icon `!`，默认标题 `常见坑`，类 `callout--pitfall` |
| `note` | `CalloutBlock variant="note"` | 同上，icon `i`，默认标题 `补充`，类 `callout--note` |
| `tip` | `CalloutBlock variant="tip"` | 同上，icon `✓`，默认标题 `实践建议`，类 `callout--tip` |
| `list` | `ListBlock` | `section.lblock`；可选标题；`ol` 或 `ul`（`block.ordered === true` 时 `ol`）；每项 `li` 用 `RichText` |
| `steps` | `StepsBlock` | `section.lblock`；`.steps[role=list]`；每项 `div.steps__item[role=listitem]`：`span.steps__idx` 两位序号、`div.steps__name`、`div.steps__text`（RichText）、可选 `pre.steps__code`（文本）、可选 `div.steps__note`（RichText） |
| `code` | `CodeBlock` | 无 `python` 时直接渲染 `CodeCard`；有 `python` 时见 §3.4.1 |
| `table` | `TableBlock` | `section.lblock`；`div.tbl-wrap > table.tbl`；`thead th` 文本；`tbody td` 用 `RichText` |
| `compare` | `CompareBlock` | `section.lblock`；`div.compare`；每列 `div.compare__col > h4` + `ul > li`（RichText） |
| `flow` | `FlowBlock` | `section.lblock`；`div.flow`；每步外层 `div` 内：`button.flow__step[type=button]`（`span.flow__idx` 序号、`span.flow__name`、`span.flow__detail` RichText、`span.tiny.muted` 文本 `点击展开`）+ 同级 `div.flow__detail`（`display:none`，RichText `step.body`） |
| `case` | `CaseBlock` | `section.lblock > div.case`；`div.case__head`（`span.case__tag` `案例复盘`、`h3.case__title`）；按 `context/symptom/cause/fix/prevention` 顺序渲染 `div.case__row.case__row--{field}`（`span.case__label` 为 `背景/现象/根因/止损与修复/预防`，`div.case__body` RichText）；有 `metric` 时 `div.case__metric`（`案例复盘` 下方的 `指标变化` 标签 + RichText） |

任一未知类型渲染 `section.lblock` + 文本 `未知内容块：${block.type}`；正常内容不会触发。

#### 3.4.1 代码块与双轨切换

无 `python`：

```tsx
<CodeCard code={block.code} lang={block.lang || 'javascript'} title={block.title} note={'note' in block ? block.note : undefined} />
```

有 `python`：

- 外层 `div.code-tracks`；
- 头部 `div.code-tracks__head`：
  - `div.code-tabs[role=tablist][aria-label="语言实现"]`；
  - 两个 `button.code-tab[type=button][role=tab]`，内部 `span.code-tab__dot.code-tab__dot--javascript` / `--python` + `languageLabel(id)`；
  - 右侧 `span.tiny.muted` 文本 `同一概念的两种实现`；
- 两个 `CodeCard` 面板，非当前面板加 `hidden` 属性；
- 初始轨道：`lang.get() === 'python' ? 'python' : 'javascript'`；由于课时页整体以语言为 key，重挂载后自然回到全局轨道；
- 点击 tab：切换 `aria-selected` 与 `hidden`，不写全局语言、不写草稿。

`CodeCard` 契约与 v2 `ui.js` 的 `codeBlock` 一致：

```tsx
function CodeCard({ code, lang = 'javascript', title = '', note }: CodeCardProps) {
  return (
    <div className="codeblock">
      <div className="codeblock__bar">
        <span className="codeblock__lang">{lang}</span>
        {title ? <span>{title}</span> : null}
      </div>
      <pre>
        <code dangerouslySetInnerHTML={{ __html: highlightCode(code, lang) }} />
      </pre>
      {note ? (
        <div
          className="codeblock__note"
          style={{ padding: '10px 16px', borderTop: '1px solid var(--line-soft)', fontSize: '12.5px', color: 'var(--text-faint)' }}
          dangerouslySetInnerHTML={{ __html: note }}
        />
      ) : null}
    </div>
  );
}
```

高亮器必须逐字移植 `web/scripts/ui.js` 的 `highlight`、`escapeHtml`、三套 `RULES`：

- `escapeHtml` 只替换 `&`、`<`、`>`，不替换引号（与 v2 一致）；
- 注释/字符串占位符 `@@PH${index}@@`、关键字 `tok-key`、数字 `tok-num`、注释 `tok-com`、字符串 `tok-str` 不变；
- `lang === 'sql'` 用 `SQL_RULES`，`lang === 'python'` 用 `PY_RULES`，其余用 `JS_RULES`；
- 不要升级为 Prism/Shiki 或重写正则。

### 3.5 任务组件

`TaskRenderer` 按 `task.kind` 分派；`mcq` 在课时页「概念检查」与「本讲练习」都可能出现，其余三类只在练习区。

#### 3.5.1 MCQ（`McqTask`）

| 元素 | 契约 |
| --- | --- |
| 外层 | `div.quiz` |
| 头部 | `div.quiz__head`：`span.badge.badge--blue` 文本 `多选题`（`task.type === 'multi'`）或 `单选题`；`span.tiny.muted` 文本 `task.tag || '概念检查'` |
| 题干 | `p.quiz__q`，`RichText`（`task.question`） |
| 提示 | `p.quiz__hint`，文本 `提示：${task.hint}` |
| 选项 | `ul.opt-list`；每项 `button.opt[type=button]`：`span.opt__key`（A–F）+ `span` RichText（`option.text`） |
| 选择 | 单选：清空其他后再选；多选：toggle。选中加 `is-picked`；已判定后按钮 `disabled` |
| 判定 | 未选：toast `请先选择答案`，不记录；已选：`store.recordAnswer(task.id, chosen, right)` |
| 判定后 | 正确项加 `is-right` 并追加 `span.opt__mark` 文本 `✓ 正确`；选中但错误项加 `is-wrong` 并追加 `✗ 你的选择` |
| 反馈 | `div.quiz__feedback.is-right/.is-wrong`：`<b>答对了</b>　` 或 `<b>答错了</b>　` + `task.explain`（HTML） |
| 按钮 | `提交答案` 隐藏、`再试一次` 显示 |
| 重试 | 清空选择、恢复按钮、移除标记与反馈 |
| 已保存且正确 | 恢复选项与 `is-picked`，执行一次「判定后」绘制 |
| 已保存且错误 | 选项禁用并显示 `is-picked`；反馈 `is-wrong`，内容 `<b>上次答错</b>　再试一次，看看解析里的关键点。`；不揭示正确项 |

`right` 判定：多选要求选中数量等于正确项数量且全部正确；单选要求恰好一项且正确。

#### 3.5.2 代码题（`CodeTask`）

轨道：`task.python ? ['javascript','python'] : ['javascript']`；初始轨道为全局语言（若有 Python），否则 JS。

头部 `div.exercise__head`：

- `span.badge.badge--amber` 文本 `代码题`；
- `h3` 文本 `task.title || '完成实现'`；
- 有双轨时 `div.track-tabs[role=tablist][aria-label="练习语言"]`，按钮 `button.track-tab[type=button][role=tab]`，文本 `languageLabel(track)`，当前加 `is-active` 与 `aria-selected="true"`；
- `span.tiny` 状态位：`已通过 · ${meta.label} 轨道`（颜色 `var(--teal)`）；或 `${otherLabel} 轨道已通过，本轨道待完成`（`tiny muted`）；否则空。

轨道主体（以 `key={track}` 重挂载，切换轨道等于 v2 的卸载/重建）：

- 编辑器：`textarea[spellcheck=false][aria-label="${task.title || '代码编辑器'}"]`；初值 `readDraft(progressId) ?? variant.starter ?? ''`；`oninput` 写草稿；
- `progressId`：Python 轨道 `${task.id}@py`，JS 轨道 `task.id`；
- `.code-editor > .code-editor__bar` 两段文本：`meta.file`、`meta.runtime`；
- `.code-editor__foot`：四个按钮 `运行测试`、`重置代码`、`查看提示`、`查看参考答案`，右侧 runtime 说明；
- runtime 说明：
  - JS：`在浏览器沙箱中执行`；
  - Python：订阅 `onPythonStatus`，优先 `pythonLoadError()` → `Python 运行时加载失败，请检查网络后重试`；`pythonReady()` → `Pyodide · Python 3.13 · 浏览器内执行`；否则 `首次运行需下载 Python 运行时（约 10 MB）`；挂载时调用 `warmPython()`；卸载时取消订阅。

运行流程（逐字对齐 v2）：

1. 禁用按钮；文本：Python 未就绪时 `加载运行时…`，否则 `运行中…`；
2. 测试列表替换为单项 `li.test-item.is-pending`：icon `…`，名称 `正在加载 Python 运行时，首次约需 10 秒…` 或 `正在执行测试…`；
3. JS harness：每个测试拼接 `__run(${JSON.stringify(name)}, async function () { ${test.code} });`；`runTests(source, harness, { timeout: task.timeout || 6000 })`；
4. Python：`pythonHarness(tests)`（E1 `engine/python/harness.ts`）+ `runPythonTests(source, harness, { timeout: task.timeout || 8000 })`；
5. 异常兜底：`{ runtimeError: true, results: [{ name: '运行环境', ok: false, error: message }], logs: [] }`；
6. 渲染结果：`li.test-item.is-pass/.is-fail`，icon `✓`/`✕`，名称 + 可选错误文本；有日志时写入 `div.console-out`，按 `log-${level}` span 分行；
7. `expected = tests.length`；`ok = expected > 0 && results.length === expected && passed === expected`；非运行时异常时 `store.recordAnswer(progressId, [], ok)`；
8. toast：
   - 运行时异常且错误文本含 `执行超过` → `运行超时，本次不计入练习记录`；
   - 其他运行时异常 → `运行环境没有就绪，本次不计入练习记录`；
   - 全过 → `${meta.label} 轨道全部测试通过`；
   - 执行数不等于期望 → `测试未全部执行（${results.length}/${expected}），请查看下方结果`；
   - 其他 → `${passed}/${expected} 项测试通过`；
9. 恢复按钮文本 `运行测试`。

其他按钮：

- `重置代码`：编辑器回到 `variant.starter ?? ''`，写草稿，清空测试结果与日志；
- `查看提示` ⇄ `收起提示`：切换 `div.hint-box` 的 `display`，内容 `<b>提示</b>　${task.hint}`；
- `查看参考答案` ⇄ `收起参考答案`：首次展开生成 `h4` 文本 `参考答案 · ${meta.label}` + `pre` 文本 `variant.solution || '本题不提供标准答案，重点是思路。'`。

#### 3.5.3 SQL 题（`SqlTask`）

| 区域 | 契约 |
| --- | --- |
| 外层 | `div.exercise`；头部 `div.exercise__head`：`badge badge--violet` 文本 `SQL 题`；`h3` 文本 `task.title || '写出查询'`；状态 `span.tiny`，通过时文本 `已通过 · 结果与预期一致`（teal） |
| 说明 | `p.exercise__brief`，RichText `task.brief` |
| 表结构 | `div.sql-console`；每张表 `div.sql-table`：`div.sql-table__name` + `table`（`thead td` 列名、`tbody` 行）；`null/undefined` 渲染文本 `NULL` 且类 `is-null` |
| 编辑器 | `div.code-editor`：bar 文本 `query.sql`；`textarea[aria-label="SQL 编辑器"][spellcheck=false]`，`min-height:120px`；初值 `readDraft(task.id) ?? task.query ?? ''` |
| 按钮 | `执行 SQL`、`重置`、`查看提示`、有 `task.solution` 时 `查看参考答案`；右侧说明 `迷你 SQL 引擎 · 浏览器内执行` |
| 执行 | `const db = createDatabase(task.tables || {})`；`runQuery` 抛错 → 错误反馈 `<b>SQL 执行失败</b>　${message}`，`store.recordAnswer(task.id, [], false)` |
| 判定 | `ok = outcome.kind === 'select' && rowsEqual(outcome.rows, task.expected || [], outcome.columns)`；记录答案 |
| 正确 | 结果表（`tbl-wrap > table.tbl`，thead th，null 类 `is-null`）+ `div.quiz__feedback.is-right` HTML `<b>正确</b>　查询结果与预期完全一致。` |
| 错误 | 结果表 + `div.quiz__feedback.is-wrong`：`b` 文本 `结果与预期不一致`；`预期结果：`；`pre` 文本 `JSON.stringify(task.expected || [], null, 1)` |
| 非 SELECT | `div.quiz__feedback`（`border-color:var(--line);background:var(--ink-750)`）HTML `<b>执行完成</b>　${outcome.message}` |
| 0 行 | 同风格反馈 HTML `<b>查询成功</b>　返回 0 行` |

提示与参考答案的切换文案、结构同代码题（参考答案标题为 `参考答案`，无轨道后缀）。

#### 3.5.4 方案题（`DesignTask`）

| 区域 | 契约 |
| --- | --- |
| 外层 | `div.exercise`；头部：`badge badge--teal` 文本 `方案题`；`h3` 文本 `task.title || '设计方案'` |
| 说明 | `p.exercise__brief`，RichText `task.prompt || task.brief || ''` |
| 规格 | 有 `task.specs` 时 `dl.exercise__specs`，每项 `div.spec-row > dt` + `dd`（RichText） |
| 自检清单 | `div.aside-card[style="margin-top:14px"]`；标题行 `h3` `自检清单` + 状态 `span.tiny`；`div`（`display:grid;gap:8px;margin-top:8px`）内逐项 `label`（`display:grid;grid-template-columns:16px 1fr;...`）：`input[type=checkbox][style="margin-top:4px;accent-color:var(--teal)"]` + `span` 文本 |
| 状态 | `自检 ${checked}/${total}`；全选追加 ` · 已完成`，并转 teal |
| 记录 | 每次 change：`store.recordChecklist(task.id, checkedIndexes, checklist.length)` |
| 我的方案 | `div.aside-card[style="margin-top:12px"]`；`h3` `我的方案`；`textarea` 占位 `写下你的方案要点：接口设计、状态码、数据结构、边界处理、失败场景……`；`min-height:140px`；初值 `readDraft('note:' + task.id) ?? ''`；输入写草稿 |
| 参考要点 | 按钮 `对照参考要点` ⇄ `收起参考要点`；`div.reference`（默认 `display:none`）：`h4` `参考要点` + RichText `task.reference` |

#### 3.5.5 草稿模块（`exercises/drafts.ts`）

```ts
import { DRAFT_KEY } from '../../state/store';

export function readDraft(id: string): string | null { /* 解析失败返回 null */ }
export function writeDraft(id: string, value: string): void { /* 写失败静默忽略 */ }
```

约束：

- 键名固定 `bff-lab-drafts-v1`，不新增命名空间；
- 只在挂载时读一次，输入时写；不得在每次渲染时读，避免覆盖用户正在输入的内容；
- 草稿损坏不影响页面渲染；写入失败不影响交互；
- 不迁移、不清空已有草稿；重置进度时由外壳删除整个键（E2 已实现）。

### 3.6 项目页（`#/project/:projectId`）

无效 ID：`div.page > div.empty-state`，文本 `找不到这个项目。`，无返回按钮。

有效项目：

| 区域 | 契约 |
| --- | --- |
| `section.project-hero` | `span.eyebrow`：`project.stageLabel || '阶段项目'`；`h1`（`margin-top:8px`）项目标题；`p` `project.brief`；操作行：`badge badge--amber` 文本 `里程碑进度 ${done}/${total}`；每个 `stack` 项一个 `badge badge--muted` |
| 左列 | 有 goal：`div.aside-card`，`h3` `你要交付什么`，`p` RichText `goal` |
| | 有 steps：`div.aside-card`，`h3` `实施路线`，`ul > li` RichText |
| 里程碑面板 | `div.panel > .panel__head`：`h3` `里程碑清单`；右侧 `span.tiny.muted` 文本 `做完一项就勾上，进度保存在本机` |
| | `ul.milestone-list`，每项 `li.milestone`（完成加 `is-done`） |
| 里程碑项 | `button.milestone__box[type=button][aria-label="标记 ${title} 完成"]`，内部 SVG；点击 `store.toggleMilestone(project.id, milestone.id)`，`li` 切换 `is-done`，进度徽章按最新 store 重算 |
| | `div.milestone__title`、`div.milestone__desc`（RichText）、可选 `div.milestone__line`（`b` `交付：` + RichText） |
| | 可选 `div.milestone__block`：`b.milestone__label` `可观察验收` + `ul.milestone__checks > li`（RichText） |
| | 可选证据块：`b.milestone__label` `证据` + `div.milestone__chips > span` |
| | 可选 `div.milestone__meta`：`b` `复用：` + `a` 链接（`#/project/{id}`，文本 id，` / ` 分隔）；`b` `关联：` + RichText 项 |
| | 可选 `div.milestone__crit` HTML `一句话验收：${criteria}` |
| | 仅毕业项目：`textarea.milestone__note`，占位 `记录这个里程碑的证据位置、缺口与下一步……`，值 `store.milestoneNote(project.id, milestone.id)`，输入持久化 |
| 右列 | 有 `deliverables`：卡 `交付物` + `ul > li` RichText |
| | 有 `checklist`：卡 `验收自评` + `ul > li` RichText |
| | 有 `stretch`：卡 `进阶挑战（选做）` + `ul > li` RichText |
| | 项目笔记：`div.aside-card`，`h3` `项目笔记`，`textarea` 占位 `记录你的设计决策、踩过的坑、待解决的问题……`，`min-height:170px`；值 `store.projectNote(project.id)`，输入持久化 |
| 模板区（有 `templates`） | `section.panel[style="margin-top:28px"]`；head：`h3` `答辩模板库`；`span.tiny.muted` 文本 `${templates.length} 份模板；复制到 docs/ 后逐项填写` |
| | `div.template-grid`；每份 `article.template-card`：head `h4` 标题 + 按钮 `复制模板`；`p.template-card__purpose`；`p.template-card__when` 文本 `使用时机：${when}`；`pre.template-card__body > code` 文本 `body` |

复制行为：

- 优先 `navigator.clipboard.writeText`；失败时用隐藏 `textarea` + `document.execCommand('copy')` 兜底；两者都失败返回 `false`；
- 成功：按钮文本 `已复制`，toast `已复制：${template.title}`；失败：按钮 `复制失败`，无 toast；
- 1600ms 后按钮恢复 `复制模板`；
- 卸载时清理定时器（`useEffect` cleanup）。

进度徽章是派生值，不得像 v2 那样手动改文本；里程碑变化通过 `useProgress()` 版本触发重渲染。

### 3.7 HTTP 实验台（`#/lab`）

### 3.7.1 静态结构与固定文案

| 区域 | 契约 |
| --- | --- |
| 页面根 | `div.page.page--wide` |
| 标题区 | `h1` `HTTP 实验室`；说明 `亲手发请求，看状态码、响应头与错误体到底长什么样。左边是教学场景，点一下自动填好请求。` |
| 模式 tabs | `div.tabs[style="width:280px"]`；两个 `button.tab[type=button]`：`内置模拟服务`、`真实端点`；当前加 `is-active` |
| 左列 | 10 个场景按钮，顺序与文案见 §3.7.2 |
| 请求构造器 | `div.panel`；head `h3` `请求构造器` + 右侧 `复制为 curl`、`重置` |
| 请求行 | `select`（GET/POST/PUT/PATCH/DELETE）+ `input.mono.lab-path-input[aria-label="请求路径"]` |
| 请求头 | `p.eyebrow` `请求头`；每行两个输入（`Header` / `Value`）+ `×` 删除按钮；末尾 `+ 添加请求头` |
| 请求体 | `p.eyebrow` `请求体`；`textarea.mono` 占位 `{ }` |
| 发送 | `button.btn.btn--primary` `发送请求`；右侧说明 `发送后可在下方查看状态码、响应头与响应体` |
| 响应面板 | `div.panel`：head `响应`；body 内渲染 §3.7.4 |
| 最近请求 | `div.panel`：head `最近请求`；body 内历史或空状态 `还没有请求记录。` |
| 教学箱 | 页面底部 `div.panel[style="margin-top:24px"]`：head `这个场景在教什么`；body `p.tiny.muted` 显示当前教学文案 |

教学文案（逐字）：

- 初始：`选一个左侧场景开始。每一段都对应一个后端必须回答的问题。`
- 切到模拟：`内置模拟服务在浏览器里运行，行为固定可复现，适合练习状态码与请求头的语义。`
- 切到真实：`真实端点指向已部署的边缘函数。若站点未部署函数或当前是本地预览，会收到失败提示——这本身就是「环境差异」的第一课。`
- 场景：使用下表 `teach` 原文。

### 3.7.2 场景表（顺序、请求、教学文案均不可改）

| id | 按钮文案 | 方法/路径 | 请求头 | 请求体 | teach |
| --- | --- | --- | --- | --- | --- |
| list | 列表与分页 | `GET /api/users?page=1&limit=3` | `Accept: application/json` | 空 | `列表接口要同时返回 items 与分页元信息，前端才知道有没有下一页。` |
| create-ok | 创建成功（201） | `POST /api/users` | `Content-Type: application/json` | `{"name":"赵敏","email":"zhaomin@example.com","role":"member"}`（2 空格缩进） | `POST 创建资源应返回 201，并在 Location 头里给出新资源的地址。` |
| create-invalid | 校验失败（422） | `POST /api/users` | 同上 | `{"name":"","email":"not-an-email"}` | `字段级校验错误要给出字段名与原因，前端才能把红字标在对应输入框上。` |
| duplicate | 资源冲突（409） | `POST /api/users` | 同上 | `{"name":"张伟","email":"zhangwei@example.com"}` | `唯一键冲突不是客户端的格式错误，用 409 区分于 422，前端才能给出准确文案。` |
| unauthorized | 未认证（401） | `GET /api/me` | `Accept: application/json` | 空 | `401 表示「你是谁还不知道」，前端应该带着凭据重试一次。` |
| forbidden | 无权限（403） | `DELETE /api/users/2` | `Accept` + `Authorization: Bearer demo-token-viewer` | 空 | `403 表示「知道你是谁，但这个操作你不能做」，重试没有意义。` |
| ratelimit | 触发限流（429） | `GET /api/reports/export` | `Accept: application/json` | 空 | `429 要带 Retry-After，告诉客户端多久后再来；否则客户端会疯狂重试。连点三次「发送请求」，第三次就会收到 429。` |
| cache | 条件请求（304） | `GET /api/config` | `Accept` + `If-None-Match: W/"cfg-v3"` | 空 | `带上 If-None-Match 再发一次，数据没变时服务端只回 304，不重传 body。` |
| idempotent | 幂等键（重复提交） | `POST /api/payments` | `Content-Type` + `Idempotency-Key: demo-key-001` | `{"amount":19900,"currency":"CNY"}` | `同一个 Idempotency-Key 重复提交只产生一次副作用，第二次直接返回首次结果。连点两次「发送请求」，对比两次响应里的 idempotency-replayed。` |
| slow | 慢响应与超时 | `GET /api/slow?ms=1200` | `Accept: application/json` | 空 | `客户端必须设超时；没有超时的请求会一直占着连接池。` |

点击场景：填入方法、路径、请求头、请求体；教学箱替换为该场景 `teach`；toast `已载入场景：${title}`。

### 3.7.3 内置模拟服务

`runMock(request, mockState)` 必须是纯函数式实现（只读写传入的 `mockState`），便于单测；`mockState` 包含：

```ts
interface MockState {
  users: MockUser[];
  rateLimitCount: number;
  idempotencyStore: Map<string, { status: number; body: unknown }>;
}
```

种子用户 5 条（顺序、字段、日期逐字）：

```ts
{ id: 1, name: '张伟', email: 'zhangwei@example.com', role: 'admin', createdAt: '2026-01-04' }
{ id: 2, name: '李娜', email: 'lina@example.com', role: 'member', createdAt: '2026-02-11' }
{ id: 3, name: '王强', email: 'wangqiang@example.com', role: 'member', createdAt: '2026-03-22' }
{ id: 4, name: '陈静', email: 'chenjing@example.com', role: 'member', createdAt: '2026-04-09' }
{ id: 5, name: '刘洋', email: 'liuyang@example.com', role: 'viewer', createdAt: '2026-05-30' }
```

路由与响应（状态码、头、错误码逐字）：

| 条件 | 响应 |
| --- | --- |
| `GET /api/users` | `200`；`{ items, pagination: { page, limit, total, totalPages } }`；`page` 默认 1、`limit` 默认 10；`total` 为当前用户数 |
| `POST /api/users`，请求体非法 JSON | `400` `{ error: { code: 'invalid_json', message: '请求体不是合法的 JSON' } }` |
| `POST /api/users`，`name` 为空 | `422` `{ error: { code: 'validation_failed', message: '请求参数校验未通过', details: [{ field: 'name', message: 'name 不能为空' }] } }` |
| `POST /api/users`，email 不匹配 `/^[^@\s]+@[^@\s]+\.[^@\s]+$/` | `422`，同上，`details` 含 `{ field: 'email', message: 'email 格式不正确' }` |
| `POST /api/users`，email 已存在 | `409` `{ error: { code: 'email_taken', message: '该邮箱已被注册' } }` |
| `POST /api/users`，创建成功 | `201` `{ data: created }`，`location: /api/users/${created.id}`；`created = { id: users.length + 1, ...payload, role: payload.role || 'member', createdAt: 当天 ISO 日期 }` |
| `DELETE /api/users/:id`，无 Token | `401` `{ error: { code: 'unauthenticated', message: '缺少访问令牌' } }` |
| `DELETE`，Token 不是 `demo-token-admin` | `403` `{ error: { code: 'forbidden', message: '当前令牌没有删除权限' } }` |
| `DELETE`，Token 正确 | `204`，空响应体 |
| `GET /api/me`，无 Token | `401`，`www-authenticate: Bearer realm="lab"` |
| `GET /api/me`，有 Token | `200` `{ data: { id: 42, name: '演示用户', scopes: ['read'] } }` |
| `GET /api/config`，`If-None-Match: W/"cfg-v3"` | `304`，`etag: W/"cfg-v3"`，`cache-control: private, max-age=60`，空 body |
| `GET /api/config`，其他 | `200` `{ data: { theme: 'dark', locale: 'zh-CN', version: 3 } }` + 同上头 |
| `GET /api/reports/export`，第 1–2 次 | `200` `{ data: { exportId: 'exp_1024', status: 'processing' } }`，`x-ratelimit-limit: 2`，`x-ratelimit-remaining: 2-count` |
| `GET /api/reports/export`，第 3 次起 | `429` `{ error: { code: 'rate_limited', message: '请求过于频繁，请稍后再试' } }`，`retry-after: 3`，`x-ratelimit-limit: 2`，`x-ratelimit-remaining: 0` |
| `POST /api/payments`，无 `Idempotency-Key` | `400` `{ error: { code: 'idempotency_key_required', message: '写接口必须携带 Idempotency-Key' } }` |
| `POST /api/payments`，首次 key | `201` `{ data: { id: 'pay_7781', amount: 19900, currency: 'CNY', status: 'succeeded' } }`，`idempotency-replayed: false` |
| `POST /api/payments`，重复 key | 缓存状态码与 body，`idempotency-replayed: true` |
| `GET /api/slow?ms=N` | `200` `{ data: { sleptMs: N || 1200 } }`；有 `ms` 时延迟 N 毫秒后返回 |
| `GET /api/status/:code` | 强制返回该状态码 + `{ error: { code: 'forced', message: '手动触发 ${code}' } }` |
| 其他 | `404` `{ error: { code: 'not_found', message: '没有匹配的路由：${method} ${path}' } }` |

所有 JSON 响应的 `content-type` 为 `application/json; charset=utf-8`；`statusText` 映射表与 v2 `statusTextOf` 一致（至少覆盖 200/201/202/204/301/302/304/400/401/403/404/405/409/422/429/500/502/503/504）。

模拟模式的耗时显示：`Math.round(60 + Math.random() * 90)` ms（仅 UI 展示，不影响响应）。

### 3.7.4 真实端点

- 地址：`/functions/v1/app${path.replace(/^\/api/, '')}`；
- 8 秒超时（`AbortController`）；
- 只对非 GET/HEAD 发送 body；
- 返回状态、状态文本、响应头对象、响应文本、耗时；
- 失败：状态 `0`，状态文本 `请求失败`，body 为 `${error.message}\n\n提示：真实端点依赖已部署的边缘函数，本地预览环境通常不可用。`；超时为 `请求超时（8 秒）`；
- 不在本地 mock 真实端点；E3 不部署 `functions/`。

### 3.7.5 交互细节

- 发送中按钮禁用并显示 `请求中…`；完成后恢复 `发送请求`；
- 每次发送把 `{ method, path, headers, body, result }` 插入历史头部，最多保留 6 条；
- 响应区：
  - 第一行：`span.badge.${statusClass}` 文本 `${status} ${statusText}`；`span.tiny.muted` 文本 `${timeMs ?? '-'} ms`；存在 `idempotency-replayed` 响应头时追加 `span.badge.badge--violet` 文本 `幂等重放`；
  - 有响应头：`div.tbl-wrap` 表格，表头 `响应头` / `值`，键值单元格 `font-family:var(--font-code);font-size:12px`，键 teal、值可换行；
  - 最后 `div.console-out[style="max-height:none;margin-top:14px"]`，文本为响应体；空 body 显示 `(空响应体)`；
- 历史项：`div[style="display:flex;align-items:center;gap:10px;padding:7px 10px;border:1px solid var(--line-soft);border-radius:8px;font-size:12.5px"]`，内含状态徽章、`span.mono.tiny` 文本 `${method} ${path}`、`span.tiny.muted` 文本 `${timeMs ?? '-'} ms`；不可点击；
- `复制为 curl`：
  - 首行 `curl -i -X ${method} "http://localhost:3000${path}"`；
  - 每个非空请求头追加 `  -H "${key}: ${value}"`；
  - 非 GET 且有 body 时追加 `  -d '${body.replace(/'/g, "'\\''")}'`；
  - 以 ` \\\n` 连接；复制成功 toast `curl 命令已复制`；失败时在构造器底部插入 `pre` 显示命令（样式 `margin:0 18px 18px;padding:12px;background:var(--ink-900);border:1px solid var(--line);border-radius:9px;font-family:var(--font-code);font-size:12px;overflow-x:auto`）；
- `重置`：恢复 `GET /api/users?page=1&limit=3` + `Accept`；清空响应、历史与幂等表；`rateLimitCount = 0`；用户恢复种子；**教学文案按当前模式恢复**：`target === 'live' ? TEACH_LIVE : TEACH_IDLE`（v2 `lab.js` 第 409 行；重置不切换模式）；
- 状态码徽章映射：`0` → `badge--rose`；`<300` → `badge--teal`；`<400` → `badge--blue`；`<500` → `badge--amber`；其余 `badge--rose`。

### 3.8 学习报告（`#/report`）

页面根 `div.page`。标题区：`h1` `学习报告`；说明 `所有数据保存在本机浏览器。它回答一个具体问题：哪些知识点你已经真的掌握了，哪些只是读过去了。`

统计卡（`div.stat-grid`，顺序与色调固定）：

| 类 | 大数字 | 标签 |
| --- | --- | --- |
| `stat is-teal` | `${mastery.done}/${mastery.total}` | `课程掌握` |
| `stat is-violet` | `${answeredCount}` | `已作答题目` |
| `stat is-amber` | `${accuracy}%` | `题目通过率` |
| `stat` | `${doneMilestones}/${totalMilestones}` | `项目里程碑` |
| `stat is-rose` | `${wrongCount}` | `待攻克题目` |

计算规则（逐字对齐 v2 `report.js`）：

- `collectTasks()`：遍历 `curriculum` 的 45 讲，把 `checks + exercises` 放入 `Map(task.id → { task, lesson, stage })`；
- `mergeAnswers()`：遍历 `state.q`，`id = rawId.split('@')[0]`；未知 id 跳过；`attempts` 累加；`correct`/`solved` 取或；
- `answered`：`attempts > 0` 的条目；`answeredCorrect`：其中 `solved` 的数量；`accuracy = Math.round(answeredCorrect / answered.length * 100)`（无作答为 0）；
- `wrongList`：`answered` 中 `!solved` 且能在 `questionMap` 找到的任务，保持 `state.q` 键顺序；
- 项目集合：8 个阶段项目（按阶段顺序）+ 毕业项目；里程碑总数与完成数按项目的真实里程碑 id 计算；
- `mastery = courseMastery()`。

代码练习轨道（仅当存在 `kind === 'code' && python` 的题目时渲染）：

- `section.section`：`h2` `代码练习轨道`；说明 `同一道代码题在任一语言轨道通过，即计入课程掌握。两条轨道都做一遍，能把语言差异变成真正的理解。`；
- `div.panel > .panel__body > div.bar-list`；两条 `div.bar-row`：
  - `span.bar-row__label`：`Node.js 轨道` / `Python 轨道`；
  - `div.bar-row__track > i`：`width:${percent}%`，背景 `var(--teal)` / `var(--blue)`；
  - `span.bar-row__val`：`${done}/${codeTasks.length}`；
- `done` 分别用 `trackSolved(task, 'javascript')` / `trackSolved(task, 'python')`。

各阶段掌握度：

- `section.section`：`h2` `各阶段掌握度`；说明 `按「该阶段内已答对的题目数 / 总题目数」计算，反映真实的理解程度而不只是勾选。`；
- 9 行 `div.bar-row`：左侧 `a.bar-row__label` → `#/stage/{id}`，附录显示 `stage.title`，否则 `${stageLabel(stage)} · ${stage.title}`；轨道 `i` 宽度为 `${right}/${total}` 百分比（无题 0）；右侧 `${right}/${total}`；
- 题目 id 去重后统计；`right` 为该阶段 `answeredMap.get(id)?.solved` 的数量。

待攻克题目：

- `section.section`：`h2` `待攻克题目`；说明 `这些题你还没有答对。点进去重做一遍，比从头再看一遍有效得多。`；
- 有数据：`div.list-stack`，每项 `a.lesson-row` → `#/lesson/{lesson.id}`：
  - `span.lesson-row__num`：附录 `A`，否则阶段序号；
  - `div.lesson-row__title`：`task.prompt || task.question || '概念检查'`（`mcq`）或 `task.title || '练习'`；
  - `div.lesson-row__sub`：`design` → `${lesson.title} · 自检清单未完成`；否则 `${lesson.title} · 已尝试 ${attempts} 次`；
  - `span.badge.badge--rose` 文本 `重做`；
- 无数据：`div.empty-state` 文本 `目前没有待攻克的题目——要么你还没开始，要么你已经全部答对了。`

项目进度：

- `section.section`：`h2` `项目进度`；说明 `每个阶段的实战项目。项目的完成度比课程勾选更能说明你能不能真的交付。`；
- `div.list-stack`；每个项目 `a.panel`（`display:block;padding:16px 18px`）：
  - 第一行：`strong`（`font-size:14.5px`）项目标题 + 右侧 `span.badge`：100% 时 `badge--teal`，否则 `badge--muted`，文本 `${done}/${total}`；
  - 下方 `div.stage-card__bar[style="margin-top:10px"] > i`，宽度 `percent%`。

接下来学什么：

- 仅当前三讲未掌握时渲染；`section.section > div.panel`：head `h3` `接下来学什么`；body（`display:flex;gap:10px;flex-wrap:wrap`）内每讲一个 `a.btn.btn--ghost.btn--sm` → `#/lesson/{id}`，文本标题。

报告页数据量大，E3.5 使用 `useAllStages()`（懒加载全部阶段）；其余页面不加载全部内容。

### 3.9 固定文案与空状态汇总

以下文案必须逐字一致（已在各节列出，此处用于 review 时快速核对）：

| 场景 | 文案 |
| --- | --- |
| 无效课时 | `找不到这一讲，可能是链接有误。` + `返回总览` |
| 无效阶段 | `找不到这个阶段。` |
| 无效项目 | `找不到这个项目。` |
| 搜索无结果（E2 已实现） | `没有匹配的课程内容` |
| 重置确认（E2 已实现） | `确定要清空全部学习记录吗？此操作不可撤销。` |
| 重置成功（E2 已实现） | `学习记录已清空` |
| MCQ 未选择 | `请先选择答案` |
| 代码全过 | `${meta.label} 轨道全部测试通过` |
| 代码部分通过 | `${passed}/${expected} 项测试通过` |
| 代码执行数异常 | `测试未全部执行（${actual}/${expected}），请查看下方结果` |
| 运行超时 | `运行超时，本次不计入练习记录` |
| 运行环境未就绪 | `运行环境没有就绪，本次不计入练习记录` |
| SQL 通过 | `正确` + `查询结果与预期完全一致。` |
| SQL 不一致 | `结果与预期不一致` |
| 场景载入 | `已载入场景：${title}` |
| curl 复制 | `curl 命令已复制` |
| 模板复制 | `已复制` / `复制失败` / `已复制：${title}` |
| 学习报告空态 | `目前没有待攻克的题目——要么你还没开始，要么你已经全部答对了。` |

新增文案只允许加载态（E3.5）：`正在加载课程…`、`正在加载搜索索引…`。除此之外不得新增用户可见文案。

## 4. 关键设计决策

### 4.1 JSX 与 `h()` 的一一映射

v2 的 `h(tag, props, children)` 与 JSX 的对应关系固定：

| v2 | React |
| --- | --- |
| `h('div', { class: 'x' })` | `<div className="x" />` |
| `h('a', { href: '#/lab', text: 'x' })` | `<a href="#/lab">x</a>` |
| `h('span', { html: '<b>x</b>' })` | `<RichText as="span" html="<b>x</b>" />` |
| `h('button', { onclick })` | `<button type="button" onClick>` |
| `h('input', { oninput })` | `<input onInput>`（受控或非受控见各组件） |
| `h('textarea', { ... })` + `node.value = x` | 非受控：`defaultValue={x}`；需要重置时用 `key` 或 ref |
| `text: value` | 子节点字符串 |
| `style: 'a:b;c:d'` | `style={{ a: 'b', c: 'd' }}` |

不允许为了「React 习惯」调整 DOM 层级、类名顺序、内联样式或节点文本。

### 4.2 数据门面（为 E3.5 预留的唯一接缝）

`app/data/content.ts` 是页面读取课程数据的唯一入口：

```ts
export interface StageSummary {
  id: string;
  index: number;
  title: string;
  subtitle: string;
  duration: number;
  appendix: boolean;
  accent: 'teal' | 'amber' | 'violet' | 'rose' | 'blue' | 'green';
  lessonCount: number;
  projectId: string | null;
}

export interface LessonSummary {
  id: string;
  stageId: string;
  title: string;
  subtitle: string;
  duration: number;
  status: string;
  checks: number;
  exercises: number;
}

export interface LessonContext {
  lesson: Lesson;
  stage: Stage;
  prev: Lesson | null;
  next: Lesson | null;
}

export function useStageSummaries(): StageSummary[];
export function useLessonSummaries(): LessonSummary[];
export function useStage(stageId: string): Stage | null;
export function useLesson(lessonId: string): LessonContext | null;
export function useProject(projectId: string): Project | null;
export function useAllStages(): Stage[];
export function useGraduation(): Project;
export function useStats(): { mainStageCount: number; lessonCount: number; taskCount: number };
```

E3.1 的实现直接读取 E1 的 `curriculum`/`allLessons`，同步返回；E3.5 只改这个文件（以及新增的 loader 文件），所有页面与外壳无需改动。门面文件是**唯一**允许静态 import `content/index` 的运行时模块（E3.1 阶段）；E3.5 起它改为 `resources.ts` 的 `use()` 包装，运行时不再静态引用内容。

`useMastery()` 单独放在 `app/data/mastery.ts`，返回：

```ts
export interface MasteryView {
  course: { done: number; total: number; percent: number };
  stage(stageId: string): { done: number; total: number; percent: number };
  lesson(lessonId: string): boolean;
  nextLessonId: string | null;
}
```

E3.1 内部调用 `state/mastery-core.ts`；E3.5 改为基于 catalog 的等价实现，并由等价测试守卫。

#### 4.2.1 `state/mastery-core.ts`（无内容依赖）

E1 的 `state/progress.ts` 顶部从 `content/index` 导入 `allLessons`，任何运行时模块 import 它都会把全量课程拉进首屏。E3.1 先做一次纯函数拆分：

```ts
// web/scripts/state/mastery-core.ts —— 只 import store，禁止 import content
type Mastery = { done: number; total: number; percent: number };
type LessonLike = { id: string; checks?: Task[]; exercises?: Task[] };

export function lessonTasks(lesson: { checks?: Task[]; exercises?: Task[] }): Task[];
export function trackId(task: Task, language: string): string;
export function trackSolved(task: Task, language: string): boolean;
export function taskSolved(task: Task): boolean;
export function isLessonMastered(lesson: LessonLike): boolean;
export function stageMasteryLessons(lessons: LessonLike[]): Mastery;
export function courseMasteryLessons(lessons: LessonLike[]): Mastery;
export function nextLessonFrom(lessons: LessonLike[]): LessonLike | null;
```

- 函数体从 `progress.ts` 原样搬移，语义与 v2 逐字一致；
- `state/progress.ts` 改为：`lessonTasks`/`trackId`/`trackSolved`/`taskSolved`/`isLessonMastered` 直接 re-export `mastery-core`；`stageMastery`/`courseMastery`/`nextLesson` 调 `stageMasteryLessons`/`courseMasteryLessons`/`nextLessonFrom` 并传入 `allLessons`/`stage.lessons`。导出名、签名、调用方（v2 视图与引擎）零改动；
- 运行时 React 代码只允许 import `state/mastery-core`，禁止 import `state/progress`；该守卫从 E3.1 起生效：

```bash
grep -R "state/progress" web/scripts/app web/scripts/main.tsx && exit 1 || true
```

- E3.5 完成懒加载后追加内容依赖守卫（E3.1–E3.4 期间 `app/data/content.ts` 是唯一例外，E3.5 起它也不再静态 import）：

```bash
grep -R "content/index" web/scripts/app web/scripts/main.tsx && exit 1 || true
```

### 4.3 store 订阅与派生值

- 页面用 `useProgress()`（E2）拿到版本号后，通过 `useMemo` 重新计算掌握度、徽章、里程碑进度；
- 不复制 store 状态到组件 state，避免双份事实源；
- 报告页只读，不需要订阅；进入页面时读取 `store.get()` 即可；
- 实验台不读写 store；
- 所有订阅必须通过 `useSyncExternalStore`（E2 的 `useProgress`/`useLang`），不得手写 `store.subscribe` + `useState`。

### 4.4 草稿的读写时机

- 编辑器挂载时读一次：`useState(() => readDraft(key) ?? starter)`；
- 输入时写：`onInput` 直接 `writeDraft`，不 debounce（v2 同样逐键写入）；
- 轨道切换/语言重挂载时重新读对应键；
- 重置代码只重置当前轨道草稿；
- 方案题笔记键为 `note:${task.id}`，与代码/SQL 的键空间相同，不冲突。

### 4.5 引擎复用与资源清理

- 复用 E1 的 `runTests`、`runPythonTests`、`createDatabase`、`runQuery`、`rowsEqual`、`pythonHarness`，禁止在组件里复制判题逻辑；
- Python 状态订阅必须在组件卸载/轨道切换时取消；
- JS Worker 每次运行由 `runTests` 创建并终止，组件不缓存 Worker；
- 运行中的 Promise 在组件卸载后仍可能 resolve：用 `mountedRef` 忽略卸载后的 setState（React 18+ 不再警告，但避免无意义更新）；
- SQL 引擎是同步的，直接在点击处理器里执行。

### 4.6 高亮器移植

完整移植 `ui.js` 的三套规则与占位符算法（§3.4.1），不改正则、不改 token 类名。高亮结果只通过 `<code dangerouslySetInnerHTML>` 注入。测试用固定输入断言输出字符串完全一致（可从 v2 函数生成期望值）。

### 4.7 实验台的本地状态机

- 所有可变状态放在 `LabPage`：`method`、`path`、`headers`、`body`、`target`、`history`、`response`、`sending`、`teach`、`curlPreview`；
- 模拟服务的可变数据（用户、限流计数、幂等表）放在 `useRef<MockState>`，避免每次输入触发无意义的重渲染；
- 重置时整体替换 `mockRef.current`；
- 场景载入只改请求与教学文案，不清空历史与响应（与 v2 一致）；
- 模式切换只改 `target` 与教学文案，不改请求；
- 发送时读取当前输入快照，异步完成后写入响应与历史；组件卸载后忽略结果。

### 4.8 报告页派生数据

`app/report/report-model.ts` 导出纯函数：

```ts
export function buildReportModel(stages: Stage[], graduation: Project, state: StoreState): ReportModel;
```

所有统计（mergeAnswers、accuracy、wrongList、codeLanes、stageBars、projectBars、nextUp）都在纯函数内完成，组件只负责渲染。这样可以用单测覆盖所有边界（空进度、错题、多轨、附录、毕业项目），并与 v2 的输出逐项对比。

### 4.9 E3.5 懒加载设计

#### 4.9.1 目标

- 初次进入 React 站点只加载外壳 + catalog（约 15KB gzip），不加载 1.6MB 的课程正文；
- 进入阶段/课时/项目页时只加载该阶段 chunk；同一阶段内切换不重复请求；
- 报告页按需加载全部 9 个阶段 + 毕业项目；
- 搜索索引（约 199KB gzip）首次聚焦/输入搜索框后才加载；
- v2 入口完全不受影响。

#### 4.9.2 catalog 契约（E1 已产出）

E1 的 `catalog.json` 已包含外壳与掌握度计算所需的两个字段，本阶段直接消费：

```ts
interface Catalog {
  version: 1;
  stages: Array<{
    id: string; index: number; title: string; subtitle: string; duration: number;
    appendix: boolean; lessonCount: number; projectId: string | null;
    accent: 'teal' | 'amber' | 'violet' | 'rose' | 'blue' | 'green'; // E1 已产出
  }>;
  lessons: Array<{
    id: string; stageId: string; title: string; subtitle: string; duration: number;
    status: string; keywords: string[]; checks: number; exercises: number;
  }>;
  projects: Array<{ id: string; stageLabel: string; title: string; milestones: number }>;
  tasks: Array<{
    id: string; kind: 'mcq' | 'code' | 'design' | 'sql';
    title: string; lessonId: string; stageId: string;
    python: boolean; // E1 已产出：该任务是否有 Python 轨道
  }>;
}
```

`12-e1-types-and-content.md` 的 Catalog 契约已包含这两个字段，本阶段只消费，不再修改生成器契约。字段必须与真实内容一致：`accent` 取阶段原值；`python` 为 `Boolean(task.kind === 'code' && task.python)`。

#### 4.9.3 加载器

```ts
// web/scripts/app/data/resources.ts
import type { Stage, Project } from '../../content/types';
import { assembleStage, assembleProject } from '../../content/assemble';

const STAGE_LOADERS: Record<string, () => Promise<StageInput>> = {
  s0: async () => { const m = await import('../../content/stages/s0/index.js'); return { data: m.stage0, pythonBlocks: m.PYTHON_BLOCKS ?? {}, pythonTracks: m.PYTHON_TRACKS ?? {} }; },
  // ... s1–s7, appendix 同构，共 9 项
};

const stageCache = new Map<string, Promise<Stage | null>>();
export function loadStage(id: string): Promise<Stage | null> {
  let task = stageCache.get(id);
  if (!task) {
    task = (STAGE_LOADERS[id] ? importStage(id) : Promise.resolve(null));
    stageCache.set(id, task);
  }
  return task;
}

async function importStage(id: string): Promise<Stage | null> {
  const input = await STAGE_LOADERS[id]();
  return assembleStage(input, id);
}
```

- `assemble.ts` 增加导出 `assembleStage(input, stageId)` 与 `assembleProject(raw)`；`assembleContent` 内部改为调用它们，行为与 E1 完全一致（E1 装配测试必须继续全绿）；
- `loadStage` 必须缓存 **Promise**，保证 `use()` 看到稳定引用；
- 失败 Promise 也缓存，由错误边界展示失败页；
- 毕业项目：`loadGraduation()` 动态 `import('../../content/graduation.js')` + `assembleProject`，单独缓存；
- `loadAllStages()` 按 s0→appendix 顺序 `Promise.all`，供报告页使用；
- 类型可以 `import type` 自 `content/types.ts`（编译期擦除），但**不得**从 `content/index.ts` 取任何值或类型，保持模块图干净。

#### 4.9.4 `use()` 与 Suspense

```ts
import { use } from 'react';

export function useStage(id: string): Stage | null { return use(loadStage(id)); }
export function useCatalog(): Catalog { return use(loadCatalog()); }
```

- E3.5 在 `web/scripts/main.tsx` 最外层包 `<Suspense fallback={<BootFallback />}>`，因为侧栏也依赖 catalog；
- 页面级懒加载复用 E2 的 `<Suspense fallback={<PageFallback />}>`；
- `BootFallback` 使用现有类名：`div.app#app > main.main#main` + `div.page` + `div.empty-state`，文本 `正在加载课程…`；
- 不引入路由 `loader`，避免改变 E2 的路由表与错误边界。

#### 4.9.5 掌握度（catalog 版）

```ts
export function masteryFromCatalog(catalog: Catalog, state: StoreState): MasteryView {
  const taskByLesson = new Map<string, Catalog['tasks']>();
  catalog.tasks.forEach((task) => {
    const list = taskByLesson.get(task.lessonId) ?? [];
    list.push(task);
    taskByLesson.set(task.lessonId, list);
  });
  const solvedNode = (id: string) => Boolean(state.q[id]?.solved);
  const solvedPy = (id: string) => Boolean(state.q[`${id}@py`]?.solved);
  const lesson = (id: string) => {
    if (state.l[id]?.done) return true;
    const tasks = taskByLesson.get(id) ?? [];
    return tasks.length > 0 && tasks.every((task) => solvedNode(task.id) || (task.python && solvedPy(task.id)));
  };
  // course/stage/nextLessonId 按 catalog 顺序计算
}
```

必须与 `state/mastery-core.ts` 逐讲等价（`progress.ts` 在 E3.1 已委托同一实现），测试见 §8。`nextLessonId` 在全部掌握时返回 `catalog.lessons[0]?.id ?? null`。

#### 4.9.6 搜索索引按需加载

- 新增 `web/scripts/app/shell/search-docs.ts`：只含 `SearchDocument` 类型与纯函数 `searchFromDocs(docs, query)`，**禁止 import `content/index`**；
- `SearchDocument` 形状固定为 `{ href: string; title: string; sub: string; text: string }`；
- `SearchBox` 的运行时 import 从 `search.ts` 切换到 `search-docs.ts`；E2 的 `search.ts`（依赖 `curriculum`）只保留给单测对照，运行时不得引用（E3.7 用 `grep -R "from './search'" web/scripts/app` 守卫，命中即失败）；
- `SearchBox` 在首次 `focus` 或首次输入时调用 `loadSearchIndex()`；加载完成前，非空查询显示 `正在加载搜索索引…`；
- 加载完成后按现有键盘/鼠标行为渲染结果；
- 匹配规则：`query.trim().toLowerCase()`；对 `doc.text.includes(q)` 过滤；最多 12 条；
- 顺序必须等于 v2 的遍历顺序（阶段 → 该阶段课时 → 该阶段项目，最后毕业项目）；若 `build-content.ts` 当前顺序不是该顺序，调整生成顺序（不改匹配规则与文档内容）；
- `sub` 字段必须分别为：阶段 `${stageLabel} · ${stage.subtitle}`、课时 `${stageLabel} · ${lesson.subtitle || ''}`、阶段项目 `阶段项目`、毕业项目 `毕业项目`；
- 搜索索引加载失败：`console.warn` 并显示无结果，**不得**回退到 `searchCurriculum`（那会静态拉入全量内容，抵消 E3.5）；不得抛错阻断搜索框；
- 索引请求本身在首次聚焦前不发出，网络断言见 T-E3.5。

#### 4.9.7 构建与开发脚本

```json
{
  "scripts": {
    "content:build": "tsx tools/build-content.ts",
    "dev:next": "npm run content:build && vite --open /index.next.html",
    "build": "npm run content:validate && npm run content:build && npm run typecheck && vite build"
  }
}
```

- `content:build` 必须幂等；
- `web/generated/` 仍在 `.gitignore` 中，不提交；
- CI/E4 的 `verify` 需要先 `content:build`（E4 处理，E3 只保证本地命令可重复）。

### 4.10 焦点、滚动与抽屉

沿用 E2：路由切换 `scrollTo(0,0)` + `main.focus({ preventScroll: true })`；初次加载不抢焦点；抽屉在路径变化时关闭；skip link 聚焦 `main`。E3 不新增滚动逻辑。语言切换不改变路径，不触发滚动复位；课时页整页重挂载后浏览器保留滚动位置（与 v2 手动 `scrollTo(0, offset)` 等效）。

### 4.11 允许的无视觉差异增强

在不改变视觉、文案、DOM 文本与导航语义的前提下允许：

- MCQ 选项加 `aria-pressed`；
- 代码轨道、内容块轨道已有 `role=tab`/`aria-selected`，保持；
- 结果列表 `li` 加 `role=listitem`（`ul` 已有隐式 role，可不加）；
- 反馈容器加 `role="status"`（不得加 `aria-live="assertive"`）；
- 表格加 `scope="col"`（`th`）；
- 里程碑勾选按钮已有 `aria-label`，保持。

禁止：新增可见说明文字、改变标题层级、增加额外按钮、改变 toast 位置或时长。

### 4.12 错误与边界

- 内容中缺少字段时按 v2 的可选渲染规则处理（`title`/`subtitle`/`hint`/`solution`/`reference` 等）；
- `TaskRenderer` 对未知 kind 渲染 `div.empty-state` 文本 `未知题型：${kind}`；
- 高亮器遇到未知语言按 JS 规则处理（v2 行为）；
- 报告页在空进度下不得出现 NaN/Infinity；
- 实验台响应头值为数组时按 `String(value)` 渲染（与 v2 一致）；
- 所有链接指向的 ID 都来自内容，不做存在性重定向；无效 ID 由页面空状态处理。

## 5. 目标结构

```text
web/scripts/app/
  data/
    content.ts                    # 新增：数据门面（E3.1 同步实现；E3.5 换懒加载）
    mastery.ts                    # 新增：useMastery（E3.1 mastery-core；E3.5 catalog）
    resources.ts                  # E3.5 新增：loadStage/loadCatalog/loadSearchIndex
    types.ts                      # 新增：StageSummary/LessonSummary/MasteryView
  pages/
    OverviewPage.tsx              # 重写
    StagePage.tsx                 # 重写
    LessonPage.tsx                # 重写
    ProjectPage.tsx               # 重写
    LabPage.tsx                   # 重写
    ReportPage.tsx                # 重写
    EmptyState.tsx                # 保留
  lesson/
    RichText.tsx                  # 新增
    highlight.ts                  # 新增：v2 高亮器移植
    CodeCard.tsx                  # 新增
    CodeBlock.tsx                 # 新增：双轨切换
    blocks/
      TextBlock.tsx               # 新增
      CalloutBlock.tsx            # 新增：analogy/pitfall/note/tip
      ListBlock.tsx               # 新增
      StepsBlock.tsx              # 新增
      TableBlock.tsx              # 新增
      CompareBlock.tsx            # 新增
      FlowBlock.tsx               # 新增
      CaseBlock.tsx               # 新增
      index.tsx                   # 新增：12 类分派
  exercises/
    TaskRenderer.tsx              # 新增
    McqTask.tsx                   # 新增
    CodeTask.tsx                  # 新增
    SqlTask.tsx                   # 新增
    DesignTask.tsx                # 新增
    drafts.ts                     # 新增
  project/
    MilestoneList.tsx             # 新增
    TemplateCard.tsx              # 新增
    copy-text.ts                  # 新增
  lab/
    lab-data.ts                   # 新增：场景、种子、教学文案、状态码映射
    mock-server.ts                # 新增：runMock + statusTextOf
    live.ts                       # 新增：runLive
    curl.ts                       # 新增：buildCurl
    LabRequestBuilder.tsx         # 新增
    LabResponse.tsx               # 新增
  report/
    report-model.ts               # 新增
  shell/
    SearchBox.tsx                 # E3.5 修改：按需加载索引
    search-docs.ts                # E3.5 新增：SearchDocument + searchFromDocs（不依赖 content）
    search.ts                     # 保留：E2 版本，仅供单测对照，运行时不得引用

# 以下为 app/ 之外的路径
web/scripts/main.tsx              # E3.5 修改：根 Suspense + BootFallback
web/scripts/state/mastery-core.ts # E3.1 新增：无内容依赖的掌握度纯函数
web/scripts/state/progress.ts     # E3.1 修改：委托 mastery-core，导出签名不变
web/scripts/test/                 # 单测根目录（与 E0/E1/E2 约定一致）
  blocks.test.tsx
  tasks-mcq.test.tsx
  tasks-code.test.tsx
  tasks-sql.test.tsx
  tasks-design.test.tsx
  lesson-page.test.tsx
  overview-page.test.tsx
  stage-page.test.tsx
  project-page.test.tsx
  lab.test.tsx
  report.test.tsx
  mastery.test.ts
  search-docs.test.ts
e2e/
  content.spec.ts                 # 新增：React 66 路由正文与交互冒烟
  parity.spec.ts                  # 新增：v2 与 React 逐页正文对等
  interactions.spec.ts            # 新增：练习/项目/实验台/报告/搜索
  visual.spec.ts                  # 修改：支持 VISUAL_ENTRY 环境变量
```

修改文件：

| 文件 | 改动 |
| --- | --- |
| `web/scripts/app/shell/Sidebar.tsx` | 改用 `useStageSummaries` / `useLessonSummaries` / `useMastery`，DOM 与行为不变 |
| `web/scripts/app/shell/Topbar.tsx` | 进度环改用 `useMastery().course`，其余不变 |
| `web/scripts/state/mastery-core.ts` | E3.1 新增：`lessonTasks`/`trackId`/`trackSolved`/`taskSolved`/`isLessonMastered`/`stageMasteryLessons`/`courseMasteryLessons`/`nextLessonFrom`；只依赖 store |
| `web/scripts/state/progress.ts` | E3.1 改为委托 `mastery-core`，导出名与签名不变 |
| `web/scripts/app/data/content.ts` | E3.5 改为懒加载实现，导出签名不变 |
| `web/scripts/app/data/mastery.ts` | E3.5 改为 catalog 版 |
| `web/scripts/content/assemble.ts` | 新增 `assembleStage` / `assembleProject` 导出，`assembleContent` 复用 |
| `tools/build-content.ts` | 确认 catalog 含 `accent` / `python`（E1 产出）；搜索文档顺序与 `sub` 对齐 v2；导出可测试的纯函数 |
| `package.json` | `content:build` 加入 `build`；`dev:next` 先构建内容 |
| `e2e/visual.spec.ts` | 增加 `VISUAL_ENTRY` |
| `web/scripts/main.tsx` | E3.5 根 Suspense |
| `web/scripts/app/shell/SearchBox.tsx` | E3.5 索引按需加载与加载态；import 改为 `search-docs.ts` |
| `web/scripts/app/shell/search.ts` | 保留 E2 版本，仅供单测；不再被运行时引用 |

不新增依赖。

## 6. 任务卡

### T-E3.0 冻结逐页契约与对等基线

- **类型**：validation
- **依赖**：E2 门禁通过
- **产出**：
  - `docs/reviews/frontend-engineering/e3/contract.md`
  - `docs/reviews/frontend-engineering/e3/inventory.txt`
  - 更新后的 `e2e/__screenshots__/**`（v2 oracle，21 张）
  - `e2e/visual.spec.ts`（仅增加 `VISUAL_ENTRY`）
- **实现要求**：

1. 把 §3 的页面契约、§3.9 固定文案、§7 逐页功能清单复制到 `contract.md`，逐项标注 v2 证据位置（`web/scripts/views/*.js` 行号、`web/scripts/app.js` 函数名）；
2. 记录内容清单：12 类 block 各自出现次数、4 类 task 各自数量、45 讲中草稿数量、6 份模板、54 个里程碑；
3. 在 v2 浏览器里逐页手工核对并勾选 §7 清单；
4. 修改 `e2e/visual.spec.ts`：

```ts
const ENTRY = process.env.VISUAL_ENTRY || '';
// 每个页面：
await page.goto(`${ENTRY ? `/${ENTRY}` : '/'}${route}`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.locator('main h1').waitFor();
await page.waitForLoadState('networkidle');
await page.evaluate(async () => { await document.fonts.ready; });
```

测试标题不得包含 `ENTRY`，确保 v2 与 React 使用同一组快照名。

5. 重新生成 v2 视觉基线：

```bash
npm run build
npx playwright test e2e/visual.spec.ts --project=chromium --update-snapshots
ls e2e/__screenshots__ | wc -l
```

- **命令**：

```bash
mkdir -p docs/reviews/frontend-engineering/e3
npx tsx tools/content-stats.ts | tee docs/reviews/frontend-engineering/e3/inventory.txt
npx tsx tools/content-snapshot.ts | tee docs/reviews/frontend-engineering/e3/content-sha256.txt
npm run build
npx playwright test e2e/visual.spec.ts --project=chromium --update-snapshots
```

- **预期**：21 张基线；内容快照与 E1 一致；清单记录 12 类 block 与 4 类 task。
- **约束**：只记录与刷新基线，不改业务代码；发现 v2 自身缺陷按总纲 §12.3 记录，不顺手修。
- **证据**：`contract.md` 含勾选结果与截图路径；`inventory.txt`。
- **回滚**：删除 `docs/reviews/frontend-engineering/e3/`，`git checkout -- e2e/__screenshots__ e2e/visual.spec.ts`。
- **停止条件**：v2 白屏/控制台错误；快照与 E1 不一致；21 张基线数量不符。

### T-E3.1 数据门面、总览页与阶段页

- **类型**：feature
- **依赖**：T-E3.0
- **产出**：
  - `app/data/types.ts`、`app/data/content.ts`、`app/data/mastery.ts`
  - `state/mastery-core.ts` 新增 + `state/progress.ts` 委托改造
  - 重写 `OverviewPage.tsx`、`StagePage.tsx`
  - 修改 `Sidebar.tsx`、`Topbar.tsx`
  - 测试 `overview-page.test.tsx`、`stage-page.test.tsx`
- **实现要求**：

1. 按 §4.2.1 先拆分 `mastery-core.ts`，并用 E1 的 `state` 测试证明 `progress.ts` 对外行为不变；
2. 按 §4.2 实现同步门面；`useStageSummaries`/`useLessonSummaries` 用 `useMemo` 稳定引用；
3. `useMastery` 用 `useProgress()` 版本刷新，内部调用 `state/mastery-core.ts`；
4. 总览页按 §3.1 实现，所有数值来自门面 + mastery，不硬编码 45/214；
5. 阶段页按 §3.2 实现；`useStage` 返回 `null` 时只渲染空状态；
6. 侧栏改用门面后，阶段折叠状态、激活状态、滚动位置与 E2 完全一致；顶部进度环指向 `mastery.course`；
7. 依赖守卫：`grep -R "state/progress" web/scripts/app web/scripts/main.tsx` 无输出；
8. 测试：
   - 总览：4 个统计数字与 9 张阶段卡；附录卡序号文本；有/无草稿的 meta；CTA 文案随进度变化；
   - 阶段：无效 ID；hero 徽章序列；lesson-row 序号（普通/附录）；草稿/已掌握徽章；侧栏项目卡；空 outcome。
- **命令**：

```bash
npm run lint
npx tsc --noEmit -p tsconfig.json
npx vitest run web/scripts/test/overview-page.test.tsx web/scripts/test/stage-page.test.tsx
npx playwright test e2e/shell.spec.ts --project=chromium
```

- **预期**：单测全绿；外壳 66 路由仍通过；总览与阶段页在 React 入口渲染无控制台错误。
- **约束**：不改 CSS；不改侧栏 DOM；不引入新状态库；阶段页不得为了取 keywords 而预加载全部阶段。
- **证据**：单测输出；`#/` 与 `#/stage/s0`、`#/stage/appendix` 的截图对比（允许内容差异为 0）。
- **回滚**：`git revert` 本任务提交（页面回到 E2 骨架）。
- **停止条件**：统计数字与 v2 不一致；阶段卡顺序/颜色变化；侧栏行为回归。

### T-E3.2 课时页、12 类内容块与检查题

- **类型**：feature
- **依赖**：T-E3.1
- **产出**：
  - `lesson/RichText.tsx`、`lesson/highlight.ts`、`lesson/CodeCard.tsx`、`lesson/CodeBlock.tsx`
  - `lesson/blocks/*`（9 个文件覆盖 12 类）
  - 重写 `LessonPage.tsx`
  - `exercises/TaskRenderer.tsx`、`exercises/McqTask.tsx`
  - 测试 `blocks.test.tsx`、`lesson-page.test.tsx`、`tasks-mcq.test.tsx`
- **实现要求**：

1. 高亮器逐字移植 §3.4.1；用 v2 的 `highlightCode` 对 6 组样例（JS 注释/字符串/数字、Python 三引号、SQL 注释）生成期望字符串写入测试；
2. 12 类 block 按 §3.4 实现；未知类型输出固定文案；
3. `CodeBlock` 双轨：初始轨道取全局语言；tab 切换只改本地状态；
4. 课时页按 §3.3 实现：meta、草稿横幅、objectives、两块题目区、掌握按钮、项目链接、prev/next；
5. 课时页以 `key={currentLang}` 整页重挂载；
6. MCQ 按 §3.5.1 实现，包括保存态恢复；
7. 测试覆盖：
   - 12 类 block 各渲染一次，断言关键类名与文本；
   - code 双轨 tab 切换与 `hidden`；
   - flow 展开/收起；
   - 无效课时；
   - 草稿课时隐藏 objectives、显示横幅、隐藏掌握按钮；
   - MCQ 单选/多选/未选择/答错重试/保存态；
   - 语言切换后代码块轨道重置且草稿保留。
- **命令**：

```bash
npx vitest run web/scripts/test/blocks.test.tsx web/scripts/test/lesson-page.test.tsx web/scripts/test/tasks-mcq.test.tsx
npx playwright test e2e/content.spec.ts --project=chromium -g "lesson"
```

- **预期**：全部通过；s0-l1 与一门附录课时的正文文本与 v2 一致（先手工比对，E3.6 自动比对全部）。
- **约束**：不改内容；不把 12 类 block 合并；不使用第三方高亮库；不改变草稿键。
- **证据**：单测；s0-l1、s7-l5、appendix 课时的截图与 v2 对照。
- **回滚**：`git revert` 本任务提交（课时页回到骨架）。
- **停止条件**：任一 block 渲染类名变化；高亮输出与 v2 不一致；MCQ 记录语义变化。

### T-E3.3 代码题、SQL 题、方案题与草稿

- **类型**：feature
- **依赖**：T-E3.2
- **产出**：
  - `exercises/CodeTask.tsx`、`SqlTask.tsx`、`DesignTask.tsx`、`drafts.ts`
  - 扩展 `TaskRenderer`
  - 测试 `tasks-code.test.tsx`、`tasks-sql.test.tsx`、`tasks-design.test.tsx`
- **实现要求**：

1. 按 §3.5.2–§3.5.4 实现三种任务，文案、类名、toast、状态位逐字对齐；
2. 代码题引擎调用 E1 API；测试中用 `vi.mock` 替换 runner/python，避免 jsdom Worker；
3. 轨道切换以 `key={track}` 重挂载，清空测试结果；编辑内容已逐键写入草稿；
4. SQL 用真实 E1 引擎在 jsdom 中执行（同步），覆盖正确、错误、非 SELECT、0 行；
5. 方案题覆盖勾选记录、全选状态、笔记草稿、参考要点切换；
6. 草稿测试：读写、损坏 JSON 回退、写入异常静默；
7. 卸载测试：Python 订阅取消、定时器清理（用 fake timers）。
- **命令**：

```bash
npx vitest run web/scripts/test/tasks-code.test.tsx web/scripts/test/tasks-sql.test.tsx web/scripts/test/tasks-design.test.tsx
```

- **预期**：三类任务全绿；SQL 结果与 E1 `run-sql-exercises` 语义一致。
- **约束**：不改 `engine/**`；不在组件内复制 `pythonHarness`；不改变 `@py` 轨道 id 规则；不改变草稿键。
- **证据**：单测；手工在 React 入口跑 1 道 JS、1 道 SQL、1 道方案题并截图。
- **回滚**：`git revert` 本任务提交。
- **停止条件**：同一答案在 v2 与 React 判定不同；草稿互相覆盖；Python 订阅泄漏（切轨道后仍更新 UI）。

### T-E3.4 项目页、实验台与报告页

- **类型**：feature
- **依赖**：T-E3.3
- **产出**：
  - 重写 `ProjectPage.tsx`、`LabPage.tsx`、`ReportPage.tsx`
  - `project/MilestoneList.tsx`、`TemplateCard.tsx`、`copy-text.ts`
  - `lab/lab-data.ts`、`mock-server.ts`、`live.ts`、`curl.ts`、`LabRequestBuilder.tsx`、`LabResponse.tsx`
  - `report/report-model.ts`
  - 测试 `project-page.test.tsx`、`lab.test.tsx`、`report.test.tsx`
- **实现要求**：

1. 项目页按 §3.6 实现；毕业项目里程碑笔记只有 `p-graduation` 渲染；模板复制含 1600ms 恢复与卸载清理；
2. 实验台按 §3.7 实现；`runMock`/`runLive`/`buildCurl` 抽为纯函数并导出；种子用户与场景数据逐字复制；
3. 报告页按 §3.8 实现；`buildReportModel` 抽为纯函数；
4. 测试：
   - 项目页：无效 ID、hero、里程碑勾选与进度、毕业笔记持久化、模板复制成功/失败、6 份模板；
   - 实验台：10 个场景载入、mock 全部路由（400/401/403/404/409/422/429/304/201/204/幂等）、curl 生成、历史 6 条上限、模式切换文案、重置；
   - 报告：空进度全 0、错题列表、代码双轨、阶段条、项目进度、nextUp 3 条、附录阶段标签。
- **命令**：

```bash
npx vitest run web/scripts/test/project-page.test.tsx web/scripts/test/lab.test.tsx web/scripts/test/report.test.tsx
npm run build
npx playwright test e2e/content.spec.ts --project=chromium -g "project|lab|report"
```

- **预期**：单测全绿；三页在 React 入口无控制台错误；实验台三次导出触发 429。
- **约束**：不接真实后端；不改 `functions/`；实验台的模拟数据与 v2 逐字一致；报告统计不得重写 `mastery-core.ts` 的语义。
- **证据**：单测；`#/project/p-graduation`、`#/lab`、`#/report` 截图与 v2 对照；429 与幂等重放截图。
- **回滚**：`git revert` 本任务提交。
- **停止条件**：报告统计与 v2 不一致；实验台状态码/头/文案不一致；模板复制失败无兜底。

### T-E3.5 阶段内容懒加载与搜索索引按需加载

- **类型**：engine
- **依赖**：T-E3.4
- **产出**：
  - `app/data/resources.ts`、`app/data/content.ts` / `mastery.ts` 的懒加载实现
  - `content/assemble.ts` 导出 `assembleStage` / `assembleProject`
  - `tools/build-content.ts`：catalog 扩展与搜索文档顺序/`sub`；导出纯函数
  - `shell/SearchBox.tsx`、`shell/search-docs.ts` 新增/修改
  - `main.tsx` 根 Suspense
  - `package.json` scripts
  - 测试 `mastery.test.ts`、`search-docs.test.ts`
- **实现要求**：

1. §4.9.2 的两个 catalog 字段 + 生成器同步；
2. §4.9.3 的 loader 与缓存；`assembleStage` 从 `assemble.ts` 导出且不改变装配结果；
3. §4.9.4 的 `use()` 与根 Suspense；
4. §4.9.5 的 catalog 掌握度，附带与 `state/mastery-core.ts` 的逐讲等价测试（构造包含 `@py`、非 Python 任务的 `@py` 脏数据、手动 lessonDone、部分完成等夹具）；
5. §4.9.6 搜索按需加载；`searchFromDocs` 与 E2 `searchCurriculum` 在 40 条查询语料上逐条比较 `href/title/sub` 顺序；
6. 构建脚本按 §4.9.7，`web/generated/search-index.json` 只在搜索聚焦后请求；
7. 依赖守卫（两条 grep 均无输出）：

```bash
grep -R "content/index" web/scripts/app web/scripts/main.tsx && exit 1 || true
grep -R "state/progress" web/scripts/app web/scripts/main.tsx && exit 1 || true
grep -R "from './search'" web/scripts/app/shell && exit 1 || true
```

8. 验证懒加载行为：
   - 打开 `#/` 后，`performance.getEntriesByType('resource')` 中没有阶段 chunk；
   - 进入 `#/lesson/s0-l1` 后新增至少 1 个 JS 请求；
   - 同阶段切到 `#/lesson/s0-l2` 不再新增阶段 chunk；
   - 切到 `#/lesson/s1-l1` 新增 1 个阶段 chunk；
   - 打开 `#/` 后不请求搜索索引；聚焦 `#search-input` 后才出现大体积 JS 请求。
- **命令**：

```bash
npm run content:build
node -e "const c=require('./web/generated/catalog.json'); console.log(c.tasks.every(t=>typeof t.python==='boolean'), c.stages.every(s=>s.accent))"
npx vitest run web/scripts/test/mastery.test.ts web/scripts/test/search-docs.test.ts
npm run build
npx playwright test e2e/content.spec.ts --project=chromium -g "lazy|search"
```

- **预期**：catalog 校验输出 `true true`；等价测试全绿；懒加载断言全过。
- **约束**：
  - 不为减小体积删减搜索正文；
  - 不改 v2 的 `content/index.ts` 同步装配行为；
  - 不引入路由 loader；
  - 不把 catalog 变成运行时可变状态；
  - 搜索索引加载失败只 warn，不抛错。
- **证据**：catalog 字段输出；等价测试；网络请求列表（初次/课时/同阶段/跨阶段/搜索聚焦）；构建 chunk 列表与 gzip 大小。
- **回滚**：`git revert` 本任务提交。页面仍使用 T-E3.4 的同步门面，功能不受影响（只是体积回到全量）。
- **停止条件**：等价测试出现任一差异；懒加载后首屏白屏；同阶段切换重复请求；搜索无结果或顺序变化。

### T-E3.6 对等验证（正文、交互、视觉）

- **类型**：validation
- **依赖**：T-E3.5
- **产出**：
  - `e2e/parity.spec.ts`
  - `e2e/interactions.spec.ts`
  - `e2e/content.spec.ts`
  - `docs/reviews/frontend-engineering/e3/parity-report.md`
- **实现要求**：

1. **66 路由正文对等**（`parity.spec.ts`）：

```ts
for (const route of routes) {
  test(`text parity ${route}`, async ({ browser }) => {
    const v2Context = await browser.newContext();
    const reactContext = await browser.newContext();
    const v2 = await v2Context.newPage();
    const react = await reactContext.newPage();
    await v2.goto(`/${route}`);
    await react.goto(`/index.next.html${route}`);
    await v2.locator('main h1').waitFor();
    await react.locator('main h1').waitFor();
    await react.waitForLoadState('networkidle');
    const text = async (page: Page) => (await page.locator('main').innerText()).replace(/\s+/g, ' ').trim();
    expect(await text(react)).toBe(await text(v2));
  });
}
```

2. **视觉对等**：`VISUAL_ENTRY=index.next.html npx playwright test e2e/visual.spec.ts --project=chromium`，21 张对比全过；任何 diff 都按缺陷处理，不允许用 mask 掩盖（动态区域在干净存储下应为空）；
3. **交互清单**（`interactions.spec.ts`，React 入口）：
   - MCQ：选错 → `答错了` + `再试一次`；重试后可再答；
   - 代码题：用内容里的 `solution` 填入 → 运行 → `已通过 · Node.js 轨道` + 全部 `is-pass`；重置恢复 starter；
   - SQL：填 `solution` → 执行 → `正确`；
   - 方案题：勾满 → `自检 n/n · 已完成`；刷新后仍保持；
   - 草稿：编辑器输入 → 刷新 → 内容保留；重置 → starter；
   - 语言：切 Python → 课时代码轨道默认 Python；刷新后仍为 Python；切回 Node；
   - 项目：勾选第一个里程碑 → `里程碑进度 +1`；刷新保持；毕业项目笔记刷新保持；
   - 模板：授予剪贴板权限 → `已复制` + toast；
   - 实验台：场景 429 连发三次 → 第三次 429 + `Retry-After`；幂等场景两次 → `幂等重放`；重置清空历史；
   - 报告：预置 localStorage 进度 → 统计数字正确；
   - 搜索：输入 `LinkHub 短链服务` → 结果含毕业项目；Enter 打开；Esc 关闭；
   - 重置进度：确认后清空并删除草稿；
4. **旧进度夹具**：种入 `bff-lab-progress-v1` 的 s6-l1..l6 旧 ID → 打开 `#/lesson/a1`，显示 `本讲已掌握`；种入草稿 → 编辑器显示；种入错误作答 → 显示 `上次答错`；
5. 所有页面收集 `console.error` 与 `pageerror`，断言为空；
6. 记录每项结果到 `parity-report.md`，附截图路径与失败修复记录。
- **命令**：

```bash
npm run build
npx playwright test e2e/parity.spec.ts --project=chromium
VISUAL_ENTRY=index.next.html npx playwright test e2e/visual.spec.ts --project=chromium
npx playwright test e2e/interactions.spec.ts --project=chromium
npx playwright test e2e/content.spec.ts --project=chromium
```

- **预期**：66/66 文本对等；21/21 视觉对等；交互清单全过；0 控制台错误。
- **约束**：不使用视觉 mask；不修改 v2 来迁就 React；不跳过失败路由。
- **证据**：三份 Playwright 报告 + 截图；`parity-report.md`。
- **回滚**：删除新增 spec 与报告；不修改业务代码。
- **停止条件**：任一正文差异；视觉差异无法归因；交互结果与 v2 不同；存在控制台错误。

### T-E3.7 G-E3 门禁与交付

- **类型**：validation
- **依赖**：T-E3.6
- **产出**：
  - `docs/reviews/frontend-engineering/e3-parity.md`
  - 更新 `docs/reviews/frontend-engineering/known-issues.md`
  - 标签 `e3-parity`
- **执行顺序**：

```bash
# 1. 静态
npm run lint
npx tsc --noEmit -p tsconfig.json
npx tsc --noEmit -p tsconfig.node.json

# 2. 依赖图守卫（任一条有输出即失败）
grep -R "content/index" web/scripts/app web/scripts/main.tsx && exit 1 || true
grep -R "state/progress" web/scripts/app web/scripts/main.tsx && exit 1 || true
grep -R "from './search'" web/scripts/app/shell && exit 1 || true

# 3. 内容
npm run content:validate
npx tsx tools/content-snapshot.ts
diff -u docs/reviews/frontend-engineering/e1/content-before.txt <(npx tsx tools/content-snapshot.ts)

# 4. 单测与构建
npm run test
npm run build

# 5. v2 不回退
npx playwright test e2e/smoke.spec.ts --project=chromium
npx playwright test e2e/shell.spec.ts --project=chromium

# 6. React 对等
npx playwright test e2e/content.spec.ts --project=chromium
npx playwright test e2e/parity.spec.ts --project=chromium
VISUAL_ENTRY=index.next.html npx playwright test e2e/visual.spec.ts --project=chromium
npx playwright test e2e/interactions.spec.ts --project=chromium

# 7. 懒加载证据
npx playwright test e2e/content.spec.ts --project=chromium -g "lazy|search"
```

- **预期**：

```text
lint 0 error
tsc 两份配置 0
三条依赖守卫均无输出
内容快照与 E1 完全一致
单测全绿；覆盖率不低于 E0 阈值
构建产出 dist/index.html 与 dist/index.next.html
v2 66/66；React 外壳 66/66
React 正文 66/66；文本对等 66/66
视觉 21/21
交互清单全过；0 控制台错误
初次加载不请求阶段 chunk 与搜索索引
```

- **报告必须包含**：环境、命令与退出码、逐页清单结果、文本/视觉对等结论、懒加载网络证据、已知差异（若有，只允许加载态）、残余风险、提交哈希。
- **标签**：

```bash
git tag -a e3-parity -m "E3 视图与交互迁移：六页、12 类内容块、四类任务、实验台与报告"
```

- **约束**：不发布；不改 `functions/`；不切换默认入口；不删除 v2 代码。
- **停止条件**：任一门禁失败；正文或视觉存在无法解释的差异；懒加载未生效；内容快照变化。

## 7. 逐页功能清单（G-E3 验收）

每一项在 React 入口手工或自动验证；证据写入 `parity-report.md`。

### 7.1 总览 `#/`

- [ ] 唯一 `h1`，含 `<em>` 的标题结构一致
- [ ] 4 个统计数字正确（8 + 1 / 45 / 214 / 已掌握）
- [ ] CTA 文案随进度切换；下一讲链接正确
- [ ] 课程运转三列 9 条 `<li>` 文案一致
- [ ] 9 张阶段卡顺序、accent 色、百分比、草稿数量正确
- [ ] 毕业项目面板文案与按钮正确
- [ ] 侧栏与总览的阶段百分比一致

### 7.2 阶段 `#/stage/:id`

- [ ] 无效 ID 空状态
- [ ] 普通阶段序号 `STAGE XX`；附录 `APPENDIX`
- [ ] 时长/讲数/附录徽章/已完成/keywords 顺序正确
- [ ] 课时行序号（`1.1` 与 `A.1`）、时长、题数、草稿、已掌握徽章
- [ ] 阶段目标、达成标准、阶段项目卡
- [ ] 课时行点击进入正确课时

### 7.3 课时 `#/lesson/:id`

- [ ] 无效 ID 空状态与返回
- [ ] 阶段徽章文案（普通/附录）与链接
- [ ] 时长、题数、草稿、已验证、已掌握徽章
- [ ] 草稿横幅；草稿不显示 objectives 与掌握按钮
- [ ] objectives 勾选图标与文本
- [ ] 12 类 block 渲染（按内容实际出现）
- [ ] 代码块双轨 tab、初始语言、hidden 面板
- [ ] 概念检查/本讲练习两块标题与说明
- [ ] 掌握按钮三种状态与写入
- [ ] 阶段项目链接
- [ ] prev/next/本阶段结束导航
- [ ] 语言切换后代码轨道重置、草稿保留

### 7.4 任务组件

- [ ] MCQ 单选/多选、未选择 toast、判定样式、重试、保存态
- [ ] 代码题 JS 运行、Python 运行（网络可用时）、超时、结果列表、日志、提示、参考答案、重置
- [ ] SQL 题执行、正确/错误/非 SELECT/0 行、提示、参考答案
- [ ] 方案题勾选、状态、笔记、参考要点
- [ ] 所有草稿刷新后保留
- [ ] 所有记录写入同一 `bff-lab-progress-v1`，v2 可读取

### 7.5 项目 `#/project/:id`

- [ ] 无效 ID 空状态
- [ ] hero 阶段标签、标题、brief、里程碑进度、stack
- [ ] 目标/实施路线
- [ ] 里程碑勾选、进度实时变化、刷新保持
- [ ] 验收/证据/复用/关联/一句话验收
- [ ] 毕业项目里程碑笔记
- [ ] 交付物/验收自评/进阶挑战
- [ ] 项目笔记持久化
- [ ] 6 份模板、复制成功/失败、1600ms 恢复

### 7.6 实验台 `#/lab`

- [ ] 10 个场景按钮与请求填充
- [ ] 教学文案初始/模拟/真实/场景切换
- [ ] 请求头增删、请求体、方法切换
- [ ] 列表分页、201+Location、422 字段、409、401、403、429+Retry-After、304、幂等重放、慢响应
- [ ] 响应状态徽章颜色、耗时、响应头表、响应体、空响应体
- [ ] 历史最多 6 条
- [ ] curl 生成与复制
- [ ] 重置恢复种子与初始文案
- [ ] 真实端点失败提示（本地预览）

### 7.7 报告 `#/report`

- [ ] 5 张统计卡数字与色调
- [ ] 空进度全 0，无 NaN
- [ ] 代码双轨进度（Node/Python）
- [ ] 9 个阶段掌握度条与链接
- [ ] 待攻克题目列表与空态
- [ ] 9 个项目进度条（8 阶段 + 毕业）
- [ ] 接下来学什么最多 3 条
- [ ] 附录阶段标签正确

## 8. 测试矩阵与覆盖

| 测试文件 | 覆盖 |
| --- | --- |
| `blocks.test.tsx` | 12 类 block；未知类型；双轨 tab；flow 展开；表格 HTML；case 可选字段 |
| `tasks-mcq.test.tsx` | 单选/多选；未选择；正确/错误；重试；保存正确/错误 |
| `tasks-code.test.tsx` | 初始轨道；轨道切换；运行成功/失败/执行数异常/运行时异常；重置；提示；参考答案；草稿；Python 订阅清理 |
| `tasks-sql.test.tsx` | 正确/错误/非 SELECT/0 行；重置；参考答案 |
| `tasks-design.test.tsx` | 勾选记录；全选；笔记；参考要点；草稿 |
| `lesson-page.test.tsx` | 无效 ID；meta；草稿；objectives；两块题目；掌握按钮；翻页 |
| `overview-page.test.tsx` | 统计；阶段卡；CTA；毕业面板 |
| `stage-page.test.tsx` | 无效 ID；hero；行序号；徽章；右栏 |
| `project-page.test.tsx` | 无效 ID；hero；里程碑；笔记；模板 |
| `lab.test.tsx` | 场景；mock 路由；curl；历史；重置；模式 |
| `report.test.tsx` | 空进度；错题；轨道；阶段条；项目；nextUp |
| `mastery.test.ts` | catalog 掌握度与 `state/mastery-core.ts` 逐讲等价（含脏 `@py`、lessonDone、部分完成）；`progress.ts` 委托后 E1 测试仍绿 |
| `search-docs.test.ts` | 40 条查询下 `searchFromDocs` 与 `searchCurriculum` 顺序/标题/副标题一致；12 条上限；`search-docs.ts` 无 `content/index` 依赖 |
| `parity.spec.ts` | 66 路由正文逐字对等；0 控制台错误 |
| `interactions.spec.ts` | §7.4、§7.5、§7.6、§7.7 的关键交互；旧进度迁移 |
| `visual.spec.ts` | 21 张 React vs v2 基线 |
| `content.spec.ts` | React 66 路由 `main h1`、关键标记、懒加载与搜索索引请求 |

覆盖率要求：

- 全局阈值沿用 E0（lines/functions/statements 70%，branches 60%）；
- 新增 `app/lesson/**`、`app/exercises/**`、`app/report/**`、`app/lab/mock-server.ts`、`app/data/**` 行覆盖不低于 75%；
- 不为了覆盖率写无断言的快照测试。

## 9. 风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| React 重渲染改变内联样式/顺序 | 视觉错位 | §3 契约表逐项对照；E3.6 21 张像素对比；CSS 不动 |
| 语言切换语义不一致 | 代码轨道不重置或草稿丢失 | 课时页 `key={currentLang}`；交互用例覆盖刷新与切换 |
| store 派生值未刷新 | 徽章/进度滞后 | 统一走 `useProgress` 版本；禁止组件内复制状态 |
| 懒加载 Promise 每次新建 | 无限 Suspense | loader 缓存 Promise；`use()` 只接收稳定引用 |
| 运行时误 import `content/index` / `state/progress` / `search.ts` | 全量内容回到首屏，懒加载失效 | E3.7 三条 grep 守卫；`mastery-core.ts` 只依赖 store；代码评审检查 import |
| catalog 与真实内容漂移 | 外壳统计/掌握度错误 | 生成器测试 + `mastery.test.ts` 逐讲等价 + 快照守卫 |
| 搜索顺序变化 | 结果排序与 v2 不同 | 生成顺序固定为 v2 遍历顺序；40 条查询对照 |
| Python CDN 不可用 | 代码题无法验证 | 交互用例将 Python 标记为条件用例；JS/SQL 为必过 |
| 实验台真实端点本地不可用 | 误判回归 | 真实端点只验证失败提示；mock 为必过 |
| 内联样式大量重复 | 维护成本 | E3 只做对等；E4 质量阶段再评估抽取，且必须视觉零差异 |
| 报告页全量加载慢 | 首屏慢 | 仅报告页 `loadAllStages`；其余页面单阶段；E3.5 网络证据 |

## 10. 回滚与交接

### 10.1 回滚

- 每个任务一个提交，失败时 `git revert <commit>`；
- E3.5 可单独回滚：页面仍使用 E3.4 的同步门面，功能完整；
- E3.6/E3.7 只新增证据与测试，不改业务代码；
- 最坏情况回退到 `e2-shell`；回退前保留 `docs/reviews/frontend-engineering/e3/` 证据；
- 不删除 v2.0.1 标签与已发布 release。

### 10.2 交给 E4 的输入

E4 开始时必须满足：

- `e3-parity` 标签存在，工作区干净；
- React 与 v2 在 66 路由正文、21 张视觉基线上完全对等；
- 四类任务与实验台、报告的行为清单全部通过；
- E3.5 懒加载生效：初次加载无阶段 chunk、搜索索引按需；
- 已知问题清单包含：Python 依赖网络、真实端点本地不可用、内联样式待评估；
- 报告明确记录：本阶段未改内容、未改 CSS、未发布、未动 `functions/`。

E4 的第一条命令应是：

```bash
git checkout e3-parity
npm ci
npm run verify
```
