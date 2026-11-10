import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import OverviewPage, { StageCard } from '../app/pages/OverviewPage';
import { store } from '../state/store';
import type { StageSummary } from '../app/data/types';

beforeEach(() => {
  localStorage.clear();
  store.reset();
});

afterEach(cleanup);

describe('OverviewPage', () => {
  it('渲染四个统计与九张阶段卡', () => {
    render(<OverviewPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('把前端的手感，接后端的世界');
    const stats = document.querySelectorAll('.hero__stat');
    expect(stats).toHaveLength(4);
    expect(within(stats[0] as HTMLElement).getByText('8 + 1')).toBeInTheDocument();
    expect(within(stats[0] as HTMLElement).getByText('阶段 + 附录')).toBeInTheDocument();
    expect(within(stats[1] as HTMLElement).getByText('45')).toBeInTheDocument();
    expect(within(stats[2] as HTMLElement).getByText('214')).toBeInTheDocument();
    expect(within(stats[3] as HTMLElement).getByText('0/45')).toBeInTheDocument();

    const cards = document.querySelectorAll('.stage-card');
    expect(cards).toHaveLength(9);
    expect(cards[0]).toHaveAttribute('href', '#/stage/s0');
    expect((cards[0] as HTMLElement).style.getPropertyValue('--accent')).toBe('var(--teal)');
    expect(within(cards[0] as HTMLElement).getByText('STAGE 00')).toBeInTheDocument();
  });

  it('附录卡使用 APPENDIX 序号', () => {
    render(<OverviewPage />);
    const cards = document.querySelectorAll('.stage-card');
    expect(within(cards[8] as HTMLElement).getByText('APPENDIX')).toBeInTheDocument();
    expect(within(cards[8] as HTMLElement).getByText('性能、架构与 AI 基础设施')).toBeInTheDocument();
  });

  it('阶段卡展示进度与毕业面板', () => {
    store.setLessonDone('s0-l1', true);
    render(<OverviewPage />);
    const first = document.querySelectorAll('.stage-card')[0] as HTMLElement;
    expect(within(first).getByText('33%')).toBeInTheDocument();
    expect(within(first).getByText('含阶段项目')).toBeInTheDocument();
    expect(first.querySelector('.stage-card__bar i')).toHaveStyle({ width: '33%' });

    const panel = document.querySelector('.panel') as HTMLElement;
    expect(within(panel).getByText('毕业项目：LinkHub 短链服务')).toBeInTheDocument();
    expect(within(panel).getByText('资深全栈')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: '查看毕业项目' })).toHaveAttribute('href', '#/project/p-graduation');
  });

  it('草稿计数只在有草稿时出现', () => {
    const base: StageSummary = {
      id: 's0',
      index: 0,
      title: '地基',
      subtitle: '从请求开始',
      duration: 60,
      appendix: false,
      accent: 'teal',
      lessonCount: 3,
      projectId: 'p0',
      draftCount: 0,
    };
    const { rerender } = render(<StageCard stage={base} percent={0} />);
    const meta = document.querySelector('.stage-card__meta') as HTMLElement;
    expect(meta).toHaveTextContent('3 讲·含阶段项目');
    expect(meta).not.toHaveTextContent('制作中');

    rerender(<StageCard stage={{ ...base, draftCount: 2 }} percent={0} />);
    expect(document.querySelector('.stage-card__meta')).toHaveTextContent('· 2 讲制作中');

    rerender(<StageCard stage={{ ...base, appendix: true, projectId: null }} percent={0} />);
    const appendixMeta = document.querySelector('.stage-card__meta') as HTMLElement;
    expect(appendixMeta).toHaveTextContent('性能、架构与 AI 基础设施');
    expect(appendixMeta).not.toHaveTextContent('含阶段项目');
  });

  it('CTA 文案与目标随进度变化', () => {
    const first = render(<OverviewPage />);
    const cta = screen.getByRole('link', { name: '从第一讲开始' });
    expect(cta).toHaveAttribute('href', '#/lesson/s0-l1');
    first.unmount();

    store.setLessonDone('s0-l1', true);
    render(<OverviewPage />);
    const next = screen.getByRole('link', { name: '继续学习' });
    expect(next).toHaveAttribute('href', '#/lesson/s0-l2');
    expect(screen.getByRole('link', { name: '打开 HTTP 实验室' })).toHaveAttribute('href', '#/lab');
  });
});
