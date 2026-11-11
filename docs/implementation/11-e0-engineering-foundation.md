# E0：工程底座（工具链、基线、shadow build）

> 上级：`10-frontend-engineering.md` §6 E0、§11-13。
> 目标：不改一行课程内容，让 v2 站点可以通过 Vite 构建，并建立类型、Lint、单测、66 路由冒烟与视觉基线。
> 工期：0.5–1 人日。完成定义：G-E0 通过，标签 `e0-baseline`。

## 1. 阶段边界

**做**：

- 初始化 npm 工程、锁定依赖、配置 Vite/TS/ESLint/Prettier/Vitest/Playwright；
- 用现有 `web/index.html` + `app.js` 做 shadow build，证明 Vite 能原样构建 v2；
- 生成内容快照哈希、66 路由清单、包体基线、视觉基线、66 路由控制台门禁；
- 建立 CI `verify.yml`。

**不做**：

- 不改 `web/scripts/**` 任何业务代码（只允许新增 `web/scripts/test/setup.ts`）；
- 不改 `web/index.html`；
- 不写 React 组件；
- 不转换内容为 TS（E1 做）；
- 不发布，不动 `functions/`。

## 2. 前置检查

| 检查 | 命令 | 通过标准 |
| --- | --- | --- |
| 工作区干净 | `git status --short` | 无输出（方案文档已提交后） |
| 基线标签 | `git rev-parse v2.0.1` | 输出 commit |
| Node | `node -v` | `v22.15.0` 或 ≥22.12 |
| npm | `npm --version` | ≥10 |
| 网络 | `npm view react version` | 有输出（需要 registry） |
| 现有审计 | `node tools/audit-content.mjs` | 0 错误 |
| 现有练习 | `node tools/run-js-exercises.mjs` 等 | 全过 |

任何一项不满足，先停，不进入 E0。

## 3. 任务卡

### T-E0.1 建立保护性基线

- **类型**：validation
- **依赖**：无（方案文档提交后）
- **产出**：
  - `tools/content-snapshot.mjs`
  - `tools/route-matrix.mjs`
  - `docs/reviews/frontend-engineering/baseline/git.txt`
  - `docs/reviews/frontend-engineering/baseline/content-sha256.txt`
  - `docs/reviews/frontend-engineering/baseline/routes.txt`
  - `docs/reviews/frontend-engineering/baseline/stats.txt`
- **实现要求**：

`tools/content-snapshot.mjs` 必须做到：

1. 从 `web/scripts/content/index.js` 导入 `curriculum` 与 `graduationProject`；
2. 递归排序对象键（数组顺序保持不变）后字符串化；
3. 输出 SHA-256，并附带计数：`stages/lessons/projects/checks/exercises`；
4. 不写入任何文件，只打印到 stdout。

输出格式固定为：

```text
sha256=<64 位十六进制>
stages=9 lessons=45 projects=9 checks=135 exercises=79
```

`tools/route-matrix.mjs` 生成路由：

```text
#/
#/stage/<9 个阶段 id>
#/lesson/<45 个课时 id>
#/project/<9 个项目 id>
#/lab
#/report
```

加 `--json` 时输出同一清单的 JSON 字符串数组：66 条，元素形如 `#/lesson/s0-l1`。E2 与 E6 直接按该形状消费 `e2e/routes.json`，不得输出 `{ routes: [...] }` 之类的包装对象。

- **命令**：

```bash
node tools/content-snapshot.mjs > docs/reviews/frontend-engineering/baseline/content-sha256.txt
node tools/route-matrix.mjs > docs/reviews/frontend-engineering/baseline/routes.txt
node tools/content-stats.mjs > docs/reviews/frontend-engineering/baseline/stats.txt
git rev-parse HEAD v2.0.1 > docs/reviews/frontend-engineering/baseline/git.txt
wc -l docs/reviews/frontend-engineering/baseline/routes.txt
```

- **预期**：

```text
sha256=... stages=9 lessons=45 projects=9 checks=135 exercises=79
66 docs/reviews/frontend-engineering/baseline/routes.txt
```

- **约束**：只新增 `tools/*.mjs` 与 baseline 文件，不改 `web/`。
- **证据**：写入 `docs/reviews/frontend-engineering/e0-foundation.md` §基线。
- **回滚**：删除新增的 tools 与 baseline 目录。
- **停止条件**：计数不是 45/9/9/135/79；哈希脚本无法导入内容；路由数不是 66。

