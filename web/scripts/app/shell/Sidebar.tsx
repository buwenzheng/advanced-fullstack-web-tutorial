import { useEffect, useState } from 'react';
import { Link, matchPath, useLocation } from 'react-router';
import { curriculum, graduationProject, lessonById } from '../../content/index';
import { useProgress } from '../hooks/useProgress';
import ResetProgress from './ResetProgress';

export default function Sidebar({ open }: { open: boolean }) {
  const { pathname } = useLocation();
  const progress = useProgress();
  const stageMatch = matchPath('/stage/:stageId', pathname);
  const lessonMatch = matchPath('/lesson/:lessonId', pathname);
  const activeStageId = stageMatch?.params.stageId
    ?? lessonById(lessonMatch?.params.lessonId ?? '')?.stageId;
  const [openStages, setOpenStages] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!activeStageId) return;
    setOpenStages((prev) => {
      if (prev.has(activeStageId)) return prev;
      const next = new Set(prev);
      next.add(activeStageId);
      return next;
    });
  }, [activeStageId]);

  const toggleStage = (stageId: string) => {
    setOpenStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  };

  const routeName = pathname.startsWith('/lab') ? 'lab' : pathname.startsWith('/report') ? 'report' : '';

  return (
    <aside className={`sidebar${open ? ' is-open' : ''}`} id="sidebar" aria-label="课程目录">
      <nav className="sidebar__scroll" id="sidebar-nav">
        <div className="rail-head">
          <h2>学习路径</h2>
          <span id="rail-count">{progress.course.done}/{progress.course.total}</span>
        </div>

        {curriculum.map((stage) => {
          const mastery = progress.stage(stage);
          const isActive = stage.id === activeStageId;
          const isDone = mastery.total > 0 && mastery.done === mastery.total;
          const expanded = openStages.has(stage.id);

          return (
            <div
              key={stage.id}
              className={`stage-node${expanded ? ' is-open' : ''}${isActive ? ' is-active' : ''}${isDone ? ' is-done' : ''}`}
              data-stage={stage.id}
            >
              <button
                className="stage-node__head"
                type="button"
                aria-expanded={expanded}
                onClick={() => toggleStage(stage.id)}
              >
                <span className="stage-node__pip">{stage.appendix ? 'A' : String(stage.index)}</span>
                <span className="stage-node__title">{stage.title}</span>
                <span className="badge badge--muted tiny">{mastery.done}/{mastery.total}</span>
                <svg className="stage-node__chevron" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M8 5l6 5-6 5" />
                </svg>
              </button>
              <div className="stage-node__bar"><i style={{ width: `${mastery.percent}%` }} /></div>
              <ul className="stage-node__lessons">
                {stage.lessons.map((lesson) => {
                  const done = progress.lessonDone(lesson);
                  const current = lessonMatch?.params.lessonId === lesson.id;
                  return (
                    <li key={lesson.id}>
                      <Link
                        className={`lesson-link${done ? ' is-done' : ''}${current ? ' is-current' : ''}`}
                        to={`/lesson/${lesson.id}`}
                        data-lesson={lesson.id}
                        aria-current={current ? 'page' : undefined}
                      >
                        <span className="lesson-link__mark">
                          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10.5l4 4 8-9" /></svg>
                        </span>
                        <span>{lesson.title}</span>
                        {lesson.status !== 'ready' ? <span className="badge badge--muted tiny">草稿</span> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        <div className="rail-section">
          <Link className={`rail-link${routeName === 'lab' ? ' is-current' : ''}`} to="/lab" data-rail="lab">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M4 15l3.5-4.5L10 13l5.5-7" /><circle cx="4" cy="15" r="1" /><circle cx="15.5" cy="6" r="1" />
            </svg>
            <span>HTTP 实验室</span>
          </Link>
          <Link className={`rail-link${routeName === 'report' ? ' is-current' : ''}`} to="/report" data-rail="report">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 16V9M8 16V5M12 16v-4M16 16V7" /></svg>
            <span>学习报告</span>
          </Link>
          <Link className="rail-link" to={`/project/${graduationProject.id}`} data-rail="graduation">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M10 3l7 4v6l-7 4-7-4V7z" /><path d="M10 17v-6" />
            </svg>
            <span>毕业项目</span>
          </Link>
        </div>
      </nav>
      <ResetProgress />
    </aside>
  );
}
