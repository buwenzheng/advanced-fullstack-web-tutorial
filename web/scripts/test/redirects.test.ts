import { describe, expect, it } from 'vitest';
import { resolveLessonRedirect, resolveProjectRedirect, resolveStageRedirect } from '../app/redirects.js';

describe('legacy id redirects', () => {
  it('旧课时 ID 映射到新 ID', () => {
    expect(resolveLessonRedirect('s0-l1')).toBe('m1-http');
    expect(resolveLessonRedirect('a1')).toBe('b-bigO');
    expect(resolveLessonRedirect('m1-http')).toBeNull();
    expect(resolveLessonRedirect('missing')).toBeNull();
  });

  it('旧项目 ID 映射到新 ID', () => {
    expect(resolveProjectRedirect('p0')).toBe('p-m1-probe');
    expect(resolveProjectRedirect('p-graduation')).toBe('x-linkhub');
    expect(resolveProjectRedirect('p-m1-probe')).toBeNull();
  });

  it('旧阶段目录跳转到合并后的内容块', () => {
    expect(resolveStageRedirect('s0')).toBe('m1');
    expect(resolveStageRedirect('m1')).toBeNull();
  });
});
