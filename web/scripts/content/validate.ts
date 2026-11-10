import { assembleContent } from './assemble.js';
import type {
  Block,
  Lesson,
  LessonData,
  Project,
  Stage,
  StageInput,
} from './types.js';

export interface ContentStats {
  stages: number;
  lessons: number;
  projects: number;
  checks: number;
  exercises: number;
  tasks: number;
  pythonLessons: number;
  pythonBlocks: number;
  pythonTracks: number;
  milestones: number;
  templates: number;
  duration: number;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

const EXPECTED = {
  stages: 9,
  lessons: 45,
  projects: 9,
  checks: 135,
  exercises: 79,
  tasks: 214,
  pythonLessons: 34,
  pythonBlocks: 60,
  pythonTracks: 38,
  milestones: 54,
  templates: 6,
  duration: 3400,
  codeBlocks: 74,
};

const STAGE_IDS = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 'appendix'];
const BLOCK_TYPES = new Set([
  'text',
  'analogy',
  'pitfall',
  'note',
  'tip',
  'list',
  'steps',
  'code',
  'table',
  'compare',
  'flow',
  'case',
]);
const CODE_LANGS = new Set(['javascript', 'bash', 'sql', 'dockerfile']);
const DETAIL_FIELDS = ['delivery', 'acceptance', 'evidence', 'reuse', 'related'] as const;

interface ManifestLesson {
  id: string;
  duration: number;
}
interface ManifestStage {
  id: string;
  index: number;
  duration: number;
  lessons: ManifestLesson[];
}
interface ManifestShape {
  stages: ManifestStage[];
  appendix: { id: string; duration: number; lessons: string[] };
  totals: { lessons: number; coreMinutes: number; appendixMinutes: number; minutes: number };
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  if (a && b && typeof a === 'object') {
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every(
      (key, index) => key === rightKeys[index] && deepEqual(left[key], right[key]),
    );
  }
  return false;
}

function legacyAttach(
  lesson: LessonData,
  mapping: Array<{ code: string; note: string }>,
): Block[] {
  let codeIndex = 0;
  return lesson.blocks.map((block) => {
    if (block.type !== 'code') return block;
    const entry = mapping[codeIndex];
    codeIndex += 1;
    if (!entry || (block.lang || 'javascript') !== 'javascript') return block;
    return { ...block, python: entry.code, pythonNote: entry.note };
  });
}

