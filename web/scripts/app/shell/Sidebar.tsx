import { useMemo, useState } from 'react';
import { matchPath, useLocation } from 'react-router';
import { useGraduationId, useLessonSummaries, useStageSummaries } from '../data/content';
import { useMastery } from '../data/mastery';
import type { LessonSummary } from '../data/types';
import ResetProgress from './ResetProgress';

export default function Sidebar({ open }: { open: boolean }) {
  const { pathname } = useLocation();
  const stages = useStageSummaries();
  const lessons = useLessonSummaries();
  const mastery = useMastery();
  const graduationId = useGraduationId();
  const stageMatch = matchPath('/stage/:stageId', pathname);
  const lessonMatch = matchPath('/lesson/:lessonId', pathname);
  const [openStages, setOpenStages] = useState<Set<string>>(() => new Set());
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(() => new Set());

  const lessonIndex = useMemo(
    () => new Map(lessons.map((lesson) => [lesson.id, lesson])),
    [lessons],
  );
  const lessonsByStage = useMemo(() => {
    const map = new Map<string, LessonSummary[]>();
    for (const lesson of lessons) {
      const list = map.get(lesson.stageId) ?? [];
      list.push(lesson);
      map.set(lesson.stageId, list);
    }
    return map;
  }, [lessons]);

  const activeLessonId = lessonMatch?.params.lessonId ?? '';
  const activeStageId = stageMatch?.params.stageId
    ?? lessonIndex.get(activeLessonId)?.stageId;

  const toggleStage = (stageId: string) => {
    const isExpanded = openStages.has(stageId)
      || (stageId === activeStageId && !collapsedStages.has(stageId));
    if (isExpanded) {
      setOpenStages((prev) => {
        const next = new Set(prev);
        next.delete(stageId);
        return next;
      });
      setCollapsedStages((prev) => new Set(prev).add(stageId));
    } else {
      setCollapsedStages((prev) => {
        const next = new Set(prev);
        next.delete(stageId);
        return next;
      });
      setOpenStages((prev) => new Set(prev).add(stageId));
    }
  };

  const routeName = pathname.startsWith('/lab') ? 'lab' : pathname.startsWith('/report') ? 'report' : '';

  return (
    <aside className={`sidebar${open ? ' is-open' : ''}`} id="sidebar" aria-label="课程目录">
      <nav className="sidebar__scroll" id="sidebar-nav">
        <div className="rail-head">
          <h2>学习路径</h2>
          <span id="rail-count">{mastery.course.done}/{mastery.course.total}</span>
        </div>

        {stages.map((stage) => {
          const stageMastery = mastery.stage(stage.id);
          const isActive = stage.id === activeStageId;
          const isDone = stageMastery.total > 0 && stageMastery.done === stageMastery.total;
          const expanded = openStages.has(stage.id)
            || (isActive && !collapsedStages.has(stage.id));

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
                <span className="badge badge--muted tiny">{stageMastery.done}/{stageMastery.total}</span>
                <svg className="stage-node__chevron" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M8 5l6 5-6 5" />
                </svg>
              </button>
              <div className="stage-node__bar"><i style={{ width: `${stageMastery.percent}%` }} /></div>
              <ul className="stage-node__lessons">
                {(lessonsByStage.get(stage.id) ?? []).map((lesson) => {
                  const done = mastery.lesson(lesson.id);
                  const current = activeLessonId === lesson.id;
                  return (
                    <li key={lesson.id}>
                      <a
                        className={`lesson-link${done ? ' is-done' : ''}${current ? ' is-current' : ''}`}
                        href={`#/lesson/${lesson.id}`}
                        data-lesson={lesson.id}
                        aria-current={current ? 'page' : undefined}
                      >
                        <span className="lesson-link__mark">
                          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10.5l4 4 8-9" /></svg>
                        </span>
                        <span>{lesson.title}</span>
                        {lesson.status !== 'ready' ? <span className="badge badge--muted tiny">草稿</span> : null}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        <div className="rail-section">
          <a className={`rail-link${routeName === 'lab' ? ' is-current' : ''}`} href="#/lab" data-rail="lab">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M4 15l3.5-4.5L10 13l5.5-7" /><circle cx="4" cy="15" r="1" /><circle cx="15.5" cy="6" r="1" />
            </svg>
            <span>HTTP 实验室</span>
          </a>
          <a className={`rail-link${routeName === 'report' ? ' is-current' : ''}`} href="#/report" data-rail="report">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 16V9M8 16V5M12 16v-4M16 16V7" /></svg>
            <span>学习报告</span>
          </a>
          {graduationId ? (
            <a className="rail-link" href={`#/project/${graduationId}`} data-rail="graduation">
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M10 3l7 4v6l-7 4-7-4V7z" /><path d="M10 17v-6" />
              </svg>
              <span>毕业项目</span>
            </a>
          ) : null}
        </div>
      </nav>
      <ResetProgress />
    </aside>
  );
}
