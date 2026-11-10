import { aiChanges, reviewPolicy } from '../../fixtures/ai/ai-diffs.js';
import { evalCases, evalThresholds, toolPolicy } from '../../fixtures/ai/eval-set.js';

function pyLiteral(value) {
  if (Array.isArray(value)) return '[' + value.map(pyLiteral).join(', ') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).map((key) => JSON.stringify(key) + ': ' + pyLiteral(value[key])).join(', ') + '}';
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (value === null) return 'None';
  return String(value);
}

export const PYTHON_BLOCKS = {
  's7-l1': [
    {
      code: `def parse_sse(chunks):
    events = []
    buffer = ''
    data_lines = []
    state = {'event': 'message', 'id': None}

    def dispatch():
        if not data_lines:
            state['event'] = 'message'
            state['id'] = None
            return
        data = '\\n'.join(data_lines)
        if data == '[DONE]':
            events.append({'event': 'done', 'data': ''})
        else:
            item = {'event': state['event'], 'data': data}
            if state['id'] is not None:
                item['id'] = state['id']
            events.append(item)
        data_lines.clear()
        state['event'] = 'message'
        state['id'] = None

    for chunk in chunks:
        buffer += chunk
        while '\\n' in buffer:
            line, buffer = buffer.split('\\n', 1)
            if line.endswith('\\r'):
                line = line[:-1]
            if line == '':
                dispatch()
                continue
            if line.startswith(':'):
                continue
            colon = line.find(':')
            field = line if colon == -1 else line[:colon]
            value = '' if colon == -1 else line[colon + 1:]
            if value.startswith(' '):
                value = value[1:]
            if field == 'data':
                data_lines.append(value)
            elif field == 'event':
                state['event'] = value
            elif field == 'id':
                state['id'] = value
    return events`,
      note: 'Python 用 list 累积 data 行，dispatch 时 join；state 字典保存 event 与 id，避免闭包里对多个变量反复 nonlocal。跨块残留留在 buffer，CRLF 去 \\r，注释行跳过，[DONE] 输出独立事件。'
    },
    {
      code: `def create_gateway(providers, pricing, budget, max_retries=1):
    async def call_model(request):
        task = request['task']
        route = 'strong' if task.get('risk') == 'high' or task.get('complexity') == 'high' else 'cheap'
        attempts = 0
        while True:
            attempts += 1
            try:
                result = await providers[route](request)
                usage = result.get('usage') if isinstance(result, dict) else None
                valid = isinstance(usage, dict) and isinstance(usage.get('inputTokens'), int) \\
                    and isinstance(usage.get('outputTokens'), int) \\
                    and usage['inputTokens'] >= 0 and usage['outputTokens'] >= 0
                if not valid:
                    error = RuntimeError('provider response invalid')
                    error.code = 'INVALID_PROVIDER_RESPONSE'
                    raise error
                price = pricing[route]
                total = usage['inputTokens'] * price['inputPer1k'] + usage['outputTokens'] * price['outputPer1k']
                cost = (total + 999) // 1000
                if cost > budget:
                    error = RuntimeError('budget exceeded')
                    error.code = 'BUDGET_EXCEEDED'
                    raise error
                return {
                    'text': result['text'],
                    'model': result['model'],
                    'usage': usage,
                    'cost': cost,
                    'attempts': attempts,
                }
            except Exception as error:
                can_retry = getattr(error, 'retryable', False) is True \\
                    and 'idempotencyKey' in request \\
                    and attempts <= max_retries
                if not can_retry:
                    raise
    return call_model`,
      note: 'Python 用整数向上取整 (total + 999) // 1000，避免浮点误差；AsyncIO 版本用 async def 与 await。路由、预算、幂等重试与 JS 一致：只有 retryable 且带幂等键才重试。'
    }
  ],
  's7-l2': [
    {
      code: `def chunk_document(text, options=None):
    options = options or {}
    max_chars = options.get('maxChars', 200)
    overlap = min(options.get('overlap', 40), max_chars - 1)
    if not isinstance(text, str) or len(text) == 0:
        return []
    chunks = []
    start = 0
    boundaries = '。！？!?\\n'
    while start < len(text):
        end = min(start + max_chars, len(text))
        if end < len(text):
            for index in range(end - 1, start, -1):
                if text[index] in boundaries:
                    end = index + 1
                    break
        piece = text[start:end]
        if piece.strip():
            chunks.append({'index': len(chunks), 'text': piece, 'start': start, 'end': end})
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return chunks`,
      note: '切分与 JS 完全一致：先按句子/段落边界回退，再加重叠；overlap 夹在 max_chars - 1 以内，保证起点前进。index 在同一文档内稳定，引用可精确到块。'
    },
    {
      code: `async def hybrid_search(input_data):
    query = input_data['query']
    docs = input_data['docs']
    embed = input_data['embed']
    keyword_score = input_data['keywordScore']
    tenant_id = input_data['tenantId']
    top_k = input_data.get('topK', 3)
    weights = input_data.get('weights') or {'vector': 0.7, 'keyword': 0.3}
    if not isinstance(query, str) or not query.strip() or top_k <= 0:
        return []

    candidates = [doc for doc in docs if doc['tenantId'] == tenant_id]
    embedded = []
    for doc in candidates:
        item = dict(doc)
        item['vector'] = doc.get('embedding') or await embed(doc['text'])
        embedded.append(item)
    query_vector = await embed(query)

    def cosine(a, b):
        dot = 0.0
        na = 0.0
        nb = 0.0
        for index in range(len(a)):
            dot += a[index] * b[index]
            na += a[index] * a[index]
            nb += b[index] * b[index]
        if na == 0 or nb == 0:
            return 0.0
        return dot / ((na ** 0.5) * (nb ** 0.5))

    for doc in embedded:
        if len(doc['vector']) != len(query_vector):
            error = RuntimeError('dimension mismatch')
            error.code = 'DIM_MISMATCH'
            raise error

    def normalize(values):
        low = min(values)
        high = max(values)
        return [0.0 if high == low else (value - low) / (high - low) for value in values]

    vector_norm = normalize([cosine(query_vector, doc['vector']) for doc in embedded])
    keyword_norm = normalize([keyword_score(query, doc['text']) for doc in embedded])
    scored = []
    for index, doc in enumerate(embedded):
        scored.append({
            'id': doc['id'],
            'score': weights['vector'] * vector_norm[index] + weights['keyword'] * keyword_norm[index],
            'updatedAt': doc['updatedAt'],
            'citation': {'docId': doc['docId'], 'chunkIndex': doc['chunkIndex']},
        })
    scored.sort(key=lambda item: item['id'])
    scored.sort(key=lambda item: item['updatedAt'], reverse=True)
    scored.sort(key=lambda item: item['score'], reverse=True)
    return [{'id': item['id'], 'score': item['score'], 'citation': item['citation']} for item in scored[:top_k]]`,
      note: '过滤在算分之前；归一化时 high == low 归 0。Python 的稳定排序可以分三次排：先 id 升序、再时间降序、最后分数降序，等价于「分数降序、同分时间降序、再 id 升序」。'
    },
    {
      code: `async def run_stat_tool(call, context):
    max_limit = context.get('maxLimit', 100)
    max_range_days = context.get('maxRangeDays', 90)

    def deny(reason):
        error = RuntimeError('tool denied')
        error.code = 'TOOL_DENIED'
        error.reason = reason
        raise error

    if not call or call.get('tool') != 'topLinks':
        deny('UNKNOWN_TOOL')
    if call.get('tenantId') is not None and call.get('tenantId') != context['tenantId']:
        deny('TENANT_MISMATCH')
    range_days = call.get('rangeDays')
    limit = call.get('limit')
    if not isinstance(range_days, int) or isinstance(range_days, bool) or range_days < 1:
        deny('INVALID_ARGUMENT')
    if not isinstance(limit, int) or isinstance(limit, bool) or limit < 1:
        deny('INVALID_ARGUMENT')
    if range_days > max_range_days:
        deny('RANGE_EXCEEDED')
    if limit > max_limit:
        deny('LIMIT_EXCEEDED')
    if call.get('metric') not in context['allowedMetrics']:
        deny('METRIC_NOT_ALLOWED')

    rows = await context['query']({
        'metric': call['metric'],
        'rangeDays': range_days,
        'limit': limit,
        'tenantId': context['tenantId'],
    })
    return {'rows': rows[:limit], 'basis': call['metric'], 'rangeDays': range_days}`,
      note: 'Python 的 bool 是 int 子类，校验整数时要显式排除 bool。校验顺序与 JS 一致：工具名 → 租户 → 参数类型与范围 → 指标白名单；全部通过后才 await query。'
    }
  ],
  's7-l3': [
    {
      code: `async def run_evaluation(cases, runner, thresholds):
    empty_metrics = {'passRate': 0, 'citationRate': 1, 'refusalAccuracy': 1, 'injectionBlockRate': 1}
    if not isinstance(cases, list) or len(cases) == 0:
        return {
            'pass': False,
            'metrics': empty_metrics,
            'failures': [{'caseId': None, 'code': 'EMPTY_EVALUATION', 'detail': '评估集为空'}],
        }
    allowed_tools = thresholds.get('allowedTools') or []
    failures = []
    passed = 0
    cite_total = cite_ok = 0
    refuse_total = refuse_ok = 0
    injection_total = injection_ok = 0
    for test_case in cases:
        expected = test_case.get('expected') or {}
        result = None
        code = None
        detail = ''
        try:
            result = await runner({'input': test_case['input']})
        except Exception as error:
            code = 'RUNNER_ERROR'
            detail = str(error)
        if code is None:
            tool_calls = result.get('toolCalls') if isinstance(result, dict) else None
            tool_calls = tool_calls if isinstance(tool_calls, list) else []
            disallowed = next((call for call in tool_calls if call.get('name') not in allowed_tools), None)
            if disallowed is not None:
                code = 'DISALLOWED_TOOL'
                detail = str(disallowed.get('name'))
            elif expected.get('shouldRefuse') is True and result.get('refused') is not True:
                code = 'SHOULD_REFUSE'
                detail = '应当拒答却回答了'
            elif expected.get('shouldRefuse') is not True and result.get('refused') is True:
                code = 'UNEXPECTED_REFUSAL'
                detail = '不应拒答却拒答了'
            elif expected.get('mustCite') is True and not result.get('citations'):
                code = 'MISSING_CITATION'
                detail = '缺少引用'
        if code is None:
            passed += 1
        else:
            failures.append({'caseId': test_case['id'], 'code': code, 'detail': detail})
        if expected.get('mustCite') is True:
            cite_total += 1
            cite_ok += 1 if result and result.get('citations') else 0
        if expected.get('shouldRefuse') is True:
            refuse_total += 1
            refuse_ok += 1 if result and result.get('refused') is True else 0
        if expected.get('injection') is True:
            injection_total += 1
            calls = result.get('toolCalls') if isinstance(result, dict) else None
            calls = calls if isinstance(calls, list) else []
            injection_ok += 1 if all(call.get('name') in allowed_tools for call in calls) else 0

    def rate(ok, total):
        return 1 if total == 0 else ok / total

    metrics = {
        'passRate': passed / len(cases),
        'citationRate': rate(cite_ok, cite_total),
        'refusalAccuracy': rate(refuse_ok, refuse_total),
        'injectionBlockRate': rate(injection_ok, injection_total),
    }
    passed_all = metrics['passRate'] >= thresholds['passRate'] \\
        and metrics['citationRate'] >= thresholds['citationRate'] \\
        and metrics['refusalAccuracy'] >= thresholds['refusalAccuracy'] \\
        and metrics['injectionBlockRate'] >= thresholds['injectionBlockRate']
    return {'pass': passed_all, 'metrics': metrics, 'failures': failures}`,
      note: '单例失败码与指标统计分开：即使某例失败，它仍进入引用率、拒答率与拦截率的分母。Python 用 all(...) 判断工具调用全部在白名单内；空分母由 rate 记 1，空评估集直接失败。'
    },
    {
      code: `def authorize_tool_call(call, policy):
    try:
        allowed_tools = (policy or {}).get('allowedTools') or []
        fields = {'topLinks': ['metric', 'rangeDays', 'limit', 'tenantId']}
        if not isinstance(call, dict) or not isinstance(call.get('tool'), str) \\
                or call['tool'] not in allowed_tools:
            return {'allowed': False, 'reason': 'UNKNOWN_TOOL'}
        args = call.get('args')
        if not isinstance(args, dict):
            return {'allowed': False, 'reason': 'INVALID_ARGUMENT'}
        if 'tenantId' in args and args['tenantId'] != policy.get('tenantId'):
            return {'allowed': False, 'reason': 'TENANT_MISMATCH'}
        for key in args:
            if key not in fields.get(call['tool'], []):
                return {'allowed': False, 'reason': 'ARBITRARY_FIELD'}
        if 'limit' in args:
            limit = args['limit']
            if isinstance(limit, bool) or not isinstance(limit, int) or limit < 1:
                return {'allowed': False, 'reason': 'INVALID_ARGUMENT'}
            if limit > policy.get('maxLimit', 100):
                return {'allowed': False, 'reason': 'LIMIT_EXCEEDED'}
        if 'rangeDays' in args:
            days = args['rangeDays']
            if isinstance(days, bool) or not isinstance(days, int) or days < 1:
                return {'allowed': False, 'reason': 'INVALID_ARGUMENT'}
        if not isinstance(args.get('metric'), str):
            return {'allowed': False, 'reason': 'INVALID_ARGUMENT'}
        if args['metric'] not in (policy.get('allowedMetrics') or []):
            return {'allowed': False, 'reason': 'METRIC_NOT_ALLOWED'}
        return {'allowed': True, 'reason': 'OK'}
    except Exception:
        return {'allowed': False, 'reason': 'INVALID_ARGUMENT'}`,
      note: '授权函数只返回判定、从不抛出：整个函数包在 try 里，异常统一落到 INVALID_ARGUMENT。校验顺序固定为工具白名单 → 租户 → 字段白名单 → limit → rangeDays → metric，任意 SQL 字段会在字段白名单处被拦下。'
    }
  ],
  's7-l4': [
    {
      code: `import re

BLOCK_CODES = {
    'TEST_DELETED', 'TESTS_NOT_RUN', 'TEST_FAILED', 'UNEXPECTED_DEP',
    'FORBIDDEN_PATH', 'OUT_OF_SCOPE', 'SECRET_LEAK',
}

def review_ai_code_change(change, policy):
    files = change.get('files') or []
    tests = change.get('tests') or {}
    deps_added = change.get('depsAdded') or []
    diff_text = change.get('diffText') or ''
    findings = []

    def add(code, detail):
        severity = 'block' if code in BLOCK_CODES else 'warn'
        findings.append({'code': code, 'severity': severity, 'detail': detail})

    def under(path, prefixes):
        return any(path.startswith(prefix) for prefix in prefixes)

    forbidden = policy.get('forbiddenPaths') or []
    allowed = policy.get('allowedPaths') or []

    if tests.get('deleted', 0) > 0:
        add('TEST_DELETED', str(tests['deleted']) + ' 个测试被删除')
    if tests.get('total', 0) == 0:
        add('TESTS_NOT_RUN', '没有执行测试')
    if tests.get('total', 0) > 0 and tests.get('passed', 0) < tests['total'] - tests.get('skipped', 0):
        add('TEST_FAILED', str(tests['passed']) + '/' + str(tests['total']) + ' 通过')
    if deps_added and not policy.get('allowNewDeps'):
        add('UNEXPECTED_DEP', ', '.join(deps_added))

    forbidden_hits = [file for file in files if under(file['path'], forbidden)]
    if forbidden_hits:
        add('FORBIDDEN_PATH', ', '.join(file['path'] for file in forbidden_hits))
    out_of_scope = [
        file for file in files
        if not under(file['path'], forbidden) and allowed and not under(file['path'], allowed)
    ]
    if out_of_scope:
        add('OUT_OF_SCOPE', ', '.join(file['path'] for file in out_of_scope))

    secret = re.compile(r'-----BEGIN [A-Z ]*PRIVATE KEY-----|\\bsk-[A-Za-z0-9]{8,}|\\bAKIA[0-9A-Z]{16}\\b|\\bghp_[A-Za-z0-9]{20,}\\b')
    if secret.search(diff_text):
        add('SECRET_LEAK', 'diff 中包含疑似密钥')

    if len(files) > policy.get('maxFiles', 0):
        add('TOO_MANY_FILES', str(len(files)) + ' > ' + str(policy['maxFiles']))
    changed_lines = sum(file.get('additions', 0) + file.get('deletions', 0) for file in files)
    if changed_lines > policy.get('maxChangedLines', 0):
        add('DIFF_TOO_LARGE', str(changed_lines) + ' > ' + str(policy['maxChangedLines']))
    if tests.get('skipped', 0) > 0:
        add('TESTS_SKIPPED', str(tests['skipped']) + ' 个测试被跳过')
    if policy.get('requireTests') and tests.get('total', 0) > 0 and tests.get('changed', 0) == 0:
        behavior = [
            file for file in files
            if under(file['path'], allowed)
            and not re.search(r'(^|/)(tests?|__tests__)/', file['path'])
            and not re.search(r'\\.(test|spec)\\.', file['path'])
        ]
        if behavior:
            add('BEHAVIOR_CHANGE_WITHOUT_TESTS', ', '.join(file['path'] for file in behavior))
    if len(files) == 0:
        add('EMPTY_CHANGE', '没有文件变更')

    findings.sort(key=lambda item: (0 if item['severity'] == 'block' else 1, item['code']))
    has_block = any(item['severity'] == 'block' for item in findings)
    verdict = 'block' if has_block else ('warn' if findings else 'pass')
    return {'verdict': verdict, 'findings': findings}`,
      note: 'Python 用 set 表示 block 级失败码，判断严重度只需一次成员检查；re 模块负责密钥与测试路径匹配。排序键是「严重度 + code」的元组，短路求值不依赖输入顺序。空变更与未运行测试互斥：total 为 0 时只报 TESTS_NOT_RUN。'
    }
  ]
};

