import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { buildCurl } from '../app/lab/curl';
import {
  createMockState,
  SCENARIOS,
  TEACH_IDLE,
  TEACH_LIVE,
  TEACH_MOCK,
} from '../app/lab/lab-data';
import { runMock } from '../app/lab/mock-server';
import LabPage from '../app/pages/LabPage';
import { ToastProvider } from '../app/shell/ToastProvider';

function renderLab() {
  render(
    <ToastProvider>
      <LabPage />
    </ToastProvider>,
  );
}

function parseBody(result: { body: string }): Record<string, unknown> {
  return JSON.parse(result.body) as Record<string, unknown>;
}

afterEach(cleanup);

describe('LabPage 场景与交互', () => {
  it('左侧渲染 10 个场景并逐项填入请求', async () => {
    const user = userEvent.setup();
    renderLab();
    const buttons = [...document.querySelectorAll('.lab-layout > .list-stack:first-child > button')];
    expect(buttons.map((node) => node.textContent)).toEqual(SCENARIOS.map((scenario) => scenario.title));
    expect(screen.getByText(TEACH_IDLE)).toBeInTheDocument();

    for (const scenario of SCENARIOS) {
      await user.click(screen.getByRole('button', { name: scenario.title }));
      expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe(scenario.request.method);
      expect((screen.getByLabelText('请求路径') as HTMLInputElement).value).toBe(scenario.request.path);
      expect(screen.getByText(scenario.teach)).toBeInTheDocument();
    }
    expect(screen.getByText('已载入场景：慢响应与超时')).toBeInTheDocument();
  });

  it('发送请求后渲染状态、响应头与历史，历史最多 6 条', async () => {
    const user = userEvent.setup();
    renderLab();
    for (let index = 0; index < 7; index += 1) {
      await user.click(screen.getByRole('button', { name: '发送请求' }));
      await waitFor(() => expect(screen.getByRole('button', { name: '发送请求' })).toBeEnabled());
    }
    expect(screen.getByText('200 OK')).toBeInTheDocument();
    expect(screen.getByText('content-type')).toBeInTheDocument();
    expect(screen.getByText('application/json; charset=utf-8')).toBeInTheDocument();
    expect(document.querySelector('.console-out')?.textContent).toContain('"total": 5');

    const historyPanel = screen.getByText('最近请求').closest('.panel') as HTMLElement;
    expect(historyPanel.querySelectorAll('.list-stack > div')).toHaveLength(6);
    expect(historyPanel.textContent).toContain('GET /api/users?page=1&limit=3');
  });

  it('三次导出触发 429 并展示 retry-after', async () => {
    const user = userEvent.setup();
    renderLab();
    await user.click(screen.getByRole('button', { name: '触发限流（429）' }));
    for (let index = 0; index < 3; index += 1) {
      await user.click(screen.getByRole('button', { name: '发送请求' }));
      await waitFor(() => expect(screen.getByRole('button', { name: '发送请求' })).toBeEnabled());
    }
    expect(screen.getByText('429 Too Many Requests')).toBeInTheDocument();
    const headerRows = [...document.querySelectorAll('.tbl-wrap tr')];
    const retryRow = headerRows.find((row) => row.textContent?.includes('retry-after')) as HTMLElement;
    expect(retryRow).toBeDefined();
    expect(retryRow.lastElementChild).toHaveTextContent('3');
    expect(document.querySelector('.console-out')?.textContent).toContain('rate_limited');
  });

  it('重复幂等键两次响应均标记幂等重放，第二次值为 true', async () => {
    const user = userEvent.setup();
    renderLab();
    await user.click(screen.getByRole('button', { name: '幂等键（重复提交）' }));
    await user.click(screen.getByRole('button', { name: '发送请求' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '发送请求' })).toBeEnabled());
    const replayValue = () => {
      const row = [...document.querySelectorAll('.tbl-wrap tr')]
        .find((item) => item.textContent?.includes('idempotency-replayed')) as HTMLElement;
      return row.lastElementChild?.textContent;
    };
    expect(replayValue()).toBe('false');
    expect(screen.getByText('幂等重放')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '发送请求' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '发送请求' })).toBeEnabled());
    expect(replayValue()).toBe('true');
    expect(document.querySelectorAll('.badge--violet')).toHaveLength(1);
  });

  it('模式切换更新教学文案', async () => {
    const user = userEvent.setup();
    renderLab();
    await user.click(screen.getByRole('button', { name: '真实端点' }));
    expect(screen.getByText(TEACH_LIVE)).toBeInTheDocument();
    expect(document.querySelector('#tab-live')).toHaveClass('is-active');
    await user.click(screen.getByRole('button', { name: '内置模拟服务' }));
    expect(screen.getByText(TEACH_MOCK)).toBeInTheDocument();
    expect(document.querySelector('#tab-mock')).toHaveClass('is-active');
  });

  it('重置恢复默认请求、清空响应与历史并恢复教学文案', async () => {
    const user = userEvent.setup();
    renderLab();
    await user.click(screen.getByRole('button', { name: '创建成功（201）' }));
    await user.click(screen.getByRole('button', { name: '发送请求' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '发送请求' })).toBeEnabled());
    expect(screen.getByText('201 Created')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '重置' }));
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('GET');
    expect((screen.getByLabelText('请求路径') as HTMLInputElement).value).toBe('/api/users?page=1&limit=3');
    expect(screen.getByText('还没有请求记录。')).toBeInTheDocument();
    expect(screen.queryByText('201 Created')).toBeNull();
    expect(screen.getByText(TEACH_IDLE)).toBeInTheDocument();
  });

  it('curl 生成包含方法、请求头与转义后的请求体', () => {
    const command = buildCurl({
      method: 'POST',
      path: '/api/users',
      headers: [
        { key: 'Content-Type', value: 'application/json' },
        { key: '  ', value: 'ignored' },
      ],
      body: '{"name":"O\'Brien"}',
    });
    const lines = command.split(' \\\n');
    expect(lines).toEqual([
      'curl -i -X POST "http://localhost:3000/api/users"',
      '  -H "Content-Type: application/json"',
      "  -d '{\"name\":\"O'\\''Brien\"}'",
    ]);
  });
});

