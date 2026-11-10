import type { AnswerRecord, LessonRecord, ProgressState, ProjectRecord } from './store.js';

const LEGACY_LESSON = /^s6-l([1-6])(?=$|[-@])/;

export interface LegacyProgressState {
  q?: Record<string, Partial<AnswerRecord>>;
  l?: Record<string, Partial<LessonRecord>>;
  p?: Record<string, Partial<ProjectRecord>>;
  meta?: { version?: number; startedAt?: number; [key: string]: unknown };
}

export type DraftMap = Record<string, unknown>;

export function mapLegacyId(id: string): string {
  return typeof id === 'string' ? id.replace(LEGACY_LESSON, 'a$1') : id;
}

function remapKeys<T>(source: Record<string, T> | undefined, mapper: (key: string) => string): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [key, value] of Object.entries(source || {})) {
    const nextKey = mapper(key);
    if (nextKey === key || !(nextKey in result)) result[nextKey] = value;
  }
  return result;
}

export function migrateLegacyIds(state: ProgressState): ProgressState;
export function migrateLegacyIds(state: LegacyProgressState): ProgressState;
export function migrateLegacyIds(state: LegacyProgressState): ProgressState {
  if (!state || typeof state !== 'object') return state as ProgressState;
  if ((state.meta?.version ?? 0) >= 2) return state as ProgressState;
  state.q = remapKeys(state.q, mapLegacyId) as Record<string, Partial<AnswerRecord>>;
  state.l = remapKeys(state.l, mapLegacyId) as Record<string, Partial<LessonRecord>>;
  state.p = { ...(state.p || {}) };
  state.meta = { ...(state.meta || {}), version: 2 };
  return state as ProgressState;
}

export function migrateDraftMap(drafts: DraftMap): DraftMap;
export function migrateDraftMap(drafts: unknown): unknown;
export function migrateDraftMap(drafts: unknown): unknown {
  if (!drafts || typeof drafts !== 'object' || Array.isArray(drafts)) return drafts;
  return remapKeys(drafts as DraftMap, mapLegacyId);
}