const l1Starter = `def parse_sse(chunks):
    events = []
    for chunk in chunks:
        for line in chunk.split('\\n'):
            if line.startswith('data: '):
                events.append({'event': 'message', 'data': line[6:]})
    return events

def create_gateway(providers, pricing, budget, max_retries=1):
    async def call_model(request):
        route = 'strong' if request['task'].get('complexity') == 'high' else 'cheap'
        result = await providers[route](request)
        return {
            'text': result['text'],
            'model': result['model'],
            'usage': result['usage'],
            'cost': result['usage']['outputTokens'],
            'attempts': 1,
        }
    return call_model
`;

const l1Solution = `def parse_sse(chunks):
    events = []
    buffer = ''
    data_lines = []
    state = {'event': 'message', 'id': None}

    def dispatch():
        if not data_lines:
            state['event'] = 'message'
            state['id'] = None
            return
        data = '\\n'.join(data_lines)
        if data == '[DONE]':
            events.append({'event': 'done', 'data': ''})
        else:
            item = {'event': state['event'], 'data': data}
            if state['id'] is not None:
                item['id'] = state['id']
            events.append(item)
        data_lines.clear()
        state['event'] = 'message'
        state['id'] = None

    for chunk in chunks:
        buffer += chunk
        while '\\n' in buffer:
            line, buffer = buffer.split('\\n', 1)
            if line.endswith('\\r'):
                line = line[:-1]
            if line == '':
                dispatch()
                continue
            if line.startswith(':'):
                continue
            colon = line.find(':')
            field = line if colon == -1 else line[:colon]
            value = '' if colon == -1 else line[colon + 1:]
            if value.startswith(' '):
                value = value[1:]
            if field == 'data':
                data_lines.append(value)
            elif field == 'event':
                state['event'] = value
            elif field == 'id':
                state['id'] = value
    return events

def create_gateway(providers, pricing, budget, max_retries=1):
    async def call_model(request):
        task = request['task']
        route = 'strong' if task.get('risk') == 'high' or task.get('complexity') == 'high' else 'cheap'
        attempts = 0
        while True:
            attempts += 1
            try:
                result = await providers[route](request)
                usage = result.get('usage') if isinstance(result, dict) else None
                valid = isinstance(usage, dict) and isinstance(usage.get('inputTokens'), int) \\
                    and isinstance(usage.get('outputTokens'), int) \\
                    and usage['inputTokens'] >= 0 and usage['outputTokens'] >= 0
                if not valid:
                    error = RuntimeError('provider response invalid')
                    error.code = 'INVALID_PROVIDER_RESPONSE'
                    raise error
                price = pricing[route]
                total = usage['inputTokens'] * price['inputPer1k'] + usage['outputTokens'] * price['outputPer1k']
                cost = (total + 999) // 1000
                if cost > budget:
                    error = RuntimeError('budget exceeded')
                    error.code = 'BUDGET_EXCEEDED'
                    raise error
                return {
                    'text': result['text'],
                    'model': result['model'],
                    'usage': usage,
                    'cost': cost,
                    'attempts': attempts,
                }
            except Exception as error:
                can_retry = getattr(error, 'retryable', False) is True \\
                    and 'idempotencyKey' in request \\
                    and attempts <= max_retries
                if not can_retry:
                    raise
    return call_model
`;

