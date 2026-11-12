# G-R5 报告：全量验收与文档收口

- 日期：2026-11-12
- 结论：**G-R5 通过（代码与门禁）**；Git 标签 `r5-track-v1` **待提交后补打**
- 前置：G-R2 / G-R3 / G-R4 已具备报告

## 1. 自动化门禁

| 命令 | 结果 | 产物 |
| --- | --- | --- |
| `npm run verify` | PASS（134 Playwright + lint/typecheck/coverage/validate/audit/build/budget） | `r5/verify.txt` |
| `npm run e2e:visual` | 21/21（已更新 Windows 基线） | `r5/visual.txt` |
| `npm run e2e:python` | 1/1 | `r5/python-e2e.txt` |
| `npx tsx tools/run-python-exercises.ts` | failing=0 | `r5/python.txt` |
| `npm run test:migration` | ok | `r5/migration.txt` |
| `npm run budget` | entry 177.xKB / 180KB；lazy/search PASS | 含于 verify |

### R5 修债（验收中发现）

1. `audit:content` 附录 index 硬编码 8 → 改为末位 position（工具箱 `b`=5）
2. `redirects.ts` 静态依赖 `content/index` 打爆入口包 → 改为 catalog 查存在性；budget 恢复
3. E2E 旧 ID 断言 → 新 ID；保留 `s0-l1→m1-http` 冒烟
4. 路径卡 `aria-label` 触发 axe `label-content-name-mismatch` → 移除，改用可见文案
5. `sha256` 被 `a2→b-hash` 无边界替换污染为 `shb-hash56` → 已修复（m2-contract / python-api / python-data / spec）

## 2. 手工矩阵

见 `manual-checks.md`：§3.2 全勾（E2E + 单测 + 映射表证据）。

## 3. 目标对齐复核（18-track-restructure §1.4）

| 目标 | 勾选 | 证据 |
| --- | --- | --- |
| 路径 C 为默认推荐；M4-Coding 可早学 | [x] | Overview 默认 C；paths steps |
| 可阶段结业，非 S0→S7 刷完 | [x] | 四路径卡 + 结业映射；侧栏 6 块 |
| E1 选修、X 自愿 | [x] | kind/徽章；路径 A/B 不强制 X |
| 机制与判题不漂 | [x] | audit:exercises JS/SQL 全过；python CLI 全过；仅修 ID 污染 |
| 交付质量可回归 | [x] | verify + visual + python + migration |

## 4. 文档

- README / content-schema / content-style / 09-qa-release 已对齐分块路径
- `known-issues.md` 登记残留债
- 本报告 + manual-checks + verify/visual/python 摘要入库

## 5. G-R5 清单

- [x] verify + 视觉 + Python + 迁移夹具全绿
- [x] 手工矩阵全勾
- [x] README / schema / 规则相关文档一致
- [x] known-issues 登记残留
- [ ] 标签 `r5-track-v1`（及中间标签）— **需用户提交后打**

## 6. 未做（故意）

真机部署加厚、案例扩写、`format:check` 纳入 verify、`StagePage` 重命名、`#/block/:id` 改名（D4=A 保留 stage）。
