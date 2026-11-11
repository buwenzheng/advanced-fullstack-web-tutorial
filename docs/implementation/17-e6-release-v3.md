# E6：v3.0.0 私有发布与线上验收

> 上级：`10-frontend-engineering.md` §5、§6 E6、§7；前置：`16-e5-switch-and-cleanup.md`。
> 目标：把 E5 的单入口构建产物 `dist/` 以新的 action 发布到既有私有站点，保留 `functions/` 边缘函数与全部兼容契约；完成线上 66 路由、四类任务、进度迁移、实验台、报告与访问范围验收，产出 v3.0.0 发布说明、评审报告与发布标签。
> 工期：0.5 人日。完成定义：G-E6 通过，标签 `v3.0.0`。
>
> **2026-11-11 状态变更**：站点属于旧 Qoder 账号，当前账号无权管理（`sites_request_failed`）。用户决定移除 Qoder Site 发布，站点绑定与线上发布专用产物已删除；自 T-E6.2 起的站点相关任务不再执行，文中引用的 `e2e/deployed.spec.ts` 与发布证据文件已删除，E6.4 发布说明与 `v3.0.0` 标签未执行。本文件保留为历史计划，E6.0/E6.1 的本地冻结与验证证据仍然有效；部署改由 `.github/workflows/deploy.yml` 在 `verify` 通过后发布到 GitHub Pages。

## 1. 阶段边界

### 1.1 本阶段做

- 发布前冻结：确认 `e5-switch` 标签、干净工作区、`verify`/视觉/Python/离线 `dist` 全绿；
- 产物审计：`dist/` 只含静态站点文件，无 source map、TS 源码、docs、backups、tmp；`functions/` 与 v2.0.1 完全一致；
- 新增线上冒烟工具 `e2e/deployed.spec.ts`：通过 `DEPLOYED_URL` 与登录态 storage state 跑 66 路由 + 函数健康检查；
- 复用既有 `projectId` / `siteId`，生成新 `actionId`，以 `webDirectory: "dist"`、`functionDirectory: "functions"`、`databaseAccess: "none"`、`spa: true` 执行 `prepare_site`；
- `publish_site` 并轮询到 `published: true`，确认访问范围仍为 `private`；
- 线上冒烟：66 路由、`/functions/v1/app/health`、四类任务、进度/草稿/语言存储、旧进度迁移、搜索、实验台、报告、移动端、匿名访问；
- 更新站点描述文件、`docs/release-notes-v3.md`、`docs/reviews/frontend-engineering/e6/g6-report.md`；
- 打发布标签 `v3.0.0`，记录 releaseId / deploymentId / artifactSha256 / 发布时间；
- 确认 v2.0.1 release 保留，回滚路径可用。

### 1.2 本阶段不做

- 不改课程内容、练习答案、测试、hash URL、`localStorage` 键与迁移规则；
- 不改 `functions/`、数据库、`DEMO_SECRET`、访问策略；
- 不新建 project/site，不更换 projectId/siteId，不复用旧 actionId；
- 不把站点改为公开；不删除 v2 release；不覆盖历史发布标签；
- 不用 `webDirectory: "."`；不以 `docs/`、`tmp/`、`backups/` 作为发布目录；
- 不在 `verify`、视觉、Python 或离线检查未通过时发布；
- 不手工编辑 `.后端进阶实验室.qoder.site` 中的 ID 与哈希；由平台在 prepare/publish 时更新；
- 不把登录态 storage state、cookie 或任何密钥提交到仓库；
- 文档本身不触发发布：只有用户明确要求执行发布时，才运行 `prepare_site` / `publish_site`。

### 1.3 本阶段结束时的可运行形态

- 线上站点为 v3.0.0，仍为私有，URL 与 v2 相同；
- 线上 66 条 hash 路由 0 控制台错误、无 404 资源、每条一个 `h1`；
- JS / SQL / 方案题在线上可完成，进度写入同一组 `localStorage` 键；
- 旧 `s6-l1..l6` 进度在线上迁移为 `a1..a6`；
- `/functions/v1/app/health` 登录态 200，实验台真实端点可用；
- 发布说明、评审报告、站点描述文件与 `v3.0.0` 标签齐全；
- v2.0.1 release 保留，可按平台回滚或按 `v2.0.1` 标签重建。

## 2. 前置条件

| 检查 | 命令 | 通过标准 |
| --- | --- | --- |
| 阶段标签 | `git tag --list e5-switch` | 输出 `e5-switch` |
| 工作区 | `git status --short` | 无业务文件改动；仅方案文档可未跟踪 |
| Node | `node -v` | `v22.15.0` |
| 依赖 | `npm ci` | 0 error |
| 全量门禁 | `npm run verify` | 全绿 |
| 视觉 | `npm run e2e:visual` | 21/21 |
| Python | `npm run e2e:python` | 全过 |
| Python 答案 | `npx tsx tools/run-python-exercises.ts` | 38/38 |
| 单入口 | `test "$(find dist -maxdepth 1 -name 'index*.html' \| wc -l)" -eq 1` | 退出码 0，且只有 `dist/index.html` |
| 离线服务 | 按 E5 §7.4 执行 | 首页与全部 assets 200 |
| 函数未变 | `git diff --stat v2.0.1 -- functions` | 无输出 |
| 站点私有 | `get_site_access` | `private` |
| v2 基线 | `git tag --list v2.0.1` | 输出 `v2.0.1` |
| 发布说明基线 | `ls docs/release-notes-v2.md` | 存在 |
| 站点描述 | `node -e "..."` 读取 projectId/siteId | 与 §3.2 一致 |

任一检查失败先修复，不进入 prepare。`prepare_site` 会消耗一次发布动作；不要在红灯状态下“先传上去看看”。

