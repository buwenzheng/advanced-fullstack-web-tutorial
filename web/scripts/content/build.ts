import { curriculum, graduationProject, stageLabel } from './index.js';
import { lessonHaystack } from './search.js';
import type { SearchDocument } from './search.js';
import type {
  Catalog,
  CatalogLesson,
  CatalogProject,
  CatalogStage,
  CatalogTask,
} from './catalog.js';
import type { Check, Exercise } from './types.js';

function taskOf(lessonId: string, stageId: string, task: Check | Exercise): CatalogTask {
  if ('kind' in task && task.kind === 'mcq') {
    return {
      id: task.id,
      kind: 'mcq',
      title: task.prompt,
      lessonId,
      stageId,
      python: false,
    };
  }
  const exercise = task as Exercise;
  return {
    id: exercise.id,
    kind: exercise.kind,
    title: exercise.title,
    lessonId,
    stageId,
    python: Boolean(exercise.kind === 'code' && exercise.python),
  };
}

export function buildCatalog(): Catalog {
  const stages: CatalogStage[] = [];
  const lessons: CatalogLesson[] = [];
  const projects: CatalogProject[] = [];
  const tasks: CatalogTask[] = [];

  curriculum.forEach((stage) => {
    stages.push({
      id: stage.id,
      index: stage.index,
      title: stage.title,
      subtitle: stage.subtitle,
      duration: stage.duration,
      appendix: Boolean(stage.appendix),
      lessonCount: stage.lessons.length,
      projectId: stage.project ? stage.project.id : null,
      accent: stage.accent,
    });
    stage.lessons.forEach((lesson) => {
      lessons.push({
        id: lesson.id,
        stageId: stage.id,
        title: lesson.title,
        subtitle: lesson.subtitle,
        duration: lesson.duration,
        status: lesson.status,
        keywords: lesson.keywords,
        checks: lesson.checks.length,
        exercises: lesson.exercises.length,
      });
      lesson.checks.forEach((check) => tasks.push(taskOf(lesson.id, stage.id, check)));
      lesson.exercises.forEach((exercise) => tasks.push(taskOf(lesson.id, stage.id, exercise)));
    });
    if (stage.project) {
      projects.push({
        id: stage.project.id,
        stageLabel: stage.project.stageLabel,
        title: stage.project.title,
        milestones: stage.project.milestones.length,
      });
    }
  });

  projects.push({
    id: graduationProject.id,
    stageLabel: graduationProject.stageLabel,
    title: graduationProject.title,
    milestones: graduationProject.milestones.length,
  });

  return { version: 1, stages, lessons, projects, tasks };
}

export function buildSearchIndex(): SearchDocument[] {
  const docs: SearchDocument[] = [];
  curriculum.forEach((stage) => {
    docs.push({
      kind: 'stage',
      id: stage.id,
      href: `#/stage/${stage.id}`,
      title: stage.title,
      sub: `${stageLabel(stage)} · ${stage.subtitle}`,
      text: [stage.title, ...(stage.keywords || [])].join(' '),
    });
    stage.lessons.forEach((lesson) => {
      docs.push({
        kind: 'lesson',
        id: lesson.id,
        href: `#/lesson/${lesson.id}`,
        title: lesson.title,
        sub: `${stageLabel(stage)} · ${lesson.subtitle || ''}`,
        text: lessonHaystack(lesson),
      });
    });
    if (stage.project) {
      docs.push({
        kind: 'project',
        id: stage.project.id,
        href: `#/project/${stage.project.id}`,
        title: stage.project.title,
        sub: '阶段项目',
        text: `${stage.project.title} ${stage.project.brief}`,
      });
    }
  });
  docs.push({
    kind: 'project',
    id: graduationProject.id,
    href: `#/project/${graduationProject.id}`,
    title: graduationProject.title,
    sub: '毕业项目',
    text: `${graduationProject.title} ${graduationProject.brief} ${(graduationProject.stack || []).join(' ')}`,
  });
  return docs;
}
