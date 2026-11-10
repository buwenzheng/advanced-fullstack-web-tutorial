import { migrateLegacyIds, migrateDraftMap } from './migrate.js';

const STORAGE_KEY = 'bff-lab-progress-v1';
const DRAFT_KEY = 'bff-lab-drafts-v1';

function blankState() {
  return {
    q: {},
    l: {},
    p: {},
    meta: { version: 2, startedAt: Date.now() },
  };
}

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return blankState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return blankState();
    const migrated = migrateLegacyIds(parsed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return { ...blankState(), ...migrated, meta: { ...blankState().meta, ...migrated.meta } };
  } catch {
    return blankState();
  }
}

function migrateDrafts() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const migrated = migrateDraftMap(parsed);
    if (migrated !== parsed) localStorage.setItem(DRAFT_KEY, JSON.stringify(migrated));
  } catch {
    /* 草稿损坏不影响主进度 */
  }
}

migrateDrafts();
let state = read();
const listeners = new Set();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* 隐私模式下写入失败时仍保留内存态 */
  }
}

function emit() {
  persist();
  listeners.forEach((fn) => fn(state));
}

export const store = {
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  get() {
    return state;
  },

  recordAnswer(questionId, picked, correct) {
    const prev = state.q[questionId];
    state.q[questionId] = {
      picked,
      correct,
      attempts: (prev?.attempts || 0) + 1,
      solved: Boolean(prev?.solved) || correct,
    };
    emit();
  },

  recordChecklist(questionId, checked, total) {
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

  setLessonDone(lessonId, done) {
    state.l[lessonId] = { done: Boolean(done) };
    emit();
  },

  toggleMilestone(projectId, milestoneId) {
    const project = state.p[projectId] || (state.p[projectId] = { m: {} });
    project.m[milestoneId] = !project.m[milestoneId];
    emit();
    return project.m[milestoneId];
  },

  setProjectNote(projectId, note) {
    const project = state.p[projectId] || (state.p[projectId] = { m: {}, note: '' });
    project.note = note;
    emit();
  },

  reset() {
    state = blankState();
    emit();
  },

  answerOf(questionId) {
    return state.q[questionId] || null;
  },

  lessonDone(lessonId) {
    return Boolean(state.l[lessonId]?.done);
  },

  milestoneDone(projectId, milestoneId) {
    return Boolean(state.p[projectId]?.m?.[milestoneId]);
  },

  projectNote(projectId) {
    return state.p[projectId]?.note || '';
  },

  milestoneNote(projectId, milestoneId) {
    return state.p[projectId]?.notes?.[milestoneId] || '';
  },

  setMilestoneNote(projectId, milestoneId, note) {
    const project = state.p[projectId] || (state.p[projectId] = { m: {} });
    if (!project.notes) project.notes = {};
    project.notes[milestoneId] = note;
    emit();
  },
};

export function formatDuration(minutes) {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} 分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`;
}
