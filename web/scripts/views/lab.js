import { h, clear, toast } from '../ui.js';

const SEED_USERS = [
  { id: 1, name: '张伟', email: 'zhangwei@example.com', role: 'admin', createdAt: '2026-01-04' },
  { id: 2, name: '李娜', email: 'lina@example.com', role: 'member', createdAt: '2026-02-11' },
  { id: 3, name: '王强', email: 'wangqiang@example.com', role: 'member', createdAt: '2026-03-22' },
  { id: 4, name: '陈静', email: 'chenjing@example.com', role: 'member', createdAt: '2026-04-09' },
  { id: 5, name: '刘洋', email: 'liuyang@example.com', role: 'viewer', createdAt: '2026-05-30' },
];
const MOCK_USERS = SEED_USERS.map((user) => ({ ...user }));

function resetMockUsers() {
  MOCK_USERS.length = 0;
  SEED_USERS.forEach((user) => MOCK_USERS.push({ ...user }));
}

const TEACH_IDLE = '选一个左侧场景开始。每一段都对应一个后端必须回答的问题。';
const TEACH_MOCK = '内置模拟服务在浏览器里运行，行为固定可复现，适合练习状态码与请求头的语义。';
const TEACH_LIVE = '真实端点指向已部署的边缘函数。若站点未部署函数或当前是本地预览，会收到失败提示——这本身就是「环境差异」的第一课。';

const state = {
  method: 'GET',
  path: '/api/users?page=1&limit=3',
  headers: [{ key: 'Accept', value: 'application/json' }],
  body: '',
  target: 'mock',
  history: [],
  rateLimitCount: 0,
  idempotencyStore: new Map(),
};

