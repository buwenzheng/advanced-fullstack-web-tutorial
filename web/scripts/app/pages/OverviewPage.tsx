import type { CSSProperties } from 'react';
import { store } from '../../state/store';
import { useGraduationId, useLessonSummaries, useStats } from '../data/content';
import { useMastery } from '../data/mastery';
import {
  DEFAULT_PATH_ID,
  lessonIdsForPath,
  PATH_COMPLETION_COPY,
  useBlocks,
  usePaths,
} from '../data/paths';
import type { Accent, BlockSummary } from '../data/types';

const ACCENT_VAR: Record<Accent, string> = {
  teal: 'var(--teal)',
  amber: 'var(--amber)',
  violet: 'var(--violet)',
  rose: 'var(--rose)',
  blue: 'var(--blue)',
  green: 'var(--green)',
};

const LEDE = '从目标出发选择学习路径，再按大块与章节推进。每一讲都从前端经验切入，用可验证练习检验理解，并通过真实项目把后端、全栈与 AI 工程能力固化下来。';

const PATH_INTRO = '路径是推荐组合，不是访问门锁。默认推荐 C（AI 全栈），也可以随时切换目标。';

export function StageCard({ stage, percent }: { stage: BlockSummary; percent: number }) {
  return (
    <a
      className="stage-card"
      href={`#/stage/${stage.id}`}
      style={{ '--accent': ACCENT_VAR[stage.accent] || 'var(--teal)' } as CSSProperties}
    >
      <div className="stage-card__top">
        <span className="stage-card__num">
          {stage.id.toUpperCase()}
        </span>
        <span className="badge badge--muted">{percent}%</span>
      </div>
      <h3>{stage.title}</h3>
      <p>{stage.subtitle}</p>
      <div className="stage-card__bar"><i style={{ width: `${percent}%` }} /></div>
      <div className="stage-card__meta">
        <span>{stage.lessonCount} 讲</span>
        <span>·</span>
        <span>{stage.kind === 'toolbox' ? '按需查阅' : stage.projectIds.length ? '含项目入口' : ''}</span>
        {stage.draftCount ? <span>· {stage.draftCount} 讲制作中</span> : null}
      </div>
    </a>
  );
}

export default function OverviewPage() {
  const stats = useStats();
  const blocks = useBlocks();
  const paths = usePaths();
  const lessons = useLessonSummaries();
  const mastery = useMastery();
  const graduationId = useGraduationId();
  const activePath = store.get().meta.activePath ?? DEFAULT_PATH_ID;
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
            <div className="hero__stat"><b>{blocks.length}</b><span>学习大块</span></div>
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
            <h2>选择学习路径</h2>
            <p>{PATH_INTRO}</p>
          </div>
        </div>
        <div className="stage-grid">
          {paths.map((path) => {
            const lessonIds = lessonIdsForPath(path.id, lessons, blocks);
            const doneCount = lessonIds.filter((id) => mastery.lesson(id)).length;
            const percent = lessonIds.length ? Math.round((doneCount / lessonIds.length) * 100) : 0;
            const firstStep = path.steps[0]!;
            return (
              <a
                key={path.id}
                className={`stage-card path-card${activePath === path.id ? ' is-active' : ''}`}
                href={`#/stage/${firstStep.blockId}`}
                onClick={() => store.setActivePath(path.id)}
                style={{ '--accent': path.id === DEFAULT_PATH_ID ? 'var(--teal)' : 'var(--blue)' } as CSSProperties}
              >
                <div className="stage-card__top">
                  <span className="stage-card__num">{`路径 ${path.id.toUpperCase()}`}</span>
                  {path.id === DEFAULT_PATH_ID
                    ? <span className="badge badge--teal">默认推荐</span>
                    : activePath === path.id ? <span className="badge badge--blue">当前</span> : null}
                </div>
                <h3>{path.title}</h3>
                <p>{path.blurb}</p>
                <p className="path-card__completion">{PATH_COMPLETION_COPY[path.id]}</p>
                <div className="stage-card__bar"><i style={{ width: `${percent}%` }} /></div>
                <div className="stage-card__meta"><span>{`${doneCount}/${lessonIds.length} 讲`}</span></div>
              </a>
            );
          })}
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <div>
            <h2>按大块浏览</h2>
            <p>主修负责交付主线；选修用于资深加深；工具箱在遇到具体问题时按需查阅。</p>
          </div>
        </div>
        {([
          ['required', '主修'],
          ['elective', '选修'],
          ['toolbox', '工具箱'],
        ] as const).map(([kind, label]) => (
          <div className="block-partition" key={kind}>
            <h3>{label}</h3>
            <div className="stage-grid">
              {blocks.filter((block) => block.kind === kind).map((block) => (
                <StageCard key={block.id} stage={block} percent={mastery.stage(block.id).percent} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="section">
        <div className="panel">
          <div className="panel__head">
            <h2>毕业项目：LinkHub 短链服务</h2>
            <span className="badge badge--amber">资深全栈</span>
          </div>
          <div className="panel__body">
            <p className="dim" style={{ lineHeight: 1.85 }}>
              LinkHub 是可选的集成毕业项目。全栈档完成 m1–m9 与 m11；AI 全栈档再完成 m10；分布式档要求 m3 使用 E1 的 Outbox、独立消费者与可重建读模型方案。
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
