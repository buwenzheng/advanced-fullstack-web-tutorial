import { describe, expect, it } from 'vitest';
import { mapLegacyId, migrateDraftMap, migrateLegacyIds } from '../state/migrate.js';
import { remapId } from '../content/id-map.js';

function v1State() {
  return {
    q: {
      's6-l1-c1': { picked: [0], correct: true, attempts: 1, solved: true },
      's6-l2-e1@py': { picked: null, correct: true, attempts: 2, solved: true },
      's0-l1-c1': { picked: [1], correct: true, attempts: 1, solved: true },
    },
    l: {
      's6-l3': { done: true },
      's0-l1': { done: true },
    },
    p: {
      'p-graduation': { m: { g1: true, g2: false } },
      p0: { m: { 'p0-m1': true } },
    },
    meta: { startedAt: 1 },
  };
}

describe('state migrate', () => {
  it('v1：历史 s6→a 再全表 remap 到 v3', () => {
    const migrated = migrateLegacyIds(structuredClone(v1State()));
    expect(Object.keys(migrated.q).sort()).toEqual(['b-bigO-c1', 'b-hash-e1@py', 'm1-http-c1']);
    expect(migrated.l['b-btree']).toEqual({ done: true });
    expect(migrated.l['m1-http']).toEqual({ done: true });
    expect(migrated.p['x-linkhub']).toEqual({ m: { g1: true, g2: false } });
    expect(migrated.p['p-m1-probe']).toEqual({ m: { 'p-m1-probe-m1': true } });
    expect(migrated.meta.version).toBe(3);
    expect(migrated.meta.startedAt).toBe(1);
  });

  it('v2→v3：a* 与 BFF 的 s6 分别 remap', () => {
    const migrated = migrateLegacyIds({
      q: { 'a1-c1': { solved: true }, 's6-l1-check-1': { solved: true }, 's0-l1-check-1': { solved: true } },
      l: { a1: { done: true }, 's6-l1': { done: true }, 's7-l4': { done: true } },
      p: { p2: { m: { 'p2-m1': true } } },
      meta: { version: 2, startedAt: 9 },
    });
    expect(migrated.q['b-bigO-c1']!.solved).toBe(true);
    expect(migrated.q['m3-bff-check-1']!.solved).toBe(true);
    expect(migrated.q['m1-http-check-1']!.solved).toBe(true);
    expect(migrated.l['b-bigO']).toEqual({ done: true });
    expect(migrated.l['m3-bff']).toEqual({ done: true });
    expect(migrated.l['m4-coding-system']).toEqual({ done: true });
    expect(migrated.p['p-m2-api']).toEqual({ m: { 'p-m2-api-m1': true } });
    expect(migrated.meta.version).toBe(3);
  });

  it('迁移幂等', () => {
    const once = migrateLegacyIds(structuredClone(v1State()));
    const twice = migrateLegacyIds(structuredClone(once));
    expect(twice).toEqual(once);
  });

  it('新键优先于旧键', () => {
    const collision = migrateLegacyIds({
      q: { 'a1-c1': { solved: false }, 's6-l1-c1': { solved: true } },
      l: {},
      p: {},
      meta: {},
    });
    expect(collision.q['b-bigO-c1']!.solved).toBe(false);
  });

  it('版本已达 3 时原样返回', () => {
    const state = {
      q: { 's0-l1-c1': { solved: true } },
      l: {},
      p: {},
      meta: { version: 3, startedAt: 1 },
    };
    expect(migrateLegacyIds(state)).toBe(state);
  });

  it('草稿：v1 进度语义下 s6→工具箱；v2 下 s6→BFF', () => {
    const v1Drafts = migrateDraftMap({
      's6-l1': { code: 'old' },
      's6-l4-e1': { code: 'old-ex' },
      's0-l1-ex-1': { code: 'http' },
      unrelated: { code: 'keep' },
    }, 1);
    expect(Object.keys(v1Drafts).sort()).toEqual(['b-bigO', 'b-heap-e1', 'm1-http-ex-1', 'unrelated']);

    const v2Drafts = migrateDraftMap({
      's6-l1': { code: 'bff' },
      's6-l4-e1': { code: 'edge' },
      's0-l1-ex-1': { code: 'http' },
    }, 2);
    expect(Object.keys(v2Drafts).sort()).toEqual(['m1-http-ex-1', 'm3-bff', 'm3-edge-e1']);
    expect(migrateDraftMap(v2Drafts, 2)).toEqual(v2Drafts);
  });

  it('非对象草稿原样返回', () => {
    expect(migrateDraftMap(null)).toBeNull();
    expect(migrateDraftMap('x')).toBe('x');
    expect(migrateDraftMap(['s6-l1'])).toEqual(['s6-l1']);
  });

  it('mapLegacyId 只匹配 s6-l1..l6 的边界', () => {
    expect(mapLegacyId('s6-l1')).toBe('a1');
    expect(mapLegacyId('s6-l6-e2@py')).toBe('a6-e2@py');
    expect(mapLegacyId('s6-l7')).toBe('s6-l7');
    expect(mapLegacyId('s6-l1x')).toBe('s6-l1x');
    expect(mapLegacyId('s0-l1')).toBe('s0-l1');
  });

  it('remapId 不经 historic：s6→m3，p4 里程碑错开到 m6+', () => {
    expect(remapId('s6-l1')).toBe('m3-bff');
    expect(remapId('a1')).toBe('b-bigO');
    expect(remapId('p4-m1')).toBe('p-m3-ship-m6');
    expect(remapId('p3-m1')).toBe('p-m3-ship-m1');
  });

  it('空状态可迁移到 v3', () => {
    const empty = migrateLegacyIds({});
    expect(empty.q).toEqual({});
    expect(empty.l).toEqual({});
    expect(empty.p).toEqual({});
    expect(empty.meta.version).toBe(3);
  });

  it('p3+p4 同时完成时合并到 p-m3-ship（m1 与 m6 并存）', () => {
    const migrated = migrateLegacyIds({
      q: {},
      l: {},
      p: {
        p3: { m: { 'p3-m1': true } },
        p4: { m: { 'p4-m1': true, 'p4-m5': true } },
      },
      meta: { version: 2 },
    });
    expect(migrated.p['p-m3-ship']).toEqual({
      m: { 'p-m3-ship-m1': true, 'p-m3-ship-m6': true, 'p-m3-ship-m10': true },
    });
    expect(migrated.p.p4).toBeUndefined();
  });
});
