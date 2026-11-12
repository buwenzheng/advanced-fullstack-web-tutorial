export const project = {
  id: 'p-m3-web',
  stageLabel: '阶段 6',
  title: 'LinkHub Web 与 BFF',
  brief: '为 p-m2-api 或等价后端交付用户可见产品：契约驱动客户端、BFF、SSR/流式、会话安全、实时、边缘、RUM。',
  goal: '把已有后端契约组装成用户可用、可观测的产品层；统计可用本地事件源或现成服务，不要求先完成 E1。',
  prerequisites: [
    'M2 API 章（m2-resource 至 m2-contract）',
    'M3 章2（m3-bff 至 m3-edge）；建议了解 M3 章1 的观测概念'
  ],
  nonGoals: [
    '不要求实现或重写业务 API、缓存、队列、Outbox 与独立统计服务',
    '不要求完成 E1、M4 或 X'
  ],
  xRelation: '类型客户端、BFF、会话安全、实时与 RUM 证据可带入 X6–X7；X 不要求沿用同一前端仓库。',
  stack: ['TypeScript', 'BFF', 'SSR/流式', 'SSE/WebSocket', 'CDN/边缘'],
  steps: [
    '从 p-m2-api 的 OpenAPI 生成类型安全客户端；手写文件不进入版本库。CI 增加契约漂移检查：重新生成后与仓库比对，破坏性变更直接失败并给出手改被覆盖的示例。',
    '实现 BFF 聚合详情页：一次请求返回链接元数据、统计摘要与权限；上游并发拉取，设置总超时，部分失败用 degraded 标记，错误码映射为 NOT_FOUND / UPSTREAM。',
    '实现首屏 SSR 或流式渲染；给出 LCP/INP/CLS 的预算数字与 p75 口径，接入真实用户采样，预算未达标时 CI 失败。',
    '实现会话与安全：HttpOnly + Secure + SameSite 会话 Cookie；CSRF token；CSP 与 HSTS；登录态不写入 localStorage；越权访问与 CORS credentials 白名单有测试。',
    '实现实时看板：SSE 或 WebSocket；断线后指数退避 + jitter 重连；事件按 id 去重、按 seq 检测缺口；重试耗尽后降级轮询并可自动恢复。',
    '实现边缘缓存与特性开关：公共页长 TTL + SWR，个性化响应 private 或 bypass；开关支持白名单、租户、百分比灰度与 kill switch；RUM 上报事件携带 traceId，与服务端 trace 串联。',
    '完成验收：类型零漂移；CWV 达标；断网/重连可演示；开关可灰度可回滚；一个 traceId 能从浏览器 LCP 还原到服务端 span，并标出最大缺口。'
  ],
  milestones: [
    {
      id: 'p-m3-web-m1',
      title: '契约客户端与漂移检查',
      desc: '类型客户端由 p-m2-api 的 OpenAPI 生成，手改会被重新生成覆盖。',
      criteria: 'CI 漂移检查可执行：重新生成后与仓库不一致即失败；删字段或改类型的破坏性变更在流水线给出失败样例。'
    },
    {
      id: 'p-m3-web-m2',
      title: 'BFF 聚合',
      desc: '详情页一个 BFF 请求聚合元数据、统计与权限，上游并发。',
      criteria: '总超时小于各上游超时之和；部分失败有 degraded 标记；NOT_FOUND 与 UPSTREAM 错误码映射有测试；前端不再发请求瀑布。'
    },
    {
      id: 'p-m3-web-m3',
      title: '渲染与 CWV',
      desc: '首屏 SSR/流式，性能预算进入 CI。',
      criteria: 'LCP ≤ 2500ms、INP ≤ 200ms、CLS ≤ 0.1，按 p75 最近秩口径统计；连续两个观察窗未达标即阻止发布。'
    },
    {
      id: 'p-m3-web-m4',
      title: '会话与安全',
      desc: 'HttpOnly 会话、CSRF、CSP 与安全头。',
      criteria: '响应头与 Cookie 属性可检查；localStorage 无 token；CSRF 缺失时写操作被拒；越权访问返回 403；CORS 不通配 credentials。'
    },
    {
      id: 'p-m3-web-m5',
      title: '实时看板',
      desc: 'SSE/WebSocket、断线重连、事件归并。',
      criteria: '断网后自动重连并补拉；重复事件不重复计数；seq 缺口有标记；降级轮询可用且恢复后自动切回。'
    },
    {
      id: 'p-m3-web-m6',
      title: '边缘、开关与 RUM',
      desc: '个性化不进公共缓存；开关可灰度与回滚；RUM 与 trace 串联。',
      criteria: '双账号访问同一 URL 不串号；开关 kill switch 分钟级回滚；RUM 事件与服务端 trace 用同一 traceId 合并，缺失时标记 incomplete；发布健康度看板可读。'
    }
  ],
  deliverables: [
    '由 OpenAPI 生成的类型客户端与生成脚本',
    '契约漂移检查的 CI 任务与失败样例',
    'BFF 聚合层（并发、总超时、degraded、错误码映射）',
    'SSR/流式页面与渲染策略说明',
    '会话、CSRF、CSP/HSTS 与 CORS 配置',
    '实时看板（重连、去重、缺口、降级轮询）',
    '边缘缓存规则与特性开关配置（含 kill switch）',
    'RUM 接入与前后端 trace 串联记录',
    'CWV 报告（含 p75 口径与预算对比）',
    'README：本地运行、验收步骤、回滚手册与后端契约/统计来源说明'
  ],
  checklist: [
    '只加产品层，不重写后端接口、缓存、队列与统计',
    '统计与点击数据复用现有来源；未完成 E1 时可用本地事件源或夹具',
    '边缘缓存不缓存个性化响应，缓存键包含用户/租户维度或显式 bypass',
    '登录态不在 JavaScript 可读存储中',
    'CORS 白名单显式来源，不与 credentials 通配组合',
    '开关有所有者、默认值、过期时间与 kill switch',
    'RUM 事件经过脱敏，不包含 PII',
    'traceId 能跨浏览器与服务端还原，缺失时标记 incomplete',
    'CWV 预算写成具体数字与 p75 口径，并接入 CI'
  ],
  stretch: [
    '流式错误边界与分段降级',
    '按用户维度的边缘私有缓存',
    '发布健康度看板自动关联告警与回滚'
  ]
};