const l1Tests = [
  {
    name: '单块 SSE 派发一个事件',
    code: `events = parse_sse(['data: hello\\n\\n'])
assert_eq(events, [{'event': 'message', 'data': 'hello'}])`
  },
  {
    name: '跨块切断仍能拼出完整 data',
    code: `events = parse_sse(['data: he', 'llo\\n', '\\n'])
assert_eq(events, [{'event': 'message', 'data': 'hello'}])`
  },
  {
    name: '多行 data 以换行拼接',
    code: `events = parse_sse(['data: first\\ndata: second\\n\\ndata: third\\n\\n'])
assert_eq(events, [{'event': 'message', 'data': 'first\\nsecond'}, {'event': 'message', 'data': 'third'}])`
  },
  {
    name: 'CRLF、id 与注释行',
    code: `events = parse_sse(['id: 7\\r\\nevent: delta\\r\\ndata: hi\\r\\n: keep-alive\\r\\n\\r\\n'])
assert_eq(events, [{'id': '7', 'event': 'delta', 'data': 'hi'}])`
  },
  {
    name: '[DONE] 输出 done 事件',
    code: `events = parse_sse(['data: tail\\n\\ndata: [DONE]\\n\\n'])
assert_eq(events, [{'event': 'message', 'data': 'tail'}, {'event': 'done', 'data': ''}])`
  },
  {
    name: '低复杂度请求走 cheap 并按输入输出计费',
    code: `pricing = {'cheap': {'inputPer1k': 1, 'outputPer1k': 2}, 'strong': {'inputPer1k': 10, 'outputPer1k': 20}}
async def cheap(request):
    return {'text': '标签：发布、运维、回滚', 'model': 'cheap-mini', 'usage': {'inputTokens': 800, 'outputTokens': 400}}
async def strong(request):
    raise AssertionError('strong should not be called')
call = create_gateway({'cheap': cheap, 'strong': strong}, pricing, 5)
result = await call({'task': {'complexity': 'low', 'risk': 'low'}, 'messages': [{'role': 'user', 'content': '生成标签'}]})
assert_eq(result['model'], 'cheap-mini')
assert_eq(result['cost'], 2)
assert_eq(result['attempts'], 1)`
  },
  {
    name: '高风险请求升级到 strong 并计算成本',
    code: `pricing = {'cheap': {'inputPer1k': 1, 'outputPer1k': 2}, 'strong': {'inputPer1k': 10, 'outputPer1k': 20}}
async def cheap(request):
    raise AssertionError('cheap should not be called')
async def strong(request):
    return {'text': '客户可见的删除说明', 'model': 'strong-pro', 'usage': {'inputTokens': 1200, 'outputTokens': 600}}
call = create_gateway({'cheap': cheap, 'strong': strong}, pricing, 30)
result = await call({'task': {'complexity': 'low', 'risk': 'high'}, 'messages': [{'role': 'user', 'content': '生成说明'}]})
assert_eq(result['model'], 'strong-pro')
assert_eq(result['cost'], 24)
assert_eq(result['attempts'], 1)`
  },
  {
    name: '超出预算抛出 BUDGET_EXCEEDED 且不重试',
    code: `pricing = {'cheap': {'inputPer1k': 1, 'outputPer1k': 2}, 'strong': {'inputPer1k': 10, 'outputPer1k': 20}}
calls = {'n': 0}
async def cheap(request):
    calls['n'] += 1
    return {'text': '标签', 'model': 'cheap-mini', 'usage': {'inputTokens': 800, 'outputTokens': 400}}
async def strong(request):
    return {'text': '强模型', 'model': 'strong-pro', 'usage': {'inputTokens': 1, 'outputTokens': 1}}
call = create_gateway({'cheap': cheap, 'strong': strong}, pricing, 1, max_retries=3)
caught = None
try:
    await call({'task': {'complexity': 'low', 'risk': 'low'}, 'messages': [], 'idempotencyKey': 'budget-case'})
except Exception as error:
    caught = error
assert_eq(caught.code, 'BUDGET_EXCEEDED')
assert_eq(calls['n'], 1)`
  },
  {
    name: '带幂等键的可重试错误重试一次后成功',
    code: `pricing = {'cheap': {'inputPer1k': 1, 'outputPer1k': 2}, 'strong': {'inputPer1k': 10, 'outputPer1k': 20}}
class MockError(Exception):
    pass
calls = {'n': 0}
async def cheap(request):
    calls['n'] += 1
    if calls['n'] == 1:
        error = MockError('rate limited')
        error.code = 'RATE_LIMITED'
        error.retryable = True
        raise error
    return {'text': '标签：发布、运维、回滚', 'model': 'cheap-mini', 'usage': {'inputTokens': 800, 'outputTokens': 400}}
async def strong(request):
    return {'text': '强模型', 'model': 'strong-pro', 'usage': {'inputTokens': 1, 'outputTokens': 1}}
call = create_gateway({'cheap': cheap, 'strong': strong}, pricing, 5, max_retries=1)
result = await call({'task': {'complexity': 'low', 'risk': 'low'}, 'messages': [], 'idempotencyKey': 'req-2026-11-09-001'})
assert_eq(result['attempts'], 2)
assert_eq(result['text'], '标签：发布、运维、回滚')
assert_eq(calls['n'], 2)`
  },
  {
    name: '非幂等请求失败不重试',
    code: `pricing = {'cheap': {'inputPer1k': 1, 'outputPer1k': 2}, 'strong': {'inputPer1k': 10, 'outputPer1k': 20}}
class MockError(Exception):
    pass
calls = {'n': 0}
async def cheap(request):
    calls['n'] += 1
    error = MockError('timeout')
    error.code = 'TIMEOUT'
    error.retryable = True
    raise error
async def strong(request):
    return {'text': '强模型', 'model': 'strong-pro', 'usage': {'inputTokens': 1, 'outputTokens': 1}}
call = create_gateway({'cheap': cheap, 'strong': strong}, pricing, 5, max_retries=2)
caught = None
try:
    await call({'task': {'complexity': 'low', 'risk': 'low'}, 'messages': []})
except Exception as error:
    caught = error
assert_eq(caught.code, 'TIMEOUT')
assert_eq(calls['n'], 1)`
  }
];

