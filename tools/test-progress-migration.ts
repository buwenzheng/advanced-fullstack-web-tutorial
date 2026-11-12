import assert from 'node:assert';
import { migrateLegacyIds, migrateDraftMap } from '../web/scripts/state/migrate.js';
import { remapId } from '../web/scripts/content/id-map.js';

/* 夹具 1：仅含未经 a 迁移的 s6-l*（v1 附录语义） */
{
  const migrated = migrateLegacyIds({
    q: { 's6-l1-c1': { solved: true } },
    l: { 's6-l1': { done: true } },
    p: {},
    meta: {},
  });
  assert.equal(migrated.l['b-bigO']?.done, true);
  assert.equal(migrated.q['b-bigO-c1']?.solved, true);
  assert.equal(migrated.meta.version, 3);
}

/* 夹具 2：已是 a1 的进度 */
{
  const migrated = migrateLegacyIds({
    q: { 'a1-c1': { solved: true } },
    l: { a1: { done: true } },
    p: {},
    meta: { version: 2, startedAt: 1 },
  });
  assert.equal(migrated.l['b-bigO']?.done, true);
  assert.equal(migrated.q['b-bigO-c1']?.solved, true);
  assert.equal(migrated.meta.version, 3);
}

/* 夹具 2b：v2 BFF 的 s6 → m3-bff，不得进工具箱 */
{
  const migrated = migrateLegacyIds({
    q: { 's6-l1-check-1': { solved: true } },
    l: { 's6-l1': { done: true }, 's6-l2': { done: true } },
    p: {},
    meta: { version: 2 },
  });
  assert.equal(migrated.l['m3-bff']?.done, true);
  assert.equal(migrated.l['m3-render']?.done, true);
  assert.equal(migrated.l['b-bigO'], undefined);
  assert.equal(migrated.q['m3-bff-check-1']?.solved, true);
}

/* 夹具 3：混合 s0 / s7 / p2 */
{
  const migrated = migrateLegacyIds({
    q: { 's0-l1-check-1': { solved: true } },
    l: { 's0-l1': { done: true }, 's7-l4': { done: true } },
    p: { p2: { m: { 'p2-m1': true } } },
    meta: { version: 2 },
  });
  assert.equal(migrated.l['m1-http']?.done, true);
  assert.equal(migrated.l['m4-coding-system']?.done, true);
  assert.deepEqual(migrated.p['p-m2-api'], { m: { 'p-m2-api-m1': true } });
}

/* 夹具 4：version 3 幂等 */
{
  const state = {
    q: { 'm1-http-c1': { solved: true } },
    l: { 'm1-http': { done: true } },
    p: {},
    meta: { version: 3, startedAt: 1 },
  };
  assert.equal(migrateLegacyIds(state), state);
}

/* 夹具 5：p3+p4 → p-m3-ship 并集（p4 里程碑落到 m6+） */
{
  const migrated = migrateLegacyIds({
    q: {},
    l: {},
    p: {
      p3: { m: { 'p3-m1': true } },
      p4: { m: { 'p4-m1': true } },
    },
    meta: { version: 2 },
  });
  assert.deepEqual(migrated.p['p-m3-ship'], {
    m: { 'p-m3-ship-m1': true, 'p-m3-ship-m6': true },
  });
  assert.equal(migrated.p.p4, undefined);
  assert.equal(remapId('p4-m5'), 'p-m3-ship-m10');
}

/* 草稿：默认按 v2+（BFF）；显式 v1 走附录 */
{
  const v2Drafts = migrateDraftMap({
    's6-l1': { code: 'old' },
    's0-l1-ex-1': { code: 'http' },
    unrelated: { code: 'keep' },
  }, 2);
  assert.deepEqual(Object.keys(v2Drafts).sort(), ['m1-http-ex-1', 'm3-bff', 'unrelated']);

  const v1Drafts = migrateDraftMap({
    's6-l1': { code: 'old' },
    's0-l1-ex-1': { code: 'http' },
  }, 1);
  assert.deepEqual(Object.keys(v1Drafts).sort(), ['b-bigO', 'm1-http-ex-1']);
  assert.deepEqual(migrateDraftMap(v2Drafts, 2), v2Drafts);
}

/* 完整 v1 样例 */
{
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
  assert.deepEqual(Object.keys(migrated.q).sort(), ['b-bigO-c1', 'b-hash-e1@py', 'm1-http-c1']);
  assert.deepEqual(migrated.l['b-btree'], { done: true });
  assert.deepEqual(migrated.l['m1-http'], { done: true });
  assert.deepEqual(migrated.p['x-linkhub'], { m: { g1: true, g2: false } });
  assert.deepEqual(migrated.p['p-m1-probe'], { m: { 'p-m1-probe-m1': true } });
  assert.equal(migrated.meta.version, 3);

  const twice = migrateLegacyIds(structuredClone(migrated));
  assert.deepEqual(twice, migrated, '迁移必须幂等');
}

console.log('progress migration ok: v3 fixtures (s6, a*, mixed, idempotent, p3/p4, drafts)');
