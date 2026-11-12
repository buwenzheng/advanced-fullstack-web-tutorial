export const m2Index = {
  "id": "m2-index",
  "title": "索引与查询计划：为什么查询会突然变慢",
  "subtitle": "B+tree、复合索引最左前缀、覆盖索引、N+1 与 EXPLAIN ANALYZE。",
  "duration": 85,
  "status": "ready",
  "objectives": [
    "解释 B+tree 查找、复合索引最左前缀与覆盖索引，判断一条查询能否使用某个索引。",
    "读懂 EXPLAIN (ANALYZE, BUFFERS) 的扫描类型、估计/实际行数、loops 与 buffers。",
    "为 LinkHub 的访问模式设计索引，并说明写入放大、冗余索引与迁移代价。",
    "识别 N+1 与索引失效，用查询计划或测试证明修复有效。"
  ],
  "keywords": ["B+tree", "复合索引", "最左前缀", "覆盖索引", "EXPLAIN", "N+1", "选择性"],
  "blocks": [
    {
      "type": "analogy",
      "title": "书末索引 vs 逐页翻",
      "html": "在一本没有索引的厚书里找「事务隔离」，你只能从第一页翻到最后一页；书末索引按关键词排好序，先查索引再翻到对应页，几次就能定位。数据库索引也是这样一棵额外的有序结构，让引擎不必逐行扫描。<br>这个类比在写入处失效：书印好之后索引不用维护，数据库每插入一行都要更新相关索引；索引越多，写入越慢、占用越大。另一个失效点是回表——书末索引直接给你页码，数据库索引可能只给你行位置，还要再去表里取其余列。"
    },
    {
      "type": "flow",
      "title": "一次 B+tree 查找",
      "steps": [
        { "name": "根页", "detail": "从根页开始，按键值范围选择下一层的页。根页通常常驻内存，失败表现是缓存未命中导致额外 I/O。" },
        { "name": "分支页", "detail": "沿内部节点逐层缩小范围。树高取决于页大小与扇出，不写死为固定层数。" },
        { "name": "叶子页", "detail": "叶子页保存键与行位置，等值查询在这里命中，范围查询沿叶子链表继续扫描。" },
        { "name": "回表", "detail": "如果查询列不在索引里，按行位置回到堆表取数据；随机 I/O 多时，优化器可能宁可选全表扫描。" },
        { "name": "返回与过滤", "detail": "把结果交给上层节点做剩余过滤或聚合。过滤发生在取行之后，说明前面选的索引选择性不够。" }
      ]
    },
    {
      "type": "table",
      "title": "常见索引类型",
      "head": ["类型", "擅长", "限制", "典型场景"],
      "rows": [
        ["B-tree", "等值、范围、排序、最左前缀", "对函数包裹列与低选择性列不友好", "slug 唯一、用户链接按时间排序"],
        ["Hash", "等值匹配", "不支持范围与排序", "只做精确查找的键"],
        ["GIN", "数组、JSONB、全文检索的多值包含", "写入与更新成本较高", "按标签数组或文档字段反查"],
        ["Partial", "只索引满足条件的子集", "查询条件必须能匹配谓词", "只查未删除或未过期的链接"],
        ["Covering", "索引本身包含查询所需列", "索引更宽，写入放大", "高频只读列表，避免回表"]
      ]
    },
    {
      "type": "code",
      "title": "EXPLAIN 前后对比",
      "lang": "sql",
      "code": "-- 加索引前：按时间过滤需要扫描多少行？\nEXPLAIN (ANALYZE, BUFFERS)\nSELECT link_id, COUNT(*)\nFROM click_events\nWHERE clicked_at >= '2026-11-02T00:00:00Z'\nGROUP BY link_id;\n\n-- 让索引同时覆盖过滤列与聚合列\nCREATE INDEX click_events_clicked_at_link_id_idx\n  ON click_events (clicked_at, link_id);\n\n-- 加索引后：观察 scan type、rows、loops 与 buffers 的变化\nEXPLAIN (ANALYZE, BUFFERS)\nSELECT link_id, COUNT(*)\nFROM click_events\nWHERE clicked_at >= '2026-11-02T00:00:00Z'\nGROUP BY link_id;\n\n-- 典型输出形态（实际取决于数据量、统计信息与可见性）：\n-- Seq Scan on click_events  (cost=... rows=... width=...)\n--   Filter: (clicked_at >= '2026-11-02T00:00:00Z')\n-- Index Only Scan using click_events_clicked_at_link_id_idx ...\n--   Index Cond: (clicked_at >= '2026-11-02T00:00:00Z')\n--   Heap Fetches: ...",
      "note": "EXPLAIN ANALYZE 会真实执行语句，不要在生产高峰对重查询随手加；先用普通 EXPLAIN 看估计计划，再在可控环境做 ANALYZE。"
    },
    {
      "type": "steps",
      "title": "五步读 EXPLAIN",
      "steps": [
        { "title": "先看节点类型", "html": "最外层是 <code>Seq Scan</code>、<code>Index Scan</code>、<code>Bitmap Heap Scan</code> 还是 <code>Nested Loop</code>；这决定了数据是怎么被取的。" },
        { "title": "再看估计与实际行数", "html": "比较 <code>rows</code> 与 <code>actual rows</code>；偏差一个数量级以上，先怀疑统计信息过期或查询条件不可估算。" },
        { "title": "检查 loops", "html": "嵌套循环的内层节点可能被执行很多次；实际行数要结合 loops 看，否则会低估总工作量。" },
        { "title": "看 buffers", "html": "<code>shared hit</code> 是缓存命中，<code>read</code> 是磁盘读；<code>Heap Fetches</code> 高说明 index-only scan 没有真正省掉回表。" },
        { "title": "最后看时间", "html": "节点时间是包含子节点的累计值，不能直接把所有节点相加当墙钟时间；用顶层实际时间与业务 SLA 对比。" }
      ]
    },
    {
      "type": "pitfall",
      "title": "索引失效与 N+1",
      "html": "现象：明明给 <code>clicked_at</code> 建了索引，查询仍然全表扫描；列表页只有 20 条链接，却发出 21 次数据库查询，接口耗时随数据量线性上升。<br>原因：在列上套函数（<code>date(clicked_at) = ...</code>）、类型不一致的隐式转换、或低选择性列上的索引，都会让优化器放弃索引；N+1 则是应用层循环触发查询，索引只能让每次查询更快，不能减少次数。<br>发现方式：看 <code>EXPLAIN</code> 是否出现 <code>Seq Scan</code> 与大 <code>Filter</code>；打开数据库查询日志或 APM，按请求统计 SQL 条数。<br>修复：把函数移到常量侧或用表达式索引；统一列类型；用 <code>WHERE link_id IN (...)</code> 一次聚合取回统计，再在应用层合并。<br>预防：为高频查询保留 EXPLAIN 证据；在集成测试里断言查询次数；新增索引前先评估选择性、写入放大与冗余。"
    },
    {
      "type": "compare",
      "title": "复合索引顺序 vs 多个单列索引",
      "cols": [
        { "title": "复合索引 (user_id, created_at)", "items": ["同时服务等值过滤与按时间排序", "最左前缀决定能否使用", "一个索引覆盖多列，写入成本集中", "列顺序要按真实查询设计"] },
        { "title": "多个单列索引", "items": ["每个索引独立，组合查询常只能用一个", "可能需要位图合并，排序仍要额外步骤", "索引数量多，写入与维护成本叠加", "适合各自独立的等值查询"] }
      ]
    },
    {
      "type": "text",
      "title": "深挖：选择性、基数与 index-only scan",
      "html": "选择性描述一个条件能过滤掉多少行：唯一键的选择性最高，性别之类的低基数布尔列最低。优化器不会因为「有索引」就一定使用索引，它比较的是估算成本：当过滤条件会命中表中很大比例的行，顺序扫描往往比大量随机回表更便宜。<br>估计行数来自统计信息，数据分布变化后没有及时更新统计，计划就可能突然变差。Index-only scan 看起来不需要回表，但它依赖可见性信息：如果页面没有被标记为对所有事务可见，引擎仍要回表确认，<code>Heap Fetches</code> 就会接近返回行数。索引也会膨胀，删除与更新留下的死条目需要清理；因此「加了索引」只是起点，验证计划与维护成本才是闭环。"
    },
    {
      "type": "table",
      "title": "LinkHub 访问模式与索引",
      "head": ["查询", "过滤与排序", "建议索引", "代价与边界"],
      "rows": [
        ["按 slug 跳转", "slug 等值", "slug 唯一索引", "写入时维护唯一性，冲突在数据库层暴露"],
        ["我的链接列表", "user_id 等值，created_at 倒序", "(user_id, created_at, id)", "覆盖过滤与排序，id 用于稳定分页"],
        ["按链接统计点击", "link_id 等值，clicked_at 范围", "(link_id, clicked_at)", "统计窗口大时仍要扫描较多索引行"],
        ["全站时间统计", "clicked_at 范围", "clicked_at 索引或分区", "写入量大时索引成本高，需评估分区"],
        ["按标签反查链接", "tag_id 等值", "(tag_id, link_id)", "多对多关联表的反查索引"]
      ]
    },
    {
      "type": "note",
      "title": "面试延伸",
      "html": "面试里常问「为什么加了索引还是慢」。好的回答会先确认索引是否真的被使用、查询是否在列上套了函数、统计信息是否过期、返回行数占比是否过高，再讨论回表与随机 I/O；只回答「索引失效」不够具体。<br>另一个问题是「什么时候全表扫描更快」。回答要落到选择性与数据量：小表、命中比例很高、或需要读取大部分列时，顺序扫描可能比索引加回表更便宜，并用 EXPLAIN 与真实数据验证。"
    }
  ],
  "checks": [
    {
      "id": "m2-index-check-1",
      "kind": "mcq",
      "type": "single",
      "tag": "最左前缀",
      "prompt": "复合索引 (user_id, created_at) 最能直接服务哪条查询？",
      "question": "复合索引 (user_id, created_at) 最能直接服务哪条查询？",
      "options": [
        { "text": "WHERE user_id = ? ORDER BY created_at DESC", "correct": true },
        { "text": "WHERE created_at > ?，不带 user_id", "correct": false },
        { "text": "WHERE slug = ?", "correct": false },
        { "text": "ORDER BY slug，不带过滤", "correct": false }
      ],
      "explain": "B+tree 先按 user_id 排序，再按 created_at 排序；等值过滤 user_id 后可以沿第二列有序扫描。只查 created_at 缺少最左前缀；slug 不在索引列中，ORDER BY slug 也无法利用这个索引。"
    },
    {
      "id": "m2-index-check-2",
      "kind": "mcq",
      "type": "multi",
      "tag": "EXPLAIN 信号",
      "prompt": "哪些信号说明索引没有达到预期效果？",
      "question": "哪些信号说明索引没有达到预期效果？",
      "options": [
        { "text": "WHERE 列上有可用索引，但计划顶部仍是 Seq Scan", "correct": true },
        { "text": "估计 10 行、实际返回 10000 行，偏差巨大", "correct": true },
        { "text": "Index Only Scan 的 Heap Fetches 接近返回行数", "correct": true },
        { "text": "只要出现 Index Scan，就说明计划一定最优", "correct": false },
        { "text": "Seq Scan 一定比 Index Scan 慢", "correct": false }
      ],
      "explain": "Seq Scan 说明优化器认为全表扫描更便宜，可能因为低选择性或统计信息过期；估计与实际偏差大提示统计信息不可靠；Heap Fetches 高说明 index-only scan 仍频繁回表。Index Scan 也可能因随机 I/O 与回表而更慢；小表或高比例匹配时 Seq Scan 常常更快，不能只看节点名称下结论。"
    },
    {
      "id": "m2-index-check-3",
      "kind": "mcq",
      "type": "single",
      "tag": "N+1",
      "prompt": "列表页展示 20 条链接，每条都要显示点击总数，当前实现是循环里逐条查询。最优修复是什么？",
      "question": "列表页展示 20 条链接，每条都要显示点击总数，当前实现是循环里逐条查询。最优修复是什么？",
      "options": [
        { "text": "在循环里加一层内存缓存", "correct": false },
        { "text": "用 WHERE link_id IN (...) 一次聚合查询取回 20 条链接的统计，再在应用层合并", "correct": true },
        { "text": "给 click_events.link_id 加索引，N+1 就会消失", "correct": false },
        { "text": "把列表页改成每次只显示 1 条链接", "correct": false }
      ],
      "explain": "N+1 的根因是查询次数随行数增长；加索引只能让每条查询更快，不能减少往返；批量聚合把 N+1 降为一次查询。缓存能缓解但引入失效问题，不是结构性修复；减少展示条数是产品妥协，不是查询修复。"
    }
  ],
  "exercises": [
    {
      "id": "m2-index-ex-1",
      "kind": "code",
      "title": "汇总 EXPLAIN 计划",
      "brief": "p-m2-data 的验证脚本需要把简化计划树汇总成固定结构，用于对比加索引前后的扫描类型、行数偏差与耗时。函数接收 { node, rows, actualRows, actualTime, children }，返回 { seqScans, indexScans, maxRowMisestimate, totalActualTime, warnings }。",
      "hint": "递归遍历 children；Index Scan 与 Index Only Scan 都算索引扫描；偏差取双向比值 max(actualRows/rows, rows/actualRows)，只有 rows 与 actualRows 都大于 0 的节点参与；偏差大于 10 时按先序写入 warnings。",
      "starter": "function summarizeExplain(plan) {\n  if (!plan) {\n    return { seqScans: 0, indexScans: 0, maxRowMisestimate: 0, totalActualTime: 0, warnings: [] };\n  }\n  return {\n    seqScans: plan.node.includes('Seq Scan') ? 1 : 0,\n    indexScans: plan.node.includes('Index Scan') ? 1 : 0,\n    maxRowMisestimate: Math.max(plan.actualRows / plan.rows, plan.rows / plan.actualRows),\n    totalActualTime: plan.actualTime,\n    warnings: [],\n  };\n}",
      "solution": "function summarizeExplain(plan) {\n  const result = { seqScans: 0, indexScans: 0, maxRowMisestimate: 0, totalActualTime: 0, warnings: [] };\n  const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;\n\n  const visit = (node) => {\n    if (!node) return;\n    const name = String(node.node || '');\n    if (name.includes('Seq Scan')) result.seqScans += 1;\n    if (name.includes('Index Scan') || name.includes('Index Only Scan')) result.indexScans += 1;\n\n    const rows = Number(node.rows);\n    const actualRows = Number(node.actualRows);\n    if (Number.isFinite(rows) && Number.isFinite(actualRows) && rows > 0 && actualRows > 0) {\n      const ratio = Math.max(actualRows / rows, rows / actualRows);\n      if (ratio > result.maxRowMisestimate) result.maxRowMisestimate = ratio;\n      if (ratio > 10) {\n        result.warnings.push(`${name}: 估计 ${rows} 行，实际 ${actualRows} 行，偏差 ${ratio.toFixed(1)}x`);\n      }\n    }\n\n    const time = Number(node.actualTime);\n    if (Number.isFinite(time)) result.totalActualTime += time;\n    (node.children || []).forEach(visit);\n  };\n\n  visit(plan);\n  result.maxRowMisestimate = round(result.maxRowMisestimate);\n  result.totalActualTime = round(result.totalActualTime);\n  return result;\n}",
      "tests": [
        {
          "name": "纯索引计划不产生 warning",
          "code": "assert.deepStrictEqual(summarizeExplain({ node: 'Index Scan using links_slug_key on links', rows: 1, actualRows: 1, actualTime: 0.12 }), { seqScans: 0, indexScans: 1, maxRowMisestimate: 1, totalActualTime: 0.12, warnings: [] });"
        },
        {
          "name": "Seq Scan 低估 20 倍产生 warning",
          "code": "const result = summarizeExplain({ node: 'Seq Scan on click_events', rows: 1000, actualRows: 20000, actualTime: 120.5 });\nassert.equal(result.seqScans, 1);\nassert.equal(result.indexScans, 0);\nassert.equal(result.maxRowMisestimate, 20);\nassert.equal(result.totalActualTime, 120.5);\nassert.equal(result.warnings.length, 1);\nassert.ok(result.warnings[0].startsWith('Seq Scan on click_events'));"
        },
        {
          "name": "嵌套循环递归统计子节点与总耗时",
          "code": "assert.deepStrictEqual(summarizeExplain({\n  node: 'Nested Loop', rows: 100, actualRows: 100, actualTime: 5.5,\n  children: [\n    { node: 'Index Scan using links_user_created_idx on links', rows: 10, actualRows: 10, actualTime: 1.25 },\n    { node: 'Seq Scan on click_events', rows: 1000, actualRows: 1000, actualTime: 0.75 },\n  ],\n}), { seqScans: 1, indexScans: 1, maxRowMisestimate: 1, totalActualTime: 7.5, warnings: [] });"
        },
        {
          "name": "Index Scan 高估 50 倍也产生 warning",
          "code": "const result = summarizeExplain({ node: 'Index Scan using click_events_link_idx on click_events', rows: 5000, actualRows: 100, actualTime: 2 });\nassert.equal(result.maxRowMisestimate, 50);\nassert.equal(result.warnings.length, 1);\nassert.ok(result.warnings[0].startsWith('Index Scan'));"
        },
        {
          "name": "Index Only Scan 计入索引扫描并递归子节点",
          "code": "const result = summarizeExplain({\n  node: 'Index Only Scan using click_events_link_time_idx on click_events', rows: 10, actualRows: 10, actualTime: 0.12,\n  children: [\n    { node: 'Seq Scan on links', rows: 100, actualRows: 2000, actualTime: 8.38 },\n  ],\n});\nassert.equal(result.seqScans, 1);\nassert.equal(result.indexScans, 1);\nassert.equal(result.maxRowMisestimate, 20);\nassert.equal(result.totalActualTime, 8.5);\nassert.equal(result.warnings.length, 1);\nassert.ok(result.warnings[0].startsWith('Seq Scan on links'));"
        },
        {
          "name": "空计划返回全零结构",
          "code": "assert.deepStrictEqual(summarizeExplain(null), { seqScans: 0, indexScans: 0, maxRowMisestimate: 0, totalActualTime: 0, warnings: [] });"
        }
      ]
    },
    {
      "id": "m2-index-ex-2",
      "kind": "sql",
      "title": "用户链接列表的第一页",
      "brief": "取用户 1 的第 1 页链接，每页 3 条。输出 id, slug, created_at，按 created_at 降序、id 降序；同一时间创建的链接必须有稳定顺序。",
      "hint": "WHERE 对应 (user_id, created_at) 索引的最左列；ORDER BY 要加 id 作为第二排序键，否则并列时间的行为不可依赖。",
      "query": "SELECT id, slug, created_at\nFROM links\nWHERE user_id = 1\nORDER BY created_at DESC\nLIMIT 3;",
      "tables": {
        "links": [
          { "id": 21, "user_id": 1, "slug": "b-bigO", "created_at": "2026-11-01T10:00:00Z" },
          { "id": 22, "user_id": 1, "slug": "b-hash", "created_at": "2026-11-02T10:00:00Z" },
          { "id": 23, "user_id": 1, "slug": "b-btree", "created_at": "2026-11-02T10:00:00Z" },
          { "id": 24, "user_id": 1, "slug": "b-heap", "created_at": "2026-11-03T10:00:00Z" },
          { "id": 25, "user_id": 1, "slug": "b-lru", "created_at": "2026-11-04T10:00:00Z" },
          { "id": 26, "user_id": 2, "slug": "b1", "created_at": "2026-11-05T10:00:00Z" }
        ]
      },
      "expected": [
        { "id": 25, "slug": "b-lru", "created_at": "2026-11-04T10:00:00Z" },
        { "id": 24, "slug": "b-heap", "created_at": "2026-11-03T10:00:00Z" },
        { "id": 23, "slug": "b-btree", "created_at": "2026-11-02T10:00:00Z" }
      ],
      "solution": "SELECT id, slug, created_at\nFROM links\nWHERE user_id = 1\nORDER BY created_at DESC, id DESC\nLIMIT 3;"
    },
    {
      "id": "m2-index-ex-3",
      "kind": "design",
      "title": "LinkHub 索引方案",
      "brief": "LinkHub 有 5 条高频查询：按 slug 跳转、用户链接列表、按链接统计点击、按时间统计全站点击、按标签筛选链接。写入量约为每秒 20 次点击、每分钟 10 条新链接，数据按 12 个月增长。请给出索引方案、验证方式与迁移策略。",
      "checklist": [
        "每条高频查询都对应至少一个索引，并说明列顺序",
        "说明最左前缀如何匹配过滤与排序",
        "至少指出一个覆盖索引或 index-only scan 的机会",
        "说明每个索引的写入放大与存储成本",
        "找出并删除至少一个冗余索引",
        "说明索引迁移如何避免长时间锁表",
        "给出 EXPLAIN 证据与可接受的计划判据"
      ],
      "reference": "<ul><li><strong>索引服务查询形状：</strong>slug 唯一索引；<code>links(user_id, created_at, id)</code> 服务列表过滤、排序与稳定分页；<code>click_events(link_id, clicked_at)</code> 服务按链接统计；全站时间统计评估 <code>clicked_at</code> 索引或分区；标签反查用 <code>link_tags(tag_id, link_id)</code>。</li><li><strong>最左前缀：</strong><code>(user_id, created_at, id)</code> 能服务 <code>WHERE user_id = ? ORDER BY created_at DESC, id DESC</code>；单独按 <code>created_at</code> 查询用不上。</li><li><strong>覆盖：</strong>列表只取 id、slug、created_at 时，可把 slug 放进 INCLUDE 列或调整索引；全站统计可在 <code>(clicked_at, link_id)</code> 上做 index-only scan。</li><li><strong>写入成本：</strong>点击表写入频繁，索引越多写入放大越明显；不建议给每列建索引。</li><li><strong>冗余：</strong>已有 <code>(user_id, created_at, id)</code> 时，再建 <code>(user_id)</code> 通常是冗余的，除非有特殊统计需求。</li><li><strong>迁移：</strong>使用并发创建索引（如果数据库支持），避免在业务高峰执行；先验证计划，再删除旧索引。</li><li><strong>证据：</strong>对每条查询保留 <code>EXPLAIN (ANALYZE, BUFFERS)</code> 输出，判据是扫描类型、实际行数与 buffers 符合预期，而不是「看起来更快」。</li><li><strong>反悔条件：</strong>如果数据量或访问模式变化导致维护成本超过收益，删除低收益索引，改用分区或预聚合。</li></ul>"
    }
  ]
};
