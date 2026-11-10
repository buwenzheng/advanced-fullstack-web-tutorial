import { Suspense } from 'react';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import StagePage, { StageLessonRow, StageView } from '../app/pages/StagePage';
import { loadCatalog, loadStage } from '../app/data/resources';
import { curriculum } from '../content/index';
import { store } from '../state/store';
import type { Lesson, Stage } from '../content/types';

async function renderAt(path: string) {
  const stageId = path.split('/').at(-1) ?? '';
  await loadCatalog();
  await loadStage(stageId);
  const router = createMemoryRouter(
    [{ path: '/stage/:stageId', element: <StagePage /> }],
    { initialEntries: [path] },
  );
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <RouterProvider router={router} />
      </Suspense>,
    );
  });
  expect(document.querySelector('.page')).not.toBeNull();
}

beforeEach(() => {
  localStorage.clear();
  store.reset();
});

afterEach(cleanup);

describe('StagePage', () => {
  it('无效阶段显示空状态', async () => {
    await renderAt('/stage/not-exist');
    expect(screen.getByText('找不到这个阶段。')).toBeInTheDocument();
    expect(document.querySelector('.empty-state')).toBeInTheDocument();
  });

  it('阶段 s0 的 hero 徽章序列与课时行', async () => {
    await renderAt('/stage/s0');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('地基：请求、运行时与排障');
    expect(document.querySelector('.stage-hero__num')).toHaveTextContent('STAGE 00');
    expect((document.querySelector('.stage-hero') as HTMLElement).style.getPropertyValue('--accent')).toBe('var(--teal)');

    const badges = [...document.querySelectorAll('.stage-hero__tags .badge')].map((node) => node.textContent);
    expect(badges).toEqual([
      '2 小时 50 分',
      '3 讲',
      '已完成 0/3',
      'DNS', 'TCP', 'TLS', 'HTTP', '事件循环', '进程', '端口', 'curl',
    ]);

    const rows = document.querySelectorAll('.lesson-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]?.querySelector('.lesson-row__num')).toHaveTextContent('0.1');
    expect(rows[2]?.querySelector('.lesson-row__num')).toHaveTextContent('0.3');
    expect(rows[0]?.querySelector('.lesson-row__right')).toHaveTextContent('5 题');

    const projectCard = document.querySelector('aside .panel') as HTMLElement;
    expect(projectCard).toHaveAttribute('href', '#/project/p0');
    expect(within(projectCard).getByText('阶段项目')).toBeInTheDocument();
    expect(within(projectCard).getByText('HTTP 探针 CLI')).toBeInTheDocument();
  });

  it('标记课时后显示已掌握与进度', async () => {
    store.setLessonDone('s0-l1', true);
    await renderAt('/stage/s0');
    const rows = document.querySelectorAll('.lesson-row');
    expect(within(rows[0] as HTMLElement).getByText('已掌握')).toBeInTheDocument();
    expect(document.querySelector('.stage-hero__tags .badge:nth-child(3)')).toHaveTextContent('已完成 1/3');
  });

  it('附录阶段的编号、徽章与课时行', async () => {
    await renderAt('/stage/appendix');
    expect(document.querySelector('.stage-hero__num')).toHaveTextContent('APPENDIX');
    const badges = [...document.querySelectorAll('.stage-hero__tags .badge')].map((node) => node.textContent);
    expect(badges[2]).toBe('附录 · 性能、架构、工程与 AI 基础设施');

    const rows = document.querySelectorAll('.lesson-row');
    expect(rows).toHaveLength(13);
    expect(rows[0]?.querySelector('.lesson-row__num')).toHaveTextContent('A.1');
    expect(rows[12]?.querySelector('.lesson-row__num')).toHaveTextContent('A.13');
  });

  it('草稿课时显示草稿徽章而不是题数', () => {
    const lesson = { ...curriculum[0]!.lessons[0]!, status: 'draft' } as unknown as Lesson;
    render(<StageLessonRow lesson={lesson} number="0.1" done={false} />);
    const row = document.querySelector('.lesson-row') as HTMLElement;
    expect(within(row).getByText('草稿')).toBeInTheDocument();
    expect(row.querySelector('.lesson-row__right')).not.toHaveTextContent('题');
  });

  it('空 outcome 不渲染达成标准卡', async () => {
    const stage = { ...curriculum[0]!, outcome: [] } as Stage;
    render(
      <Suspense fallback={null}>
        <StageView stage={stage} />
      </Suspense>,
    );
    expect(await screen.findByText('阶段目标')).toBeInTheDocument();
    expect(screen.queryByText('达成标准')).not.toBeInTheDocument();
  });
});