const l2Starter = `def chunk_document(text, options=None):
    chunks = []
    for index in range(0, len(text), 200):
        chunks.append({'index': len(chunks), 'text': text[index:index + 200], 'start': index, 'end': index + 200})
    return chunks

async def hybrid_search(input_data):
    docs = input_data['docs']
    embed = input_data['embed']
    query = input_data['query']
    query_vector = await embed(query)
    scored = []
    for doc in docs:
        vector = doc.get('embedding') or await embed(doc['text'])
        scored.append({'id': doc['id'], 'score': vector[0], 'citation': {'docId': doc['docId'], 'chunkIndex': doc['chunkIndex']}})
    scored.sort(key=lambda item: item['score'], reverse=True)
    return scored[:input_data.get('topK', 3)]

async def run_stat_tool(call, context):
    rows = await context['query'](call)
    return {'rows': rows, 'basis': call['metric'], 'rangeDays': call['rangeDays']}
`;

const l2Solution = `def chunk_document(text, options=None):
    options = options or {}
    max_chars = options.get('maxChars', 200)
    overlap = min(options.get('overlap', 40), max_chars - 1)
    if not isinstance(text, str) or len(text) == 0:
        return []
    chunks = []
    start = 0
    boundaries = '。！？!?\\n'
    while start < len(text):
        end = min(start + max_chars, len(text))
        if end < len(text):
            for index in range(end - 1, start, -1):
                if text[index] in boundaries:
                    end = index + 1
                    break
        piece = text[start:end]
        if piece.strip():
            chunks.append({'index': len(chunks), 'text': piece, 'start': start, 'end': end})
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return chunks

async def hybrid_search(input_data):
    query = input_data['query']
    docs = input_data['docs']
    embed = input_data['embed']
    keyword_score = input_data['keywordScore']
    tenant_id = input_data['tenantId']
    top_k = input_data.get('topK', 3)
    weights = input_data.get('weights') or {'vector': 0.7, 'keyword': 0.3}
    if not isinstance(query, str) or not query.strip() or top_k <= 0:
        return []
    candidates = [doc for doc in docs if doc['tenantId'] == tenant_id]
    embedded = []
    for doc in candidates:
        item = dict(doc)
        item['vector'] = doc.get('embedding') or await embed(doc['text'])
        embedded.append(item)
    query_vector = await embed(query)

    def cosine(a, b):
        dot = 0.0
        na = 0.0
        nb = 0.0
        for index in range(len(a)):
            dot += a[index] * b[index]
            na += a[index] * a[index]
            nb += b[index] * b[index]
        if na == 0 or nb == 0:
            return 0.0
        return dot / ((na ** 0.5) * (nb ** 0.5))

    for doc in embedded:
        if len(doc['vector']) != len(query_vector):
            error = RuntimeError('dimension mismatch')
            error.code = 'DIM_MISMATCH'
            raise error

    def normalize(values):
        low = min(values)
        high = max(values)
        return [0.0 if high == low else (value - low) / (high - low) for value in values]

    vector_norm = normalize([cosine(query_vector, doc['vector']) for doc in embedded])
    keyword_norm = normalize([keyword_score(query, doc['text']) for doc in embedded])
    scored = []
    for index, doc in enumerate(embedded):
        scored.append({
            'id': doc['id'],
            'score': weights['vector'] * vector_norm[index] + weights['keyword'] * keyword_norm[index],
            'updatedAt': doc['updatedAt'],
            'citation': {'docId': doc['docId'], 'chunkIndex': doc['chunkIndex']},
        })
    scored.sort(key=lambda item: item['id'])
    scored.sort(key=lambda item: item['updatedAt'], reverse=True)
    scored.sort(key=lambda item: item['score'], reverse=True)
    return [{'id': item['id'], 'score': item['score'], 'citation': item['citation']} for item in scored[:top_k]]

async def run_stat_tool(call, context):
    max_limit = context.get('maxLimit', 100)
    max_range_days = context.get('maxRangeDays', 90)

    def deny(reason):
        error = RuntimeError('tool denied')
        error.code = 'TOOL_DENIED'
        error.reason = reason
        raise error

    if not call or call.get('tool') != 'topLinks':
        deny('UNKNOWN_TOOL')
    if call.get('tenantId') is not None and call.get('tenantId') != context['tenantId']:
        deny('TENANT_MISMATCH')
    range_days = call.get('rangeDays')
    limit = call.get('limit')
    if not isinstance(range_days, int) or isinstance(range_days, bool) or range_days < 1:
        deny('INVALID_ARGUMENT')
    if not isinstance(limit, int) or isinstance(limit, bool) or limit < 1:
        deny('INVALID_ARGUMENT')
    if range_days > max_range_days:
        deny('RANGE_EXCEEDED')
    if limit > max_limit:
        deny('LIMIT_EXCEEDED')
    if call.get('metric') not in context['allowedMetrics']:
        deny('METRIC_NOT_ALLOWED')
    rows = await context['query']({
        'metric': call['metric'],
        'rangeDays': range_days,
        'limit': limit,
        'tenantId': context['tenantId'],
    })
    return {'rows': rows[:limit], 'basis': call['metric'], 'rangeDays': range_days}
`;

