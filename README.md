# 后端进阶实验室

面向有前端基础的工程师的体系化进阶课程站点：从请求、数据、API、缓存与韧性，到生产化、产品接入、AI 应用与工程效能，配可自动验证的练习与递进式项目。

- **在线站点**：[https://buwenzheng.github.io/advanced-fullstack-web-tutorial/](https://buwenzheng.github.io/advanced-fullstack-web-tutorial/)（需已开通 GitHub Pages，见下方「部署」）
- **仓库**：[buwenzheng/advanced-fullstack-web-tutorial](https://github.com/buwenzheng/advanced-fullstack-web-tutorial)
- **课程事实源**：[`docs/curriculum-plan.md`](docs/curriculum-plan.md)
- **分块重构实施**：[`docs/implementation/18-track-restructure.md`](docs/implementation/18-track-restructure.md)（R0–R5 已落地）

站点为纯静态 SPA（Vite + React，hash 路由），可本地开发、GitHub Pages 发布，或部署到任意静态托管。

---

## 内容规模

| 维度 | 说明 |
| --- | --- |
| 主修 | M1 地基 · M2 后端交付 · M3 生产与产品 · M4 AI 工程（共 28 讲） |
| 选修 | E1 分布式与数据边界（4 讲，默认非主线） |
| 工具箱 | B，按主题分组、按需查阅（13 讲） |
| 毕业 | 可选集成项目 X（`x-linkhub`），不绑架主修路径 |
| 合计 | 45 讲 / 约 3400 分钟；214 个任务（检查题、代码题、SQL、方案题） |
| 轨道 | JavaScript（主）+ Python（对照）；12 类内容块 |
| 实验 | 内置 HTTP 实验台与学习报告 |

块内自洽项目 8 个；LinkHub 仅作自愿集成毕业，不再作为一切项目的主线挂载点。

---

## 学习路径

首页以路径卡片导航，允许**阶段结业**，不要求线性刷完全部内容。默认推荐路径 **C**。

| 路径 | 顺序（概要） | 适合谁 |
| --- | --- | --- |
| **A 后端补齐** | M1 → M2 → M3 章1（生产） | 前端要独立写 API 并上线 |
| **B 全栈交付** | M1 → M2 → M3 全文 | 要端到端产品感 |
| **C AI 全栈**（默认） | 在 B 基础上纳入 M4；Coding 可早学 | AI 时代全栈交付 |
| **D 资深加深** | 在 C 基础上选修 E1 + 工具箱加深 | 架构取舍、分布式与效能 |

先修为弱约束：M2 建议先 M1；M3 生产建议先 M2；E1 建议先有 M3 生产基础。详见课程规划。

---

## 技术栈

| 层 | 选型 |
| --- | --- |
| UI | React 19 + React Router 7（hash：`#/lesson/:id` 等形态不变） |
| 构建 | Vite 7 + TypeScript 5.9（strict） |
| 内容契约 | Zod 4；catalog / 搜索索引由 `content:build` 生成 |
| 单测 | Vitest + Testing Library |
| E2E | Playwright（含 axe；视觉基线在 Windows 本地） |
| 判题 | 浏览器内 JS / Python（Pyodide）/ SQL 引擎 |

兼容契约（勿随意改动）：练习答案语义、hash 路由形态、`localStorage` 键名、旧进度 → 新 ID 的迁移规则。

---

## 环境

- Node.js **22.15.0**（见 [`.nvmrc`](.nvmrc)；`engines` 要求 `>=22.12`）
- 包管理：npm（使用 `npm ci`）

```bash
git clone https://github.com/buwenzheng/advanced-fullstack-web-tutorial.git
cd advanced-fullstack-web-tutorial
npm ci
npm run dev
```

开发服务器默认：<http://127.0.0.1:5173/>。`dev` / `build` 会先跑 `content:build`；若直接调用 `vite`，请先确保 `web/generated/` 已生成。

---

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm ci` | 按 lockfile 安装依赖 |
| `npm run dev` | 生成内容后启动开发服务器 |
| `npm run build` | 校验 + 生成 + 类型检查 + 构建到 `dist/` |
| `npm run preview` | 预览构建产物（默认 4173） |
| `npm run verify` | 本地完整门禁（与 CI 主路径一致；不含视觉 / Python CDN） |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc`（需先有 `web/generated/`，或走 `verify`/`build`） |
| `npm run test` | Vitest 单元测试 |
| `npm run test:coverage` | 单元测试 + 覆盖率 |
| `npm run e2e` | 构建后 Playwright（chromium） |
| `npm run e2e:visual` | 21 张视觉基线（**Windows 本地**；CI 不跑） |
| `npm run e2e:python` | Python 轨道 E2E（需外网 CDN；CI 不跑） |
| `npm run content:validate` | 内容结构 / Zod 校验 |
| `npm run content:build` | 生成 `web/generated/`（catalog、搜索索引等） |
| `npm run audit:content` | 课程内容审计 |
| `npm run audit:exercises` | JS / SQL 答案级审计 |
| `npm run audit:python` | Python 答案审计（外网） |
| `npm run budget` | 入口、懒加载与搜索索引包体预算 |
| `npm run format` / `format:check` | Prettier |

`verify` 大致顺序：`lint` → `content:validate` → `content:build` → `typecheck` → `test:coverage` → `audit:content` → `audit:exercises` → `build` → `budget` → Playwright（排除 `@visual` / `@python`）。

---

## 目录结构

```text
web/
  index.html                 # 唯一 HTML 入口
  styles/                    # 设计令牌与页面样式
  scripts/
    main.tsx                 # React 挂载
    app/
      router.tsx             # 路由表
      shell/                 # 外壳、搜索、语言、抽屉、toast
      pages/                 # 首页 / 阶段 / 课时 / 项目 / 实验台 / 报告
      data/                  # 数据门面与懒加载
      lesson/                # 12 类内容块、高亮、代码块
      exercises/             # MCQ / 代码 / SQL / 方案题
      project/               # 里程碑与模板
      lab/                   # HTTP 实验台
      report/                # 学习报告
    state/                   # 进度、草稿、语言、版本迁移
    content/
      stages/                # 按 m1/m2/m3/m4/e1/b 组织课时与块内项目
      paths.ts               # A–D 学习路径
      graduation.ts          # 可选集成毕业 x-linkhub
      schema.ts              # Block / Chapter / Path 等 Zod 契约
      redirects.ts           # 旧 ID → 新 ID（catalog 侧，控制包体）
    engine/                  # JS / Python / SQL 判题
    test/                    # Vitest
  generated/                 # catalog 与搜索索引（gitignored）
e2e/                         # Playwright、路由清单、视觉基线
tools/                       # 内容生成、审计、包体预算、迁移夹具
functions/                   # 边缘函数（可选；Pages 不托管）
docs/                        # 课程规划、实施、评审与发布文档
.github/workflows/
  verify.yml                 # PR / 手动：完整 verify
  deploy.yml                 # push main / 手动：verify 后发布 Pages
```

---

## 内容维护

1. 在 [`docs/curriculum-plan.md`](docs/curriculum-plan.md) 确认所属大块、章、路径与 ID；结构调整同时对照 [`docs/implementation/18-track-restructure.md`](docs/implementation/18-track-restructure.md)。
2. 改课时 / 块内项目：`web/scripts/content/stages/<block>/**`；路径：`paths.ts`；可选毕业：`graduation.ts`。
3. 同步 `docs/content-specs/`、清单与必要的旧 ID 映射；**不改变** `#/lesson/:id`、`#/stage/:id`、`#/project/:id` 等路由形态（参数值可为新 ID，旧 ID 靠重定向）。
4. 跑 `npm run content:validate` 与 `npm run content:build`（`dev` / `build` 会代跑）。
5. 跑 `npm run verify`；涉及视觉或 Python CDN 时另跑专项命令。

进度数据：`localStorage` **键名不变**；结构内 ID 在 `meta.version ≥ 3` 下经 `remapId` 迁移。历史 `s6→a` 与本轮 `s*`/`p*` → `m*`/`e1`/`b` 映射分路径处理，避免交叉污染——改映射前先跑迁移相关测试与 E2E。

---

## 测试与平台

| 范围 | 本地 | CI（`verify` / `deploy`） |
| --- | --- | --- |
| lint / 内容校验 / 生成 / typecheck / 单测 / 内容与 JS·SQL 审计 / build / budget / 主 E2E | ✅ | ✅（`npm run verify`） |
| 视觉回归 `@visual` | ✅ Windows 基线：`npm run e2e:visual` | ❌ |
| Python 轨道 `@python` / `audit:python` | ✅ 需外网 CDN | ❌ |

发布前建议在 Windows 上补跑视觉与 Python 专项。失败时 CI 的 `verify` 工作流会上传 `playwright-report/` 与 `coverage/` artifact（保留 7 天）。

---

## 部署

### 工作流

| 工作流 | 触发 | 行为 |
| --- | --- | --- |
| `verify` | `pull_request`、手动 | `npm run verify` |
| `deploy` | 推送 `main`、手动 | 先 `verify`，再上传 `dist/` 并用 GitHub Pages 发布 |

`deploy` 需要仓库权限：`contents: read`、`pages: write`、`id-token: write`。

### 首次开通 Pages（必做一次）

CI 的 `GITHUB_TOKEN` **不能**创建 Pages site。仓库即使已是 Public，只要从未开过 Pages，`configure-pages` 会报：

`Get Pages site failed … Not Found`

这与 `verify` 是否通过无关。请手动：

1. 打开 [Settings → Pages](https://github.com/buwenzheng/advanced-fullstack-web-tutorial/settings/pages)
2. **Build and deployment → Source** 选 **GitHub Actions**（不要选 Deploy from a branch）
3. 到 [Actions](https://github.com/buwenzheng/advanced-fullstack-web-tutorial/actions) 对失败的 **Deploy to GitHub Pages** 点 **Re-run failed jobs**（或再推一次 `main`）

开通后站点通常为：

`https://buwenzheng.github.io/advanced-fullstack-web-tutorial/`

Vite 使用相对 `base`，挂在项目子路径下可直接工作。

### 其他说明

- `dist/` 可部署到任意静态服务器；不必绑定 GitHub Pages。
- GitHub Pages **不托管** `functions/`：实验台 live 模式需另行部署边缘函数；mock 模式不受影响。
- Pages 站点默认公开；免费计划下私有仓库通常无法用 Pages。若必须私有访问，换其他托管。
- 不要提交：`dist/`、`web/generated/`、密钥、`.env`。

---

## 文档索引

| 文档 | 用途 |
| --- | --- |
| [`docs/curriculum-plan.md`](docs/curriculum-plan.md) | 课程目录唯一事实源（分块路径版） |
| [`docs/implementation/18-track-restructure.md`](docs/implementation/18-track-restructure.md) | 分块重构实施总纲（R0–R5） |
| [`docs/implementation/19-r1-*.md`](docs/implementation/) … `23-r5-*` | 各批明细 |
| [`docs/reviews/track-restructure/`](docs/reviews/track-restructure/) | 重构评审与开放决策 |
| [`docs/content-schema.md`](docs/content-schema.md) / [`docs/content-style.md`](docs/content-style.md) | 内容形态与写作规范 |
| [`docs/implementation/10-frontend-engineering.md`](docs/implementation/10-frontend-engineering.md) | 前端工程化迁移总纲（历史，E0–E5） |
| [`docs/implementation/00-master-plan.md`](docs/implementation/00-master-plan.md) | 内容重建总纲（历史，M0–M9） |

与现行规划冲突时：目录级以 `curriculum-plan.md` 为准；执行细节以 `18-track-restructure.md` 及后续 R 批文档为准。
