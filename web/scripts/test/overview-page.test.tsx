import { Suspense } from 'react';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import OverviewPage, { StageCard } from '../app/pages/OverviewPage';
import { loadCatalog } from '../app/data/resources';
import { store } from '../state/store';
import type { BlockSummary } from '../app/data/types';

async function renderOverview() {
  await loadCatalog();
  return act(async () => render(
    <Suspense fallback={null}>
      <OverviewPage />
    </Suspense>,
  ));
}

beforeEach(() => {
  localStorage.clear();
  store.reset();
});

afterEach(cleanup);

describe('OverviewPage', () => {
  it('渲染四条路径、四个统计与六张内容块卡', async () => {
    await renderOverview();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('把前端的手感，接后端的世界');
    const stats = document.querySelectorAll('.hero__stat');
    expect(stats).toHaveLength(4);
    expect(within(stats[0] as HTMLElement).getByText('6')).toBeInTheDocument();
    expect(within(stats[0] as HTMLElement).getByText('学习大块')).toBeInTheDocument();
    expect(within(stats[1] as HTMLElement).getByText('45')).toBeInTheDocument();
    expect(within(stats[2] as HTMLElement).getByText('214')).toBeInTheDocument();
    expect(within(stats[3] as HTMLElement).getByText('0/45')).toBeInTheDocument();

    const paths = document.querySelectorAll('.path-card');
    expect(paths).toHaveLength(4);
    expect(paths[2]).toHaveClass('is-active');
    expect(within(paths[2] as HTMLElement).getByText('默认推荐')).toBeInTheDocument();
    expect(within(paths[2] as HTMLElement).getByText('AI 全栈')).toBeInTheDocument();
    expect(paths[2]).toHaveAttribute('href', '#/stage/m1');

    const blocks = document.querySelectorAll('.stage-card:not(.path-card)');
    expect(blocks).toHaveLength(6);
    expect(blocks[0]).toHaveAttribute('href', '#/stage/m1');
    expect(within(blocks[0] as HTMLElement).getByText('M1')).toBeInTheDocument();
  });

  it('工具箱卡使用块 ID 和按需查阅语义', async () => {
    await renderOverview();
    const cards = document.querySelectorAll('.stage-card:not(.path-card)');
    expect(within(cards[5] as HTMLElement).getByText('B')).toBeInTheDocument();
    expect(within(cards[5] as HTMLElement).getByText('按需查阅')).toBeInTheDocument();
  });

  it('阶段卡展示进度与毕业面板', async () => {
    store.setLessonDone('m1-http', true);
    await renderOverview();
    const first = document.querySelectorAll('.stage-card:not(.path-card)')[0] as HTMLElement;
    expect(within(first).getByText('33%')).toBeInTheDocument();
    expect(within(first).getByText('含项目入口')).toBeInTheDocument();
    expect(first.querySelector('.stage-card__bar i')).toHaveStyle({ width: '33%' });

    const panel = document.querySelector('.panel') as HTMLElement;
    expect(within(panel).getByText('毕业项目：LinkHub 短链服务')).toBeInTheDocument();
    expect(within(panel).getByText('资深全栈')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: '查看毕业项目' })).toHaveAttribute('href', '#/project/x-linkhub');
  });

  it('草稿计数只在有草稿时出现', () => {
    const base: BlockSummary = {
      id: 's0',
      index: 0,
      title: '地基',
      subtitle: '从请求开始',
      duration: 60,
      appendix: false,
      accent: 'teal',
      lessonCount: 3,
      projectId: 'p-m1-probe',
      draftCount: 0,
      kind: 'required',
      chapters: [],
      projectIds: ['p-m1-probe'],
    };
    const { rerender } = render(<StageCard stage={base} percent={0} />);
    const meta = document.querySelector('.stage-card__meta') as HTMLElement;
    expect(meta).toHaveTextContent('3 讲·含项目入口');
    expect(meta).not.toHaveTextContent('制作中');

    rerender(<StageCard stage={{ ...base, draftCount: 2 }} percent={0} />);
    expect(document.querySelector('.stage-card__meta')).toHaveTextContent('· 2 讲制作中');

    rerender(<StageCard stage={{ ...base, appendix: true, kind: 'toolbox', projectId: null, projectIds: [] }} percent={0} />);
    const appendixMeta = document.querySelector('.stage-card__meta') as HTMLElement;
    expect(appendixMeta).toHaveTextContent('按需查阅');
    expect(appendixMeta).not.toHaveTextContent('含项目入口');
  });

  it('CTA 文案与目标随进度变化', async () => {
    const first = await renderOverview();
    const cta = await screen.findByRole('link', { name: '从第一讲开始' });
    expect(cta).toHaveAttribute('href', '#/lesson/m1-http');
    first.unmount();

    store.setLessonDone('m1-http', true);
    await renderOverview();
    const next = await screen.findByRole('link', { name: '继续学习' });
    expect(next).toHaveAttribute('href', '#/lesson/m1-runtime');
    expect(screen.getByRole('link', { name: '打开 HTTP 实验室' })).toHaveAttribute('href', '#/lab');
  });
});
