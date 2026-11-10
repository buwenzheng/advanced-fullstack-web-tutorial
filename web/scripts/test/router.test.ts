import { describe, expect, it } from 'vitest';
import { matchRoutes } from 'react-router';
import { routes } from '../app/router';
import { allLessons, curriculum, graduationProject } from '../content/index';

const paths = [
  '/',
  ...curriculum.map((stage) => `/stage/${stage.id}`),
  ...allLessons.map((lesson) => `/lesson/${lesson.id}`),
  ...curriculum.flatMap((stage) => (stage.project ? [`/project/${stage.project.id}`] : [])),
  `/project/${graduationProject.id}`,
  '/lab',
  '/report',
];

describe('router', () => {
  it('覆盖 66 条路由', () => {
    expect(paths).toHaveLength(66);
  });

  it.each(paths)('匹配 %s', (path) => {
    expect(matchRoutes(routes, path)).not.toBeNull();
  });

  it('未知路径回落到总览', () => {
    expect(matchRoutes(routes, '/nope')?.at(-1)?.route.path).toBe('*');
  });
});