## 3. 发布输入与冻结

### 3.1 复用与新增

| 项 | 值 | 规则 |
| --- | --- | --- |
| projectId | `01a18744-0ff9-78c1-81e2-9a37aa9ec9c2` | 复用，不新建 |
| siteId | `01a18744-0ffa-79fa-92d9-0ac6a3f812aa` | 复用，不新建 |
| actionId | 本次新生成 UUID | 不复用 v2 的 `aa4fa5cb-6055-49ad-beff-738512ddf628` |
| projectRoot | 仓库根目录 | 不指向 `web/` 或 `dist/` |
| webDirectory | `"dist"` | v3 唯一变化；不是 `"."` |
| functionDirectory | `"functions"` | 漏掉会把边缘函数从 release 中丢掉 |
| databaseAccess | `"none"` | 本项目不使用数据库 |
| spa | `true` | 固定输入；hash 路由本身不需要服务器重写 |
| 访问范围 | `private` | 不修改；发现公开先停止 |

读取当前描述文件确认 ID：

```bash
node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('.后端进阶实验室.qoder.site','utf8'));console.log({projectId:d.publication.projectId,siteId:d.publication.siteId,releaseId:d.publication.releaseId,actionId:d.publication.actionId});"
```

预期 projectId / siteId 与上表一致；releaseId 为 v2.0.1 的 `01a1c34e-87a3-773c-86c3-f58087e01acd`。

生成新 actionId：

```bash
python -c "import uuid; print(uuid.uuid4())"
```

把输出记录到 `docs/reviews/frontend-engineering/e6/action-id.txt`；同一个发布动作只使用这一个值。

### 3.2 产物审计

```bash
mkdir -p docs/reviews/frontend-engineering/e6
npm run build
find dist -maxdepth 1 -type f
find dist -type f \( -name "*.map" -o -name "*.ts" -o -name "*.tsx" -o -name "*.md" \)
find dist -type d \( -name docs -o -name backups -o -name tmp \)
grep -nE '(src|href)="/' dist/index.html
du -sh dist
```

要求：

- `dist/index.html` 存在且只有这一个 HTML；
- 无 `*.map`、`.ts`、`.tsx`、`.md`；
- 无 `docs/`、`backups/`、`tmp/` 目录；
- `src` / `href` 不得以 `/` 开头（`base: './'` 生效）；
- 记录文件清单：

```bash
find dist -type f | sort > docs/reviews/frontend-engineering/e6/dist-files.txt
```

同时记录：

```bash
git diff --stat v2.0.1 -- functions > docs/reviews/frontend-engineering/e6/functions-diff.txt
git status --short functions > docs/reviews/frontend-engineering/e6/functions-status.txt
```

两份都应为空。`functions/handler.ts` 中的 `DEMO_SECRET` 不得出现在 `dist/`：

```bash
if grep -R -q "backend-lab-demo-secret-not-for-production" dist; then
  echo "dist 中包含 DEMO_SECRET，停止发布" >&2
  false
else
  echo "secret check ok"
fi
```

命中时以失败状态结束，但不关闭当前终端；也可直接肉眼确认该输出为空。

### 3.3 发布目录回退方案

平台若不接受 `webDirectory: "dist"`，按以下顺序处理：

1. 先确认失败原因是目录不在 `projectRoot` 下，还是平台要求特定子目录；
2. 不改成 `"."`，不把 `docs/` 一起上传；
3. 回退构建到 `web/dist`：

```bash
# 临时把 vite.config.ts 的 outDir 改为 'dist'（相对 root: 'web'）
# 或：
npx vite build --outDir dist
```

4. 以 `webDirectory: "web/dist"` 重新 `prepare_site`，使用**新的** actionId；
5. 发布成功后，把 `vite.config.ts` 的 `outDir` 恢复为 `../dist`，并在报告中记录为何使用回退路径；
6. 不保留两份构建产物同时上传。

回退方案不是默认路径；只有 `dist` 被明确拒绝时才使用。

## 4. 发布流程

### 4.1 工具与状态机

使用 Qoder Sites 工具，顺序固定：

1. `get_context`：确认当前工作区、站点目录与运行环境；
2. `get_site`：读取 projectId/siteId、当前 release、函数与访问范围；
3. `get_site_access`：确认 `private`；
4. `prepare_site`：新 actionId + §3.1 输入；
5. `get_publish_status`：等待 draft ready / `canPublish: true`；
6. `publish_site`：仅对该 action 调用一次；
7. `get_publish_status`：按 `retryAfterMs` 轮询到 `published: true`；
8. Desktop 环境调用 `show_publish_confirmation`（已发布 action）；
9. 执行线上冒烟；
10. 更新文档、提交、打标签。

状态处理：

| 观察到的状态 | 下一步 |
| --- | --- |
| `published: true` 且 release 对应本次 action | 发布完成，进入线上冒烟 |
| `readiness: publication_completed` 但 `published: false` | 该 action 是历史提交，不能靠再次 publish 变成当前版本；按需新 action |
| publish 操作 queued / running / 等待重试 | 按 `retryAfterMs` 等待后读取同一 action，不新建 |
| 操作 failed / cancelled | 停止轮询；记录 `safe_message`；诊断后再决定是否新 action |
| draft 有 blocker | 只修 blocker，保留 action；不重复 prepare |
| `canPublish: true` 且无 pending publish | 对同一 action 调用一次 `publish_site` |
| 无匹配状态 | 先读 operation / site，不在未知状态下写入 |

### 4.2 发布前读取

调用 `get_context`，记录：

- 工作区根目录；
- 当前站点目录；
- Desktop / CLI 能力（决定是否使用 `show_publish_confirmation`）。

调用 `get_site`，记录：

