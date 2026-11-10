import { migrateLegacyIds, migrateDraftMap } from './migrate.js';

const STORAGE_KEY = 'bff-lab-progress-v1';
export const DRAFT_KEY = 'bff-lab-drafts-v1';

export interface AnswerRecord {
  picked: number[] | null;
  correct: boolean;
  attempts: number;
  solved: boolean;
}

export interface LessonRecord {
  done: boolean;
}

export interface ProjectRecord {
  m: Record<string, boolean>;
  note?: string;
  notes?: Record<string, string>;
}

export interface ProgressState {
  q: Record<string, AnswerRecord>;
  l: Record<string, LessonRecord>;
  p: Record<string, ProjectRecord>;
  meta: { version: 2; startedAt: number };
}

function blankState(): ProgressState {
  return {
    q: {},
    l: {},
    p: {},
    meta: { version: 2, startedAt: Date.now() },
  };
}

function read(): ProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return blankState();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return blankState();
    const migrated = migrateLegacyIds(parsed as ProgressState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return { ...blankState(), ...migrated, meta: { ...blankState().meta, ...migrated.meta } };
  } catch {
    return blankState();
  }
}

function migrateDrafts(): void {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    const migrated = migrateDraftMap(parsed);
    if (migrated !== parsed) localStorage.setItem(DRAFT_KEY, JSON.stringify(migrated));
  } catch {
    /* 草稿损坏不影响主进度 */
  }
}

migrateDrafts();
let state = read();
let version = 0;
const listeners = new Set<(state: ProgressState) => void>();

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* 隐私模式下写入失败时仍保留内存态 */
  }
}

function emit(): void {
  version += 1;
  persist();
  listeners.forEach((fn) => fn(state));
}

export const store = {
  subscribe(fn: (state: ProgressState) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  getVersion(): number {
    return version;
  },

  get(): ProgressState {
    return state;
  },

  recordAnswer(questionId: string, picked: number[], correct: boolean): void {
    const prev = state.q[questionId];
    state.q[questionId] = {
      picked,
      correct,
      attempts: (prev?.attempts || 0) + 1,
      solved: Boolean(prev?.solved) || correct,
    };
    emit();
  },

  recordChecklist(questionId: string, checked: number[], total: number): void {
    const prev = state.q[questionId];
    const complete = total > 0 && checked.length === total;
    state.q[questionId] = {
      picked: checked,
      correct: complete,
      attempts: prev?.attempts || 1,
      solved: Boolean(prev?.solved) || complete,
    };
    emit();
  },

  setLessonDone(lessonId: string, done: boolean): void {
    state.l[lessonId] = { done: Boolean(done) };
    emit();
  },

  toggleMilestone(projectId: string, milestoneId: string): boolean {
    const project = state.p[projectId] || (state.p[projectId] = { m: {} });
    project.m[milestoneId] = !project.m[milestoneId];
    emit();
    return project.m[milestoneId];
  },

  setProjectNote(projectId: string, note: string): void {
    const project = state.p[projectId] || (state.p[projectId] = { m: {}, note: '' });
    project.note = note;
    emit();
  },

  reset(): void {
    state = blankState();
    emit();
  },

  answerOf(questionId: string): AnswerRecord | null {
    return state.q[questionId] || null;
  },

  lessonDone(lessonId: string): boolean {
    return Boolean(state.l[lessonId]?.done);
  },

  milestoneDone(projectId: string, milestoneId: string): boolean {
    return Boolean(state.p[projectId]?.m?.[milestoneId]);
  },

  projectNote(projectId: string): string {
    return state.p[projectId]?.note || '';
  },

  milestoneNote(projectId: string, milestoneId: string): string {
    return state.p[projectId]?.notes?.[milestoneId] || '';
  },

  setMilestoneNote(projectId: string, milestoneId: string, note: string): void {
    const project = state.p[projectId] || (state.p[projectId] = { m: {} });
    if (!project.notes) project.notes = {};
    project.notes[milestoneId] = note;
    emit();
  },
};

export function formatDuration(minutes: number): string {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} 分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`;
}
