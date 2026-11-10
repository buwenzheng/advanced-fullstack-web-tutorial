import type { CSSProperties } from 'react';
import { useGraduationId, useStageSummaries, useStats } from '../data/content';
import { useMastery } from '../data/mastery';
import type { Accent, StageSummary } from '../data/types';

const ACCENT_VAR: Record<Accent, string> = {
  teal: 'var(--teal)',
  amber: 'var(--amber)',
  violet: 'var(--violet)',
  rose: 'var(--rose)',
  blue: 'var(--blue)',
  green: 'var(--green)',
};

const LEDE = '这是一条为前端工程师设计的完整进阶路线：从请求与运行时起步，经数据、API、缓存与韧性、生产化、架构与分布式，再到全栈集成与 AI 应用。每一讲都从你熟悉的前端经验切入，讲清「为什么后端必须这样设计」，随后用可自动验证的练习检验理解，最后用真实项目把知识固化下来。学完八个核心阶段，你能独立设计、上线并运营一套面向 AI 时代的产品；附录再补上性能、基础设施与面试所需的底层能力。';

const PATH_INTRO = '八个核心阶段层层递进：先把请求与运行时看清，再把数据放稳，然后设计好接口，接着处理缓存、异步与韧性，完成生产化与架构拆分，最后进入全栈集成与 AI 应用。附录按需查阅，面向性能、基础设施与大厂面试。';

export function StageCard({ stage, percent }: { stage: StageSummary; percent: number }) {
  return (
    <a
      className="stage-card"
      href={`#/stage/${stage.id}`}
      style={{ '--accent': ACCENT_VAR[stage.accent] || 'var(--teal)' } as CSSProperties}
    >
      <div className="stage-card__top">
        <span className="stage-card__num">
          {stage.appendix ? 'APPENDIX' : `STAGE ${String(stage.index).padStart(2, '0')}`}
        </span>
        <span className="badge badge--muted">{percent}%</span>
      </div>
      <h3>{stage.title}</h3>
      <p>{stage.subtitle}</p>
      <div className="stage-card__bar"><i style={{ width: `${percent}%` }} /></div>
      <div className="stage-card__meta">
        <span>{stage.lessonCount} 讲</span>
        <span>·</span>
        <span>{stage.appendix ? '性能、架构与 AI 基础设施' : stage.projectId ? '含阶段项目' : ''}</span>
        {stage.draftCount ? <span>· {stage.draftCount} 讲制作中</span> : null}
      </div>
    </a>
  );
}

export default function OverviewPage() {
  const stats = useStats();
  const stages = useStageSummaries();
  const mastery = useMastery();
  const graduationId = useGraduationId();
  const next = mastery.nextLessonId ? { id: mastery.nextLessonId } : null;
  const done = mastery.course.done;

  return (
    <div className="page">
      <section className="hero">
        <div className="hero__inner">
          <span className="eyebrow">Backend for Frontend Engineers</span>
          <h1 style={{ marginTop: 10 }}>把前端的手感，<em>接后端的世界</em></h1>
          <p className="hero__lede">{LEDE}</p>
          <div className="hero__stats">
            <div className="hero__stat"><b>{`${stats.mainStageCount} + 1`}</b><span>阶段 + 附录</span></div>
            <div className="hero__stat"><b>{stats.lessonCount}</b><span>课程讲解</span></div>
            <div className="hero__stat"><b>{stats.taskCount}</b><span>可验证练习</span></div>
            <div className="hero__stat"><b>{`${mastery.course.done}/${mastery.course.total}`}</b><span>已掌握</span></div>
          </div>
          <div className="hero__cta">
            <a className="btn btn--primary" href={next ? `#/lesson/${next.id}` : '#/'}>
              {done ? '继续学习' : '从第一讲开始'}
            </a>
            <a className="btn btn--ghost" href="#/lab">打开 HTTP 实验室</a>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <div>
            <h2>这套课程怎么运转</h2>
            <p>每一讲都是「讲清 → 验证 → 落地」三段式。练习不是选择题凑数：代码会在沙箱里真跑，SQL 会被解析并比对结果。</p>
          </div>
        </div>
        <div className="compare">
          <div className="compare__col">
            <h4>① 深入浅出的讲解</h4>
            <ul>
              <li>每个概念先用<strong>前端类比</strong>建立直觉，再讲后端的真实约束</li>
              <li>给出<strong>最小可运行实现</strong>，不堆砌框架名词</li>
              <li>明确列出<strong>常见坑</strong>：那些你一定会踩一次的地方</li>
            </ul>
          </div>
          <div className="compare__col">
            <h4>② 可验证的练习</h4>
            <ul>
              <li><strong>概念检查</strong>：单选/多选，答错立刻给解析</li>
              <li><strong>代码题</strong>：浏览器沙箱执行，测试用例逐条判定</li>
              <li><strong>SQL 题</strong>：迷你 SQL 引擎执行，结果集精确比对</li>
              <li><strong>方案题</strong>：结构化自评，对照参考要点查漏</li>
            </ul>
          </div>
          <div className="compare__col">
            <h4>③ 递进式项目</h4>
            <ul>
              <li>每个阶段一个项目，<strong>成果逐阶段累积</strong></li>
              <li>每个里程碑都有明确验收标准，做完勾选即可</li>
              <li>毕业项目 <strong>LinkHub</strong> 串起全部知识</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <div>
            <h2>学习路径</h2>
            <p>{PATH_INTRO}</p>
          </div>
        </div>
        <div className="stage-grid">
          {stages.map((stage) => (
            <StageCard key={stage.id} stage={stage} percent={mastery.stage(stage.id).percent} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="panel">
          <div className="panel__head">
            <h2>毕业项目：LinkHub 短链服务</h2>
            <span className="badge badge--amber">资深全栈</span>
          </div>
          <div className="panel__body">
            <p className="dim" style={{ lineHeight: 1.85 }}>
              把八个核心阶段的成果合成一个可部署、可运营、可答辩的产品：认证与权限、持久化、缓存、异步统计、限流与幂等、可观测性、容器化发布、Web/BFF，以及带评估与降级的 AI 助手。做完它，你具备独立负责一条全栈业务线的能力。
            </p>
            <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {graduationId ? (
                <a className="btn btn--primary btn--sm" href={`#/project/${graduationId}`}>查看毕业项目</a>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