describe('runMock 路由', () => {
  it('400：请求体不是合法 JSON', async () => {
    const result = await runMock({ method: 'POST', path: '/api/users', headers: [], body: 'not-json' }, createMockState());
    expect(result.status).toBe(400);
    expect(parseBody(result)).toEqual({ error: { code: 'invalid_json', message: '请求体不是合法的 JSON' } });
  });

  it('401：/api/me 缺少令牌并返回 www-authenticate', async () => {
    const result = await runMock({ method: 'GET', path: '/api/me', headers: [], body: '' }, createMockState());
    expect(result.status).toBe(401);
    expect(result.headers['www-authenticate']).toBe('Bearer realm="lab"');
  });

  it('403：查看者令牌删除被拒', async () => {
    const result = await runMock({
      method: 'DELETE',
      path: '/api/users/2',
      headers: [{ key: 'Authorization', value: 'Bearer demo-token-viewer' }],
      body: '',
    }, createMockState());
    expect(result.status).toBe(403);
    expect(parseBody(result)).toEqual({ error: { code: 'forbidden', message: '当前令牌没有删除权限' } });
  });

  it('404：未知路由包含方法与路径', async () => {
    const result = await runMock({ method: 'GET', path: '/api/unknown', headers: [], body: '' }, createMockState());
    expect(result.status).toBe(404);
    expect(parseBody(result)).toEqual({ error: { code: 'not_found', message: '没有匹配的路由：GET /api/unknown' } });
  });

  it('409：邮箱重复', async () => {
    const result = await runMock({
      method: 'POST',
      path: '/api/users',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      body: JSON.stringify({ name: '张伟', email: 'zhangwei@example.com' }),
    }, createMockState());
    expect(result.status).toBe(409);
    expect(parseBody(result)).toEqual({ error: { code: 'email_taken', message: '该邮箱已被注册' } });
  });

  it('422：name 为空与 email 格式错误同时返回', async () => {
    const result = await runMock({
      method: 'POST',
      path: '/api/users',
      headers: [],
      body: JSON.stringify({ name: '', email: 'not-an-email' }),
    }, createMockState());
    expect(result.status).toBe(422);
    expect(parseBody(result)).toEqual({
      error: {
        code: 'validation_failed',
        message: '请求参数校验未通过',
        details: [
          { field: 'name', message: 'name 不能为空' },
          { field: 'email', message: 'email 格式不正确' },
        ],
      },
    });
  });

  it('201：创建用户返回 Location 与新记录', async () => {
    const result = await runMock({
      method: 'POST',
      path: '/api/users',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      body: JSON.stringify({ name: '赵敏', email: 'zhaomin@example.com', role: 'member' }),
    }, createMockState());
    expect(result.status).toBe(201);
    expect(result.headers.location).toBe('/api/users/6');
    const created = parseBody(result).data as Record<string, unknown>;
    expect(created).toMatchObject({ id: 6, name: '赵敏', email: 'zhaomin@example.com', role: 'member' });
    expect(created.createdAt).toBe(new Date().toISOString().slice(0, 10));
  });

  it('204：管理员令牌删除成功且响应体为空', async () => {
    const result = await runMock({
      method: 'DELETE',
      path: '/api/users/2',
      headers: [{ key: 'Authorization', value: 'Bearer demo-token-admin' }],
      body: '',
    }, createMockState());
    expect(result.status).toBe(204);
    expect(result.body).toBe('');
    expect(result.headers).toEqual({});
  });

  it('304：条件请求不重传 body', async () => {
    const result = await runMock({
      method: 'GET',
      path: '/api/config',
      headers: [{ key: 'If-None-Match', value: 'W/"cfg-v3"' }],
      body: '',
    }, createMockState());
    expect(result.status).toBe(304);
    expect(result.body).toBe('');
    expect(result.headers.etag).toBe('W/"cfg-v3"');
    expect(result.headers['cache-control']).toBe('private, max-age=60');
  });

  it('429：第三次导出触发限流并带 retry-after', async () => {
    const state = createMockState();
    const request = { method: 'GET', path: '/api/reports/export', headers: [], body: '' };
    const first = await runMock(request, state);
    const second = await runMock(request, state);
    const third = await runMock(request, state);
    expect(first.status).toBe(200);
    expect(first.headers['x-ratelimit-remaining']).toBe('1');
    expect(second.headers['x-ratelimit-remaining']).toBe('0');
    expect(third.status).toBe(429);
    expect(third.headers['retry-after']).toBe('3');
    expect(third.headers['x-ratelimit-limit']).toBe('2');
    expect(third.headers['x-ratelimit-remaining']).toBe('0');
  });

  it('幂等键：首次写入、重复重放、缺失返回 400', async () => {
    const state = createMockState();
    const headers = [{ key: 'Idempotency-Key', value: 'demo-key-001' }];
    const first = await runMock({ method: 'POST', path: '/api/payments', headers, body: '{}' }, state);
    const second = await runMock({ method: 'POST', path: '/api/payments', headers, body: '{}' }, state);
    const missing = await runMock({ method: 'POST', path: '/api/payments', headers: [], body: '{}' }, state);
    expect(first.status).toBe(201);
    expect(first.headers['idempotency-replayed']).toBe('false');
    expect(second.status).toBe(201);
    expect(second.headers['idempotency-replayed']).toBe('true');
    expect(parseBody(second)).toEqual(parseBody(first));
    expect(missing.status).toBe(400);
    expect(parseBody(missing)).toEqual({
      error: { code: 'idempotency_key_required', message: '写接口必须携带 Idempotency-Key' },
    });
  });

  it('慢响应与强制状态码', async () => {
    const slow = await runMock({ method: 'GET', path: '/api/slow?ms=10', headers: [], body: '' }, createMockState());
    expect(slow.status).toBe(200);
    expect(parseBody(slow)).toEqual({ data: { sleptMs: 10 } });

    const forced = await runMock({ method: 'GET', path: '/api/status/503', headers: [], body: '' }, createMockState());
    expect(forced.status).toBe(503);
    expect(parseBody(forced)).toEqual({ error: { code: 'forced', message: '手动触发 503' } });
  });
});
