export const bHash = {
  "id": "b-hash",
  "title": "哈希表：平均 O(1) 的代价与边界",
  "subtitle": "哈希函数、冲突、墓碑、扩容与负载因子——平均 O(1) 背后的一整套约束。",
  "duration": 65,
  "status": "ready",
  "objectives": [
    "解释哈希函数、冲突、负载因子与扩容的关系。",
    "实现开放寻址哈希表，并正确处理删除墓碑与 rehash。",
    "识别哈希洪水、最坏 O(n)、迭代顺序不稳定等边界。",
    "判断什么时候不该用哈希表，例如范围查询、排序与内存敏感场景。"
  ],
  "keywords": ["哈希表", "开放寻址", "线性探测", "墓碑", "负载因子", "rehash"],
  "blocks": [
    {
      "type": "analogy",
      "title": "快递柜与取件码",
      "html": "哈希表像一排快递柜：取件码经过一个固定规则算出柜门编号，直接走到那个柜子取件，不用从第一排找到最后一排。规则算得快，取件就快；但如果两个取件码算到同一个柜子，就得按约定往后找空柜，这就是冲突。<br>柜子越满，找空柜越慢；删除包裹后如果直接把柜子清空，后面的人会以为「到这里就没了」，所以需要留一张「此柜曾用过」的墓碑。扩容则像换一排更大的柜子：所有包裹都要按新编号重新摆一遍，代价是一次性的，但省不掉。"
    },
    {
      "type": "text",
      "title": "哈希函数与冲突",
      "html": "哈希函数把任意 key 映射到固定范围的整数。好的哈希函数要确定、均匀、计算快：同一个 key 每次得到同样的值，不同 key 尽量分散，计算成本不能高过查找本身。冲突不可避免：只要 key 的可能取值多于槽位，就一定有多个 key 落到同一槽。<br>冲突处理有两条主流路线：链地址把同一槽的元素串成链表或树，开放寻址则在表内继续探测下一个槽。链地址删除简单，但节点分散、缓存不友好；开放寻址缓存友好，但删除需要墓碑，负载因子高时探测链会迅速变长。"
    },
    {
      "type": "table",
      "title": "链地址 vs 开放寻址",
      "head": ["维度", "链地址", "开放寻址"],
      "rows": [
        ["冲突处理", "同槽元素挂链或转红黑树", "按固定序列探测下一个槽"],
        ["删除", "直接摘链，无需墓碑", "必须留墓碑，否则探测链断裂"],
        ["缓存局部性", "节点分散，指针跳转多", "连续数组，局部性好"],
        ["负载因子", "可以超过 1", "必须低于 1，通常 0.5-0.75"],
        ["最坏情况", "所有 key 同槽退化为 O(n)", "表满或墓碑多时探测退化为 O(n)"]
      ]
    },
    {
      "type": "code",
      "title": "开放寻址哈希表",
      "lang": "javascript",
      "code": "function createHashMap({ initialCapacity = 8, maxLoad = 0.75 } = {}) {\n  let capacity = Math.max(1, initialCapacity | 0);\n  let keys = new Array(capacity).fill(undefined);\n  let values = new Array(capacity).fill(undefined);\n  let state = new Array(capacity).fill(0); // 0 空、1 占用、2 墓碑\n  let size = 0;\n  let tombstones = 0;\n\n  const hash = (key) => {\n    let h = 0;\n    for (const ch of String(key)) h = (h + ch.charCodeAt(0)) >>> 0;\n    return h;\n  };\n\n  const find = (key) => {\n    const start = hash(key) % capacity;\n    let firstTombstone = -1;\n    for (let step = 0; step < capacity; step += 1) {\n      const index = (start + step) % capacity;\n      if (state[index] === 0) return { index: -1, insert: firstTombstone >= 0 ? firstTombstone : index };\n      if (state[index] === 2) {\n        if (firstTombstone < 0) firstTombstone = index;\n      } else if (keys[index] === key) {\n        return { index, insert: index };\n      }\n    }\n    return { index: -1, insert: firstTombstone };\n  };\n\n  const resize = () => {\n    const oldKeys = keys;\n    const oldValues = values;\n    const oldState = state;\n    capacity *= 2;\n    keys = new Array(capacity).fill(undefined);\n    values = new Array(capacity).fill(undefined);\n    state = new Array(capacity).fill(0);\n    size = 0;\n    tombstones = 0;\n    for (let i = 0; i < oldState.length; i += 1) {\n      if (oldState[i] === 1) set(oldKeys[i], oldValues[i]);\n    }\n  };\n\n  function set(key, value) {\n    const found = find(key);\n    if (found.index >= 0) {\n      values[found.index] = value;\n      return;\n    }\n    if (found.insert < 0) {\n      resize();\n      set(key, value);\n      return;\n    }\n    keys[found.insert] = key;\n    values[found.insert] = value;\n    state[found.insert] = 1;\n    size += 1;\n    if ((size + tombstones) / capacity > maxLoad) resize();\n  }\n\n  return {\n    set,\n    get(key) {\n      const { index } = find(key);\n      return index >= 0 ? values[index] : undefined;\n    },\n    has(key) { return find(key).index >= 0; },\n    delete(key) {\n      const { index } = find(key);\n      if (index < 0) return false;\n      state[index] = 2;\n      keys[index] = undefined;\n      values[index] = undefined;\n      size -= 1;\n      tombstones += 1;\n      return true;\n    },\n    size() { return size; },\n    loadFactor() { return (size + tombstones) / capacity; }\n  };\n}",
      "note": "这里用字符码求和做演示哈希；真实实现需要分布更均匀的哈希函数。负载因子把墓碑计入。"
    },
    {
      "type": "flow",
      "title": "put → 探测 → 冲突 → 扩容 → rehash",
      "steps": [
        { "name": "计算槽位", "detail": "用哈希值对容量取模；哈希函数必须确定且分布均匀。" },
        { "name": "线性探测", "detail": "从起点依次看下一个槽；遇到空槽停止，遇到墓碑先记住作为候选插入点。" },
        { "name": "命中或插入", "detail": "找到相同 key 就覆盖；找到空槽或可复用墓碑就写入。" },
        { "name": "判断负载", "detail": "插入后如果 (size + 墓碑) / 容量超过阈值，准备扩容。" },
        { "name": "扩容与 rehash", "detail": "容量翻倍，所有有效元素重新计算槽位；墓碑被清除，探测链重建。" }
      ]
    },
    {
      "type": "case",
      "title": "哈希洪水打满 CPU",
      "context": "一个公开 API 把用户提交的字符串直接放进哈希表做去重，攻击者构造了大量会落到同一槽的 key，服务 CPU 从 30% 升到 100%。",
      "symptom": "请求量没有明显增加，但单请求耗时从 1ms 涨到 300ms；哈希表查找次数呈平方增长，线程池很快被占满。",
      "cause": "哈希函数可预测且没有随机盐，攻击者能批量制造冲突；冲突链退化，平均 O(1) 变成最坏 O(n)，总成本变成 O(n²)。",
      "fix": "为哈希函数加入进程级随机盐，限制单 key 长度与表规模；对公开输入先做限流与长度校验。",
      "prevention": "不要把攻击者可控的字符串直接送入无盐哈希；压测时加入最坏冲突场景；监控单次查找耗时与冲突链长度。",
      "metric": "加盐后最坏单请求耗时回到 2ms，CPU 回落到 35%。"
    },
    {
      "type": "pitfall",
      "title": "可变 key、删除不墓碑、扩容时机",
      "html": "可变 key：对象或数组作为 key，修改内容后哈希值变化，原来的槽位再也找不到；key 必须不可变，或者使用稳定的 id。<br>删除不墓碑：开放寻址里把槽位置空，后续探测会提前停止，导致「明明存在却查不到」；删除必须留墓碑，扩容时再清理。<br>扩容时机：等到表满才扩容，探测链已经很长，插入和查找都会退化；应在负载因子达到阈值时扩容，并给墓碑留出预算。"
    },
    {
      "type": "text",
      "title": "深挖：最坏 O(n) 与语言实现",
      "html": "「哈希表平均 O(1)」省略了两个前提：哈希函数均匀、负载因子受控。攻击者可以故意制造冲突，让所有 key 落到同一槽，此时链地址退化为链表，开放寻址退化为线性扫描，最坏都是 O(n)。Java 的 HashMap 在链表过长时把桶转成红黑树，把最坏查找从 O(n) 降到 O(log n)；一些语言给字符串哈希加入随机盐，让攻击者无法离线预测槽位。Python 的 dict 使用开放寻址，迭代顺序按插入顺序稳定，但这不是语言规范对所有实现的保证；JavaScript 对象的属性顺序也有自己的规则，不能把哈希表当排序结构使用。<br>这些实现差异说明：哈希表是一个契约，不是一种固定结构。选型时要问清楚最坏情况、删除成本、迭代顺序与内存开销，而不是只记住「查找 O(1)」。"
    },
    {
      "type": "steps",
      "title": "为计数器选哈希表",
      "steps": [
        { "title": "明确 key 与操作", "html": "key 是不可变字符串还是对象 id？主要操作是写入、查询还是删除？" },
        { "title": "估算规模与内存", "html": "元素数量、平均 key 长度、是否需要保留插入顺序；内存敏感时避免每个节点单独分配。" },
        { "title": "检查删除频率", "html": "高频删除会积累墓碑；开放寻址需要定期 rehash，链地址删除更直接。" },
        { "title": "确认最坏情况", "html": "输入是否攻击者可控？是否需要随机盐、限长或红黑树化？" },
        { "title": "验证边界", "html": "范围查询、排序、前缀搜索都不适合哈希表；这些需求应该选有序结构。" }
      ]
    },
    {
      "type": "note",
      "title": "面试延伸",
      "html": "面试里常问「哈希表为什么平均 O(1)，最坏 O(n)」。回答要同时覆盖哈希函数、冲突处理与负载因子，并给出一个具体的最坏场景，例如攻击者制造同槽 key。<br>追问「删除为什么需要墓碑」时，画出探测链：删除 A 后如果置空，查找 C 会在空槽处提前停止；墓碑告诉探测「这里曾经有元素，继续往后找」。再追问「什么时候不该用哈希表」，回答范围查询、排序输出与内存敏感场景，并说明有序结构或数组更合适。"
    }
  ],
  "checks": [
    {
      "id": "b-hash-check-1",
      "kind": "mcq",
      "type": "single",
      "tag": "负载因子",
      "prompt": "开放寻址哈希表的负载因子升高时，平均查找为什么会变慢？",
      "question": "开放寻址哈希表的负载因子升高时，平均查找为什么会变慢？",
      "options": [
        { "text": "空槽变少，冲突后的探测链变长，需要检查更多槽位", "correct": true },
        { "text": "哈希函数会随机变慢", "correct": false },
        { "text": "数组下标访问从 O(1) 变成 O(log n)", "correct": false },
        { "text": "负载因子只影响内存，不影响查找", "correct": false }
      ],
      "explain": "开放寻址依赖空槽终止探测；负载因子越高，连续占用与墓碑越多，平均探测长度越长。哈希函数本身不会因为负载变化而变慢，数组下标访问也仍是 O(1)。"
    },
    {
      "id": "b-hash-check-2",
      "kind": "mcq",
      "type": "multi",
      "tag": "墓碑",
      "prompt": "开放寻址哈希表删除元素时，为什么不能直接把槽位置空？",
      "question": "开放寻址哈希表删除元素时，为什么不能直接把槽位置空？",
      "options": [
        { "text": "置空会让后续探测提前停止，导致本来存在的 key 查不到", "correct": true },
        { "text": "墓碑保留「这里曾有元素」的信息，让探测继续往后找", "correct": true },
        { "text": "墓碑可以在扩容或 rehash 时被清理", "correct": true },
        { "text": "置空会让哈希函数失效", "correct": false },
        { "text": "墓碑能让哈希表支持范围查询", "correct": false }
      ],
      "explain": "置空破坏了探测链；墓碑是「继续探测」的标记，代价是占用槽位，需要在扩容或 rehash 时清理。墓碑不会改变哈希函数，也不会让哈希表支持范围查询。"
    },
    {
      "id": "b-hash-check-3",
      "kind": "mcq",
      "type": "single",
      "tag": "适用边界",
      "prompt": "以下哪个需求最不适合用哈希表实现？",
      "question": "以下哪个需求最不适合用哈希表实现？",
      "options": [
        { "text": "按分数区间查询学生，并返回有序结果", "correct": true },
        { "text": "按用户 id 查询用户信息", "correct": false },
        { "text": "统计每个短码被访问的次数", "correct": false },
        { "text": "判断某个 token 是否已使用", "correct": false }
      ],
      "explain": "哈希表不保序，也不支持高效范围扫描；按区间查询并排序应使用 B+tree、跳表或有序数组。其余三项都是典型的点查或计数场景。"
    }
  ],
  "exercises": [
    {
      "id": "b-hash-ex-1",
      "kind": "code",
      "title": "开放寻址哈希表",
      "brief": "实现 <code>createHashMap({ initialCapacity = 8, maxLoad = 0.75 })</code>，提供 <code>set/get/has/delete/size/loadFactor</code>。字符串 key；线性探测；删除使用墓碑；负载因子按 <code>(size + tombstones) / capacity</code> 计算；超过 <code>maxLoad</code> 时容量翻倍并 rehash；<code>get</code> 缺失返回 <code>undefined</code>，<code>delete</code> 返回是否删除成功。",
      "hint": "探测时记住第一个墓碑作为插入候选；扩容后重新插入所有有效元素，墓碑自然清零。",
      "starter": "function createHashMap({ initialCapacity = 8, maxLoad = 0.75 } = {}) {\n  return {\n    set() {},\n    get() { return undefined; },\n    has() { return false; },\n    delete() { return false; },\n    size() { return 0; },\n    loadFactor() { return 0; }\n  };\n}",
      "solution": "function createHashMap({ initialCapacity = 8, maxLoad = 0.75 } = {}) {\n  let capacity = Math.max(1, initialCapacity | 0);\n  let keys = new Array(capacity).fill(undefined);\n  let values = new Array(capacity).fill(undefined);\n  let state = new Array(capacity).fill(0);\n  let size = 0;\n  let tombstones = 0;\n  const hash = (key) => {\n    let h = 0;\n    for (const ch of String(key)) h = (h + ch.charCodeAt(0)) >>> 0;\n    return h;\n  };\n  const find = (key) => {\n    const start = hash(key) % capacity;\n    let firstTombstone = -1;\n    for (let step = 0; step < capacity; step += 1) {\n      const index = (start + step) % capacity;\n      if (state[index] === 0) return { index: -1, insert: firstTombstone >= 0 ? firstTombstone : index };\n      if (state[index] === 2) {\n        if (firstTombstone < 0) firstTombstone = index;\n      } else if (keys[index] === key) {\n        return { index, insert: index };\n      }\n    }\n    return { index: -1, insert: firstTombstone };\n  };\n  const resize = () => {\n    const oldKeys = keys;\n    const oldValues = values;\n    const oldState = state;\n    capacity *= 2;\n    keys = new Array(capacity).fill(undefined);\n    values = new Array(capacity).fill(undefined);\n    state = new Array(capacity).fill(0);\n    size = 0;\n    tombstones = 0;\n    for (let i = 0; i < oldState.length; i += 1) {\n      if (oldState[i] === 1) set(oldKeys[i], oldValues[i]);\n    }\n  };\n  function set(key, value) {\n    const found = find(key);\n    if (found.index >= 0) { values[found.index] = value; return; }\n    if (found.insert < 0) { resize(); set(key, value); return; }\n    keys[found.insert] = key;\n    values[found.insert] = value;\n    state[found.insert] = 1;\n    size += 1;\n    if ((size + tombstones) / capacity > maxLoad) resize();\n  }\n  return {\n    set,\n    get(key) { const { index } = find(key); return index >= 0 ? values[index] : undefined; },\n    has(key) { return find(key).index >= 0; },\n    delete(key) {\n      const { index } = find(key);\n      if (index < 0) return false;\n      state[index] = 2;\n      keys[index] = undefined;\n      values[index] = undefined;\n      size -= 1;\n      tombstones += 1;\n      return true;\n    },\n    size() { return size; },\n    loadFactor() { return (size + tombstones) / capacity; }\n  };\n}",
      "tests": [
        {
          "name": "基本读写",
          "code": "const map = createHashMap();\nmap.set('a', 1);\nassert.equal(map.get('a'), 1);\nassert.equal(map.size(), 1);"
        },
        {
          "name": "覆盖已有 key",
          "code": "const map = createHashMap();\nmap.set('a', 1);\nmap.set('a', 2);\nassert.equal(map.get('a'), 2);\nassert.equal(map.size(), 1);"
        },
        {
          "name": "冲突后仍能查到两个 key",
          "code": "const map = createHashMap();\nmap.set('a', 1);\nmap.set('i', 2);\nassert.equal(map.get('a'), 1);\nassert.equal(map.get('i'), 2);\nassert.equal(map.size(), 2);"
        },
        {
          "name": "has 与缺失 key",
          "code": "const map = createHashMap();\nmap.set('a', 1);\nassert.equal(map.has('a'), true);\nassert.equal(map.has('missing'), false);\nassert.equal(map.get('missing'), undefined);"
        },
        {
          "name": "删除后不可见",
          "code": "const map = createHashMap();\nmap.set('a', 1);\nmap.set('b', 2);\nassert.equal(map.delete('a'), true);\nassert.equal(map.has('a'), false);\nassert.equal(map.get('a'), undefined);\nassert.equal(map.size(), 1);\nassert.equal(map.delete('a'), false);"
        },
        {
          "name": "墓碑可复用且不截断探测链",
          "code": "const map = createHashMap();\nmap.set('a', 1);\nmap.set('i', 2);\nmap.delete('a');\nmap.set('q', 3);\nassert.equal(map.get('i'), 2);\nassert.equal(map.get('q'), 3);"
        },
        {
          "name": "超过负载因子后扩容",
          "code": "const map = createHashMap();\nfor (const key of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) map.set(key, key);\nassert.equal(map.size(), 7);\nassert.equal(map.loadFactor(), 0.4375);\nfor (const key of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) assert.equal(map.get(key), key);"
        },
        {
          "name": "负载因子包含墓碑",
          "code": "const map = createHashMap();\nmap.set('a', 1);\nmap.set('b', 2);\nmap.set('c', 3);\nassert.equal(map.loadFactor(), 0.375);\nmap.delete('b');\nassert.equal(map.size(), 2);\nassert.equal(map.loadFactor(), 0.375);"
        },
        {
          "name": "大量 key 仍可检索",
          "code": "const map = createHashMap();\nfor (let i = 0; i < 20; i += 1) map.set('k' + i, i);\nassert.equal(map.size(), 20);\nfor (let i = 0; i < 20; i += 1) assert.equal(map.get('k' + i), i);"
        },
        {
          "name": "重复扩容后仍保持正确",
          "code": "const map = createHashMap({ initialCapacity: 2, maxLoad: 0.5 });\nfor (let i = 0; i < 30; i += 1) map.set('x' + i, i * 2);\nassert.equal(map.size(), 30);\nfor (let i = 0; i < 30; i += 1) assert.equal(map.get('x' + i), i * 2);\nassert.ok(map.loadFactor() <= 0.5);"
        }
      ]
    }
  ]
};
