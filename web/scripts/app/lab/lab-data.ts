export interface HeaderRow {
  key: string;
  value: string;
}

export interface LabRequest {
  method: string;
  path: string;
  headers: HeaderRow[];
  body: string;
}

export interface LabResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  timeMs?: number;
}

export interface MockUser {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface MockState {
  users: MockUser[];
  rateLimitCount: number;
  idempotencyStore: Map<string, { status: number; body: unknown }>;
}

export interface LabScenario {
  id: string;
  title: string;
  teach: string;
  request: LabRequest;
}

export const TEACH_IDLE = '选一个左侧场景开始。每一段都对应一个后端必须回答的问题。';
export const TEACH_MOCK = '内置模拟服务在浏览器里运行，行为固定可复现，适合练习状态码与请求头的语义。';
export const TEACH_LIVE = '真实端点指向已部署的边缘函数。若站点未部署函数或当前是本地预览，会收到失败提示——这本身就是「环境差异」的第一课。';

export const SEED_USERS: MockUser[] = [
  { id: 1, name: '张伟', email: 'zhangwei@example.com', role: 'admin', createdAt: '2026-01-04' },
  { id: 2, name: '李娜', email: 'lina@example.com', role: 'member', createdAt: '2026-02-11' },
  { id: 3, name: '王强', email: 'wangqiang@example.com', role: 'member', createdAt: '2026-03-22' },
  { id: 4, name: '陈静', email: 'chenjing@example.com', role: 'member', createdAt: '2026-04-09' },
  { id: 5, name: '刘洋', email: 'liuyang@example.com', role: 'viewer', createdAt: '2026-05-30' },
];

export function createMockState(): MockState {
  return {
    users: SEED_USERS.map((user) => ({ ...user })),
    rateLimitCount: 0,
    idempotencyStore: new Map(),
  };
}

export const SCENARIOS: LabScenario[] = [
  {
    id: 'list',
    title: '列表与分页',
    teach: '列表接口要同时返回 items 与分页元信息，前端才知道有没有下一页。',
    request: {
      method: 'GET', path: '/api/users?page=1&limit=3',
      headers: [{ key: 'Accept', value: 'application/json' }], body: '',
    },
  },
  {
    id: 'create-ok',
    title: '创建成功（201）',
    teach: 'POST 创建资源应返回 201，并在 Location 头里给出新资源的地址。',
    request: {
      method: 'POST', path: '/api/users',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      body: JSON.stringify({ name: '赵敏', email: 'zhaomin@example.com', role: 'member' }, null, 2),
    },
  },
  {
    id: 'create-invalid',
    title: '校验失败（422）',
    teach: '字段级校验错误要给出字段名与原因，前端才能把红字标在对应输入框上。',
    request: {
      method: 'POST', path: '/api/users',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      body: JSON.stringify({ name: '', email: 'not-an-email' }, null, 2),
    },
  },
  {
    id: 'duplicate',
    title: '资源冲突（409）',
    teach: '唯一键冲突不是客户端的格式错误，用 409 区分于 422，前端才能给出准确文案。',
    request: {
      method: 'POST', path: '/api/users',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      body: JSON.stringify({ name: '张伟', email: 'zhangwei@example.com' }, null, 2),
    },
  },
  {
    id: 'unauthorized',
    title: '未认证（401）',
    teach: '401 表示「你是谁还不知道」，前端应该带着凭据重试一次。',
    request: {
      method: 'GET', path: '/api/me',
      headers: [{ key: 'Accept', value: 'application/json' }], body: '',
    },
  },
  {
    id: 'forbidden',
    title: '无权限（403）',
    teach: '403 表示「知道你是谁，但这个操作你不能做」，重试没有意义。',
    request: {
      method: 'DELETE', path: '/api/users/2',
      headers: [{ key: 'Accept', value: 'application/json' }, { key: 'Authorization', value: 'Bearer demo-token-viewer' }], body: '',
    },
  },
  {
    id: 'ratelimit',
    title: '触发限流（429）',
    teach: '429 要带 Retry-After，告诉客户端多久后再来；否则客户端会疯狂重试。连点三次「发送请求」，第三次就会收到 429。',
    request: {
      method: 'GET', path: '/api/reports/export',
      headers: [{ key: 'Accept', value: 'application/json' }], body: '',
    },
  },
  {
    id: 'cache',
    title: '条件请求（304）',
    teach: '带上 If-None-Match 再发一次，数据没变时服务端只回 304，不重传 body。',
    request: {
      method: 'GET', path: '/api/config',
      headers: [{ key: 'Accept', value: 'application/json' }, { key: 'If-None-Match', value: 'W/"cfg-v3"' }], body: '',
    },
  },
  {
    id: 'idempotent',
    title: '幂等键（重复提交）',
    teach: '同一个 Idempotency-Key 重复提交只产生一次副作用，第二次直接返回首次结果。连点两次「发送请求」，对比两次响应里的 idempotency-replayed。',
    request: {
      method: 'POST', path: '/api/payments',
      headers: [{ key: 'Content-Type', value: 'application/json' }, { key: 'Idempotency-Key', value: 'demo-key-001' }],
      body: JSON.stringify({ amount: 19900, currency: 'CNY' }, null, 2),
    },
  },
  {
    id: 'slow',
    title: '慢响应与超时',
    teach: '客户端必须设超时；没有超时的请求会一直占着连接池。',
    request: {
      method: 'GET', path: '/api/slow?ms=1200',
      headers: [{ key: 'Accept', value: 'application/json' }], body: '',
    },
  },
];

export function statusTextOf(status: number): string {
  const map: Record<number, string> = {
    200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content',
    301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
    405: 'Method Not Allowed', 409: 'Conflict', 422: 'Unprocessable Entity',
    429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway',
    503: 'Service Unavailable', 504: 'Gateway Timeout',
  };
  return map[status] || '';
}

export function statusClass(status: number): string {
  if (status === 0) return 'badge--rose';
  if (status < 300) return 'badge--teal';
  if (status < 400) return 'badge--blue';
  if (status < 500) return 'badge--amber';
  return 'badge--rose';
}
