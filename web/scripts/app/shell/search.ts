import { curriculum, graduationProject, stageLabel } from '../../content/index';
import { lessonHaystack } from '../../content/search';

export type SearchHitType = 'stage' | 'lesson' | 'project';

export interface SearchHit {
  type: SearchHitType;
  title: string;
  sub: string;
  to: string;
}

export function searchCurriculum(query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];

  curriculum.forEach((stage) => {
    if (
      stage.title.toLowerCase().includes(q)
      || (stage.keywords || []).some((keyword) => keyword.toLowerCase().includes(q))
    ) {
      hits.push({
        type: 'stage',
        title: stage.title,
        sub: `${stageLabel(stage)} · ${stage.subtitle}`,
        to: `/stage/${stage.id}`,
      });
    }

    stage.lessons.forEach((lesson) => {
      if (lessonHaystack(lesson).includes(q)) {
        hits.push({
          type: 'lesson',
          title: lesson.title,
          sub: `${stageLabel(stage)} · ${lesson.subtitle || ''}`,
          to: `/lesson/${lesson.id}`,
        });
      }
    });

    if (stage.project && `${stage.project.title} ${stage.project.brief}`.toLowerCase().includes(q)) {
      hits.push({
        type: 'project',
        title: stage.project.title,
        sub: '阶段项目',
        to: `/project/${stage.project.id}`,
      });
    }
  });

  const graduationText = `${graduationProject.title} ${graduationProject.brief} ${(graduationProject.stack || []).join(' ')}`;
  if (graduationText.toLowerCase().includes(q)) {
    hits.push({
      type: 'project',
      title: graduationProject.title,
      sub: '毕业项目',
      to: `/project/${graduationProject.id}`,
    });
  }

  return hits.slice(0, 12);
}