function nonEmpty(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateContent(
  inputs: readonly StageInput[],
  graduation: Project,
  manifest: unknown,
): { stats: ContentStats; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const add = (path: string, message: string) => {
    issues.push({ path, message });
  };

  const rawLessons: Array<{ lesson: LessonData; stageId: string }> = [];
  for (const input of inputs) {
    for (const lesson of input.data.lessons) {
      rawLessons.push({ lesson, stageId: input.data.id });
    }
  }
  const rawProjects: Project[] = [];
  for (const input of inputs) {
    if (input.data.project) rawProjects.push(input.data.project);
  }

  const pyBlockEntries = inputs.flatMap((input) => Object.values(input.pythonBlocks));
  const pyTracks = inputs.flatMap((input) => Object.values(input.pythonTracks));

  const stats: ContentStats = {
    stages: inputs.length,
    lessons: rawLessons.length,
    projects: rawProjects.length + 1,
    checks: rawLessons.reduce((sum, { lesson }) => sum + lesson.checks.length, 0),
    exercises: rawLessons.reduce((sum, { lesson }) => sum + lesson.exercises.length, 0),
    tasks:
      rawLessons.reduce((sum, { lesson }) => sum + lesson.checks.length, 0) +
      rawLessons.reduce((sum, { lesson }) => sum + lesson.exercises.length, 0),
    pythonLessons: inputs.reduce((sum, input) => sum + Object.keys(input.pythonBlocks).length, 0),
    pythonBlocks: pyBlockEntries.reduce((sum, entries) => sum + entries.length, 0),
    pythonTracks: pyTracks.length,
    milestones:
      rawProjects.reduce((sum, project) => sum + project.milestones.length, 0) +
      graduation.milestones.length,
    templates: Array.isArray(graduation.templates) ? graduation.templates.length : 0,
    duration: rawLessons.reduce((sum, { lesson }) => sum + (lesson.duration || 0), 0),
  };

  /* 1. 总量 */
  const totals: Array<[keyof typeof EXPECTED, number, string]> = [
    ['stages', stats.stages, '阶段'],
    ['lessons', stats.lessons, '课时'],
    ['projects', stats.projects, '项目'],
    ['checks', stats.checks, '检查题'],
    ['exercises', stats.exercises, '练习'],
    ['tasks', stats.tasks, '题目'],
    ['pythonLessons', stats.pythonLessons, 'Python 映射课时'],
    ['pythonBlocks', stats.pythonBlocks, 'Python 代码块'],
    ['pythonTracks', stats.pythonTracks, 'Python 轨道'],
    ['milestones', stats.milestones, '里程碑'],
    ['templates', stats.templates, '模板'],
    ['duration', stats.duration, '总时长'],
  ];
  for (const [key, actual, label] of totals) {
    if (actual !== EXPECTED[key]) add('content', `${label}应为 ${EXPECTED[key]}，实际 ${actual}`);
  }

  /* 2. 阶段 */
  const stageIds = new Set<string>();
  const stageIndexes = new Set<number>();
  inputs.forEach((input, position) => {
    const stage = input.data;
    if (stageIds.has(stage.id)) add(`stage.${stage.id}`, '阶段 ID 重复');
    stageIds.add(stage.id);
    if (stageIndexes.has(stage.index)) add(`stage.${stage.id}`, '阶段 index 重复');
    stageIndexes.add(stage.index);
    if (stage.id !== STAGE_IDS[position]) {
      add(`stage.${stage.id}`, `阶段顺序应为 ${STAGE_IDS[position]}，实际 ${stage.id}`);
    }
    if (stage.index !== position) {
      add(`stage.${stage.id}`, `index 应为 ${position}，实际 ${stage.index}`);
    }
    const isLast = position === inputs.length - 1;
    if (stage.appendix && !isLast) add(`stage.${stage.id}`, '附录阶段必须位于最后');
    if (stage.id === 'appendix' && !stage.appendix) add(`stage.${stage.id}`, '附录阶段必须标记 appendix');
    if (stage.appendix) {
      if (stage.project !== null) add(`stage.${stage.id}`, '附录阶段项目应为 null');
    } else if (stage.project === null) {
      add(`stage.${stage.id}`, '核心阶段必须有项目');
    }
  });

  /* 3-6. 课时、检查题、练习、区块 */
  const lessonIds = new Set<string>();
  const taskIds = new Set<string>();
  let codeBlockCount = 0;
  for (const { lesson, stageId } of rawLessons) {
    const where = `lesson.${lesson.id}`;
    if (lessonIds.has(lesson.id)) add(where, '课时 ID 重复');
    lessonIds.add(lesson.id);
    if (lesson.checks.length !== 3) add(where, `检查题应为 3 道，实际 ${lesson.checks.length}`);
    if (lesson.exercises.length < 1 || lesson.exercises.length > 3) {
      add(where, `练习应为 1-3 道，实际 ${lesson.exercises.length}`);
    }
    if (!Number.isInteger(lesson.duration) || lesson.duration <= 0) add(where, '时长必须为正整数');
    if (lesson.status !== 'ready') add(where, `status 应为 ready，实际 ${lesson.status}`);

    lesson.checks.forEach((check, index) => {
      const checkWhere = `${where}.checks[${index}]`;
      if (taskIds.has(check.id)) add(checkWhere, `题目 ID 重复：${check.id}`);
      taskIds.add(check.id);
      if (!nonEmpty(check.tag)) add(checkWhere, 'tag 为空');
      if (!nonEmpty(check.explain)) add(checkWhere, 'explain 为空');
      if (check.prompt !== check.question) add(checkWhere, 'prompt 与 question 必须一致');
      const correct = check.options.filter((option) => option.correct).length;
      if (check.type === 'single') {
        if (check.options.length !== 4) add(checkWhere, `单选题应有 4 个选项，实际 ${check.options.length}`);
        if (correct !== 1) add(checkWhere, `单选题应有 1 个正确，实际 ${correct}`);
      } else if (check.type === 'multi') {
        if (check.options.length < 4 || check.options.length > 6) {
          add(checkWhere, `多选题应有 4-6 个选项，实际 ${check.options.length}`);
        }
        if (correct < 3 || correct > 5) add(checkWhere, `多选题应有 3-5 个正确，实际 ${correct}`);
      } else {
        add(checkWhere, `未知题型 ${(check as { type: string }).type}`);
      }
      if (correct === check.options.length) add(checkWhere, '至少需要 1 个错误选项');
    });

    lesson.exercises.forEach((task, index) => {
      const taskWhere = `${where}.exercises[${index}]`;
      if (taskIds.has(task.id)) add(taskWhere, `题目 ID 重复：${task.id}`);
      taskIds.add(task.id);
      if (task.kind === 'code') {
        if (!nonEmpty(task.hint)) add(taskWhere, 'code 练习缺少 hint');
        if (task.tests.length < 1) add(taskWhere, 'code 练习缺少测试');
      } else if (task.kind === 'design') {
        const hasBrief = nonEmpty(task.brief);
        const hasPrompt = nonEmpty(task.prompt);
        if (hasBrief === hasPrompt) add(taskWhere, 'design 必须且只能有 brief/prompt 之一');
      } else if (task.kind === 'sql') {
        if (!Array.isArray(task.expected)) add(taskWhere, 'sql expected 必须为数组');
        if (!nonEmpty(task.query)) add(taskWhere, 'sql query 为空');
        if (!nonEmpty(task.solution)) add(taskWhere, 'sql solution 为空');
      } else {
        add(taskWhere, `未知练习类型 ${(task as { kind: string }).kind}`);
      }
    });

    lesson.blocks.forEach((block, index) => {
      const blockWhere = `${where}.blocks[${index}]`;
      if (!BLOCK_TYPES.has(block.type)) add(blockWhere, `未知区块类型 ${(block as { type: string }).type}`);
      if (block.type === 'table') {
        block.rows.forEach((row, rowIndex) => {
          if (row.length !== block.head.length) {
            add(`${blockWhere}.rows[${rowIndex}]`, `列数 ${row.length} 与表头 ${block.head.length} 不一致`);
          }
        });
      }
      if (block.type === 'compare' && block.cols.length < 2) add(blockWhere, 'compare 至少 2 列');
      if ((block.type === 'steps' || block.type === 'flow') && block.steps.length === 0) {
        add(blockWhere, `${block.type} 不能为空`);
      }
      if (block.type === 'code') {
        codeBlockCount += 1;
        if (!CODE_LANGS.has(block.lang)) add(blockWhere, `未知代码语言 ${block.lang}`);
      }
    });

    if (!stageId) add(where, '缺少 stageId');
  }
  if (codeBlockCount !== EXPECTED.codeBlocks) {
    add('content', `代码块应为 ${EXPECTED.codeBlocks}，实际 ${codeBlockCount}`);
  }

  /* 7. Python 对齐 */
  const lessonsById = new Map(rawLessons.map(({ lesson }) => [lesson.id, lesson]));
  const codeExerciseIds = new Set<string>();
  for (const { lesson } of rawLessons) {
    for (const task of lesson.exercises) {
      if (task.kind === 'code') codeExerciseIds.add(task.id);
    }
  }
  const trackIds = new Set<string>();
  for (const input of inputs) {
    for (const [lessonId, entries] of Object.entries(input.pythonBlocks)) {
      const lesson = lessonsById.get(lessonId);
      if (!lesson) {
        add(`python.${lessonId}`, '映射键未命中任何课时');
        continue;
      }
      const jsBlocks = lesson.blocks.filter(
        (block) => block.type === 'code' && (block.lang || 'javascript') === 'javascript',
      );
      if (entries.length !== jsBlocks.length) {
        add(`python.${lessonId}`, `映射 ${entries.length} 条，JS 代码块 ${jsBlocks.length} 个`);
      }
      entries.forEach((entry, index) => {
        if (!nonEmpty(entry.code)) add(`python.${lessonId}[${index}]`, 'code 为空');
        if (!nonEmpty(entry.note)) add(`python.${lessonId}[${index}]`, 'note 为空');
      });
    }
    for (const [taskId, track] of Object.entries(input.pythonTracks)) {
      trackIds.add(taskId);
      if (!codeExerciseIds.has(taskId)) add(`pythonTrack.${taskId}`, '轨道没有对应的代码练习');
      if (!nonEmpty(track.starter)) add(`pythonTrack.${taskId}`, 'starter 为空');
      if (!nonEmpty(track.solution)) add(`pythonTrack.${taskId}`, 'solution 为空');
      if (track.tests.length < 1) add(`pythonTrack.${taskId}`, 'tests 为空');
    }
  }
  for (const id of codeExerciseIds) {
    if (!trackIds.has(id)) add(`pythonTrack.${id}`, '代码练习缺少 Python 轨道');
  }

  /* 8. 项目 */
  const projectIds = new Set<string>();
  for (const project of [...rawProjects, graduation]) {
    if (projectIds.has(project.id)) add(`project.${project.id}`, '项目 ID 重复');
    projectIds.add(project.id);
    const milestoneIds = new Set<string>();
    project.milestones.forEach((milestone, index) => {
      if (milestoneIds.has(milestone.id)) {
        add(`project.${project.id}.milestones[${index}]`, `里程碑 ID 重复 ${milestone.id}`);
      }
      milestoneIds.add(milestone.id);
    });
  }
  if (graduation.milestones.length !== 11) {
    add('project.p-graduation', `毕业项目应有 11 个里程碑，实际 ${graduation.milestones.length}`);
  }
  graduation.milestones.forEach((milestone, index) => {
    for (const field of DETAIL_FIELDS) {
      if (milestone[field] === undefined) {
        add(`project.p-graduation.milestones[${index}]`, `缺少详细字段 ${field}`);
      }
    }
  });
  for (const project of rawProjects) {
    project.milestones.forEach((milestone, index) => {
      for (const field of DETAIL_FIELDS) {
        if (milestone[field] !== undefined) {
          add(`project.${project.id}.milestones[${index}]`, `阶段项目里程碑不应包含 ${field}`);
        }
      }
    });
    if (project.templates !== undefined) add(`project.${project.id}`, '只有毕业项目可以包含 templates');
  }
  if (!Array.isArray(graduation.templates) || graduation.templates.length !== EXPECTED.templates) {
    add('project.p-graduation', `模板应为 ${EXPECTED.templates} 份`);
  }

  /* 9. 清单 */
  const doc = manifest as ManifestShape | null;
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.stages) || !doc.totals) {
    add('manifest', '清单结构无效');
  } else {
    const coreStages = inputs.filter((input) => !input.data.appendix);
    if (doc.stages.length !== coreStages.length) {
      add('manifest.stages', `核心阶段数 ${doc.stages.length} 与内容 ${coreStages.length} 不一致`);
    }
    doc.stages.forEach((manifestStage, position) => {
      const stage = coreStages[position]?.data;
      if (!stage) return;
      if (manifestStage.id !== stage.id) add(`manifest.stages[${position}]`, `阶段 ID 应为 ${stage.id}`);
      if (manifestStage.duration !== stage.duration) {
        add(`manifest.stages[${position}]`, `时长 ${manifestStage.duration} 与内容 ${stage.duration} 不一致`);
      }
      const actualLessons = stage.lessons.map((lesson) => lesson.id);
      const manifestLessons = manifestStage.lessons.map((lesson) => lesson.id);
      if (actualLessons.join(',') !== manifestLessons.join(',')) {
        add(`manifest.${stage.id}`, '课时 ID/顺序与内容不一致');
      }
      for (const entry of manifestStage.lessons) {
        const lesson = stage.lessons.find((item) => item.id === entry.id);
        if (lesson && lesson.duration !== entry.duration) {
          add(`manifest.${entry.id}`, `时长 ${entry.duration} 与内容 ${lesson.duration} 不一致`);
        }
      }
    });
    const appendix = inputs.find((input) => input.data.appendix);
    if (!appendix) {
      add('manifest.appendix', '缺少附录阶段');
    } else {
      const actualIds = appendix.data.lessons.map((lesson) => lesson.id);
      if (doc.appendix.lessons.join(',') !== actualIds.join(',')) {
        add('manifest.appendix', '附录课时 ID/顺序与内容不一致');
      }
      const appendixMinutes = appendix.data.lessons.reduce(
        (sum, lesson) => sum + (lesson.duration || 0),
        0,
      );
      if (doc.appendix.duration !== appendixMinutes) {
        add('manifest.appendix', `时长 ${doc.appendix.duration} 与内容 ${appendixMinutes} 不一致`);
      }
    }
    const coreMinutes = coreStages.reduce(
      (sum, input) =>
        sum + input.data.lessons.reduce((stageSum, lesson) => stageSum + (lesson.duration || 0), 0),
      0,
    );
    const appendixMinutes = inputs
      .filter((input) => input.data.appendix)
      .reduce(
        (sum, input) =>
          sum + input.data.lessons.reduce((stageSum, lesson) => stageSum + (lesson.duration || 0), 0),
        0,
      );
    if (doc.totals.lessons !== rawLessons.length) add('manifest.totals', 'lessons 不一致');
    if (doc.totals.minutes !== stats.duration) add('manifest.totals', 'minutes 不一致');
    if (doc.totals.coreMinutes !== coreMinutes) add('manifest.totals', 'coreMinutes 不一致');
    if (doc.totals.appendixMinutes !== appendixMinutes) {
      add('manifest.totals', 'appendixMinutes 不一致');
    }
  }

  /* 10. 引用 */
  for (const project of [...rawProjects, graduation]) {
    project.milestones.forEach((milestone, index) => {
      if (!milestone.reuse) return;
      for (const target of milestone.reuse) {
        if (!projectIds.has(target)) {
          add(`project.${project.id}.milestones[${index}]`, `reuse 指向不存在的项目 ${target}`);
        }
      }
    });
  }

  /* §7.3 旧 Python 算法等价守卫 */
  let stages: Stage[] | null = null;
  try {
    stages = assembleContent(inputs);
  } catch (error) {
    add('assemble', (error as Error).message);
  }
  if (stages) {
    const assembledLessons = new Map(stages.flatMap((stage) => stage.lessons).map((lesson) => [lesson.id, lesson]));
    for (const input of inputs) {
      for (const lesson of input.data.lessons) {
        const entries = input.pythonBlocks[lesson.id];
        if (!entries) continue;
        const assembled = assembledLessons.get(lesson.id) as Lesson | undefined;
        if (!assembled) continue;
        if (!deepEqual(legacyAttach(lesson, entries), assembled.blocks)) {
          add(`python.${lesson.id}`, '旧 Python 算法与新装配结果不一致');
        }
      }
    }
  }

  return { stats, issues };
}
