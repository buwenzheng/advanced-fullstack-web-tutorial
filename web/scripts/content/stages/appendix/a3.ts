export const a3 = {
  "id": "a3",
  "title": "B+tree 与 LSM：索引为什么长这样",
  "subtitle": "页、扇出、树高决定 IO 次数；写入放大、读放大与 compaction 决定 LSM 的代价。",
  "duration": 70,
  "status": "ready",
  "objectives": [
    "用页、扇出、树高解释索引查询的 IO 次数。",
    "区分聚簇索引与二级索引，理解回表与覆盖索引。",
    "解释 LSM 的写放大、读放大、空间放大与 compaction。",
    "用树高与扇出估算给定数据量的索引层数。"
  ],
  "keywords": ["B+tree", "LSM", "页", "扇出", "树高", "回表", "compaction"],
  "blocks": [
    {
      "type": "analogy",
      "title": "图书馆目录柜",
      "html": "找一本书不必从第一排书架翻到最后一排：先看目录柜的索引卡，按编号找到分区，再走到对应书架。B+tree 就是这套目录柜：根节点是总目录，内部节点是分区目录，叶子节点才是真正放书的地方。<br>目录柜多一层，找书就多一次开抽屉；但每层能容纳的编号很多，所以哪怕书有上千万本，目录也只需要三四层。LSM 更像「先把新书堆在入口，再定期合并到主书架」：写入很快，但找书时要同时看入口堆和主书架，合并时还要搬运大量书籍。"
    },
    {
      "type": "text",
      "title": "页、扇出、树高",
      "html": "数据库按页读写磁盘，常见页大小是 4KB 或 8KB。页里放的是排好序的 key 与指向子节点的指针；一个页能容纳的子节点数量叫扇出。扇出越大，每层能覆盖的范围越广，树高越低；树高每增加一层，一次点查就多一次随机 IO。<br>可以用「叶子页数 = 总行数 / 每页行数」和「上层页数 = 下层页数 / 扇出」逐层向上估算。比如一千万行、每页放 100 行，叶子约 10 万页；扇出 500 时，上一层 200 页，再上一层 1 页，树高为 3。这个估算不依赖具体数据库，面试里足够用来解释「为什么索引查询通常只有三四次 IO」。"
    },
    {
      "type": "table",
      "title": "B+tree vs LSM",
      "head": ["维度", "B+tree", "LSM"],
      "rows": [
        ["写入", "原地更新页，可能随机写", "先写内存表与日志，顺序追加"],
        ["读取", "按树高定位，读放大稳定", "可能要查多层文件，读放大较高"],
        ["写入放大", "页分裂与日志", "compaction 反复重写数据"],
        ["空间放大", "页内碎片", "多层文件与未合并数据"],
        ["适用负载", "读多写少、范围查询", "写多读少、追加型负载"]
      ]
    },
    {
      "type": "code",
      "title": "简化 B+tree 的插入与分裂",
      "lang": "javascript",
      "code": "function createBPlusTree(order) {\n  const maxKeys = order - 1;\n  let root = { leaf: true, keys: [], next: null };\n  let treeHeight = 1;\n\n  function findLeaf(node, key) {\n    let current = node;\n    while (!current.leaf) {\n      let i = 0;\n      while (i < current.keys.length && key >= current.keys[i]) i += 1;\n      current = current.children[i];\n    }\n    return current;\n  }\n\n  function splitLeaf(leaf) {\n    const mid = Math.ceil(leaf.keys.length / 2);\n    const right = { leaf: true, keys: leaf.keys.slice(mid), next: leaf.next };\n    leaf.keys = leaf.keys.slice(0, mid);\n    leaf.next = right;\n    return { separator: right.keys[0], right };\n  }\n\n  function insertInto(node, key) {\n    if (node.leaf) {\n      let i = 0;\n      while (i < node.keys.length && node.keys[i] < key) i += 1;\n      if (node.keys[i] === key) return null;\n      node.keys.splice(i, 0, key);\n      return node.keys.length > maxKeys ? splitLeaf(node) : null;\n    }\n    let i = 0;\n    while (i < node.keys.length && key >= node.keys[i]) i += 1;\n    const split = insertInto(node.children[i], key);\n    if (!split) return null;\n    node.keys.splice(i, 0, split.separator);\n    node.children.splice(i + 1, 0, split.right);\n    return node.keys.length > maxKeys ? splitInternal(node) : null;\n  }\n\n  function splitInternal(node) {\n    const mid = Math.floor(node.keys.length / 2);\n    const separator = node.keys[mid];\n    const right = { leaf: false, keys: node.keys.slice(mid + 1), children: node.children.slice(mid + 1) };\n    node.keys = node.keys.slice(0, mid);\n    node.children = node.children.slice(0, mid + 1);\n    return { separator, right };\n  }\n\n  function insert(key) {\n    const split = insertInto(root, key);\n    if (split) {\n      root = { leaf: false, keys: [split.separator], children: [root, split.right] };\n      treeHeight += 1;\n    }\n  }\n\n  return { insert, findLeaf, get root() { return root; }, get height() { return treeHeight; } };\n}",
      "note": "只保留插入、分裂与叶子链；删除与合并会引入更多边界，本讲不展开。"
    },
    {
      "type": "flow",
      "title": "插入 → 分裂 → 父节点 → 根分裂",
      "steps": [
        { "name": "定位叶子", "detail": "从根开始按 key 与分隔键比较，选择子节点，直到叶子。" },
        { "name": "插入并排序", "detail": "叶子内按序插入；重复 key 直接忽略，避免破坏唯一性。" },
        { "name": "叶子分裂", "detail": "超过最大 key 数时，把右半部分拆成新叶子，右叶子的第一个 key 作为分隔键。" },
        { "name": "父节点接收", "detail": "父节点插入分隔键与新子指针；如果父节点也溢出，继续向上分裂。" },
        { "name": "根分裂", "detail": "根节点溢出时创建新根，树高加一；这是 B+tree 保持平衡的方式。" }
      ]
    },
    {
      "type": "table",
      "title": "聚簇 vs 二级索引",
      "head": ["维度", "聚簇索引", "二级索引"],
      "rows": [
        ["叶子内容", "整行数据", "索引列 + 主键"],
        ["查询路径", "一次定位拿到整行", "先查二级索引，再按主键回表"],
        ["覆盖索引", "天然覆盖", "索引包含查询所需列时可避免回表"],
        ["数量", "通常一张表一个", "可以有多个"],
        ["写入成本", "影响行存储布局", "每个二级索引都要维护"]
      ]
    },
    {
      "type": "case",
      "title": "加了索引反而更慢",
      "context": "一条按状态过滤的查询原本走全表扫描 800ms；工程师给状态列加了索引，查询反而变成 2.4s。",
      "symptom": "EXPLAIN 显示使用了新索引，但回表次数很多；写入延迟也同时上升。",
      "cause": "状态列选择性很低，绝大多数行都是同一个状态；优化器用二级索引找到大量主键，再逐行回表，随机 IO 比顺序全表扫描更贵。新增索引还增加了写入维护成本。",
      "fix": "删除低选择性单列索引，改成组合索引或覆盖索引；确认查询真正需要筛选的列，避免为了「有索引」而建索引。",
      "prevention": "建索引前看选择性、回表比例与写入频率；用真实数据跑 EXPLAIN ANALYZE，而不是只看是否命中索引。",
      "metric": "删除索引后查询回到 700ms；写入 P95 下降 15%。"
    },
    {
      "type": "pitfall",
      "title": "索引越多越好、忽略选择性、LIKE 前缀",
      "html": "索引不是免费的：每个索引都要占空间，并在每次写入时维护。低选择性列（例如只有两三种状态）单独建索引，往往会让优化器做大量回表，反而不如全表扫描。<br><code>LIKE '%keyword'</code> 无法利用普通 B+tree 的前缀顺序；需要全文检索或倒排索引。组合索引要遵循最左前缀，否则后面的列用不上。建索引前先问：这条查询的频率、选择性、回表比例与写入成本各是多少？"
    },
    {
      "type": "text",
      "title": "深挖：LSM 的三种放大",
      "html": "LSM 把写入先放进内存表，写满后刷成有序文件；后台 compaction 再把多个文件合并成更大的文件。这个设计让写入变成顺序追加，吞吐很高，但代价体现在三种放大上。写放大：同一份数据在 compaction 中可能被反复读写多次，实际写入量是用户写入量的数倍。读放大：一次查询可能要检查内存表、多个层级的文件与布隆过滤器，最坏要读很多文件。空间放大：旧版本数据在被合并前仍然占空间，多层文件也会带来额外开销。<br>调 compaction 策略本质上是在三者之间取舍：更频繁的合并降低读放大与空间放大，但增加写放大；更宽松的合并相反。理解这一点，才能解释为什么 LSM 适合写多读少，而 B+tree 在读多写少与范围查询上更稳。"
    },
    {
      "type": "note",
      "title": "面试延伸",
      "html": "面试里常问「为什么数据库用 B+tree 而不是哈希」。回答要落到范围查询、有序遍历与磁盘 IO：哈希只能点查，不能高效范围扫描；B+tree 的叶子有序且用链相连，范围查询只需定位起点再顺序读。<br>追问「LSM 为什么写入快」时，不要只说「顺序写」，还要说清 compaction 的写放大、读放大与空间放大，以及布隆过滤器在减少读放大中的作用。最后补一句「没有免费的索引」：每一种结构都在为某些负载优化，同时让另一些负载付出代价。"
    }
  ],
  "checks": [
    {
      "id": "a3-check-1",
      "kind": "mcq",
      "type": "single",
      "tag": "树高",
      "prompt": "B+tree 的树高增加一层，对一次点查意味着什么？",
      "question": "B+tree 的树高增加一层，对一次点查意味着什么？",
      "options": [
        { "text": "多一次节点读取，通常意味着多一次随机 IO", "correct": true },
        { "text": "查询结果会不准确", "correct": false },
        { "text": "所有叶子节点都会失效", "correct": false },
        { "text": "树高只影响写入，不影响读取", "correct": false }
      ],
      "explain": "点查从根走到叶子，每层都要读取一个节点页；树高高一层就多一次页读取，磁盘上通常是一次随机 IO。树高不影响结果正确性，也不只是写入成本。"
    },
    {
      "id": "a3-check-2",
      "kind": "mcq",
      "type": "multi",
      "tag": "LSM 放大",
      "prompt": "LSM 常见的三种放大是什么？",
      "question": "LSM 常见的三种放大是什么？",
      "options": [
        { "text": "写放大：compaction 反复重写数据", "correct": true },
        { "text": "读放大：一次查询可能要检查多层文件", "correct": true },
        { "text": "空间放大：旧版本与多层文件占用额外空间", "correct": true },
        { "text": "网络放大：每次写入都要广播到所有节点", "correct": false },
        { "text": "锁放大：每个 key 都要加全局锁", "correct": false }
      ],
      "explain": "LSM 的经典代价是写放大、读放大与空间放大；网络广播与全局锁不是 LSM 的固有属性。"
    },
    {
      "id": "a3-check-3",
      "kind": "mcq",
      "type": "single",
      "tag": "回表",
      "prompt": "通过二级索引查询时，什么情况下需要回表？",
      "question": "通过二级索引查询时，什么情况下需要回表？",
      "options": [
        { "text": "二级索引的叶子只存索引列与主键，查询还需要其他列时", "correct": true },
        { "text": "只要使用了二级索引就一定要回表", "correct": false },
        { "text": "二级索引的叶子存了整行数据时", "correct": false },
        { "text": "查询条件使用主键时", "correct": false }
      ],
      "explain": "二级索引叶子通常只包含索引列与主键；如果查询所需列不在索引中，就要按主键回到聚簇索引取整行。覆盖索引可以避免回表。"
    }
  ],
  "exercises": [
    {
      "id": "a3-ex-1",
      "kind": "code",
      "title": "简化 B+tree",
      "brief": "实现 <code>createBPlusTree(order)</code>，提供 <code>insert(key)/search(key)/range(lo, hi)/height()/keys()</code>。order 为最大子节点数（至少 3）；只做插入不做删除；叶子按键有序并用 next 串链；重复 key 忽略；<code>range</code> 返回闭区间内的有序数组；空树高度为 1。",
      "hint": "叶子溢出时从中间拆开，右叶子的第一个 key 作为父节点分隔键；根溢出时创建新根并让树高加一。",
      "starter": "function createBPlusTree(order) {\n  return {\n    insert() {},\n    search() { return false; },\n    range() { return []; },\n    height() { return 0; },\n    keys() { return []; }\n  };\n}",
      "solution": "function createBPlusTree(order) {\n  if (!Number.isInteger(order) || order < 3) throw new Error('INVALID_ORDER');\n  const maxKeys = order - 1;\n  let root = { leaf: true, keys: [], next: null };\n  let treeHeight = 1;\n\n  function findLeaf(node, key) {\n    let current = node;\n    while (!current.leaf) {\n      let i = 0;\n      while (i < current.keys.length && key >= current.keys[i]) i += 1;\n      current = current.children[i];\n    }\n    return current;\n  }\n\n  function splitLeaf(leaf) {\n    const mid = Math.ceil(leaf.keys.length / 2);\n    const right = { leaf: true, keys: leaf.keys.slice(mid), next: leaf.next };\n    leaf.keys = leaf.keys.slice(0, mid);\n    leaf.next = right;\n    return { separator: right.keys[0], right };\n  }\n\n  function splitInternal(node) {\n    const mid = Math.floor(node.keys.length / 2);\n    const separator = node.keys[mid];\n    const right = { leaf: false, keys: node.keys.slice(mid + 1), children: node.children.slice(mid + 1) };\n    node.keys = node.keys.slice(0, mid);\n    node.children = node.children.slice(0, mid + 1);\n    return { separator, right };\n  }\n\n  function insertInto(node, key) {\n    if (node.leaf) {\n      let i = 0;\n      while (i < node.keys.length && node.keys[i] < key) i += 1;\n      if (node.keys[i] === key) return null;\n      node.keys.splice(i, 0, key);\n      return node.keys.length > maxKeys ? splitLeaf(node) : null;\n    }\n    let i = 0;\n    while (i < node.keys.length && key >= node.keys[i]) i += 1;\n    const split = insertInto(node.children[i], key);\n    if (!split) return null;\n    node.keys.splice(i, 0, split.separator);\n    node.children.splice(i + 1, 0, split.right);\n    return node.keys.length > maxKeys ? splitInternal(node) : null;\n  }\n\n  function insert(key) {\n    const split = insertInto(root, key);\n    if (split) {\n      root = { leaf: false, keys: [split.separator], children: [root, split.right] };\n      treeHeight += 1;\n    }\n  }\n\n  function search(key) {\n    return findLeaf(root, key).keys.includes(key);\n  }\n\n  function range(lo, hi) {\n    const result = [];\n    let leaf = findLeaf(root, lo);\n    while (leaf) {\n      for (const key of leaf.keys) {\n        if (key > hi) return result;\n        if (key >= lo) result.push(key);\n      }\n      leaf = leaf.next;\n    }\n    return result;\n  }\n\n  function keys() {\n    const result = [];\n    let leaf = root;\n    while (!leaf.leaf) leaf = leaf.children[0];\n    while (leaf) {\n      result.push(...leaf.keys);\n      leaf = leaf.next;\n    }\n    return result;\n  }\n\n  return { insert, search, range, height: () => treeHeight, keys };\n}",
      "tests": [
        {
          "name": "空树",
          "code": "const tree = createBPlusTree(4);\nassert.equal(tree.height(), 1);\nassert.deepEqual(tree.keys(), []);\nassert.equal(tree.search(1), false);"
        },
        {
          "name": "单个 key",
          "code": "const tree = createBPlusTree(4);\ntree.insert(10);\nassert.equal(tree.search(10), true);\nassert.equal(tree.height(), 1);\nassert.deepEqual(tree.keys(), [10]);"
        },
        {
          "name": "重复 key 被忽略",
          "code": "const tree = createBPlusTree(4);\ntree.insert(1);\ntree.insert(1);\nassert.deepEqual(tree.keys(), [1]);"
        },
        {
          "name": "根分裂后树高增加",
          "code": "const tree = createBPlusTree(4);\nfor (const key of [1, 2, 3, 4]) tree.insert(key);\nassert.equal(tree.height(), 2);\nfor (const key of [1, 2, 3, 4]) assert.equal(tree.search(key), true);"
        },
        {
          "name": "多层分裂",
          "code": "const tree = createBPlusTree(4);\nfor (let key = 1; key <= 20; key += 1) tree.insert(key);\nassert.ok(tree.height() >= 3);\nassert.equal(tree.keys().length, 20);\nfor (let key = 1; key <= 20; key += 1) assert.equal(tree.search(key), true);"
        },
        {
          "name": "范围查询覆盖闭区间",
          "code": "const tree = createBPlusTree(4);\nfor (let key = 1; key <= 20; key += 1) tree.insert(key);\nassert.deepEqual(tree.range(5, 12), [5, 6, 7, 8, 9, 10, 11, 12]);\nassert.deepEqual(tree.range(100, 200), []);"
        },
        {
          "name": "乱序插入后 keys 有序",
          "code": "const tree = createBPlusTree(4);\nfor (const key of [7, 3, 9, 1, 5, 8, 2, 6, 4, 10]) tree.insert(key);\nassert.deepEqual(tree.keys(), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);"
        },
        {
          "name": "降序插入",
          "code": "const tree = createBPlusTree(4);\nfor (let key = 20; key >= 1; key -= 1) tree.insert(key);\nassert.deepEqual(tree.keys(), Array.from({ length: 20 }, (_, i) => i + 1));"
        },
        {
          "name": "缺失 key 查找失败",
          "code": "const tree = createBPlusTree(4);\nfor (const key of [2, 4, 6, 8]) tree.insert(key);\nassert.equal(tree.search(5), false);\nassert.equal(tree.search(9), false);"
        },
        {
          "name": "order 过小抛错",
          "code": "assert.throws(() => createBPlusTree(2));"
        }
      ]
    }
  ]
};
