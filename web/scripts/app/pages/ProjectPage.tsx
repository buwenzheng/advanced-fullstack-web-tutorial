import { useParams } from 'react-router';
import { findProject, graduationProject } from '../../content/index';
import EmptyState from './EmptyState';

export default function ProjectPage() {
  const { projectId = '' } = useParams();
  const project = findProject(projectId);
  if (!project) return <EmptyState text="找不到这个项目。" />;

  const isGraduation = project.id === graduationProject.id;

  return (
    <div className="page">
      <section className="project-hero">
        <span className="eyebrow">{isGraduation ? '毕业项目' : '阶段项目'}</span>
        <h1 style={{ marginTop: 8 }}>{project.title}</h1>
        <p>{project.brief}</p>
        <div style={{ marginTop: 16 }}>
          <span className="badge badge--amber">{project.milestones.length} 个里程碑</span>
        </div>
      </section>

      <div className="aside-card" style={{ marginTop: 24 }}>
        <h3>正文迁移中</h3>
        <p>项目正文、里程碑清单与验收交互将在 E3 迁移；E2 先保证路由与导航稳定。</p>
      </div>
    </div>
  );
}