### T-E0.2 初始化 npm 工程与依赖

- **类型**：engine
- **依赖**：T-E0.1
- **产出**：`package.json`、`package-lock.json`、`.nvmrc`、更新后的 `.gitignore`
- **命令**：

```bash
npm init -y
npm pkg set name=advanced-fullstack-web-tutorial
npm pkg set private=true
npm pkg set type=module
npm pkg set engines.node=">=22.12"

npm i --save-exact react@19.3.1 react-dom@19.3.1 react-router@7.18.5

npm i -D --save-exact \
  vite@7.3.8 @vitejs/plugin-react@5.2.0 typescript@5.9.3 \
  @types/react@19.3.0 @types/react-dom@19.3.0 @types/node@22.20.5 \
  eslint@9.39.5 @eslint/js@9.39.5 typescript-eslint@8.72.2 \
  eslint-plugin-react-hooks@7.1.1 eslint-plugin-react-refresh@0.5.7 \
  eslint-plugin-jsx-a11y@6.10.2 globals@17.14.0 prettier@3.9.10 \
  vitest@5.1.0 @vitest/coverage-v8@5.1.0 jsdom@31.0.0 \
  @testing-library/react@16.3.3 @testing-library/dom@10.4.2 \
  @testing-library/jest-dom@7.0.1 @testing-library/user-event@14.6.9 \
  @playwright/test@1.65.0 @axe-core/playwright@4.14.0 \
  zod@4.6.7 tsx@4.23.15
```

- **`package.json` scripts（E0 版本）**：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "npm run typecheck && vite build",
    "preview": "vite preview",
    "lint": "eslint \"web/scripts/**/*.{ts,tsx}\" \"tools/**/*.ts\" \"e2e/**/*.ts\" \"*.config.{ts,js}\" --no-error-on-unmatched-pattern",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.node.json --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "npm run build && playwright test",
    "e2e:update": "npm run build && playwright test --update-snapshots",
    "verify": "npm run lint && npm run typecheck && npm run test && npm run e2e"
  }
}
```

- **`.nvmrc`**：`22.15.0`
- **`.gitignore` 追加**：

```text
node_modules/
dist/
coverage/
playwright-report/
test-results/
web/generated/
*.tsbuildinfo
.vite/
```

- **验收**：

```bash
npm ls --depth=0
npm audit --omit=dev
```

预期：直接依赖与上表一致；生产依赖审计 0 漏洞（dev 漏洞记录不阻塞，但需写入报告）。

- **约束**：不安装 UI 库、状态库、CSS 框架；所有版本精确锁定，不用 `^`/`~`。
- **回滚**：删除 `package.json`/`package-lock.json`/`node_modules`/`.nvmrc`，还原 `.gitignore`。
- **停止条件**：peer 冲突；安装后 `npm ls` 报错；需要改动上表版本（先更新本方案）。

### T-E0.3 配置 TypeScript / ESLint / Prettier / Vitest / Playwright

- **类型**：engine
- **依赖**：T-E0.2
- **产出**：
  - `tsconfig.json`（应用）
  - `tsconfig.node.json`（工具/配置/E2E）
  - `eslint.config.js`
  - `.prettierrc.json`、`.prettierignore`
  - `vitest.config.ts`、`web/scripts/test/setup.ts`
  - `playwright.config.ts`

**tsconfig.json**：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "allowJs": true,
    "checkJs": false,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["web/scripts/**/*.ts", "web/scripts/**/*.tsx", "web/scripts/**/*.js"],
  "exclude": ["node_modules", "dist", "web/generated"]
}
```