- projectId / siteId 与 §3.1 一致；
- 当前 published release 为 v2.0.1；
- 函数 `app` 存在；
- 访问范围 `private`。

调用 `get_site_access`，确认 `private`。若为公开：

- 停止发布；
- 报告访问策略异常；
- 不通过发布流程改变权限，也不把站点当作已私有继续。

### 4.3 `prepare_site`

输入：

```json
{
  "projectRoot": "C:/Users/jm014254/Desktop/temporary/site/算法学习",
  "projectId": "01a18744-0ff9-78c1-81e2-9a37aa9ec9c2",
  "siteId": "01a18744-0ffa-79fa-92d9-0ac6a3f812aa",
  "actionId": "<本次新 UUID>",
  "webDirectory": "dist",
  "functionDirectory": "functions",
  "databaseAccess": "none",
  "spa": true
}
```

要求：

- `actionId` 与 `action-id.txt` 一致；
- 不添加临时字段、不夹带环境变量或密钥；
- 若工具返回 `sites_document_invalid`：保留文件与站点身份；不要手写新的描述文件；按工具提示恢复或重试同一 prepare；
- 若报告目录不存在：确认 `npm run build` 已生成 `dist/index.html`，不要改用 `"."`；
- prepare 成功后记录返回值与 `prepare-status.json`（actionId、readiness、`canPublish`、artifactSha256）。

### 4.4 `publish_site` 与状态轮询

- 只有 `get_publish_status` 显示 draft 无 blocker 且 `canPublish: true` 时才调用 `publish_site`；
- 调用一次，不并行、不重复；
- 按返回的 `retryAfterMs` 轮询同一 action；
- 成功后记录：

```text
published: true
releaseId: <值>
deploymentId: <值>
artifactSha256: <值>
publishedAt: <值>
site.url: <值>
access: private
```

- 若等待超时：报告最后观察到的 pending/unknown 状态，保留 action，稍后再查；超时不等于失败，不创建替代 action；
- 若 publish 失败：保留现场，读取 `get_operation` / `get_site` 后再决定；不把旧 release 说成新版本。

### 4.5 Desktop 预览确认

在 Desktop 环境，发布成功后调用 `show_publish_confirmation`，传入本次 action：

- 它展示冻结的静态预览与已发布状态；
- 不再次执行发布；
- 保留返回的 `deliveryMarkdown` 作为最终交付文案；
- 预览不执行边缘函数，函数验收仍以线上 `health` 为准。

CLI / 无预览环境：返回 `get_publish_status.site.url` 与发布摘要即可。

### 4.6 发布失败处理

| 现象 | 处理 |
| --- | --- |
| prepare 报 blocker | 只修 blocker；保留 action；必要时同 action 重试 |
| 发布后首页 404 | 检查 `webDirectory` 是否为 `dist`、`dist/index.html` 是否存在；不改 project/site |
| 发布后资源 404 | 检查 `base: './'`、文件名大小写、构建是否最新；修复后新 action |
| 函数 404 / 500 | 检查 `functionDirectory: "functions"` 与 `get_site` 函数状态；不改前端绕过；修复后新 action |
| 访问范围变公开 | 立即停止扩散，修正访问策略；发布动作不授权改公开 |
| 线上回归 | 按 §7 回滚；不反复发布碰运气 |
| 状态长时间 pending | 按 `retryAfterMs` 重读同一 action；不重复 publish |
| 收到 `sites_document_invalid` | 保留描述文件与站点身份；按工具提示恢复，不手写 ID |
| `sites_function_deploy_failed` | 报告安全错误信息；不改编译参数猜修；保留原 release |

## 5. 线上冒烟

### 5.1 登录态与 storage state

私有站点需要 Qoder 登录。自动化使用 Playwright storage state：

```bash
mkdir -p tmp
npx playwright codegen --save-storage=tmp/deployed-auth.json "<发布后的站点 URL>"
```

在打开的浏览器里完成登录，确认能看到总览，然后关闭窗口。`tmp/` 已被 `.gitignore` 忽略；该文件包含登录 cookie，**不得提交、不得粘贴到文档**。验收完成后删除：

```bash
rm -f tmp/deployed-auth.json
```

若无法使用交互式登录：

- 使用 browser-use MCP 或日常已登录浏览器完成 §5.3–§5.6 手工矩阵；
- 在报告中记录“66 路由自动化为手工执行”及原因；
- 不得把“未登录 401”当作路由失败。

### 5.2 `e2e/deployed.spec.ts`

新增发布后冒烟 spec。它只在设置 `DEPLOYED_URL` 时运行，未设置时整组跳过，因此不影响 `npm run verify`。

```ts
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const BASE = (process.env.DEPLOYED_URL || '').replace(/\/+$/, '');
const STORAGE = process.env.DEPLOYED_STORAGE_STATE;
const routes = JSON.parse(readFileSync('e2e/routes.json', 'utf8')) as string[];

test.use(STORAGE ? { storageState: STORAGE } : {});

test.describe('deployed v3 smoke', () => {
  test.skip(!BASE, 'DEPLOYED_URL 未设置');
  test.beforeEach(() => {
    test.setTimeout(60_000);
  });

  for (const route of routes) {
    test(`@deployed ${route}`, async ({ page }) => {
      const issues: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') issues.push(`console: ${message.text()}`);
      });
      page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));
      page.on('response', (response) => {
        if (response.status() >= 400) issues.push(`http ${response.status()}: ${response.url()}`);
      });

      const response = await page.goto(`${BASE}${route}`);
      expect(response?.ok(), `${route} 文档响应`).toBe(true);
      await expect(page.locator('main h1')).toHaveCount(1);
      await page.waitForLoadState('networkidle');

      const text = (await page.locator('main').innerText()).trim();
      expect(text.length, `${route} 正文不能为空`).toBeGreaterThan(20);
      expect(issues, route).toEqual([]);
    });
  }

  test('@deployed health', async ({ page }) => {
    const response = await page.request.get(`${BASE}/functions/v1/app/health`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { ok?: boolean; service?: string };
    expect(body.ok).toBe(true);
    expect(body.service).toBe('backend-lab');
  });
});
```

