export const s6L1 = {
  id: 's6-l1',
  title: '契约驱动的全栈开发与 BFF',
  subtitle: 'OpenAPI → 类型客户端、契约漂移检查、BFF 取舍、聚合与请求瀑布、错误映射。',
  duration: 85,
  status: 'ready',
  objectives: [
    '从 OpenAPI 生成类型安全客户端，并解释生成物为什么不能手改。',
    '设计契约漂移检查，把破坏性变更挡在合并之前。',
    '判断何时需要 BFF、何时直连，并说清 BFF 的收益与代价。',
    '用并发聚合、总超时与部分失败降级消除前端请求瀑布。'
  ],
  keywords: ['BFF', 'OpenAPI', '契约驱动', '类型生成', '契约漂移', '请求瀑布', '聚合', '降级', '总超时'],
  blocks: [
    {
      type: 'analogy',
      title: '手抄菜单与自动生成',
      html: '餐厅换菜单时，如果每桌服务员都靠口头传话，就一定会有人报错菜名和价格；如果所有人共用同一份后厨菜单，改一次全场同步。前端手写接口类型就像手抄菜单：后端加字段你不知道，删字段你也不知道，直到线上报错。<br>契约生成把「同一份菜单」变成工程约束：OpenAPI 是后厨那份，客户端类型与请求方法由它生成，任何人想改接口，都得先改契约、再重新生成。类比失效的地方在运行时：菜单写错顶多点错菜，契约漂移会让编译通过、上线才崩。所以生成之后还要有漂移检查，把「菜单被偷偷换了」变成合并前的红灯。'
    },
    {
      type: 'text',
      title: '契约是唯一事实源',
      html: '契约驱动开发的核心不是「有个 YAML 文件」，而是承认接口的形状只有一个事实源。后端按契约实现，前端按契约生成客户端，测试按契约造数据；三边都从同一份定义出发，才谈得上类型安全。<br>生成物必须只读：手改生成文件会在下次生成时被覆盖，还会让 CI 无法判断漂移来自契约还是来自手改。版本与兼容也由契约决定：新增可选字段通常兼容，删除字段、把可选改必填、收窄枚举值通常破坏。漂移检查在 CI 里做两件事：重新生成后与仓库中的生成物比对；把当前契约与主干契约做兼容性比较。两者任一失败就阻断合并。<br>这里只讲契约怎么被消费与检查；契约本身怎么建模，S2 已经讲过，不再重复。'
    },
    {
      type: 'code',
      title: '从 OpenAPI 片段生成客户端',
      lang: 'javascript',
      code: `function buildClient(schema = {}, options = {}) {
  const transport = options.transport || (() => Promise.resolve(null));
  const paths = schema.paths || {};

  return {
    get(template, params = {}) {
      try {
        const spec = paths[template] && paths[template].get;
        if (!spec) {
          const error = new Error('UNKNOWN_ROUTE');
          error.code = 'UNKNOWN_ROUTE';
          throw error;
        }
        let path = template;
        for (const name of spec.pathParams || []) {
          const value = params[name];
          if (value === undefined || value === null) {
            const error = new Error('MISSING_PARAM');
            error.code = 'MISSING_PARAM';
            throw error;
          }
          path = path.split('{' + name + '}').join(encodeURIComponent(String(value)));
        }
        const query = [...(spec.query || [])]
          .sort()
          .filter((name) => params[name] !== undefined)
          .map((name) => encodeURIComponent(name) + '=' + encodeURIComponent(String(params[name])))
          .join('&');
        return Promise.resolve(transport({ method: 'GET', path, query })).then((body) => {
          const required = (spec.response && spec.response.required) || [];
          const missing = required.filter((field) => !body || body[field] === undefined);
          if (missing.length) {
            const error = new Error('INVALID_RESPONSE');
            error.code = 'INVALID_RESPONSE';
            throw error;
          }
          return body;
        });
      } catch (error) {
        return Promise.reject(error);
      }
    }
  };
}`,
      note: '查询参数按字段名排序，是为了让相同参数生成相同 URL——缓存键、日志与重放都依赖这个稳定性。路径参数必须编码，否则 a/b 这类值会改变路由。响应必填校验放在客户端只做最后一道防线，真正的契约责任仍在服务端。'
    },
    {
      type: 'flow',
      title: '契约 → 生成 → 编译 → 漂移检查 → 发布',
      steps: [
        { name: '修改契约', detail: '先改 OpenAPI，评审兼容性。失败表现：直接改后端代码，契约事后补。' },
        { name: '重新生成', detail: '生成客户端与类型，生成物只读。失败表现：手改生成文件。' },
        { name: '编译', detail: '前端按新类型编译，漏改的调用点立刻暴露。失败表现：类型写成 any，编译永远绿。' },
        { name: '漂移检查', detail: '比对生成物与主干契约，破坏性变更失败。失败表现：检查只看文件是否存在。' },
        { name: '发布', detail: '后端先兼容上线，前端再切换。失败表现：前后端同时发布，回滚互相牵制。' }
      ]
    },
    {
      type: 'table',
      title: 'BFF vs 直连 vs 网关聚合',
      head: ['维度', '前端直连', 'BFF', '网关聚合'],
      rows: [
        ['控制力', '前端各自拼装', '页面级裁剪与聚合', '通用策略，页面细节少'],
        ['延迟', '请求瀑布风险高', '一次请求多上游并发', '取决于网关编排能力'],
        ['缓存', '按接口各自缓存', '可按页面与用户维度缓存', '偏基础设施缓存'],
        ['团队边界', '前端依赖多个后端团队', '前端团队可拥有聚合层', '平台团队拥有'],
        ['故障面', '任一接口慢都拖慢页面', '总超时与降级集中处理', '网关故障影响全局']
      ],
      note: 'BFF 不是默认答案：只有一个上游、页面简单时直连更划算；跨很多团队、页面聚合复杂时 BFF 的收益才明显。网关更适合通用能力，不适合承载页面级业务裁剪。'
    },
    {
      type: 'code',
      title: 'BFF 并发聚合：总超时与部分失败',
      lang: 'javascript',
      code: `function createDetailLoader({ fetchMeta, fetchStats, fetchPermission, timeoutMs = 1000, scheduler = { setTimeout, clearTimeout } }) {
  return function loadDetail(id) {
    return new Promise((resolve) => {
      const status = { meta: 'pending', stats: 'pending', permission: 'pending' };
      const values = {};
      const degraded = new Set();
      let finished = false;
      let timer = null;

      const finishSuccess = () => {
        if (finished) return;
        finished = true;
        if (timer !== null) scheduler.clearTimeout(timer);
        resolve({
          link: values.meta,
          stats: values.stats === undefined ? null : values.stats,
          canEdit: values.permission === true,
          degraded: ['stats', 'permission'].filter((name) => degraded.has(name))
        });
      };

      const finishFailure = (code) => {
        if (finished) return;
        finished = true;
        if (timer !== null) scheduler.clearTimeout(timer);
        resolve({ code });
      };

      const maybeFinish = () => {
        if (finished) return;
        if (status.meta === 'rejected') {
          const error = values.metaError;
          finishFailure(error && error.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'UPSTREAM');
          return;
        }
        const done = status.stats !== 'pending' && status.permission !== 'pending';
        if (status.meta === 'fulfilled' && done) finishSuccess();
      };

      const track = (name, task) => {
        let promise;
        try {
          promise = Promise.resolve(task());
        } catch (error) {
          promise = Promise.reject(error);
        }
        promise.then(
          (value) => {
            if (finished) return;
            status[name] = 'fulfilled';
            values[name] = value;
            maybeFinish();
          },
          (error) => {
            if (finished) return;
            status[name] = 'rejected';
            if (name === 'meta') values.metaError = error;
            else degraded.add(name);
            maybeFinish();
          }
        );
      };

      timer = scheduler.setTimeout(() => {
        if (finished) return;
        if (status.meta !== 'fulfilled') {
          finishFailure('UPSTREAM');
          return;
        }
        if (status.stats === 'pending') degraded.add('stats');
        if (status.permission === 'pending') degraded.add('permission');
        finishSuccess();
      }, timeoutMs);

      track('meta', () => fetchMeta(id));
      track('stats', () => fetchStats(id));
      track('permission', () => fetchPermission(id));
    });
  };
}`,
      note: '关键点有三个：三个上游同步启动，不等前一个完成；总超时只启动一次，统一收口；finished 之后所有回调直接返回，迟到的结果不会再改状态。meta 是页面主体，失败必须整体失败；stats 与 permission 是增强信息，失败只降级并显式标记。'
    },
    {
      type: 'case',
      title: '详情页 1.8s：四个串行请求',
      context: 'LinkHub 链接详情页需要链接元数据、点击统计、当前用户权限、相关链接四份数据，前端在组件里逐个 await。',
      symptom: '页面首屏稳定在 1.8s 左右；任一接口变慢，整页按最慢请求叠加；统计服务偶发超时会让整个页面报错。',
      cause: '四个请求串行发出，延迟相加；没有总超时；权限与统计的失败被当成整页失败，错误直接透传 UI。',
      fix: '把详情页聚合收进 BFF：四个上游并发，设置 600ms 总预算；统计与相关链接失败标记 degraded，权限失败按只读处理；meta 失败才整体失败。',
      prevention: '页面级请求预算写进接口设计；聚合层测试覆盖并发启动、总超时与部分失败；监控按页面记录聚合耗时与降级率。',
      metric: '详情页 p75 从 1.8s 降到 620ms；统计故障时页面成功率从 92% 升到 99.9%'
    },
    {
      type: 'pitfall',
      title: 'BFF 的五个坑',
      html: '<strong>请求瀑布：</strong>BFF 内部仍按顺序 await 上游，只是把瀑布从前端搬到服务端。修复：同时启动，统一 await。<br><strong>N+1 聚合：</strong>列表页对每条记录各调一次详情接口。修复：批量接口或一次查询，不在聚合层放大调用。<br><strong>把 BFF 做成第二个后端：</strong>业务规则、写操作、事务都塞进 BFF，导致两套事实源。修复：BFF 只做聚合与适配。<br><strong>错误直通 UI：</strong>把上游 500、堆栈或内部错误码原样返回。修复：映射成稳定的 UI 错误码，内部细节只进日志。<br><strong>鉴权上下文丢失：</strong>聚合时没有透传用户身份或租户，导致越权或统计串数据。修复：在 BFF 入口解析一次身份，按上游要求签名透传。'
    },
    {
      type: 'compare',
      title: '聚合层放前端、BFF 还是网关',
      cols: [
        {
          title: '前端聚合',
          items: [
            '改动最快，不增加部署单元',
            '请求瀑布与重复逻辑留在浏览器',
            '移动端与 Web 各自维护一套',
            '适合上游少、页面简单的场景'
          ]
        },
        {
          title: 'BFF',
          items: [
            '页面级裁剪、并发与降级集中处理',
            '前端团队可拥有与发布',
            '多一个部署单元与故障点',
            '适合多上游、体验要求高的页面'
          ]
        },
        {
          title: '网关聚合',
          items: [
            '统一鉴权、限流与通用编排',
            '页面细节表达能力有限',
            '由平台团队维护',
            '适合跨产品的通用策略'
          ]
        }
      ]
    },
    {
      type: 'text',
      title: '深挖：契约兼容性判定',
      html: '判断一次契约变更是否破坏，看的是「旧客户端还能不能按原样工作」，而不是「新代码能不能跑」。新增可选字段通常兼容：旧客户端忽略未知字段即可。新增必填请求字段是破坏：旧客户端不会传。删除响应字段是破坏：旧客户端可能依赖它。把可选字段改成必填、把枚举从宽改窄、把字符串改成数字、改变默认值或字段含义，都属于破坏或高风险变更。<br>枚举要特别注意方向：服务端新增枚举值对旧客户端可能是破坏——旧代码的 switch 没有默认分支，遇到未知值会崩溃；因此客户端必须对未知枚举有兜底。兼容策略通常是「先加后删」：先让新字段可选并双写，等所有客户端升级后再删除旧字段；破坏性变更走新版本路径，而不是原地改。<br>漂移检查要能区分这三类：生成物与契约不一致、契约与主干不兼容、代码使用了未声明的字段。只做第一类检查，仍可能让破坏性变更上线。'
    },
    {
      type: 'steps',
      title: '设计 LinkHub 详情页 BFF',
      steps: [
        { title: '定义 UI 形状', html: '先写页面真正需要的字段：链接、统计摘要、可编辑标记、降级信息。观察点：字段能被页面直接消费，不需要二次拼装。' },
        { title: '列出上游与预算', html: '元数据、统计、权限各需要多少时间；总预算必须小于上游超时之和。观察点：最慢上游与总预算的差距有记录。' },
        { title: '并发与降级', html: '同时启动；meta 失败整体失败，stats/permission 失败标记 degraded。观察点：测试能证明并发启动与降级标记。' },
        { title: '错误码映射', html: '上游 NOT_FOUND 映射页面 404，其余映射通用错误；不暴露内部错误。观察点：响应里没有上游堆栈与内部码。' },
        { title: '鉴权与缓存', html: '入口解析一次身份，按上游要求透传；个性化响应不被公共缓存。观察点：缓存键包含用户或租户维度。' },
        { title: '可观测字段', html: '记录聚合耗时、各上游耗时、降级原因与 traceId。观察点：一次请求能从日志还原四个上游的结果。' }
      ]
    },
    {
      type: 'note',
      title: '面试延伸',
      html: '「契约漂移怎么进 CI」可以答三层：重新生成后与仓库生成物比对；用兼容性检查比较主干与当前契约；编译失败即阻断。三层分别防手改、防破坏性变更、防调用点漏改。<br>「BFF 挂了前端怎么活」要区分读与写：静态页面与 SSG 仍可用；详情页可以降级到直连上游或缓存快照；写操作直接失败并给出明确错误。回答时给出降级顺序与可观测信号，而不是只说「加监控」。'
    }
  ],
  checks: [
    {
      id: 's6-l1-check-1',
      kind: 'mcq',
      type: 'single',
      tag: '破坏性变更',
      prompt: '以下哪种契约变更最可能是破坏性变更？',
      question: '以下哪种契约变更最可能是破坏性变更？',
      options: [
        { text: '删除响应中的已有字段', correct: true },
        { text: '新增一个可选响应字段', correct: false },
        { text: '把响应字段的描述写得更详细', correct: false },
        { text: '新增一个可选查询参数', correct: false }
      ],
      explain: '删除响应字段会让依赖它的旧客户端失效。新增可选字段与可选查询参数通常兼容；文档描述变化不影响运行时契约。'
    },
    {
      id: 's6-l1-check-2',
      kind: 'mcq',
      type: 'multi',
      tag: 'BFF 取舍',
      prompt: '引入 BFF 聚合层，通常要接受哪些代价？',
      question: '引入 BFF 聚合层，通常要接受哪些代价？',
      options: [
        { text: '多一个部署单元与故障点', correct: true },
        { text: '部署与发布耦合增加', correct: true },
        { text: '缓存策略更复杂，个性化与公共缓存冲突', correct: true },
        { text: '前端不再需要任何类型定义', correct: false },
        { text: '上游接口可以随意破坏', correct: false }
      ],
      explain: 'BFF 的收益是聚合与降级，代价是多一跳、部署耦合与缓存复杂。它不会消除类型定义，也不能让上游摆脱契约约束。'
    },
    {
      id: 's6-l1-check-3',
      kind: 'mcq',
      type: 'single',
      tag: '请求瀑布',
      prompt: '详情页四个上游互不依赖，但当前串行请求导致 1.8s 首屏。正确的优化是什么？',
      question: '详情页四个上游互不依赖，但当前串行请求导致 1.8s 首屏。正确的优化是什么？',
      options: [
        { text: '并发发起并设置总超时，部分失败降级', correct: true },
        { text: '把四个请求原样转发到 BFF 继续串行', correct: false },
        { text: '给每个请求各加一个 2s 超时', correct: false },
        { text: '让前端先渲染骨架屏，数据继续串行加载', correct: false }
      ],
      explain: '独立上游应并发启动；总超时控制最坏等待；非关键数据失败要降级。只加单请求超时不能消除延迟叠加，骨架屏也不解决总时长。'
    }
  ],
  exercises: [
    {
      id: 's6-l1-ex-1',
      kind: 'code',
      title: '类型客户端 + BFF 聚合（跨层：契约 → UI 数据）',
      brief: '实现 buildClient(schema, { transport }) 与 createDetailLoader({ fetchMeta, fetchStats, fetchPermission, timeoutMs, scheduler })。buildClient 的 get(template, params) 要替换并编码路径参数、按字段名排序编码查询串、未知路径抛 UNKNOWN_ROUTE、缺失路径参数抛 MISSING_PARAM、响应缺少 response.required 字段时抛 INVALID_RESPONSE。createDetailLoader 必须同步启动三个上游，返回 { link, stats, canEdit, degraded }；meta 失败映射 { code: NOT_FOUND | UPSTREAM }；stats/permission 失败降级并在 degraded 标记；timeoutMs 是总预算，超时保留已完成字段，meta 未完成返回 UPSTREAM，迟到结果必须忽略。测试注入假 scheduler，手动推进时间，不依赖真实计时器。',
      hint: 'buildClient 用 encodeURIComponent 处理路径与查询，query 声明先排序再过滤 undefined。createDetailLoader 用 status 对象记录三个上游的 pending/fulfilled/rejected；三个 track 同步调用；timeout 回调里根据 meta 状态决定整体失败或降级成功；finished 标志阻断所有迟到回调。',
      starter: `function buildClient(schema = {}, options = {}) {
  const transport = options.transport || (() => Promise.resolve(null));
  return {
    get(template, params = {}) {
      const path = template.replace('{id}', params.id || '');
      return Promise.resolve(transport({ method: 'GET', path, query: '' })).then((body) => body);
    }
  };
}

function createDetailLoader({ fetchMeta, fetchStats, fetchPermission }) {
  return async function loadDetail(id) {
    const link = await fetchMeta(id);
    const stats = await fetchStats(id);
    const canEdit = await fetchPermission(id);
    return { link, stats, canEdit, degraded: [] };
  };
}`,
      solution: `function buildClient(schema = {}, options = {}) {
  const transport = options.transport || (() => Promise.resolve(null));
  const paths = schema.paths || {};

  return {
    get(template, params = {}) {
      try {
        const spec = paths[template] && paths[template].get;
        if (!spec) {
          const error = new Error('UNKNOWN_ROUTE');
          error.code = 'UNKNOWN_ROUTE';
          throw error;
        }
        let path = template;
        for (const name of spec.pathParams || []) {
          const value = params[name];
          if (value === undefined || value === null) {
            const error = new Error('MISSING_PARAM');
            error.code = 'MISSING_PARAM';
            throw error;
          }
          path = path.split('{' + name + '}').join(encodeURIComponent(String(value)));
        }
        const query = [...(spec.query || [])]
          .sort()
          .filter((name) => params[name] !== undefined)
          .map((name) => encodeURIComponent(name) + '=' + encodeURIComponent(String(params[name])))
          .join('&');
        return Promise.resolve(transport({ method: 'GET', path, query })).then((body) => {
          const required = (spec.response && spec.response.required) || [];
          const missing = required.filter((field) => !body || body[field] === undefined);
          if (missing.length) {
            const error = new Error('INVALID_RESPONSE');
            error.code = 'INVALID_RESPONSE';
            throw error;
          }
          return body;
        });
      } catch (error) {
        return Promise.reject(error);
      }
    }
  };
}

function createDetailLoader({ fetchMeta, fetchStats, fetchPermission, timeoutMs = 1000, scheduler = { setTimeout, clearTimeout } }) {
  return function loadDetail(id) {
    return new Promise((resolve) => {
      const status = { meta: 'pending', stats: 'pending', permission: 'pending' };
      const values = {};
      const degraded = new Set();
      let finished = false;
      let timer = null;

      const finishSuccess = () => {
        if (finished) return;
        finished = true;
        if (timer !== null) scheduler.clearTimeout(timer);
        resolve({
          link: values.meta,
          stats: values.stats === undefined ? null : values.stats,
          canEdit: values.permission === true,
          degraded: ['stats', 'permission'].filter((name) => degraded.has(name))
        });
      };

      const finishFailure = (code) => {
        if (finished) return;
        finished = true;
        if (timer !== null) scheduler.clearTimeout(timer);
        resolve({ code });
      };

      const maybeFinish = () => {
        if (finished) return;
        if (status.meta === 'rejected') {
          const error = values.metaError;
          finishFailure(error && error.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'UPSTREAM');
          return;
        }
        const done = status.stats !== 'pending' && status.permission !== 'pending';
        if (status.meta === 'fulfilled' && done) finishSuccess();
      };

      const track = (name, task) => {
        let promise;
        try {
          promise = Promise.resolve(task());
        } catch (error) {
          promise = Promise.reject(error);
        }
        promise.then(
          (value) => {
            if (finished) return;
            status[name] = 'fulfilled';
            values[name] = value;
            maybeFinish();
          },
          (error) => {
            if (finished) return;
            status[name] = 'rejected';
            if (name === 'meta') values.metaError = error;
            else degraded.add(name);
            maybeFinish();
          }
        );
      };

      timer = scheduler.setTimeout(() => {
        if (finished) return;
        if (status.meta !== 'fulfilled') {
          finishFailure('UPSTREAM');
          return;
        }
        if (status.stats === 'pending') degraded.add('stats');
        if (status.permission === 'pending') degraded.add('permission');
        finishSuccess();
      }, timeoutMs);

      track('meta', () => fetchMeta(id));
      track('stats', () => fetchStats(id));
      track('permission', () => fetchPermission(id));
    });
  };
}`,
      tests: [
        {
          name: '路径参数与查询串编码正确且顺序稳定',
          code: `const calls = [];
const client = buildClient({
  paths: {
    '/links/{id}': {
      get: { pathParams: ['id'], query: ['limit', 'cursor'], response: { required: ['id'] } }
    }
  }
}, { transport: (request) => { calls.push(request); return Promise.resolve({ id: 'l1' }); } });
const body = await client.get('/links/{id}', { id: 'a b/c', limit: 10, cursor: 'x y' });
assert.equal(body.id, 'l1');
assert.equal(calls[0].method, 'GET');
assert.equal(calls[0].path, '/links/a%20b%2Fc');
assert.equal(calls[0].query, 'cursor=x%20y&limit=10');`
        },
        {
          name: '未知路径抛 UNKNOWN_ROUTE',
          code: `const client = buildClient({ paths: {} }, { transport: () => Promise.resolve({}) });
let code = '';
try { await client.get('/missing'); } catch (error) { code = error.code; }
assert.equal(code, 'UNKNOWN_ROUTE');`
        },
        {
          name: '缺失路径参数抛 MISSING_PARAM',
          code: `const client = buildClient({
  paths: { '/links/{id}': { get: { pathParams: ['id'], response: { required: [] } } } }
}, { transport: () => Promise.resolve({}) });
let code = '';
try { await client.get('/links/{id}', {}); } catch (error) { code = error.code; }
assert.equal(code, 'MISSING_PARAM');`
        },
        {
          name: '响应缺少必填字段抛 INVALID_RESPONSE',
          code: `const client = buildClient({
  paths: { '/links/{id}': { get: { pathParams: ['id'], response: { required: ['id', 'url'] } } } }
}, { transport: () => Promise.resolve({ id: 'l1' }) });
let code = '';
try { await client.get('/links/{id}', { id: 'l1' }); } catch (error) { code = error.code; }
assert.equal(code, 'INVALID_RESPONSE');`
        },
        {
          name: '三个上游并发启动而不是顺序等待',
          code: `const defer = () => {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
};
const meta = defer();
const stats = defer();
const permission = defer();
const started = [];
const scheduler = { setTimeout: () => 0, clearTimeout: () => {} };
const loadDetail = createDetailLoader({
  fetchMeta: () => { started.push('meta'); return meta.promise; },
  fetchStats: () => { started.push('stats'); return stats.promise; },
  fetchPermission: () => { started.push('permission'); return permission.promise; },
  timeoutMs: 500,
  scheduler
});
const pending = loadDetail('l1');
assert.deepEqual(started, ['meta', 'stats', 'permission']);
meta.resolve({ id: 'l1' });
stats.resolve({ clicks: 1 });
permission.resolve(true);
const result = await pending;
assert.deepEqual(result.degraded, []);`
        },
        {
          name: '全部成功时返回稳定 UI 形状且无降级',
          code: `const loadDetail = createDetailLoader({
  fetchMeta: async () => ({ id: 'l1', url: 'https://example.com' }),
  fetchStats: async () => ({ clicks: 3 }),
  fetchPermission: async () => true,
  timeoutMs: 100,
  scheduler: { setTimeout: () => 0, clearTimeout: () => {} }
});
const result = await loadDetail('l1');
assert.deepEqual(result, {
  link: { id: 'l1', url: 'https://example.com' },
  stats: { clicks: 3 },
  canEdit: true,
  degraded: []
});`
        },
        {
          name: 'stats 失败只降级 stats',
          code: `const loadDetail = createDetailLoader({
  fetchMeta: async () => ({ id: 'l1' }),
  fetchStats: async () => { throw new Error('stats down'); },
  fetchPermission: async () => true,
  timeoutMs: 100,
  scheduler: { setTimeout: () => 0, clearTimeout: () => {} }
});
const result = await loadDetail('l1');
assert.equal(result.stats, null);
assert.equal(result.canEdit, true);
assert.deepEqual(result.degraded, ['stats']);`
        },
        {
          name: 'meta 失败映射错误码且不透传原始错误',
          code: `const buildLoader = (error) => createDetailLoader({
  fetchMeta: async () => { throw error; },
  fetchStats: async () => ({}),
  fetchPermission: async () => false,
  timeoutMs: 100,
  scheduler: { setTimeout: () => 0, clearTimeout: () => {} }
});
const notFound = new Error('missing');
notFound.code = 'NOT_FOUND';
const first = await buildLoader(notFound)('l1');
assert.deepEqual(first, { code: 'NOT_FOUND' });
const second = await buildLoader(new Error('boom'))('l1');
assert.deepEqual(second, { code: 'UPSTREAM' });`
        },
        {
          name: '总超时保留已完成字段、忽略迟到结果，meta 未完成返回 UPSTREAM',
          code: `const createScheduler = () => {
  let now = 0;
  let seq = 0;
  const tasks = new Map();
  return {
    setTimeout(fn, ms) { const id = ++seq; tasks.set(id, { at: now + ms, fn }); return id; },
    clearTimeout(id) { tasks.delete(id); },
    advance(ms) {
      now += ms;
      for (const [id, task] of [...tasks].sort((a, b) => a[1].at - b[1].at)) {
        if (task.at <= now) { tasks.delete(id); task.fn(); }
      }
    }
  };
};

const scheduler = createScheduler();
let releaseStats;
const statsPromise = new Promise((resolve) => { releaseStats = resolve; });
const loader = createDetailLoader({
  fetchMeta: async () => ({ id: 'l1' }),
  fetchStats: () => statsPromise,
  fetchPermission: async () => true,
  timeoutMs: 500,
  scheduler
});
const pending = loader('l1');
await Promise.resolve();
scheduler.advance(500);
const first = await pending;
assert.deepEqual(first.degraded, ['stats']);
assert.equal(first.stats, null);
releaseStats({ clicks: 99 });
await Promise.resolve();
assert.equal(first.stats, null);

const scheduler2 = createScheduler();
const loader2 = createDetailLoader({
  fetchMeta: () => new Promise(() => {}),
  fetchStats: async () => null,
  fetchPermission: async () => false,
  timeoutMs: 300,
  scheduler: scheduler2
});
const pending2 = loader2('l2');
scheduler2.advance(300);
const second = await pending2;
assert.deepEqual(second, { code: 'UPSTREAM' });`
        }
      ]
    },
    {
      id: 's6-l1-ex-2',
      kind: 'design',
      title: 'LinkHub 详情页 BFF 契约',
      brief: '为 LinkHub 链接详情页设计一版 BFF：页面需要链接元数据、统计摘要、当前用户权限与相关链接。请说明输入/输出 schema、聚合哪些上游、并发与总超时预算、部分失败策略、鉴权透传、错误码映射、缓存边界、类型同步方式与可观测字段。',
      checklist: [
        '输入/输出 schema 与 UI 直接消费的字段',
        '聚合的上游列表与各自职责',
        '并发方式与总超时预算',
        '部分失败策略与 degraded 字段',
        '鉴权与租户上下文透传',
        '错误码映射，不透传内部错误',
        '缓存边界与个性化键',
        '类型生成与漂移检查方式',
        '可观测字段与 traceId'
      ],
      reference: '<ul><li><strong>输出：</strong>{ link, stats, canEdit, related, degraded }，字段直接对应页面组件，不在前端二次拼装。</li><li><strong>上游：</strong>链接服务、统计服务、权限服务、推荐服务；相关链接非关键。</li><li><strong>并发：</strong>四个上游同时启动；总预算 800ms，单上游超时 500ms，总预算小于各上游超时之和。</li><li><strong>降级：</strong>meta 失败整体失败；stats、related、permission 失败标记 degraded，页面继续渲染。</li><li><strong>鉴权：</strong>BFF 入口解析一次会话，把用户与租户上下文按上游要求签名透传，不信任前端传参。</li><li><strong>错误：</strong>上游 NOT_FOUND 映射页面 404，其余映射 UPSTREAM；堆栈与内部码只进日志。</li><li><strong>缓存：</strong>个性化响应不进入公共缓存；匿名页面可按链接维度短 TTL 缓存。</li><li><strong>类型：</strong>客户端由 OpenAPI 生成；CI 比对生成物并做兼容性检查，破坏性变更阻断合并。</li><li><strong>可观测：</strong>记录总耗时、各上游耗时、degraded 原因、traceId，能还原一次聚合的完整路径。</li></ul>'
    }
  ]
};
