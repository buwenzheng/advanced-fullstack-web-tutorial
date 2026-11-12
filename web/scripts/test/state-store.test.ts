import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadStore() {
  vi.resetModules();
  return import('../state/store.js');
}

beforeEach(() => {
  localStorage.clear();
});

describe('state store', () => {
  it('空存储返回空白状态', async () => {
    const { store } = await loadStore();
    expect(store.get()).toMatchObject({ q: {}, l: {}, p: {}, meta: { version: 3 } });
  });

  it('读取时迁移旧键并回写 localStorage', async () => {
    localStorage.setItem(
      'bff-lab-progress-v1',
      JSON.stringify({ q: { 's6-l1-c1': { solved: true } }, l: {}, p: {}, meta: { startedAt: 1 } }),
    );
    const { store } = await loadStore();
    expect(store.get().q['b-bigO-c1']).toMatchObject({ solved: true });
    expect(store.get().meta).toMatchObject({ version: 3, startedAt: 1 });
    const persisted = JSON.parse(localStorage.getItem('bff-lab-progress-v1')!) as {
      q: Record<string, unknown>;
      meta: { version: number };
    };
    expect(persisted.q['b-bigO-c1']).toBeTruthy();
    expect(persisted.meta.version).toBe(3);
  });

  it('损坏或非对象 JSON 回退空白状态', async () => {
    localStorage.setItem('bff-lab-progress-v1', '{bad json');
    let loaded = await loadStore();
    expect(loaded.store.get().q).toEqual({});

    localStorage.setItem('bff-lab-progress-v1', '42');
    loaded = await loadStore();
    expect(loaded.store.get().q).toEqual({});
  });

  it('导入时按进度 version 迁移草稿键', async () => {
    localStorage.setItem('bff-lab-progress-v1', JSON.stringify({
      q: {},
      l: {},
      p: {},
      meta: { version: 2, startedAt: 0 },
    }));
    localStorage.setItem('bff-lab-drafts-v1', JSON.stringify({ 's6-l1': { code: 'old' }, other: { code: 'keep' } }));
    await loadStore();
    const v2Drafts = JSON.parse(localStorage.getItem('bff-lab-drafts-v1')!) as Record<string, unknown>;
    expect(Object.keys(v2Drafts).sort()).toEqual(['m3-bff', 'other']);

    localStorage.clear();
    localStorage.setItem('bff-lab-progress-v1', JSON.stringify({
      q: {},
      l: {},
      p: {},
      meta: { version: 1, startedAt: 0 },
    }));
    localStorage.setItem('bff-lab-drafts-v1', JSON.stringify({ 's6-l1': { code: 'old' }, other: { code: 'keep' } }));
    await loadStore();
    const v1Drafts = JSON.parse(localStorage.getItem('bff-lab-drafts-v1')!) as Record<string, unknown>;
    expect(Object.keys(v1Drafts).sort()).toEqual(['b-bigO', 'other']);
  });

  it('recordAnswer 记录尝试次数并保持已解决', async () => {
    const { store } = await loadStore();
    const seen: number[] = [];
    const unsubscribe = store.subscribe((state) => seen.push(state.q.s6 ? state.q.s6.attempts : -1));
    store.recordAnswer('s6', [0], true);
    store.recordAnswer('s6', [1], false);
    expect(store.answerOf('s6')).toEqual({ picked: [1], correct: false, attempts: 2, solved: true });
    expect(seen).toEqual([1, 2]);
    unsubscribe();
    store.recordAnswer('s6', [2], true);
    expect(seen).toEqual([1, 2]);
    expect(JSON.parse(localStorage.getItem('bff-lab-progress-v1')!).q.s6.attempts).toBe(3);
  });

  it('recordChecklist 以勾选数量判定完成', async () => {
    const { store } = await loadStore();
    store.recordChecklist('c1', [0, 1], 3);
    expect(store.answerOf('c1')).toEqual({ picked: [0, 1], correct: false, attempts: 1, solved: false });
    store.recordChecklist('c1', [0, 1, 2], 3);
    expect(store.answerOf('c1')).toEqual({ picked: [0, 1, 2], correct: true, attempts: 1, solved: true });
    store.recordChecklist('c2', [], 0);
    expect(store.answerOf('c2')!.solved).toBe(false);
  });

  it('课时、里程碑与项目笔记读写', async () => {
    const { store } = await loadStore();
    expect(store.lessonDone('m1-http')).toBe(false);
    store.setLessonDone('m1-http', true);
    store.setLessonDone('m1-runtime', false);
    expect(store.lessonDone('m1-http')).toBe(true);
    expect(store.lessonDone('m1-runtime')).toBe(false);

    expect(store.milestoneDone('p-m1-probe', 'm1')).toBe(false);
    expect(store.toggleMilestone('p-m1-probe', 'm1')).toBe(true);
    expect(store.milestoneDone('p-m1-probe', 'm1')).toBe(true);
    expect(store.toggleMilestone('p-m1-probe', 'm1')).toBe(false);

    expect(store.projectNote('p-m1-probe')).toBe('');
    store.setProjectNote('p-m1-probe', '总览笔记');
    expect(store.projectNote('p-m1-probe')).toBe('总览笔记');

    expect(store.milestoneNote('p-m1-probe', 'm1')).toBe('');
    store.setMilestoneNote('p-m1-probe', 'm1', '里程碑笔记');
    expect(store.milestoneNote('p-m1-probe', 'm1')).toBe('里程碑笔记');
  });

  it('reset 清空全部进度', async () => {
    const { store } = await loadStore();
    store.recordAnswer('s6', [0], true);
    store.setLessonDone('m3-bff', true);
    store.setProjectNote('p-m1-probe', 'note');
    store.reset();
    expect(store.get().q).toEqual({});
    expect(store.get().l).toEqual({});
    expect(store.get().p).toEqual({});
    expect(JSON.parse(localStorage.getItem('bff-lab-progress-v1')!).q).toEqual({});
  });

  it('写入失败时保留内存态', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    const { store } = await loadStore();
    expect(() => store.recordAnswer('s6', [0], true)).not.toThrow();
    expect(store.answerOf('s6')!.solved).toBe(true);
    spy.mockRestore();
  });

  it('formatDuration 覆盖分钟与小时', async () => {
    const { formatDuration } = await loadStore();
    expect(formatDuration(0)).toBe('');
    expect(formatDuration(30)).toBe('30 分钟');
    expect(formatDuration(60)).toBe('1 小时');
    expect(formatDuration(90)).toBe('1 小时 30 分');
  });
});
