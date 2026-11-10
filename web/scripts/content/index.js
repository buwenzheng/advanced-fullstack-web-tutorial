import * as s0 from './stages/s0/index.js';
import * as s1 from './stages/s1/index.js';
import * as s2 from './stages/s2/index.js';
import * as s3 from './stages/s3/index.js';
import * as s4 from './stages/s4/index.js';
import * as s5 from './stages/s5/index.js';
import * as s6 from './stages/s6/index.js';
import * as s7 from './stages/s7/index.js';
import * as appendix from './stages/appendix/index.js';
import { graduationProject as rawGraduationProject } from './graduation.js';

const stageModules = [s0, s1, s2, s3, s4, s5, s6, s7, appendix];

export const PYTHON_BLOCKS = Object.assign(
  {},
  ...stageModules.map((mod) => mod.PYTHON_BLOCKS || {}),
);

export const PYTHON_TRACKS = Object.assign(
  {},
  ...stageModules.map((mod) => mod.PYTHON_TRACKS || {}),
);

function withPythonBlocks(lesson) {
  const mapping = PYTHON_BLOCKS[lesson.id];
  const blocks = Array.isArray(lesson.blocks) ? lesson.blocks : [];
  if (!mapping) return blocks;

  let codeIndex = 0;
  return blocks.map((block) => {
    if (block.type !== 'code') return block;
    const entry = mapping[codeIndex];
    codeIndex += 1;
    if (!entry || (block.lang || 'javascript') !== 'javascript') return block;
    return { ...block, python: entry.code, pythonNote: entry.note };
  });
}

function normalizeLesson(lesson, stage) {
  return {
    ...lesson,
    stageId: stage.id,
    title: lesson.title || '未命名讲次',
    duration: lesson.duration || 30,
    status: lesson.status || 'ready',
    blocks: withPythonBlocks(lesson),
    checks: Array.isArray(lesson.checks) ? lesson.checks : [],
    exercises: (Array.isArray(lesson.exercises) ? lesson.exercises : []).map((task) => (
      task.kind === 'code' && PYTHON_TRACKS[task.id] ? { ...task, python: PYTHON_TRACKS[task.id] } : task
    )),
  };
}

function normalizeProject(project) {
  if (!project) return null;
  return {
    ...project,
    goal: project.goal || '',
    stack: Array.isArray(project.stack) ? project.stack : [],
    steps: Array.isArray(project.steps) ? project.steps : [],
    milestones: Array.isArray(project.milestones) ? project.milestones : [],
    deliverables: Array.isArray(project.deliverables) ? project.deliverables : [],
    checklist: Array.isArray(project.checklist) ? project.checklist : [],
    stretch: Array.isArray(project.stretch) ? project.stretch : [],
  };
}

const rawStages = [
  s0.stage0,
  s1.stage1,
  s2.stage2,
  s3.stage3,
  s4.stage4,
  s5.stage5,
  s6.stage6,
  s7.stage7,
  appendix.stageAppendix,
];

export const curriculum = rawStages.map((stage) => ({
  ...stage,
  lessons: (stage.lessons || []).map((lesson) => normalizeLesson(lesson, stage)),
  project: normalizeProject(stage.project),
}));

const normalizedGraduation = normalizeProject(rawGraduationProject);

export const allLessons = curriculum.flatMap((stage) => stage.lessons);

export function lessonById(id) {
  return allLessons.find((lesson) => lesson.id === id) || null;
}

export function stageById(id) {
  return curriculum.find((stage) => stage.id === id) || null;
}

export function stageLabel(stage) {
  if (!stage) return '';
  return stage.appendix ? '附录' : `阶段 ${stage.index}`;
}

export function findProject(id) {
  if (id === normalizedGraduation.id) return normalizedGraduation;
  for (const stage of curriculum) {
    if (stage.project?.id === id) return stage.project;
  }
  return null;
}

export const graduationProject = normalizedGraduation;
