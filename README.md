# 后端进阶实验室

面向有前端基础工程师的体系化进阶课程站点：从请求、数据、API、缓存与韧性，到生产化、分布式、全栈集成与 AI 应用，配可自动验证的练习与递进式项目。

## 内容规模

- 8 个核心阶段 + 1 个附录，共 45 讲；
- 9 个项目（p0–p7 + 毕业项目），54 个里程碑；
- 214 个任务：检查题、代码题、SQL 题与方案题；
- 12 类内容块；JavaScript / Python 双代码轨道；内置 HTTP 实验台与学习报告。

## 技术栈

- React 19 + React Router 7（hash 路由，旧链接不变）
- Vite 7 + TypeScript 5.9（strict）
- Zod 4 内容校验
- Vitest + Testing Library；Playwright（含 axe 与视觉回归）

## 环境

Node.js 22.15.0（见 `.nvmrc`），npm。

## 常用命令

| 命令                       | 说明                                        |
| -------------------------- | ------------------------------------------- |
| `npm ci`                   | 安装依赖                                    |
| `npm run dev`              | 开发服务器，http://127.0.0.1:5173/          |
| `npm run build`            | 内容校验 + 生成 + 类型检查 + 构建到 `dist/` |
| `npm run preview`          | 预览构建产物，http://127.0.0.1:4173/        |
| `npm run verify`           | 本地完整门禁（不跑视觉与 Python CDN 用例）  |
| `npm run test`             | 单元测试                                    |
| `npm run test:coverage`    | 单元测试 + 覆盖率阈值                       |
| `npm run e2e`              | 构建后运行 Playwright（chromium）           |
| `npm run e2e:visual`       | 21 张视觉基线（Windows 本地）               |
| `npm run e2e:python`       | Python 轨道（需要外网 CDN）                 |
| `npm run content:validate` | 内容结构校验                                |
| `npm run content:build`    | 生成 `web/generated/` 目录与搜索索引        |
| `npm run audit:content`    | 课程内容审计                                |
| `npm run audit:exercises`  | JS / SQL 答案级审计                         |
| `npm run budget`           | 入口、懒加载与搜索索引包体预算              |

`dev` 与 `build` 会自动执行 `content:build`；直接运行 `vite` 前请确保 `web/generated/` 存在。

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
      pages/                 # 六个页面
      data/                  # 数据门面与懒加载资源
      lesson/                # 12 类内容块、高亮、代码块
      exercises/             # MCQ / 代码 / SQL / 方案题
      project/               # 里程碑与模板
      lab/                   # HTTP 实验台
      report/                # 报告模型
    state/                   # 进度、草稿、语言、迁移
    content/                 # 课程内容与 Zod 校验（单一事实源）
    engine/                  # JS / Python / SQL 判题
    test/                    # Vitest
  generated/                 # catalog 与搜索索引（gitignored）
e2e/                         # Playwright、路由清单、视觉基线
tools/                       # 内容生成、审计、包体预算
functions/                   # 边缘函数（可选）
docs/                        # 课程、实施、评审与发布文档
```

## 内容维护

1. 修改 `web/scripts/content/**` 下的 TypeScript 内容；
2. 运行 `npm run content:validate`；
3. 运行 `npm run content:build`（`dev` / `build` 会代跑）；
4. 运行 `npm run verify`。

课程 ID、练习答案、hash URL、`localStorage` 键与旧进度迁移规则都是兼容契约，不要为了“整洁”改动。

## 测试与平台

- 视觉基线是 Windows 基线，CI 不执行 `@visual`；发布前在本地执行 `npm run e2e:visual`；
- Python 题依赖 jsDelivr 的 Pyodide，CI 不执行 `@python`；发布前本地执行 `npm run e2e:python` 与 `npx tsx tools/run-python-exercises.ts`；
- 其余门禁在 CI 与本地执行同一份 `npm run verify`。

## 部署

- `pull_request` 与手动触发由 `verify` 工作流跑完整门禁；
- 推送到 `main` 由 `deploy` 工作流先跑完整 `npm run verify`，通过后构建 `dist/` 并发布到 GitHub Pages；
- 首次使用需在仓库 Settings → Pages 把 Source 设为「GitHub Actions」；`deploy` 也可在 Actions 中手动运行；
- 站点地址以 Pages 显示为准（通常为 `https://<owner>.github.io/<repo>/`）；Vite 使用相对 `base`，项目子路径可直接工作；
- `dist/` 仍是纯静态产物，可改部署到任意静态服务器；GitHub Pages 不托管 `functions/`，实验台 live 模式需另行部署边缘函数，mock 模式不受影响；
- GitHub Pages 站点默认公开；私有仓库启用 Pages 需要账户计划支持，但若必须保留私有访问，Pages 不适用；
- 不提交 `dist/`、`web/generated/`、任何密钥。

## 文档

- 课程与发布文档：`docs/`
- 前端工程化迁移总纲：`docs/implementation/10-frontend-engineering.md`
- 执行文档：E0–E5 为现行交付依据（`docs/implementation/11-*` 至 `16-*`）；E6（`17-e6-release-v3.md`）的站点发布已于 2026-11-11 取消，保留为历史计划
