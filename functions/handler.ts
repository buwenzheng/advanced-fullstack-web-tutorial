type User = { id: number; name: string; email: string; role: string; createdAt: string };
type Problem = { field: string; message: string };
type Identity = { ok: boolean; reason?: string; payload?: Record<string, unknown> };

const DEMO_SECRET = 'backend-lab-demo-secret-not-for-production';
const USERS: User[] = [
  { id: 1, name: '张伟', email: 'zhangwei@example.com', role: 'admin', createdAt: '2026-01-04' },
  { id: 2, name: '李娜', email: 'lina@example.com', role: 'member', createdAt: '2026-02-11' },
  { id: 3, name: '王强', email: 'wangqiang@example.com', role: 'member', createdAt: '2026-03-22' },
  { id: 4, name: '陈静', email: 'chenjing@example.com', role: 'member', createdAt: '2026-04-09' },
  { id: 5, name: '刘洋', email: 'liuyang@example.com', role: 'viewer', createdAt: '2026-05-30' },
];

const idempotencyStore = new Map<string, { status: number; body: unknown }>();
let rateLimitHits = 0;
let exportHits = 0;

const JSON_HEADERS: Record<string, string> = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

function json(status: number, body: unknown, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: Object.assign({}, JSON_HEADERS, headers || {}),
  });
}

function readBody(request: Request): Promise<any> {
  return request.text().then(function (text) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  });
}

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  let binary = '';
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '==='.slice((padded.length + 3) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return base64UrlEncode(signature);
}

async function issueToken(payload: Record<string, unknown>): Promise<string> {
  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const data = header + '.' + body;
  const signature = await hmacSign(data, DEMO_SECRET);
  return data + '.' + signature;
}

async function verifyToken(token: string | null): Promise<Identity> {
  if (!token) return { ok: false, reason: 'missing' };
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const expected = await hmacSign(parts[0] + '.' + parts[1], DEMO_SECRET);
  if (!timingSafeEqual(expected, parts[2])) return { ok: false, reason: 'bad_signature' };
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
    if (payload.exp && payload.exp * 1000 < Date.now()) return { ok: false, reason: 'expired', payload };
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: 'malformed' };
  }
}

function bearerOf(request: Request): string {
  const header = request.headers.get('authorization') || '';
  return header.replace(/^Bearer\s+/i, '').trim();
}

const DEMO_TOKENS: Record<string, { sub: string; role: string; scopes: string[] }> = {
  'demo-token-admin': { sub: 'admin-user', role: 'admin', scopes: ['read', 'write'] },
  'demo-token-viewer': { sub: 'viewer-user', role: 'viewer', scopes: ['read'] },
};

async function identityOf(request: Request): Promise<Identity> {
  const token = bearerOf(request);
  if (!token) return { ok: false, reason: 'missing' };
  if (DEMO_TOKENS[token]) return { ok: true, payload: DEMO_TOKENS[token] };
  return verifyToken(token);
}

function validateUser(payload: any): Problem[] {
  const problems: Problem[] = [];
  if (!payload || typeof payload !== 'object') {
    return [{ field: 'body', message: '请求体必须是 JSON 对象' }];
  }
  if (!payload.name || typeof payload.name !== 'string' || !payload.name.trim()) {
    problems.push({ field: 'name', message: 'name 不能为空' });
  }
  if (!payload.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email)) {
    problems.push({ field: 'email', message: 'email 格式不正确' });
  }
  return problems;
}