const SCENARIOS = [
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

function json(status, body, headers = {}) {
  return {
    status,
    statusText: statusTextOf(status),
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
    body: JSON.stringify(body, null, 2),
  };
}

function statusTextOf(status) {
  const map = {
    200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content',
    301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
    405: 'Method Not Allowed', 409: 'Conflict', 422: 'Unprocessable Entity',
    429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway',
    503: 'Service Unavailable', 504: 'Gateway Timeout',
  };
  return map[status] || '';
}

async function runMock(request) {
  const url = new URL(request.path, 'http://lab.local');
  const path = url.pathname;
  const method = request.method.toUpperCase();
  const headers = {};
  request.headers.forEach((row) => {
    if (row.key.trim()) headers[row.key.trim().toLowerCase()] = row.value;
  });
  const delay = Number(url.searchParams.get('ms') || 0);

  let response;
  if (path === '/api/users' && method === 'GET') {
    const page = Number(url.searchParams.get('page') || 1);
    const limit = Number(url.searchParams.get('limit') || 10);
    const start = (page - 1) * limit;
    const items = MOCK_USERS.slice(start, start + limit);
    response = json(200, {
      items,
      pagination: { page, limit, total: MOCK_USERS.length, totalPages: Math.ceil(MOCK_USERS.length / limit) },
    });
  } else if (path === '/api/users' && method === 'POST') {
    let payload;
    try {
      payload = JSON.parse(request.body || '{}');
    } catch {
      response = json(400, { error: { code: 'invalid_json', message: '请求体不是合法的 JSON' } });
    }
    if (!response) {
      const problems = [];
      if (!payload.name) problems.push({ field: 'name', message: 'name 不能为空' });
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email || '')) problems.push({ field: 'email', message: 'email 格式不正确' });
      if (problems.length) {
        response = json(422, { error: { code: 'validation_failed', message: '请求参数校验未通过', details: problems } });
      } else if (MOCK_USERS.some((user) => user.email === payload.email)) {
        response = json(409, { error: { code: 'email_taken', message: '该邮箱已被注册' } });
      } else {
        const created = { id: MOCK_USERS.length + 1, ...payload, role: payload.role || 'member', createdAt: new Date().toISOString().slice(0, 10) };
        MOCK_USERS.push(created);
        response = json(201, { data: created }, { location: `/api/users/${created.id}` });
      }
    }
  } else if (/^\/api\/users\/\d+$/.test(path) && method === 'DELETE') {
    const token = (headers.authorization || '').replace('Bearer ', '');
    if (!token) response = json(401, { error: { code: 'unauthenticated', message: '缺少访问令牌' } });
    else if (token !== 'demo-token-admin') response = json(403, { error: { code: 'forbidden', message: '当前令牌没有删除权限' } });
    else response = json(204, {});
  } else if (path === '/api/me' && method === 'GET') {
    const token = (headers.authorization || '').replace('Bearer ', '');
    if (!token) response = json(401, { error: { code: 'unauthenticated', message: '缺少访问令牌' } }, { 'www-authenticate': 'Bearer realm="lab"' });
    else response = json(200, { data: { id: 42, name: '演示用户', scopes: ['read'] } });
  } else if (path === '/api/config' && method === 'GET') {
    const etag = 'W/"cfg-v3"';
    if (headers['if-none-match'] === etag) {
      response = { status: 304, statusText: statusTextOf(304), headers: { etag, 'cache-control': 'private, max-age=60' }, body: '' };
    } else {
      response = json(200, { data: { theme: 'dark', locale: 'zh-CN', version: 3 } }, { etag, 'cache-control': 'private, max-age=60' });
    }
  } else if (path === '/api/reports/export' && method === 'GET') {
    state.rateLimitCount += 1;
    if (state.rateLimitCount > 2) {
      response = json(429, { error: { code: 'rate_limited', message: '请求过于频繁，请稍后再试' } }, { 'retry-after': '3', 'x-ratelimit-limit': '2', 'x-ratelimit-remaining': '0' });
    } else {
      response = json(200, { data: { exportId: 'exp_1024', status: 'processing' } }, { 'x-ratelimit-limit': '2', 'x-ratelimit-remaining': String(2 - state.rateLimitCount) });
    }
  } else if (path === '/api/payments' && method === 'POST') {
    const key = headers['idempotency-key'];
    if (!key) {
      response = json(400, { error: { code: 'idempotency_key_required', message: '写接口必须携带 Idempotency-Key' } });
    } else if (state.idempotencyStore.has(key)) {
      const cached = state.idempotencyStore.get(key);
      response = json(cached.status, cached.body, { 'idempotency-replayed': 'true' });
    } else {
      const created = { id: 'pay_7781', amount: 19900, currency: 'CNY', status: 'succeeded' };
      state.idempotencyStore.set(key, { status: 201, body: { data: created } });
      response = json(201, { data: created }, { 'idempotency-replayed': 'false' });
    }
  } else if (path === '/api/slow' && method === 'GET') {
    response = json(200, { data: { sleptMs: delay || 1200 } });
  } else if (/^\/api\/status\/\d{3}$/.test(path)) {
    const code = Number(path.split('/').pop());
    response = json(code, { error: { code: 'forced', message: `手动触发 ${code}` } });
  } else {
    response = json(404, { error: { code: 'not_found', message: `没有匹配的路由：${method} ${path}` } });
  }

  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  return response;
}

async function runLive(request) {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const headers = {};
    request.headers.forEach((row) => { if (row.key.trim()) headers[row.key.trim()] = row.value; });
    const init = { method: request.method.toUpperCase(), headers, signal: controller.signal };
    if (request.body && request.method.toUpperCase() !== 'GET' && request.method.toUpperCase() !== 'HEAD') {
      init.body = request.body;
    }
    const res = await fetch(`/functions/v1/app${request.path.replace(/^\/api/, '')}`, init);
    const text = await res.text();
    const headerObj = {};
    res.headers.forEach((value, key) => { headerObj[key] = value; });
    return {
      status: res.status,
      statusText: res.statusText,
      headers: headerObj,
      body: text,
      timeMs: Math.round(performance.now() - started),
    };
  } catch (err) {
    return {
      status: 0,
      statusText: '请求失败',
      headers: {},
      body: `${err.name === 'AbortError' ? '请求超时（8 秒）' : err.message}\n\n提示：真实端点依赖已部署的边缘函数，本地预览环境通常不可用。`,
      timeMs: Math.round(performance.now() - started),
    };
  } finally {
    clearTimeout(timer);
  }
}

