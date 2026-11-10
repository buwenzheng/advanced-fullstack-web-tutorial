import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DesignTask } from '../app/exercises/DesignTask';
import { readDraft } from '../app/exercises/drafts';
import type { Exercise } from '../content/types';
import { store } from '../state/store';

type DesignExercise = Extract<Exercise, { kind: 'design' }>;

const task: DesignExercise = {
  id: 'design-rate-limit',
  kind: 'design',
  title: '设计限流方案',
  prompt: '为开放 API 设计一套限流方案。',
  checklist: ['定义速率窗口', '选择存储介质', '定义超限响应'],
  reference: '<p>令牌桶 + Redis 计数器。</p>',
  specs: [
    { label: '接口', value: '<code>POST /orders</code>' },
    { label: '目标', value: '单用户每秒 10 次' },
  ],
};

const PLACEHOLDER = '写下你的方案要点：接口设计、状态码、数据结构、边界处理、失败场景……';

function renderTask() {
  return render(<DesignTask task={task} />);
}

beforeEach(() => {
  localStorage.clear();
  store.reset();
});

afterEach(cleanup);

describe('DesignTask', () => {
  it('渲染题目、规格、自检清单与方案草稿区', () => {
    renderTask();
    expect(screen.getByText('方案题')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '设计限流方案' })).toBeInTheDocument();
    expect(document.querySelector('.exercise__brief')).toHaveTextContent('为开放 API 设计一套限流方案。');
    expect(screen.getByText('接口')).toBeInTheDocument();
    expect(screen.getByText('POST /orders')).toBeInTheDocument();
    expect(screen.getByText('目标')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '自检清单' })).toBeInTheDocument();
    expect(screen.getByText('自检 0/3')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveValue('');
    expect(screen.getByRole('button', { name: '对照参考要点' })).toBeInTheDocument();
    expect(document.querySelector('.reference')).not.toBeVisible();
  });

  it('勾选清单写入进度并在全选时标记完成', async () => {
    const user = userEvent.setup();
    renderTask();
    const boxes = screen.getAllByRole('checkbox');

    await user.click(boxes[0]!);
    expect(store.answerOf('design-rate-limit')).toMatchObject({
      picked: [0],
      correct: false,
      solved: false,
    });
    expect(screen.getByText('自检 1/3')).toBeInTheDocument();

    await user.click(boxes[1]!);
    await user.click(boxes[2]!);
    expect(screen.getByText('自检 3/3 · 已完成')).toBeInTheDocument();
    expect(store.answerOf('design-rate-limit')).toMatchObject({
      picked: [0, 1, 2],
      correct: true,
      solved: true,
      attempts: 1,
    });

    await user.click(boxes[1]!);
    expect(screen.getByText('自检 2/3')).toBeInTheDocument();
    expect(store.answerOf('design-rate-limit')).toMatchObject({ picked: [0, 2], solved: true });
  });

  it('恢复已勾选状态', () => {
    store.recordChecklist('design-rate-limit', [0, 2], 3);
    renderTask();
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes[0]).toBeChecked();
    expect(boxes[1]).not.toBeChecked();
    expect(boxes[2]).toBeChecked();
    expect(screen.getByText('自检 2/3')).toBeInTheDocument();
  });

  it('方案草稿按 note: 前缀持久化并在重新挂载后恢复', async () => {
    const user = userEvent.setup();
    const view = renderTask();
    const textarea = screen.getByPlaceholderText(PLACEHOLDER);
    await user.type(textarea, '用令牌桶');
    expect(readDraft('note:design-rate-limit')).toBe('用令牌桶');
    view.unmount();

    renderTask();
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveValue('用令牌桶');
  });

  it('参考要点按钮切换显示与隐藏', async () => {
    const user = userEvent.setup();
    renderTask();

    await user.click(screen.getByRole('button', { name: '对照参考要点' }));
    expect(document.querySelector('.reference')).toBeVisible();
    expect(screen.getByRole('heading', { name: '参考要点' })).toBeInTheDocument();
    expect(screen.getByText('令牌桶 + Redis 计数器。')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '收起参考要点' }));
    expect(document.querySelector('.reference')).not.toBeVisible();
    expect(screen.getByRole('button', { name: '对照参考要点' })).toBeInTheDocument();
  });
});
