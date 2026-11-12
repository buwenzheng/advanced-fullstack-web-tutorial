# G-R2a 报告：身份切换

- 日期：2026-11-12
- 结论：**G-R2a 通过（有条件）**
- 条件说明：Playwright 浏览器二进制在本机沙箱首次缺失，正在安装；路由冒烟以 `routes.json` 重建 + 单测 redirect + build 绿为代理证据，浏览器冒烟在 R2b/R5 前补跑记入本目录。

## 1. 验收勾选

- [x] 45 讲内容 id = 新语义；manifest 一致  
- [x] manifest.projects 与 catalog 一致（D2：m3 为 `p-m3-ship` + `p-m3-web`；内容侧 `p4` 文件暂留至 R2b）  
- [x] python 键对齐；migrate 五类夹具 + 幂等  
- [x] 旧 lesson/project hash 可重定向（单测）  
- [x] specs 仅新 ID（46 文件 = 45 讲 + x-linkhub）  
- [x] 语义抽查 ≥3 讲（`semantic-spotcheck.md`）  
- [x] validate / audit:content / typecheck / vitest(298) / test:migration / build 绿  
- [ ] Playwright chromium 全量冒烟 — **环境：browser 未装，安装中；不挡身份正确性**  
- [x] 本报告  

## 2. 命令摘要

| 命令 | 结果 |
| --- | --- |
| content:validate | ok stages=9 lessons=45 projects=9 duration=3400 |
| audit:content | errors=0 |
| typecheck | 0 |
| vitest run | 29 files / 298 passed |
| test:migration | ok |
| content:build / vite build | ok |
| pollution scan | 0 hit |

## 3. 已知债（交 R2b）

1. 目录仍 `s0…s7` + `appendix`  
2. `s4/project` 仍为过渡 `p4`（进度已 map 到 `p-m3-ship`）  
3. Playwright 冒烟补跑  
4. 报告页若同时列出 `p4` 与 `p-m3-ship` 属过渡态，R2b 合并后消失  

## 4. 下一批

进入 `20-r2-id-migration.md` **R2b**（T-R2.6 起）。
