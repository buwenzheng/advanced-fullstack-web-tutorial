export const m2Sql = {
  "id": "m2-sql",
  "title": "关系模型与 SQL：从对象到表",
  "subtitle": "表、主键、外键、范式与反范式、JOIN、聚合，以及 JSONB 的取舍。",
  "duration": 80,
  "status": "ready",
  "objectives": [
    "把 LinkHub 的用户、短链与点击事件映射成带主键、外键和约束的表，并说明每个约束在防什么。",
    "写出 INNER JOIN、LEFT JOIN、分组聚合与固定时间窗口查询，解释 COUNT(*) 与 COUNT(column) 的差异。",
    "在规范化、反规范化与 JSONB 之间做有理由的取舍，说明一致性、查询与写入的代价。",
    "解释 NULL 三值逻辑与 NOT IN 的陷阱，并用查询结果或测试证明判断。"
  ],
  "keywords": ["关系模型", "主键", "外键", "范式", "JOIN", "GROUP BY", "NULL", "JSONB"],
  "blocks": [
    {
      "type": "analogy",
      "title": "TypeScript 对象 vs 关系表",
      "html": "你在 TypeScript 里写下 <code>interface Link { id: string; slug: string }</code>，编译器会拦住字段拼写错误。但两个请求同时创建同一个 slug 时，类型系统帮不上忙：它们都能通过编译，也都能通过应用层「先查再插」的检查。<br>关系表更像一份所有服务共同遵守的契约：主键保证每行有身份，唯一约束在并发写入时仍然成立，外键阻止点击事件指向不存在的链接。这个类比在结构演进处不成立——TypeScript 改接口可以一次性重编译，数据库改表要面对已有数据、在线流量与回滚。"
    },
    {
      "type": "flow",
      "title": "从领域到查询的五步",
      "steps": [
        { "name": "画基数", "detail": "先问「一个用户有多少短链」「一条短链有多少点击」「一个链接能打几个标签」。基数画错，外键就会放错表；典型失败是把一对多写成一对一。" },
        { "name": "画 ER 图", "detail": "列出实体、关系与参与次数。只画实体不画关系，会在落表时才发现多对多无处安放。" },
        { "name": "落表与列", "detail": "为每列选择类型、可空性与默认值。全用 TEXT、全部允许 NULL，会把校验推迟到线上。" },
        { "name": "加约束", "detail": "主键、外键、唯一、CHECK 各司其职。只靠应用校验，会在并发窗口里漏掉重复数据。" },
        { "name": "用查询反推索引", "detail": "拿真实访问模式写查询，再看需要哪些索引。先建一堆索引再想查询，通常得到冗余索引与写入放大。" }
      ]
    },
    {
      "type": "text",
      "title": "主键、外键、基数与范式",
      "html": "主键给每一行一个稳定身份，必须唯一且非空；外键保证子行引用的父行存在，并在父行删除时按 <code>ON DELETE</code> 策略处理。基数描述关系两侧的数量：用户与短链是一对多，短链与点击是一对多，链接与标签是多对多，多对多需要一张关联表。<br>范式是减少重复与更新异常的经验规则：第一范式要求列值原子，第二范式要求非主属性依赖完整主键，第三范式要求非主属性之间不传递依赖。范式不是越严越好：报表、审计快照与高频读场景可能故意反范式，把计算结果冗余存下来；代价是写入时要同步更新，且要能接受短暂不一致。"
    },
    {
      "type": "table",
      "title": "LinkHub 三张表",
      "head": ["表", "关键列", "约束", "为什么需要"],
      "rows": [
        ["users", "id、email、display_name、created_at", "id 主键；email 唯一且非空", "登录身份与链接归属的根实体"],
        ["links", "id、user_id、slug、target_url、expires_at", "id 主键；user_id 外键；slug 唯一；target_url CHECK", "短码到目标 URL 的映射，slug 冲突必须由数据库兜底"],
        ["click_events", "id、link_id、clicked_at、country_code", "id 主键；link_id 外键；clicked_at 非空", "点击流水，用于统计与审计，写入量最大"],
        ["link_tags", "link_id、tag_id", "复合主键；两个外键", "链接与标签的多对多关系，防止重复打标"]
      ]
    },
    {
      "type": "code",
      "title": "schema.sql 与最小种子数据",
      "lang": "sql",
      "code": "-- PostgreSQL 方言；约束是这个例子的主角，不是装饰\nCREATE TABLE users (\n  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  email TEXT NOT NULL UNIQUE,\n  display_name TEXT NOT NULL,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\nCREATE TABLE links (\n  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  slug TEXT NOT NULL UNIQUE,\n  target_url TEXT NOT NULL CHECK (target_url ~ '^https?://'),\n  expires_at TIMESTAMPTZ,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\nCREATE TABLE click_events (\n  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  link_id BIGINT NOT NULL REFERENCES links(id) ON DELETE CASCADE,\n  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n  country_code TEXT\n);\n\nINSERT INTO users (email, display_name) VALUES\n  ('ada@example.com', 'Ada'),\n  ('lin@example.com', 'Lin');\n\nINSERT INTO links (user_id, slug, target_url) VALUES\n  (1, 'ada-docs', 'https://example.com/docs'),\n  (2, 'lin-api', 'https://example.com/api');\n\nINSERT INTO click_events (link_id, clicked_at, country_code) VALUES\n  (1, '2026-11-02T00:00:00Z', 'CN'),\n  (1, '2026-11-05T10:00:00Z', 'SG'),\n  (2, '2026-11-04T08:00:00Z', 'US');",
      "note": "真实系统还会加软删除、审计表与更细的 CHECK；这里只保留理解关系与约束所需的最少结构。"
    },
    {
      "type": "table",
      "title": "JOIN 类型与保留侧",
      "head": ["JOIN", "保留哪一侧", "典型场景", "常见误用"],
      "rows": [
        ["INNER JOIN", "只保留两侧都匹配的行", "查询「有用户的链接」或「有点击的链接」", "想看 0 点击链接时误用，结果直接少行"],
        ["LEFT JOIN", "保留左表全部行，右表缺失补 NULL", "用户列表附带统计，0 也要显示", "把右表过滤条件写进 WHERE，退化成 INNER"],
        ["RIGHT JOIN", "保留右表全部行", "等价于交换顺序的 LEFT JOIN，可读性通常更差", "与 LEFT JOIN 混用导致保留侧判断混乱"],
        ["FULL JOIN", "两侧都保留，缺失侧补 NULL", "对账、合并两个来源的数据集", "在业务列表里使用，产生大量 NULL 行"]
      ]
    },
    {
      "type": "code",
      "title": "固定时间窗口的聚合查询",
      "lang": "sql",
      "code": "-- 可在本站 SQL 题中执行：每个用户×链接在窗口内的点击数，0 也必须出现\nSELECT u.id AS user_id, l.id AS link_id, COUNT(c.id) AS clicks\nFROM users u\nLEFT JOIN links l ON l.user_id = u.id\nLEFT JOIN click_events c\n  ON c.link_id = l.id\n AND c.clicked_at >= '2026-11-02T00:00:00Z'\n AND c.clicked_at < '2026-11-09T00:00:00Z'\nGROUP BY u.id, l.id\nORDER BY user_id ASC, clicks DESC, link_id ASC;\n\n-- 生产环境常按「最近 7 天」动态截断；下面是 PostgreSQL 对照，迷你引擎不支持窗口函数\nWITH window_clicks AS (\n  SELECT l.user_id, l.id AS link_id, COUNT(c.id) AS clicks\n  FROM links l\n  LEFT JOIN click_events c\n    ON c.link_id = l.id\n   AND c.clicked_at >= date_trunc('day', now()) - interval '7 days'\n  GROUP BY l.user_id, l.id\n), ranked AS (\n  SELECT user_id, link_id, clicks,\n         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY clicks DESC, link_id) AS rn\n  FROM window_clicks\n)\nSELECT user_id, link_id, clicks\nFROM ranked\nWHERE rn <= 3\nORDER BY user_id, clicks DESC, link_id;",
      "note": "时间条件放在第二个 LEFT JOIN 的 ON 里，右表没有匹配时会补 NULL，左表的链接仍然保留；放进 WHERE 会把 0 点击行删掉。"
    },
    {
      "type": "compare",
      "title": "规范化、反规范化与 JSONB",
      "cols": [
        { "title": "规范化", "items": ["一份事实只存一处，更新异常少", "约束与索引直接可用", "查询需要 JOIN，读路径更长", "适合核心交易数据"] },
        { "title": "反规范化", "items": ["把统计结果或常用字段冗余存下来", "读取快，但写入要同步多处", "需要补偿任务处理不一致", "适合报表、快照、高频读"] },
        { "title": "JSONB", "items": ["结构灵活，整体读写方便", "反查与唯一约束要额外处理", "类型与索引能力取决于数据库", "适合读多写少、形态不固定的扩展字段"] }
      ]
    },
    {
      "type": "pitfall",
      "title": "NULL 与隐式转换",
      "html": "现象：统计面板少了几行；<code>WHERE status NOT IN (SELECT status FROM ...)</code> 返回空集；或者同一条查询在测试库对、在线上错。<br>原因：NULL 表示未知，任何与 NULL 的比较结果都不是真：<code>NULL = 'active'</code>、<code>NULL != 'active'</code> 都不成立，只能用 <code>IS NULL</code> 判断。子查询里出现 NULL 时，<code>NOT IN</code> 的整个条件无法确定为真，于是过滤掉所有行。另一个常见原因是隐式类型转换：字符串列与数字比较、或在列上套函数，都可能让索引失效并改变匹配结果。<br>发现方式：把可疑条件单独 <code>SELECT</code> 出来，检查 NULL 行；用 <code>EXPLAIN</code> 看是否出现 <code>Filter</code> 而不是索引条件。<br>修复：显式写 <code>IS NULL</code> / <code>IS NOT NULL</code>，把 <code>NOT IN</code> 改成 <code>NOT EXISTS</code>，统一列类型，避免在列上包函数。<br>预防：对可空列写测试用例，覆盖 NULL、空字符串与边界值；在 schema 里尽量用 <code>NOT NULL</code> 和默认值缩小未知。"
    },
    {
      "type": "steps",
      "title": "为「链接标签」建模",
      "steps": [
        { "title": "确认多对多", "html": "一个链接可以有多个标签，一个标签也可以挂多个链接；不要把一个标签数组塞进 <code>links</code> 列。" },
        { "title": "建标签表", "html": "<code>tags(id, name)</code>，<code>name</code> 加唯一约束，并规定大小写与首尾空白的归一化规则。" },
        { "title": "建关联表", "html": "<code>link_tags(link_id, tag_id)</code> 使用复合主键或唯一约束，防止同一链接重复打同一个标签。" },
        { "title": "补反查索引", "html": "「按标签查链接」需要 <code>(tag_id, link_id)</code>；「按链接查标签」可由复合主键前缀覆盖。" },
        { "title": "定删除策略", "html": "链接删除时级联清理关联行，或在一个事务里显式清理；两种方式都要有测试。" },
        { "title": "迁移与回滚", "html": "先建表与索引，再回填，最后加约束并切换读写；保留旧字段直到新路径验证完成。" }
      ]
    },
    {
      "type": "text",
      "title": "深挖：为什么关系库仍是默认",
      "html": "关系库的默认地位不是因为 SQL 语法，而是三件事同时成立：约束在并发写入下仍被数据库执行；事务能把多条写入与失败回滚绑在一起；查询优化器能根据统计信息选择执行路径。把数据塞进 JSONB 或文档库并不会让这三件事自动消失，只是把一部分责任移回应用层。<br>JSONB 的优势在形态不固定、整体读写的扩展字段；一旦需要按内部字段反查、统计或强制唯一，就要补生成列、表达式索引或额外表，复杂度往往超过一开始就建模。关系库也不是万能：超高写入、超宽表、跨地域强一致与海量稀疏字段都有更合适的方案。判断标准不是「新不新」，而是访问模式、约束强度与规模边界。"
    },
    {
      "type": "note",
      "title": "面试延伸",
      "html": "面试里常问「什么时候不该用关系库」。好的回答会先给出访问模式与一致性要求，再讨论写入吞吐、字段稀疏性、跨地域复制与团队运维能力；只说「数据量大」不够，因为分片与分区也能解决一部分规模问题。<br>另一个问题是「反范式有什么代价」。回答要落到同步写入、补偿任务、读到的短暂不一致与回滚难度，并说明什么指标会让团队重新考虑这个决定。"
    }
  ],
  "checks": [
    {
      "id": "m2-sql-check-1",
      "kind": "mcq",
      "type": "single",
      "tag": "主键与外键",
      "prompt": "click_events 表的主键与外键应该怎么选？",
      "question": "click_events 表的主键与外键应该怎么选？",
      "options": [
        { "text": "主键用 (link_id, clicked_at) 复合主键，不需要额外列", "correct": false },
        { "text": "自增或 UUID 主键，link_id 外键引用 links.id，并为 link_id、clicked_at 建索引", "correct": true },
        { "text": "主键用 user_id，因为一个用户只产生一条点击", "correct": false },
        { "text": "不建外键，靠应用在写入前校验链接存在", "correct": false }
      ],
      "explain": "(link_id, clicked_at) 在同一毫秒可能重复，不能保证唯一；点击事件属于链接而不是用户，user_id 不是事件身份；应用校验与写入之间存在并发窗口，外键是数据库层的完整性约束。稳定主键加外键与索引，才能同时保证身份、引用完整与统计查询效率。"
    },
    {
      "id": "m2-sql-check-2",
      "kind": "mcq",
      "type": "multi",
      "tag": "JOIN 与聚合",
      "prompt": "关于 JOIN 与聚合，以下哪些说法正确？",
      "question": "关于 JOIN 与聚合，以下哪些说法正确？",
      "options": [
        { "text": "LEFT JOIN 后使用 COUNT(*)，未匹配的右表空行也会被算成 1", "correct": true },
        { "text": "COUNT(c.id) 忽略 NULL，适合统计右表的实际匹配行数", "correct": true },
        { "text": "把右表的过滤条件写在 WHERE 里，可能把 LEFT JOIN 退化成 INNER JOIN", "correct": true },
        { "text": "GROUP BY 后可以随意选择未聚合、未分组的列，所有数据库都允许", "correct": false },
        { "text": "INNER JOIN 会保留左表中没有匹配的行", "correct": false }
      ],
      "explain": "COUNT(*) 数行，COUNT(column) 数非 NULL；LEFT JOIN 未匹配时右表列全是 NULL，COUNT(*) 仍会数这一行，COUNT(c.id) 不会。WHERE 在连接结果上过滤，右表为 NULL 的行不满足条件会被移除，效果接近 INNER JOIN。标准 SQL 要求 SELECT 列出现在 GROUP BY 中或被聚合；INNER JOIN 只保留匹配行。"
    },
    {
      "id": "m2-sql-check-3",
      "kind": "mcq",
      "type": "single",
      "tag": "标签建模",
      "prompt": "LinkHub 的标签应该用 JSONB 数组还是关联表，主要取决于什么？",
      "question": "LinkHub 的标签应该用 JSONB 数组还是关联表，主要取决于什么？",
      "options": [
        { "text": "前端是否使用 TypeScript", "correct": false },
        { "text": "是否需要按标签反查链接、统计标签使用量，以及强制标签唯一", "correct": true },
        { "text": "数据库是否有自增主键", "correct": false },
        { "text": "标签数量是否超过 10 个", "correct": false }
      ],
      "explain": "需要反查、统计与唯一约束时，关联表与索引更直接；JSONB 适合读多写少、整体读取且不需要强约束的扩展字段。标签数量不是决定因素，前端语言与主键类型也与建模选择无关。"
    }
  ],
  "exercises": [
    {
      "id": "m2-sql-ex-1",
      "kind": "sql",
      "title": "七天内每个链接的点击数",
      "brief": "统计 2026-11-02T00:00:00Z（含）到 2026-11-09T00:00:00Z（不含）之间，每个用户每条链接的点击数。没有点击的链接也要显示 0。输出 user_id, link_id, clicks，按 user_id 升序、clicks 降序、link_id 升序。",
      "hint": "从 users LEFT JOIN links，再 LEFT JOIN click_events；两个时间条件写在第二个 ON 里，用 COUNT(c.id) 而不是 COUNT(*)。",
      "query": "-- 先跑一次看看会少哪些行\nSELECT u.id AS user_id, l.id AS link_id, COUNT(*) AS clicks\nFROM users u\nJOIN links l ON l.user_id = u.id\nJOIN click_events c ON c.link_id = l.id\nWHERE c.clicked_at >= '2026-11-02T00:00:00Z'\n  AND c.clicked_at < '2026-11-09T00:00:00Z'\nGROUP BY u.id, l.id\nORDER BY user_id ASC, clicks DESC, link_id ASC;",
      "tables": {
        "users": [
          { "id": 1, "name": "Ada" },
          { "id": 2, "name": "Lin" },
          { "id": 3, "name": "Kai" },
          { "id": 4, "name": "Mo" }
        ],
        "links": [
          { "id": 10, "user_id": 1, "slug": "ada-docs", "created_at": "2026-10-01T09:00:00Z" },
          { "id": 11, "user_id": 1, "slug": "ada-notes", "created_at": "2026-10-15T09:00:00Z" },
          { "id": 12, "user_id": 2, "slug": "lin-api", "created_at": "2026-10-20T09:00:00Z" },
          { "id": 13, "user_id": 3, "slug": "kai-empty", "created_at": "2026-10-25T09:00:00Z" },
          { "id": 14, "user_id": 4, "slug": "mo-old", "created_at": "2026-10-28T09:00:00Z" }
        ],
        "click_events": [
          { "id": 100, "link_id": 10, "clicked_at": "2026-11-02T00:00:00Z" },
          { "id": 101, "link_id": 10, "clicked_at": "2026-11-05T10:00:00Z" },
          { "id": 102, "link_id": 10, "clicked_at": "2026-11-09T00:00:00Z" },
          { "id": 103, "link_id": 11, "clicked_at": "2026-11-03T12:00:00Z" },
          { "id": 104, "link_id": 12, "clicked_at": "2026-11-04T08:00:00Z" },
          { "id": 105, "link_id": 12, "clicked_at": "2026-11-06T23:59:59Z" },
          { "id": 106, "link_id": 14, "clicked_at": "2026-10-20T10:00:00Z" },
          { "id": 107, "link_id": 14, "clicked_at": "2026-11-10T10:00:00Z" },
          { "id": 108, "link_id": 10, "clicked_at": null }
        ]
      },
      "expected": [
        { "user_id": 1, "link_id": 10, "clicks": 2 },
        { "user_id": 1, "link_id": 11, "clicks": 1 },
        { "user_id": 2, "link_id": 12, "clicks": 2 },
        { "user_id": 3, "link_id": 13, "clicks": 0 },
        { "user_id": 4, "link_id": 14, "clicks": 0 }
      ],
      "solution": "SELECT u.id AS user_id, l.id AS link_id, COUNT(c.id) AS clicks\nFROM users u\nLEFT JOIN links l ON l.user_id = u.id\nLEFT JOIN click_events c\n  ON c.link_id = l.id\n AND c.clicked_at >= '2026-11-02T00:00:00Z'\n AND c.clicked_at < '2026-11-09T00:00:00Z'\nGROUP BY u.id, l.id\nORDER BY user_id ASC, clicks DESC, link_id ASC;"
    },
    {
      "id": "m2-sql-ex-2",
      "kind": "design",
      "title": "LinkHub 链接标签建模",
      "brief": "LinkHub 要给链接打标签，并支持按标签筛选链接、显示标签使用量、重命名标签，同时保证同一链接不会重复打同一个标签。请给出表结构、约束、索引、删除策略与迁移顺序，并说明 JSONB 备选方案的代价。",
      "checklist": [
        "用关联表表达链接与标签的多对多，而不是在 links 里存数组",
        "关联表有复合主键或唯一约束，防止同一链接重复打标",
        "tags.name 有唯一约束，并说明大小写与空白的归一化规则",
        "给出「按标签查链接」与「按链接查标签」两个方向的索引",
        "说明删除链接时关联行如何清理，并给出验证方式",
        "说明标签重命名对历史数据、导出与外部引用的影响",
        "说明 JSONB 备选的适用条件与反查代价",
        "给出迁移顺序：建表、回填、加约束、切读写、清理旧字段"
      ],
      "reference": "<ul><li><strong>表结构：</strong><code>tags(id, name)</code> 与 <code>link_tags(link_id, tag_id)</code>；关联表使用 <code>(link_id, tag_id)</code> 复合主键。</li><li><strong>约束：</strong><code>tags.name</code> 唯一；重命名前先归一化大小写与首尾空白，避免 <code>API</code> 与 <code>api</code> 并存。</li><li><strong>索引：</strong>复合主键已覆盖「按链接查标签」；增加 <code>(tag_id, link_id)</code> 服务「按标签查链接」与标签使用量统计。</li><li><strong>删除：</strong>链接删除时用 <code>ON DELETE CASCADE</code> 清理关联行，或在一个事务里显式删除；两种方式都要有集成测试。</li><li><strong>重命名：</strong>标签名是引用键时，重命名要同步导出数据与外部引用；不要用标签名当外键。</li><li><strong>JSONB 备选：</strong>只在「整体读取标签、很少反查与统计、可接受应用层去重」时成立；反查要给表达式建索引，唯一性与重命名更麻烦。</li><li><strong>迁移顺序：</strong>建表与索引 → 从旧字段回填 → 双写验证 → 加唯一约束 → 切换读写 → 观察后再删除旧字段。</li><li><strong>反悔条件：</strong>如果标签查询远多于写入且几乎不按标签反查，可退回 JSONB；一旦需要统计与强唯一，就必须回到关联表。</li></ul>"
    }
  ]
};
