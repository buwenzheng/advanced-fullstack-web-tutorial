import { Link, useParams } from 'react-router';
import { stageById, stageLabel } from '../../content/index';
import EmptyState from './EmptyState';

export default function StagePage() {
  const { stageId = '' } = useParams();
  const stage = stageById(stageId);
  if (!stage) return <EmptyState text="找不到这个阶段。" />;

  return (
    <div className="page">
      <section className="stage-hero">
        <span className="stage-hero__num">
          {stage.appendix ? 'APPENDIX' : `STAGE ${String(stage.index).padStart(2, '0')}`}
        </span>
        <h1>{stage.title}</h1>
        <p>{stage.subtitle}</p>
        <div className="stage-hero__tags">
          <span className="badge badge--muted">{stageLabel(stage)}</span>
          <span className="badge badge--muted">{stage.lessons.length} 讲</span>
        </div>
      </section>

      <section className="section" style={{ marginTop: 28 }}>
        <div className="section__head">
          <div>
            <h2>本阶段课程</h2>
            <p>正文与练习将在 E3 迁移，当前可先用列表验证路由与导航。</p>
          </div>
        </div>
        <div className="list-stack">
          {stage.lessons.map((lesson, index) => (
            <Link key={lesson.id} className="lesson-row" to={`/lesson/${lesson.id}`}>
              <span className="lesson-row__num">
                {stage.appendix ? `A.${index + 1}` : `${stage.index}.${index + 1}`}
              </span>
              <div>
                <div className="lesson-row__title">{lesson.title}</div>
                <div className="lesson-row__sub">{lesson.subtitle}</div>
              </div>
            </Link>
          ))}
        </div>
        {stage.project ? (
          <p style={{ marginTop: 16 }}>
            <Link className="btn btn--ghost btn--sm" to={`/project/${stage.project.id}`}>
              进入阶段项目：{stage.project.title}
            </Link>
          </p>
        ) : null}
      </section>
    </div>
  );
}
