import { Link, useParams } from 'react-router';
import { lessonById, stageById, stageLabel } from '../../content/index';
import { formatDuration } from '../../state/store';
import EmptyState from './EmptyState';

export default function LessonPage() {
  const { lessonId = '' } = useParams();
  const lesson = lessonById(lessonId);
  if (!lesson) return <EmptyState text="找不到这一讲，可能是链接有误。" back />;

  const stage = stageById(lesson.stageId);

  return (
    <div className="page">
      <article>
        <header className="lesson-head">
          <div className="lesson-head__meta">
            {stage ? (
              <Link className="badge badge--teal" to={`/stage/${stage.id}`}>
                {stage.appendix ? stage.title : `${stageLabel(stage)} · ${stage.title}`}
              </Link>
            ) : null}
            <span className="badge badge--muted">{formatDuration(lesson.duration)}</span>
          </div>
          <h1>{lesson.title}</h1>
          {lesson.subtitle ? <p className="lesson-head__lede">{lesson.subtitle}</p> : null}
        </header>

        <div className="aside-card" style={{ marginTop: 24 }}>
          <h3>正文迁移中</h3>
          <p>正文、12 类内容块、检查题与练习将在 E3 迁移；E2 先保证路由、外壳与导航稳定。</p>
        </div>
      </article>
    </div>
  );
}
