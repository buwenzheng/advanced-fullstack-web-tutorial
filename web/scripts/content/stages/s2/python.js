export const PYTHON_BLOCKS = {
  's2-l1': [
    {
      code: `from urllib.parse import unquote

ROUTES = [
    {"method": "GET", "path": "/v1/links/:id"},
    {"method": "GET", "path": "/v1/links/:id/clicks"},
    {"method": "PATCH", "path": "/v1/links/:id"},
]


def split_path(path):
    normalized = path[:-1] if len(path) > 1 and path.endswith("/") else path
    return normalized.split("/")[1:]


def match_one(route_path, segments):
    parts = route_path.split("/")[1:]
    if len(parts) != len(segments):
        return None
    params = {}
    for index, part in enumerate(parts):
        if part.startswith(":"):
            name = part[1:]
            if name in params:
                raise ValueError("duplicate param: " + name)
            if not segments[index]:
                return None
            params[name] = unquote(segments[index])
        elif part != segments[index]:
            return None
    return params


def resolve(routes, method, path):
    segments = split_path(path)
    path_matches = []
    hit = None
    for route in routes:
        params = match_one(route["path"], segments)
        if params is None:
            continue
        path_matches.append(route)
        if route["method"] == method.upper():
            hit = {"route": route, "params": params}
    if hit is not None:
        return hit
    if path_matches:
        allowed = sorted({route["method"] for route in path_matches})
        return {"error": "method_not_allowed", "allowed": allowed}
    return {"error": "not_found"}`,
      note: 'Python 的 urllib.parse.unquote 遇到非法百分号编码不会抛异常，只会原样保留；需要自己校验 % 后是否跟两位十六进制。dict 从 3.7 起保持插入顺序，但方法允许列表仍应显式 sorted，避免依赖遍历顺序。'
    }
  ],
  's2-l2': [
    {
      code: `import time
from datetime import datetime, timezone
from urllib.parse import urlsplit

RESERVED = {"api", "admin", "login", "static", "health"}
KNOWN = ("url", "slug", "title", "expiresAt")


def parse_iso_ms(text):
    normalized = text[:-1] + "+00:00" if text.endswith("Z") else text
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return int(parsed.timestamp() * 1000)


def validate_create_link(input_data, now=None):
    if now is None:
        now = int(time.time() * 1000)
    if not isinstance(input_data, dict):
        return {"ok": False, "errors": [{"field": "body", "code": "invalid_type"}]}
    errors = []
    value = {}

    if "url" not in input_data:
        errors.append({"field": "url", "code": "required"})
    elif not isinstance(input_data["url"], str):
        errors.append({"field": "url", "code": "invalid_type"})
    else:
        parts = urlsplit(input_data["url"])
        if parts.scheme not in ("http", "https") or not parts.netloc:
            code = "invalid_protocol" if parts.scheme else "invalid_url"
            errors.append({"field": "url", "code": code})
        else:
            value["url"] = input_data["url"]

    if "slug" in input_data:
        slug = input_data["slug"]
        if not isinstance(slug, str):
            errors.append({"field": "slug", "code": "invalid_type"})
        elif slug in RESERVED:
            errors.append({"field": "slug", "code": "reserved"})
        elif not (4 <= len(slug) <= 32 and all(ch in "abcdefghijklmnopqrstuvwxyz0123456789-" for ch in slug)):
            errors.append({"field": "slug", "code": "invalid_format"})
        else:
            value["slug"] = slug

    if "expiresAt" in input_data:
        expires = input_data["expiresAt"]
        if not isinstance(expires, str):
            errors.append({"field": "expiresAt", "code": "invalid_type"})
        else:
            timestamp = parse_iso_ms(expires)
            if timestamp is None:
                errors.append({"field": "expiresAt", "code": "invalid_datetime"})
            elif timestamp <= now:
                errors.append({"field": "expiresAt", "code": "expired"})
            else:
                value["expiresAt"] = expires

    for field in sorted(key for key in input_data if key not in KNOWN):
        errors.append({"field": field, "code": "unknown_field"})
    return {"ok": True, "value": value} if not errors else {"ok": False, "errors": errors}`,
      note: 'Python 的 datetime.fromisoformat 在 3.11 起支持更多 ISO 形式，但结尾 Z 仍需先替换为 +00:00；服务端要固定接受的格式，不能把解析器的宽松当成契约。'
    },
    {
      code: `def error_body(code, message, request_id, details=None):
    body = {"error": {"code": code, "message": message, "requestId": request_id}}
    if details:
        body["error"]["details"] = details
    return body


def handle_create_link(payload, request_id, repository, now):
    result = validate_create_link(payload, now=now)
    if not result["ok"]:
        return 422, error_body("validation_error", "请求参数不合法", request_id, result["errors"])

    created = repository.create(result["value"])
    if created is None:
        return 409, error_body(
            "slug_conflict",
            "短码已被占用",
            request_id,
            [{"field": "slug", "code": "conflict"}],
        )
    return 201, {"data": created}


def handle_unexpected(error, request_id):
    logger.exception("request failed", extra={"requestId": request_id, "error": error})
    return 500, error_body("internal_error", "服务暂时不可用，请稍后重试", request_id)`,
      note: 'Python 的异常对象可能带 traceback；对外响应只给稳定的 code 与 message，异常细节写日志。这里的 return (status, body) 是框架无关的示意，接入 Web 框架时保持同样的映射即可。'
    }
  ],
  's2-l3': [
    {
      code: `def authorize(user, action, resource):
    if not resource:
        return {"allowed": False, "reason": "not_found"}
    if action not in ("read", "write", "delete"):
        return {"allowed": False, "reason": "unknown_action"}

    public_read = action == "read" and resource.get("visibility") == "public"
    if not user:
        if public_read:
            return {"allowed": True, "reason": "public_read"}
        return {"allowed": False, "reason": "authentication_required"}

    same_tenant = user["tenantId"] == resource["tenantId"]
    is_admin = user.get("role") == "admin"
    if not same_tenant:
        # 平台管理员可以跨租户读，但写操作仍要留在目标租户内
        if is_admin and action == "read":
            return {"allowed": True, "reason": "platform_read"}
        return {"allowed": False, "reason": "tenant_mismatch"}
    if resource.get("ownerId") == user["id"]:
        return {"allowed": True, "reason": "owner"}
    if is_admin:
        return {"allowed": True, "reason": "admin"}
    if action == "read":
        return {"allowed": True, "reason": "member_read"}
    return {"allowed": False, "reason": "not_owner"}`,
      note: 'Python 没有 JS 那样的真值区分：空 dict 是假值，写 if not resource 时要把「资源不存在」和「空资源」当成同一种情况在契约里说清。这里返回 dict 便于直接序列化；生产代码可以用 dataclass 或 NamedTuple 固定字段与类型。'
    },
    {
      code: `class LinkRepository:
    def __init__(self, db):
        self.db = db

    async def find_by_id(self, auth, link_id):
        row = await self.db.fetchrow(
            "SELECT id, tenant_id, owner_id, slug, target_url "
            "FROM links WHERE tenant_id = $1 AND id = $2",
            auth["tenantId"],
            link_id,
        )
        return dict(row) if row else None

    async def update(self, auth, link_id, target_url):
        status = await self.db.execute(
            "UPDATE links SET target_url = $3 WHERE tenant_id = $1 AND id = $2",
            auth["tenantId"],
            link_id,
            target_url,
        )
        return status == "UPDATE 1"

    async def list(self, auth, limit):
        capped = max(1, min(limit, 100))
        rows = await self.db.fetch(
            "SELECT id, slug, target_url FROM links "
            "WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2",
            auth["tenantId"],
            capped,
        )
        return [dict(row) for row in rows]`,
      note: '示例按 asyncpg 风格的 $1 占位符与 async 方法写；换 psycopg 时占位符变成 %s，但「auth 上下文进仓储、tenant_id 强制进 WHERE」的结构不变。不要用字符串拼接把 tenant_id 塞进 SQL，参数化绑定让注入没有入口。'
    }
  ],
  's2-l4': [
    {
      code: `import base64
import json


class InvalidCursorError(ValueError):
    pass


def encode_cursor(payload):
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def decode_cursor(cursor):
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        raw = base64.urlsafe_b64decode(padded.encode("ascii"))
        return json.loads(raw.decode("utf-8"))
    except Exception:
        raise InvalidCursorError("invalid cursor")`,
      note: 'Python 的 urlsafe_b64decode 默认会忽略非法字符，不做严格校验；所以必须再校验解码后的 JSON 结构与必需字段，否则乱码会被当成空 payload。游标同样只放排序键，不放偏移量与内部字段。'
    },
    {
      code: `import hashlib
import hmac

WINDOW_MS = 5 * 60 * 1000


def sign_webhook(secret, timestamp, body):
    message = f"{timestamp}.{body}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def verify_webhook(secret, timestamp, body, signature, now_ms):
    try:
        sent_at = int(timestamp)
    except (TypeError, ValueError):
        return {"ok": False, "reason": "expired"}
    if abs(now_ms - sent_at) > WINDOW_MS:
        return {"ok": False, "reason": "expired"}
    expected = sign_webhook(secret, timestamp, body)
    if not hmac.compare_digest(expected, str(signature)):
        return {"ok": False, "reason": "bad_signature"}
    return {"ok": True}`,
      note: 'Python 用 hmac.compare_digest 做常量时间比较；参数必须是同类型的 ASCII 字符串或 bytes，比较前先确认 signature 的形状。签名覆盖「时间戳 + 原始 body」，接入框架时要拿原始字节，不能先用框架解析成 dict 再重新序列化。'
    }
  ]
};