运行：

```bash
DEPLOYED_URL="https://backend-for-frontend-0nmydpfsdfg.qoder.website" \
DEPLOYED_STORAGE_STATE="tmp/deployed-auth.json" \
npx playwright test e2e/deployed.spec.ts --project=chromium --workers=1
```

要求：

- `--workers=1`：66 条路由顺序执行，避免对私有站点并发施压，失败可逐条定位；
- 控制台只收集 `error` 与未捕获异常；`warning` 不阻塞；
- 响应 4xx/5xx 一律记为失败（含资源、接口）；
- 每条路由 `h1` 恰好一个、正文长度 > 20；
- 首次部署若因登录态过期被重定向，先刷新 storage state，不改断言；
- 测试标题含 `@deployed`，可单独筛选。

### 5.3 四类任务与存储

在线上打开 `#/lesson/s1-l2`，逐项验收：

| 类型 | 操作 | 预期 |
| --- | --- | --- |
| 检查题（mcq） | 选择正确项 → 点“提交答案” | 显示“答对了”与解析；进度写入 `bff-lab-progress-v1` |
| JS 代码题 `s1-l2-ex-1` | 点“查看参考答案” → “运行测试” | 全部用例通过；输出无异常 |
| SQL 题 `s1-l2-ex-2` | 点“查看参考答案” → “执行 SQL” | 结果与预期行一致；排序稳定 |
| 方案题 `s1-l2-ex-3` | 勾选全部清单项 | 显示 `自检 n/n · 已完成`；刷新后仍保留 |

刷新页面后确认：

```js
localStorage.getItem('bff-lab-progress-v1')
localStorage.getItem('bff-lab-drafts-v1')
localStorage.getItem('bff-lab-lang-v1')
```

键名不变，完成状态保留。切换语言轨道后刷新，仍保持所选轨道。

### 5.4 旧进度迁移

使用独立的测试浏览器 profile，避免覆盖日常进度。在站点控制台执行：

```js
localStorage.setItem('bff-lab-progress-v1', JSON.stringify({
  q: {}, l: { 's6-l1': { done: true } }, p: {}, meta: { version: 1 }
}));
localStorage.setItem('bff-lab-drafts-v1', JSON.stringify({ 's6-l1-ex-1': 'legacy draft' }));
location.hash = '#/stage/appendix';
location.reload();
```

刷新后验证：

```js
const progress = JSON.parse(localStorage.getItem('bff-lab-progress-v1'));
const drafts = JSON.parse(localStorage.getItem('bff-lab-drafts-v1'));
progress.meta.version;      // 2
progress.l.a1.done;         // true
progress.l['s6-l1'];        // undefined
drafts['a1-ex-1'];          // 'legacy draft'
drafts['s6-l1-ex-1'];       // undefined
```

同时在附录阶段页确认 `a1` 显示已完成。旧键未残留、版本升到 2、草稿同步映射。

### 5.5 搜索、实验台、报告与移动端

| 项目 | 操作 | 预期 |
| --- | --- | --- |
| 搜索 | 聚焦搜索框，输入“索引”或“EXPLAIN”，点第一条 | 结果出现；跳转正确；首次聚焦后才请求搜索索引 |
| 实验台 | `#/lab`，选真实端点 `GET /health`，发送 | 200；JSON 可读；历史记录出现 |
| 实验台重置 | 点“重置” | 请求恢复默认 GET，响应/历史清空，教学文案回到初始 |
| 报告 | 完成一题后打开 `#/report` | 统计、掌握度、待攻克题目更新 |
| 移动端 | 390×844 | 无横向滚动；抽屉可开合；路由切换自动关闭 |
| 未知道路 | 输入 `#/lesson/not-exist` | 文案「找不到这一讲，可能是链接有误。」；URL 不变 |
| 清空记录 | 顶部“清空学习记录” | confirm 文案、toast、归零与 v2 一致 |

### 5.6 私有访问

在无痕窗口或退出登录后访问站点根路径：

- 出现 Qoder 登录/无权访问页面；
- 不能直接读到课程正文；
- 记录状态码或重定向地址到报告。

不得为了“方便验收”把站点改为公开。

### 5.7 证据

写入 `docs/reviews/frontend-engineering/e6/`：

- `preflight.txt`：标签、工作区、verify/视觉/Python/离线结果；
- `verify.txt`：`npm run verify` 完整日志；
- `dist-files.txt`、`functions-diff.txt`、`functions-status.txt`；
- `action-id.txt`；
- `prepare-status.json`、`publish-status.json`；
- `deployed-routes.txt`：66 路由结果；
- `health.json`：函数健康检查；
- `exercise-smoke.md`：四类任务、搜索、实验台、报告、移动端；
- `migration.txt`：迁移前后 localStorage；
- `private-access.png` 或文字记录；
- `g6-report.md`：最终结论、时间线、残余风险；
- 发布前后关键页面截图（1440 与 390 各至少总览、课时、报告）。

登录态文件与任何 cookie 不进入证据目录。

## 6. 发布后文档与标签

### 6.1 `docs/release-notes-v3.md`

使用以下结构，发布后填入真实值：

