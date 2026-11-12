# T-R1.0 Preflight

- 日期：2026-11-12
- 过渡策略：**A（清单先行、内容暂旧）**
  - `docs/content-manifest.json` → version 3（`paths` / `blocks` / `toolbox` / `capstone`）
  - `lessons[].id` 仍为旧 ID（`s*` / `a*`）
  - `lessons[].newId` 指向规划新 ID；R2 再翻文件与字段
- 内容文件：本批**不**重命名 `stages/s*/**`
- 进度迁移：本批**不**改 `migrate.ts`

## 将改文件清单

| 路径 | 动作 |
| --- | --- |
| `web/scripts/content/schema.ts` | 扩展 kind/chapters/path；放宽可选项 |
| `web/scripts/content/types.ts` | 导出新类型 |
| `web/scripts/content/paths.ts` | **新建**路径 A/B/C/D |
| `web/scripts/content/manifest.ts` | **新建** v3 解析与扁平化辅助 |
| `web/scripts/content/validate.ts` | 按 v3 清单校验 |
| `web/scripts/content/catalog.ts` | 可选 kind/chapterCount（若易接） |
| `docs/content-manifest.json` | 重写为 v3 |
| `docs/content-schema.md` | 增补 Block/Chapter/Path |
| `tools/lib/content.ts` | Manifest 类型与导出适配 |
| `tools/audit-content.ts` | 对照 v3 清单 |
| `tools/content-stats.ts` | 对照 v3 清单 |
| `web/scripts/test/content-schema.test.ts` | 覆盖新 schema |
| `web/scripts/test/content-validate.test.ts` | 适配 v3 |
| `web/scripts/test/paths.test.ts` | **新建** |
| `docs/reviews/track-restructure/r1/*` | 证据 |

## 基线

见 `../baseline/README.md`：`content:validate` / `typecheck` 已绿。
