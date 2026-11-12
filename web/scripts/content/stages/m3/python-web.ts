import type { PythonBlockMap, PythonTrackMap } from '../../types.js';
export const PYTHON_BLOCKS = {
  'm3-bff': [
    {
      code: `from urllib.parse import quote

def build_client(schema=None, transport=None):
    schema = schema or {}
    paths = schema.get('paths') or {}

    async def get(template, params=None):
        params = params or {}
        spec = (paths.get(template) or {}).get('get')
        if not spec:
            raise RuntimeError('UNKNOWN_ROUTE')
        path = template
        for name in spec.get('pathParams') or []:
            value = params.get(name)
            if value is None:
                raise RuntimeError('MISSING_PARAM')
            path = path.replace('{' + name + '}', quote(str(value), safe=''))
        query = '&'.join(
            quote(name, safe='') + '=' + quote(str(params[name]), safe='')
            for name in sorted(spec.get('query') or [])
            if params.get(name) is not None
        )
        body = await transport({'method': 'GET', 'path': path, 'query': query})
        required = (spec.get('response') or {}).get('required') or []
        if any(field not in body for field in required):
            raise RuntimeError('INVALID_RESPONSE')
        return body

    return {'get': get}`,
      note: 'Python 的 quote(safe="") 与 JS 的 encodeURIComponent 行为接近，但编码集合不完全相同；跨语言生成客户端时，路径与查询的编码规则要由契约固定并由测试锁定。查询参数排序后再拼接，缓存键才稳定。'
    },
    {
      code: `import asyncio

def create_detail_loader(fetch_meta, fetch_stats, fetch_permission, timeout_ms=1000):
    async def load_detail(link_id):
        status = {'meta': 'pending', 'stats': 'pending', 'permission': 'pending'}
        values = {}
        degraded = []
        tasks = []

        def start(name, fn):
            async def runner():
                try:
                    values[name] = await fn(link_id)
                    status[name] = 'fulfilled'
                except Exception as error:
                    status[name] = 'rejected'
                    if name == 'meta':
                        values['metaError'] = error
                    else:
                        degraded.append(name)
            tasks.append(asyncio.ensure_future(runner()))

        start('meta', fetch_meta)
        start('stats', fetch_stats)
        start('permission', fetch_permission)

        async def collect():
            await asyncio.gather(*tasks, return_exceptions=True)

        try:
            await asyncio.wait_for(collect(), timeout_ms / 1000)
        except asyncio.TimeoutError:
            pass

        if status['meta'] == 'rejected':
            error = values.get('metaError')
            code = 'NOT_FOUND' if getattr(error, 'code', None) == 'NOT_FOUND' else 'UPSTREAM'
            return {'code': code}
        if status['meta'] != 'fulfilled':
            return {'code': 'UPSTREAM'}

        report = []
        if status['stats'] != 'fulfilled':
            report.append('stats')
        if status['permission'] != 'fulfilled':
            report.append('permission')
        return {
            'link': values.get('meta'),
            'stats': values.get('stats'),
            'canEdit': values.get('permission') is True,
            'degraded': report,
        }

    return load_detail`,
      note: 'asyncio.ensure_future 先启动三个任务，再统一等待，等价于 JS 的并发聚合。wait_for 只控制总预算；超时后状态仍停在 pending 的字段按降级处理。Python 里 CancelledError 继承 BaseException，不会被 except Exception 吞掉，正好避免把取消当成业务失败。'
    }
  ],
  'm3-render': [
    {
      code: `def choose_render_strategy(page=None):
    page = page or {}
    personalization = page.get('personalization', 'none')
    freshness = page.get('freshnessSec', float('inf'))

    if personalization == 'high':
        return 'stream'
    if page.get('seo') is True and freshness <= 60:
        return 'ssr'
    if page.get('seo') is True:
        return 'ssg'
    if page.get('requiresAuth') is True:
        return 'csr'
    return 'csr'`,
      note: '规则顺序就是产品决策：个性化优先于 SEO，新鲜度优先于可静态化。用 dict 与纯函数表达，测试可以逐条锁定优先级，不依赖框架。'
    },
    {
      code: `import math

def percentile75(values):
    if not values:
        return None
    ordered = sorted(values)
    return ordered[math.ceil(0.75 * len(ordered)) - 1]

def check_budget(samples, budget):
    order = ['lcp', 'inp', 'cls']
    violations = []
    for metric in order:
        if budget.get(metric) is None:
            continue
        value = percentile75(samples.get(metric) or [])
        if value is None:
            violations.append({
                'metric': metric,
                'p75': None,
                'budget': budget[metric],
                'ratio': None,
                'reason': 'NO_DATA',
            })
            continue
        if value > budget[metric]:
            violations.append({
                'metric': metric,
                'p75': value,
                'budget': budget[metric],
                'ratio': (value - budget[metric]) / budget[metric],
            })
    rank = {'lcp': 0, 'inp': 1, 'cls': 2}
    violations.sort(key=lambda item: (
        -1 if item['ratio'] is None else item['ratio'],
        -rank[item['metric']],
    ), reverse=True)
    return {'pass': not violations, 'violations': violations}`,
      note: '最近秩与 JS 版本一致；排序时把 NO_DATA 的 ratio 当成 -1，保证它排在所有数值违规之后。浮点比较用于测试时留容差，生产判断仍按 p75 与预算直接比较。'
    }
  ],
  'm3-realtime': [
    {
      code: `import random as _random

def plan_reconnect(attempt, options=None):
    options = options or {}
    base_ms = options.get('baseMs', 100)
    max_ms = options.get('maxMs', 1600)
    jitter = options.get('jitter', 0.2)
    max_attempts = options.get('maxAttempts', 5)
    rand = options.get('random') or _random.random

    if attempt >= max_attempts:
        return {'delayMs': 0, 'exhausted': True}
    raw = min(base_ms * (2 ** attempt), max_ms)
    factor = 1 - jitter + 2 * jitter * rand()
    return {'delayMs': round(raw * factor), 'exhausted': False}`,
      note: '结构与 JS 一致：先判断耗尽，再算封顶与 jitter。差异在舍入：Python 的 round 使用银行家舍入（.5 向偶数），JS 的 Math.round 一律向上；跨语言实现要固定舍入策略，测试避开 .5 边界。random 同样可注入。'
    },
    {
      code: `def apply_live_event(state, event):
    next_state = {
        'total': state.get('total') or 0,
        'perLink': dict(state.get('perLink') or {}),
        'seenIds': list(state.get('seenIds') or []),
        'lastEventId': state['lastEventId'] if 'lastEventId' in state else None,
        'lastSeq': state['lastSeq'] if 'lastSeq' in state else 0,
        'gap': state.get('gap') is True,
    }
    if not event or not event.get('id'):
        return next_state
    if event['id'] in next_state['seenIds']:
        return next_state

    next_state['seenIds'].append(event['id'])
    next_state['total'] += event['delta']
    link_id = event['linkId']
    next_state['perLink'][link_id] = next_state['perLink'].get(link_id, 0) + event['delta']

    if event['seq'] > next_state['lastSeq'] + 1:
        next_state['gap'] = True
    if event['seq'] >= next_state['lastSeq']:
        next_state['lastSeq'] = event['seq']
        next_state['lastEventId'] = event['id']
    return next_state`,
      note: 'dict 与 list 都要显式复制，否则返回值和入参共享嵌套结构，调用方改一处两处都变。gap 一旦置 True 不会被后续事件清掉，补拉是否完成由上层决定，归并函数只负责标记。'
    }
  ],
  'm3-edge': [
    {
      code: `import asyncio

def create_edge_cache(ttl_ms, swr_ms, now, load, on_refresh_error=None):
    cache = {}
    refreshing = {}

    async def refresh(key):
        try:
            value = await load(key)
            cache[key] = {'value': value, 'storedAt': now()}
        except Exception as error:
            if on_refresh_error:
                on_refresh_error(error, key)
        finally:
            refreshing.pop(key, None)

    async def get(key, bypass=False):
        entry = cache.get(key)
        if not bypass and entry:
            age = now() - entry['storedAt']
            if age <= ttl_ms:
                return {'value': entry['value'], 'state': 'fresh'}
            if age <= ttl_ms + swr_ms:
                if key not in refreshing:
                    refreshing[key] = asyncio.create_task(refresh(key))
                return {'value': entry['value'], 'state': 'stale'}
        value = await load(key)
        cache[key] = {'value': value, 'storedAt': now()}
        return {'value': value, 'state': 'bypass' if bypass else 'miss'}

    async def when_idle():
        while refreshing:
            await asyncio.gather(*list(refreshing.values()))

    return {'get': get, 'whenIdle': when_idle}`,
      note: 'asyncio.create_task 才会真正并发执行协程；只创建协程对象不调度，后台刷新永远不会发生。when_idle 用 while 加 gather，是因为等待期间可能又触发了新的刷新。刷新任务自己捕获异常，避免后台错误变成「Task exception was never retrieved」。'
    },
    {
      code: `def linkhub_hash(text):
    value = 0
    for char in text:
        value = (value * 31 + ord(char)) & 0xFFFFFFFF
    return value

def is_enabled(flag, context):
    if not flag or flag.get('kill'):
        return False
    if context.get('userId') in (flag.get('allow') or []):
        return True
    if context.get('tenantId') in (flag.get('tenants') or []):
        return True
    bucket = linkhub_hash(flag['key'] + ':' + str(context.get('userId'))) % 100
    return bucket < (flag.get('percent') or 0)`,
      note: '分桶输入必须包含开关 key，否则同一个用户在所有开关里落在同一个桶，灰度会变成「同一批人永远先看到所有新功能」。kill 判断放最前，任何配置错误都不能绕过紧急关闭。'
    },
    {
      code: `def join_trace(rum=None, server=None):
    rum = rum or {}
    server = server or {}
    trace_id = server.get('traceId') or rum.get('traceId')
    spans = [span for span in (server.get('spans') or []) if span]

    if not rum.get('traceId') or not server.get('traceId'):
        return {'traceId': trace_id, 'totalMs': None, 'segments': [], 'largestGap': None, 'incomplete': True}
    if rum['traceId'] != server['traceId'] or not spans:
        return {'traceId': trace_id, 'totalMs': None, 'segments': [], 'largestGap': None, 'incomplete': True}

    ordered = sorted(spans, key=lambda span: span['startMs'])
    segments = [
        {
            'name': span['name'],
            'startMs': span['startMs'],
            'endMs': span['startMs'] + span['durationMs'],
            'durationMs': span['durationMs'],
        }
        for span in ordered
    ]
    last_end = segments[-1]['endMs']
    end = max(last_end, rum.get('lcpMs') or 0)
    gaps = [segments[0]['startMs']]
    for previous, current in zip(segments, segments[1:]):
        gaps.append(max(0, current['startMs'] - previous['endMs']))
    gaps.append(max(0, end - last_end))
    return {
        'traceId': trace_id,
        'totalMs': end,
        'segments': segments,
        'largestGap': max(gaps),
        'incomplete': False,
    }`,
      note: '两端 traceId 必须同时存在且相等才合并；只对上一边时宁可标记 incomplete，也不要拼出一条看似完整的假链路。span 先按开始时间排序再算间隙，输入乱序不会影响结论。'
    }
  ]
} satisfies PythonBlockMap;

