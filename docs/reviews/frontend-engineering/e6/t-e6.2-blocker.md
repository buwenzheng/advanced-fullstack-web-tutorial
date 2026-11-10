# T-E6.2 阻塞记录：Sites API 不可用

时间：2026-11-10 22:00（本地，UTC+8）
状态：prepare_site 未执行；无 prepare-status.json；无任何发布动作。

## 1. 现象

- `get_context` 将本目录列入 `unavailableSites`，`error: sites_request_failed`；
- `get_site {siteId}` 返回 `sites_request_failed`；
- `get_site_access` 本会话多次返回 `sites_request_failed`；
- `list_sites` 返回 `scope: owned, total_size: 0, projects: []`；
- 站点 HTTP 根路径与 `/functions/v1/app/health` 匿名均返回 401（在线且私有）。

详细原始观察见 `site-api-status.txt`。

## 2. 判定

- 无法读取站点，无法确认 `get_site_access` 为 `private`，无法执行 §3.1 的
  prepare 输入校验，更无法 prepare/publish；
- 按 E6 §4.2、§4.6 与 sites-hosting 技能：空列表/鉴权失败不证明站点被删除，
  不新建 project/site，不改访问策略，不手写描述文件，不以其他路径绕过；
- 属于宿主/插件侧 Sites OpenAPI 不可用，保留请求等待恢复后重试。

## 3. 待用户确认的发布输入（API 恢复后执行）

| 项 | 值 |
| --- | --- |
| projectId | `01a18744-0ff9-78c1-81e2-9a37aa9ec9c2` |
| siteId | `01a18744-0ffa-79fa-92d9-0ac6a3f812aa` |
| actionId（新，待用） | `dad605a8-70cc-4cc5-b023-f2a1fd0ca19b` |
| webDirectory | `dist` |
| functionDirectory | `functions` |
| databaseAccess | `none` |
| spa | `true` |
| 访问范围 | `private`（不修改） |
| 回滚 | v2.0.1 release `01a1c34e-87a3-773c-86c3-f58087e01acd`；或按 `v2.0.1` 标签以 `webDirectory: "web"` 重建 |

确认后才允许执行 T-E6.2 prepare_site 与 T-E6.3 publish_site。

## 4. 恢复后的最小路径

1. 重试 `get_context` / `get_site` / `get_site_access`，确认站点可读且仍为 private；
2. 以 `action-id.txt` 的 UUID 调用一次 `prepare_site`（§3.1 输入）；
3. `get_publish_status` 等待 draft ready / `canPublish: true`，记录 `prepare-status.json`；
4. 用户确认后 `publish_site` 并轮询 `published: true`；
5. 继续 T-E6.4 线上冒烟与 T-E6.5/T-E6.6 文档、标签。

## 5. 不影响项

- T-E6.0 冻结与产物审计全部通过（verify/视觉/Python/离线/dist/functions）；
- T-E6.1 冒烟 spec 已就绪，未设置 `DEPLOYED_URL` 时 67 项全部跳过，verify 全绿；
- v2.0.1 release 与标签保留，回滚路径未变。