export const PYTHON_TRACKS = {
  's2-l1-ex-1': {
    starter: `def match_route(routes, method, path):
    segments = path.split('/')[1:]
    for route in routes:
        parts = route['path'].split('/')[1:]
        if len(parts) != len(segments) or route['method'] != method:
            continue
        params = {}
        ok = True
        for index, part in enumerate(parts):
            if part.startswith(':'):
                params[part[1:]] = segments[index]
            elif part != segments[index]:
                ok = False
                break
        if ok:
            return {'route': route, 'params': params}
    return {'error': 'not_found'}
`,
    solution: `from urllib.parse import unquote

class BadEncoding(ValueError):
    pass

def decode_segment(segment):
    index = 0
    while index < len(segment):
        if segment[index] == '%':
            if index + 2 >= len(segment):
                raise BadEncoding('bad percent encoding')
            pair = segment[index + 1:index + 3]
            if any(ch not in '0123456789abcdefABCDEF' for ch in pair):
                raise BadEncoding('bad percent encoding')
            index += 3
        else:
            index += 1
    return unquote(segment)

def match_route(routes, method, path):
    normalized = path[:-1] if len(path) > 1 and path.endswith('/') else path
    segments = normalized.split('/')[1:]
    wanted = method.upper()
    path_matches = []
    hit = None
    for route in routes:
        parts = route['path'].split('/')[1:]
        if len(parts) != len(segments):
            continue
        names = set()
        for part in parts:
            if part.startswith(':'):
                name = part[1:]
                if name in names:
                    raise ValueError('duplicate param: ' + name)
                names.add(name)
        params = {}
        ok = True
        for index, part in enumerate(parts):
            if part.startswith(':'):
                if not segments[index]:
                    ok = False
                    break
                try:
                    params[part[1:]] = decode_segment(segments[index])
                except BadEncoding:
                    return {'error': 'bad_request'}
            elif part != segments[index]:
                ok = False
                break
        if not ok:
            continue
        path_matches.append(route)
        if route['method'].upper() == wanted:
            hit = {'route': route, 'params': params}
    if hit is not None:
        return hit
    if path_matches:
        allowed = sorted({route['method'].upper() for route in path_matches})
        return {'error': 'method_not_allowed', 'allowed': allowed}
    return {'error': 'not_found'}
`,
    tests: [
      {
        name: '静态路径命中且参数为空',
        code: `routes = [
    {'method': 'GET', 'path': '/v1/links'},
    {'method': 'POST', 'path': '/v1/links'},
]
result = match_route(routes, 'GET', '/v1/links')
assert_eq(result['route']['method'], 'GET')
assert_eq(result['params'], {})`
      },
      {
        name: '参数段被解码',
        code: `routes = [{'method': 'GET', 'path': '/v1/links/:id/clicks'}]
result = match_route(routes, 'GET', '/v1/links/a%20b/clicks')
assert_eq(result['params']['id'], 'a b')`
      },
      {
        name: '方法不匹配返回 405 与允许的方法',
        code: `routes = [
    {'method': 'GET', 'path': '/v1/links/:id'},
    {'method': 'POST', 'path': '/v1/links/:id'},
    {'method': 'PATCH', 'path': '/v1/links/:id'},
]
result = match_route(routes, 'PUT', '/v1/links/42')
assert_eq(result['error'], 'method_not_allowed')
assert_eq(result['allowed'], ['GET', 'PATCH', 'POST'])`
      },
      {
        name: '路径不存在返回 404 而不是 405',
        code: `routes = [{'method': 'GET', 'path': '/v1/links/:id'}]
result = match_route(routes, 'DELETE', '/v1/users/42')
assert_eq(result['error'], 'not_found')
assert 'allowed' not in result`
      },
      {
        name: '尾斜杠与方法大小写可命中',
        code: `routes = [
    {'method': 'GET', 'path': '/v1/links'},
    {'method': 'GET', 'path': '/v1/links/:id'},
]
collection = match_route(routes, 'get', '/v1/links/')
item = match_route(routes, 'get', '/v1/links/42/')
assert_eq(collection['params'], {})
assert_eq(item['params']['id'], '42')`
      },
      {
        name: '重复参数报错且非法编码返回 400',
        code: `routes = [{'method': 'GET', 'path': '/v1/links/:id/:id'}]
error = None
try:
    match_route(routes, 'GET', '/v1/links/1/2')
except ValueError as caught:
    error = caught
assert error is not None
assert 'duplicate param' in str(error)
bad = match_route([{'method': 'GET', 'path': '/v1/links/:id'}], 'GET', '/v1/links/%E0%A4%A')
assert_eq(bad['error'], 'bad_request')`
      }
    ]
  },
  's2-l2-ex-1': {
    starter: `def validate_create_link(input_data, now=None):
    if not isinstance(input_data, dict):
        return {'ok': False, 'errors': [{'field': 'body', 'code': 'invalid_type'}]}
    if not input_data.get('url'):
        return {'ok': False, 'errors': [{'field': 'url', 'code': 'required'}]}
    return {'ok': True, 'value': input_data}
`,
    solution: `import time
from datetime import datetime, timezone
from urllib.parse import urlsplit

RESERVED = {'api', 'admin', 'login', 'static', 'health'}
KNOWN = ('url', 'slug', 'title', 'expiresAt')

def parse_iso_ms(text):
    normalized = text[:-1] + '+00:00' if text.endswith('Z') else text
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return int(parsed.timestamp() * 1000)

def validate_create_link(input_data, now=None):
    if now is None:
        now = int(time.time() * 1000)
    if not isinstance(input_data, dict):
        return {'ok': False, 'errors': [{'field': 'body', 'code': 'invalid_type'}]}
    errors = []
    value = {}
    if 'url' not in input_data:
        errors.append({'field': 'url', 'code': 'required'})
    elif not isinstance(input_data['url'], str):
        errors.append({'field': 'url', 'code': 'invalid_type'})
    else:
        parts = urlsplit(input_data['url'])
        if parts.scheme not in ('http', 'https') or not parts.netloc:
            code = 'invalid_protocol' if parts.scheme else 'invalid_url'
            errors.append({'field': 'url', 'code': code})
        else:
            value['url'] = input_data['url']
    if 'slug' in input_data:
        slug = input_data['slug']
        if not isinstance(slug, str):
            errors.append({'field': 'slug', 'code': 'invalid_type'})
        elif slug in RESERVED:
            errors.append({'field': 'slug', 'code': 'reserved'})
        elif not (4 <= len(slug) <= 32 and all(ch in 'abcdefghijklmnopqrstuvwxyz0123456789-' for ch in slug)):
            errors.append({'field': 'slug', 'code': 'invalid_format'})
        else:
            value['slug'] = slug
    if 'title' in input_data:
        title = input_data['title']
        if not isinstance(title, str):
            errors.append({'field': 'title', 'code': 'invalid_type'})
        else:
            trimmed = title.strip()
            if len(trimmed) < 1 or len(trimmed) > 120:
                errors.append({'field': 'title', 'code': 'invalid_length'})
            else:
                value['title'] = trimmed
    if 'expiresAt' in input_data:
        expires = input_data['expiresAt']
        if not isinstance(expires, str):
            errors.append({'field': 'expiresAt', 'code': 'invalid_type'})
        else:
            timestamp = parse_iso_ms(expires)
            if timestamp is None:
                errors.append({'field': 'expiresAt', 'code': 'invalid_datetime'})
            elif timestamp <= now:
                errors.append({'field': 'expiresAt', 'code': 'expired'})
            else:
                value['expiresAt'] = expires
    for field in sorted(key for key in input_data if key not in KNOWN):
        errors.append({'field': field, 'code': 'unknown_field'})
    return {'ok': True, 'value': value} if not errors else {'ok': False, 'errors': errors}
`,
    tests: [
      {
        name: '合法输入通过并 trim 标题',
        code: `now = 1794182400000
result = validate_create_link({
    'url': 'https://example.com/a',
    'slug': 'promo-2026',
    'title': '  Spring Sale  ',
    'expiresAt': '2026-11-10T00:00:00.000Z',
}, now=now)
assert_eq(result['ok'], True)
assert_eq(result['value']['title'], 'Spring Sale')
assert_eq(sorted(result['value'].keys()), ['expiresAt', 'slug', 'title', 'url'])`
      },
      {
        name: '缺少 url 返回 required',
        code: `result = validate_create_link({'slug': 'promo-2026'}, now=0)
assert_eq(result['ok'], False)
assert_eq(result['errors'], [{'field': 'url', 'code': 'required'}])`
      },
      {
        name: '非法协议与不可解析 URL 区分错误码',
        code: `now = 1794182400000
protocol = validate_create_link({'url': 'ftp://example.com/x'}, now=now)
assert_eq(protocol['errors'][0]['code'], 'invalid_protocol')
malformed = validate_create_link({'url': 'not a url'}, now=now)
assert_eq(malformed['errors'][0]['code'], 'invalid_url')`
      },
      {
        name: '保留字与格式错误的 slug 被拒绝',
        code: `now = 1794182400000
reserved = validate_create_link({'url': 'https://example.com', 'slug': 'admin'}, now=now)
assert_eq(reserved['errors'][0]['code'], 'reserved')
short = validate_create_link({'url': 'https://example.com', 'slug': 'ab'}, now=now)
assert_eq(short['errors'][0]['code'], 'invalid_format')
upper = validate_create_link({'url': 'https://example.com', 'slug': 'Bad_Slug'}, now=now)
assert_eq(upper['errors'][0]['code'], 'invalid_format')`
      },
      {
        name: '过期时间等于或早于注入的 now 被拒绝',
        code: `now = 1794182400000
equal = validate_create_link({'url': 'https://example.com', 'expiresAt': '2026-11-09T00:00:00.000Z'}, now=now)
assert_eq(equal['errors'][0]['code'], 'expired')
earlier = validate_create_link({'url': 'https://example.com', 'expiresAt': '2026-11-08T23:59:59.000Z'}, now=now)
assert_eq(earlier['errors'][0]['code'], 'expired')
bad = validate_create_link({'url': 'https://example.com', 'expiresAt': 'tomorrow'}, now=now)
assert_eq(bad['errors'][0]['code'], 'invalid_datetime')`
      },
      {
        name: '未知字段被拒绝且不进入 value',
        code: `now = 1794182400000
result = validate_create_link({'url': 'https://example.com', 'zeta': 1, 'alpha': 2}, now=now)
assert_eq(result['ok'], False)
assert_eq([item['field'] for item in result['errors']], ['alpha', 'zeta'])
assert_eq([item['code'] for item in result['errors']], ['unknown_field', 'unknown_field'])
assert 'value' not in result`
      },
      {
        name: '多个字段非法时错误顺序稳定',
        code: `now = 1794182400000
result = validate_create_link({
    'slug': 'x',
    'title': 'x' * 121,
    'expiresAt': '2026-11-08T00:00:00.000Z',
    'zeta': 1,
    'alpha': 2,
}, now=now)
assert_eq(
    [item['field'] for item in result['errors']],
    ['url', 'slug', 'title', 'expiresAt', 'alpha', 'zeta'],
)`
      }
    ]
  },
  's2-l3-ex-1': {
    starter: `def authorize(user, action, resource):
    if not user:
        return {'allowed': False, 'reason': 'authentication_required'}
    if user.get('role') == 'admin' or resource['ownerId'] == user['id']:
        return {'allowed': True, 'reason': 'owner'}
    return {'allowed': True, 'reason': 'member_read'}
`,
    solution: `def authorize(user, action, resource):
    if not resource:
        return {'allowed': False, 'reason': 'not_found'}
    if action not in ('read', 'write', 'delete'):
        return {'allowed': False, 'reason': 'unknown_action'}
    public_read = action == 'read' and resource.get('visibility') == 'public'
    if not user:
        if public_read:
            return {'allowed': True, 'reason': 'public_read'}
        return {'allowed': False, 'reason': 'authentication_required'}
    same_tenant = user['tenantId'] == resource['tenantId']
    is_admin = user.get('role') == 'admin'
    if not same_tenant:
        if is_admin and action == 'read':
            return {'allowed': True, 'reason': 'platform_read'}
        return {'allowed': False, 'reason': 'tenant_mismatch'}
    if resource.get('ownerId') == user['id']:
        return {'allowed': True, 'reason': 'owner'}
    if is_admin:
        return {'allowed': True, 'reason': 'admin'}
    if action == 'read':
        return {'allowed': True, 'reason': 'member_read'}
    return {'allowed': False, 'reason': 'not_owner'}
`,
    tests: [
      {
        name: '匿名读公开资源允许',
        code: `result = authorize(None, 'read', {'id': 'l1', 'ownerId': 'u1', 'tenantId': 't1', 'visibility': 'public'})
assert_eq(result, {'allowed': True, 'reason': 'public_read'})`
      },
      {
        name: '匿名读私有资源要求认证',
        code: `result = authorize(None, 'read', {'id': 'l1', 'ownerId': 'u1', 'tenantId': 't1', 'visibility': 'private'})
assert_eq(result, {'allowed': False, 'reason': 'authentication_required'})`
      },
      {
        name: 'owner 可写自己的资源',
        code: `user = {'id': 'u1', 'role': 'member', 'tenantId': 't1'}
resource = {'id': 'l1', 'ownerId': 'u1', 'tenantId': 't1', 'visibility': 'private'}
assert_eq(authorize(user, 'write', resource), {'allowed': True, 'reason': 'owner'})
assert_eq(authorize(user, 'delete', resource), {'allowed': True, 'reason': 'owner'})`
      },
      {
        name: '平台管理员可跨租户读',
        code: `user = {'id': 'admin-1', 'role': 'admin', 'tenantId': 't1'}
resource = {'id': 'l9', 'ownerId': 'u9', 'tenantId': 't2', 'visibility': 'private'}
assert_eq(authorize(user, 'read', resource), {'allowed': True, 'reason': 'platform_read'})`
      },
      {
        name: '平台管理员不能跨租户写',
        code: `user = {'id': 'admin-1', 'role': 'admin', 'tenantId': 't1'}
resource = {'id': 'l9', 'ownerId': 'u9', 'tenantId': 't2', 'visibility': 'private'}
assert_eq(authorize(user, 'write', resource), {'allowed': False, 'reason': 'tenant_mismatch'})
assert_eq(authorize(user, 'delete', resource), {'allowed': False, 'reason': 'tenant_mismatch'})`
      },
      {
        name: '同租户成员可读但不可写',
        code: `user = {'id': 'u2', 'role': 'member', 'tenantId': 't1'}
resource = {'id': 'l1', 'ownerId': 'u1', 'tenantId': 't1', 'visibility': 'private'}
assert_eq(authorize(user, 'read', resource), {'allowed': True, 'reason': 'member_read'})
assert_eq(authorize(user, 'write', resource), {'allowed': False, 'reason': 'not_owner'})`
      },
      {
        name: '未知动作与缺失资源被拒绝',
        code: `user = {'id': 'u1', 'role': 'member', 'tenantId': 't1'}
resource = {'id': 'l1', 'ownerId': 'u1', 'tenantId': 't1', 'visibility': 'private'}
assert_eq(authorize(user, 'publish', resource), {'allowed': False, 'reason': 'unknown_action'})
assert_eq(authorize(user, 'read', None), {'allowed': False, 'reason': 'not_found'})`
      }
    ]
  },
  's2-l4-ex-1': {
    starter: `class InvalidCursorError(ValueError):
    pass

class RangeError(ValueError):
    pass

def paginate(items, limit=20, cursor=None):
    ordered = sorted(items, key=lambda item: item['createdAt'], reverse=True)
    start = int(cursor) if cursor else 0
    data = ordered[start:start + limit]
    next_cursor = str(start + limit) if start + limit < len(ordered) else None
    return {'data': data, 'nextCursor': next_cursor}
`,
    solution: `import base64
import json

class InvalidCursorError(ValueError):
    pass

class RangeError(ValueError):
    pass

def encode_cursor(payload):
    raw = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    return base64.urlsafe_b64encode(raw).decode('ascii').rstrip('=')

def decode_cursor(cursor):
    try:
        padded = cursor + '=' * (-len(cursor) % 4)
        raw = base64.urlsafe_b64decode(padded.encode('ascii'))
        return json.loads(raw.decode('utf-8'))
    except Exception:
        raise InvalidCursorError('invalid cursor')

def paginate(items, limit=20, cursor=None):
    if not isinstance(limit, int) or isinstance(limit, bool) or limit < 1:
        raise RangeError('limit must be a positive integer')
    size = min(limit, 100)
    ordered = sorted(items, key=lambda item: (item['createdAt'], item['id']), reverse=True)
    start = 0
    if cursor is not None:
        parsed = decode_cursor(cursor)
        if not isinstance(parsed, dict):
            raise InvalidCursorError('invalid cursor')
        created_at = parsed.get('createdAt')
        identifier = parsed.get('id')
        if not isinstance(created_at, str) or not isinstance(identifier, str):
            raise InvalidCursorError('invalid cursor')
        index = -1
        for position, item in enumerate(ordered):
            if item['createdAt'] == created_at and item['id'] == identifier:
                index = position
                break
        if index == -1:
            raise InvalidCursorError('cursor not found')
        start = index + 1
    data = ordered[start:start + size]
    has_more = start + size < len(ordered)
    next_cursor = None
    if has_more and data:
        last = data[-1]
        next_cursor = encode_cursor({'createdAt': last['createdAt'], 'id': last['id']})
    return {'data': data, 'nextCursor': next_cursor}
`,
    tests: [
      {
        name: '第一页按时间与 id 稳定排序',
        code: `items = [
    {'id': 'a', 'createdAt': '2026-11-09T00:00:00.000Z'},
    {'id': 'b', 'createdAt': '2026-11-09T00:00:00.000Z'},
    {'id': 'c', 'createdAt': '2026-11-08T00:00:00.000Z'},
]
first = paginate(items, limit=2)
assert_eq([item['id'] for item in first['data']], ['b', 'a'])
assert isinstance(first['nextCursor'], str)
assert_eq(first['nextCursor'].isdigit(), False)`
      },
      {
        name: '使用游标取下一页且不重复',
        code: `items = [
    {'id': 'a', 'createdAt': '2026-11-09T00:00:00.000Z'},
    {'id': 'b', 'createdAt': '2026-11-09T00:00:00.000Z'},
    {'id': 'c', 'createdAt': '2026-11-08T00:00:00.000Z'},
]
first = paginate(items, limit=2)
second = paginate(items, limit=2, cursor=first['nextCursor'])
assert_eq([item['id'] for item in second['data']], ['c'])
overlap = [item['id'] for item in first['data'] if item in second['data']]
assert_eq(overlap, [])`
      },
      {
        name: '最后一页返回 None 游标',
        code: `items = [
    {'id': 'a', 'createdAt': '2026-11-09T00:00:00.000Z'},
    {'id': 'b', 'createdAt': '2026-11-08T00:00:00.000Z'},
]
page = paginate(items, limit=2)
assert_eq(len(page['data']), 2)
assert_eq(page['nextCursor'], None)`
      },
      {
        name: '非法游标抛 InvalidCursorError',
        code: `items = [{'id': 'a', 'createdAt': '2026-11-09T00:00:00.000Z'}]
error = None
try:
    paginate(items, cursor='***')
except InvalidCursorError as caught:
    error = caught
assert error is not None
structure_error = None
try:
    paginate(items, cursor='e30')
except InvalidCursorError as caught:
    structure_error = caught
assert structure_error is not None`
      },
      {
        name: '默认 limit 20 且上限 100',
        code: `many = [
    {'id': str(119 - index).zfill(3), 'createdAt': '2026-11-09T00:00:00.000Z'}
    for index in range(120)
]
assert_eq(len(paginate(many)['data']), 20)
capped = paginate(many, limit=1000)
assert_eq(len(capped['data']), 100)
assert capped['nextCursor'] is not None`
      },
      {
        name: '相同时间戳按 id 降序翻页不重复',
        code: `items = [
    {'id': 'a', 'createdAt': '2026-11-09T00:00:00.000Z'},
    {'id': 'b', 'createdAt': '2026-11-09T00:00:00.000Z'},
    {'id': 'c', 'createdAt': '2026-11-09T00:00:00.000Z'},
]
first = paginate(items, limit=1)
second = paginate(items, limit=1, cursor=first['nextCursor'])
assert_eq(first['data'][0]['id'], 'c')
assert_eq(second['data'][0]['id'], 'b')`
      },
      {
        name: '空列表返回空数组与 None',
        code: `assert_eq(paginate([]), {'data': [], 'nextCursor': None})`
      }
    ]
  }
};
