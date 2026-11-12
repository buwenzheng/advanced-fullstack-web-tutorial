import { describe, expect, it } from 'vitest';
import { searchCurriculum } from './search-curriculum';

describe('searchCurriculum', () => {
  it('空白查询返回空数组', () => {
    expect(searchCurriculum('   ')).toEqual([]);
  });

  it('内容块优先：地基命中 m1', () => {
    expect(searchCurriculum('地基')[0]?.to).toBe('/stage/m1');
  });

  it('课时全文：事件循环命中 m1-runtime', () => {
    expect(searchCurriculum('事件循环').some((hit) => hit.to === '/lesson/m1-runtime')).toBe(true);
  });

  it('毕业项目：LinkHub 短链服务命中 x-linkhub', () => {
    expect(searchCurriculum('LinkHub 短链服务').some((hit) => hit.to === '/project/x-linkhub')).toBe(true);
  });

  it('结果最多 12 条', () => {
    expect(searchCurriculum('的').length).toBeLessThanOrEqual(12);
  });

  it('项目子标题区分阶段项目与毕业项目', () => {
    expect(searchCurriculum('LinkHub 数据层').find((hit) => hit.type === 'project')?.sub).toBe('阶段项目');
    expect(searchCurriculum('LinkHub 短链服务').find((hit) => hit.type === 'project')?.sub).toBe('毕业项目');
  });
});
