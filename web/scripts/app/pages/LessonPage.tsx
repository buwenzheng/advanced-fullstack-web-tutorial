import { Fragment } from 'react';
import { useParams } from 'react-router';
import { stageLabel } from '../data/labels';
import { formatDuration, store } from '../../state/store';
import { lessonTasks, taskSolved } from '../../state/mastery-core';
import { useLesson } from '../data/content';
import { useMastery } from '../data/mastery';
import type { LessonContext } from '../data/types';
import { useLang } from '../hooks/useLang';
import { renderBlock } from '../lesson/blocks';
import { TaskRenderer } from '../exercises/TaskRenderer';
import EmptyState from './EmptyState';

function CheckIcon() {
  return (
    <span>
      <svg viewBox="0 0 20 20">
        <path d="M4 10.5l4 4 8-9" />
      </svg>
    </span>
  );
}

export default function LessonPage() {
  const { lessonId = '' } = useParams();
  const { current } = useLang();
  const context = useLesson(lessonId);
  if (!context) return <EmptyState text="找不到这一讲，可能是链接有误。" back />;
  return <LessonView key={current} context={context} />;
}

export function LessonView({ context }: { context: LessonContext }) {
  const { lesson, stage, prev, next } = context;
  const mastery = useMastery();
  const isDraft = lesson.status !== 'ready';
  const tasks = lessonTasks(lesson);
  const solved = tasks.filter((task) => taskSolved(task)).length;
  const verified = tasks.length > 0 && solved === tasks.length;
  const autoMastered = mastery.lesson(lesson.id);
  const manual = store.lessonDone(lesson.id);
  const doneHidden = isDraft || (autoMastered && !manual);

  return (
    <article className="page">
      <header className="lesson-head">
        <div className="lesson-head__meta">
          <a className="badge badge--teal" href={`#/stage/${stage.id}`}>
            {stage.appendix ? stage.title : `${stageLabel(stage)} · ${stage.title}`}
          </a>
          <span className="badge badge--muted">{formatDuration(lesson.duration)}</span>
          <span className="badge badge--muted">
            {`${lesson.checks.length} 道检查点 · ${lesson.exercises.length} 道练习`}
          </span>
          {isDraft ? <span className="badge badge--amber">草稿</span> : null}
          {!isDraft ? (
            <span className={`badge ${verified ? 'badge--teal' : 'badge--muted'}`}>
              {`已验证 ${solved}/${tasks.length}`}
            </span>
          ) : null}
          {!isDraft && autoMastered ? <span className="badge badge--teal">本讲已掌握</span> : null}
        </div>
        <h1>{lesson.title}</h1>
        {lesson.subtitle ? <p className="lesson-head__lede">{lesson.subtitle}</p> : null}
      </header>

      {isDraft ? (
        <div className="draft-banner">
          <strong>本讲内容建设中</strong>
          <p>M0 已锁定本讲的 ID、时长与项目归属，正文、检查题与练习会在后续模块补齐。当前可先浏览阶段目标与项目验收标准。</p>
        </div>
      ) : null}

      {!isDraft && lesson.objectives?.length ? (
        <div className="objectives">
          <h3>学完这一讲，你能做到</h3>
          <ul>
            {lesson.objectives.map((item) => (
              <li key={item}>
                <CheckIcon />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="lesson-body">
        {lesson.blocks.map((block, index) => (
          <Fragment key={index}>{renderBlock(block)}</Fragment>
        ))}
      </div>

      {lesson.checks.length ? (
        <section className="lblock" style={{ marginTop: 40 }}>
          <h3 className="lblock__title">概念检查</h3>
          <p className="muted tiny" style={{ margin: '-4px 0 14px' }}>答对会自动记录，可以随时重做。</p>
          {lesson.checks.map((question) => (
            <TaskRenderer key={question.id} task={question} />
          ))}
        </section>
      ) : null}

      {lesson.exercises.length ? (
        <section className="lblock" style={{ marginTop: 36 }}>
          <h3 className="lblock__title">本讲练习</h3>
          <p className="muted tiny" style={{ margin: '-4px 0 14px' }}>练习在浏览器里真实运行：代码会被执行，SQL 会被解析，结果自动比对。</p>
          {lesson.exercises.map((task) => (
            <TaskRenderer key={task.id} task={task} />
          ))}
        </section>
      ) : null}

      <div style={{ marginTop: 32, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className={`btn btn--sm ${manual ? 'btn--primary' : 'btn--ghost'}`}
          type="button"
          style={doneHidden ? { display: 'none' } : undefined}
          onClick={() => store.setLessonDone(lesson.id, !store.lessonDone(lesson.id))}
        >
          {manual ? '已掌握' : '标记为已掌握'}
        </button>
        {stage.project ? (
          <a className="btn btn--ghost btn--sm" href={`#/project/${stage.project.id}`}>
            {`进入阶段项目：${stage.project.title}`}
          </a>
        ) : null}
      </div>

      <nav className="lesson-nav" aria-label="课程翻页">
        {prev ? (
          <a href={`#/lesson/${prev.id}`}>
            <span>← 上一讲</span>
            <strong>{prev.title}</strong>
          </a>
        ) : null}
        {next ? (
          <a className="is-next" href={`#/lesson/${next.id}`}>
            <span>下一讲 →</span>
            <strong>{next.title}</strong>
          </a>
        ) : null}
        {!prev && !next && stage.project ? (
          <a className="is-next" href={`#/project/${stage.project.id}`}>
            <span>本阶段结束 →</span>
            <strong>{stage.project.title}</strong>
          </a>
        ) : null}
      </nav>
    </article>
  );
}
