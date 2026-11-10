import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { McqTask } from '../app/exercises/McqTask';
import { ToastProvider } from '../app/shell/ToastProvider';
import type { Check } from '../content/types';
import { store } from '../state/store';

const single: Check = {
  id: 'q-single',
  kind: 'mcq',
  type: 'single',
  tag: '示例标签',
  prompt: '题干',
  question: '题干包含 <b>重点</b>',
  options: [
    { text: '错误一', correct: false },
    { text: '正确项', correct: true },
    { text: '错误二', correct: false },
  ],
  explain: '解析：正确项的理由。',
};

const multi: Check = {
  ...single,
  id: 'q-multi',
  type: 'multi',
  tag: '多选标签',
  options: [
    { text: '正确一', correct: true },
    { text: '正确二', correct: true },
    { text: '错误三', correct: false },
  ],
};

function renderTask(task: Check) {
  render(
    <ToastProvider>
      <McqTask task={task} />
    </ToastProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  store.reset();
});

afterEach(cleanup);

describe('McqTask', () => {
  it('未选择时提交提示且不记录答案', async () => {
    const user = userEvent.setup();
    renderTask(single);
    await user.click(screen.getByRole('button', { name: '提交答案' }));
    expect(screen.getByText('请先选择答案')).toBeInTheDocument();
    expect(store.answerOf('q-single')).toBeNull();
    expect(document.querySelector('.quiz__feedback')).toBeNull();
  });

  it('单选答错：标记、反馈、记录与重试后答对', async () => {
    const user = userEvent.setup();
    renderTask(single);
    expect(screen.getByText('单选题')).toBeInTheDocument();
    expect(screen.getByText('示例标签')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /错误一/ }));
    await user.click(screen.getByRole('button', { name: '提交答案' }));

    const feedback = document.querySelector('.quiz__feedback');
    expect(feedback).toHaveClass('is-wrong');
    expect(feedback).toHaveTextContent('答错了');
    expect(feedback).toHaveTextContent('解析：正确项的理由。');
    expect(screen.getByText('✓ 正确')).toBeInTheDocument();
    expect(screen.getByText('✗ 你的选择')).toBeInTheDocument();
    expect(document.querySelectorAll('.opt[disabled]')).toHaveLength(3);
    expect(document.querySelector('.quiz__actions .btn--primary')).toHaveStyle({ display: 'none' });
    expect(screen.getByRole('button', { name: '再试一次' })).toHaveStyle({ display: 'inline-flex' });
    expect(store.answerOf('q-single')).toMatchObject({ picked: [0], correct: false, attempts: 1, solved: false });

    await user.click(screen.getByRole('button', { name: '再试一次' }));
    expect(document.querySelector('.quiz__feedback')).toBeNull();
    expect(document.querySelectorAll('.opt[disabled]')).toHaveLength(0);
    expect(screen.getByRole('button', { name: '提交答案' })).not.toHaveStyle({ display: 'none' });

    await user.click(screen.getByRole('button', { name: /正确项/ }));
    await user.click(screen.getByRole('button', { name: '提交答案' }));
    expect(document.querySelector('.quiz__feedback')).toHaveClass('is-right');
    expect(screen.getByText('答对了')).toBeInTheDocument();
    expect(store.answerOf('q-single')).toMatchObject({ picked: [1], correct: true, attempts: 2, solved: true });
  });

  it('多选全对判对', async () => {
    const user = userEvent.setup();
    renderTask(multi);
    expect(screen.getByText('多选题')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /正确一/ }));
    await user.click(screen.getByRole('button', { name: /正确二/ }));
    await user.click(screen.getByRole('button', { name: '提交答案' }));
    expect(screen.getByText('答对了')).toBeInTheDocument();
    expect(store.answerOf('q-multi')).toMatchObject({ picked: [0, 1], correct: true, solved: true });
  });

  it('多选漏选判错', async () => {
    const user = userEvent.setup();
    renderTask(multi);
    await user.click(screen.getByRole('button', { name: /正确一/ }));
    await user.click(screen.getByRole('button', { name: '提交答案' }));
    expect(screen.getByText('答错了')).toBeInTheDocument();
    expect(store.answerOf('q-multi')).toMatchObject({ picked: [0], correct: false, solved: false });
  });

  it('恢复已答对状态：展示反馈、锁定选项、隐藏提交', () => {
    store.recordAnswer('q-single', [1], true);
    renderTask(single);
    expect(document.querySelector('.quiz__feedback')).toHaveClass('is-right');
    expect(screen.getByText('答对了')).toBeInTheDocument();
    expect(document.querySelectorAll('.opt[disabled]')).toHaveLength(3);
    expect(document.querySelector('.opt.is-right')).toHaveTextContent('✓ 正确');
    expect(document.querySelector('.quiz__actions .btn--primary')).toHaveStyle({ display: 'none' });
    expect(screen.getByRole('button', { name: '再试一次' })).toBeInTheDocument();
  });

  it('恢复上次答错：提示再试且不显示正确标记，重试后可重答', async () => {
    const user = userEvent.setup();
    store.recordAnswer('q-single', [0], false);
    renderTask(single);
    const feedback = document.querySelector('.quiz__feedback');
    expect(feedback).toHaveClass('is-wrong');
    expect(feedback).toHaveTextContent('上次答错');
    expect(feedback).toHaveTextContent('再试一次，看看解析里的关键点。');
    expect(screen.queryByText('✓ 正确')).toBeNull();
    expect(screen.queryByText('✗ 你的选择')).toBeNull();
    expect(document.querySelectorAll('.opt[disabled]')).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: '再试一次' }));
    expect(document.querySelector('.quiz__feedback')).toBeNull();
    await user.click(screen.getByRole('button', { name: /正确项/ }));
    await user.click(screen.getByRole('button', { name: '提交答案' }));
    expect(screen.getByText('答对了')).toBeInTheDocument();
    expect(store.answerOf('q-single')).toMatchObject({ correct: true, attempts: 2, solved: true });
  });
});
