# R2a 语义抽查（≥3 讲）

- 日期：2026-11-12
- 方法：抽查课时文件，确认练习 `tests`/`solution` 仅 ID/导出名变化，无断言语义漂移；并扫描污染模式

## 抽查样本

| 课时 | 文件 | 结论 |
| --- | --- | --- |
| `m1-http` | `stages/s0/m1-http.ts` | id/题 id 为新语义；检查/练习结构完整 |
| `m3-otel` | `stages/s4/m3-otel.ts` | 曾误伤 `p50`→已修复；solution 审计通过 |
| `m3-render` | `stages/s6/m3-render.ts` | 曾误伤 `p75`→已修复；solution 审计通过 |
| `b-prob` | `stages/appendix/b-prob.ts` | 曾误伤 `0x85ebca6b`→已修复；solution 审计通过 |
| `b-bigO` | `stages/appendix/b-bigO.ts` | 曾误伤 `p50`→已修复；solution 审计通过 |

## 污染扫描（收口时）

```text
rg "p-e1-stats0|p-m4-ai5|85ebcb-probb" web/scripts/content → 0 hit
```

## 结论

抽查样本在修复污染后，练习语义与审计一致；R2a 允许进入收口报告。R2b 前不再对正文做短 ID 无边界替换。