const ragDocsPy = [
  {'id': 'd1-c0', 'docId': 'd1', 'chunkIndex': 0, 'text': '短链创建失败时先检查配额与域名状态。', 'tenantId': 't1', 'updatedAt': '2026-08-01T00:00:00Z', 'embedding': [0.6, 0.4, 0, 0]},
  {'id': 'd1-c1', 'docId': 'd1', 'chunkIndex': 1, 'text': '回滚发布前先停止流量再切换版本。', 'tenantId': 't1', 'updatedAt': '2026-05-01T00:00:00Z', 'embedding': [0.9, 0.1, 0, 0]},
  {'id': 'd2-c0', 'docId': 'd2', 'chunkIndex': 0, 'text': '统计口径以点击去重后的独立访客为准。', 'tenantId': 't1', 'updatedAt': '2026-09-01T00:00:00Z', 'embedding': [0, 1, 0, 0]},
  {'id': 'd2-c1', 'docId': 'd2', 'chunkIndex': 1, 'text': '回滚看板按分钟聚合，延迟约十秒。', 'tenantId': 't1', 'updatedAt': '2026-10-01T00:00:00Z'},
  {'id': 'd3-c0', 'docId': 'd3', 'chunkIndex': 0, 'text': '回滚发布手册旧版，保留供审计。', 'tenantId': 't1', 'updatedAt': '2025-01-01T00:00:00Z', 'embedding': [1, 0, 0, 0]},
  {'id': 'x1-c0', 'docId': 'x1', 'chunkIndex': 0, 'text': '其他租户回滚发布流程的机密文档。', 'tenantId': 't2', 'updatedAt': '2026-11-01T00:00:00Z', 'embedding': [1, 0, 0, 0]},
  {'id': 'x1-c1', 'docId': 'x1', 'chunkIndex': 1, 'text': '其他租户的索引补充说明。', 'tenantId': 't2', 'updatedAt': '2026-11-02T00:00:00Z'}
];
const l2StatRows = [
  {'linkId': 'l1', 'clicks': 1200, 'uniqueVisitors': 800},
  {'linkId': 'l2', 'clicks': 900, 'uniqueVisitors': 620},
  {'linkId': 'l3', 'clicks': 700, 'uniqueVisitors': 510},
  {'linkId': 'l4', 'clicks': 500, 'uniqueVisitors': 380},
  {'linkId': 'l5', 'clicks': 300, 'uniqueVisitors': 210}
];

function pyDocsLiteral() {
  return JSON.stringify(ragDocsPy);
}
function pyRowsLiteral() {
  return JSON.stringify(l2StatRows);
}

const l2Tests = [
  {
    name: '切分不产生空块且索引连续',
    code: `text = '第一段。第二段。\\n\\n第三段。'
chunks = chunk_document(text, {'maxChars': 6, 'overlap': 1})
assert_eq(len(chunks) > 0, True)
assert_eq(all(chunk['text'].strip() for chunk in chunks), True)
assert_eq([chunk['index'] for chunk in chunks], list(range(len(chunks))))
assert_eq(chunks[-1]['end'], len(text))`
  },
  {
    name: '块间重叠与长度上限正确',
    code: `text = '第一句话描述创建短链。第二句话描述配额检查。第三句话描述回滚步骤。第四句话描述统计口径。第五句话描述缓存策略。'
chunks = chunk_document(text, {'maxChars': 12, 'overlap': 3})
assert_eq(len(chunks) > 2, True)
assert_eq(all(len(chunk['text']) <= 12 for chunk in chunks), True)
for index in range(1, len(chunks)):
    prev = chunks[index - 1]
    current = chunks[index]
    assert_eq(current['start'] < prev['end'], True)
    assert_eq(prev['end'] - current['start'] <= 3, True)
    assert_eq(current['text'][:prev['end'] - current['start']], text[current['start']:prev['end']])
assert_eq(all(chunk['text'][-1] in '。！？!?\\n' for chunk in chunks), True)`
  },
  {
    name: '租户过滤发生在补齐 embedding 与排序之前',
    code: `docs = ${pyDocsLiteral()}
calls = []
async def embed(text):
    calls.append(text)
    table = {'回滚看板按分钟聚合，延迟约十秒。': [1, 0, 0, 0], '其他租户的索引补充说明。': [1, 0, 0, 0]}
    if text in table:
        return table[text]
    if text == '回滚发布':
        return [1, 0, 0, 0]
    return [1, 0, 0, 0]
result = await hybrid_search({'query': '回滚发布', 'docs': docs, 'embed': embed, 'keywordScore': lambda q, text: 1 if q in text else 0, 'tenantId': 't1', 'topK': 1, 'weights': {'vector': 1, 'keyword': 0}})
assert_eq(len(result), 1)
assert_eq(result[0]['id'], 'd2-c1')
assert_eq(any(item['id'].startswith('x1') for item in result), False)
assert_eq(any('其他租户' in text for text in calls), False)`
  },
  {
    name: '引用精确到文档块',
    code: `docs = ${pyDocsLiteral()}
async def embed(text):
    return [1, 0, 0, 0]
result = await hybrid_search({'query': '回滚发布', 'docs': docs, 'embed': embed, 'keywordScore': lambda q, text: 0, 'tenantId': 't1', 'topK': 3, 'weights': {'vector': 1, 'keyword': 0}})
by_id = {doc['id']: doc for doc in docs}
assert_eq(len(result), 3)
for item in result:
    assert_eq(item['citation'], {'docId': by_id[item['id']]['docId'], 'chunkIndex': by_id[item['id']]['chunkIndex']})
assert_eq(sorted(result[0]['citation'].keys()), ['chunkIndex', 'docId'])`
  },
  {
    name: '向量与关键词加权排序',
    code: `docs = ${pyDocsLiteral()}
async def embed(text):
    table = {'回滚看板按分钟聚合，延迟约十秒。': [1, 0, 0, 0], '其他租户的索引补充说明。': [1, 0, 0, 0]}
    if text in table:
        return table[text]
    if text == '回滚发布':
        return [1, 0, 0, 0]
    return [1, 0, 0, 0]
def keyword_score(q, text):
    if q in text:
        return 1
    if '回滚' in text:
        return 0.2
    return 0
result = await hybrid_search({'query': '回滚发布', 'docs': docs, 'embed': embed, 'keywordScore': keyword_score, 'tenantId': 't1', 'topK': 3, 'weights': {'vector': 0.5, 'keyword': 0.5}})
assert_eq(result[0]['id'], 'd3-c0')
assert_eq(abs(result[0]['score'] - 1) < 1e-9, True)
assert_eq(result[1]['id'], 'd1-c1')
assert_eq(abs(result[1]['score'] - 0.99694) < 1e-3, True)
assert_eq(result[2]['id'], 'd2-c1')
assert_eq(abs(result[2]['score'] - 0.6) < 1e-9, True)`
  },
  {
    name: '同分按更新时间降序、再按 id 升序',
    code: `docs = ${pyDocsLiteral()}
async def embed(text):
    table = {'回滚看板按分钟聚合，延迟约十秒。': [1, 0, 0, 0]}
    if text in table:
        return table[text]
    return [1, 0, 0, 0]
result = await hybrid_search({'query': '回滚发布', 'docs': docs, 'embed': embed, 'keywordScore': lambda q, text: 0, 'tenantId': 't1', 'topK': 2, 'weights': {'vector': 1, 'keyword': 0}})
assert_eq(result[0]['id'], 'd2-c1')
assert_eq(result[1]['id'], 'd3-c0')
assert_eq(abs(result[0]['score'] - 1) < 1e-9, True)
assert_eq(abs(result[1]['score'] - 1) < 1e-9, True)`
  },
  {
    name: 'topK 在排序后截断且空查询返回空数组',
    code: `docs = ${pyDocsLiteral()}
async def embed(text):
    table = {'回滚看板按分钟聚合，延迟约十秒。': [1, 0, 0, 0]}
    if text in table:
        return table[text]
    return [1, 0, 0, 0]
two = await hybrid_search({'query': '回滚发布', 'docs': docs, 'embed': embed, 'keywordScore': lambda q, text: 0, 'tenantId': 't1', 'topK': 2})
assert_eq(len(two), 2)
none = await hybrid_search({'query': '回滚发布', 'docs': docs, 'embed': embed, 'keywordScore': lambda q, text: 0, 'tenantId': 't1', 'topK': 0})
assert_eq(none, [])
blank = await hybrid_search({'query': '   ', 'docs': docs, 'embed': embed, 'keywordScore': lambda q, text: 0, 'tenantId': 't1'})
assert_eq(blank, [])`
  },
  {
    name: '未知指标在查询前被拒绝',
    code: `calls = {'n': 0}
async def query(params):
    calls['n'] += 1
    return []
caught = None
try:
    await run_stat_tool({'tool': 'topLinks', 'metric': 'revenue', 'rangeDays': 7, 'limit': 10}, {'allowedMetrics': ['clicks', 'unique_visitors'], 'tenantId': 't1', 'query': query})
except Exception as error:
    caught = error
assert_eq(caught.code, 'TOOL_DENIED')
assert_eq(caught.reason, 'METRIC_NOT_ALLOWED')
assert_eq(calls['n'], 0)`
  },
  {
    name: '超过时间范围被拒绝',
    code: `calls = {'n': 0}
async def query(params):
    calls['n'] += 1
    return []
caught = None
try:
    await run_stat_tool({'tool': 'topLinks', 'metric': 'clicks', 'rangeDays': 120, 'limit': 10}, {'allowedMetrics': ['clicks', 'unique_visitors'], 'tenantId': 't1', 'query': query})
except Exception as error:
    caught = error
assert_eq(caught.reason, 'RANGE_EXCEEDED')
assert_eq(calls['n'], 0)`
  },
  {
    name: '超过行数上限被拒绝',
    code: `calls = {'n': 0}
async def query(params):
    calls['n'] += 1
    return []
caught = None
try:
    await run_stat_tool({'tool': 'topLinks', 'metric': 'clicks', 'rangeDays': 7, 'limit': 500}, {'allowedMetrics': ['clicks', 'unique_visitors'], 'tenantId': 't1', 'query': query})
except Exception as error:
    caught = error
assert_eq(caught.reason, 'LIMIT_EXCEEDED')
assert_eq(calls['n'], 0)`
  },
  {
    name: '跨租户调用被拒绝',
    code: `calls = {'n': 0}
async def query(params):
    calls['n'] += 1
    return []
caught = None
try:
    await run_stat_tool({'tool': 'topLinks', 'metric': 'clicks', 'rangeDays': 7, 'limit': 10, 'tenantId': 't2'}, {'allowedMetrics': ['clicks', 'unique_visitors'], 'tenantId': 't1', 'query': query})
except Exception as error:
    caught = error
assert_eq(caught.reason, 'TENANT_MISMATCH')
assert_eq(calls['n'], 0)`
  },
  {
    name: '正常调用返回口径并截断行数',
    code: `seen = {}
async def query(params):
    seen.update(params)
    return ${pyRowsLiteral()}
result = await run_stat_tool({'tool': 'topLinks', 'metric': 'unique_visitors', 'rangeDays': 30, 'limit': 2}, {'allowedMetrics': ['clicks', 'unique_visitors'], 'tenantId': 't1', 'query': query})
assert_eq(result['basis'], 'unique_visitors')
assert_eq(result['rangeDays'], 30)
assert_eq(len(result['rows']), 2)
assert_eq(seen['tenantId'], 't1')
assert_eq(seen['metric'], 'unique_visitors')`
  },
  {
    name: '向量维度不一致抛出 DIM_MISMATCH',
    code: `docs = [{'id': 'bad-c0', 'docId': 'bad', 'chunkIndex': 0, 'text': '维度错误的向量。', 'tenantId': 't1', 'updatedAt': '2026-10-01T00:00:00Z', 'embedding': [1, 0, 0]}]
async def embed(text):
    return [1, 0, 0, 0]
caught = None
try:
    await hybrid_search({'query': '维度检查', 'docs': docs, 'embed': embed, 'keywordScore': lambda q, text: 0, 'tenantId': 't1'})
except Exception as error:
    caught = error
assert_eq(caught.code, 'DIM_MISMATCH')`
  }
];

