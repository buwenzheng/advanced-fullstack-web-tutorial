export const project = {
  "id": "p-m1-probe",
  "stageLabel": "阶段 0",
  "title": "HTTP 探针 CLI",
  "brief": "写一个零依赖命令行工具，把一次请求的 DNS、TCP、TLS、TTFB、总耗时、状态码与重定向链打印出来；支持超时、错误分段与 JSON 输出。它是独立排障工具，不是 LinkHub 的 API。",
  "goal": "把「请求慢」拆成可测量、可比较、可自动验证的阶段数据，并用退出码与结构化输出让脚本能消费这些结果。",
  "prerequisites": [
    "M1：m1-http、m1-runtime、m1-cli"
  ],
  "nonGoals": [
    "不要求数据库、Web UI、认证或业务 API",
    "不要求复用 LinkHub 或任何既有仓库"
  ],
  "xRelation": "独立结业项目；探针与排障记录可作为 X 的诊断工具，但 X 不要求沿用其代码库。",
  "stack": [
    "Node.js",
    "curl",
    "HTTP"
  ],
  "steps": [
    "解析 CLI 参数：URL、method、header、body、timeout 与 --json。",
    "用 node:http/node:https 发请求，累计响应体与字节数。",
    "用时间戳记录 DNS、连接、TLS、首字节与总耗时；区分连接复用。",
    "用 AbortController 实现超时；区分 DNS、连接、TLS 与 HTTP 错误。",
    "输出人类可读表格与 JSON；对 Authorization 等敏感头脱敏。",
    "写本地测试服务端（200/404/500/慢响应）与自动化测试。"
  ],
  "milestones": [
    {
      "id": "p-m1-probe-m1",
      "title": "发起请求并打印响应",
      "desc": "支持 GET/POST/PUT/DELETE、自定义请求头与 JSON body；打印状态码、响应头与响应体。",
      "criteria": "四种方法都能对本地测试服务完成请求；自定义头出现在服务端日志；JSON body 能被服务端正确解析；状态码/头/体完整打印。"
    },
    {
      "id": "p-m1-probe-m2",
      "title": "分阶段耗时",
      "desc": "分别记录 DNS、TCP、TLS、TTFB 与总耗时，并识别连接复用。",
      "criteria": "五段耗时字段独立且非负；与 curl -w 的量级可对照；复用连接时 DNS/TCP/TLS 的归零或近似归零能被解释。"
    },
    {
      "id": "p-m1-probe-m3",
      "title": "超时与错误",
      "desc": "区分 DNS 失败、连接失败、TLS 失败与超时；错误不吞掉，退出码有语义。",
      "criteria": "四类错误分别可复现；进程不抛未捕获异常；超时不会无限等待；退出码 0/2/3/4 与文档一致。"
    },
    {
      "id": "p-m1-probe-m4",
      "title": "机器可读输出",
      "desc": "提供 --json 输出，字段稳定，敏感请求头脱敏。",
      "criteria": "输出可被 JSON.parse；字段名与类型稳定；Authorization 与 Cookie 不出现在任何输出中。"
    },
    {
      "id": "p-m1-probe-m5",
      "title": "自动化测试",
      "desc": "一条命令跑完参数解析、请求方法、错误分支与超时测试。",
      "criteria": "测试不依赖公网与真实等待；覆盖成功、404/500、DNS/连接失败、超时；全部通过且可重复。"
    }
  ],
  "deliverables": [
    "probe.js：零第三方依赖的 CLI 实现",
    "README：参数、输出字段、退出码与用法示例",
    "自动化测试：参数、请求方法、错误分支与超时",
    "本地测试服务端：200/404/500/慢响应",
    "3 个真实站点的输出样例与错误分类说明"
  ],
  "checklist": [
    "零第三方依赖，node probe.js 可直接运行",
    "退出码 0/2/3/4 与文档一致",
    "不打印 Authorization、Cookie 等敏感头",
    "错误不吞掉，失败能定位到阶段",
    "超时有上限，不会无限等待",
    "JSON 字段稳定且可 JSON.parse"
  ],
  "stretch": [
    "跟随重定向并记录完整跳转链",
    "并发探测多个 URL 并对照阶段耗时",
    "输出 Prometheus 文本格式指标"
  ]
};