```markdown
# 后端进阶实验室 · v3 发布说明

- 发布版本：v3.0.0
- 发布时间：<publishedAt>
- 站点：后端进阶实验室（私有）
- 地址：<site.url>

## 1. 版本概览

v3.0.0 是前端工程化改造版本：课程内容、练习答案、hash URL、localStorage 键与旧进度迁移规则保持不变，运行时与构建链路迁移到 React 19 + Vite 7 + TypeScript 5.9。

| 维度 | 规模 |
| --- | --- |
| 阶段 | 9 个（S0–S7 + 附录） |
| 课时 | 45 讲 |
| 项目 | 9 个（p0–p7 + 毕业项目） |
| 任务 | 214 个（检查题、代码题、SQL 题、方案题） |
| 练习 | 38 道 JS、38 道 Python、2 道 SQL |
| 包体 | 入口 <entry gzip>，最大懒加载 <lazy gzip>，搜索索引 <search gzip> |

## 2. 本次变更

- 默认入口切换到 React 19 + React Router 7，删除 v2 的 `app.js`、`views/**`、`ui.js` 与 `engine/exercise.js`；
- Vite 7 单入口构建，产物 `dist/` 以相对路径部署；
- 内容、状态、引擎与工具迁移到 TypeScript strict，Zod 校验内容结构与语义；
- 新增路由/响应式/键盘/axe/视觉/覆盖率/包体门禁，`npm run verify` 为唯一权威命令；
- 阶段内容按需加载，搜索索引首次聚焦后才下载；
- 发布目录从 `web/` 改为 `dist/`，`functions/` 继续随 release 部署。

## 3. 不变项

- 66 条 hash URL 与页面文案；
- 课程正文、练习答案、测试与项目里程碑；
- `bff-lab-progress-v1`、`bff-lab-drafts-v1`、`bff-lab-lang-v1`；
- `s6-l1..l6 → a1..a6` 旧进度迁移；
- `functions/`、`DEMO_SECRET` 的演示值、站点私有访问与 projectId/siteId。

## 4. 验证摘要

- 本地：`npm run verify` 全绿；视觉 21/21；Python 38/38；`dist/` 离线静态服务通过；
- 线上：66/66 路由 0 控制台错误、0 资源 4xx/5xx；`health` 200；
- 任务：mcq / code / sql / design 四类在线上完成；
- 迁移：版本 2、`a1` 完成、旧键不残留；
- 访问：匿名不可读；站点 `private`。

## 5. 发布信息

| 项 | 值 |
| --- | --- |
| actionId | <actionId> |
| releaseId | <releaseId> |
| deploymentId | <deploymentId> |
| artifactSha256 | <artifactSha256> |
| 发布时间 | <publishedAt> |
| 访问范围 | `private`（未变更） |

## 6. 已知限制

- 私有站点需要 Qoder 登录；发布后自动化使用本地 storage state，登录态文件不入库；
- Python 判题首次需要联网加载 Pyodide，之后依赖浏览器缓存；
- 视觉基线为 Windows 基线，CI 不执行 `@visual`；
- 迷你 SQL 引擎是教学子集，不支持窗口函数、子查询、`UNION`、`RIGHT/FULL JOIN`；
- `DEMO_SECRET` 是固定演示值，仅存在于 `functions/handler.ts`；站点保持私有，不使用真实凭证。

## 7. 回滚

- 首选平台按 release 回滚到 v2.0.1：releaseId `01a1c34e-87a3-773c-86c3-f58087e01acd`；
- 平台无回滚时，检出 `v2.0.1`，以 `webDirectory: "web"`、`functionDirectory: "functions"` 重新 prepare/publish，projectId/siteId 不变；
- 源码标签：`v2.0.1` 与 `v3.0.0`；回滚后按 v2 冒烟矩阵复验并记录时间线。
```

要求：

- 不写 `DEMO_SECRET` 的值、不写登录 cookie、不写内部 operation ID；
- 包体数字来自 `npm run budget` 输出；
- 发布信息必须与 `get_publish_status` 返回值一致；
- 若使用 `web/dist` 回退，发布说明中明确写出实际 `webDirectory`。

### 6.2 `docs/reviews/frontend-engineering/e6/g6-report.md`

```markdown
# G-E6 发布评审报告

## 1. 结论
- 发布结果：成功 / 失败
- 版本：v3.0.0
- 站点：<url>
- 访问范围：private
- 时间线：<准备、prepare、publish、冒烟、回滚确认>

## 2. 发布前
- e5-switch 标签与提交
- verify / 视觉 / Python / 离线结果
- dist 文件数、体积、无源码与 map
- functions 与 v2.0.1 的 diff（应为空）

## 3. 发布动作
- projectId / siteId
- actionId
- prepare 状态与 artifactSha256
- publish 状态、releaseId、deploymentId、publishedAt

## 4. 线上冒烟
- 66 路由结果
- health
- 四类任务
- 迁移
- 搜索 / 实验台 / 报告 / 移动端
- 私有访问
- 截图路径

## 5. 回滚
- v2.0.1 release 是否保留
- 平台回滚路径或标签重建路径
- 回滚验证结果（未实际回滚时说明“仅确认可用”）

## 6. 残余风险
- 表格：风险、影响、缓解、触发信号

## 7. 证据索引
- 按 §5.7 列出文件
```

### 6.3 站点描述文件、提交与标签

发布成功后：

```bash
git diff -- ".后端进阶实验室.qoder.site"
```

检查：

- `projectId` / `siteId` 未变；
- `actionId` 为本次新值；
- `releaseId` / `deploymentId` / `artifactSha256` / `publishedAt` 已更新；
- 不手工修改任何 ID。

提交范围（只包含发布相关文件）：

```bash
git add docs/release-notes-v3.md docs/reviews/frontend-engineering/e6 ".后端进阶实验室.qoder.site" e2e/deployed.spec.ts
git commit -m "release: v3.0.0"
```

要求：

- 不提交 `tmp/deployed-auth.json`、`dist/`、`web/generated/`、日志或截图之外的临时文件；
- 提交前 `git status --short` 复核；
- 用户未要求推送时不推送。

打标签：

```bash
git tag -a v3.0.0 -m "v3.0.0 前端工程化：React 19 + Vite 7 + TypeScript，私有发布"
```

标签应指向包含发布说明、报告与描述文件的提交。不移动 `v2.0.1`，不覆盖已有标签。

## 7. 回滚

### 7.1 触发条件

- 线上 66 路由出现阻塞性失败；
- 函数 `health` 持续 404/500 且无法快速修复；
- 静态资源大面积 404；
- 进度/草稿/迁移数据丢失或键变化；
- 访问范围变为公开且无法立即恢复私有。

### 7.2 回滚顺序

1. **平台回滚优先**：使用 Sites 的 release 回滚到 v2.0.1 `01a1c34e-87a3-773c-86c3-f58087e01acd`；记录操作时间与 releaseId；
2. **按标签重建**：平台无回滚时，检出 `v2.0.1`，执行 v2 发布流程：
   - `webDirectory: "web"`；
   - `functionDirectory: "functions"`；
   - `databaseAccess: "none"`、`spa: true`；
   - 新 actionId，projectId/siteId 不变；
3. 按 `09-qa-release.md` §6.1 的 v2 冒烟矩阵复验；
4. 确认访问范围仍为 `private`；
5. 记录回滚原因、影响、时间线、后续修复。

### 7.3 禁止

- 删除站点或重建 project；
- 修改访问范围为公开；
- 复用旧 action 冒充新版本；
- 用 `git reset --hard` 覆盖本地历史；
- 在未验证 v2 release 可用前宣称“已回滚”。

## 8. 目标结构与改动清单

### 8.1 新增

```text
e2e/deployed.spec.ts                              # 线上 66 路由 + health
docs/release-notes-v3.md                          # 发布说明
docs/reviews/frontend-engineering/e6/
  preflight.txt
  verify.txt
  dist-files.txt
  functions-diff.txt
  functions-status.txt
  action-id.txt
  prepare-status.json
  publish-status.json
  deployed-routes.txt
  health.json
  exercise-smoke.md
  migration.txt
  private-access.png
  g6-report.md
```

### 8.2 修改

```text
.后端进阶实验室.qoder.site                         # 平台自动更新发布元数据
```

### 8.3 不修改

```text
web/**                       # E5 已冻结
functions/**                 # 与 v2.0.1 一致
docs/implementation/09-qa-release.md  # 仅 E5 已更新的命令
projectId / siteId / 访问策略
```

## 9. 任务卡

### T-E6.0 发布冻结与产物审计

- **类型**：release
- **依赖**：E5 完成
- **产出**：
  - `docs/reviews/frontend-engineering/e6/preflight.txt`
  - `docs/reviews/frontend-engineering/e6/verify.txt`
  - `docs/reviews/frontend-engineering/e6/dist-files.txt`
  - `docs/reviews/frontend-engineering/e6/functions-diff.txt`
  - `docs/reviews/frontend-engineering/e6/functions-status.txt`
- **实现要求**：

1. 确认 `e5-switch` 标签、干净工作区、`v2.0.1` 标签；
2. 执行 §2 全部前置命令并记录输出；
3. 执行 §3.2 产物审计，确认 `dist/` 无源码、map、docs、backups、tmp；
4. 确认 `functions/` 相对 v2.0.1 无 diff；
5. 计算并记录 `dist` 文件数与体积；
6. 不发布、不改文件。

- **命令**：

```bash
mkdir -p docs/reviews/frontend-engineering/e6
npm ci
( set -o pipefail; npm run verify 2>&1 | tee docs/reviews/frontend-engineering/e6/verify.txt )
npm run e2e:visual
npm run e2e:python
npx tsx tools/run-python-exercises.ts
npm run build
find dist -type f | sort > docs/reviews/frontend-engineering/e6/dist-files.txt
git diff --stat v2.0.1 -- functions > docs/reviews/frontend-engineering/e6/functions-diff.txt
git status --short functions > docs/reviews/frontend-engineering/e6/functions-status.txt
```

- **预期**：全绿；`dist` 单 HTML；无禁止文件；函数 diff 为空。
- **约束**：不改课程内容、CSS、函数与访问策略；不提前 prepare。
- **证据**：四份输出与 `verify` 日志。
- **回滚**：无写入，无需回滚。
- **停止条件**：任一必过门禁红灯；`dist` 缺 `index.html`；函数有 diff；工作区不干净。

### T-E6.1 线上冒烟工具准备

- **类型**：qa
- **依赖**：T-E6.0
- **产出**：
  - `e2e/deployed.spec.ts`
  - `tmp/deployed-auth.json`（本地，不提交）
- **实现要求**：

1. 按 §5.2 新增 spec；
2. 确认未设置 `DEPLOYED_URL` 时整组跳过，`npm run verify` 仍然全绿；
3. 发布前无法生成合法登录态时，先准备手工矩阵模板，发布后补做；
4. 不把 storage state 写入仓库或证据目录。

- **命令**：

```bash
npm run lint
npm run typecheck
npx playwright test e2e/deployed.spec.ts --project=chromium
```

- **预期**：未设置环境变量时 0 失败（全部 skipped）；TypeScript 与 lint 通过。
- **约束**：spec 只读 `e2e/routes.json`；不改业务代码；不引入新依赖。
- **证据**：skipped 输出；登录态文件存在性（不展示内容）。
- **回滚**：删除 spec 与 `tmp/deployed-auth.json`。
- **停止条件**：spec 在无 URL 时失败；把 cookie 写入仓库。

### T-E6.2 `prepare_site`

- **类型**：release
- **依赖**：T-E6.1
- **产出**：
  - `docs/reviews/frontend-engineering/e6/action-id.txt`
  - `docs/reviews/frontend-engineering/e6/prepare-status.json`
- **实现要求**：

1. `get_context`、`get_site`、`get_site_access` 三项读取；
2. 确认 projectId/siteId、当前 release、函数与 `private`；
3. 生成新 actionId 并记录；
4. 按 §4.3 调用 `prepare_site`；
5. 读取 `get_publish_status`，确认 draft ready 或列出 blocker；
6. 有 blocker 只修 blocker，保留 action；
7. 不调用 `publish_site`。

- **命令/工具**：`get_context`、`get_site`、`get_site_access`、`prepare_site`、`get_publish_status`
- **预期**：draft ready / `canPublish: true`；artifactSha256 记录；访问范围仍私有。
- **约束**：不改 project/site；不使用 `"."`；不夹带密钥；不重复 prepare。
- **证据**：`prepare-status.json`（actionId、readiness、canPublish、artifactSha256）。
- **回滚**：保留 action；修正 blocker 后同 action 重试；不创建第二个 action。
- **停止条件**：访问范围非私有；目录被拒且回退方案未确认；prepare 返回不可恢复错误。

### T-E6.3 `publish_site` 与状态确认

- **类型**：release
- **依赖**：T-E6.2
- **产出**：
  - `docs/reviews/frontend-engineering/e6/publish-status.json`
- **实现要求**：

1. 确认 `canPublish: true` 且无 pending publish；
2. 对同一 action 调用一次 `publish_site`；
3. 按 `retryAfterMs` 轮询 `get_publish_status`；
4. 记录 `published: true`、releaseId、deploymentId、artifactSha256、publishedAt、site.url；
5. Desktop 环境调用 `show_publish_confirmation` 并保留 `deliveryMarkdown`；
6. 不重复发布、不新建 action。

- **命令/工具**：`publish_site`、`get_publish_status`、`show_publish_confirmation`（Desktop）
- **预期**：`published: true`；release 对应本次 action；访问范围 `private`。
- **约束**：发布动作只对本次 action；不修改访问策略；不删除 v2 release。
- **证据**：`publish-status.json` 与预览确认。
- **回滚**：失败时保留 action，按 §4.1 状态机处理；必要时按 §7 回滚 v2。
- **停止条件**：publish 失败且无法确认原因；release 指向旧 action；站点变为公开。

### T-E6.4 线上冒烟

- **类型**：qa
- **依赖**：T-E6.3
- **产出**：
  - `deployed-routes.txt`
  - `health.json`
  - `exercise-smoke.md`
  - `migration.txt`
  - 关键页面截图
- **实现要求**：

1. 按 §5.1 获取登录态；
2. 按 §5.2 跑 66 路由 + health；
3. 按 §5.3 完成四类任务与存储检查；
4. 按 §5.4 完成旧进度迁移；
5. 按 §5.5 完成搜索、实验台、报告、移动端、未知路由、清空记录；
6. 按 §5.6 完成匿名访问检查；
7. 所有失败记录 URL、截图、控制台与响应；阻塞项修复后需重新发布新 action 并重跑。

- **命令**：

```bash
DEPLOYED_URL="<site.url>" \
DEPLOYED_STORAGE_STATE="tmp/deployed-auth.json" \
npx playwright test e2e/deployed.spec.ts --project=chromium --workers=1
```

- **预期**：66/66 + health 通过；四类任务与迁移通过；匿名不可读。
- **约束**：不修改课程数据来“让测试通过”；不以公开站点换取自动化便利。
- **证据**：§5.7 全部文件。
- **回滚**：阻塞失败按 §7 回滚；非阻塞限制写入 release notes。
- **停止条件**：任一必过项失败；资源 404；函数 500；迁移失败；访问范围公开。

### T-E6.5 发布说明、报告、描述文件与标签

- **类型**：docs
- **依赖**：T-E6.4
- **产出**：
  - `docs/release-notes-v3.md`
  - `docs/reviews/frontend-engineering/e6/g6-report.md`
  - 更新后的 `.后端进阶实验室.qoder.site`
  - 提交 `release: v3.0.0`
  - 标签 `v3.0.0`
- **实现要求**：

1. 按 §6.1 写发布说明，填入真实 ID、时间、包体与验证结果；
2. 按 §6.2 写 G-E6 报告；
3. 检查描述文件 diff，确认 projectId/siteId 未变、发布元数据已更新；
4. 只提交发布相关文件；不提交登录态、dist、generated；
5. 打 `v3.0.0` 标签；
6. 未获用户指示不推送。

- **命令**：

```bash
git diff -- ".后端进阶实验室.qoder.site"
git status --short
git add docs/release-notes-v3.md docs/reviews/frontend-engineering/e6 ".后端进阶实验室.qoder.site" e2e/deployed.spec.ts
git commit -m "release: v3.0.0"
git tag -a v3.0.0 -m "v3.0.0 前端工程化：React 19 + Vite 7 + TypeScript，私有发布"
```

- **预期**：说明与报告完整；描述文件 ID 未变；提交与标签成功。
- **约束**：不写密钥/cookie；不移动旧标签；不把 `dist` 提交。
- **证据**：提交哈希、标签、描述文件 diff。
- **回滚**：`git tag -d v3.0.0` 仅用于标签错误；发布回滚按 §7。
- **停止条件**：发布说明与状态不一致；描述文件 ID 被改；误提交敏感文件。

### T-E6.6 G-E6 验收与交接

- **类型**：release-gate
- **依赖**：T-E6.5
- **产出**：
  - `g6-report.md` 的最终结论
  - 回滚可用性确认记录
- **实现要求**：

1. 按 §10 逐项勾选；
2. 确认 v2.0.1 release 仍存在且可回滚；
3. 确认站点私有、URL 可访问、函数正常；
4. 记录残余风险与已知限制；
5. 不再次发布；后续变更走新 action。

- **命令/工具**：`get_site`、`get_site_access`、`git tag --list`、`git status --short`
- **预期**：G-E6 全绿；v3.0.0 与 v2.0.1 标签并存；工作区干净。
- **约束**：G-E6 未全绿不得声称发布完成。
- **证据**：最终报告与清单。
- **回滚**：若最后发现阻塞缺陷，按 §7 回滚并更新报告。
- **停止条件**：任一验收项未通过；v2 release 不可用；站点非私有。

## 10. G-E6 验收清单

### 10.1 发布前

- [ ] `e5-switch` 与 `v2.0.1` 标签存在；
- [ ] 工作区干净；
- [ ] `npm run verify` 全绿；
- [ ] 单入口视觉 21/21；
- [ ] Python 轨道全过；
- [ ] `dist/` 离线静态服务通过；
- [ ] `dist/` 无 map、TS 源码、docs、backups、tmp；
- [ ] `functions/` 相对 v2.0.1 无 diff；
- [ ] 站点 `private`，projectId/siteId 未变。

### 10.2 发布动作

- [ ] 使用新 actionId，未复用 v2 action；
- [ ] `webDirectory: "dist"`、`functionDirectory: "functions"`、`databaseAccess: "none"`、`spa: true`；
- [ ] prepare 无未解决 blocker；
- [ ] `published: true`，release 对应本次 action；
- [ ] releaseId / deploymentId / artifactSha256 / publishedAt 已记录；
- [ ] 访问范围仍为 `private`；
- [ ] Desktop 预览确认已展示（若适用）。

### 10.3 线上功能

- [ ] 66/66 路由通过，0 控制台错误；
- [ ] 无资源 4xx/5xx；
- [ ] `/functions/v1/app/health` 登录态 200；
- [ ] mcq / code / sql / design 四类任务可完成；
- [ ] 进度、草稿、语言三把存储键不变且刷新保留；
- [ ] 旧 `s6-l1` 进度迁移为 `a1`，drafts 同步映射；
- [ ] 搜索、实验台、报告、清空记录正常；
- [ ] 390px 无横向滚动，抽屉可用；
- [ ] 未知路由回落且 URL 不变；
- [ ] 匿名访问不可读，站点私有。

### 10.4 交付物

- [ ] `docs/release-notes-v3.md` 完整且 ID 与状态一致；
- [ ] `docs/reviews/frontend-engineering/e6/g6-report.md` 完整；
- [ ] 站点描述文件更新且 projectId/siteId 未变；
- [ ] 提交不含登录态、dist、generated、密钥；
- [ ] `v3.0.0` 标签已打；
- [ ] v2.0.1 release 与标签保留；
- [ ] 回滚路径已确认（平台或标签重建）；
- [ ] 未把站点改为公开。

## 11. 风险与对策

| 风险 | 表现 | 对策 |
| --- | --- | --- |
| 私有登录阻断自动化 | 66 路由全部重定向登录 | 使用 storage state；不可用时用已登录浏览器手工执行并记录限制 |
| 平台拒绝 `dist` | prepare 报目录错误 | 用 `web/dist` 回退方案，新 action，不改成 `"."` |
| 函数未随 release 部署 | health 404 | 检查 `functionDirectory`；修复后新 action；不改前端绕过 |
| 资源绝对路径 | 线上资源 404 | 保持 `base: './'`；构建后 grep `src="/` |
| 缓存看到旧版本 | 页面仍是 v2 | 确认 releaseId 与 action 对应；硬刷新/换无痕；不重复发布 |
| 发布成功但访问公开 | 匿名可读 | 立即停止扩散并修正访问策略；不继续冒烟 |
| 登录态文件泄漏 | cookie 进入 git | `tmp/` 忽略；提交前 `git status` 复核；验收后删除 |
| 迁移覆盖日常进度 | 个人进度被测试数据覆盖 | 使用独立浏览器 profile/无痕登录 |
| Pyodide CDN 不可达 | Python 首次加载失败 | 记录为外部依赖限制；JS/SQL 仍必须通过；不阻塞发布除非课程核心不可用 |
| 视觉平台差异 | CI 视觉失败 | CI 不跑 `@visual`；本地 Windows 发布前必跑 |
| 发布说明与实际不一致 | ID/时间/包体错误 | 从 `get_publish_status` 与 `budget` 输出复制；不手写猜测 |
| 回滚不可用 | v2 release 丢失 | 发布前确认 release；保留 `v2.0.1` 标签；按标签重建 |

## 12. 回滚与交接

### 12.1 回滚

- 首选平台 release 回滚到 v2.0.1 `01a1c34e-87a3-773c-86c3-f58087e01acd`；
- 平台无回滚时，按 `v2.0.1` 标签重建：`webDirectory: "web"`、`functionDirectory: "functions"`、`databaseAccess: "none"`、`spa: true`、新 actionId；
- 回滚后按 `09-qa-release.md` §6.1 重跑 v2 冒烟；
- 确认站点仍私有；
- 记录回滚时间线、原因、影响与后续修复。

### 12.2 交接

v3.0.0 发布完成即前端工程化迁移收尾：

- 源码标签 `v3.0.0` 可重建线上版本；
- 日常开发使用 `npm run dev`，发布前 `npm run verify` + `npm run e2e:visual` + `npm run e2e:python` + 离线 `dist`；
- 任何内容或代码变更使用新 actionId 重新 prepare/publish，不复用本次 action；
- 课程内容变更仍遵守 `docs/implementation/00-master-plan.md` 的内容清单与审计流程；
- 站点始终私有；如需公开，属于独立决策，不在本迁移计划范围内。