**tsconfig.node.json**：

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2023"],
    "types": ["node"]
  },
  "include": [
    "vite.config.ts",
    "vitest.config.ts",
    "playwright.config.ts",
    "tools/**/*.ts",
    "e2e/**/*.ts"
  ]
}
```

**eslint.config.js**：

```js
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  {
    ignores: [
      'dist/**', 'node_modules/**', 'coverage/**',
      'playwright-report/**', 'test-results/**',
      'web/generated/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['web/scripts/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['tools/**/*.ts', 'e2e/**/*.ts', '*.config.{ts,js}'],
    languageOptions: { globals: globals.node },
  },
);
```

**`.prettierrc.json`**：

```json
{
  "singleQuote": true,
  "semi": true,
  "printWidth": 100,
  "trailingComma": "all"
}
```

**`.prettierignore`**：

```text
node_modules/
dist/
coverage/
playwright-report/
test-results/
docs/
web/scripts/**/*.js
web/scripts/content/**
web/styles/**
```

> 不在 E0 格式化旧 JS 与内容文件：它们要么在 E1 换类型，要么在 E3 删除；提前格式化只会制造 3 万行无意义 diff，增加内容漂移风险。

**vitest.config.ts**：

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./web/scripts/test/setup.ts'],
    include: ['web/scripts/**/*.test.{ts,tsx}', 'tools/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      thresholds: { lines: 70, functions: 70, branches: 60, statements: 70 },
    },
  },
});
```

**web/scripts/test/setup.ts**：

```ts
import '@testing-library/jest-dom/vitest';
```

**playwright.config.ts**：

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
```

- **验收**：

```bash
npm run lint
npm run typecheck
npm test
```

预期：lint 0 错误；typecheck 0 错误；测试 0 个但退出码 0（`passWithNoTests`）。

- **回滚**：删除配置与 setup 文件。
- **停止条件**：TS 无法解析旧 JS 语法；ESLint 插件 flat API 与上例不匹配（以 README 为准调整接入方式，规则集合不变）。

### T-E0.4 Vite shadow build

- **类型**：engine
- **依赖**：T-E0.3
- **产出**：`vite.config.ts`、`dist/`（不提交）
- **配置**：

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'web',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'baseline-widely-available',
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
```

- **说明**：
  - `root: 'web'` 保持源码目录不变，避免 97 个文件搬迁；
  - `outDir: '../dist'` 让构建产物与源码分离，`dist/` 作为静态交付目录；
  - `base: './'` 让产物使用相对路径，兼容任意静态托管与子路径预览；
  - E0 不修改 `web/index.html`，Vite 直接处理现有 `<script type="module" src="./scripts/app.js">`。
- **命令**：

```bash
npm run build
find dist -maxdepth 2 -type f | sort
npm run preview
```

打开 `http://127.0.0.1:4173/#/lesson/s0-l1`，手动执行 s0-l1 的 JS 代码题一次。

- **预期**：
  - `dist/index.html` 存在，脚本/样式引用带哈希；
  - 页面渲染与 v2 本地预览一致；
  - JS 代码题可运行，0 控制台异常。
- **约束**：只允许新增 `vite.config.ts`；不改 `web/index.html`、不改 `web/scripts/**`。
- **回滚**：删除 `vite.config.ts` 与 `dist/`。
- **停止条件**：Vite 解析失败（记录具体文件与报错，不改内容）；CSS 未产出；产物路由白屏。

### T-E0.5 66 路由冒烟与视觉基线

- **类型**：validation
- **依赖**：T-E0.4
- **产出**：
  - `e2e/routes.json`（由 `tools/route-matrix.mjs --json` 生成）
  - `e2e/smoke.spec.ts`
  - `e2e/visual.spec.ts`
  - `e2e/__screenshots__/**`（视觉基线）
- **冒烟要求**：
  - 遍历 66 条路由；`page.goto('/' + route)`；
  - 等待 `main h1` 可见；
  - 收集 `console` 的 `error` 与 `pageerror`，断言为空；
  - 失败时输出路由、错误文本、截图到 `test-results/`。
- **视觉要求**：
  - 页面 7 个：`#/`、`#/stage/s0`、`#/lesson/s0-l1`、`#/lesson/s7-l5`、`#/project/p-graduation`、`#/lab`、`#/report`；
  - 视口 3 个：1440×900、768×1024、390×844；
  - 关闭动画：`*, *::before, *::after { animation: none !important; transition: none !important; }`；
  - 等待 `document.fonts.ready`；
  - `fullPage: true`；
  - 视觉用例只在 `chromium` 项目跑，标题含 `@visual`，供 CI 按平台排除；
- **命令**：

```bash
node tools/route-matrix.mjs --json > e2e/routes.json
npm run build
npx playwright test e2e/smoke.spec.ts --project=chromium
npx playwright test e2e/visual.spec.ts --project=chromium --update-snapshots
```

- **预期**：66/66 通过；0 控制台错误；21 张基线截图生成。
- **约束**：冒烟只验证现有行为，不为通过而修改业务代码。
- **回滚**：删除 e2e 与截图基线。
- **停止条件：v2 基线本身有控制台错误或渲染失败；先记录，不在 E0 修业务代码，回到用户确认。

