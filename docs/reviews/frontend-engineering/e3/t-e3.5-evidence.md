# T-E3.5 证据：阶段内容懒加载与搜索索引按需加载

日期：2026-11-10
环境：Windows 10.0.22631 / Node v24.22.1（.nvmrc 要求 22.15.0，本机无法切换，阶段报告注明）/ Chromium（Playwright）
构建：`vite v7.3.8`，198 modules transformed

## 1. 命令与退出码

| 命令 | 结果 | 退出码 |
| --- | --- | --- |
| `npm run content:build`（随 build 执行） | `catalog bytes=73160 gzip=15282 sha256=d2ab730dba911068947fa6fa73f2886ae02a6fcc47067b289c46db86e3e63dec`；`search bytes=509581 gzip=199467 sha256=c824dce44f71b2227eb36df02dcbf5de3019e80aa8b3e6ef3865a754780b6dbe` | 0 |
| `node -e "const c=require('./web/generated/catalog.json'); ..."` | `true true` | 0 |
| `npx vitest run web/scripts/test/mastery.test.ts web/scripts/test/search-docs.test.ts` | `Test Files 2 passed (2)`，`Tests 10 passed (10)`（mastery 6 + search-docs 4） | 0 |
| `npm run lint` | 无错误/警告输出 | 0 |
| `npm run typecheck` | `tsc -p tsconfig.json && tsc -p tsconfig.node.json` 无输出 | 0 |
| `npm run build` | 构建成功，chunk 列表见 §4；`content:validate` 输出 `stages=9 lessons=45 projects=9 checks=135 exercises=79 pythonLessons=34 pythonBlocks=60 pythonTracks=38 duration=3400` | 0 |
| `npx playwright test e2e/content.spec.ts --project=chromium -g "lazy\|search"` | `2 passed (3.3s)` | 0 |
| `npx vitest run`（全量，多次） | `Test Files 25 passed (25)`，`Tests 270 passed (270)` | 0 |

内容装配不变的基线对比：catalog sha256 `d2ab730d…` 与 search sha256 `c824dce4…` 与本任务改动前（main.tsx 内联 fallback 之前）的构建输出逐字节一致；`content:validate` 的 9/45/9/135/79/34/60/38/3400 计数与 T-E3.0 基线一致。

### 依赖守卫（三条均无输出，`grep` 未命中退出码 1）

```bash
grep -R "content/index" web/scripts/app web/scripts/main.tsx          # exit=1，无输出
grep -R "state/progress" web/scripts/app web/scripts/main.tsx         # exit=1，无输出
grep -R "from './search'" web/scripts/app/shell                       # exit=1，无输出
```

## 2. 懒加载与搜索行为

### 2.1 五段网络请求（`performance.getEntriesByType('resource')` 过滤 `assets/(s[0-7]|appendix)-*.js` 与 `search-index-*`）

| 状态 | 阶段 chunk | 搜索索引 |
| --- | --- | --- |
| 初次 `#/` | `[]` | 未请求 |
| 进入 `#/lesson/s0-l1` | `["/assets/s0-xX3Chzul.js"]` | 未请求 |
| 同阶段切到 `#/lesson/s0-l2` | `["/assets/s0-xX3Chzul.js"]`（无新增） | 未请求 |
| 跨阶段切到 `#/lesson/s1-l1` | `["/assets/s0-xX3Chzul.js", "/assets/s1-B0vKTgQ9.js"]` | 未请求 |
| 聚焦 `#search-input` 前 | 同上 | `[]` |
| 聚焦 `#search-input` 后 | 同上 | `["/assets/search-index-BwozhHnn.js"]`，decoded=507069，encoded=199343 |

初次加载的全部资源：`/assets/next-CgZQG9iO.js`、`/assets/harness-C7C4HMlC.css`、`/assets/harness-CQf13NWK.js`、`/assets/catalog-DALFsimK.js`。除 shell 所需的 catalog 外无阶段内容。

### 2.2 E2E 断言（`e2e/content.spec.ts`）

- `lazy 阶段内容按阶段加载，跨阶段才新增 chunk`：通过真实点击（总览 CTA「从第一讲开始」→ 课时页「下一讲」→ 侧栏 `s1` 展开 → `s1-l1`）驱动；断言初次 0 个阶段 chunk、首次课时 1 个、同阶段切讲不变、跨阶段 +1；控制台错误为 `[]`。
- `search 索引在聚焦搜索框后才按需下载并可用`：聚焦前无 `search-index-*` 请求；聚焦后轮询 `decodedBodySize || encodedBodySize > 300000` 成立，输入 `LinkHub` 后出现 `role=option` 结果；控制台错误为 `[]`。

## 3. 等价测试