const l3Solution = `async def run_evaluation(cases, runner, thresholds):
    empty_metrics = {'passRate': 0, 'citationRate': 1, 'refusalAccuracy': 1, 'injectionBlockRate': 1}
    if not isinstance(cases, list) or len(cases) == 0:
        return {
            'pass': False,
            'metrics': empty_metrics,
            'failures': [{'caseId': None, 'code': 'EMPTY_EVALUATION', 'detail': '评估集为空'}],
        }
    allowed_tools = thresholds.get('allowedTools') or []
    failures = []
    passed = 0
    cite_total = cite_ok = 0
    refuse_total = refuse_ok = 0
    injection_total = injection_ok = 0
    for test_case in cases:
        expected = test_case.get('expected') or {}
        result = None
        code = None
        detail = ''
        try:
            result = await runner({'input': test_case['input']})
        except Exception as error:
            code = 'RUNNER_ERROR'
            detail = str(error)
        if code is None:
            tool_calls = result.get('toolCalls') if isinstance(result, dict) else None
            tool_calls = tool_calls if isinstance(tool_calls, list) else []
            disallowed = next((call for call in tool_calls if call.get('name') not in allowed_tools), None)
            if disallowed is not None:
                code = 'DISALLOWED_TOOL'
                detail = str(disallowed.get('name'))
            elif expected.get('shouldRefuse') is True and result.get('refused') is not True:
                code = 'SHOULD_REFUSE'
                detail = '应当拒答却回答了'
            elif expected.get('shouldRefuse') is not True and result.get('refused') is True:
                code = 'UNEXPECTED_REFUSAL'
                detail = '不应拒答却拒答了'
            elif expected.get('mustCite') is True and not result.get('citations'):
                code = 'MISSING_CITATION'
                detail = '缺少引用'
        if code is None:
            passed += 1
        else:
            failures.append({'caseId': test_case['id'], 'code': code, 'detail': detail})
        if expected.get('mustCite') is True:
            cite_total += 1
            cite_ok += 1 if result and result.get('citations') else 0
        if expected.get('shouldRefuse') is True:
            refuse_total += 1
            refuse_ok += 1 if result and result.get('refused') is True else 0
        if expected.get('injection') is True:
            injection_total += 1
            calls = result.get('toolCalls') if isinstance(result, dict) else None
            calls = calls if isinstance(calls, list) else []
            injection_ok += 1 if all(call.get('name') in allowed_tools for call in calls) else 0

    def rate(ok, total):
        return 1 if total == 0 else ok / total

    metrics = {
        'passRate': passed / len(cases),
        'citationRate': rate(cite_ok, cite_total),
        'refusalAccuracy': rate(refuse_ok, refuse_total),
        'injectionBlockRate': rate(injection_ok, injection_total),
    }
    passed_all = (
        metrics['passRate'] >= thresholds['passRate']
        and metrics['citationRate'] >= thresholds['citationRate']
        and metrics['refusalAccuracy'] >= thresholds['refusalAccuracy']
        and metrics['injectionBlockRate'] >= thresholds['injectionBlockRate']
    )
    return {'pass': passed_all, 'metrics': metrics, 'failures': failures}

def authorize_tool_call(call, policy):
    try:
        allowed_tools = (policy or {}).get('allowedTools') or []
        fields = {'topLinks': ['metric', 'rangeDays', 'limit', 'tenantId']}
        if not isinstance(call, dict) or not isinstance(call.get('tool'), str) or call['tool'] not in allowed_tools:
            return {'allowed': False, 'reason': 'UNKNOWN_TOOL'}
        args = call.get('args')
        if not isinstance(args, dict):
            return {'allowed': False, 'reason': 'INVALID_ARGUMENT'}
        if 'tenantId' in args and args['tenantId'] != policy.get('tenantId'):
            return {'allowed': False, 'reason': 'TENANT_MISMATCH'}
        for key in args:
            if key not in fields.get(call['tool'], []):
                return {'allowed': False, 'reason': 'ARBITRARY_FIELD'}
        if 'limit' in args:
            limit = args['limit']
            if isinstance(limit, bool) or not isinstance(limit, int) or limit < 1:
                return {'allowed': False, 'reason': 'INVALID_ARGUMENT'}
            if limit > policy.get('maxLimit', 100):
                return {'allowed': False, 'reason': 'LIMIT_EXCEEDED'}
        if 'rangeDays' in args:
            days = args['rangeDays']
            if isinstance(days, bool) or not isinstance(days, int) or days < 1:
                return {'allowed': False, 'reason': 'INVALID_ARGUMENT'}
        if not isinstance(args.get('metric'), str):
            return {'allowed': False, 'reason': 'INVALID_ARGUMENT'}
        if args['metric'] not in (policy.get('allowedMetrics') or []):
            return {'allowed': False, 'reason': 'METRIC_NOT_ALLOWED'}
        return {'allowed': True, 'reason': 'OK'}
    except Exception:
        return {'allowed': False, 'reason': 'INVALID_ARGUMENT'}`;

const l3Starter = `async def run_evaluation(cases, runner, thresholds):
    passed = 0
    for test_case in cases:
        result = await runner({'input': test_case['input']})
        if result.get('citations'):
            passed += 1
    return {
        'pass': passed / len(cases) >= thresholds['passRate'],
        'metrics': {'passRate': passed / len(cases), 'citationRate': 1, 'refusalAccuracy': 1, 'injectionBlockRate': 1},
        'failures': [],
    }

def authorize_tool_call(call, policy):
    if call.get('tool') == 'topLinks':
        return {'allowed': True, 'reason': 'OK'}
    return {'allowed': False, 'reason': 'UNKNOWN_TOOL'}`;

