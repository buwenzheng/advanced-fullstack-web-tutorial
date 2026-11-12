export const bHeap = {
  "id": "b-heap",
  "title": "堆与优先队列：Top-K、延迟任务与中位数",
  "subtitle": "堆只保证堆顶极值：用它做 Top-K、双堆中位数与延迟调度，也用它看清内存结构的边界。",
  "duration": 70,
  "status": "ready",
  "objectives": [
    "实现二叉堆的 push/pop/peek，并用 sift up/down 解释 O(log n)。",
    "用大小为 k 的最小堆求 Top-K，而不是全排序。",
    "用双堆维护动态中位数，保持两个堆的大小差不超过 1。",
    "把堆用于延迟任务调度，并说清内存堆与持久化队列的分工。"
  ],
  "keywords": ["二叉堆", "优先队列", "Top-K", "双堆", "中位数", "延迟任务", "时间轮"],
  "blocks": [
    {
      "type": "analogy",
      "title": "医院分诊",
      "html": "急诊科不会按挂号顺序看病，而是按病情紧急程度排序：最危险的患者永远排在最前面。堆就是这套分诊台——它不维护全局有序，只保证「当前最紧急的那个」在堆顶。<br>这个类比的边界在于：分诊只关心优先级最高的一个，不关心第二名是谁；如果业务需要按顺序依次处理全部任务，就要在每次取出堆顶后重新调整，成本是 O(log n)，而不是一次性排好序的 O(n log n)。"
    },
    {
      "type": "text",
      "title": "堆的性质与数组表示",
      "html": "二叉堆是一棵完全二叉树：除了最后一层，每一层都填满，最后一层从左到右连续。这个形状让它可以直接存进数组：下标 i 的左子节点是 2i + 1，右子节点是 2i + 2，父节点是 floor((i - 1) / 2)。<br>最小堆只要求父节点不大于子节点，因此堆顶是全局最小值，但兄弟节点之间没有顺序。插入时把新元素放到数组末尾，然后不断与父节点比较、上浮；删除堆顶时把末尾元素搬到堆顶，再与较小的子节点交换、下沉。两个操作都只沿一条路径走，复杂度是 O(log n)；查看堆顶是 O(1)。<br>堆不是排序结构：数组的其余部分并不有序。把堆用于范围查询或按序遍历，都会退化成反复弹出，复杂度接近 O(n log n)。"
    },
    {
      "type": "code",
      "title": "最小堆",
      "lang": "javascript",
      "code": "function createMinHeap() {\n  const items = [];\n  const swap = (i, j) => { [items[i], items[j]] = [items[j], items[i]]; };\n  const siftUp = (i) => {\n    while (i > 0) {\n      const parent = (i - 1) >> 1;\n      if (items[parent] <= items[i]) break;\n      swap(parent, i);\n      i = parent;\n    }\n  };\n  const siftDown = (i) => {\n    while (true) {\n      const left = i * 2 + 1;\n      const right = left + 1;\n      let smallest = i;\n      if (left < items.length && items[left] < items[smallest]) smallest = left;\n      if (right < items.length && items[right] < items[smallest]) smallest = right;\n      if (smallest === i) break;\n      swap(i, smallest);\n      i = smallest;\n    }\n  };\n  return {\n    push(value) {\n      items.push(value);\n      siftUp(items.length - 1);\n    },\n    pop() {\n      if (items.length === 0) return undefined;\n      const top = items[0];\n      const last = items.pop();\n      if (items.length > 0) {\n        items[0] = last;\n        siftDown(0);\n      }\n      return top;\n    },\n    peek() {\n      return items.length > 0 ? items[0] : undefined;\n    },\n    size() {\n      return items.length;\n    }\n  };\n}",
      "note": "上浮只与父节点比较；下沉要与两个子节点中较小的那个交换，漏掉这一步会破坏堆序。"
    },
    {
      "type": "code",
      "title": "Top-K 与双堆中位数",
      "lang": "javascript",
      "code": "function topK(nums, k) {\n  if (!Number.isInteger(k) || k <= 0) return [];\n  const heap = createMinHeap();\n  for (const num of nums) {\n    heap.push(num);\n    if (heap.size() > k) heap.pop();\n  }\n  const result = [];\n  while (heap.size() > 0) result.push(heap.pop());\n  return result.reverse();\n}\n\nfunction createMedianTracker() {\n  const low = createMinHeap();\n  const high = createMinHeap();\n  return {\n    add(num) {\n      if (low.size() === 0 || num <= -low.peek()) low.push(-num);\n      else high.push(num);\n      if (low.size() > high.size() + 1) high.push(-low.pop());\n      else if (high.size() > low.size()) low.push(-high.pop());\n    },\n    median() {\n      if (low.size() === 0) return null;\n      if (low.size() === high.size()) return (-low.peek() + high.peek()) / 2;\n      return -low.peek();\n    }\n  };\n}",
      "note": "Top-K 维护大小为 k 的最小堆，堆顶就是第 k 大；双堆用负数把最小堆当最大堆用，左堆保存较小的一半。"
    },
    {
      "type": "table",
      "title": "堆 vs 排序 vs 快速选择",
      "head": ["方案", "时间", "额外空间", "适用场景"],
      "rows": [
        ["全排序", "O(n log n)", "O(n)", "需要完整顺序，或后续要多次范围查询"],
        ["大小为 k 的堆", "O(n log k)", "O(k)", "流式数据、只需前 k 个、k 远小于 n"],
        ["快速选择", "平均 O(n)", "O(1)", "静态数组、只求第 k 大，不要求前 k 个有序"],
        ["双堆", "每次 O(log n)", "O(n)", "中位数随数据插入动态变化"]
      ]
    },
    {
      "type": "case",
      "title": "延迟任务全部同一时间触发",
      "context": "订单系统用内存最小堆保存 30 分钟后关闭未支付订单的任务。大促开始时有 20 万个订单在同一分钟创建。",
      "symptom": "到了第 30 分钟，20 万个任务在同一秒被弹出，消费者线程池瞬间打满，下游订单服务出现超时；部分任务因消费失败被重新入堆，形成二次洪峰。",
      "cause": "任务到期时间完全相同，堆只能按时间排序，无法打散；消费者没有限速，重试也没有退避。堆本身没有问题，问题是没有对「同时到期」做任何治理。",
      "fix": "给到期时间加秒级抖动；消费者按固定速率拉取并限制并发；失败任务进入重试队列并指数退避；对堆积量设置告警。",
      "prevention": "延迟任务设计必须同时考虑到期精度、吞吐上限与重试策略；在压测里专门构造「同一时刻大量到期」的场景，而不是只测均匀分布。",
      "metric": "加入抖动与限速后，峰值弹出速率从每秒 20 万降到每秒 2 千，下游超时率回到基线。"
    },
    {
      "type": "pitfall",
      "title": "用堆做范围查询、忽略稳定性、无限增长",
      "html": "现象一：需要「取时间区间内的所有任务」，却反复弹出堆顶直到超过上界，复杂度接近全量排序。堆只适合取极值，范围查询应该换有序结构或按分区存储。<br>现象二：同等优先级的任务期望先到先处理，但堆不保证稳定顺序，交换会打乱插入次序。需要稳定性时，要在比较键里加入单调递增的序号。<br>现象三：任务只进不出，堆无限增长，最终 OOM。内存堆必须设置容量上限与背压，溢出的任务要落盘或拒绝，而不是继续接收。<br>预防方式：在设计阶段写清「只取极值还是需要顺序」「是否要求稳定」「容量上限是多少」三个问题，再决定是否使用堆。"
    },
    {
      "type": "steps",
      "title": "延迟队列设计",
      "steps": [
        { "title": "确定到期语义", "html": "任务在什么时间点可执行、允许的提前/延后误差是多少；精度要求决定轮询间隔与存储结构。" },
        { "title": "选择存储", "html": "单机可接受丢失用内存堆；需要重启恢复就落库或使用持久化队列；多实例要支持抢占。" },
        { "title": "定义可见性超时", "html": "消费者取走任务后设置租约，超时未确认则重新可见，避免消费者崩溃导致任务永久丢失。" },
        { "title": "设计重试与幂等", "html": "失败任务按退避策略重试；业务处理必须幂等，因为至少一次投递会带来重复执行。" },
        { "title": "监控与限速", "html": "记录堆积量、到期速率、失败率；对同时到期做抖动，对消费速率做上限。" }
      ]
    },
    {
      "type": "text",
      "title": "深挖：调度器与时间轮",
      "html": "堆做定时调度的成本是每次插入与弹出 O(log n)。当任务量达到百万级、且大量任务集中在相近时间点时，log n 的比较与交换会成为可观测的开销。时间轮换了一个思路：把时间划分成固定大小的槽，任务按到期时间挂到对应槽的链表上，指针每经过一个槽就处理该槽的任务。插入是 O(1)，代价是时间精度受槽粒度限制，且需要处理跨圈任务。<br>真实系统常常组合使用：时间轮负责粗粒度分层，堆负责同一槽内的精细排序；或者用持久化存储保存任务，用内存结构只做近期缓存。选择依据不是「哪个数据结构更高级」，而是任务量、精度要求、是否需要持久化与多实例。堆的局限在于它只解决排序，不解决投递、重试、抢占与持久化；把调度问题全部压给一个内存堆，故障只是被推迟到重启或流量峰值时爆发。"
    },
    {
      "type": "note",
      "title": "面试延伸",
      "html": "面试常问「求第 k 大，什么时候不用堆」。可以这样回答：如果数据是静态数组且只求一次，快速选择平均 O(n) 更快；如果 k 接近 n，全排序反而更简单；如果数据是流式的、需要持续维护前 k 个，大小为 k 的堆是自然选择。接着补一句代价：堆的 O(n log k) 建立在 k 远小于 n 的前提上，k 接近 n 时优势消失。<br>如果被追问「延迟任务为什么不用堆就够了」，要主动说出内存丢失、多实例重复触发、同时到期洪峰这三个问题，再给出持久化、租约与限速的组合方案。"
    }
  ],
  "checks": [
    {
      "id": "b-heap-check-1",
      "kind": "mcq",
      "type": "single",
      "tag": "Top-K",
      "prompt": "在长度为 n 的数组中求前 k 个最大值，k 远小于 n。应该维护哪种堆？",
      "question": "在长度为 n 的数组中求前 k 个最大值，k 远小于 n。应该维护哪种堆？",
      "options": [
        { "text": "大小为 k 的最小堆，堆顶是当前第 k 大，新元素比堆顶大就替换", "correct": true },
        { "text": "大小为 k 的最大堆，堆顶是当前最大值", "correct": false },
        { "text": "大小为 n 的最小堆，最后再取 k 次", "correct": false },
        { "text": "不需要堆，排序后取前 k 个总是最优", "correct": false }
      ],
      "explain": "最小堆的堆顶是当前候选集合里最小的，也就是第 k 大；新元素只有大于堆顶才可能进入前 k。最大堆会把最大的元素挡在堆顶，无法淘汰较小候选。"
    },
    {
      "id": "b-heap-check-2",
      "kind": "mcq",
      "type": "multi",
      "tag": "双堆",
      "prompt": "用双堆维护动态中位数时，必须满足哪些条件？",
      "question": "用双堆维护动态中位数时，必须满足哪些条件？",
      "options": [
        { "text": "左堆保存较小的一半，堆顶是这一半的最大值", "correct": true },
        { "text": "右堆保存较大的一半，堆顶是这一半的最小值", "correct": true },
        { "text": "两个堆的大小差不超过 1", "correct": true },
        { "text": "两个堆都必须是最小堆，不能使用负数技巧", "correct": false },
        { "text": "每次插入后都要把两个堆完全排序", "correct": false }
      ],
      "explain": "双堆的核心是分区与平衡：左堆最大、右堆最小、大小差不超过 1。最小堆加负数即可模拟最大堆，不需要额外结构；堆内部也不要求完全有序。"
    },
    {
      "id": "b-heap-check-3",
      "kind": "mcq",
      "type": "single",
      "tag": "延迟任务",
      "prompt": "为什么延迟任务不能只靠进程内的内存堆？",
      "question": "为什么延迟任务不能只靠进程内的内存堆？",
      "options": [
        { "text": "进程重启会丢失任务，多实例还会各自弹出同一任务造成重复执行", "correct": true },
        { "text": "内存堆的插入复杂度是 O(n)，任务一多就卡死", "correct": false },
        { "text": "内存堆无法保存时间戳，只能保存数字", "correct": false },
        { "text": "内存堆不能处理相同优先级的任务", "correct": false }
      ],
      "explain": "内存堆本身插入是 O(log n)，也能保存时间戳；真正的问题是缺乏持久化与跨实例协调。重启丢失与重复触发需要靠持久化存储、租约和幂等共同解决。"
    }
  ],
  "exercises": [
    {
      "id": "b-heap-ex-1",
      "kind": "code",
      "title": "最小堆 + Top-K + 双堆中位数",
      "brief": "实现三个结构。<code>createMinHeap()</code> 返回 <code>{ push, pop, peek, size }</code>：<code>pop</code> 取出最小值，空堆返回 <code>undefined</code>。<code>topK(nums, k)</code> 返回降序的前 k 个值；<code>k</code> 不是正整数时返回空数组，<code>k</code> 大于数组长度时返回全部元素。<code>createMedianTracker()</code> 返回 <code>{ add, median }</code>：偶数个元素时取中间两数的平均值，没有元素时返回 <code>null</code>。",
      "hint": "Top-K 用大小为 k 的最小堆；双堆可以用负数把最小堆当最大堆使用，插入后立即平衡。",
      "starter": "function createMinHeap() {\n  return {\n    push() {},\n    pop() { return undefined; },\n    peek() { return undefined; },\n    size() { return 0; }\n  };\n}\n\nfunction topK(nums, k) {\n  return [];\n}\n\nfunction createMedianTracker() {\n  return {\n    add() {},\n    median() { return null; }\n  };\n}",
      "solution": "function createMinHeap() {\n  const items = [];\n  const swap = (i, j) => { [items[i], items[j]] = [items[j], items[i]]; };\n  const siftUp = (i) => {\n    while (i > 0) {\n      const parent = (i - 1) >> 1;\n      if (items[parent] <= items[i]) break;\n      swap(parent, i);\n      i = parent;\n    }\n  };\n  const siftDown = (i) => {\n    while (true) {\n      const left = i * 2 + 1;\n      const right = left + 1;\n      let smallest = i;\n      if (left < items.length && items[left] < items[smallest]) smallest = left;\n      if (right < items.length && items[right] < items[smallest]) smallest = right;\n      if (smallest === i) break;\n      swap(i, smallest);\n      i = smallest;\n    }\n  };\n  return {\n    push(value) {\n      items.push(value);\n      siftUp(items.length - 1);\n    },\n    pop() {\n      if (items.length === 0) return undefined;\n      const top = items[0];\n      const last = items.pop();\n      if (items.length > 0) {\n        items[0] = last;\n        siftDown(0);\n      }\n      return top;\n    },\n    peek() {\n      return items.length > 0 ? items[0] : undefined;\n    },\n    size() {\n      return items.length;\n    }\n  };\n}\n\nfunction topK(nums, k) {\n  if (!Number.isInteger(k) || k <= 0) return [];\n  const heap = createMinHeap();\n  for (const num of nums) {\n    heap.push(num);\n    if (heap.size() > k) heap.pop();\n  }\n  const result = [];\n  while (heap.size() > 0) result.push(heap.pop());\n  return result.reverse();\n}\n\nfunction createMedianTracker() {\n  const low = createMinHeap();\n  const high = createMinHeap();\n  return {\n    add(num) {\n      if (low.size() === 0 || num <= -low.peek()) low.push(-num);\n      else high.push(num);\n      if (low.size() > high.size() + 1) high.push(-low.pop());\n      else if (high.size() > low.size()) low.push(-high.pop());\n    },\n    median() {\n      if (low.size() === 0) return null;\n      if (low.size() === high.size()) return (-low.peek() + high.peek()) / 2;\n      return -low.peek();\n    }\n  };\n}",
      "tests": [
        {
          "name": "堆序与极值",
          "code": "const heap = createMinHeap();\nfor (const value of [5, 3, 8, 1]) heap.push(value);\nassert.equal(heap.peek(), 1);\nassert.equal(heap.size(), 4);\nassert.equal(heap.pop(), 1);\nassert.equal(heap.pop(), 3);\nassert.equal(heap.pop(), 5);\nassert.equal(heap.pop(), 8);"
        },
        {
          "name": "重复值保持堆序",
          "code": "const heap = createMinHeap();\nfor (const value of [2, 2, 2]) heap.push(value);\nassert.equal(heap.pop(), 2);\nassert.equal(heap.pop(), 2);\nassert.equal(heap.pop(), 2);"
        },
        {
          "name": "空堆行为",
          "code": "const heap = createMinHeap();\nassert.equal(heap.pop(), undefined);\nassert.equal(heap.peek(), undefined);\nassert.equal(heap.size(), 0);"
        },
        {
          "name": "Top-K 降序",
          "code": "assert.deepEqual(topK([3, 1, 4, 1, 5, 9, 2, 6], 3), [9, 6, 5]);"
        },
        {
          "name": "k 大于长度时返回全部",
          "code": "assert.deepEqual(topK([2, 1], 5), [2, 1]);"
        },
        {
          "name": "非法 k 返回空数组",
          "code": "assert.deepEqual(topK([1, 2, 3], 0), []);\nassert.deepEqual(topK([1, 2, 3], -1), []);\nassert.deepEqual(topK([1, 2, 3], 1.5), []);"
        },
        {
          "name": "中位数奇数个",
          "code": "const tracker = createMedianTracker();\nfor (const value of [5, 1, 3]) tracker.add(value);\nassert.equal(tracker.median(), 3);"
        },
        {
          "name": "中位数偶数个",
          "code": "const tracker = createMedianTracker();\nfor (const value of [1, 2, 3, 4]) tracker.add(value);\nassert.equal(tracker.median(), 2.5);"
        },
        {
          "name": "负数与乱序插入",
          "code": "const tracker = createMedianTracker();\nfor (const value of [-1, -5, -3]) tracker.add(value);\nassert.equal(tracker.median(), -3);\ntracker.add(-2);\nassert.equal(tracker.median(), -2.5);"
        },
        {
          "name": "大量数据堆排序正确",
          "code": "const heap = createMinHeap();\nfor (let i = 100; i >= 1; i -= 1) heap.push(i);\nconst ordered = [];\nwhile (heap.size() > 0) ordered.push(heap.pop());\nassert.equal(ordered.length, 100);\nassert.equal(ordered[0], 1);\nassert.equal(ordered[99], 100);\nfor (let i = 1; i < ordered.length; i += 1) assert.ok(ordered[i - 1] <= ordered[i]);"
        }
      ]
    },
    {
      "id": "b-heap-ex-2",
      "kind": "design",
      "title": "延迟任务调度器",
      "prompt": "为订单系统设计一个延迟任务调度器：订单创建 30 分钟后若仍未支付，自动关闭并释放库存。要求支持重启恢复、多实例部署、失败重试与可观测性。请写清任务来源、存储结构、投递语义、抢占方式、幂等策略与监控指标，并说明为什么内存堆不够。",
      "checklist": [
        "任务来源与写入时机明确，创建订单与写入延迟任务不丢失",
        "到期精度与轮询/调度间隔写清，能接受多大的提前或延后",
        "持久化方案明确，进程重启后任务可恢复",
        "投递语义明确（至少一次），业务处理具备幂等键",
        "多实例部署时有抢占或分片机制，不会重复触发同一任务",
        "可见性超时与失败重试策略明确，包含退避上限",
        "同一时刻大量到期的洪峰有抖动或限速方案",
        "监控覆盖堆积量、到期速率、失败率与处理延迟，并设置告警"
      ],
      "reference": "参考要点：任务应在订单事务提交后写入持久化存储（如数据库表或持久化队列），而不是只放内存堆；调度器按到期时间索引扫描，取任务时通过租约或条件更新抢占，保证多实例只有一个消费者；处理逻辑用订单号做幂等键，关闭订单与释放库存放在同一事务或补偿流程里；失败按指数退避重试，超过上限进入死信并告警；到期时间加秒级抖动，消费者限速，避免同时到期洪峰。反例：只用内存最小堆、无租约、失败立即无限重试、没有堆积告警——重启丢任务，多实例重复关闭订单，洪峰打垮下游。"
    }
  ]
};