- `mastery.test.ts`（6 例）：`masteryFromCatalog(catalog, state)` 与 `state/mastery-core.ts` 在全部 45 讲逐讲、9 个阶段汇总、课程汇总与 nextLesson 上逐一比较。夹具覆盖：空进度；仅手动 `setLessonDone`（含 appendix）；某讲全部题目通过；仅部分题目通过；Python 轨道仅在 `@py` 键计分且非 Python 题上的脏 `@py` 不计入；混合进度（s0 手动完成 + s2 部分完成）下 nextLesson 与阶段汇总。全部一致。
- `search-docs.test.ts`（4 例）：40 条查询语料（DNS/TCP/TLS/HTTP/curl/事件循环/…/性能/复杂度/测试）逐条比较 `searchFromDocs(generated/search-index.json, q)` 与 E2 `searchCurriculum(q)` 的 `href/title/sub` 及顺序，全部一致；空白查询返回 `[]`；命中上限 12；`search-docs.ts` 源码不含 `content/index` 与 `search-curriculum` 依赖。

## 4. 构建 chunk 与 gzip

| 产物 | 大小 (kB) | gzip (kB) |
| --- | --- | --- |
| index.next.html | 1.41 | 0.96 |
| js.worker-C9tqQ_5J.js | 2.55 | — |
| index.html（v2 入口） | 4.96 | 2.10 |
| harness-C7C4HMlC.css | 42.55 | 8.64 |
| graduation-CRBd9dd5.js | 24.29 | 10.61 |
| harness-CQf13NWK.js | 26.34 | 9.86 |
| catalog-DALFsimK.js | 52.03 | 14.49 |
| s0-xX3Chzul.js | 71.04 | 25.32 |
| main-Dca6gcnt.js | 71.48 | 23.94 |
| s4-DTzXEQkl.js | 109.16 | 33.27 |
| s2-hDabEVSh.js | 117.70 | 36.45 |
| s1-B0vKTgQ9.js | 118.02 | 34.16 |
| s3-NiPcLAVK.js | 119.97 | 34.07 |
| s5-Cx8jGftZ.js | 123.42 | 35.46 |
| s6-CrkyoUzX.js | 144.34 | 42.31 |
| s7-CRWnCbm-.js | 210.11 | 58.07 |
| appendix-DxFFXbYb.js | 283.17 | 87.23 |
| next-CgZQG9iO.js | 400.44 | 126.80 |
| search-index-BwozhHnn.js | 507.07 | 199.34 |

Vite 提示 `search-index` 超过 500 kB；该 chunk 只在搜索聚焦后加载，体积预算与强断言按计划留待 E4 T-E4.6。

## 5. 偏离与修复记录

1. **搜索模块 relocation**：原 `app/shell/search.ts`（运行时依赖 `content/index`）删除；运行时改为 `app/shell/search-docs.ts` + `generated/search-index.json`（按需 import）。E2 算法原样迁至测试专用 `test/search-curriculum.ts` 作为对等 oracle，`test/search.test.ts` 改引该 oracle。守卫 3 保证 shell 不再引用 `./search`。v2 运行时未受影响。
2. **React 19 `use()` 的测试适配**：懒加载 loader 首次渲染时触发动态 import，其 resolve 落在同步 `render` 之外会导致 Suspense 重试丢失。6 个页面测试的渲染助手改为「先预加载对应 loader，再 `await act(async () => render(...))`」（stage/overview/lesson/project/report/shell）。
3. **报告页测试抖动修复**：`report.test.tsx` 的渲染助手最初只预加载 stages 与 graduation，而 `ReportPage → useMastery → useCatalog` 还需 catalog，冷启动时出现二次挂起导致首例间歇失败（单文件重复 8 次可稳定复现）。补 `await loadCatalog()` 后单文件重复 5 次与全量套件多次均 270/270。该问题仅存在于测试装载顺序，运行时由根 Suspense 兜底，不涉及产品逻辑。
4. **E2E 类型约束**：`e2e` 走 `tsconfig.node.json`（无 DOM lib），首个版本使用 `window.location.hash` 与 `PerformanceResourceTiming` 类型导致 typecheck 失败；改为真实 UI 点击导航，并用 `{ decodedBodySize?: number; encodedBodySize?: number }` 结构化类型读取资源条目。

## 6. 残余风险

- 搜索索引 chunk 507.07 kB（gzip 199.34 kB）超过 Vite 500 kB 提示阈值；按设计仅聚焦后加载，预算门禁在 E4 处理。
- 首次加载仍包含 catalog 52.03 kB（gzip 14.49 kB），侧栏与总览首屏依赖它；未做骨架屏分级。
- 阶段 chunk 内已包含该阶段的 Python 代码块与轨道（`@py`），单 chunk 最大为 appendix 283.17 kB（gzip 87.23 kB）。
- 实机 Node 为 v24.22.1；全部门禁在该版本通过，与 .nvmrc 的 22.15.0 差异记入阶段报告。

## 7. 提交

`T-E3.5: 阶段内容懒加载与搜索索引按需加载`（哈希见阶段报告）。