const l3Tests = [
  {
    name: '固定评估集全部通过',
    code: `cases = ${pyLiteral(evalCases)}
thresholds = ${pyLiteral(evalThresholds)}
async def runner(payload):
    test_case = next(item for item in cases if item['input'] == payload['input'])
    return test_case['mock']
result = await run_evaluation(cases, runner, thresholds)
assert_eq(result['pass'], True)
assert_eq(result['failures'], [])
assert_eq(result['metrics']['passRate'], 1)
assert_eq(result['metrics']['citationRate'], 1)
assert_eq(result['metrics']['refusalAccuracy'], 1)
assert_eq(result['metrics']['injectionBlockRate'], 1)
assert_eq(len(cases), 24)`
  },
  {
    name: '缺少引用判失败并记录 MISSING_CITATION',
    code: `cases = [
    {'id': 'c1', 'input': 'q1', 'expected': {'mustCite': True}},
    {'id': 'c2', 'input': 'q2', 'expected': {'mustCite': True}}
]
async def runner(payload):
    return {
        'answer': 'answer',
        'citations': [{'docId': 'd1', 'chunkIndex': 0}] if payload['input'] == 'q1' else [],
        'refused': False,
        'toolCalls': []
    }
result = await run_evaluation(cases, runner, {'passRate': 0.5, 'citationRate': 1, 'refusalAccuracy': 1, 'injectionBlockRate': 1, 'allowedTools': []})
assert_eq(result['pass'], False)
assert_eq(result['metrics']['citationRate'], 0.5)
assert_eq(result['failures'], [{'caseId': 'c2', 'code': 'MISSING_CITATION', 'detail': '缺少引用'}])`
  },
  {
    name: '应拒答却回答判失败',
    code: `cases = [
    {'id': 'r1', 'input': 'r1', 'expected': {'shouldRefuse': True}},
    {'id': 'r2', 'input': 'r2', 'expected': {'shouldRefuse': True}}
]
async def runner(payload):
    return {'answer': 'x', 'citations': [], 'refused': payload['input'] == 'r2', 'toolCalls': []}
result = await run_evaluation(cases, runner, {'passRate': 0.5, 'citationRate': 1, 'refusalAccuracy': 1, 'injectionBlockRate': 1, 'allowedTools': []})
assert_eq(result['pass'], False)
assert_eq(result['metrics']['refusalAccuracy'], 0.5)
assert_eq(result['failures'], [{'caseId': 'r1', 'code': 'SHOULD_REFUSE', 'detail': '应当拒答却回答了'}])`
  },
  {
    name: '注入用例调用禁止工具判失败',
    code: `cases = [
    {'id': 'i1', 'input': 'i1', 'expected': {'injection': True}},
    {'id': 'i2', 'input': 'i2', 'expected': {'injection': True}}
]
async def runner(payload):
    return {
        'answer': 'x', 'citations': [], 'refused': False,
        'toolCalls': [{'name': 'dropTable'}] if payload['input'] == 'i1' else [{'name': 'topLinks'}]
    }
result = await run_evaluation(cases, runner, {'passRate': 0.5, 'citationRate': 1, 'refusalAccuracy': 1, 'injectionBlockRate': 1, 'allowedTools': ['topLinks']})
assert_eq(result['pass'], False)
assert_eq(result['metrics']['injectionBlockRate'], 0.5)
assert_eq(result['failures'][0]['code'], 'DISALLOWED_TOOL')`
  },
  {
    name: '阈值使用大于等于且空分母记 1',
    code: `cases = [{'id': 'only', 'input': 'x', 'expected': {}}]
async def runner(payload):
    return {'answer': 'ok', 'citations': [], 'refused': False, 'toolCalls': []}
result = await run_evaluation(cases, runner, {'passRate': 1, 'citationRate': 1, 'refusalAccuracy': 1, 'injectionBlockRate': 1, 'allowedTools': []})
assert_eq(result['pass'], True)
assert_eq(result['metrics']['passRate'], 1)
assert_eq(result['metrics']['citationRate'], 1)
assert_eq(result['metrics']['refusalAccuracy'], 1)
assert_eq(result['metrics']['injectionBlockRate'], 1)`
  },
  {
    name: '空评估集判失败并给出 EMPTY_EVALUATION',
    code: `async def runner(payload):
    return {}
result = await run_evaluation([], runner, {'passRate': 0, 'citationRate': 0, 'refusalAccuracy': 0, 'injectionBlockRate': 0, 'allowedTools': []})
assert_eq(result['pass'], False)
assert_eq(result['metrics']['passRate'], 0)
assert_eq(result['metrics']['citationRate'], 1)
assert_eq(len(result['failures']), 1)
assert_eq(result['failures'][0]['code'], 'EMPTY_EVALUATION')
assert_eq(result['failures'][0]['caseId'], None)`
  },
  {
    name: '正常工具调用放行',
    code: `policy = ${pyLiteral(toolPolicy)}
result = authorize_tool_call({'tool': 'topLinks', 'args': {'metric': 'clicks', 'rangeDays': 7, 'limit': 10, 'tenantId': 't1'}}, policy)
assert_eq(result, {'allowed': True, 'reason': 'OK'})`
  },
  {
    name: '未知工具拒绝',
    code: `policy = ${pyLiteral(toolPolicy)}
assert_eq(authorize_tool_call({'tool': 'dropTable', 'args': {}}, policy), {'allowed': False, 'reason': 'UNKNOWN_TOOL'})`
  },
  {
    name: '跨租户拒绝',
    code: `policy = ${pyLiteral(toolPolicy)}
result = authorize_tool_call({'tool': 'topLinks', 'args': {'metric': 'clicks', 'rangeDays': 7, 'limit': 10, 'tenantId': 't2'}}, policy)
assert_eq(result, {'allowed': False, 'reason': 'TENANT_MISMATCH'})`
  },
  {
    name: '超过行数上限拒绝',
    code: `policy = ${pyLiteral(toolPolicy)}
result = authorize_tool_call({'tool': 'topLinks', 'args': {'metric': 'clicks', 'rangeDays': 7, 'limit': 500}}, policy)
assert_eq(result, {'allowed': False, 'reason': 'LIMIT_EXCEEDED'})`
  },
  {
    name: '任意 SQL 字段拒绝且不抛异常',
    code: `policy = ${pyLiteral(toolPolicy)}
result = authorize_tool_call({'tool': 'topLinks', 'args': {'metric': 'clicks', 'rangeDays': 7, 'limit': 10, 'sql': 'SELECT * FROM links'}}, policy)
assert_eq(result, {'allowed': False, 'reason': 'ARBITRARY_FIELD'})`
  }
];

const l4Solution = `import re

BLOCK_CODES = {
    'TEST_DELETED', 'TESTS_NOT_RUN', 'TEST_FAILED', 'UNEXPECTED_DEP',
    'FORBIDDEN_PATH', 'OUT_OF_SCOPE', 'SECRET_LEAK',
}

def review_ai_code_change(change, policy):
    files = change.get('files') or []
    tests = change.get('tests') or {}
    deps_added = change.get('depsAdded') or []
    diff_text = change.get('diffText') or ''
    findings = []

    def add(code, detail):
        severity = 'block' if code in BLOCK_CODES else 'warn'
        findings.append({'code': code, 'severity': severity, 'detail': detail})

    def under(path, prefixes):
        return any(path.startswith(prefix) for prefix in prefixes)

    forbidden = policy.get('forbiddenPaths') or []
    allowed = policy.get('allowedPaths') or []

    if tests.get('deleted', 0) > 0:
        add('TEST_DELETED', str(tests['deleted']) + ' 个测试被删除')
    if tests.get('total', 0) == 0:
        add('TESTS_NOT_RUN', '没有执行测试')
    if tests.get('total', 0) > 0 and tests.get('passed', 0) < tests['total'] - tests.get('skipped', 0):
        add('TEST_FAILED', str(tests['passed']) + '/' + str(tests['total']) + ' 通过')
    if deps_added and not policy.get('allowNewDeps'):
        add('UNEXPECTED_DEP', ', '.join(deps_added))

    forbidden_hits = [file for file in files if under(file['path'], forbidden)]
    if forbidden_hits:
        add('FORBIDDEN_PATH', ', '.join(file['path'] for file in forbidden_hits))
    out_of_scope = [
        file for file in files
        if not under(file['path'], forbidden) and allowed and not under(file['path'], allowed)
    ]
    if out_of_scope:
        add('OUT_OF_SCOPE', ', '.join(file['path'] for file in out_of_scope))

    secret = re.compile(r'-----BEGIN [A-Z ]*PRIVATE KEY-----|\\bsk-[A-Za-z0-9]{8,}|\\bAKIA[0-9A-Z]{16}\\b|\\bghp_[A-Za-z0-9]{20,}\\b')
    if secret.search(diff_text):
        add('SECRET_LEAK', 'diff 中包含疑似密钥')

    if len(files) > policy.get('maxFiles', 0):
        add('TOO_MANY_FILES', str(len(files)) + ' > ' + str(policy['maxFiles']))
    changed_lines = sum(file.get('additions', 0) + file.get('deletions', 0) for file in files)
    if changed_lines > policy.get('maxChangedLines', 0):
        add('DIFF_TOO_LARGE', str(changed_lines) + ' > ' + str(policy['maxChangedLines']))
    if tests.get('skipped', 0) > 0:
        add('TESTS_SKIPPED', str(tests['skipped']) + ' 个测试被跳过')
    if policy.get('requireTests') and tests.get('total', 0) > 0 and tests.get('changed', 0) == 0:
        behavior = [
            file for file in files
            if under(file['path'], allowed)
            and not re.search(r'(^|/)(tests?|__tests__)/', file['path'])
            and not re.search(r'\\.(test|spec)\\.', file['path'])
        ]
        if behavior:
            add('BEHAVIOR_CHANGE_WITHOUT_TESTS', ', '.join(file['path'] for file in behavior))
    if len(files) == 0:
        add('EMPTY_CHANGE', '没有文件变更')

    findings.sort(key=lambda item: (0 if item['severity'] == 'block' else 1, item['code']))
    has_block = any(item['severity'] == 'block' for item in findings)
    verdict = 'block' if has_block else ('warn' if findings else 'pass')
    return {'verdict': verdict, 'findings': findings}`;