export const PYTHON_TRACKS = {
  'm3-bff-ex-1': {
    starter: `from urllib.parse import quote

def build_client(schema=None, transport=None):
    schema = schema or {}

    def get(template, params=None):
        async def run():
            params = params or {}
            path = template.replace('{id}', str(params.get('id', '')))
            body = await transport({'method': 'GET', 'path': path, 'query': ''})
            return body
        return run()

    return {'get': get}

def create_detail_loader(fetch_meta, fetch_stats, fetch_permission, timeout_ms=1000):
    async def load_detail(link_id):
        link = await fetch_meta(link_id)
        stats = await fetch_stats(link_id)
        can_edit = await fetch_permission(link_id)
        return {'link': link, 'stats': stats, 'canEdit': can_edit, 'degraded': []}
    return load_detail
`,
    solution: `from urllib.parse import quote

def build_client(schema=None, transport=None):
    schema = schema or {}
    paths = schema.get('paths') or {}

    async def get(template, params=None):
        params = params or {}
        spec = (paths.get(template) or {}).get('get')
        if not spec:
            raise RuntimeError('UNKNOWN_ROUTE')
        path = template
        for name in spec.get('pathParams') or []:
            value = params.get(name)
            if value is None:
                raise RuntimeError('MISSING_PARAM')
            path = path.replace('{' + name + '}', quote(str(value), safe=''))
        query = '&'.join(
            quote(name, safe='') + '=' + quote(str(params[name]), safe='')
            for name in sorted(spec.get('query') or [])
            if params.get(name) is not None
        )
        body = await transport({'method': 'GET', 'path': path, 'query': query})
        required = (spec.get('response') or {}).get('required') or []
        if any(field not in body for field in required):
            raise RuntimeError('INVALID_RESPONSE')
        return body

    return {'get': get}

import asyncio

def create_detail_loader(fetch_meta, fetch_stats, fetch_permission, timeout_ms=1000):
    async def load_detail(link_id):
        status = {'meta': 'pending', 'stats': 'pending', 'permission': 'pending'}
        values = {}
        degraded = []
        tasks = []

        def start(name, fn):
            async def runner():
                try:
                    values[name] = await fn(link_id)
                    status[name] = 'fulfilled'
                except Exception as error:
                    status[name] = 'rejected'
                    if name == 'meta':
                        values['metaError'] = error
                    else:
                        degraded.append(name)
            tasks.append(asyncio.ensure_future(runner()))

        start('meta', fetch_meta)
        start('stats', fetch_stats)
        start('permission', fetch_permission)

        async def collect():
            await asyncio.gather(*tasks, return_exceptions=True)

        try:
            await asyncio.wait_for(collect(), timeout_ms / 1000)
        except asyncio.TimeoutError:
            pass

        if status['meta'] == 'rejected':
            error = values.get('metaError')
            code = 'NOT_FOUND' if getattr(error, 'code', None) == 'NOT_FOUND' else 'UPSTREAM'
            return {'code': code}
        if status['meta'] != 'fulfilled':
            return {'code': 'UPSTREAM'}

        report = []
        if status['stats'] != 'fulfilled':
            report.append('stats')
        if status['permission'] != 'fulfilled':
            report.append('permission')
        return {
            'link': values.get('meta'),
            'stats': values.get('stats'),
            'canEdit': values.get('permission') is True,
            'degraded': report,
        }

    return load_detail
`,
    tests: [
      {
        name: '路径参数与查询串编码正确且顺序稳定',
        code: `calls = []
async def transport(request):
    calls.append(request)
    return {'id': 'l1'}
client = build_client({'paths': {'/links/{id}': {'get': {'pathParams': ['id'], 'query': ['limit', 'cursor'], 'response': {'required': ['id']}}}}}, transport)
body = await client['get']('/links/{id}', {'id': 'a b/c', 'limit': 10, 'cursor': 'x y'})
assert_eq(body['id'], 'l1')
assert_eq(calls[0]['method'], 'GET')
assert_eq(calls[0]['path'], '/links/a%20b%2Fc')
assert_eq(calls[0]['query'], 'cursor=x%20y&limit=10')`
      },
      {
        name: '未知路径抛 UNKNOWN_ROUTE',
        code: `async def transport(request):
    return {}
client = build_client({'paths': {}}, transport)
code = ''
try:
    await client['get']('/missing')
except RuntimeError as error:
    code = str(error)
assert_eq(code, 'UNKNOWN_ROUTE')`
      },
      {
        name: '缺失路径参数抛 MISSING_PARAM',
        code: `async def transport(request):
    return {}
client = build_client({'paths': {'/links/{id}': {'get': {'pathParams': ['id'], 'response': {'required': []}}}}}, transport)
code = ''
try:
    await client['get']('/links/{id}', {})
except RuntimeError as error:
    code = str(error)
assert_eq(code, 'MISSING_PARAM')`
      },
      {
        name: '响应缺少必填字段抛 INVALID_RESPONSE',
        code: `async def transport(request):
    return {'id': 'l1'}
client = build_client({'paths': {'/links/{id}': {'get': {'pathParams': ['id'], 'response': {'required': ['id', 'url']}}}}}, transport)
code = ''
try:
    await client['get']('/links/{id}', {'id': 'l1'})
except RuntimeError as error:
    code = str(error)
assert_eq(code, 'INVALID_RESPONSE')`
      },
      {
        name: '三个上游并发启动而不是顺序等待',
        code: `started = []
all_started = asyncio.Event()

async def fetch_meta(link_id):
    started.append('meta')
    if len(started) == 3:
        all_started.set()
    await all_started.wait()
    return {'id': link_id}

async def fetch_stats(link_id):
    started.append('stats')
    if len(started) == 3:
        all_started.set()
    await all_started.wait()
    return {'clicks': 1}

async def fetch_permission(link_id):
    started.append('permission')
    if len(started) == 3:
        all_started.set()
    await all_started.wait()
    return True

loader = create_detail_loader(fetch_meta, fetch_stats, fetch_permission, timeout_ms=500)
result = await loader('l1')
assert_eq(started, ['meta', 'stats', 'permission'])
assert_eq(result['degraded'], [])`
      },
      {
        name: '全部成功时返回稳定 UI 形状且无降级',
        code: `async def fetch_meta(link_id):
    return {'id': link_id, 'url': 'https://example.com'}
async def fetch_stats(link_id):
    return {'clicks': 3}
async def fetch_permission(link_id):
    return True
loader = create_detail_loader(fetch_meta, fetch_stats, fetch_permission, timeout_ms=100)
result = await loader('l1')
assert_eq(result, {
    'link': {'id': 'l1', 'url': 'https://example.com'},
    'stats': {'clicks': 3},
    'canEdit': True,
    'degraded': [],
})`
      },
      {
        name: 'stats 失败只降级 stats',
        code: `async def fetch_meta(link_id):
    return {'id': link_id}
async def fetch_stats(link_id):
    raise RuntimeError('stats down')
async def fetch_permission(link_id):
    return True
loader = create_detail_loader(fetch_meta, fetch_stats, fetch_permission, timeout_ms=100)
result = await loader('l1')
assert_eq(result['stats'], None)
assert_eq(result['canEdit'], True)
assert_eq(result['degraded'], ['stats'])`
      },
      {
        name: 'meta 失败映射错误码且不透传原始错误',
        code: `class NotFound(Exception):
    code = 'NOT_FOUND'

async def fetch_meta_missing(link_id):
    raise NotFound('missing')
async def fetch_meta_error(link_id):
    raise RuntimeError('boom')
async def fetch_stats(link_id):
    return {}
async def fetch_permission(link_id):
    return False
first = await create_detail_loader(fetch_meta_missing, fetch_stats, fetch_permission, timeout_ms=100)('l1')
assert_eq(first, {'code': 'NOT_FOUND'})
second = await create_detail_loader(fetch_meta_error, fetch_stats, fetch_permission, timeout_ms=100)('l1')
assert_eq(second, {'code': 'UPSTREAM'})`
      },
      {
        name: '总超时保留已完成字段、忽略迟到结果，meta 未完成返回 UPSTREAM',
        code: `release_stats = asyncio.get_running_loop().create_future()

async def fetch_meta_ok(link_id):
    return {'id': link_id}
async def fetch_stats_pending(link_id):
    return await release_stats
async def fetch_permission(link_id):
    return True

loader = create_detail_loader(fetch_meta_ok, fetch_stats_pending, fetch_permission, timeout_ms=30)
first = await loader('l1')
assert_eq(first['degraded'], ['stats'])
assert_eq(first['stats'], None)
if not release_stats.done():
    release_stats.set_result({'clicks': 99})
await asyncio.sleep(0)
assert_eq(first['stats'], None)

async def fetch_meta_pending(link_id):
    await asyncio.Event().wait()

loader2 = create_detail_loader(fetch_meta_pending, fetch_meta_ok, fetch_permission, timeout_ms=20)
second = await loader2('l2')
assert_eq(second, {'code': 'UPSTREAM'})`
      }
    ]
  },
  'm3-render-ex-1': {
    starter: `import math

def choose_render_strategy(page=None):
    page = page or {}
    if page.get('seo') is True:
        return 'ssg'
    return 'csr'

def check_budget(samples, budget):
    violations = []
    for metric in ['lcp', 'inp', 'cls']:
        values = samples.get(metric) or []
        average = sum(values) / (len(values) or 1)
        if budget.get(metric) is not None and average > budget[metric]:
            violations.append({
                'metric': metric,
                'p75': average,
                'budget': budget[metric],
                'ratio': 0,
            })
    return {'pass': not violations, 'violations': violations}
`,
    solution: `import math

def choose_render_strategy(page=None):
    page = page or {}
    personalization = page.get('personalization', 'none')
    freshness = page.get('freshnessSec', float('inf'))
    if personalization == 'high':
        return 'stream'
    if page.get('seo') is True and freshness <= 60:
        return 'ssr'
    if page.get('seo') is True:
        return 'ssg'
    if page.get('requiresAuth') is True:
        return 'csr'
    return 'csr'

def percentile75(values):
    if not values:
        return None
    ordered = sorted(values)
    return ordered[math.ceil(0.75 * len(ordered)) - 1]

def check_budget(samples, budget):
    order = ['lcp', 'inp', 'cls']
    violations = []
    for metric in order:
        if budget.get(metric) is None:
            continue
        value = percentile75(samples.get(metric) or [])
        if value is None:
            violations.append({
                'metric': metric,
                'p75': None,
                'budget': budget[metric],
                'ratio': None,
                'reason': 'NO_DATA',
            })
            continue
        if value > budget[metric]:
            violations.append({
                'metric': metric,
                'p75': value,
                'budget': budget[metric],
                'ratio': (value - budget[metric]) / budget[metric],
            })
    rank = {'lcp': 0, 'inp': 1, 'cls': 2}
    violations.sort(key=lambda item: (
        -1 if item['ratio'] is None else item['ratio'],
        -rank[item['metric']],
    ), reverse=True)
    return {'pass': not violations, 'violations': violations}
`,
    tests: [
      {
        name: '营销页走 SSG',
        code: `strategy = choose_render_strategy({'seo': True, 'personalization': 'none', 'freshnessSec': 86400})
assert_eq(strategy, 'ssg')`
      },
      {
        name: '高个性化看板即使 SEO 也走流式',
        code: `strategy = choose_render_strategy({'seo': True, 'personalization': 'high', 'freshnessSec': 10})
assert_eq(strategy, 'stream')`
      },
      {
        name: '登录工具页走 CSR',
        code: `strategy = choose_render_strategy({'requiresAuth': True, 'seo': False, 'interactivity': True})
assert_eq(strategy, 'csr')`
      },
      {
        name: 'SEO 且要求新鲜走 SSR',
        code: `assert_eq(choose_render_strategy({'seo': True, 'freshnessSec': 30}), 'ssr')
assert_eq(choose_render_strategy({}), 'csr')`
      },
      {
        name: '全部指标达标时通过',
        code: `result = check_budget(
    {'lcp': [2000, 2100, 2200, 2300], 'inp': [100, 120, 150, 180], 'cls': [0.05, 0.08, 0.09, 0.1]},
    {'lcp': 2500, 'inp': 200, 'cls': 0.1},
)
assert_eq(result['pass'], True)
assert_eq(result['violations'], [])`
      },
      {
        name: 'p75 使用最近秩且等于预算时通过',
        code: `at_limit = check_budget({'lcp': [2000, 2500, 2500, 2500]}, {'lcp': 2500})
assert_eq(at_limit['pass'], True)
skewed = check_budget({'lcp': [1000, 1000, 5000, 5000]}, {'lcp': 4000})
assert_eq(skewed['pass'], False)
assert_eq(skewed['violations'][0]['p75'], 5000)
assert_eq(skewed['violations'][0]['ratio'], 0.25)`
      },
      {
        name: '空样本与缺失样本标记 NO_DATA 并失败',
        code: `empty = check_budget({'lcp': []}, {'lcp': 2500})
assert_eq(empty['pass'], False)
assert_eq(empty['violations'][0], {
    'metric': 'lcp',
    'p75': None,
    'budget': 2500,
    'ratio': None,
    'reason': 'NO_DATA',
})
missing = check_budget({}, {'inp': 200})
assert_eq(missing['pass'], False)
assert_eq(missing['violations'][0]['metric'], 'inp')`
      },
      {
        name: '多违规按 ratio 降序且同 ratio 顺序稳定',
        code: `result = check_budget(
    {'lcp': [3000], 'inp': [400], 'cls': [0.2]},
    {'lcp': 2500, 'inp': 200, 'cls': 0.1},
)
assert_eq(result['pass'], False)
assert_eq([item['metric'] for item in result['violations']], ['inp', 'cls', 'lcp'])
assert_eq(result['violations'][0]['ratio'], 1)
assert_eq(result['violations'][1]['ratio'], 1)
assert_eq(abs(result['violations'][2]['ratio'] - 0.2) < 1e-9, True)`
      }
    ]
  },
  'm3-realtime-ex-1': {
    starter: `def plan_reconnect(attempt, options=None):
    return {'delayMs': 100 * attempt, 'exhausted': False}

def apply_live_event(state, event):
    state['total'] += event['delta']
    state['perLink'][event['linkId']] = state['perLink'].get(event['linkId'], 0) + event['delta']
    state['seenIds'].append(event['id'])
    state['lastEventId'] = event['id']
    state['lastSeq'] = event['seq']
    return state
`,
    solution: `import random as _random

def plan_reconnect(attempt, options=None):
    options = options or {}
    base_ms = options.get('baseMs', 100)
    max_ms = options.get('maxMs', 1600)
    jitter = options.get('jitter', 0.2)
    max_attempts = options.get('maxAttempts', 5)
    rand = options.get('random') or _random.random

    if attempt >= max_attempts:
        return {'delayMs': 0, 'exhausted': True}
    raw = min(base_ms * (2 ** attempt), max_ms)
    factor = 1 - jitter + 2 * jitter * rand()
    return {'delayMs': round(raw * factor), 'exhausted': False}

def apply_live_event(state, event):
    next_state = {
        'total': state.get('total') or 0,
        'perLink': dict(state.get('perLink') or {}),
        'seenIds': list(state.get('seenIds') or []),
        'lastEventId': state['lastEventId'] if 'lastEventId' in state else None,
        'lastSeq': state['lastSeq'] if 'lastSeq' in state else 0,
        'gap': state.get('gap') is True,
    }
    if not event or not event.get('id'):
        return next_state
    if event['id'] in next_state['seenIds']:
        return next_state

    next_state['seenIds'].append(event['id'])
    next_state['total'] += event['delta']
    link_id = event['linkId']
    next_state['perLink'][link_id] = next_state['perLink'].get(link_id, 0) + event['delta']

    if event['seq'] > next_state['lastSeq'] + 1:
        next_state['gap'] = True
    if event['seq'] >= next_state['lastSeq']:
        next_state['lastSeq'] = event['seq']
        next_state['lastEventId'] = event['id']
    return next_state
`,
    tests: [
      {
        name: '指数退避序列按基数增长',
        code: `first = plan_reconnect(0, {'jitter': 0, 'random': lambda: 0.5})
second = plan_reconnect(1, {'jitter': 0, 'random': lambda: 0.5})
third = plan_reconnect(2, {'jitter': 0, 'random': lambda: 0.5})
assert_eq(first['delayMs'], 100)
assert_eq(second['delayMs'], 200)
assert_eq(third['delayMs'], 400)
assert_eq(first['exhausted'], False)`
      },
      {
        name: '退避封顶在 maxMs',
        code: `capped = plan_reconnect(4, {'baseMs': 100, 'maxMs': 400, 'jitter': 0})
assert_eq(capped['delayMs'], 400)
assert_eq(capped['exhausted'], False)
near = plan_reconnect(3, {'baseMs': 100, 'maxMs': 1600, 'jitter': 0})
assert_eq(near['delayMs'], 800)`
      },
      {
        name: 'jitter 在上下界内且可复现',
        code: `low = plan_reconnect(0, {'jitter': 0.2, 'random': lambda: 0})
high = plan_reconnect(0, {'jitter': 0.2, 'random': lambda: 1})
assert_eq(low['delayMs'], 80)
assert_eq(high['delayMs'], 120)`
      },
      {
        name: '重试耗尽标记 exhausted',
        code: `last = plan_reconnect(4, {'jitter': 0})
assert_eq(last['exhausted'], False)
exhausted = plan_reconnect(5, {'jitter': 0})
assert_eq(exhausted, {'delayMs': 0, 'exhausted': True})
custom = plan_reconnect(2, {'maxAttempts': 2})
assert_eq(custom, {'delayMs': 0, 'exhausted': True})`
      },
      {
        name: '重复事件只累加一次',
        code: `state = {'total': 0, 'perLink': {}, 'seenIds': [], 'lastEventId': None, 'lastSeq': 0}
once = apply_live_event(state, {'id': 'e1', 'linkId': 'a', 'delta': 2, 'seq': 1})
twice = apply_live_event(once, {'id': 'e1', 'linkId': 'a', 'delta': 2, 'seq': 1})
assert_eq(twice['total'], 2)
assert_eq(twice['perLink']['a'], 2)
assert_eq(len(twice['seenIds']), 1)`
      },
      {
        name: '两个链接独立累加',
        code: `state = {'total': 0, 'perLink': {}, 'seenIds': [], 'lastEventId': None, 'lastSeq': 0}
state = apply_live_event(state, {'id': 'e1', 'linkId': 'a', 'delta': 1, 'seq': 1})
state = apply_live_event(state, {'id': 'e2', 'linkId': 'b', 'delta': 5, 'seq': 2})
state = apply_live_event(state, {'id': 'e3', 'linkId': 'a', 'delta': 2, 'seq': 3})
assert_eq(state['total'], 8)
assert_eq(state['perLink']['a'], 3)
assert_eq(state['perLink']['b'], 5)`
      },
      {
        name: '乱序事件按 id 去重后仍只累加一次',
        code: `state = {'total': 0, 'perLink': {}, 'seenIds': [], 'lastEventId': None, 'lastSeq': 0}
state = apply_live_event(state, {'id': 'e2', 'linkId': 'a', 'delta': 2, 'seq': 2})
state = apply_live_event(state, {'id': 'e1', 'linkId': 'a', 'delta': 1, 'seq': 1})
assert_eq(state['total'], 3)
assert_eq(state['perLink']['a'], 3)
assert_eq(len(state['seenIds']), 2)
assert_eq(state['lastEventId'], 'e2')
assert_eq(state['lastSeq'], 2)
assert_eq(state['gap'], True)`
      },
      {
        name: 'seq 缺口标记且连续序列不标记',
        code: `base = {'total': 0, 'perLink': {}, 'seenIds': [], 'lastEventId': None, 'lastSeq': 0}
first = apply_live_event(base, {'id': 'e1', 'linkId': 'a', 'delta': 1, 'seq': 1})
second = apply_live_event(first, {'id': 'e2', 'linkId': 'a', 'delta': 1, 'seq': 2})
assert_eq(second['gap'], False)
jumped = apply_live_event(second, {'id': 'e4', 'linkId': 'a', 'delta': 1, 'seq': 4})
assert_eq(jumped['gap'], True)
continued = apply_live_event(jumped, {'id': 'e5', 'linkId': 'a', 'delta': 1, 'seq': 5})
assert_eq(continued['gap'], True)
assert_eq(continued['total'], 4)`
      },
      {
        name: '不修改入参且更新最后事件',
        code: `state = {'total': 5, 'perLink': {'a': 5}, 'seenIds': ['x'], 'lastEventId': 'x', 'lastSeq': 2}
snapshot = dict(state)
snapshot['perLink'] = dict(state['perLink'])
snapshot['seenIds'] = list(state['seenIds'])
next_state = apply_live_event(state, {'id': 'y', 'linkId': 'a', 'delta': 2, 'seq': 3})
assert_eq(state, snapshot)
assert_eq(next_state['total'], 7)
assert_eq(next_state['perLink']['a'], 7)
assert_eq(next_state['lastEventId'], 'y')
assert_eq(next_state['lastSeq'], 3)
assert_eq(len(next_state['seenIds']), 2)`
      }
    ]
  },
  'm3-edge-ex-1': {
    starter: `import asyncio

def create_edge_cache(ttl_ms, swr_ms, now, load, on_refresh_error=None):
    cache = {}

    async def get(key, bypass=False):
        value = await load(key)
        cache[key] = {'value': value, 'storedAt': now()}
        return {'value': value, 'state': 'miss'}

    async def when_idle():
        return None

    return {'get': get, 'whenIdle': when_idle}

def join_trace(rum=None, server=None):
    spans = (server or {}).get('spans') or []
    return {
        'traceId': (rum or {}).get('traceId'),
        'totalMs': spans[-1]['startMs'] if spans else None,
        'segments': [
            {'name': span['name'], 'startMs': span['startMs'], 'endMs': span['startMs'], 'durationMs': span['durationMs']}
            for span in spans
        ],
        'largestGap': 0,
        'incomplete': False,
    }
`,
    solution: `import asyncio

def create_edge_cache(ttl_ms, swr_ms, now, load, on_refresh_error=None):
    cache = {}
    refreshing = {}

    async def refresh(key):
        try:
            value = await load(key)
            cache[key] = {'value': value, 'storedAt': now()}
        except Exception as error:
            if on_refresh_error:
                on_refresh_error(error, key)
        finally:
            refreshing.pop(key, None)

    async def get(key, bypass=False):
        entry = cache.get(key)
        if not bypass and entry:
            age = now() - entry['storedAt']
            if age <= ttl_ms:
                return {'value': entry['value'], 'state': 'fresh'}
            if age <= ttl_ms + swr_ms:
                if key not in refreshing:
                    refreshing[key] = asyncio.create_task(refresh(key))
                return {'value': entry['value'], 'state': 'stale'}
        value = await load(key)
        cache[key] = {'value': value, 'storedAt': now()}
        return {'value': value, 'state': 'bypass' if bypass else 'miss'}

    async def when_idle():
        while refreshing:
            await asyncio.gather(*list(refreshing.values()))

    return {'get': get, 'whenIdle': when_idle}

def join_trace(rum=None, server=None):
    rum = rum or {}
    server = server or {}
    trace_id = server.get('traceId') or rum.get('traceId')
    spans = [span for span in (server.get('spans') or []) if span]

    if not rum.get('traceId') or not server.get('traceId'):
        return {'traceId': trace_id, 'totalMs': None, 'segments': [], 'largestGap': None, 'incomplete': True}
    if rum['traceId'] != server['traceId'] or not spans:
        return {'traceId': trace_id, 'totalMs': None, 'segments': [], 'largestGap': None, 'incomplete': True}

    ordered = sorted(spans, key=lambda span: span['startMs'])
    segments = [
        {
            'name': span['name'],
            'startMs': span['startMs'],
            'endMs': span['startMs'] + span['durationMs'],
            'durationMs': span['durationMs'],
        }
        for span in ordered
    ]
    last_end = segments[-1]['endMs']
    end = max(last_end, rum.get('lcpMs') or 0)
    gaps = [segments[0]['startMs']]
    for previous, current in zip(segments, segments[1:]):
        gaps.append(max(0, current['startMs'] - previous['endMs']))
    gaps.append(max(0, end - last_end))
    return {
        'traceId': trace_id,
        'totalMs': end,
        'segments': segments,
        'largestGap': max(gaps),
        'incomplete': False,
    }
`,
    tests: [
      {
        name: '新鲜命中不回源',
        code: `clock = {'now': 0}
calls = []
async def load(key):
    calls.append(key)
    return 'v' + str(len(calls))
cache = create_edge_cache(ttl_ms=100, swr_ms=500, now=lambda: clock['now'], load=load)
first = await cache['get']('a')
assert_eq(first, {'value': 'v1', 'state': 'miss'})
clock['now'] = 50
second = await cache['get']('a')
assert_eq(second, {'value': 'v1', 'state': 'fresh'})
assert_eq(calls, ['a'])`
      },
      {
        name: 'SWR 先返回旧值再后台刷新',
        code: `clock = {'now': 0}
calls = []
gate = asyncio.get_running_loop().create_future()
async def load(key):
    calls.append(key)
    if len(calls) == 1:
        return 'v1'
    return await gate
cache = create_edge_cache(ttl_ms=100, swr_ms=500, now=lambda: clock['now'], load=load)
await cache['get']('a')
clock['now'] = 150
stale = await cache['get']('a')
assert_eq(stale, {'value': 'v1', 'state': 'stale'})
if not gate.done():
    gate.set_result('v2')
await cache['whenIdle']()
assert_eq(len(calls), 2)
fresh = await cache['get']('a')
assert_eq(fresh, {'value': 'v2', 'state': 'fresh'})`
      },
      {
        name: '同一 key 的刷新单飞',
        code: `clock = {'now': 0}
calls = []
gate = asyncio.get_running_loop().create_future()
async def load(key):
    calls.append(key)
    if len(calls) == 1:
        return 'v1'
    return await gate
cache = create_edge_cache(ttl_ms=100, swr_ms=500, now=lambda: clock['now'], load=load)
await cache['get']('a')
clock['now'] = 150
first = await cache['get']('a')
second = await cache['get']('a')
assert_eq(first, {'value': 'v1', 'state': 'stale'})
assert_eq(second, {'value': 'v1', 'state': 'stale'})
if not gate.done():
    gate.set_result('v2')
await cache['whenIdle']()
assert_eq(calls, ['a', 'a'])
fresh = await cache['get']('a')
assert_eq(fresh['value'], 'v2')`
      },
      {
        name: '超过 SWR 窗口回源 miss',
        code: `clock = {'now': 0}
calls = []
async def load(key):
    calls.append(key)
    return 'v' + str(len(calls))
cache = create_edge_cache(ttl_ms=100, swr_ms=200, now=lambda: clock['now'], load=load)
first = await cache['get']('a')
assert_eq(first['state'], 'miss')
clock['now'] = 301
second = await cache['get']('a')
assert_eq(second, {'value': 'v2', 'state': 'miss'})
assert_eq(len(calls), 2)
third = await cache['get']('a')
assert_eq(third['state'], 'fresh')`
      },
      {
        name: 'bypass 强制回源并更新缓存',
        code: `clock = {'now': 0}
calls = []
async def load(key):
    calls.append(key)
    return 'v' + str(len(calls))
cache = create_edge_cache(ttl_ms=1000, swr_ms=1000, now=lambda: clock['now'], load=load)
await cache['get']('a')
bypassed = await cache['get']('a', bypass=True)
assert_eq(bypassed, {'value': 'v2', 'state': 'bypass'})
after = await cache['get']('a')
assert_eq(after, {'value': 'v2', 'state': 'fresh'})
assert_eq(len(calls), 2)`
      },
      {
        name: '刷新失败保留旧值且可重试',
        code: `clock = {'now': 0}
calls = []
failure = {'on': False}
errors = []
async def load(key):
    calls.append(key)
    if failure['on']:
        raise RuntimeError('refresh down')
    return 'v' + str(len(calls))
cache = create_edge_cache(
    ttl_ms=100,
    swr_ms=1000,
    now=lambda: clock['now'],
    load=load,
    on_refresh_error=lambda error, key: errors.append(key + ':' + str(error)),
)
await cache['get']('a')
clock['now'] = 150
failure['on'] = True
stale = await cache['get']('a')
assert_eq(stale, {'value': 'v1', 'state': 'stale'})
await cache['whenIdle']()
assert_eq(errors, ['a:refresh down'])
failure['on'] = False
again = await cache['get']('a')
assert_eq(again['value'], 'v1')
await cache['whenIdle']()
fresh = await cache['get']('a')
assert_eq(fresh, {'value': 'v3', 'state': 'fresh'})
assert_eq(len(calls), 3)`
      },
      {
        name: 'trace 正常合并与总时长（跨层）',
        code: `result = join_trace(
    {'traceId': 't1', 'lcpMs': 4200, 'marks': {'fcp': 900}},
    {
        'traceId': 't1',
        'spans': [
            {'name': 'db', 'startMs': 800, 'durationMs': 400},
            {'name': 'bff', 'startMs': 200, 'durationMs': 500},
            {'name': 'edge', 'startMs': 0, 'durationMs': 100},
        ],
    },
)
assert_eq(result['incomplete'], False)
assert_eq(result['traceId'], 't1')
assert_eq(result['totalMs'], 4200)
assert_eq([span['name'] for span in result['segments']], ['edge', 'bff', 'db'])
assert_eq(result['segments'][0]['endMs'], 100)
assert_eq(result['largestGap'], 3000)`
      },
      {
        name: 'trace 缺失或不匹配标记 incomplete',
        code: `mismatch = join_trace(
    {'traceId': 'a', 'lcpMs': 1200},
    {'traceId': 'b', 'spans': [{'name': 'bff', 'startMs': 0, 'durationMs': 100}]},
)
assert_eq(mismatch['incomplete'], True)
assert_eq(mismatch['totalMs'], None)
assert_eq(mismatch['segments'], [])
assert_eq(mismatch['largestGap'], None)
empty = join_trace({'traceId': 'a', 'lcpMs': 1200}, {'traceId': 'a', 'spans': []})
assert_eq(empty['incomplete'], True)
missing = join_trace({}, {'spans': []})
assert_eq(missing['incomplete'], True)`
      },
      {
        name: 'span 乱序按开始时间排序',
        code: `result = join_trace(
    {'traceId': 't2', 'lcpMs': 1800},
    {
        'traceId': 't2',
        'spans': [
            {'name': 'db', 'startMs': 600, 'durationMs': 300},
            {'name': 'edge', 'startMs': 0, 'durationMs': 200},
            {'name': 'bff', 'startMs': 300, 'durationMs': 250},
        ],
    },
)
assert_eq([span['startMs'] for span in result['segments']], [0, 300, 600])
assert_eq([span['endMs'] for span in result['segments']], [200, 550, 900])
assert_eq(result['totalMs'], 1800)
assert_eq(result['largestGap'], 900)`
      }
    ]
  }
} satisfies PythonTrackMap;
