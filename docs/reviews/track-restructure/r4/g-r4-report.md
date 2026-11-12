# G-R4 学习路径导航验收报告

## 结论

R4 已完成。总览以四条路径为首要入口，默认路径为 C（AI 全栈）；课程导航改为 M1–M4、E1、B 大块与章节语义，下一讲会读取 `meta.activePath`。路径仅提供推荐组合，不构成访问门锁。

## 实现证据

- 数据门面：`app/data/paths.ts` 暴露 `usePaths`、`useBlocks`、`kind`、`chapters` 与固定毕业项目 `x-linkhub`；数据层不依赖页面。
- R3 只读映射：四条学员可见结业声明逐字取自 `r3/path-completion-map.md`，未新增结业定义。
- 总览：路径 A/B/C/D 全部可见；C 标为默认推荐；路径卡是可聚焦链接；主修、选修、工具箱分区展示块进度与继续学习入口。
- 侧栏：按块展开；M2/M3/M4/B 展示章标题；E1 与 B 分别带“选修”“工具箱”徽章。
- 块页：展示块类型、章节、出口标准、项目入口与项目建议先修；M3 生产章明确提示路径 A 完成该章即可。
- 下一讲：旧用户或缺省状态使用路径 C；切换路径写入既有进度对象的 `meta.activePath`，未增加 localStorage 键；路径无待学内容时可回退当前块。
- 文案与可访问性：移除“八个核心阶段/附录”的 UI 主叙事；页面保持单一 `h1`，路径卡支持键盘焦点。

## 验证

- `npm run content:validate`：通过（6 blocks / 45 lessons / 8 projects）。
- `npm run typecheck`：通过。
- `npx vitest run`：通过。
- 编辑文件 IDE diagnostics：无错误。

## 视觉基线与 R5

本批未强制更新视觉快照。预计 R5 会看到以下合理 diff：

- Overview：新增四路径卡、块类型分区，统计与旧 STAGE 文案改变。
- Sidebar：新增章节分组及 E1/B 语义徽章。
- Block page：hero 编号、章节标题、出口/先修卡片及 M3 路径提示改变。

R5 应在 390px 与 1280px 复核上述页面，并统一签字更新受影响基线。

## 遗留债务

- 本阶段未新增 `#/path/:id` 路由；路径卡按规范允许直接进入合理起点。
- `StagePage` 路由名称仍保留兼容术语，用户界面已改称“大块/本块”。
- 全量 Playwright 视觉与 axe 基线复核留给 R5。
