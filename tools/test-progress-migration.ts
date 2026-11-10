import assert from 'node:assert';
import { migrateLegacyIds, migrateDraftMap } from '../web/scripts/state/migrate.js';

const state = {
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

const migrated = migrateLegacyIds(structuredClone(state));
assert.deepEqual(Object.keys(migrated.q).sort(), ['a1-c1', 'a2-e1@py', 's0-l1-c1']);
assert.deepEqual(migrated.l.a3, { done: true });
assert.deepEqual(migrated.l['s0-l1'], { done: true });
assert.deepEqual(migrated.p['p-graduation'], { m: { g1: true, g2: false } }, '旧毕业里程碑必须保留且不映射');
assert.equal(migrated.meta.version, 2);
assert.equal(migrated.meta.startedAt, 1);

const twice = migrateLegacyIds(structuredClone(migrated));
assert.deepEqual(twice, migrated, '迁移必须幂等');

const collision = migrateLegacyIds({
  q: { 'a1-c1': { solved: false }, 's6-l1-c1': { solved: true } },
  l: {},
  p: {},
  meta: {},
});
assert.equal(collision.q['a1-c1']!.solved, false, '新键优先，不被旧键覆盖');

const drafts = migrateDraftMap({
  's6-l1': { code: 'old' },
  's6-l4-e1': { code: 'old-ex' },
  unrelated: { code: 'keep' },
});
assert.deepEqual(Object.keys(drafts).sort(), ['a1', 'a4-e1', 'unrelated']);
assert.deepEqual(migrateDraftMap(drafts), drafts, '草稿迁移必须幂等');

console.log('progress migration ok: q/l/drafts mapped, graduation preserved, idempotent');
