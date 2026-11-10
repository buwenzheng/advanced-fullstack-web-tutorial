import type { Block, Lesson, LessonData, Project, Stage, StageInput } from './types.js';

export function normalizeProject(project: Project | null): Project | null {
  if (!project) return null;
  return {
    ...project,
    goal: project.goal || '',
    stack: project.stack || [],
    steps: project.steps || [],
    milestones: project.milestones || [],
    deliverables: project.deliverables || [],
    checklist: project.checklist || [],
    stretch: project.stretch || [],
  };
}

function assertAlignment(lessonId: string, blocks: Block[], entries: readonly unknown[]): void {
  const jsBlocks = blocks.filter((block) => block.type === 'code' && (block.lang ?? 'javascript') === 'javascript');
  if (entries.length !== jsBlocks.length) {
    throw new Error(
      `[content] ${lessonId}: Python 映射 ${entries.length} 条，JS 代码块 ${jsBlocks.length} 个`,
    );
  }
}

function attachPythonBlocks(lesson: LessonData, input: StageInput): Block[] {
  const entries = input.pythonBlocks[lesson.id];
  if (!entries) return lesson.blocks;
  assertAlignment(lesson.id, lesson.blocks, entries);
  let codeIndex = 0;
  return lesson.blocks.map((block) => {
    if (block.type !== 'code') return block;
    const entry = entries[codeIndex];
    codeIndex += 1;
    if (!entry || (block.lang ?? 'javascript') !== 'javascript') return block;
    return { ...block, python: entry.code, pythonNote: entry.note };
  });
}

function normalizeLesson(lesson: LessonData, stageId: string, input: StageInput): Lesson {
  const blocks = attachPythonBlocks(lesson, input);
  const exercises = lesson.exercises.map((task) => {
    if (task.kind !== 'code') return task;
    const track = input.pythonTracks[task.id];
    if (!track) throw new Error(`[content] ${task.id}: 缺少 Python 轨道`);
    return { ...task, python: track };
  });
  return {
    ...lesson,
    stageId,
    title: lesson.title || '未命名讲次',
    duration: lesson.duration || 30,
    status: lesson.status || 'ready',
    blocks,
    checks: lesson.checks,
    exercises,
  };
}

export function assembleContent(inputs: readonly StageInput[]): Stage[] {
  const stages: Stage[] = inputs.map((input) => ({
    ...input.data,
    lessons: input.data.lessons.map((lesson) => normalizeLesson(lesson, input.data.id, input)),
    project: normalizeProject(input.data.project),
  }));

  const codeTaskIds = new Set<string>();
  for (const stage of stages) {
    for (const lesson of stage.lessons) {
      for (const task of lesson.exercises) {
        if (task.kind === 'code') codeTaskIds.add(task.id);
      }
    }
  }
  const trackIds = new Set(inputs.flatMap((input) => Object.keys(input.pythonTracks)));
  for (const id of trackIds) {
    if (!codeTaskIds.has(id)) {
      throw new Error(`[content] ${id}: Python 轨道没有对应的代码练习`);
    }
  }
  return stages;
}
