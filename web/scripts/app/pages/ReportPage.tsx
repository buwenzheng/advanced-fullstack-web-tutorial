import { trackSolved } from '../../state/mastery-core';
import { store } from '../../state/store';
import { useAllStages, useGraduation } from '../data/content';
import { stageLabel } from '../data/labels';
import { useMastery } from '../data/mastery';
import { useProgress } from '../hooks/useProgress';
import { buildReportModel, taskLabel } from '../report/report-model';

export default function ReportPage() {
  useProgress();
  const stages = useAllStages();
  const graduation = useGraduation();
  const mastery = useMastery();

  const model = buildReportModel({
    state: store.get(),
    stages,
    graduation,
    mastery: mastery.course,
    stageLabel,
    isLessonMastered: (lesson) => mastery.lesson(lesson.id),
    trackSolved,
    milestoneDone: (projectId, milestoneId) => store.milestoneDone(projectId, milestoneId),
  });

  return (
    <div className="page">
      <div className="section__head" style={{ marginBottom: 18 }}>
        <div>
          <h1>学习报告</h1>
          <p>所有数据保存在本机浏览器。它回答一个具体问题：哪些知识点你已经真的掌握了，哪些只是读过去了。</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat is-teal">
          <b>{model.mastery.done}/{model.mastery.total}</b>
          <span>课程掌握</span>
        </div>
        <div className="stat is-violet">
          <b>{model.answeredCount}</b>
          <span>已作答题目</span>
        </div>
        <div className="stat is-amber">
          <b>{model.accuracy}%</b>
          <span>题目通过率</span>
        </div>
        <div className="stat">
          <b>{model.doneMilestones}/{model.totalMilestones}</b>
          <span>项目里程碑</span>
        </div>
        <div className="stat is-rose">
          <b>{model.wrongCount}</b>
          <span>待攻克题目</span>
        </div>
      </div>

      {model.codeTracks ? (
        <section className="section">
          <div className="section__head">
            <div>
              <h2>代码练习轨道</h2>
              <p>同一道代码题在任一语言轨道通过，即计入课程掌握。两条轨道都做一遍，能把语言差异变成真正的理解。</p>
            </div>
          </div>
          <div className="panel">
            <div className="panel__body">
              <div className="bar-list">
                {model.codeTracks.map((track) => (
                  <div className="bar-row" key={track.label}>
                    <span className="bar-row__label">{track.label}</span>
                    <div className="bar-row__track">
                      <i style={{ width: `${track.percent}%`, background: track.color }} />
                    </div>
                    <span className="bar-row__val">{track.done}/{track.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="section__head">
          <div>
            <h2>各阶段掌握度</h2>
            <p>按「该阶段内已答对的题目数 / 总题目数」计算，反映真实的理解程度而不只是勾选。</p>
          </div>
        </div>
        <div className="panel">
          <div className="panel__body">
            <div className="bar-list">
              {model.stageBars.map((bar) => (
                <div className="bar-row" key={bar.stage.id}>
                  <a className="bar-row__label" href={`#/stage/${bar.stage.id}`}>{bar.label}</a>
                  <div className="bar-row__track">
                    <i style={{ width: `${bar.percent}%` }} />
                  </div>
                  <span className="bar-row__val">{bar.right}/{bar.total}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <div>
            <h2>待攻克题目</h2>
            <p>这些题你还没有答对。点进去重做一遍，比从头再看一遍有效得多。</p>
          </div>
        </div>
        <div className="panel">
          <div className="panel__body">
            {model.wrongList.length ? (
              <div className="list-stack">
                {model.wrongList.map(({ task, lesson, stage, attempts }) => (
                  <a className="lesson-row" href={`#/lesson/${lesson.id}`} key={task.id}>
                    <span className="lesson-row__num">{stage.appendix ? 'A' : String(stage.index)}</span>
                    <div>
                      <div className="lesson-row__title">{taskLabel(task)}</div>
                      <div className="lesson-row__sub">
                        {task.kind === 'design'
                          ? `${lesson.title} · 自检清单未完成`
                          : `${lesson.title} · 已尝试 ${attempts} 次`}
                      </div>
                    </div>
                    <span className="badge badge--rose">重做</span>
                  </a>
                ))}
              </div>
            ) : (
              <div className="empty-state">目前没有待攻克的题目——要么你还没开始，要么你已经全部答对了。</div>
            )}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <div>
            <h2>项目进度</h2>
            <p>每个阶段的实战项目。项目的完成度比课程勾选更能说明你能不能真的交付。</p>
          </div>
        </div>
        <div className="list-stack">
          {model.projects.map(({ project, done, total, percent }) => (
            <a
              className="panel"
              href={`#/project/${project.id}`}
              key={project.id}
              style={{ display: 'block', padding: '16px 18px', textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 14.5 }}>{project.title}</strong>
                <span className={`badge ${percent === 100 ? 'badge--teal' : 'badge--muted'}`}>{done}/{total}</span>
              </div>
              <div className="stage-card__bar" style={{ marginTop: 10 }}>
                <i style={{ width: `${percent}%` }} />
              </div>
            </a>
          ))}
        </div>
      </section>

      {model.nextUp.length ? (
        <section className="section">
          <div className="panel">
            <div className="panel__head">
              <h3>接下来学什么</h3>
            </div>
            <div className="panel__body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {model.nextUp.map((lesson) => (
                <a className="btn btn--ghost btn--sm" href={`#/lesson/${lesson.id}`} key={lesson.id}>
                  {lesson.title}
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
