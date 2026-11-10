import type { CSSProperties } from 'react';
import { useParams } from 'react-router';
import { formatDuration } from '../../state/store';
import { useStage } from '../data/content';
import { useMastery } from '../data/mastery';
import type { Accent, Lesson, Stage } from '../data/types';

const ACCENT_VAR: Record<Accent, string> = {
  teal: 'var(--teal)',
  amber: 'var(--amber)',
  violet: 'var(--violet)',
  rose: 'var(--rose)',
  blue: 'var(--blue)',
  green: 'var(--green)',
};

export function StageLessonRow({ lesson, number, done }: { lesson: Lesson; number: string; done: boolean }) {
  const isDraft = lesson.status !== 'ready';
  const taskCount = lesson.checks.length + lesson.exercises.length;
  return (
    <a className="lesson-row" href={`#/lesson/${lesson.id}`}>
      <span className="lesson-row__num">{number}</span>
      <div>
        <div className="lesson-row__title">{lesson.title}</div>
        <div className="lesson-row__sub">{lesson.subtitle || ''}</div>
      </div>
      <div className="lesson-row__right">
        <span>{formatDuration(lesson.duration)}</span>
        {isDraft
          ? <span className="badge badge--muted">草稿</span>
          : <span>{`${taskCount} 题`}</span>}
        {done ? <span className="badge badge--teal">已掌握</span> : null}
      </div>
    </a>
  );
}

export default function StagePage() {
  const { stageId = '' } = useParams();
  const stage = useStage(stageId);
  if (!stage) {
    return (
      <div className="page">
        <div className="empty-state">找不到这个阶段。</div>
      </div>
    );
  }
  return <StageView stage={stage} />;
}

export function StageView({ stage }: { stage: Stage }) {
  const mastery = useMastery();
  const accent = ACCENT_VAR[stage.accent as Accent] || 'var(--teal)';
  const doneCount = mastery.stage(stage.id).done;

  return (
    <div className="page">
      <section className="stage-hero" style={{ '--accent': accent } as CSSProperties}>
        <span className="stage-hero__num">
          {stage.appendix ? 'APPENDIX' : `STAGE ${String(stage.index).padStart(2, '0')}`}
        </span>
        <h1>{stage.title}</h1>
        <p>{stage.subtitle}</p>
        <div className="stage-hero__tags">
          <span className="badge badge--muted">{formatDuration(stage.duration)}</span>
          <span className="badge badge--muted">{`${stage.lessons.length} 讲`}</span>
          {stage.appendix
            ? <span className="badge badge--teal">附录 · 性能、架构、工程与 AI 基础设施</span>
            : null}
          <span className="badge badge--muted">{`已完成 ${doneCount}/${stage.lessons.length}`}</span>
          {(stage.keywords || []).map((keyword) => (
            <span key={keyword} className="badge badge--blue">{keyword}</span>
          ))}
        </div>
      </section>

      <div className="split" style={{ marginTop: 28 }}>
        <div className="list-stack">
          <div className="section__head" style={{ marginBottom: 0 }}>
            <div>
              <h2>本阶段课程</h2>
              <p>按顺序学；标为草稿的讲次会在后续模块补齐正文与练习。</p>
            </div>
          </div>
          {stage.lessons.map((lesson, index) => (
            <StageLessonRow
              key={lesson.id}
              lesson={lesson}
              number={stage.appendix ? `A.${index + 1}` : `${stage.index}.${index + 1}`}
              done={mastery.lesson(lesson.id)}
            />
          ))}
        </div>

        <aside className="list-stack">
          <div className="aside-card">
            <h3>阶段目标</h3>
            <p>{stage.goal}</p>
          </div>
          {stage.outcome?.length ? (
            <div className="aside-card">
              <h3>达成标准</h3>
              <ul>
                {stage.outcome.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ) : null}
          {stage.project ? (
            <a
              className="panel"
              href={`#/project/${stage.project.id}`}
              style={{ display: 'block', padding: 16, textDecoration: 'none', color: 'inherit' }}
            >
              <span className="eyebrow">阶段项目</span>
              <h3 style={{ fontSize: 15, margin: '8px 0 6px' }}>{stage.project.title}</h3>
              <p className="tiny muted" style={{ lineHeight: 1.7 }}>{stage.project.brief}</p>
            </a>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
