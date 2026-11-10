import { h } from '../ui.js';
import { curriculum, allLessons } from '../content/index';
import { courseMastery, stageMastery, nextLesson } from '../progress.js';

const ACCENT_VAR = {
  teal: 'var(--teal)',
  amber: 'var(--amber)',
  violet: 'var(--violet)',
  rose: 'var(--rose)',
  blue: 'var(--blue)',
  green: 'var(--green)',
};

export function renderOverview() {
  const page = h('div', { class: 'page' });
  const checkCount = allLessons.reduce((sum, lesson) => sum + lesson.checks.length + lesson.exercises.length, 0);
  const mainStages = curriculum.filter((stage) => !stage.appendix);
  const mastery = courseMastery();
  const done = mastery.done;
  const next = nextLesson();

  page.appendChild(h('section', { class: 'hero' },
    h('div', { class: 'hero__inner' },
      h('span', { class: 'eyebrow', text: 'Backend for Frontend Engineers' }),
      h('h1', { style: 'margin-top:10px', html: '把前端的手感，<em>接后端的世界</em>' }),
      h('p', {
        class: 'hero__lede',
        text: '这是一条为前端工程师设计的完整进阶路线：从请求与运行时起步，经数据、API、缓存与韧性、生产化、架构与分布式，再到全栈集成与 AI 应用。每一讲都从你熟悉的前端经验切入，讲清「为什么后端必须这样设计」，随后用可自动验证的练习检验理解，最后用真实项目把知识固化下来。学完八个核心阶段，你能独立设计、上线并运营一套面向 AI 时代的产品；附录再补上性能、基础设施与面试所需的底层能力。',
      }),
      h('div', { class: 'hero__stats' },
        h('div', { class: 'hero__stat' }, h('b', { text: `${mainStages.length} + 1` }), h('span', { text: '阶段 + 附录' })),
        h('div', { class: 'hero__stat' }, h('b', { text: String(allLessons.length) }), h('span', { text: '课程讲解' })),
        h('div', { class: 'hero__stat' }, h('b', { text: String(checkCount) }), h('span', { text: '可验证练习' })),
        h('div', { class: 'hero__stat' }, h('b', { text: `${done}/${allLessons.length}` }), h('span', { text: '已掌握' }))),
      h('div', { class: 'hero__cta' },
        h('a', { class: 'btn btn--primary', href: next ? `#/lesson/${next.id}` : '#/', text: done ? '继续学习' : '从第一讲开始' }),
        h('a', { class: 'btn btn--ghost', href: '#/lab', text: '打开 HTTP 实验室' })))));

  const flow = h('section', { class: 'section' },
    h('div', { class: 'section__head' },
      h('div', {},
        h('h2', { text: '这套课程怎么运转' }),
        h('p', { text: '每一讲都是「讲清 → 验证 → 落地」三段式。练习不是选择题凑数：代码会在沙箱里真跑，SQL 会被解析并比对结果。' }))),
    h('div', { class: 'compare' },
      h('div', { class: 'compare__col' },
        h('h4', { text: '① 深入浅出的讲解' }),
        h('ul', {},
          h('li', { html: '每个概念先用<strong>前端类比</strong>建立直觉，再讲后端的真实约束' }),
          h('li', { html: '给出<strong>最小可运行实现</strong>，不堆砌框架名词' }),
          h('li', { html: '明确列出<strong>常见坑</strong>：那些你一定会踩一次的地方' }))),
      h('div', { class: 'compare__col' },
        h('h4', { text: '② 可验证的练习' }),
        h('ul', {},
          h('li', { html: '<strong>概念检查</strong>：单选/多选，答错立刻给解析' }),
          h('li', { html: '<strong>代码题</strong>：浏览器沙箱执行，测试用例逐条判定' }),
          h('li', { html: '<strong>SQL 题</strong>：迷你 SQL 引擎执行，结果集精确比对' }),
          h('li', { html: '<strong>方案题</strong>：结构化自评，对照参考要点查漏' }))),
      h('div', { class: 'compare__col' },
        h('h4', { text: '③ 递进式项目' }),
        h('ul', {},
          h('li', { html: '每个阶段一个项目，<strong>成果逐阶段累积</strong>' }),
          h('li', { html: '每个里程碑都有明确验收标准，做完勾选即可' }),
          h('li', { html: '毕业项目 <strong>LinkHub</strong> 串起全部知识' })))));
  page.appendChild(flow);

  const stageSection = h('section', { class: 'section' },
    h('div', { class: 'section__head' },
      h('div', {},
        h('h2', { text: '学习路径' }),
        h('p', { text: '八个核心阶段层层递进：先把请求与运行时看清，再把数据放稳，然后设计好接口，接着处理缓存、异步与韧性，完成生产化与架构拆分，最后进入全栈集成与 AI 应用。附录按需查阅，面向性能、基础设施与大厂面试。' }))),
    h('div', { class: 'stage-grid' }));

  const grid = stageSection.querySelector('.stage-grid');
  curriculum.forEach((stage) => {
    const { done: doneCount, percent } = stageMastery(stage);
    const draftCount = stage.lessons.filter((lesson) => lesson.status !== 'ready').length;
    grid.appendChild(h('a', {
      class: 'stage-card',
      href: `#/stage/${stage.id}`,
      style: `--accent:${ACCENT_VAR[stage.accent] || 'var(--teal)'}`,
    },
    h('div', { class: 'stage-card__top' },
      h('span', { class: 'stage-card__num', text: stage.appendix ? 'APPENDIX' : `STAGE ${String(stage.index).padStart(2, '0')}` }),
      h('span', { class: 'badge badge--muted', text: `${percent}%` })),
    h('h3', { text: stage.title }),
    h('p', { text: stage.subtitle }),
    h('div', { class: 'stage-card__bar' }, h('i', { style: `width:${percent}%` })),
    h('div', { class: 'stage-card__meta' },
      h('span', { text: `${stage.lessons.length} 讲` }),
      h('span', { text: '·' }),
      h('span', { text: stage.appendix ? '性能、架构与 AI 基础设施' : (stage.project ? '含阶段项目' : '') }),
      draftCount ? h('span', { text: `· ${draftCount} 讲制作中` }) : null)));
  });
  page.appendChild(stageSection);

  page.appendChild(h('section', { class: 'section' },
    h('div', { class: 'panel' },
      h('div', { class: 'panel__head' },
        h('h2', { text: '毕业项目：LinkHub 短链服务' }),
        h('span', { class: 'badge badge--amber', text: '资深全栈' })),
      h('div', { class: 'panel__body' },
        h('p', { class: 'dim', style: 'line-height:1.85', text: '把八个核心阶段的成果合成一个可部署、可运营、可答辩的产品：认证与权限、持久化、缓存、异步统计、限流与幂等、可观测性、容器化发布、Web/BFF，以及带评估与降级的 AI 助手。做完它，你具备独立负责一条全栈业务线的能力。' }),
        h('div', { style: 'margin-top:16px;display:flex;gap:10px;flex-wrap:wrap' },
          h('a', { class: 'btn btn--primary btn--sm', href: '#/project/p-graduation', text: '查看毕业项目' }))))));

  return page;
}