const l4Starter = `def review_ai_code_change(change, policy):
    findings = []
    tests = change.get('tests') or {}
    if tests.get('deleted', 0) > 0:
        findings.append({'code': 'TEST_DELETED', 'severity': 'block', 'detail': '删除测试'})
    return {'verdict': 'block' if findings else 'pass', 'findings': findings}`;

const l4Tests = [
  {
    name: '正常变更通过',
    code: `change = ${pyLiteral(aiChanges.clean)}
policy = ${pyLiteral(reviewPolicy)}
result = review_ai_code_change(change, policy)
assert_eq(result['verdict'], 'pass')
assert_eq(result['findings'], [])`
  },
  {
    name: '删除测试直接阻断',
    code: `change = ${pyLiteral(aiChanges.deletedTest)}
policy = ${pyLiteral(reviewPolicy)}
result = review_ai_code_change(change, policy)
assert_eq(result['verdict'], 'block')
assert_eq([item['code'] for item in result['findings']], ['TEST_DELETED'])
assert_eq(result['findings'][0]['severity'], 'block')`
  },
  {
    name: '跳过测试给 warn 且不误判失败',
    code: `change = ${pyLiteral(aiChanges.skippedTest)}
policy = ${pyLiteral(reviewPolicy)}
result = review_ai_code_change(change, policy)
assert_eq(result['verdict'], 'warn')
assert_eq([item['code'] for item in result['findings']], ['TESTS_SKIPPED'])
assert_eq(any(item['code'] == 'TEST_FAILED' for item in result['findings']), False)`
  },
  {
    name: '测试失败直接阻断',
    code: `change = ${pyLiteral(aiChanges.failedTest)}
policy = ${pyLiteral(reviewPolicy)}
result = review_ai_code_change(change, policy)
assert_eq(result['verdict'], 'block')
assert_eq([item['code'] for item in result['findings']], ['TEST_FAILED'])
assert_eq(result['findings'][0]['detail'], '10/12 通过')`
  },
  {
    name: '新增依赖直接阻断',
    code: `change = ${pyLiteral(aiChanges.newDep)}
policy = ${pyLiteral(reviewPolicy)}
result = review_ai_code_change(change, policy)
assert_eq(result['verdict'], 'block')
assert_eq([item['code'] for item in result['findings']], ['UNEXPECTED_DEP'])
assert_eq(result['findings'][0]['detail'], 'slugify')`
  },
  {
    name: '禁止路径阻断且不重复报越界',
    code: `change = ${pyLiteral(aiChanges.forbiddenPath)}
policy = ${pyLiteral(reviewPolicy)}
result = review_ai_code_change(change, policy)
assert_eq(result['verdict'], 'block')
assert_eq([item['code'] for item in result['findings']], ['FORBIDDEN_PATH'])
assert_eq(result['findings'][0]['detail'], '.github/workflows/ci.yml')`
  },
  {
    name: '越界路径阻断',
    code: `change = ${pyLiteral(aiChanges.outOfScope)}
policy = ${pyLiteral(reviewPolicy)}
result = review_ai_code_change(change, policy)
assert_eq(result['verdict'], 'block')
assert_eq([item['code'] for item in result['findings']], ['OUT_OF_SCOPE'])
assert_eq(result['findings'][0]['detail'], 'scripts/deploy.sh')`
  },
  {
    name: '密钥模式阻断',
    code: `change = ${pyLiteral(aiChanges.secretLeak)}
policy = ${pyLiteral(reviewPolicy)}
result = review_ai_code_change(change, policy)
assert_eq(result['verdict'], 'block')
assert_eq([item['code'] for item in result['findings']], ['SECRET_LEAK'])
assert_eq(result['findings'][0]['severity'], 'block')`
  },
  {
    name: '文件数超限给 warn',
    code: `change = ${pyLiteral(aiChanges.tooManyFiles)}
policy = ${pyLiteral(reviewPolicy)}
result = review_ai_code_change(change, policy)
assert_eq(result['verdict'], 'warn')
assert_eq([item['code'] for item in result['findings']], ['TOO_MANY_FILES'])
assert_eq(result['findings'][0]['detail'], '6 > 5')`
  },
  {
    name: 'diff 行数超限给 warn',
    code: `change = ${pyLiteral(aiChanges.largeDiff)}
policy = ${pyLiteral(reviewPolicy)}
result = review_ai_code_change(change, policy)
assert_eq(result['verdict'], 'warn')
assert_eq([item['code'] for item in result['findings']], ['DIFF_TOO_LARGE'])
assert_eq(result['findings'][0]['detail'], '250 > 200')`
  },
  {
    name: 'findings 按严重度与 code 排序',
    code: `change = ${pyLiteral(aiChanges.multiple)}
policy = ${pyLiteral(reviewPolicy)}
result = review_ai_code_change(change, policy)
assert_eq(result['verdict'], 'block')
assert_eq([item['code'] for item in result['findings']], ['SECRET_LEAK', 'TESTS_SKIPPED', 'TOO_MANY_FILES'])
assert_eq([item['severity'] for item in result['findings']], ['block', 'warn', 'warn'])`
  },
  {
    name: '空变更给 warn 而未运行测试阻断',
    code: `policy = ${pyLiteral(reviewPolicy)}
empty = review_ai_code_change(${pyLiteral(aiChanges.emptyChange)}, policy)
assert_eq(empty['verdict'], 'warn')
assert_eq([item['code'] for item in empty['findings']], ['EMPTY_CHANGE'])
not_run = review_ai_code_change(${pyLiteral(aiChanges.testsNotRun)}, policy)
assert_eq(not_run['verdict'], 'block')
assert_eq([item['code'] for item in not_run['findings']], ['TESTS_NOT_RUN'])`
  },
  {
    name: '行为变更缺少测试变更给 warn',
    code: `change = ${pyLiteral(aiChanges.behaviorWithoutTests)}
policy = ${pyLiteral(reviewPolicy)}
result = review_ai_code_change(change, policy)
assert_eq(result['verdict'], 'warn')
assert_eq([item['code'] for item in result['findings']], ['BEHAVIOR_CHANGE_WITHOUT_TESTS'])
assert_eq(result['findings'][0]['severity'], 'warn')`
  }
];

export const PYTHON_TRACKS = {
  's7-l1-ex-1': {
    starter: l1Starter,
    solution: l1Solution,
    tests: l1Tests
  },
  's7-l2-ex-1': {
    starter: l2Starter,
    solution: l2Solution,
    tests: l2Tests
  },
  's7-l3-ex-1': {
    starter: l3Starter,
    solution: l3Solution,
    tests: l3Tests
  },
  's7-l4-ex-1': {
    starter: l4Starter,
    solution: l4Solution,
    tests: l4Tests
  }
};
