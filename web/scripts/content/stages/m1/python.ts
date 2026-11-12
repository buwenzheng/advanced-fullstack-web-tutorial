import type { PythonBlockMap, PythonTrackMap } from '../../types.js';
export const PYTHON_BLOCKS = {
  "m1-http": [
    {
      "code": "from http.server import BaseHTTPRequestHandler, HTTPServer\n\nROUTES = {\"go\": \"https://example.com/docs?from=linkhub\"}\n\n\nclass Handler(BaseHTTPRequestHandler):\n    def do_GET(self):\n        if self.path == \"/health\":\n            body = b'{\"ok\": true}'\n            self.send_response(200)\n            self.send_header(\"Content-Type\", \"application/json\")\n            self.send_header(\"Content-Length\", str(len(body)))\n            self.end_headers()\n            self.wfile.write(body)\n            return\n\n        code = self.path.strip(\"/\")\n        target = ROUTES.get(code)\n        if target is None:\n            body = b'{\"error\": \"not_found\"}'\n            self.send_response(404)\n            self.send_header(\"Content-Type\", \"application/json\")\n            self.send_header(\"Content-Length\", str(len(body)))\n            self.end_headers()\n            self.wfile.write(body)\n            return\n\n        self.send_response(302)\n        self.send_header(\"Location\", target)\n        self.send_header(\"Cache-Control\", \"no-store\")\n        self.end_headers()\n\n\nHTTPServer((\"127.0.0.1\", 3000), Handler).serve_forever()\n",
      "note": "Python 标准库同样可以用二十多行完成最短跳转契约；生产环境通常交给 Web 框架与反向代理。"
    }
  ],
  "m1-runtime": [
    {
      "code": "import asyncio\n\n\nasync def main():\n    print(\"A sync\")\n    loop = asyncio.get_running_loop()\n    loop.call_soon(lambda: print(\"B call_soon\"))\n    asyncio.create_task(asyncio.sleep(0, result=None))\n    await asyncio.sleep(0)\n    print(\"C after sleep(0)\")\n    await asyncio.sleep(0.01)\n    print(\"D after timer\")\n\n\nasyncio.run(main())\n",
      "note": "asyncio 只有一个就绪队列，没有 nextTick 与 Promise 微任务的区分；不要照搬 Node 的顺序结论。"
    }
  ]
} satisfies PythonBlockMap;

