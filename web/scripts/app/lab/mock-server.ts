import type { LabRequest, LabResult, MockState } from './lab-data';
import { statusTextOf } from './lab-data';

function json(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): LabResult {
  return {
    status,
    statusText: statusTextOf(status),
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
    body: JSON.stringify(body, null, 2),
  };
}

export async function runMock(request: LabRequest, mockState: MockState): Promise<LabResult> {
  const url = new URL(request.path, 'http://lab.local');
  const path = url.pathname;
  const method = request.method.toUpperCase();
  const headers: Record<string, string> = {};
  request.headers.forEach((row) => {
    if (row.key.trim()) headers[row.key.trim().toLowerCase()] = row.value;
  });
  const delay = Number(url.searchParams.get('ms') || 0);

  let response: LabResult;
  if (path === '/api/users' && method === 'GET') {
    const page = Number(url.searchParams.get('page') || 1);
    const limit = Number(url.searchParams.get('limit') || 10);
    const start = (page - 1) * limit;
    const items = mockState.users.slice(start, start + limit);
    response = json(200, {
      items,
      pagination: {
        page,
        limit,
        total: mockState.users.length,
        totalPages: Math.ceil(mockState.users.length / limit),
      },
    });
  } else if (path === '/api/users' && method === 'POST') {
    let payload: Record<string, string | undefined> | null = null;
    try {
      payload = JSON.parse(request.body || '{}') as Record<string, string | undefined>;
    } catch {
      payload = null;
    }
    if (!payload) {
      response = json(400, { error: { code: 'invalid_json', message: '请求体不是合法的 JSON' } });
    } else {
      const problems: Array<{ field: string; message: string }> = [];
      if (!payload.name) problems.push({ field: 'name', message: 'name 不能为空' });
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email || '')) {
        problems.push({ field: 'email', message: 'email 格式不正确' });
      }
      if (problems.length) {
        response = json(422, {
          error: { code: 'validation_failed', message: '请求参数校验未通过', details: problems },
        });
      } else if (mockState.users.some((user) => user.email === payload.email)) {
        response = json(409, { error: { code: 'email_taken', message: '该邮箱已被注册' } });
      } else {
        const created: MockState['users'][number] = {
          id: mockState.users.length + 1,
          name: payload.name || '',
          email: payload.email || '',
          role: payload.role || 'member',
          createdAt: new Date().toISOString().slice(0, 10),
        };
        mockState.users.push(created);
        response = json(201, { data: created }, { location: `/api/users/${created.id}` });
      }
    }
  } else if (/^\/api\/users\/\d+$/.test(path) && method === 'DELETE') {
    const token = (headers.authorization || '').replace('Bearer ', '');
    if (!token) response = json(401, { error: { code: 'unauthenticated', message: '缺少访问令牌' } });
    else if (token !== 'demo-token-admin') {
      response = json(403, { error: { code: 'forbidden', message: '当前令牌没有删除权限' } });
    } else {
      response = { status: 204, statusText: statusTextOf(204), headers: {}, body: '' };
    }
  } else if (path === '/api/me' && method === 'GET') {
    const token = (headers.authorization || '').replace('Bearer ', '');
    if (!token) {
      response = json(401, { error: { code: 'unauthenticated', message: '缺少访问令牌' } }, {
        'www-authenticate': 'Bearer realm="lab"',
      });
    } else {
      response = json(200, { data: { id: 42, name: '演示用户', scopes: ['read'] } });
    }
  } else if (path === '/api/config' && method === 'GET') {
    const etag = 'W/"cfg-v3"';
    if (headers['if-none-match'] === etag) {
      response = {
        status: 304,
        statusText: statusTextOf(304),
        headers: { etag, 'cache-control': 'private, max-age=60' },
        body: '',
      };
    } else {
      response = json(200, { data: { theme: 'dark', locale: 'zh-CN', version: 3 } }, {
        etag,
        'cache-control': 'private, max-age=60',
      });
    }
  } else if (path === '/api/reports/export' && method === 'GET') {
    mockState.rateLimitCount += 1;
    if (mockState.rateLimitCount > 2) {
      response = json(429, { error: { code: 'rate_limited', message: '请求过于频繁，请稍后再试' } }, {
        'retry-after': '3',
        'x-ratelimit-limit': '2',
        'x-ratelimit-remaining': '0',
      });
    } else {
      response = json(200, { data: { exportId: 'exp_1024', status: 'processing' } }, {
        'x-ratelimit-limit': '2',
        'x-ratelimit-remaining': String(2 - mockState.rateLimitCount),
      });
    }
  } else if (path === '/api/payments' && method === 'POST') {
    const key = headers['idempotency-key'];
    if (!key) {
      response = json(400, {
        error: { code: 'idempotency_key_required', message: '写接口必须携带 Idempotency-Key' },
      });
    } else if (mockState.idempotencyStore.has(key)) {
      const cached = mockState.idempotencyStore.get(key)!;
      response = json(cached.status, cached.body, { 'idempotency-replayed': 'true' });
    } else {
      const created = { id: 'pay_7781', amount: 19900, currency: 'CNY', status: 'succeeded' };
      mockState.idempotencyStore.set(key, { status: 201, body: { data: created } });
      response = json(201, { data: created }, { 'idempotency-replayed': 'false' });
    }
  } else if (path === '/api/slow' && method === 'GET') {
    response = json(200, { data: { sleptMs: delay || 1200 } });
  } else if (/^\/api\/status\/\d{3}$/.test(path)) {
    const code = Number(path.split('/').pop());
    response = json(code, { error: { code: 'forced', message: `手动触发 ${code}` } });
  } else {
    response = json(404, {
      error: { code: 'not_found', message: `没有匹配的路由：${method} ${path}` },
    });
  }

  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  return response;
}
