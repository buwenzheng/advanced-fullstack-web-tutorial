import { useState } from 'react';
import { useParams } from 'react-router';
import type { Project } from '../../content/types';
import { store } from '../../state/store';
import { useGraduationId, useProject } from '../data/content';
import { useProgress } from '../hooks/useProgress';
import { RichText } from '../lesson/RichText';
import { MilestoneList } from '../project/MilestoneList';
import { TemplateCard } from '../project/TemplateCard';
import EmptyState from './EmptyState';

function ProjectNote({ projectId }: { projectId: string }) {
  const [value, setValue] = useState(() => store.projectNote(projectId));
  return (
    <div className="aside-card">
      <h3>项目笔记</h3>
      <textarea
        placeholder="记录你的设计决策、踩过的坑、待解决的问题……"
        style={{
          width: '100%',
          minHeight: 170,
          padding: '13px 15px',
          background: 'var(--ink-900)',
          border: '1px solid var(--line)',
          borderRadius: 10,
          fontSize: 13.5,
          lineHeight: 1.8,
          resize: 'vertical',
          outline: 'none',
        }}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          store.setProjectNote(projectId, event.target.value);
        }}
      />
    </div>
  );
}

function RichListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="aside-card">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}><RichText as="span" html={item} /></li>
        ))}
      </ul>
    </div>
  );
}

export function ProjectView({ project }: { project: Project }) {
  useProgress();
  const graduationId = useGraduationId();
  const isGraduation = project.id === graduationId;
  const doneCount = project.milestones.filter((milestone) => (
    store.milestoneDone(project.id, milestone.id)
  )).length;

  return (
    <div className="page">
      <section className="project-hero">
        <span className="eyebrow">{project.stageLabel || '阶段项目'}</span>
        <h1 style={{ marginTop: 8 }}>{project.title}</h1>
        <p>{project.brief}</p>
        <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="badge badge--amber">里程碑进度 {doneCount}/{project.milestones.length}</span>
          {project.stack.map((item) => (
            <span key={item} className="badge badge--muted">{item}</span>
          ))}
        </div>
      </section>

      <div className="split" style={{ marginTop: 28 }}>
        <div className="list-stack">
          {project.goal ? (
            <div className="aside-card">
              <h3>你要交付什么</h3>
              <RichText as="p" html={project.goal} />
            </div>
          ) : null}

          {project.steps?.length ? (
            <div className="aside-card">
              <h3>实施路线</h3>
              <ul>
                {project.steps.map((step) => (
                  <li key={step}><RichText as="span" html={step} /></li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="panel">
            <div className="panel__head">
              <h3>里程碑清单</h3>
              <span className="tiny muted">做完一项就勾上，进度保存在本机</span>
            </div>
            <div className="panel__body">
              <MilestoneList project={project} isGraduation={isGraduation} />
            </div>
          </div>
        </div>

        <aside className="list-stack">
          {project.deliverables?.length ? (
            <RichListCard title="交付物" items={project.deliverables} />
          ) : null}
          {project.checklist?.length ? (
            <RichListCard title="验收自评" items={project.checklist} />
          ) : null}
          {project.stretch?.length ? (
            <RichListCard title="进阶挑战（选做）" items={project.stretch} />
          ) : null}
          <ProjectNote projectId={project.id} />
        </aside>
      </div>

      {project.templates?.length ? (
        <section className="panel" style={{ marginTop: 28 }}>
          <div className="panel__head">
            <h3>答辩模板库</h3>
            <span className="tiny muted">{project.templates.length} 份模板；复制到 docs/ 后逐项填写</span>
          </div>
          <div className="panel__body">
            <div className="template-grid">
              {project.templates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default function ProjectPage() {
  const { projectId = '' } = useParams();
  const project = useProject(projectId);
  if (!project) return <EmptyState text="找不到这个项目。" />;
  return <ProjectView project={project} />;
}