export const PYTHON_TRACKS = {
  "m1-http-ex-1": {
    "starter": "def analyze_timings(timings):\n    namelookup = timings[\"namelookup\"]\n    connect = timings[\"connect\"]\n    appconnect = timings[\"appconnect\"]\n    starttransfer = timings[\"starttransfer\"]\n    total = timings[\"total\"]\n    return {\n        \"dns\": namelookup * 1000,\n        \"tcp\": (connect - namelookup) * 1000,\n        \"tls\": (appconnect - connect) * 1000,\n        \"server\": (starttransfer - appconnect) * 1000,\n        \"transfer\": (total - starttransfer) * 1000,\n        \"total\": total * 1000,\n        \"slowest\": \"server\",\n    }\n",
    "solution": "import math\n\n\ndef analyze_timings(timings):\n    keys = [\"namelookup\", \"connect\", \"appconnect\", \"starttransfer\", \"total\"]\n    if not isinstance(timings, dict):\n        raise ValueError(\"invalid timings\")\n\n    values = []\n    for key in keys:\n        value = timings.get(key)\n        if isinstance(value, bool) or not isinstance(value, (int, float)):\n            raise ValueError(\"invalid timings\")\n        if not math.isfinite(value) or value < 0:\n            raise ValueError(\"invalid timings\")\n        values.append(float(value))\n\n    for left, right in zip(values, values[1:]):\n        if right < left:\n            raise ValueError(\"invalid timings\")\n\n    namelookup, connect, appconnect, starttransfer, total = values\n    result = {\n        \"dns\": round(namelookup * 1000, 1),\n        \"tcp\": round((connect - namelookup) * 1000, 1),\n        \"tls\": round((appconnect - connect) * 1000, 1),\n        \"server\": round((starttransfer - appconnect) * 1000, 1),\n        \"transfer\": round((total - starttransfer) * 1000, 1),\n        \"total\": round(total * 1000, 1),\n    }\n\n    order = [\"dns\", \"tcp\", \"tls\", \"server\", \"transfer\"]\n    slowest = order[0]\n    for key in order:\n        if result[key] > result[slowest]:\n            slowest = key\n    result[\"slowest\"] = slowest\n    return result\n",
    "tests": [
      {
        "name": "正常 HTTPS 冷请求拆成五段",
        "code": "assert_eq(analyze_timings({\"namelookup\": 0.02, \"connect\": 0.05, \"appconnect\": 0.12, \"starttransfer\": 0.4, \"total\": 0.5}), {\"dns\": 20, \"tcp\": 30, \"tls\": 70, \"server\": 280, \"transfer\": 100, \"total\": 500, \"slowest\": \"server\"})"
      },
      {
        "name": "连接复用时前三段为 0",
        "code": "assert_eq(analyze_timings({\"namelookup\": 0, \"connect\": 0, \"appconnect\": 0, \"starttransfer\": 0.08, \"total\": 0.09}), {\"dns\": 0, \"tcp\": 0, \"tls\": 0, \"server\": 80, \"transfer\": 10, \"total\": 90, \"slowest\": \"server\"})"
      },
      {
        "name": "TLS 最慢时归因到 tls",
        "code": "assert_eq(analyze_timings({\"namelookup\": 0.01, \"connect\": 0.03, \"appconnect\": 0.25, \"starttransfer\": 0.28, \"total\": 0.3}), {\"dns\": 10, \"tcp\": 20, \"tls\": 220, \"server\": 30, \"transfer\": 20, \"total\": 300, \"slowest\": \"tls\"})"
      },
      {
        "name": "非单调输入抛出 invalid timings",
        "code": "try:\n    analyze_timings({\"namelookup\": 0.05, \"connect\": 0.03, \"appconnect\": 0.12, \"starttransfer\": 0.4, \"total\": 0.5})\nexcept ValueError as exc:\n    assert_eq(str(exc), \"invalid timings\")\nelse:\n    raise AssertionError(\"expected ValueError\")"
      },
      {
        "name": "耗时四舍五入到 1 位小数",
        "code": "assert_eq(analyze_timings({\"namelookup\": 0.0001, \"connect\": 0.0003, \"appconnect\": 0.0006, \"starttransfer\": 0.001, \"total\": 0.0015}), {\"dns\": 0.1, \"tcp\": 0.2, \"tls\": 0.3, \"server\": 0.4, \"transfer\": 0.5, \"total\": 1.5, \"slowest\": \"transfer\"})"
      },
      {
        "name": "并列最大值按固定顺序取 dns",
        "code": "assert_eq(analyze_timings({\"namelookup\": 0.01, \"connect\": 0.02, \"appconnect\": 0.03, \"starttransfer\": 0.04, \"total\": 0.05}), {\"dns\": 10, \"tcp\": 10, \"tls\": 10, \"server\": 10, \"transfer\": 10, \"total\": 50, \"slowest\": \"dns\"})"
      }
    ]
  },
  "m1-runtime-ex-1": {
    "starter": "import asyncio\n\n\nasync def run_with_limit(tasks, limit):\n    return await asyncio.gather(*(task() for task in tasks))\n",
    "solution": "import asyncio\n\n\nasync def run_with_limit(tasks, limit):\n    total = len(tasks)\n    if total == 0:\n        return []\n    if isinstance(limit, bool) or not isinstance(limit, int) or limit <= 0:\n        max_workers = 1\n    else:\n        max_workers = min(limit, total)\n\n    results = [None] * total\n    cursor = 0\n\n    async def worker():\n        nonlocal cursor\n        while cursor < total:\n            index = cursor\n            cursor += 1\n            results[index] = await tasks[index]()\n\n    workers = [asyncio.create_task(worker()) for _ in range(max_workers)]\n    try:\n        await asyncio.gather(*workers)\n    except BaseException:\n        for worker_task in workers:\n            worker_task.cancel()\n        await asyncio.gather(*workers, return_exceptions=True)\n        raise\n    return results\n",
    "tests": [
      {
        "name": "峰值并发不超过上限",
        "async": true,
        "code": "async def flush():\n    for _ in range(20):\n        await asyncio.sleep(0)\n\nactive = {\"now\": 0, \"peak\": 0}\ngates = {}\n\ndef make(index):\n    async def task():\n        active[\"now\"] += 1\n        active[\"peak\"] = max(active[\"peak\"], active[\"now\"])\n        future = asyncio.get_running_loop().create_future()\n        gates[index] = future\n        try:\n            return await future\n        finally:\n            active[\"now\"] -= 1\n    return task\n\ntasks = [make(index) for index in range(4)]\nrunner = asyncio.create_task(run_with_limit(tasks, 2))\nawait flush()\nassert_eq(len(gates), 2)\ngates[0].set_result(0)\nawait flush()\nassert_eq(len(gates), 3)\ngates[1].set_result(1)\nawait flush()\nassert_eq(len(gates), 4)\ngates[2].set_result(2)\ngates[3].set_result(3)\nassert_eq(await runner, [0, 1, 2, 3])\nassert_eq(active[\"peak\"], 2)"
      },
      {
        "name": "结果顺序与完成顺序解耦",
        "async": true,
        "code": "async def flush():\n    for _ in range(20):\n        await asyncio.sleep(0)\n\ngates = {}\n\ndef make(index, value):\n    async def task():\n        future = asyncio.get_running_loop().create_future()\n        gates[index] = future\n        return await future\n    return task\n\ntasks = [make(index, value) for index, value in enumerate([\"a\", \"b\", \"c\"])]\nrunner = asyncio.create_task(run_with_limit(tasks, 3))\nawait flush()\nassert_eq(len(gates), 3)\ngates[1].set_result(\"b\")\nawait flush()\ngates[2].set_result(\"c\")\nawait flush()\ngates[0].set_result(\"a\")\nassert_eq(await runner, [\"a\", \"b\", \"c\"])"
      },
      {
        "name": "任务拒绝时整体拒绝",
        "async": true,
        "code": "async def flush():\n    for _ in range(20):\n        await asyncio.sleep(0)\n\ngates = {}\n\ndef make(index):\n    async def task():\n        future = asyncio.get_running_loop().create_future()\n        gates[index] = future\n        return await future\n    return task\n\ntasks = [make(index) for index in range(3)]\nrunner = asyncio.create_task(run_with_limit(tasks, 2))\nawait flush()\nassert_eq(len(gates), 2)\ngates[1].set_exception(RuntimeError(\"boom\"))\ntry:\n    await runner\nexcept RuntimeError as exc:\n    assert_eq(str(exc), \"boom\")\nelse:\n    raise AssertionError(\"expected RuntimeError\")"
      },
      {
        "name": "limit=0 按 1 处理",
        "async": true,
        "code": "async def flush():\n    for _ in range(20):\n        await asyncio.sleep(0)\n\nactive = {\"now\": 0, \"peak\": 0}\ngates = {}\n\ndef make(index):\n    async def task():\n        active[\"now\"] += 1\n        active[\"peak\"] = max(active[\"peak\"], active[\"now\"])\n        future = asyncio.get_running_loop().create_future()\n        gates[index] = future\n        try:\n            return await future\n        finally:\n            active[\"now\"] -= 1\n    return task\n\ntasks = [make(index) for index in range(3)]\nrunner = asyncio.create_task(run_with_limit(tasks, 0))\nawait flush()\nassert_eq(len(gates), 1)\ngates[0].set_result(0)\nawait flush()\nassert_eq(len(gates), 2)\ngates[1].set_result(1)\nawait flush()\nassert_eq(len(gates), 3)\ngates[2].set_result(2)\nassert_eq(await runner, [0, 1, 2])\nassert_eq(active[\"peak\"], 1)"
      },
      {
        "name": "limit 大于任务数时全部启动",
        "async": true,
        "code": "async def flush():\n    for _ in range(20):\n        await asyncio.sleep(0)\n\ngates = {}\n\ndef make(index):\n    async def task():\n        future = asyncio.get_running_loop().create_future()\n        gates[index] = future\n        return await future\n    return task\n\ntasks = [make(index) for index in range(2)]\nrunner = asyncio.create_task(run_with_limit(tasks, 10))\nawait flush()\nassert_eq(len(gates), 2)\ngates[0].set_result(0)\ngates[1].set_result(1)\nassert_eq(await runner, [0, 1])"
      },
      {
        "name": "空数组立即返回空结果",
        "async": true,
        "code": "result = await run_with_limit([], 2)\nassert_eq(result, [])"
      }
    ]
  },
  "m1-cli-ex-1": {
    "starter": "import re\n\n\ndef parse_listeners(output):\n    entries = []\n    for line in str(output or \"\").splitlines():\n        match = re.search(r\"(\\d+\\.\\d+\\.\\d+\\.\\d+):(\\d+).*pid=(\\d+)\", line)\n        if match:\n            entries.append({\n                \"address\": match.group(1),\n                \"port\": int(match.group(2)),\n                \"pid\": int(match.group(3)),\n                \"process\": \"node\",\n            })\n    return entries\n",
    "solution": "import re\n\n\ndef parse_listeners(output):\n    entries = []\n    for raw in str(output or \"\").splitlines():\n        line = raw.strip()\n        if not line:\n            continue\n        entry = None\n\n        if line.startswith(\"LISTEN\"):\n            parts = line.split()\n            if len(parts) < 4:\n                continue\n            match = re.match(r\"^(.*):(\\d+)$\", parts[3])\n            if not match:\n                continue\n            address = match.group(1)\n            if address.startswith(\"[\") and address.endswith(\"]\"):\n                address = address[1:-1]\n            user = re.search(r'users:\\(\\(\"([^\"]+)\",pid=(\\d+)', line)\n            entry = {\n                \"address\": address,\n                \"port\": int(match.group(2)),\n                \"pid\": int(user.group(2)) if user else None,\n                \"process\": user.group(1) if user else None,\n            }\n        elif \"(LISTEN)\" in line:\n            parts = line.split()\n            if len(parts) < 2 or not parts[1].isdigit():\n                continue\n            try:\n                protocol_index = parts.index(\"TCP\")\n            except ValueError:\n                try:\n                    protocol_index = parts.index(\"TCP6\")\n                except ValueError:\n                    continue\n            if protocol_index + 1 >= len(parts):\n                continue\n            match = re.match(r\"^(.*):(\\d+)$\", parts[protocol_index + 1])\n            if not match:\n                continue\n            address = match.group(1)\n            if address.startswith(\"[\") and address.endswith(\"]\"):\n                address = address[1:-1]\n            entry = {\n                \"address\": address,\n                \"port\": int(match.group(2)),\n                \"pid\": int(parts[1]),\n                \"process\": parts[0],\n            }\n\n        if entry:\n            entries.append(entry)\n\n    return sorted(entries, key=lambda item: item[\"port\"])\n",
    "tests": [
      {
        "name": "解析 IPv4 ss 行",
        "code": "assert_eq(parse_listeners('LISTEN 0 511 0.0.0.0:3000 0.0.0.0:* users:((\"node\",pid=1234,fd=23))'), [{\"address\": \"0.0.0.0\", \"port\": 3000, \"pid\": 1234, \"process\": \"node\"}])"
      },
      {
        "name": "解析 IPv6 ss 行",
        "code": "assert_eq(parse_listeners('LISTEN 0 511 [::]:3000 [::]:* users:((\"node\",pid=1234,fd=24))'), [{\"address\": \"::\", \"port\": 3000, \"pid\": 1234, \"process\": \"node\"}])"
      },
      {
        "name": "同一进程的 IPv4 与 IPv6 两行都保留",
        "code": "output = \"\\n\".join([\n    'LISTEN 0 511 0.0.0.0:3000 0.0.0.0:* users:((\"node\",pid=1234,fd=23))',\n    'LISTEN 0 511 [::]:3000 [::]:* users:((\"node\",pid=1234,fd=24))',\n])\nassert_eq(parse_listeners(output), [\n    {\"address\": \"0.0.0.0\", \"port\": 3000, \"pid\": 1234, \"process\": \"node\"},\n    {\"address\": \"::\", \"port\": 3000, \"pid\": 1234, \"process\": \"node\"},\n])"
      },
      {
        "name": "两个进程的监听各自保留 PID",
        "code": "output = \"\\n\".join([\n    'LISTEN 0 511 0.0.0.0:3000 0.0.0.0:* users:((\"node\",pid=1234,fd=23))',\n    'LISTEN 0 511 127.0.0.1:8000 0.0.0.0:* users:((\"python3\",pid=5678,fd=5))',\n])\nassert_eq([(item[\"port\"], item[\"pid\"], item[\"process\"]) for item in parse_listeners(output)], [(3000, 1234, \"node\"), (8000, 5678, \"python3\")])"
      },
      {
        "name": "权限不足时保留端口并把 PID 置空",
        "code": "assert_eq(parse_listeners('LISTEN 0 128 127.0.0.1:5432 0.0.0.0:*'), [{\"address\": \"127.0.0.1\", \"port\": 5432, \"pid\": None, \"process\": None}])"
      },
      {
        "name": "畸形行跳过，只返回有效监听",
        "code": "output = \"\\n\".join([\n    \"\",\n    \"LISTEN garbage\",\n    \"not a listener\",\n    'LISTEN 0 511 127.0.0.1:9000 0.0.0.0:* users:((\"node\",pid=77,fd=9))',\n])\nassert_eq(parse_listeners(output), [{\"address\": \"127.0.0.1\", \"port\": 9000, \"pid\": 77, \"process\": \"node\"}])"
      },
      {
        "name": "端口按数字升序排列",
        "code": "output = \"\\n\".join([\n    \"LISTEN 0 511 0.0.0.0:5432 0.0.0.0:*\",\n    \"LISTEN 0 511 0.0.0.0:80 0.0.0.0:*\",\n    \"LISTEN 0 511 0.0.0.0:3000 0.0.0.0:*\",\n])\nassert_eq([item[\"port\"] for item in parse_listeners(output)], [80, 3000, 5432])"
      },
      {
        "name": "解析 lsof 风格行",
        "code": "assert_eq(parse_listeners('node 4321 alice 23u IPv4 0x1234 0t0 TCP 127.0.0.1:8080 (LISTEN)'), [{\"address\": \"127.0.0.1\", \"port\": 8080, \"pid\": 4321, \"process\": \"node\"}])"
      }
    ]
  }
} satisfies PythonTrackMap;
