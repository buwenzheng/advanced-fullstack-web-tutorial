import type { Project, Stage } from '../../content/types';

/** 多项目块：按章节顺序对齐 projectIds；单项目回退 stage.project */
export function projectForLesson(stage: Stage, lessonId: string): Project | null {
  const projects = stage.projects?.length
    ? stage.projects
    : (stage.project ? [stage.project] : []);
  if (!projects.length) return null;
  if (projects.length === 1) return projects[0]!;

  const chapters = stage.chapters ?? [];
  const chapterIndex = chapters.findIndex((chapter) => chapter.lessonIds.includes(lessonId));
  if (chapterIndex < 0) return projects[0]!;

  const preferredId = stage.projectIds?.[chapterIndex] ?? projects[chapterIndex]?.id;
  return projects.find((project) => project.id === preferredId)
    ?? projects[Math.min(chapterIndex, projects.length - 1)]!;
}