function statusClass(status) {
  if (status === 0) return 'badge--rose';
  if (status < 300) return 'badge--teal';
  if (status < 400) return 'badge--blue';
  if (status < 500) return 'badge--amber';
  return 'badge--rose';
}

export function renderLab() {
  const page = h('div', { class: 'page page--wide' });
  const isLive = state.target === 'live';

  page.appendChild(h('div', { class: 'section__head', style: 'margin-bottom:16px' },
    h('div', {},
      h('h1', { text: 'HTTP 实验室' }),
      h('p', { text: '亲手发请求，看状态码、响应头与错误体到底长什么样。左边是教学场景，点一下自动填好请求。' })),
    h('div', { class: 'tabs', style: 'width:280px' },
      h('button', { class: `tab${isLive ? '' : ' is-active'}`, type: 'button', id: 'tab-mock', text: '内置模拟服务' }),
      h('button', { class: `tab${isLive ? ' is-active' : ''}`, type: 'button', id: 'tab-live', text: '真实端点' }))));

  const layout = h('div', { class: 'split lab-layout' });

  const scenarioList = h('div', { class: 'list-stack' });
  SCENARIOS.forEach((scenario) => {
    scenarioList.appendChild(h('button', {
      class: 'btn btn--ghost btn--sm',
      type: 'button',
      style: 'justify-content:flex-start;text-align:left;white-space:normal;line-height:1.6',
      onclick: () => {
        applyRequest(scenario.request);
        teachBox.textContent = scenario.teach;
        toast(`已载入场景：${scenario.title}`);
      },
    }, scenario.title));
  });

  const builder = h('div', { class: 'panel' });
  const methodSelect = h('select', {
    style: 'background:var(--ink-900);border:1px solid var(--line);border-radius:8px;padding:7px 10px;font-family:var(--font-code);font-size:12.5px',
    onchange: (event) => { state.method = event.target.value; },
  }, ...['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => h('option', { value: method, text: method })));
  methodSelect.value = state.method;

  const pathInput = h('input', {
    type: 'text',
    value: state.path,
    class: 'mono lab-path-input',
    'aria-label': '请求路径',
    style: 'flex:1;background:var(--ink-900);border:1px solid var(--line);border-radius:8px;padding:8px 11px;font-size:13px',
    oninput: (event) => { state.path = event.target.value; },
  });

  const headerRows = h('div', { class: 'list-stack' });
  function renderHeaderRows() {
    clear(headerRows);
    state.headers.forEach((row, index) => {
      headerRows.appendChild(h('div', { class: 'lab-header-row', style: 'display:flex;gap:8px' },
        h('input', {
          type: 'text', value: row.key, placeholder: 'Header',
          style: 'flex:1;background:var(--ink-900);border:1px solid var(--line);border-radius:8px;padding:7px 10px;font-family:var(--font-code);font-size:12.5px',
          oninput: (event) => { row.key = event.target.value; },
        }),
        h('input', {
          type: 'text', value: row.value, placeholder: 'Value',
          style: 'flex:1.4;background:var(--ink-900);border:1px solid var(--line);border-radius:8px;padding:7px 10px;font-family:var(--font-code);font-size:12.5px',
          oninput: (event) => { row.value = event.target.value; },
        }),
        h('button', {
          class: 'btn btn--ghost btn--sm', type: 'button', text: '×',
          onclick: () => { state.headers.splice(index, 1); renderHeaderRows(); },
        })));
    });
    headerRows.appendChild(h('button', {
      class: 'btn btn--ghost btn--sm', type: 'button', text: '+ 添加请求头',
      onclick: () => { state.headers.push({ key: '', value: '' }); renderHeaderRows(); },
    }));
  }
  renderHeaderRows();
  const bodyArea = h('textarea', {
    placeholder: '{ }',
    class: 'mono',
    style: 'width:100%;min-height:110px;background:var(--ink-900);border:1px solid var(--line);border-radius:9px;padding:11px 13px;font-family:var(--font-code);font-size:12.5px;line-height:1.7;resize:vertical',
    oninput: (event) => { state.body = event.target.value; },
  });
  bodyArea.value = state.body;
  refs = { methodSelect, pathInput, bodyArea, renderHeaderRows };

  const sendBtn = h('button', { class: 'btn btn--primary', type: 'button', text: '发送请求' });
  const curlBtn = h('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: '复制为 curl' });
  const resetBtn = h('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: '重置' });

  const responseBox = h('div', {});
  const teachBox = h('p', { class: 'tiny muted', style: 'line-height:1.75', text: isLive ? TEACH_LIVE : TEACH_IDLE });
  const historyBox = h('div', { class: 'list-stack' });

  async function send() {
    sendBtn.disabled = true;
    sendBtn.textContent = '请求中…';
    const request = { method: methodSelect.value, path: pathInput.value, headers: state.headers.filter((row) => row.key.trim()), body: bodyArea.value };
    const result = state.target === 'live'
      ? await runLive(request)
      : { ...(await runMock(request)), timeMs: Math.round(60 + Math.random() * 90) };
    renderResponse(responseBox, result);
    state.history.unshift({ ...request, result });
    state.history = state.history.slice(0, 6);
    renderHistory(historyBox);
    sendBtn.disabled = false;
    sendBtn.textContent = '发送请求';
  }

  sendBtn.addEventListener('click', send);
  curlBtn.addEventListener('click', async () => {
    const parts = [`curl -i -X ${methodSelect.value} "http://localhost:3000${pathInput.value}"`];
    state.headers.filter((row) => row.key.trim()).forEach((row) => {
      parts.push(`  -H "${row.key}: ${row.value}"`);
    });
    if (bodyArea.value.trim() && methodSelect.value !== 'GET') {
      parts.push(`  -d '${bodyArea.value.replace(/'/g, "'\\''")}'`);
    }
    const command = parts.join(' \\\n');
    try {
      await navigator.clipboard.writeText(command);
      toast('curl 命令已复制');
    } catch {
      showCurl(command);
    }
  });
  resetBtn.addEventListener('click', () => {
    applyRequest({ method: 'GET', path: '/api/users?page=1&limit=3', headers: [{ key: 'Accept', value: 'application/json' }], body: '' });
    state.rateLimitCount = 0;
    state.idempotencyStore.clear();
    resetMockUsers();
    state.history = [];
    renderHistory(historyBox);
    clear(responseBox);
    teachBox.textContent = state.target === 'live' ? TEACH_LIVE : TEACH_IDLE;
  });

  builder.appendChild(h('div', { class: 'panel__head' },
    h('h3', { text: '请求构造器' }),
    h('div', { class: 'lab-panel-actions', style: 'display:flex;gap:8px' }, curlBtn, resetBtn)));
  const builderBody = h('div', { class: 'panel__body' },
    h('div', { class: 'lab-request-line', style: 'display:flex;gap:10px;flex-wrap:wrap;align-items:center' }, methodSelect, pathInput),
    h('div', { style: 'margin-top:16px' },
      h('p', { class: 'eyebrow', style: 'margin-bottom:8px', text: '请求头' }),
      headerRows),
    h('div', { style: 'margin-top:16px' },
      h('p', { class: 'eyebrow', style: 'margin-bottom:8px', text: '请求体' }),
      bodyArea),
    h('div', { style: 'margin-top:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap' },
      sendBtn,
      h('span', { class: 'tiny muted', text: '发送后可在下方查看状态码、响应头与响应体' })));
  builder.appendChild(builderBody);

  let curlBox = null;
  function showCurl(command) {
    if (curlBox) curlBox.remove();
    curlBox = document.createElement('pre');
    curlBox.textContent = command;
    curlBox.style.cssText = 'margin:0 18px 18px;padding:12px;background:var(--ink-900);border:1px solid var(--line);border-radius:9px;font-family:var(--font-code);font-size:12px;overflow-x:auto';
    builderBody.appendChild(curlBox);
  }

  const responsePanel = h('div', { class: 'panel' },
    h('div', { class: 'panel__head' }, h('h3', { text: '响应' })),
    h('div', { class: 'panel__body' }, responseBox));

  const right = h('div', { class: 'list-stack' },
    builder,
    responsePanel,
    h('div', { class: 'panel' },
      h('div', { class: 'panel__head' }, h('h3', { text: '最近请求' })),
      h('div', { class: 'panel__body' }, historyBox)));

  layout.appendChild(scenarioList);
  layout.appendChild(right);
  page.appendChild(layout);

  page.appendChild(h('div', { class: 'panel', style: 'margin-top:24px' },
    h('div', { class: 'panel__head' }, h('h3', { text: '这个场景在教什么' })),
    h('div', { class: 'panel__body' }, teachBox)));

  const tabMock = page.querySelector('#tab-mock');
  const tabLive = page.querySelector('#tab-live');
  tabMock.addEventListener('click', () => {
    state.target = 'mock';
    tabMock.classList.add('is-active');
    tabLive.classList.remove('is-active');
    teachBox.textContent = TEACH_MOCK;
  });
  tabLive.addEventListener('click', () => {
    state.target = 'live';
    tabLive.classList.add('is-active');
    tabMock.classList.remove('is-active');
    teachBox.textContent = TEACH_LIVE;
  });

  return page;
}

let refs = null;

function applyRequest(request) {
  state.method = request.method;
  state.path = request.path;
  state.headers = request.headers.map((row) => ({ ...row }));
  state.body = request.body || '';
  if (!refs) return;
  refs.methodSelect.value = request.method;
  refs.pathInput.value = request.path;
  refs.bodyArea.value = state.body;
  refs.renderHeaderRows();
}

function renderResponse(container, result) {
  clear(container);
  const headers = Object.entries(result.headers || {});
  container.appendChild(h('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:wrap' },
    h('span', { class: `badge ${statusClass(result.status)}`, text: `${result.status} ${result.statusText}` }),
    h('span', { class: 'tiny muted', text: `${result.timeMs ?? '-'} ms` }),
    result.headers?.['idempotency-replayed'] ? h('span', { class: 'badge badge--violet', text: '幂等重放' }) : null));
  if (headers.length) {
    container.appendChild(h('div', { class: 'tbl-wrap', style: 'margin-top:14px' },
      h('table', { class: 'tbl' },
        h('thead', {}, h('tr', {}, h('th', { text: '响应头' }), h('th', { text: '值' }))),
        h('tbody', {}, headers.map(([key, value]) => h('tr', {},
          h('td', { style: 'font-family:var(--font-code);font-size:12px;color:var(--teal);white-space:nowrap', text: key }),
          h('td', { style: 'font-family:var(--font-code);font-size:12px;word-break:break-all', text: String(value) })))))));
  }
  container.appendChild(h('div', { class: 'console-out', style: 'max-height:none;margin-top:14px', text: result.body || '(空响应体)' }));
}

function renderHistory(container) {
  clear(container);
  if (!state.history.length) {
    container.appendChild(h('div', { class: 'empty-state', text: '还没有请求记录。' }));
    return;
  }
  state.history.forEach((item) => {
    container.appendChild(h('div', {
      style: 'display:flex;align-items:center;gap:10px;padding:7px 10px;border:1px solid var(--line-soft);border-radius:8px;font-size:12.5px',
    },
    h('span', { class: `badge ${statusClass(item.result.status)}`, text: String(item.result.status) }),
    h('span', { class: 'mono tiny', style: 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', text: `${item.method} ${item.path}` }),
    h('span', { class: 'tiny muted', text: `${item.result.timeMs ?? '-'} ms` })));
  });
}
