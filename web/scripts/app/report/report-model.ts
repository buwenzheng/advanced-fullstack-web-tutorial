import type { Check, Exercise, Lesson, Project, Stage } from '../../content/types';
import type { AnswerRecord, ProgressState } from '../../state/store';

export type ReportTask = Check | Exercise;

export interface ReportQuestionEntry {
  task: ReportTask;
  lesson: Lesson;
  stage: Stage;
}

export interface ReportAnswerSummary {
  attempts: number;
  correct: boolean;
  solved: boolean;
}

export interface ReportWrongEntry extends ReportQuestionEntry {
  attempts: number;
}

export interface ReportMasteryValue {
  done: number;
  total: number;
  percent: number;
}

export interface ReportTrack {
  label: string;
  color: string;
  done: number;
  total: number;
  percent: number;
}

export interface ReportStageBar {
  stage: Stage;
  label: string;
  right: number;
  total: number;
  percent: number;
}

export interface ReportProjectEntry {
  project: Project;
  done: number;
  total: number;
  percent: number;
}

export interface ReportModel {
  mastery: ReportMasteryValue;
  answeredCount: number;
  accuracy: number;
  doneMilestones: number;
  totalMilestones: number;
  wrongCount: number;
  codeTracks: ReportTrack[] | null;
  stageBars: ReportStageBar[];
  wrongList: ReportWrongEntry[];
  projects: ReportProjectEntry[];
  nextUp: Lesson[];
}

export interface ReportModelInput {
  state: ProgressState;
  stages: Stage[];
  graduation: Project;
  mastery: ReportMasteryValue;
  stageLabel: (stage: Stage) => string;
  isLessonMastered: (lesson: Lesson) => boolean;
  trackSolved: (task: { id: string }, language: string) => boolean;
  milestoneDone: (projectId: string, milestoneId: string) => boolean;
}

export function taskLabel(task: ReportTask): string {
  if (task.kind === 'mcq') return task.prompt || task.question || '概念检查';
  return task.title || '练习';
}

export function collectTasks(stages: Stage[]): Map<string, ReportQuestionEntry> {
  const map = new Map<string, ReportQuestionEntry>();
  stages.forEach((stage) => {
    stage.lessons.forEach((lesson) => {
      [...lesson.checks, ...lesson.exercises].forEach((task) => {
        map.set(task.id, { task, lesson, stage });
      });
    });
  });
  return map;
}

export function mergeAnswers(
  q: Record<string, AnswerRecord>,
  questionMap: Map<string, ReportQuestionEntry>,
): Map<string, ReportAnswerSummary> {
  const map = new Map<string, ReportAnswerSummary>();
  Object.entries(q).forEach(([rawId, value]) => {
    const id = rawId.split('@')[0]!;
    if (!questionMap.has(id)) return;
    const entry = map.get(id) || { attempts: 0, correct: false, solved: false };
    entry.attempts += value.attempts || 0;
    entry.correct = entry.correct || Boolean(value.correct);
    entry.solved = entry.solved || Boolean(value.solved);
    map.set(id, entry);
  });
  return map;
}

export function buildReportModel(input: ReportModelInput): ReportModel {
  const {
    state,
    stages,
    graduation,
    mastery,
    stageLabel,
    isLessonMastered,
    trackSolved,
    milestoneDone,
  } = input;

  const questionMap = collectTasks(stages);
  const answeredMap = mergeAnswers(state.q, questionMap);
  const answered = [...answeredMap.entries()].filter(([, value]) => value.attempts > 0);
  const answeredCorrect = answered.filter(([, value]) => value.solved).length;
  const accuracy = answered.length ? Math.round((answeredCorrect / answered.length) * 100) : 0;
  const wrongList: ReportWrongEntry[] = answered
    .filter(([, value]) => !value.solved)
    .map(([id, value]) => {
      const entry = questionMap.get(id)!;
      return { ...entry, attempts: value.attempts };
    });

  const codeTasks = [...questionMap.values()]
    .map((entry) => entry.task)
    .filter((task) => task.kind === 'code' && task.python);
  const lane = (label: string, color: string, language: string): ReportTrack => {
    const done = codeTasks.filter((task) => trackSolved(task, language)).length;
    return {
      label,
      color,
      done,
      total: codeTasks.length,
      percent: Math.round((done / codeTasks.length) * 100),
    };
  };
  const codeTracks = codeTasks.length
    ? [lane('Node.js 轨道', 'var(--teal)', 'javascript'), lane('Python 轨道', 'var(--blue)', 'python')]
    : null;

  const stageBars: ReportStageBar[] = stages.map((stage) => {
    const ids = [...new Set(stage.lessons.flatMap((lesson) => (
      [...lesson.checks, ...lesson.exercises].map((task) => task.id)
    )))];
    const total = ids.length;
    const right = ids.filter((id) => answeredMap.get(id)?.solved).length;
    return {
      stage,
      label: stage.appendix ? stage.title : `${stageLabel(stage)} · ${stage.title}`,
      right,
      total,
      percent: total ? Math.round((right / total) * 100) : 0,
    };
  });

  const projectEntries: Project[] = [
    ...stages.map((stage) => stage.project).filter((project): project is Project => Boolean(project)),
    graduation,
  ];
  const projects: ReportProjectEntry[] = projectEntries.map((project) => {
    const total = project.milestones.length;
    const done = project.milestones.filter((milestone) => milestoneDone(project.id, milestone.id)).length;
    return { project, done, total, percent: total ? Math.round((done / total) * 100) : 0 };
  });
  const totalMilestones = projects.reduce((sum, entry) => sum + entry.total, 0);
  const doneMilestones = projects.reduce((sum, entry) => sum + entry.done, 0);

  const allLessons = stages.flatMap((stage) => stage.lessons);
  const nextUp = allLessons.filter((lesson) => !isLessonMastered(lesson)).slice(0, 3);

  return {
    mastery,
    answeredCount: answered.length,
    accuracy,
    doneMilestones,
    totalMilestones,
    wrongCount: wrongList.length,
    codeTracks,
    stageBars,
    wrongList,
    projects,
    nextUp,
  };
}
