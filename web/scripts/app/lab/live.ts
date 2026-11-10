import type { LabRequest, LabResult } from './lab-data';

export async function runLive(request: LabRequest): Promise<LabResult> {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const headers: Record<string, string> = {};
    request.headers.forEach((row) => {
      if (row.key.trim()) headers[row.key.trim()] = row.value;
    });
    const method = request.method.toUpperCase();
    const init: RequestInit = { method, headers, signal: controller.signal };
    if (request.body && method !== 'GET' && method !== 'HEAD') {
      init.body = request.body;
    }
    const res = await fetch(`/functions/v1/app${request.path.replace(/^\/api/, '')}`, init);
    const text = await res.text();
    const headerObj: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headerObj[key] = value;
    });
    return {
      status: res.status,
      statusText: res.statusText,
      headers: headerObj,
      body: text,
      timeMs: Math.round(performance.now() - started),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    return {
      status: 0,
      statusText: '请求失败',
      headers: {},
      body: `${isTimeout ? '请求超时（8 秒）' : message}\n\n提示：真实端点依赖已部署的边缘函数，本地预览环境通常不可用。`,
      timeMs: Math.round(performance.now() - started),
    };
  } finally {
    clearTimeout(timer);
  }
}
