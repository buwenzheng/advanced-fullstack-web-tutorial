export const PYTHON_BLOCKS = {};

export const PYTHON_TRACKS = {
  "s1-l2-ex-1": {
    "starter": "def summarize_explain(plan):\n    if not plan:\n        return {\"seqScans\": 0, \"indexScans\": 0, \"maxRowMisestimate\": 0, \"totalActualTime\": 0, \"warnings\": []}\n    return {\n        \"seqScans\": 1 if \"Seq Scan\" in plan[\"node\"] else 0,\n        \"indexScans\": 1 if \"Index Scan\" in plan[\"node\"] else 0,\n        \"maxRowMisestimate\": max(plan[\"actualRows\"] / plan[\"rows\"], plan[\"rows\"] / plan[\"actualRows\"]),\n        \"totalActualTime\": plan[\"actualTime\"],\n        \"warnings\": [],\n    }\n",
    "solution": "def summarize_explain(plan):\n    result = {\n        \"seqScans\": 0,\n        \"indexScans\": 0,\n        \"maxRowMisestimate\": 0.0,\n        \"totalActualTime\": 0.0,\n        \"warnings\": [],\n    }\n\n    def visit(node):\n        if not node:\n            return\n        name = str(node.get(\"node\", \"\"))\n        if \"Seq Scan\" in name:\n            result[\"seqScans\"] += 1\n        if \"Index Scan\" in name or \"Index Only Scan\" in name:\n            result[\"indexScans\"] += 1\n\n        rows = node.get(\"rows\")\n        actual_rows = node.get(\"actualRows\")\n        if (\n            isinstance(rows, (int, float))\n            and isinstance(actual_rows, (int, float))\n            and rows > 0\n            and actual_rows > 0\n        ):\n            ratio = max(actual_rows / rows, rows / actual_rows)\n            if ratio > result[\"maxRowMisestimate\"]:\n                result[\"maxRowMisestimate\"] = ratio\n            if ratio > 10:\n                result[\"warnings\"].append(\n                    f\"{name}: 估计 {rows} 行，实际 {actual_rows} 行，偏差 {ratio:.1f}x\"\n                )\n\n        time = node.get(\"actualTime\", 0)\n        if isinstance(time, (int, float)):\n            result[\"totalActualTime\"] += time\n        for child in node.get(\"children\") or []:\n            visit(child)\n\n    visit(plan)\n    result[\"maxRowMisestimate\"] = round(result[\"maxRowMisestimate\"], 2)\n    result[\"totalActualTime\"] = round(result[\"totalActualTime\"], 2)\n    return result\n",
    "tests": [
      {
        "name": "纯索引计划不产生 warning",
        "code": "assert_eq(summarize_explain({\"node\": \"Index Scan using links_slug_key on links\", \"rows\": 1, \"actualRows\": 1, \"actualTime\": 0.12}), {\"seqScans\": 0, \"indexScans\": 1, \"maxRowMisestimate\": 1, \"totalActualTime\": 0.12, \"warnings\": []})"
      },
      {
        "name": "Seq Scan 低估 20 倍产生 warning",
        "code": "result = summarize_explain({\"node\": \"Seq Scan on click_events\", \"rows\": 1000, \"actualRows\": 20000, \"actualTime\": 120.5})\nassert_eq(result[\"seqScans\"], 1)\nassert_eq(result[\"indexScans\"], 0)\nassert_eq(result[\"maxRowMisestimate\"], 20)\nassert_eq(result[\"totalActualTime\"], 120.5)\nassert_eq(len(result[\"warnings\"]), 1)\nassert result[\"warnings\"][0].startswith(\"Seq Scan on click_events\")"
      },
      {
        "name": "嵌套循环递归统计子节点与总耗时",
        "code": "assert_eq(summarize_explain({\n    \"node\": \"Nested Loop\", \"rows\": 100, \"actualRows\": 100, \"actualTime\": 5.5,\n    \"children\": [\n        {\"node\": \"Index Scan using links_user_created_idx on links\", \"rows\": 10, \"actualRows\": 10, \"actualTime\": 1.25},\n        {\"node\": \"Seq Scan on click_events\", \"rows\": 1000, \"actualRows\": 1000, \"actualTime\": 0.75},\n    ],\n}), {\"seqScans\": 1, \"indexScans\": 1, \"maxRowMisestimate\": 1, \"totalActualTime\": 7.5, \"warnings\": []})"
      },
      {
        "name": "Index Scan 高估 50 倍也产生 warning",
        "code": "result = summarize_explain({\"node\": \"Index Scan using click_events_link_idx on click_events\", \"rows\": 5000, \"actualRows\": 100, \"actualTime\": 2})\nassert_eq(result[\"maxRowMisestimate\"], 50)\nassert_eq(len(result[\"warnings\"]), 1)\nassert result[\"warnings\"][0].startswith(\"Index Scan\")"
      },
      {
        "name": "Index Only Scan 计入索引扫描并递归子节点",
        "code": "result = summarize_explain({\n    \"node\": \"Index Only Scan using click_events_link_time_idx on click_events\",\n    \"rows\": 10, \"actualRows\": 10, \"actualTime\": 0.12,\n    \"children\": [\n        {\"node\": \"Seq Scan on links\", \"rows\": 100, \"actualRows\": 2000, \"actualTime\": 8.38},\n    ],\n})\nassert_eq(result[\"seqScans\"], 1)\nassert_eq(result[\"indexScans\"], 1)\nassert_eq(result[\"maxRowMisestimate\"], 20)\nassert_eq(result[\"totalActualTime\"], 8.5)\nassert_eq(len(result[\"warnings\"]), 1)\nassert result[\"warnings\"][0].startswith(\"Seq Scan on links\")"
      },
      {
        "name": "空计划返回全零结构",
        "code": "assert_eq(summarize_explain(None), {\"seqScans\": 0, \"indexScans\": 0, \"maxRowMisestimate\": 0, \"totalActualTime\": 0, \"warnings\": []})"
      }
    ]
  },
  "s1-l3-ex-1": {
    "starter": `import asyncio
import inspect


class ConflictError(Exception):
    def __init__(self, id, attempts):
        super().__init__(f"更新 {id} 冲突，已尝试 {attempts} 次")
        self.id = id
        self.attempts = attempts


class NotFoundError(Exception):
    def __init__(self, id):
        super().__init__(f"记录 {id} 不存在")
        self.id = id


async def update_with_retry(store, id, mutate, max_retries=3):
    snapshot = await store.get(id)
    if snapshot is None:
        raise NotFoundError(id)
    result = mutate(snapshot)
    if inspect.isawaitable(result):
        result = await result
    candidate = {**result, "id": id, "version": snapshot["version"] + 1}
    if not await store.compare_and_set(id, snapshot["version"], candidate):
        raise ConflictError(id, 1)
    return candidate
`,
    "solution": `import asyncio
import inspect


class ConflictError(Exception):
    def __init__(self, id, attempts):
        super().__init__(f"更新 {id} 冲突，已尝试 {attempts} 次")
        self.id = id
        self.attempts = attempts


class NotFoundError(Exception):
    def __init__(self, id):
        super().__init__(f"记录 {id} 不存在")
        self.id = id


async def update_with_retry(store, id, mutate, max_retries=3):
    attempts = max(0, int(max_retries)) + 1
    for _ in range(attempts):
        snapshot = await store.get(id)
        if snapshot is None:
            raise NotFoundError(id)

        result = mutate(snapshot)
        if inspect.isawaitable(result):
            result = await result

        candidate = {**result, "id": id, "version": snapshot["version"] + 1}
        if await store.compare_and_set(id, snapshot["version"], candidate):
            return candidate

    raise ConflictError(id, attempts)
`,
    "tests": [
      {
        "name": "无冲突时一次成功并递增版本",
        "async": true,
        "code": `rows = {1: {"id": 1, "count": 0, "version": 1}}

class Store:
    async def get(self, id):
        row = rows.get(id)
        return dict(row) if row else None
    async def compare_and_set(self, id, expected_version, next_record):
        if rows[id]["version"] != expected_version:
            return False
        rows[id] = dict(next_record)
        return True

result = await update_with_retry(Store(), 1, lambda snapshot: {**snapshot, "count": snapshot["count"] + 1})
assert_eq(result, {"id": 1, "count": 1, "version": 2})
assert_eq(rows[1], result)`
      },
      {
        "name": "冲突后基于最新版本重试成功",
        "async": true,
        "code": `rows = {1: {"id": 1, "count": 0, "version": 1}}
calls = {"cas": 0, "mutate": 0}

class Store:
    async def get(self, id):
        return dict(rows[id])
    async def compare_and_set(self, id, expected_version, next_record):
        calls["cas"] += 1
        if calls["cas"] == 1:
            rows[id] = {**rows[id], "count": 5, "version": 2}
            return False
        if rows[id]["version"] != expected_version:
            return False
        rows[id] = dict(next_record)
        return True

def mutate(snapshot):
    calls["mutate"] += 1
    return {**snapshot, "count": snapshot["count"] + 1}

result = await update_with_retry(Store(), 1, mutate)
assert_eq(result["count"], 6)
assert_eq(result["version"], 3)
assert_eq(calls["mutate"], 2)`
      },
      {
        "name": "重试耗尽抛出 ConflictError 并带上尝试次数",
        "async": true,
        "code": `calls = {"cas": 0, "mutate": 0}

class Store:
    async def get(self, id):
        return {"id": id, "count": 0, "version": 1}
    async def compare_and_set(self, id, expected_version, next_record):
        calls["cas"] += 1
        return False

def mutate(snapshot):
    calls["mutate"] += 1
    return {**snapshot}

try:
    await update_with_retry(Store(), 2, mutate, max_retries=2)
except ConflictError as error:
    assert_eq(error.id, 2)
    assert_eq(error.attempts, 3)
else:
    raise AssertionError("expected ConflictError")
assert_eq(calls["cas"], 3)
assert_eq(calls["mutate"], 3)`
      },
      {
        "name": "两个并发更新都生效，不丢更新",
        "async": true,
        "code": `rows = {7: {"id": 7, "count": 0, "version": 1}}
writes = {"count": 0}

class Store:
    async def get(self, id):
        await asyncio.sleep(0)
        row = rows.get(id)
        return dict(row) if row else None
    async def compare_and_set(self, id, expected_version, next_record):
        await asyncio.sleep(0)
        if rows[id]["version"] != expected_version:
            return False
        rows[id] = dict(next_record)
        writes["count"] += 1
        return True

def mutate(snapshot):
    return {**snapshot, "count": snapshot["count"] + 1}

results = await asyncio.gather(
    update_with_retry(Store(), 7, mutate),
    update_with_retry(Store(), 7, mutate),
)
assert_eq(rows[7]["count"], 2)
assert_eq(rows[7]["version"], 3)
assert_eq(writes["count"], 2)
assert_eq(sorted(item["version"] for item in results), [2, 3])`
      },
      {
        "name": "mutate 抛错时不写入并原样传播",
        "async": true,
        "code": `writes = {"count": 0}

class Store:
    async def get(self, id):
        return {"id": id, "count": 0, "version": 1}
    async def compare_and_set(self, id, expected_version, next_record):
        writes["count"] += 1
        return True

def mutate(snapshot):
    raise ValueError("invalid target")

try:
    await update_with_retry(Store(), 3, mutate)
except ValueError as error:
    assert_eq(str(error), "invalid target")
else:
    raise AssertionError("expected ValueError")
assert_eq(writes["count"], 0)`
      },
      {
        "name": "记录不存在时抛 NotFoundError 且不写",
        "async": true,
        "code": `calls = {"cas": 0, "mutate": 0}

class Store:
    async def get(self, id):
        return None
    async def compare_and_set(self, id, expected_version, next_record):
        calls["cas"] += 1
        return True

def mutate(snapshot):
    calls["mutate"] += 1
    return snapshot

try:
    await update_with_retry(Store(), 404, mutate)
except NotFoundError as error:
    assert_eq(error.id, 404)
else:
    raise AssertionError("expected NotFoundError")
assert_eq(calls["cas"], 0)
assert_eq(calls["mutate"], 0)`
      }
    ]
  },
  "s1-schema-ex-1": {
    "starter": `import hashlib


class DuplicateVersionError(Exception):
    def __init__(self, version):
        super().__init__(f"迁移版本重复：{version}")
        self.version = version


class ChecksumMismatchError(Exception):
    def __init__(self, version):
        super().__init__(f"迁移校验和不匹配：{version}")
        self.version = version


class UnknownMigrationError(Exception):
    def __init__(self, version):
        super().__init__(f"找不到已应用的迁移：{version}")
        self.version = version


def checksum_of(migration):
    text = f"{migration['version']}:{migration['name']}:{migration['sql']}"
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class Migrator:
    def __init__(self, migrations, store):
        self.store = store
        self.sorted = sorted(migrations, key=lambda item: item["version"])

    async def up(self):
        for migration in self.sorted:
            async def run(tx, migration=migration):
                await migration["up"](tx)
                await tx.record(migration["version"], checksum_of(migration))
            await self.store.transaction(run)

    async def down(self):
        for migration in reversed(self.sorted):
            async def run(tx, migration=migration):
                await migration["down"](tx)
                await tx.remove(migration["version"])
            await self.store.transaction(run)


def create_migrator(migrations, store):
    return Migrator(migrations, store)
`,
    "solution": `import hashlib


class DuplicateVersionError(Exception):
    def __init__(self, version):
        super().__init__(f"迁移版本重复：{version}")
        self.version = version


class ChecksumMismatchError(Exception):
    def __init__(self, version):
        super().__init__(f"迁移校验和不匹配：{version}")
        self.version = version


class UnknownMigrationError(Exception):
    def __init__(self, version):
        super().__init__(f"找不到已应用的迁移：{version}")
        self.version = version


def checksum_of(migration):
    text = f"{migration['version']}:{migration['name']}:{migration['sql']}"
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class Migrator:
    def __init__(self, migrations, store):
        self.store = store
        self.sorted = sorted(migrations, key=lambda item: item["version"])
        self.by_version = {}
        for migration in self.sorted:
            if migration["version"] in self.by_version:
                raise DuplicateVersionError(migration["version"])
            self.by_version[migration["version"]] = migration

    async def _read_applied(self):
        applied = await self.store.applied()
        for record in applied:
            migration = self.by_version.get(record["version"])
            if migration is None:
                raise UnknownMigrationError(record["version"])
            if checksum_of(migration) != record["checksum"]:
                raise ChecksumMismatchError(record["version"])
        return applied

    async def up(self):
        applied = await self._read_applied()
        done = {record["version"] for record in applied}
        for migration in self.sorted:
            if migration["version"] in done:
                continue
            async def run(tx, migration=migration):
                await migration["up"](tx)
                await tx.record(migration["version"], checksum_of(migration))
            await self.store.transaction(run)

    async def down(self):
        applied = await self._read_applied()
        targets = sorted(
            (self.by_version[record["version"]] for record in applied),
            key=lambda item: item["version"],
            reverse=True,
        )
        for migration in targets:
            async def run(tx, migration=migration):
                await migration["down"](tx)
                await tx.remove(migration["version"])
            await self.store.transaction(run)


def create_migrator(migrations, store):
    return Migrator(migrations, store)
`,
    "tests": [
      {
        "name": "空库按版本升序执行全部迁移",
        "async": true,
        "code": `from types import SimpleNamespace

def make_store(initial):
    state = {"records": dict(initial), "log": []}
    async def applied():
        return [{"version": v, "checksum": c} for v, c in sorted(state["records"].items())]
    async def transaction(fn):
        snapshot = dict(state["records"])
        class Tx:
            async def record(self, version, checksum):
                state["records"][version] = checksum
                state["log"].append(("record", version))
            async def remove(self, version):
                state["records"].pop(version, None)
                state["log"].append(("remove", version))
        try:
            await fn(Tx())
        except Exception:
            state["records"].clear()
            state["records"].update(snapshot)
            raise
    return SimpleNamespace(applied=applied, transaction=transaction), state

def make_migrations(log):
    def make(version):
        async def up(tx):
            log.append(f"up:{version}")
        async def down(tx):
            log.append(f"down:{version}")
        return {"version": version, "name": f"m{version}", "sql": f"SQL {version}", "up": up, "down": down}
    return [make(version) for version in (1, 2, 3)]

log = []
migrations = make_migrations(log)
store, state = make_store({})
await create_migrator(migrations, store).up()
assert_eq(sorted(state["records"].keys()), [1, 2, 3])
assert_eq([item for item in log if item.startswith("up:")], ["up:1", "up:2", "up:3"])
for migration in migrations:
    assert_eq(state["records"][migration["version"]], checksum_of(migration))`
      },
      {
        "name": "已应用且校验和一致时跳过，up 可重复执行",
        "async": true,
        "code": `from types import SimpleNamespace

def make_store(initial):
    state = {"records": dict(initial), "log": []}
    async def applied():
        return [{"version": v, "checksum": c} for v, c in sorted(state["records"].items())]
    async def transaction(fn):
        snapshot = dict(state["records"])
        class Tx:
            async def record(self, version, checksum):
                state["records"][version] = checksum
                state["log"].append(("record", version))
            async def remove(self, version):
                state["records"].pop(version, None)
                state["log"].append(("remove", version))
        try:
            await fn(Tx())
        except Exception:
            state["records"].clear()
            state["records"].update(snapshot)
            raise
    return SimpleNamespace(applied=applied, transaction=transaction), state

def make_migrations(log):
    def make(version):
        async def up(tx):
            log.append(f"up:{version}")
        async def down(tx):
            log.append(f"down:{version}")
        return {"version": version, "name": f"m{version}", "sql": f"SQL {version}", "up": up, "down": down}
    return [make(version) for version in (1, 2, 3)]

log = []
migrations = make_migrations(log)
store, state = make_store({1: checksum_of(migrations[0])})
migrator = create_migrator(migrations, store)
await migrator.up()
await migrator.up()
assert_eq([item for item in log if item == "up:1"], [])
assert_eq([item for item in log if item == "up:2"], ["up:2"])
assert_eq([item for item in log if item == "up:3"], ["up:3"])`
      },
      {
        "name": "校验和不匹配时拒绝执行任何迁移",
        "async": true,
        "code": `from types import SimpleNamespace

def make_store(initial):
    state = {"records": dict(initial), "log": []}
    async def applied():
        return [{"version": v, "checksum": c} for v, c in sorted(state["records"].items())]
    async def transaction(fn):
        snapshot = dict(state["records"])
        class Tx:
            async def record(self, version, checksum):
                state["records"][version] = checksum
                state["log"].append(("record", version))
            async def remove(self, version):
                state["records"].pop(version, None)
                state["log"].append(("remove", version))
        try:
            await fn(Tx())
        except Exception:
            state["records"].clear()
            state["records"].update(snapshot)
            raise
    return SimpleNamespace(applied=applied, transaction=transaction), state

def make_migrations(log):
    def make(version):
        async def up(tx):
            log.append(f"up:{version}")
        async def down(tx):
            log.append(f"down:{version}")
        return {"version": version, "name": f"m{version}", "sql": f"SQL {version}", "up": up, "down": down}
    return [make(version) for version in (1, 2)]

log = []
migrations = make_migrations(log)
store, state = make_store({1: "deadbeef"})
error = None
try:
    await create_migrator(migrations, store).up()
except ChecksumMismatchError as caught:
    error = caught
assert_eq(error.version, 1)
assert_eq(log, [])`
      },
      {
        "name": "重复版本在创建时立即拒绝",
        "async": true,
        "code": `base = {"version": 1, "name": "a", "sql": "A", "up": None, "down": None}
error = None
try:
    create_migrator([base, {**base, "name": "b"}], None)
except DuplicateVersionError as caught:
    error = caught
assert_eq(error.version, 1)`
      },
      {
        "name": "迁移失败时中止并回滚当前事务",
        "async": true,
        "code": `from types import SimpleNamespace

def make_store(initial):
    state = {"records": dict(initial), "log": []}
    async def applied():
        return [{"version": v, "checksum": c} for v, c in sorted(state["records"].items())]
    async def transaction(fn):
        snapshot = dict(state["records"])
        class Tx:
            async def record(self, version, checksum):
                state["records"][version] = checksum
                state["log"].append(("record", version))
            async def remove(self, version):
                state["records"].pop(version, None)
                state["log"].append(("remove", version))
        try:
            await fn(Tx())
        except Exception:
            state["records"].clear()
            state["records"].update(snapshot)
            raise
    return SimpleNamespace(applied=applied, transaction=transaction), state

def make_migrations(log):
    def make(version):
        async def up(tx):
            log.append(f"up:{version}")
            if version == 2:
                raise RuntimeError("boom")
        async def down(tx):
            log.append(f"down:{version}")
        return {"version": version, "name": f"m{version}", "sql": f"SQL {version}", "up": up, "down": down}
    return [make(version) for version in (1, 2, 3)]

log = []
migrations = make_migrations(log)
store, state = make_store({1: checksum_of(migrations[0])})
error = None
try:
    await create_migrator(migrations, store).up()
except RuntimeError as caught:
    error = caught
assert_eq(str(error), "boom")
assert_eq(sorted(state["records"].keys()), [1])
assert "up:3" not in log
assert "record:3" not in state["log"]`
      },
      {
        "name": "down 按版本逆序回滚并删除记录",
        "async": true,
        "code": `from types import SimpleNamespace

def make_store(initial):
    state = {"records": dict(initial), "log": []}
    async def applied():
        return [{"version": v, "checksum": c} for v, c in sorted(state["records"].items())]
    async def transaction(fn):
        snapshot = dict(state["records"])
        class Tx:
            async def record(self, version, checksum):
                state["records"][version] = checksum
                state["log"].append(("record", version))
            async def remove(self, version):
                state["records"].pop(version, None)
                state["log"].append(("remove", version))
        try:
            await fn(Tx())
        except Exception:
            state["records"].clear()
            state["records"].update(snapshot)
            raise
    return SimpleNamespace(applied=applied, transaction=transaction), state

def make_migrations(log):
    def make(version):
        async def up(tx):
            log.append(f"up:{version}")
        async def down(tx):
            log.append(f"down:{version}")
        return {"version": version, "name": f"m{version}", "sql": f"SQL {version}", "up": up, "down": down}
    return [make(version) for version in (1, 2, 3)]

log = []
migrations = make_migrations(log)
store, state = make_store({
    1: checksum_of(migrations[0]),
    2: checksum_of(migrations[1]),
    3: checksum_of(migrations[2]),
})
await create_migrator(migrations, store).down()
assert_eq(log, ["down:3", "down:2", "down:1"])
assert_eq(state["records"], {})`
      },
      {
        "name": "down 失败时停止并回滚当前事务",
        "async": true,
        "code": `from types import SimpleNamespace

def make_store(initial):
    state = {"records": dict(initial), "log": []}
    async def applied():
        return [{"version": v, "checksum": c} for v, c in sorted(state["records"].items())]
    async def transaction(fn):
        snapshot = dict(state["records"])
        class Tx:
            async def record(self, version, checksum):
                state["records"][version] = checksum
                state["log"].append(("record", version))
            async def remove(self, version):
                state["records"].pop(version, None)
                state["log"].append(("remove", version))
        try:
            await fn(Tx())
        except Exception:
            state["records"].clear()
            state["records"].update(snapshot)
            raise
    return SimpleNamespace(applied=applied, transaction=transaction), state

def make_migrations(log):
    def make(version):
        async def up(tx):
            log.append(f"up:{version}")
        async def down(tx):
            log.append(f"down:{version}")
            if version == 3:
                raise RuntimeError("boom")
        return {"version": version, "name": f"m{version}", "sql": f"SQL {version}", "up": up, "down": down}
    return [make(version) for version in (1, 2, 3)]

log = []
migrations = make_migrations(log)
store, state = make_store({
    1: checksum_of(migrations[0]),
    2: checksum_of(migrations[1]),
    3: checksum_of(migrations[2]),
})
error = None
try:
    await create_migrator(migrations, store).down()
except RuntimeError as caught:
    error = caught
assert_eq(str(error), "boom")
assert_eq(log, ["down:3"])
assert_eq(sorted(state["records"].keys()), [1, 2, 3])`
      }
    ]
  }
};
