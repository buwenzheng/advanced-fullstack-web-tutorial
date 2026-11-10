export const a6 = {
  "id": "a6",
  "title": "概率结构：布隆过滤器与 HyperLogLog",
  "subtitle": "用可控的误差换内存：布隆回答「可能在不在」，HLL 回答「大约有多少」。",
  "duration": 70,
  "status": "ready",
  "objectives": [
    "解释布隆过滤器的位数组、哈希个数与误判率之间的关系。",
    "实现布隆过滤器，准确表述「可能包含」与「一定不包含」。",
    "解释 HyperLogLog 的分桶、前导零、调和平均与误差。",
    "判断去重与计数场景该用精确结构还是概率结构。"
  ],
  "keywords": ["布隆过滤器", "误判率", "HyperLogLog", "基数估算", "调和平均", "UV"],
  "blocks": [
    {
      "type": "analogy",
      "title": "门口保安的「好像见过」",
      "html": "保安记不住所有人的脸，只在名单上做粗略标记。你问「这个人能进吗」，他说「肯定没见过」时你可以放心拦下；他说「好像见过」时，你还得去系统里核实。布隆过滤器就是这位保安：它可能误报，但不会漏报。<br>这个类比的边界是「删除」：保安可以把整本名单作废重来，但很难把某一个人的标记干净地擦掉，因为多个人的标记可能落在同一格。标准布隆过滤器不支持删除，原因就在这里。"
    },
    {
      "type": "text",
      "title": "布隆过滤器",
      "html": "布隆过滤器是一个固定长度的位数组，加 k 个独立的哈希函数。添加元素时，用每个哈希函数算出一个位置，把对应位设为 1；查询时同样算出 k 个位置，只要有一位是 0，就说明元素一定没有被添加过；如果全为 1，只能说明「可能」添加过，因为这些位可能被其他元素碰巧置位。<br>误判率由三个量决定：位数组长度 m、哈希函数个数 k、已插入元素个数 n。直观地说，位数组越短、插入越多，位越拥挤，误判率越高；哈希个数太少，区分度不够，太多又会很快把位填满。工程上通常先按预期元素数量与可接受误判率选 m，再按最优公式选 k。<br>布隆过滤器的价值在于节省内存与减少无效查询：把「一定不存在」的判断挡在缓存或数据库之前，可以显著降低穿透。它不负责删除，也不负责返回元素本身；需要删除时要用计数布隆或换用其他结构。"
    },
    {
      "type": "code",
      "title": "布隆过滤器",
      "lang": "javascript",
      "code": "function createBloomFilter({ bits, hashes }) {\n  if (!Number.isInteger(bits) || bits <= 0) throw new Error('INVALID_BITS');\n  if (!Array.isArray(hashes) || hashes.length === 0) throw new Error('INVALID_HASHES');\n  const slots = new Uint8Array(bits);\n  let setBits = 0;\n  const indexOf = (hash, value) => Math.abs(hash(value)) % bits;\n  return {\n    add(value) {\n      for (const hash of hashes) {\n        const index = indexOf(hash, value);\n        if (slots[index] === 0) {\n          slots[index] = 1;\n          setBits += 1;\n        }\n      }\n    },\n    mightContain(value) {\n      return hashes.every((hash) => slots[indexOf(hash, value)] === 1);\n    },\n    falsePositiveRate() {\n      return Math.pow(setBits / bits, hashes.length);\n    }\n  };\n}",
      "note": "用已置位比例 p 估算误判率 p^k；这是估算值，不是精确概率，但足以观察趋势。"
    },
    {
      "type": "text",
      "title": "HyperLogLog：用前导零估算基数",
      "html": "HyperLogLog 要解决的问题是：不保存每个元素，怎么知道一共有多少个不同的元素。它的观察很巧妙：如果哈希值均匀分布，那么「连续看到 k 个前导零」的概率大约是 2 的负 k 次方；观察到的最大前导零长度，可以反推大概尝试了多少个不同值。<br>单个估计的方差太大，于是 HLL 把哈希空间分成 m 个桶，每个桶记录自己见过的最大前导零长度，最后用调和平均把 m 个估计合成一个。调和平均的作用是抑制个别极大值的影响；桶数 m 越大，误差越小，理论相对误差约为 1.04 / √m。内存开销是 m 个小整数，通常每个桶 5 到 6 位，因此几 KB 就能估算上亿基数。<br>代价是：HLL 只给估算值，不给元素列表，也不支持删除（除非使用更复杂的变体）；小基数时需要偏差修正，否则估算会明显偏高。它适合 UV 统计、独立访客数、大流量去重计数这类「要趋势、不要精确名单」的场景；账务、库存等需要精确数字的地方不能用它。"
    },
    {
      "type": "code",
      "title": "HyperLogLog",
      "lang": "javascript",
      "code": "function createHLL(precision) {\n  if (!Number.isInteger(precision) || precision < 4 || precision > 16) {\n    throw new Error('INVALID_PRECISION');\n  }\n  const bucketCount = 2 ** precision;\n  const buckets = new Array(bucketCount).fill(0);\n  const fmix32 = (h) => {\n    h ^= h >>> 16;\n    h = Math.imul(h, 0x85ebca6b);\n    h ^= h >>> 13;\n    h = Math.imul(h, 0xc2b2ae35);\n    h ^= h >>> 16;\n    return h >>> 0;\n  };\n  const hash64 = (value) => {\n    let h1 = 0x811c9dc5;\n    let h2 = 0x9e3779b9;\n    for (const ch of String(value)) {\n      h1 = Math.imul(h1 ^ ch.charCodeAt(0), 0x01000193) >>> 0;\n      h2 = (Math.imul(h2 ^ ch.charCodeAt(0), 0x85ebca6b) + 0x165667b1) >>> 0;\n    }\n    return [fmix32(h1), fmix32(h2)];\n  };\n  return {\n    add(value) {\n      const [h1, h2] = hash64(value);\n      const index = h1 >>> (32 - precision);\n      const rank = h2 === 0 ? 33 : Math.clz32(h2) + 1;\n      if (rank > buckets[index]) buckets[index] = rank;\n    },\n    estimate() {\n      const m = bucketCount;\n      let sum = 0;\n      let zeros = 0;\n      for (const value of buckets) {\n        sum += 2 ** (-value);\n        if (value === 0) zeros += 1;\n      }\n      const alpha = m === 16 ? 0.673 : m === 32 ? 0.697 : m === 64 ? 0.709 : 0.7213 / (1 + 1.079 / m);\n      let raw = (alpha * m * m) / sum;\n      if (raw <= 2.5 * m && zeros > 0) raw = m * Math.log(m / zeros);\n      return raw;\n    }\n  };\n}",
      "note": "桶索引取 h1 的高 precision 位；前导零用 h2 计算；小基数时用线性计数修正，否则空桶多会把估算拉高。"
    },
    {
      "type": "table",
      "title": "精确 vs 概率",
      "head": ["结构", "内存", "结果语义", "可删除", "典型场景"],
      "rows": [
        ["哈希集合", "随元素线性增长", "精确成员判断", "可以", "精确去重、名单校验"],
        ["布隆过滤器", "按位数组固定", "可能存在 / 一定不存在", "标准实现不可以", "缓存穿透、写前判重"],
        ["计数布隆", "每格若干位", "可能存在的近似计数", "有限支持", "需要删除的判重场景"],
        ["HyperLogLog", "按桶数固定，几 KB 起", "基数估算，有误差", "不支持", "UV、独立访客、趋势统计"]
      ]
    },
    {
      "type": "case",
      "title": "布隆过滤器说「可能存在」，DB 却没有",
      "context": "短链服务在查询数据库前先查布隆过滤器，过滤「一定不存在」的短码。上线后监控发现少量请求仍然打到数据库，且确实查不到记录。",
      "symptom": "布隆过滤器返回可能存在，但数据库没有对应短码；请求量不大，但被误判的短码重复出现。",
      "cause": "这是布隆过滤器的正常误判，不是 bug。多个短码的哈希位置重叠，使未写入的短码看起来「全为 1」。团队误以为布隆能给出精确判断，没有准备数据库空结果兜底。",
      "fix": "保留数据库查询作为兜底；把空结果写入短 TTL 的负缓存，避免同一误判反复穿透；监控误判率，必要时增大位数组或调整哈希个数。",
      "prevention": "在接入布隆过滤器前写清语义：只用于「一定不存在」的拦截，不承诺「存在」；为误判准备兜底路径与监控，不用它替代唯一性约束。",
      "metric": "加入负缓存后，重复误判请求下降 95%；数据库兜底查询保持可观测。"
    },
    {
      "type": "pitfall",
      "title": "用布隆做删除、忽略误判率、HLL 小基数误差",
      "html": "现象一：业务需要删除已加入布隆过滤器的元素，于是直接把对应位清 0。结果是其他元素的查询也开始返回「一定不存在」，造成漏报。标准布隆的位是共享的，不能单独清位；需要删除时应使用计数布隆或重建过滤器。<br>现象二：位数组按「先上线再说」随意设置，元素量增长后误判率飙升，缓存穿透反而更严重。位数组长度与哈希个数必须按预期规模估算，并在容量接近上限时扩容或重建。<br>现象三：HLL 在基数很小时直接使用原始估算，误差可能达到数倍。小基数需要线性计数修正；如果业务要求精确的小数字，直接使用集合更合适。<br>预防方式：为概率结构写明「允许的误差、是否可删除、容量上限、如何重建」，并在测试里覆盖误判与估算边界。"
    },
    {
      "type": "steps",
      "title": "为短链去重选结构",
      "steps": [
        { "title": "明确问题", "html": "是判断短码是否已存在，还是统计独立访客数；前者是成员判断，后者是基数估算，不能用同一个结构。" },
        { "title": "估算规模与内存", "html": "预计短码总量、每日新增、可接受误判率；按位数组公式估算内存，确认在预算内。" },
        { "title": "确认删除需求", "html": "短码是否会回收或重新分配；如果需要删除，标准布隆不适用，考虑计数布隆或数据库唯一索引。" },
        { "title": "准备兜底路径", "html": "误判时数据库查询与负缓存必须存在；不能把布隆当作唯一真相。" },
        { "title": "监控与重建", "html": "监控误判率、位数组填充率、估算误差；容量接近上限时按计划重建。" }
      ]
    },
    {
      "type": "note",
      "title": "面试延伸",
      "html": "面试常问「布隆过滤器能不能删除元素」。标准答案是：不能直接删除，因为一个位可能被多个元素共享，清位会让其他元素漏报；可以改用计数布隆，把每个位置换成计数器，删除时减一，但内存会成倍增加。另一个追问是「布隆和 HLL 都能省内存，有什么区别」：布隆回答成员是否存在，HLL 回答集合有多大；前者错在「可能误报存在」，后者错在「数值有误差」，两者都不能用于精确账务。<br>如果被问「怎么选位数组大小」，先给出预期元素数与可接受误判率，再说明位数组与哈希个数要一起调；只背公式而不说假设，通常会被继续追问。"
    }
  ],
  "checks": [
    {
      "id": "a6-check-1",
      "kind": "mcq",
      "type": "single",
      "tag": "布隆语义",
      "prompt": "布隆过滤器对某个元素返回 false，这意味着什么？",
      "question": "布隆过滤器对某个元素返回 false，这意味着什么？",
      "options": [
        { "text": "该元素一定没有被添加过，可以安全地跳过后续查询", "correct": true },
        { "text": "该元素可能没有添加过，仍需查询数据库确认", "correct": false },
        { "text": "该元素一定存在，只是哈希函数出了问题", "correct": false },
        { "text": "布隆过滤器无法返回 false，只会返回 true", "correct": false }
      ],
      "explain": "布隆过滤器只保证「不存在」的判断可靠：只要有一位是 0，元素一定没被添加。返回 true 才是不确定的「可能存在」。"
    },
    {
      "id": "a6-check-2",
      "kind": "mcq",
      "type": "multi",
      "tag": "误判率",
      "prompt": "哪些因素会影响布隆过滤器的误判率？",
      "question": "哪些因素会影响布隆过滤器的误判率？",
      "options": [
        { "text": "位数组长度：位越少，位越拥挤，误判率越高", "correct": true },
        { "text": "哈希函数个数：太少区分度不足，太多会加速填满", "correct": true },
        { "text": "已插入元素数量：插入越多，置位比例越高", "correct": true },
        { "text": "查询时使用的编程语言", "correct": false },
        { "text": "元素插入的先后顺序", "correct": false }
      ],
      "explain": "误判率由位数组长度、哈希个数与元素数量共同决定；语言与插入顺序不影响位数组的最终填充程度。"
    },
    {
      "id": "a6-check-3",
      "kind": "mcq",
      "type": "single",
      "tag": "HLL 误差",
      "prompt": "HLL 估算 100 万 UV，理论误差约 2%。这个结果应该怎么用？",
      "question": "HLL 估算 100 万 UV，理论误差约 2%。这个结果应该怎么用？",
      "options": [
        { "text": "用于趋势与容量判断，并在报表中标注估算值与误差范围", "correct": true },
        { "text": "直接作为财务结算的精确人数", "correct": false },
        { "text": "误差 2% 说明 HLL 实现有 bug，必须修复到 0", "correct": false },
        { "text": "把估算值乘以 1.02 就能得到精确值", "correct": false }
      ],
      "explain": "HLL 是估算结构，2% 是设计内的误差，不是缺陷。它适合趋势、容量与报表，并应标注误差；精确结算必须使用集合或数据库去重。"
    }
  ],
  "exercises": [
    {
      "id": "a6-ex-1",
      "kind": "code",
      "title": "布隆过滤器 + HyperLogLog",
      "brief": "实现两个概率结构。<code>createBloomFilter({ bits, hashes })</code> 返回 <code>{ add, mightContain, falsePositiveRate }</code>：位数组长度固定，<code>hashes</code> 是注入的哈希函数数组；<code>falsePositiveRate()</code> 用已置位比例估算误判率。<code>createHLL(precision)</code> 返回 <code>{ add, estimate }</code>：桶数为 <code>2^precision</code>，<code>precision</code> 必须在 4 到 16 之间；重复元素不重复计数。",
      "hint": "布隆的索引用 hash(value) 对 bits 取模；HLL 用 h1 的高位选桶、h2 的前导零计算 rank，小基数用线性计数修正。",
      "starter": "function createBloomFilter({ bits, hashes }) {\n  return {\n    add() {},\n    mightContain() { return false; },\n    falsePositiveRate() { return 0; }\n  };\n}\n\nfunction createHLL(precision) {\n  return {\n    add() {},\n    estimate() { return 0; }\n  };\n}",
      "solution": "function createBloomFilter({ bits, hashes }) {\n  if (!Number.isInteger(bits) || bits <= 0) throw new Error('INVALID_BITS');\n  if (!Array.isArray(hashes) || hashes.length === 0) throw new Error('INVALID_HASHES');\n  const slots = new Uint8Array(bits);\n  let setBits = 0;\n  const indexOf = (hash, value) => Math.abs(hash(value)) % bits;\n  return {\n    add(value) {\n      for (const hash of hashes) {\n        const index = indexOf(hash, value);\n        if (slots[index] === 0) {\n          slots[index] = 1;\n          setBits += 1;\n        }\n      }\n    },\n    mightContain(value) {\n      return hashes.every((hash) => slots[indexOf(hash, value)] === 1);\n    },\n    falsePositiveRate() {\n      return Math.pow(setBits / bits, hashes.length);\n    }\n  };\n}\n\nfunction createHLL(precision) {\n  if (!Number.isInteger(precision) || precision < 4 || precision > 16) {\n    throw new Error('INVALID_PRECISION');\n  }\n  const bucketCount = 2 ** precision;\n  const buckets = new Array(bucketCount).fill(0);\n  const fmix32 = (h) => {\n    h ^= h >>> 16;\n    h = Math.imul(h, 0x85ebca6b);\n    h ^= h >>> 13;\n    h = Math.imul(h, 0xc2b2ae35);\n    h ^= h >>> 16;\n    return h >>> 0;\n  };\n  const hash64 = (value) => {\n    let h1 = 0x811c9dc5;\n    let h2 = 0x9e3779b9;\n    for (const ch of String(value)) {\n      h1 = Math.imul(h1 ^ ch.charCodeAt(0), 0x01000193) >>> 0;\n      h2 = (Math.imul(h2 ^ ch.charCodeAt(0), 0x85ebca6b) + 0x165667b1) >>> 0;\n    }\n    return [fmix32(h1), fmix32(h2)];\n  };\n  return {\n    add(value) {\n      const [h1, h2] = hash64(value);\n      const index = h1 >>> (32 - precision);\n      const rank = h2 === 0 ? 33 : Math.clz32(h2) + 1;\n      if (rank > buckets[index]) buckets[index] = rank;\n    },\n    estimate() {\n      const m = bucketCount;\n      let sum = 0;\n      let zeros = 0;\n      for (const value of buckets) {\n        sum += 2 ** (-value);\n        if (value === 0) zeros += 1;\n      }\n      const alpha = m === 16 ? 0.673 : m === 32 ? 0.697 : m === 64 ? 0.709 : 0.7213 / (1 + 1.079 / m);\n      let raw = (alpha * m * m) / sum;\n      if (raw <= 2.5 * m && zeros > 0) raw = m * Math.log(m / zeros);\n      return raw;\n    }\n  };\n}",
      "tests": [
        {
          "name": "加入的元素一定命中",
          "code": "const h1 = (value) => { let h = 0; for (const ch of String(value)) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0; return h; };\nconst h2 = (value) => { let h = 7; for (const ch of String(value)) h = (Math.imul(h, 131) + ch.charCodeAt(0) + 17) >>> 0; return h; };\nconst filter = createBloomFilter({ bits: 256, hashes: [h1, h2] });\nfor (const value of ['alpha', 'beta', 'gamma']) filter.add(value);\nfor (const value of ['alpha', 'beta', 'gamma']) assert.equal(filter.mightContain(value), true);"
        },
        {
          "name": "未加入的元素可能被排除",
          "code": "const h1 = (value) => { let h = 0; for (const ch of String(value)) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0; return h; };\nconst h2 = (value) => { let h = 7; for (const ch of String(value)) h = (Math.imul(h, 131) + ch.charCodeAt(0) + 17) >>> 0; return h; };\nconst filter = createBloomFilter({ bits: 1024, hashes: [h1, h2] });\nfilter.add('alpha');\nfilter.add('beta');\nassert.equal(filter.mightContain('zeta'), false);"
        },
        {
          "name": "空过滤器误判率为零",
          "code": "const filter = createBloomFilter({ bits: 64, hashes: [(value) => value.length] });\nassert.equal(filter.falsePositiveRate(), 0);\nfilter.add('abc');\nassert.ok(filter.falsePositiveRate() > 0 && filter.falsePositiveRate() < 1);"
        },
        {
          "name": "误判率随置位比例上升",
          "code": "const identity = (value) => { let h = 0; for (const ch of String(value)) h += ch.charCodeAt(0); return h; };\nconst small = createBloomFilter({ bits: 8, hashes: [identity] });\nconst large = createBloomFilter({ bits: 1024, hashes: [identity] });\nsmall.add('a');\nlarge.add('a');\nassert.ok(small.falsePositiveRate() > large.falsePositiveRate());"
        },
        {
          "name": "不同哈希个数仍保持语义",
          "code": "const h1 = (value) => value.length * 7;\nconst h2 = (value) => value.length * 13 + 1;\nconst h3 = (value) => value.length * 29 + 3;\nconst one = createBloomFilter({ bits: 128, hashes: [h1] });\nconst three = createBloomFilter({ bits: 128, hashes: [h1, h2, h3] });\none.add('hello');\nthree.add('hello');\nassert.equal(one.mightContain('hello'), true);\nassert.equal(three.mightContain('hello'), true);\nassert.ok(three.falsePositiveRate() >= 0 && three.falsePositiveRate() <= 1);"
        },
        {
          "name": "HLL 空集估算为零",
          "code": "const hll = createHLL(8);\nassert.equal(hll.estimate(), 0);"
        },
        {
          "name": "HLL 小基数估算接近实际",
          "code": "const hll = createHLL(8);\nfor (const value of ['a', 'b', 'c', 'd', 'e']) hll.add(value);\nconst estimate = hll.estimate();\nassert.ok(estimate >= 3 && estimate <= 8);"
        },
        {
          "name": "HLL 重复元素不重复计数",
          "code": "const hll = createHLL(8);\nfor (let i = 0; i < 100; i += 1) hll.add('same-key');\nconst estimate = hll.estimate();\nassert.ok(estimate >= 0 && estimate <= 2);"
        },
        {
          "name": "HLL 大基数在误差范围内",
          "code": "const hll = createHLL(10);\nfor (let i = 0; i < 1000; i += 1) hll.add('user-' + i);\nconst estimate = hll.estimate();\nassert.ok(estimate >= 850 && estimate <= 1150);"
        },
        {
          "name": "非法 precision 抛错",
          "code": "assert.throws(() => createHLL(3));\nassert.throws(() => createHLL(17));"
        }
      ]
    },
    {
      "id": "a6-ex-2",
      "kind": "design",
      "title": "短链去重与 UV 统计",
      "prompt": "为短链服务设计两套结构：一是短码生成时判断是否已存在，避免冲突；二是统计每天有多少独立访客。要求说明数据规模、可接受的误判或误差、内存预算、是否需要删除、精确计数需求、降级路径与监控方式，并解释为什么不能把两件事都交给同一个概率结构。",
      "checklist": [
        "短码总量、每日新增与查询量有明确估算",
        "判重场景的误判容忍度写清，并说明误判后的兜底查询",
        "UV 统计选择基数估算结构，并写明可接受的误差范围",
        "内存预算按位数组/桶数计算，而不是只写「很小」",
        "明确是否需要删除或回收短码，并据此排除不适用的结构",
        "关键账务或唯一性约束仍由数据库唯一索引保证",
        "概率结构不可用时有降级路径，且监控覆盖误判率与估算误差"
      ],
      "reference": "参考要点：短码判重可以用布隆过滤器挡住绝大多数不存在的短码，但唯一性最终必须由数据库唯一索引兜底；若短码会回收，标准布隆不支持删除，应改用计数布隆或直接查库。UV 统计用 HLL，按日分桶，误差目标写在报表口径里；不要用 HLL 统计订单数或库存。内存预算要按预计短码量与误判率反推位数组大小，按 UV 规模选择 precision。监控要覆盖位数组填充率、误判率、HLL 估算与精确值（抽样核对）的偏差。反例：用布隆决定短码是否唯一、用 HLL 做精确去重、没有兜底与监控。"
    }
  ]
};
