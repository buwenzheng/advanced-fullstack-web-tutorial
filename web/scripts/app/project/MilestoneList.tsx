import { useState } from 'react';
import type { Project } from '../../content/types';
import { store } from '../../state/store';
import { useProgress } from '../hooks/useProgress';
import { RichText } from '../lesson/RichText';

type Milestone = Project['milestones'][number];

function MilestoneNote({ projectId, milestoneId }: { projectId: string; milestoneId: string }) {
  const [value, setValue] = useState(() => store.milestoneNote(projectId, milestoneId));
  return (
    <textarea
      className="milestone__note"
      placeholder="记录这个里程碑的证据位置、缺口与下一步……"
      value={value}
      onChange={(event) => {
        setValue(event.target.value);
        store.setMilestoneNote(projectId, milestoneId, event.target.value);
      }}
    />
  );
}

function MilestoneItem({
  project,
  milestone,
  isGraduation,
}: {
  project: Project;
  milestone: Milestone;
  isGraduation: boolean;
}) {
  useProgress();
  const done = store.milestoneDone(project.id, milestone.id);

  return (
    <li className={`milestone${done ? ' is-done' : ''}`}>
      <button
        className="milestone__box"
        type="button"
        aria-label={`标记 ${milestone.title} 完成`}
        onClick={() => store.toggleMilestone(project.id, milestone.id)}
      >
        <svg viewBox="0 0 20 20"><path d="M4 10.5l4 4 8-9" /></svg>
      </button>
      <div>
        {milestone.group ? <span className="badge badge--muted">{milestone.group}</span> : null}
        <div className="milestone__title">{milestone.title}</div>
        <RichText className="milestone__desc" html={milestone.desc} />
        {milestone.delivery ? (
          <div className="milestone__line">
            <b>交付：</b>
            <RichText as="span" html={milestone.delivery} />
          </div>
        ) : null}
        {milestone.acceptance?.length ? (
          <div className="milestone__block">
            <b className="milestone__label">可观察验收</b>
            <ul className="milestone__checks">
              {milestone.acceptance.map((entry) => (
                <li key={entry}><RichText as="span" html={entry} /></li>
              ))}
            </ul>
          </div>
        ) : null}
        {milestone.evidence?.length ? (
          <div className="milestone__block">
            <b className="milestone__label">证据</b>
            <div className="milestone__chips">
              {milestone.evidence.map((entry) => <span key={entry}>{entry}</span>)}
            </div>
          </div>
        ) : null}
        {milestone.reuse?.length || milestone.related?.length ? (
          <div className="milestone__meta">
            {milestone.reuse?.length ? (
              <span className="milestone__links">
                <b>复用：</b>
                {milestone.reuse.map((id, index) => (
                  <span key={id}>
                    {index ? ' / ' : ''}
                    <a href={`#/project/${id}`}>{id}</a>
                  </span>
                ))}
              </span>
            ) : null}
            {milestone.related?.length ? (
              <span className="milestone__links">
                <b>关联：</b>
                {milestone.related.map((entry, index) => (
                  <span key={entry}>
                    {index ? ' / ' : ''}
                    <RichText as="span" html={entry} />
                  </span>
                ))}
              </span>
            ) : null}
          </div>
        ) : null}
        {milestone.criteria ? (
          <RichText className="milestone__crit" html={`一句话验收：${milestone.criteria}`} />
        ) : null}
        {isGraduation ? <MilestoneNote projectId={project.id} milestoneId={milestone.id} /> : null}
      </div>
    </li>
  );
}

export function MilestoneList({ project, isGraduation }: { project: Project; isGraduation: boolean }) {
  return (
    <ul className="milestone-list">
      {project.milestones.map((milestone) => (
        <MilestoneItem
          key={milestone.id}
          project={project}
          milestone={milestone}
          isGraduation={isGraduation}
        />
      ))}
    </ul>
  );
}
