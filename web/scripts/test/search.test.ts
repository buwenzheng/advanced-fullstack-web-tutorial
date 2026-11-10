import { describe, expect, it } from 'vitest';
import { searchCurriculum } from '../app/shell/search';

describe('searchCurriculum', () => {
  it('空白查询返回空数组', () => {
    expect(searchCurriculum('   ')).toEqual([]);
  });

  it('阶段优先：地基命中 s0', () => {
    expect(searchCurriculum('地基')[0]?.to).toBe('/stage/s0');
  });

  it('课时全文：事件循环命中 s0-l2', () => {
    expect(searchCurriculum('事件循环').some((hit) => hit.to === '/lesson/s0-l2')).toBe(true);
  });

  it('毕业项目：LinkHub 短链服务命中 p-graduation', () => {
    expect(searchCurriculum('LinkHub 短链服务').some((hit) => hit.to === '/project/p-graduation')).toBe(true);
  });

  it('结果最多 12 条', () => {
    expect(searchCurriculum('的').length).toBeLessThanOrEqual(12);
  });

  it('项目子标题区分阶段项目与毕业项目', () => {
    expect(searchCurriculum('LinkHub 数据层').find((hit) => hit.type === 'project')?.sub).toBe('阶段项目');
    expect(searchCurriculum('LinkHub 短链服务').find((hit) => hit.type === 'project')?.sub).toBe('毕业项目');
  });
});
