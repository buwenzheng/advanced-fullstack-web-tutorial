# R2a 进度摘要（未打完成标签）

- 日期：2026-11-12
- 决议：D1=B（半截收敛）、D2=A、D3=A、D4=A
- 状态：**接近 G-R2a，尚未宣布完成**（见剩余债）

## 已完成

- [x] 课时/项目内容 ID 新语义；manifest lesson + projects 对齐新 ID
- [x] `id-map.ts` + migrate v3 + 五类夹具 + `test:migration`
- [x] lesson/project 旧 ID 重定向
- [x] `content:build` / `e2e/routes.json`（66）重建
- [x] 审计 reuse 期望改为新项目 ID；毕业 reuse 去重
- [x] 修复无边界替换污染：`p50`←`p-e1-stats0`、`p75`←`p-m4-ai5`、哈希常量 `0x85ebca6b`
- [x] 单测 298 绿；validate / audit:content / typecheck 绿

## 剩余债（清完才可打 `r2a-ids` / 进 R2b）

- [ ] `stages/` 仍为 s0…s7（**故意留给 R2b**）
- [ ] 内容侧 `s4/project` 仍可能保留过渡 `p4` 文件；进度已映射到 `p-m3-ship`（D2=A 物理合并在 R2b）
- [ ] `docs/content-specs` 新旧文件名并存 → 删旧或改索引页
- [ ] 抽查 ≥3 讲语义 diff（仅 ID）写入本目录
- [ ] Playwright 冒烟（至少 chromium 非 visual）确认重定向与 routes
- [ ] 毕业/报告 UI 若仍对 `p-m3-ship` 双链告警，确认无重复 key

## 过程教训（写入计划已生效）

短 ID（`p5`/`p7`/`a6`）**禁止**对正文做无词边界全局替换；只改显式 id 字段与带分隔的前缀键。
