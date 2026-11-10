import { describe, expect, it } from 'vitest';
import { mapLegacyId, migrateDraftMap, migrateLegacyIds } from '../state/migrate.js';

function legacyState() {
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
  it('迁移旧 s6-l* 键并保留毕业项目里程碑', () => {
    const migrated = migrateLegacyIds(structuredClone(legacyState()));
    expect(Object.keys(migrated.q).sort()).toEqual(['a1-c1', 'a2-e1@py', 's0-l1-c1']);
    expect(migrated.l.a3).toEqual({ done: true });
    expect(migrated.l['s0-l1']).toEqual({ done: true });
    expect(migrated.p['p-graduation']).toEqual({ m: { g1: true, g2: false } });
    expect(migrated.meta.version).toBe(2);
    expect(migrated.meta.startedAt).toBe(1);
  });

  it('迁移幂等', () => {
    const once = migrateLegacyIds(structuredClone(legacyState()));
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
    expect(collision.q['a1-c1']!.solved).toBe(false);
  });

  it('版本已达 2 时原样返回', () => {
    const state = {
      q: { 's6-l1-c1': { solved: true } },
      l: {},
      p: {},
      meta: { version: 2, startedAt: 1 },
    };
    expect(migrateLegacyIds(state)).toBe(state);
  });

  it('草稿映射并保持幂等', () => {
    const drafts = migrateDraftMap({
      's6-l1': { code: 'old' },
      's6-l4-e1': { code: 'old-ex' },
      unrelated: { code: 'keep' },
    });
    expect(Object.keys(drafts).sort()).toEqual(['a1', 'a4-e1', 'unrelated']);
    expect(migrateDraftMap(drafts)).toEqual(drafts);
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

  it('空状态可迁移', () => {
    const empty = migrateLegacyIds({});
    expect(empty.q).toEqual({});
    expect(empty.l).toEqual({});
    expect(empty.p).toEqual({});
    expect(empty.meta.version).toBe(2);
  });
});