async function route(request: Request, url: URL): Promise<Response> {
  let path = url.pathname.replace(/\/+$/, '') || '/';
  if (path.startsWith('/functions/v1/app')) path = path.slice('/functions/v1/app'.length) || '/';
  const method = request.method.toUpperCase();

  if (path === '/' || path === '/health') {
    return json(200, {
      ok: true,
      service: 'backend-lab',
      version: '1.0.0',
      endpoints: [
        'GET  /health',
        'GET  /echo',
        'POST /echo',
        'GET  /users?page=1&limit=3',
        'POST /users',
        'DELETE /users/:id',
        'GET  /me',
        'POST /token',
        'GET  /token/verify?token=...',
        'GET  /config',
        'GET  /status/:code',
        'GET  /slow?ms=800',
        'GET  /ratelimit',
        'GET  /reports/export',
        'POST /payments',
      ],
    });
  }

  if (path === '/echo') {
    const body = await readBody(request);
    const headers: Record<string, string> = {};
    request.headers.forEach(function (value, key) { headers[key] = value; });
    return json(200, {
      method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      receivedHeaders: headers,
      body,
      bodyIsValidJson: body !== undefined,
      note: body === undefined ? '请求体不是合法 JSON' : null,
    });
  }

  if (path === '/users' && method === 'GET') {
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 10)));
    const start = (page - 1) * limit;
    const items = USERS.slice(start, start + limit);
    const etag = 'W/"users-v1"';
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new Response(null, { status: 304, headers: { etag: etag, 'cache-control': 'private, max-age=60' } });
    }
    return json(200, {
      items,
      pagination: { page, limit, total: USERS.length, totalPages: Math.ceil(USERS.length / limit) },
    }, { etag, 'cache-control': 'private, max-age=60' });
  }

  if (path === '/users' && method === 'POST') {
    const payload = await readBody(request);
    if (payload === undefined) {
      return json(400, { error: { code: 'invalid_json', message: '请求体不是合法的 JSON' } });
    }
    const problems = validateUser(payload);
    if (problems.length) {
      return json(422, { error: { code: 'validation_failed', message: '请求参数校验未通过', details: problems } });
    }
    if (USERS.some(function (user) { return user.email === payload.email; })) {
      return json(409, { error: { code: 'email_taken', message: '该邮箱已被注册' } });
    }
    const created: User = {
      id: USERS.length + 1,
      name: payload.name,
      email: payload.email,
      role: payload.role || 'member',
      createdAt: new Date().toISOString().slice(0, 10),
    };
    USERS.push(created);
    return json(201, { data: created }, { location: '/users/' + created.id });
  }

  const userMatch = /^\/users\/(\d+)$/.exec(path);
  if (userMatch && method === 'DELETE') {
    const result = await identityOf(request);
    if (!result.ok) {
      const headers = result.reason === 'missing'
        ? { 'www-authenticate': 'Bearer realm="backend-lab"' }
        : {};
      return json(401, { error: { code: 'unauthenticated', message: '缺少或无效的访问令牌', reason: result.reason } }, headers);
    }
    if (!result.payload || result.payload.role !== 'admin') {
      return json(403, { error: { code: 'forbidden', message: '当前令牌没有删除权限' } });
    }
    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  }

  if (path === '/me' && method === 'GET') {
    const result = await identityOf(request);
    if (!result.ok) {
      return json(401, { error: { code: 'unauthenticated', message: '缺少或无效的访问令牌', reason: result.reason } }, { 'www-authenticate': 'Bearer realm="backend-lab"' });
    }
    return json(200, { data: result.payload });
  }

  if (path === '/token' && method === 'POST') {
    const payload = await readBody(request);
    const subject = payload && payload.subject ? String(payload.subject) : 'demo-user';
    const ttlSeconds = payload && payload.ttl ? Math.min(86400, Number(payload.ttl)) : 3600;
    const token = await issueToken({
      sub: subject,
      role: 'member',
      scopes: ['read'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    });
    return json(200, { data: { token, tokenType: 'Bearer', expiresIn: ttlSeconds } });
  }

  if (path === '/token/verify' && method === 'GET') {
    const result = await verifyToken(url.searchParams.get('token'));
    if (!result.ok) {
      return json(401, { error: { code: 'invalid_token', message: '令牌校验失败', reason: result.reason } });
    }
    return json(200, { data: result.payload });
  }

  if (path === '/config' && method === 'GET') {
    const etag = 'W/"cfg-v3"';
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new Response(null, { status: 304, headers: { etag, 'cache-control': 'private, max-age=60' } });
    }
    return json(200, { data: { theme: 'dark', locale: 'zh-CN', version: 3 } }, { etag, 'cache-control': 'private, max-age=60' });
  }

  if (path === '/reports/export' && method === 'GET') {
    exportHits += 1;
    if (exportHits > 2) {
      return json(429, { error: { code: 'rate_limited', message: '请求过于频繁，请稍后再试' } }, {
        'retry-after': '3',
        'x-ratelimit-limit': '2',
        'x-ratelimit-remaining': '0',
      });
    }
    return json(200, { data: { exportId: 'exp_1024', status: 'processing' } }, {
      'x-ratelimit-limit': '2',
      'x-ratelimit-remaining': String(2 - exportHits),
    });
  }

  const statusMatch = /^\/status\/(\d{3})$/.exec(path);
  if (statusMatch || path === '/status') {
    const raw = statusMatch ? statusMatch[1] : url.searchParams.get('code') || '200';
    const code = Math.min(599, Math.max(100, Number(raw)));
    return json(code, { error: { code: 'forced', message: `手动触发状态码 ${code}` } });
  }

  if (path === '/slow') {
    const ms = Math.min(5000, Math.max(0, Number(url.searchParams.get('ms') || 800)));
    await new Promise(function (resolve) { setTimeout(resolve, ms); });
    return json(200, { data: { sleptMs: ms } });
  }

  if (path === '/ratelimit') {
    rateLimitHits += 1;
    if (rateLimitHits > 2) {
      return json(429, { error: { code: 'rate_limited', message: '请求过于频繁，请稍后再试' } }, {
        'retry-after': '3',
        'x-ratelimit-limit': '2',
        'x-ratelimit-remaining': '0',
      });
    }
    return json(200, { data: { ok: true } }, {
      'x-ratelimit-limit': '2',
      'x-ratelimit-remaining': String(2 - rateLimitHits),
    });
  }

  if (path === '/payments' && method === 'POST') {
    const key = request.headers.get('idempotency-key');
    if (!key) {
      return json(400, { error: { code: 'idempotency_key_required', message: '写接口必须携带 Idempotency-Key' } });
    }
    if (idempotencyStore.has(key)) {
      const stored = idempotencyStore.get(key)!;
      return json(stored.status, stored.body, { 'idempotency-replayed': 'true' });
    }
    const payload = await readBody(request);
    const body = { data: { id: 'pay_' + Math.abs(hashCode(key + JSON.stringify(payload))), status: 'succeeded' } };
    idempotencyStore.set(key, { status: 201, body });
    return json(201, body, { 'idempotency-replayed': 'false' });
  }

  return json(404, { error: { code: 'not_found', message: '没有匹配的路由：' + method + ' ' + path } });
}

function hashCode(value: string): number {
  let hash = 0;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  return route(request, url).catch(function () {
    return json(500, { error: { code: 'internal_error', message: '服务端处理请求时发生错误' } });
  });
}
