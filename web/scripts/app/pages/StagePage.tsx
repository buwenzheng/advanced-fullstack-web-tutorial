import type { CSSProperties } from 'react';
import { Navigate, useParams } from 'react-router';
import { formatDuration } from '../../state/store';
import { useStage } from '../data/content';
import { useMastery } from '../data/mastery';
import type { Accent, Lesson, Stage } from '../data/types';
import { resolveStageRedirect } from '../redirects';

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
  const redirectTo = resolveStageRedirect(stageId);
  const stage = useStage(redirectTo ?? stageId);
  if (redirectTo) return <Navigate to={`/stage/${redirectTo}`} replace />;
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
  const kindLabel = stage.kind === 'elective' ? '选修' : stage.kind === 'toolbox' ? '工具箱' : '主修';
  const projects = stage.projects ?? (stage.project ? [stage.project] : []);
  const prerequisites = [...new Set(projects.flatMap((project) => project.prerequisites))];
  const lessonIndex = new Map(stage.lessons.map((lesson, index) => [lesson.id, index]));
  const chapters = stage.chapters?.length
    ? stage.chapters
    : [{ id: stage.id, title: '课程', lessonIds: stage.lessons.map((lesson) => lesson.id) }];

  return (
    <div className="page">
      <section className="stage-hero" style={{ '--accent': accent } as CSSProperties}>
        <span className="stage-hero__num">
          {`${kindLabel} · ${stage.id.toUpperCase()}`}
        </span>
        <h1>{stage.title}</h1>
        <p>{stage.subtitle}</p>
        <div className="stage-hero__tags">
          <span className="badge badge--muted">{formatDuration(stage.duration)}</span>
          <span className="badge badge--muted">{`${stage.lessons.length} 讲`}</span>
          <span className={`badge ${stage.kind === 'toolbox' ? 'badge--amber' : 'badge--teal'}`}>{kindLabel}</span>
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
              <h2>本块课程</h2>
              <p>按当前路径选择章节推进；工具箱内容可按需查阅。</p>
            </div>
          </div>
          {chapters.map((chapter, chapterIndex) => (
            <section className="chapter-group" key={chapter.id}>
              {stage.chapters?.length ? (
                <div className="chapter-group__head">
                  <h3>{`第 ${chapterIndex + 1} 章 · ${chapter.title}`}</h3>
                  <span className="badge badge--muted">{`${chapter.lessonIds.length} 讲`}</span>
                </div>
              ) : null}
              {stage.id === 'm3' && chapter.id === 'ship' ? (
                <p className="tiny muted">路径 A 完成生产章即可；产品章不属于该路径的结业要求。</p>
              ) : null}
              {chapter.lessonIds.map((lessonId) => {
                const lesson = stage.lessons.find((candidate) => candidate.id === lessonId);
                if (!lesson) return null;
                const index = lessonIndex.get(lesson.id) ?? 0;
                return (
                  <StageLessonRow
                    key={lesson.id}
                    lesson={lesson}
                    number={`${stage.id.toUpperCase()}.${index + 1}`}
                    done={mastery.lesson(lesson.id)}
                  />
                );
              })}
            </section>
          ))}
        </div>

        <aside className="list-stack">
          <div className="aside-card">
            <h3>大块目标</h3>
            <p>{stage.goal}</p>
          </div>
          {stage.outcome?.length ? (
            <div className="aside-card">
              <h3>出口标准</h3>
              <ul>
                {stage.outcome.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ) : null}
          {prerequisites.length ? (
            <div className="aside-card">
              <h3>建议先修</h3>
              <ul>{prerequisites.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ) : null}
          {projects.map((project) => (
            <a
              key={project.id}
              className="panel"
              href={`#/project/${project.id}`}
              style={{ display: 'block', padding: 16, textDecoration: 'none', color: 'inherit' }}
            >
              <span className="eyebrow">
                {stage.kind === 'elective' ? '选修项目' : '项目入口'}
              </span>
              <h3 style={{ fontSize: 15, margin: '8px 0 6px' }}>{project.title}</h3>
              <p className="tiny muted" style={{ lineHeight: 1.7 }}>{project.brief}</p>
            </a>
          ))}
        </aside>
      </div>
    </div>
  );
}
