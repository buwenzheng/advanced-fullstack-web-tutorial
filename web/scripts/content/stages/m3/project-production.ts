export const project = {
  "id": "p-m3-ship",
  "stageLabel": "M3 生产",
  "title": "LinkHub 生产化",
  "brief": "p-m3-ship 的 m6–m10 交付组：为完成缓存与异步组的服务或等价服务补上日志/指标/追踪、压测、容器化、CI/CD、灰度与回滚。",
  "goal": "在保持既有业务契约的前提下，为服务补上可观测、可压测、可部署、可回滚的运营能力。",
  "stack": [
    "OpenTelemetry",
    "k6",
    "Docker",
    "GitHub Actions"
  ],
  "steps": [
    "加结构化日志与 requestId，贯穿 API、数据库、队列",
    "加 RED 指标、关键 span、健康检查与看板",
    "用 k6/autocannon 做基线压测与故障压测，找至少一个真实瓶颈并修复",
    "写多阶段、非 root 的 Dockerfile，加健康检查与资源限制",
    "建 CI 流水线：lint/type/unit/integration/contract",
    "做一次灰度发布与回滚演练，记录指标恢复时间"
  ],
  "milestones": [
    {
      "id": "p-m3-ship-m6",
      "group": "可观测与发布（m6–m10）",
      "title": "可观测性",
      "desc": "日志、指标、追踪三件套接入主链路。",
      "criteria": "任一 requestId 可还原请求经过的服务、数据库与队列；日志、指标、追踪可互相关联。"
    },
    {
      "id": "p-m3-ship-m7",
      "group": "可观测与发布（m6–m10）",
      "title": "压测与瓶颈",
      "desc": "固定环境下完成基线与故障两组压测。",
      "criteria": "有两组可复现的压测数据；至少定位并修复一个真实瓶颈，附前后复测对比。"
    },
    {
      "id": "p-m3-ship-m8",
      "group": "可观测与发布（m6–m10）",
      "title": "容器化",
      "desc": "多阶段构建、非 root、健康检查与资源限制。",
      "criteria": "镜像可运行；SIGTERM 后优雅退出不丢在途请求；liveness 与 readiness 语义分离。"
    },
    {
      "id": "p-m3-ship-m9",
      "group": "可观测与发布（m6–m10）",
      "title": "CI/CD",
      "desc": "流水线关卡可执行，失败能阻断合并。",
      "criteria": "lint/type/unit/integration/contract 全部在流水线中执行；任一门禁失败会阻止合并或发布。"
    },
    {
      "id": "p-m3-ship-m10",
      "group": "可观测与发布（m6–m10）",
      "title": "灰度与回滚",
      "desc": "一次真实灰度发布与回滚演练。",
      "criteria": "完成一次真实回滚；记录触发条件、时间线与指标恢复时间。"
    }
  ],
  "deliverables": [
    "日志/指标/追踪接入",
    "压测脚本与报告",
    "Dockerfile",
    "CI 配置",
    "发布与回滚记录"
  ],
  "checklist": [
    "日志不含 PII",
    "指标标签低基数",
    "压测环境固定",
    "镜像无密钥",
    "回滚可分钟级完成",
    "健康检查区分 liveness 与 readiness"
  ],
  "stretch": [
    "自动金丝雀分析",
    "成本看板"
  ]
};