### T-E0.6 CI verify

- **类型**：engine
- **依赖**：T-E0.5
- **产出**：`.github/workflows/verify.yml`
- **内容要点**：

```yaml
name: verify
on:
  push:
    branches: [main]
  pull_request:
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22.15.0'
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test --project=chromium --grep-invert "@visual"
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

- **验收**：本地 `npm run verify` 通过；推送后 Actions 绿色（网络受限时保留本地输出并在 G-E0 记录）。
- **回滚**：删除 workflow。
- **停止条件**：CI 需要密钥或外部服务；如有，改为不含密钥的本地门禁并报告。

### T-E0.7 G-E0 报告与标签

- **类型**：review
- **依赖**：T-E0.1–T-E0.6
- **产出**：`docs/reviews/frontend-engineering/e0-foundation.md`
- **报告必须包含**：
  - 基线哈希、路由数、包体大小（`dist/assets` 原始与 gzip）；
  - 各门禁命令与输出摘要；
  - 66 路由冒烟结果与截图路径；
  - 与 v2.0.1 的行为差异（预期为无）；
  - 残余风险（例如旧 JS 未纳入 Lint、Vitest 0 用例）；
  - 门禁结论。
- **标签**：

```bash
git add package.json package-lock.json .nvmrc .gitignore \
  tsconfig.json tsconfig.node.json eslint.config.js \
  .prettierrc.json .prettierignore vitest.config.ts playwright.config.ts \
  vite.config.ts e2e tools docs/reviews/frontend-engineering .github
git commit -m "E0：建立 Vite/TS/ESLint/Vitest/Playwright 工程底座与基线"
git tag -a e0-baseline -m "E0 工程底座：shadow build + 66 路由基线"
```

## 4. 批次顺序与停点

```text
T-E0.1 → T-E0.2 → T-E0.3 → T-E0.4 → T-E0.5 → T-E0.6 → T-E0.7
```

- T-E0.1 与 T-E0.2 可以同一批次完成，但必须先确认基线哈希再安装依赖；
- T-E0.4 构建失败时停在 T-E0.4，不进入 E2E；
- T-E0.5 发现 v2 基线缺陷时，先记录并报告，不在 E0 修业务。

## 5. G-E0 门禁清单

- [ ] `git status` 仅包含预期新增文件；
- [ ] `npm ci` 可从 lockfile 复现安装；
- [ ] `npm run lint` 0 错误；
- [ ] `npm run typecheck` 0 错误；
- [ ] `npm test` 退出码 0；
- [ ] `npm run build` 成功，`dist/` 可 `npm run preview`；
- [ ] 66/66 路由冒烟通过，0 控制台错误；
- [ ] 21 张视觉基线生成并提交；
- [ ] 内容快照哈希与基线一致；
- [ ] 现有 7 个内容/练习审计脚本全部通过；
- [ ] `docs/reviews/frontend-engineering/e0-foundation.md` 完成；
- [ ] 标签 `e0-baseline` 创建。

## 6. 偏离防护

- 本阶段不产生任何用户可见变化；任何视觉差异都视为失败；
- 不为了让 Vite 构建通过而修改 `web/scripts/**`；
- 不把旧 JS 纳入 Lint/格式化；
- 不引入未列出的依赖；
- 不提前写 React（E2 才允许）。

## 7. 故障处理

| 现象 | 处理 |
| --- | --- |
| Vite 构建报 JS 语法错误 | 记录文件与栈，确认是否 ES 语法超出 target；只调整 `build.target`，不改业务代码 |
| CSS 未进入产物 | 检查 `web/index.html` 的 `<link>` 是否被 Vite 处理；只改 `vite.config.ts` |
| Playwright 启动失败 | 检查端口 4173 与 `npm run preview`；清理占用进程后重试 |
| 视觉基线不稳定 | 关闭动画、等待字体、固定视口；不降低阈值到无意义 |
| 内容快照与预期不符 | 立即停止；说明内容在 E0 被意外修改，恢复后重跑 |

## 8. 交付物

- npm 工程与锁文件、Vite/TS/Lint/Test/E2E 配置；
- 基线：内容哈希、66 路由、7×3 截图、包体报告；
- CI workflow；
- G-E0 报告与 `e0-baseline` 标签。
