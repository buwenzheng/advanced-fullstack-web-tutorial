import type { AnswerRecord, LessonRecord, ProgressState, ProjectRecord } from './store.js';
import { mapHistoricAppendixId, remapId } from '../content/id-map.js';

export interface LegacyProgressState {
  q?: Record<string, Partial<AnswerRecord>>;
  l?: Record<string, Partial<LessonRecord>>;
  p?: Record<string, Partial<ProjectRecord>>;
  meta?: { version?: number; startedAt?: number; [key: string]: unknown };
}

export type DraftMap = Record<string, unknown>;

/** @deprecated 使用 mapHistoricAppendixId；保留导出供旧测试/脚本 */
export function mapLegacyId(id: string): string {
  return mapHistoricAppendixId(id);
}

function remapKeys<T>(source: Record<string, T> | undefined, mapper: (key: string) => string): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [key, value] of Object.entries(source || {})) {
    const nextKey = mapper(key);
    if (nextKey === key || !(nextKey in result)) result[nextKey] = value;
  }
  return result;
}

function mergeProjectRecords(
  a: Partial<ProjectRecord> | undefined,
  b: Partial<ProjectRecord> | undefined,
): Partial<ProjectRecord> {
  const left = a || {};
  const right = b || {};
  const milestones: Record<string, boolean> = { ...(left.m || {}) };
  for (const [id, done] of Object.entries(right.m || {})) {
    milestones[id] = Boolean(milestones[id]) || Boolean(done);
  }
  const notes: Record<string, string> = { ...(left.notes || {}) };
  for (const [id, note] of Object.entries(right.notes || {})) {
    if (!(id in notes)) notes[id] = note;
  }
  const out: Partial<ProjectRecord> = { m: milestones };
  if (left.note || right.note) out.note = left.note || right.note;
  if (Object.keys(notes).length) out.notes = notes;
  return out;
}

function remapProjectMap(source: Record<string, Partial<ProjectRecord>> | undefined): Record<string, Partial<ProjectRecord>> {
  const result: Record<string, Partial<ProjectRecord>> = {};
  for (const [key, value] of Object.entries(source || {})) {
    const nextKey = remapId(key);
    const remappedMilestones = remapKeys(value?.m, remapId);
    const remappedNotes = value?.notes ? remapKeys(value.notes, remapId) : undefined;
    const nextValue: Partial<ProjectRecord> = {
      ...value,
      m: remappedMilestones,
      ...(remappedNotes ? { notes: remappedNotes } : {}),
    };
    result[nextKey] = nextKey in result ? mergeProjectRecords(result[nextKey], nextValue) : nextValue;
  }
  return result;
}

function migrateToV2(state: LegacyProgressState): LegacyProgressState {
  if ((state.meta?.version ?? 0) >= 2) return state;
  state.q = remapKeys(state.q, mapHistoricAppendixId) as Record<string, Partial<AnswerRecord>>;
  state.l = remapKeys(state.l, mapHistoricAppendixId) as Record<string, Partial<LessonRecord>>;
  state.p = { ...(state.p || {}) };
  state.meta = { ...(state.meta || {}), version: 2 };
  return state;
}

function migrateToV3(state: LegacyProgressState): LegacyProgressState {
  if ((state.meta?.version ?? 0) >= 3) return state;
  state.q = remapKeys(state.q, remapId) as Record<string, Partial<AnswerRecord>>;
  state.l = remapKeys(state.l, remapId) as Record<string, Partial<LessonRecord>>;
  state.p = remapProjectMap(state.p);
  state.meta = { ...(state.meta || {}), version: 3 };
  return state;
}

export function migrateLegacyIds(state: ProgressState): ProgressState;
export function migrateLegacyIds(state: LegacyProgressState): ProgressState;
export function migrateLegacyIds(state: LegacyProgressState): ProgressState {
  if (!state || typeof state !== 'object') return state as ProgressState;
  const version = state.meta?.version ?? 0;
  if (version >= 3) return state as ProgressState;

  let next = state;
  if (version < 2) next = migrateToV2(next);
  if ((next.meta?.version ?? 0) < 3) next = migrateToV3(next);
  return next as ProgressState;
}

/**
 * 草稿无独立 version：跟随进度原始 version。
 * rawProgressVersion < 2：先 s6→a 再 remap；≥2：只 remap（s6 为 BFF → m3-*）。
 */
export function migrateDraftMap(drafts: DraftMap, rawProgressVersion?: number): DraftMap;
export function migrateDraftMap(drafts: unknown, rawProgressVersion?: number): unknown;
export function migrateDraftMap(drafts: unknown, rawProgressVersion = 2): unknown {
  if (!drafts || typeof drafts !== 'object' || Array.isArray(drafts)) return drafts;
  let next = drafts as DraftMap;
  if (rawProgressVersion < 2) {
    next = remapKeys(next, mapHistoricAppendixId);
  }
  return remapKeys(next, remapId);
}
