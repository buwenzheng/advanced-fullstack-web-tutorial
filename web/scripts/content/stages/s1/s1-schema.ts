export const s1Schema = {
  id: 's1-schema',
  title: '数据建模、约束与迁移',
  subtitle: '唯一/CHECK/外键、软删除唯一性、版本化迁移与零停机变更。',
  duration: 75,
  status: 'ready',
  objectives: [
    '用唯一、CHECK、外键与部分唯一索引表达业务不变量，解释每条约束在防哪种非法状态。',
    '写出带版本、校验和、可逆 down 的迁移，并说明为什么已应用的迁移不能改写。',
    '设计 expand-contract 的零停机变更，让每一步都能独立回滚。',
    '从空库与旧版库各跑一次迁移并验证，识别会锁表、长时间回填或不可逆的破坏性操作。'
  ],
  keywords: ['约束', '唯一索引', 'CHECK', '外键', '软删除', '迁移', '校验和', '零停机'],
  blocks: [
    {
      type: 'analogy',
      title: 'TS 类型 vs 数据库约束',
      html: 'TypeScript 的 <code>interface Link</code> 像一道门禁：它能在编译期拦住「把字符串传给数字字段」这类错误，让编辑器提前报红。但门禁只保护经过它的代码，保护不了另一个服务、一次性脚本、历史数据，也保护不了两个并发请求同时插入同一个 slug。<br>数据库约束是运行期的最后一道防线：唯一约束、外键与 CHECK 在每次写入时执行，不管写入来自哪个进程。这个类比在业务规则处失效：数据库约束擅长表达「不能重复」「不能引用不存在的行」这类局部规则，跨表、跨服务的复杂不变量仍然需要应用逻辑与事务配合。'
    },
    {
      type: 'text',
      title: '约束表达不变量',
      html: '约束的价值在于把「不应该发生」写成数据库能拒绝的规则，而不是散落在应用各处的 if。<code>NOT NULL</code> 防止缺值；<code>UNIQUE</code> 防止重复；<code>CHECK</code> 防止非法组合，例如过期时间早于创建时间；外键防止孤儿行，例如点击事件引用不存在的链接。<br>软删除会改变唯一性的含义：如果 <code>deleted_at</code> 为空表示有效，普通的 slug 唯一索引会把已删除行也算进去，导致 slug 不能复用。PostgreSQL 可以用部分唯一索引只约束 <code>deleted_at IS NULL</code> 的行；其他数据库若不支持部分索引，需要生成列或独立活动表等等价方案。<br>约束不是越多越好：每条约束都要能说出它在防哪种非法状态，并承担对应的写入与迁移成本。'
    },
    {
      type: 'table',
      title: 'LinkHub 约束清单',
      head: ['表', '约束', '防什么', '违反时的表现'],
      rows: [
        ['links', '(tenant_id, slug) 部分唯一，条件 deleted_at IS NULL', '有效链接重名，同时允许删除后复用 slug', '唯一冲突，PostgreSQL SQLSTATE 23505'],
        ['links', 'target_url NOT NULL 且 CHECK 非空白', '空目标或只有空格的地址', 'NOT NULL / CHECK 失败'],
        ['links', 'expires_at IS NULL OR expires_at > created_at', '过期时间早于创建时间', 'CHECK 失败'],
        ['links', 'user_id REFERENCES users(id)', '引用不存在的用户', '外键失败'],
        ['click_events', 'link_id REFERENCES links(id)', '孤儿点击记录', '外键失败'],
        ['click_events', 'clicked_at NOT NULL', '无法排序、统计与排查', 'NOT NULL 失败'],
        ['links', 'deleted_at 软删除字段', '物理删除丢失历史与外键引用', '查询必须显式过滤']
      ]
    },
    {
      type: 'flow',
      title: '迁移生命周期',
      steps: [
        { name: '读取已应用版本', detail: '从版本表读取已执行的 migration 与 checksum。失败表现：没有版本表或记录不全，无法判断当前 schema 状态。' },
        { name: '校验 checksum', detail: '逐条比较已应用迁移的 checksum 与当前文件。失败表现：有人改写了已应用的迁移，环境之间 schema 悄悄分叉。' },
        { name: '按版本升序执行 up', detail: '跳过已应用版本，把每个待执行迁移包在事务里。失败表现：顺序错乱导致外键引用不存在的表。' },
        { name: '记录版本与日志', detail: '迁移与版本记录同一事务提交，保证「执行了但没记录」或「记录了但没执行」不会发生。失败表现：失败后状态已写，下次启动误判。' },
        { name: '验证并保留回滚点', detail: '执行数据校验与 smoke test，确认 down 或人工回滚脚本可用。失败表现：上线后才发现约束不兼容旧代码。' }
      ]
    },
    {
      type: 'code',
      title: '最小迁移运行器',
      lang: 'javascript',
      code: `function checksumOf(migration) {
  const text = migration.version + ':' + migration.name + ':' + migration.sql;
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

async function migrateUp({ migrations, store }) {
  const applied = await store.applied();
  const appliedVersions = new Map(applied.map((row) => [row.version, row.checksum]));
  const sorted = [...migrations].sort((a, b) => a.version - b.version);

  for (const migration of sorted) {
    if (appliedVersions.has(migration.version)) {
      if (appliedVersions.get(migration.version) !== checksumOf(migration)) {
        throw new Error('checksum mismatch: ' + migration.version);
      }
      continue;
    }
    await store.transaction(async (tx) => {
      await migration.up(tx);
      await tx.record(migration.version, checksumOf(migration));
    });
  }
}`,
      note: '这是教学校验和（FNV-1a 32 位），只用于发现内容变化；生产环境应使用 SHA-256 或迁移文件内容哈希。版本记录必须与迁移在同一个事务里提交。'
    },
    {
      type: 'steps',
      title: '零停机加 NOT NULL 列',
      steps: [
        { title: '加可空列', html: '先执行 <code>ADD COLUMN tenant_id ... NULL</code>，旧代码不需要修改即可继续读写。观察点：新列存在，旧查询不受影响。' },
        { title: '分批回填', html: '按主键范围或时间窗口分批更新，记录进度并保证可重入。观察点：每批行数、耗时与失败重试可见，不形成长事务。' },
        { title: '应用双写', html: '新代码同时写旧路径与新列，覆盖灰度与回滚窗口。观察点：新旧版本并行时数据仍完整。' },
        { title: '校验数据', html: '统计空值、行数与抽样对比，确认回填没有漏行或错行。观察点：空值计数为 0，抽样结果一致。' },
        { title: '收紧约束', html: '在数据完整后加 <code>NOT NULL</code> 或约束；大表可先用 <code>NOT VALID</code> 再加 <code>VALIDATE CONSTRAINT</code>。观察点：约束生效且没有长时间锁表。' },
        { title: '清理旧路径', html: '确认新路径稳定后再删除旧列或旧代码分支。观察点：回滚窗口结束，旧路径无调用。' }
      ]
    },
    {
      type: 'pitfall',
      title: '破坏性迁移',
      html: '现象：迁移上线后旧实例报「列不存在」，数据库出现长时间锁等待，回滚时发现没有 down，或者仓库里出现了生产密钥。<br>原因：代码与 schema 没有兼容窗口就删列或改类型；在一个事务里全表回填；迁移只有 up 没有回滚方案；把种子数据当成联调捷径。<br>发现方式：迁移前在影子库用生产规模数据演练；检查迁移 diff 是否包含删列、改类型、全表更新；观察锁等待与迁移耗时；用密钥扫描检查 <code>seed.sql</code>。<br>修复：止损是回滚应用或恢复备份；根治是把变更拆成 expand-contract、分批回填、补齐 down 与数据校验。<br>预防：迁移评审清单、CI 校验 checksum 与 down、种子只放合成数据、敏感配置由环境注入。'
    },
    {
      type: 'compare',
      title: '迁移框架 vs 原生 SQL',
      cols: [
        {
          title: '迁移框架',
          items: ['版本记录与执行顺序自动维护', '提供 up/down 命令与团队协作流程', '校验和可发现已应用迁移被改写', '需要学习框架约定与配置', '适用：多人协作、长期演进的项目']
        },
        {
          title: '原生 SQL 脚本',
          items: ['完全控制 DDL 与数据库特性', '脚本可审计、可直接在 psql 执行', '版本记录与顺序要手工维护', '容易漏掉回滚与校验和', '适用：一次性变更、受限环境、学习原理']
        }
      ]
    },
    {
      type: 'text',
      title: '深挖：锁级别与在线 DDL',
      html: '「加个索引，几秒就好」是不可靠的承诺。ALTER TABLE 的锁级别取决于数据库、版本与具体操作：加可空列通常较轻，改列类型、加约束或建索引可能重写表、持有强锁或阻塞写入。PostgreSQL 支持事务性 DDL，但 <code>CREATE INDEX CONCURRENTLY</code> 不能在事务块内执行；<code>NOT VALID</code> 约束可以先跳过存量数据校验，再用 <code>VALIDATE CONSTRAINT</code> 分阶段完成。<br>零停机的核心不是记住某条命令，而是把变更拆成「旧代码能读、新代码能写、数据已回填、约束再收紧」的兼容序列，并在影子库按生产规模演练。上线前看锁等待与迁移耗时，上线后看错误率与数据校验结果；任何一步失败都能停在那一步，而不是回滚整场变更。'
    },
    {
      type: 'note',
      title: '面试延伸',
      html: '面试常问「大表加索引怎么不锁表」。回答要先问数据库与版本：支持在线建索引就用在线方式并避开高峰；不支持就考虑影子表、双写或分批迁移，同时监控锁等待与复制延迟。不要承诺「完全不锁」，要说清锁的范围、持续时间与回滚方案。<br>「迁移回滚策略」要回答：已应用迁移不改写；每个变更都有 down 或人工回滚脚本；破坏性操作先备份并在影子库演练；expand-contract 的每一步都能独立停止。只回答「跑 down 就行」不够。'
    }
  ],
  checks: [
    {
      id: 's1-schema-check-1',
      kind: 'mcq',
      type: 'single',
      tag: '软删除唯一',
      prompt: 'LinkHub 的 links 使用软删除（deleted_at 为空表示有效），要求有效链接的 slug 唯一，但删除后的 slug 可以复用。最直接的约束方案是什么？',
      question: 'LinkHub 的 links 使用软删除（deleted_at 为空表示有效），要求有效链接的 slug 唯一，但删除后的 slug 可以复用。最直接的约束方案是什么？',
      options: [
        { text: '在 slug 上建普通唯一索引，删除时把 slug 改成随机值', correct: false },
        { text: '在 (tenant_id, slug) 上建部分唯一索引，条件为 deleted_at IS NULL', correct: true },
        { text: '在 (slug, deleted_at) 上建唯一索引，依赖 NULL 互不相等', correct: false },
        { text: '只在应用层查询是否存在同 slug 的有效链接，然后插入', correct: false }
      ],
      explain: '部分唯一索引只约束未删除行，允许删除后复用；改写 slug 会破坏历史可读性与外部引用；(slug, deleted_at) 在 deleted_at 为 NULL 时无法阻止多条有效行重复，而不同数据库对 NULL 的处理又不同；应用层先查后插存在并发窗口，约束必须由数据库兜底。'
    },
    {
      id: 's1-schema-check-2',
      kind: 'mcq',
      type: 'multi',
      tag: '危险迁移',
      prompt: '以下哪些迁移属于高风险或破坏性操作？',
      question: '以下哪些迁移属于高风险或破坏性操作？',
      options: [
        { text: '没有备份与回滚方案，直接删除正在使用的列', correct: true },
        { text: '在一个事务里对大表全量回填千万行', correct: true },
        { text: '迁移没有 down，且没有人工回滚脚本', correct: true },
        { text: '把生产密钥写进 seed.sql，方便所有环境联调', correct: true },
        { text: '先加可空列、分批回填、再加约束', correct: false }
      ],
      explain: '删列会丢失数据且旧代码可能仍在读；长事务回填会持锁、放大日志并阻塞清理；没有 down 与回滚脚本会把恢复成本推给事故现场；种子进入仓库会泄露密钥；可空加列 + 分批回填 + 收紧约束是标准的兼容路径，不属于破坏性操作。'
    },
    {
      id: 's1-schema-check-3',
      kind: 'mcq',
      type: 'single',
      tag: 'expand-contract',
      prompt: '给已有数据的 links 表新增 tenant_id NOT NULL，要求不停机。正确的顺序是什么？',
      question: '给已有数据的 links 表新增 tenant_id NOT NULL，要求不停机。正确的顺序是什么？',
      options: [
        { text: '直接 ALTER TABLE 加 NOT NULL DEFAULT，然后上线新代码', correct: false },
        { text: '加可空列 → 分批回填 → 应用双写 → 加 NOT NULL/约束 → 删除旧路径', correct: true },
        { text: '先删除旧列 → 停机导入 → 再建新表', correct: false },
        { text: '在事务里一次回填全部数据，再提交', correct: false }
      ],
      explain: '直接加 NOT NULL 可能在大表上长时间持锁或依赖默认值行为；可空列 + 分批回填让旧代码继续工作；双写覆盖切换窗口；收紧约束前先验证数据；最后才清理旧路径。一次回填全部数据会形成长事务，阻塞写入与清理。'
    }
  ],
  exercises: [
    {
      id: 's1-schema-ex-1',
      kind: 'code',
      title: '可回滚迁移运行器',
      brief: '实现 createMigrator({ migrations, store })，返回 { up, down }。migration 包含 version、name、sql、up(tx)、down(tx)；store.applied() 返回 [{ version, checksum }]；store.transaction(fn) 在成功时提交、抛错时回滚，tx.record(version, checksum) 记录版本，tx.remove(version) 删除记录。up 按版本升序执行未应用迁移，执行前校验已应用记录的 checksum；down 按已应用版本逆序回滚。重复版本抛 DuplicateVersionError，已应用记录找不到迁移抛 UnknownMigrationError，checksum 不匹配抛 ChecksumMismatchError。checksumOf 使用 FNV-1a 32 位教学校验和。',
      hint: '创建时先排序并检测重复版本；up 先读取 applied 并校验每条 checksum；用 Set 跳过已应用；每个迁移包在 store.transaction 里；down 取 applied 版本逆序，先调用 down 再 remove；失败自然中止，不要继续执行后续迁移。',
      starter: `class DuplicateVersionError extends Error {
  constructor(version) {
    super('迁移版本重复：' + version);
    this.name = 'DuplicateVersionError';
    this.version = version;
  }
}

class ChecksumMismatchError extends Error {
  constructor(version) {
    super('迁移校验和不匹配：' + version);
    this.name = 'ChecksumMismatchError';
    this.version = version;
  }
}

class UnknownMigrationError extends Error {
  constructor(version) {
    super('找不到已应用的迁移：' + version);
    this.name = 'UnknownMigrationError';
    this.version = version;
  }
}

function checksumOf(migration) {
  const text = migration.version + ':' + migration.name + ':' + migration.sql;
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function createMigrator({ migrations, store }) {
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  return {
    async up() {
      for (const migration of sorted) {
        await store.transaction(async (tx) => {
          await migration.up(tx);
          await tx.record(migration.version, checksumOf(migration));
        });
      }
    },
    async down() {
      for (const migration of [...sorted].reverse()) {
        await store.transaction(async (tx) => {
          await migration.down(tx);
          await tx.remove(migration.version);
        });
      }
    },
  };
}`,
      solution: `class DuplicateVersionError extends Error {
  constructor(version) {
    super('迁移版本重复：' + version);
    this.name = 'DuplicateVersionError';
    this.version = version;
  }
}

class ChecksumMismatchError extends Error {
  constructor(version) {
    super('迁移校验和不匹配：' + version);
    this.name = 'ChecksumMismatchError';
    this.version = version;
  }
}

class UnknownMigrationError extends Error {
  constructor(version) {
    super('找不到已应用的迁移：' + version);
    this.name = 'UnknownMigrationError';
    this.version = version;
  }
}

function checksumOf(migration) {
  const text = migration.version + ':' + migration.name + ':' + migration.sql;
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function createMigrator({ migrations, store }) {
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  const byVersion = new Map();
  for (const migration of sorted) {
    if (byVersion.has(migration.version)) throw new DuplicateVersionError(migration.version);
    byVersion.set(migration.version, migration);
  }

  async function readApplied() {
    const applied = await store.applied();
    for (const record of applied) {
      const migration = byVersion.get(record.version);
      if (!migration) throw new UnknownMigrationError(record.version);
      if (checksumOf(migration) !== record.checksum) {
        throw new ChecksumMismatchError(record.version);
      }
    }
    return applied;
  }

  return {
    async up() {
      const applied = await readApplied();
      const done = new Set(applied.map((record) => record.version));
      for (const migration of sorted) {
        if (done.has(migration.version)) continue;
        await store.transaction(async (tx) => {
          await migration.up(tx);
          await tx.record(migration.version, checksumOf(migration));
        });
      }
    },
    async down() {
      const applied = await readApplied();
      const targets = applied
        .map((record) => byVersion.get(record.version))
        .sort((a, b) => b.version - a.version);
      for (const migration of targets) {
        await store.transaction(async (tx) => {
          await migration.down(tx);
          await tx.remove(migration.version);
        });
      }
    },
  };
}`,
      tests: [
        {
          name: '空库按版本升序执行全部迁移',
          code: `function createStore(initial = []) {
  const records = new Map(initial);
  const log = [];
  return {
    records,
    log,
    async applied() {
      return [...records.entries()]
        .map(([version, checksum]) => ({ version, checksum }))
        .sort((a, b) => a.version - b.version);
    },
    async transaction(fn) {
      const snapshot = new Map(records);
      const tx = {
        async record(version, checksum) { records.set(version, checksum); log.push('record:' + version); },
        async remove(version) { records.delete(version); log.push('remove:' + version); },
      };
      try { await fn(tx); } catch (error) {
        records.clear();
        snapshot.forEach((value, key) => records.set(key, value));
        throw error;
      }
    },
  };
}
function makeMigrations(log) {
  return [1, 2, 3].map((version) => ({
    version,
    name: 'm' + version,
    sql: 'SQL ' + version,
    async up() { log.push('up:' + version); },
    async down() { log.push('down:' + version); },
  }));
}
const log = [];
const migrations = makeMigrations(log);
const store = createStore();
await createMigrator({ migrations, store }).up();
assert.deepStrictEqual([...store.records.keys()].sort((a, b) => a - b), [1, 2, 3]);
assert.deepStrictEqual(log.filter((item) => item.startsWith('up:')), ['up:1', 'up:2', 'up:3']);
assert.deepStrictEqual(store.log.filter((item) => item.startsWith('record:')), ['record:1', 'record:2', 'record:3']);
for (const migration of migrations) {
  assert.equal(store.records.get(migration.version), checksumOf(migration));
}`
        },
        {
          name: '已应用且校验和一致时跳过，up 可重复执行',
          code: `function createStore(initial = []) {
  const records = new Map(initial);
  const log = [];
  return {
    records,
    log,
    async applied() {
      return [...records.entries()].map(([version, checksum]) => ({ version, checksum })).sort((a, b) => a.version - b.version);
    },
    async transaction(fn) {
      const snapshot = new Map(records);
      const tx = {
        async record(version, checksum) { records.set(version, checksum); log.push('record:' + version); },
        async remove(version) { records.delete(version); log.push('remove:' + version); },
      };
      try { await fn(tx); } catch (error) {
        records.clear();
        snapshot.forEach((value, key) => records.set(key, value));
        throw error;
      }
    },
  };
}
function makeMigrations(log) {
  return [1, 2, 3].map((version) => ({
    version,
    name: 'm' + version,
    sql: 'SQL ' + version,
    async up() { log.push('up:' + version); },
    async down() { log.push('down:' + version); },
  }));
}
const log = [];
const migrations = makeMigrations(log);
const store = createStore([[1, checksumOf(migrations[0])]]);
const migrator = createMigrator({ migrations, store });
await migrator.up();
await migrator.up();
assert.equal(log.filter((item) => item === 'up:1').length, 0);
assert.equal(log.filter((item) => item === 'up:2').length, 1);
assert.equal(log.filter((item) => item === 'up:3').length, 1);`
        },
        {
          name: '校验和不匹配时拒绝执行任何迁移',
          code: `function createStore(initial = []) {
  const records = new Map(initial);
  const log = [];
  return {
    records,
    log,
    async applied() {
      return [...records.entries()].map(([version, checksum]) => ({ version, checksum })).sort((a, b) => a.version - b.version);
    },
    async transaction(fn) {
      const snapshot = new Map(records);
      const tx = {
        async record(version, checksum) { records.set(version, checksum); log.push('record:' + version); },
        async remove(version) { records.delete(version); log.push('remove:' + version); },
      };
      try { await fn(tx); } catch (error) {
        records.clear();
        snapshot.forEach((value, key) => records.set(key, value));
        throw error;
      }
    },
  };
}
const log = [];
const migrations = [1, 2].map((version) => ({
  version, name: 'm' + version, sql: 'SQL ' + version,
  async up() { log.push('up:' + version); },
  async down() { log.push('down:' + version); },
}));
const store = createStore([[1, 'deadbeef']]);
let error = null;
try {
  await createMigrator({ migrations, store }).up();
} catch (caught) {
  error = caught;
}
assert.ok(error instanceof ChecksumMismatchError);
assert.equal(error.version, 1);
assert.equal(log.length, 0);`
        },
        {
          name: '重复版本在创建时立即拒绝',
          code: `const base = { version: 1, name: 'a', sql: 'A', async up() {}, async down() {} };
let error = null;
try {
  createMigrator({ migrations: [base, { ...base, name: 'b' }], store: { async applied() { return []; } } });
} catch (caught) {
  error = caught;
}
assert.ok(error instanceof DuplicateVersionError);
assert.equal(error.version, 1);`
        },
        {
          name: '迁移失败时中止并回滚当前事务',
          code: `function createStore(initial = []) {
  const records = new Map(initial);
  const log = [];
  return {
    records,
    log,
    async applied() {
      return [...records.entries()].map(([version, checksum]) => ({ version, checksum })).sort((a, b) => a.version - b.version);
    },
    async transaction(fn) {
      const snapshot = new Map(records);
      const tx = {
        async record(version, checksum) { records.set(version, checksum); log.push('record:' + version); },
        async remove(version) { records.delete(version); log.push('remove:' + version); },
      };
      try { await fn(tx); } catch (error) {
        records.clear();
        snapshot.forEach((value, key) => records.set(key, value));
        throw error;
      }
    },
  };
}
const log = [];
const migrations = [1, 2, 3].map((version) => ({
  version, name: 'm' + version, sql: 'SQL ' + version,
  async up() {
    log.push('up:' + version);
    if (version === 2) throw new Error('boom');
  },
  async down() { log.push('down:' + version); },
}));
const store = createStore([[1, checksumOf(migrations[0])]]);
let error = null;
try {
  await createMigrator({ migrations, store }).up();
} catch (caught) {
  error = caught;
}
assert.equal(error.message, 'boom');
assert.deepStrictEqual([...store.records.keys()], [1]);
assert.equal(log.includes('up:3'), false);
assert.equal(log.includes('record:3'), false);`
        },
        {
          name: 'down 按版本逆序回滚并删除记录',
          code: `function createStore(initial = []) {
  const records = new Map(initial);
  const log = [];
  return {
    records,
    log,
    async applied() {
      return [...records.entries()].map(([version, checksum]) => ({ version, checksum })).sort((a, b) => a.version - b.version);
    },
    async transaction(fn) {
      const snapshot = new Map(records);
      const tx = {
        async record(version, checksum) { records.set(version, checksum); log.push('record:' + version); },
        async remove(version) { records.delete(version); log.push('remove:' + version); },
      };
      try { await fn(tx); } catch (error) {
        records.clear();
        snapshot.forEach((value, key) => records.set(key, value));
        throw error;
      }
    },
  };
}
const log = [];
const migrations = [1, 2, 3].map((version) => ({
  version, name: 'm' + version, sql: 'SQL ' + version,
  async up() { log.push('up:' + version); },
  async down() { log.push('down:' + version); },
}));
const store = createStore([
  [1, checksumOf(migrations[0])],
  [2, checksumOf(migrations[1])],
  [3, checksumOf(migrations[2])],
]);
await createMigrator({ migrations, store }).down();
assert.deepStrictEqual(log, ['down:3', 'down:2', 'down:1']);
assert.equal(store.records.size, 0);`
        },
        {
          name: 'down 失败时停止并回滚当前事务',
          code: `function createStore(initial = []) {
  const records = new Map(initial);
  const log = [];
  return {
    records,
    log,
    async applied() {
      return [...records.entries()].map(([version, checksum]) => ({ version, checksum })).sort((a, b) => a.version - b.version);
    },
    async transaction(fn) {
      const snapshot = new Map(records);
      const tx = {
        async record(version, checksum) { records.set(version, checksum); log.push('record:' + version); },
        async remove(version) { records.delete(version); log.push('remove:' + version); },
      };
      try { await fn(tx); } catch (error) {
        records.clear();
        snapshot.forEach((value, key) => records.set(key, value));
        throw error;
      }
    },
  };
}
const log = [];
const migrations = [1, 2, 3].map((version) => ({
  version, name: 'm' + version, sql: 'SQL ' + version,
  async up() { log.push('up:' + version); },
  async down() {
    log.push('down:' + version);
    if (version === 3) throw new Error('boom');
  },
}));
const store = createStore([
  [1, checksumOf(migrations[0])],
  [2, checksumOf(migrations[1])],
  [3, checksumOf(migrations[2])],
]);
let error = null;
try {
  await createMigrator({ migrations, store }).down();
} catch (caught) {
  error = caught;
}
assert.equal(error.message, 'boom');
assert.deepStrictEqual(log, ['down:3']);
assert.deepStrictEqual([...store.records.keys()].sort((a, b) => a - b), [1, 2, 3]);`
        }
      ]
    },
    {
      id: 's1-schema-ex-2',
      kind: 'design',
      title: '零停机加 tenant_id',
      brief: 'links 表已有数百万行数据，需要新增 tenant_id NOT NULL 并回填，要求不停机、可回滚，且旧版本应用在新 schema 上仍能工作。请给出完整变更方案，包括每一步的验证与回滚点。',
      checklist: [
        '先加可空列，旧代码不需要修改即可继续读写',
        '回填按主键或时间分批，可重入、可断点续跑，不形成长事务',
        '应用层双写或默认值策略覆盖切换窗口',
        '约束收紧顺序明确：先校验数据，再 NOT NULL / 约束，必要时使用 NOT VALID 后验证',
        '索引创建方式考虑锁与写入影响，说明数据库差异',
        '给出每一步的回滚动作与旧代码兼容性',
        '给出监控指标：回填进度、锁等待、错误率、复制延迟（如适用）',
        '给出数据校验：行数、空值计数、抽样对比与迁移前后一致性检查'
      ],
      reference: '<ul><li><strong>加可空列：</strong><code>ALTER TABLE links ADD COLUMN tenant_id ... NULL</code>，旧代码不写该列也能工作。</li><li><strong>分批回填：</strong>按主键范围更新，每批记录进度与耗时；脚本幂等，失败可重试，不把全表放进一个事务。</li><li><strong>双写：</strong>新代码同时写旧路径与 tenant_id，覆盖灰度与回滚窗口。</li><li><strong>收紧约束：</strong>先确认空值计数为 0，再加 NOT NULL；大表可先用 NOT VALID 加约束，再 VALIDATE CONSTRAINT。</li><li><strong>索引：</strong>支持在线建索引就用在线方式并避开高峰；不支持就评估影子表或双写，监控锁等待。</li><li><strong>回滚：</strong>每一步都能停：回填可暂停，双写可回退，约束可删除，旧列最后才清理。</li><li><strong>监控与校验：</strong>回填进度、锁等待、错误率、复制延迟；行数、空值、抽样对比全部通过后才进入下一步。</li></ul>'
    }
  ]
};
