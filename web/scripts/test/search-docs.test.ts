import { describe, expect, it } from 'vitest';
import searchIndex from '../../generated/search-index.json';
import { searchFromDocs } from '../app/shell/search-docs';
import type { SearchDocument } from '../app/shell/search-docs';
import searchDocsSource from '../app/shell/search-docs.ts?raw';
import { searchCurriculum } from './search-curriculum';

const docs = searchIndex as unknown as SearchDocument[];

const queries = [
  'DNS', 'TCP', 'TLS', 'HTTP', 'curl', '事件循环', '端口', '请求', '响应', '缓存',
  '限流', '幂等', '超时', 'URL', 'REST', 'API', 'JSON', 'SQL', '索引', '事务',
  '连接池', '并发', '队列', '消息', '日志', '指标', '追踪', 'Node', 'Python', 'TypeScript',
  'React', '前端', '后端', '毕业项目', 'LinkHub', '附录', 'Agent', '性能', '复杂度', '测试',
];

describe('searchFromDocs 与 E2 searchCurriculum 对等', () => {
  it('40 条查询语料逐条比较 href/title/sub 与顺序', () => {
    expect(queries).toHaveLength(40);
    for (const query of queries) {
      const expected = searchCurriculum(query).map((hit) => ({
        title: hit.title,
        sub: hit.sub,
        href: `#${hit.to}`,
      }));
      expect(searchFromDocs(docs, query), query).toEqual(expected);
    }
  });

  it('大小写、首尾空白与空查询行为一致', () => {
    const lower = searchCurriculum('dns').map((hit) => ({
      title: hit.title, sub: hit.sub, href: `#${hit.to}`,
    }));
    expect(searchFromDocs(docs, '  DNS  ')).toEqual(lower);
    expect(searchFromDocs(docs, '   ')).toEqual([]);
    expect(searchFromDocs(docs, '')).toEqual([]);
  });

  it('命中上限 12 条', () => {
    const synthetic: SearchDocument[] = Array.from({ length: 20 }, (_, index) => ({
      href: `#/lesson/x${index}`,
      title: `条目 ${index}`,
      sub: '测试',
      text: '共同关键词 needle',
    }));
    const hits = searchFromDocs(synthetic, 'needle');
    expect(hits).toHaveLength(12);
    expect(hits[0]).toEqual({ title: '条目 0', sub: '测试', href: '#/lesson/x0' });
    expect(hits[11]).toEqual({ title: '条目 11', sub: '测试', href: '#/lesson/x11' });
  });

  it('搜索文档模块不依赖构建期内容模块', () => {
    expect(searchDocsSource).not.toContain('content/index');
    expect(searchDocsSource).not.toContain('search-curriculum');
  });
});