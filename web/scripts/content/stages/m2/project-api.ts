export const project = {
  "id": "p-m2-api",
  "stageLabel": "阶段 2",
  "title": "LinkHub 对外 API",
  "brief": "把 p-m2-data 或你的等价数据模型封装成第三方敢依赖的 API：JWT 登录、统一错误、校验、分页/过滤/排序、幂等键与限流响应头、OpenAPI 与契约测试。",
  "goal": "交付一份调用方可以照着文档工作、按错误码分支、能安全重试的 v1 API。",
  "prerequisites": [
    "M1",
    "M2 数据章与 API 章（m2-sql 至 m2-contract）；可使用 p-m2-data 或等价数据层"
  ],
  "nonGoals": [
    "不要求实现 Redis、消息队列、Outbox、真实限流算法或生产部署",
    "不要求继续完成 M3、E1 或 X"
  ],
  "xRelation": "产出的 OpenAPI、认证与错误契约可带入 X1–X2；X 也允许接入满足同等契约的等价 API。",
  "stack": [
    "Node.js/Python",
    "OpenAPI",
    "JWT"
  ],
  "steps": [
    "画资源树：/v1/auth、/v1/links、/v1/links/:id、/v1/links/:id/clicks、/v1/users/me。",
    "实现 JWT 登录/刷新与 RBAC；租户过滤放在数据访问层。",
    "实现 schema 校验与统一错误信封；非法输入 4xx，不泄漏内部信息。",
    "实现分页/过滤/排序；游标分页；稳定排序；字段白名单。",
    "定义幂等键与限流响应头；实现契约测试。",
    "生成 OpenAPI；CI 加契约漂移检查；写错误码表。"
  ],
  "milestones": [
    {
      "id": "p-m2-api-m1",
      "title": "资源树与契约",
      "desc": "资源、方法、状态码与错误码先定稿，再写实现。",
      "criteria": "所有公开端点有方法/状态码/错误码；OpenAPI 可读。"
    },
    {
      "id": "p-m2-api-m2",
      "title": "认证与租户",
      "desc": "JWT 登录/刷新、RBAC 与数据层租户过滤。",
      "criteria": "登录/刷新/RBAC 可用；跨租户访问全部拒绝；401/403 正确。"
    },
    {
      "id": "p-m2-api-m3",
      "title": "校验与错误",
      "desc": "schema 校验与统一错误信封。",
      "criteria": "非法输入 4xx；错误信封稳定；不泄漏堆栈/SQL。"
    },
    {
      "id": "p-m2-api-m4",
      "title": "分页与幂等",
      "desc": "游标分页、幂等键契约与限流响应头。",
      "criteria": "游标分页稳定；重复创建只产生一条；429 带 Retry-After。"
    },
    {
      "id": "p-m2-api-m5",
      "title": "契约测试",
      "desc": "OpenAPI 与实现保持一致，漂移可被 CI 发现。",
      "criteria": "覆盖公开字段；CI 漂移检查；文档与实现一致。"
    }
  ],
  "deliverables": [
    "API 实现",
    "OpenAPI 文档",
    "契约测试",
    "错误码表",
    "README"
  ],
  "checklist": [
    "跳转不泄漏内部 ID",
    "分页有默认值与上限",
    "幂等键有作用域与 TTL",
    "保留 slug 被拒绝",
    "错误码可枚举",
    "requestId 贯穿请求与响应"
  ],
  "stretch": [
    "为服务端集成补 API Key 认证",
    "为 webhook 调用方提供签名校验示例"
  ]
};
