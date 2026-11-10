import { assembleContent, normalizeProject } from './assemble.js';
import { graduationProject as rawGraduationProject } from './graduation.js';
import { stageInputs } from './sources.js';
import type { Lesson, Project, PythonBlockMap, PythonTrackMap, Stage } from './types.js';

export const curriculum: Stage[] = assembleContent(stageInputs);

export const allLessons: Lesson[] = curriculum.flatMap((stage) => stage.lessons);

export function lessonById(id: string): Lesson | null {
  return allLessons.find((lesson) => lesson.id === id) || null;
}

export function stageById(id: string): Stage | null {
  return curriculum.find((stage) => stage.id === id) || null;
}

export function stageLabel(stage: Stage | null): string {
  if (!stage) return '';
  return stage.appendix ? '附录' : `阶段 ${stage.index}`;
}

export const graduationProject: Project = normalizeProject(rawGraduationProject)!;

export function findProject(id: string): Project | null {
  if (id === graduationProject.id) return graduationProject;
  for (const stage of curriculum) {
    if (stage.project?.id === id) return stage.project;
  }
  return null;
}

export const PYTHON_BLOCKS: PythonBlockMap = Object.assign(
  {},
  ...stageInputs.map((input) => input.pythonBlocks),
);

export const PYTHON_TRACKS: PythonTrackMap = Object.assign(
  {},
  ...stageInputs.map((input) => input.pythonTracks),
);
