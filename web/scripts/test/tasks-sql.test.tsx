import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readDraft, writeDraft } from '../app/exercises/drafts';
import { SqlTask } from '../app/exercises/SqlTask';
import type { Exercise } from '../content/types';
import { store } from '../state/store';

type SqlExercise = Extract<Exercise, { kind: 'sql' }>;

const task: SqlExercise = {
  id: 'sql-orders',
  kind: 'sql',
  title: '统计每用户订单数',
  brief: '按用户统计订单数，并按 <code>user_id</code> 升序。',
  hint: '按 user_id 分组后用 COUNT(*) 计数。',
  tables: {
    users: [
      { id: 1, name: 'Ada' },
      { id: 2, name: 'Lin' },
    ],
    orders: [
      { id: 10, user_id: 1 },
      { id: 11, user_id: 1 },
      { id: 12, user_id: 2 },
    ],
  },
  query: 'SELECT user_id, COUNT(*) AS total FROM orders GROUP BY user_id ORDER BY user_id',
  expected: [
    { user_id: 1, total: 2 },
    { user_id: 2, total: 1 },
  ],
  solution: 'SELECT user_id, COUNT(*) AS total FROM orders GROUP BY user_id ORDER BY user_id;',
};

function renderTask() {
  return render(<SqlTask task={task} />);
}

beforeEach(() => {
  localStorage.clear();
  store.reset();
});

afterEach(cleanup);

describe('SqlTask', () => {
  it('渲染题目、表结构与编辑器', () => {
    renderTask();
    expect(screen.getByText('SQL 题')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '统计每用户订单数' })).toBeInTheDocument();
    expect(document.querySelector('.exercise__brief')).toHaveTextContent('按用户统计订单数，并按 user_id 升序。');
    expect(screen.getByText('users')).toBeInTheDocument();
    expect(screen.getByText('orders')).toBeInTheDocument();
    expect(document.querySelectorAll('.sql-table')).toHaveLength(2);
    expect(document.querySelectorAll('.sql-table')[0]?.textContent).toContain('Ada');
    expect(screen.getByRole('textbox', { name: 'SQL 编辑器' })).toHaveValue(task.query);
    expect(screen.getByRole('button', { name: '执行 SQL' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重置' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看提示' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看参考答案' })).toBeInTheDocument();
    expect(screen.getByText('迷你 SQL 引擎 · 浏览器内执行')).toBeInTheDocument();
  });

  it('正确查询展示结果表、通过反馈与状态', async () => {
    const user = userEvent.setup();
    renderTask();
    await user.click(screen.getByRole('button', { name: '执行 SQL' }));

    expect(screen.getByText('正确')).toBeInTheDocument();
    expect(screen.getByText('查询结果与预期完全一致。')).toBeInTheDocument();
    expect(screen.getByText('已通过 · 结果与预期一致')).toBeInTheDocument();
    expect(document.querySelectorAll('.tbl tbody tr')).toHaveLength(2);
    expect(document.querySelector('.tbl tbody tr td')?.textContent).toBe('1');
    expect(store.answerOf('sql-orders')).toMatchObject({ correct: true, solved: true, attempts: 1 });
  });

  it('结果不一致时展示差异与预期结果', async () => {
    const user = userEvent.setup();
    renderTask();
    const editor = screen.getByRole('textbox', { name: 'SQL 编辑器' });
    await user.clear(editor);
    await user.type(editor, 'SELECT user_id FROM orders ORDER BY user_id');
    await user.click(screen.getByRole('button', { name: '执行 SQL' }));

    const feedback = document.querySelector('.quiz__feedback.is-wrong');
    expect(feedback).toHaveTextContent('结果与预期不一致');
    expect(feedback).toHaveTextContent('预期结果：');
    expect(feedback?.querySelector('pre')?.textContent).toContain('"total": 2');
    expect(store.answerOf('sql-orders')).toMatchObject({ correct: false, solved: false });
    expect(screen.queryByText('已通过 · 结果与预期一致')).toBeNull();
  });

  it('非 SELECT 语句展示执行完成但不判对', async () => {
    const user = userEvent.setup();
    renderTask();
    const editor = screen.getByRole('textbox', { name: 'SQL 编辑器' });
    await user.clear(editor);
    await user.type(editor, 'DELETE FROM orders WHERE user_id = 1');
    await user.click(screen.getByRole('button', { name: '执行 SQL' }));

    const feedback = document.querySelector('.quiz__feedback');
    expect(feedback).toHaveTextContent('执行完成');
    expect(feedback).toHaveTextContent('删除 2 行');
    expect(store.answerOf('sql-orders')).toMatchObject({ correct: false, solved: false });
    expect(screen.queryByText('已通过 · 结果与预期一致')).toBeNull();
  });

  it('SELECT 返回 0 行时展示查询成功但不判对', async () => {
    const user = userEvent.setup();
    renderTask();
    const editor = screen.getByRole('textbox', { name: 'SQL 编辑器' });
    await user.clear(editor);
    await user.type(editor, 'SELECT user_id FROM orders WHERE user_id = 99');
    await user.click(screen.getByRole('button', { name: '执行 SQL' }));

    expect(screen.getByText(/返回 0 行/)).toBeInTheDocument();
    expect(screen.getByText('结果与预期不一致')).toBeInTheDocument();
    expect(store.answerOf('sql-orders')).toMatchObject({ correct: false, solved: false });
  });

  it('SQL 执行失败时展示错误消息并记录未通过', async () => {
    const user = userEvent.setup();
    renderTask();
    const editor = screen.getByRole('textbox', { name: 'SQL 编辑器' });
    await user.clear(editor);
    await user.click(screen.getByRole('button', { name: '执行 SQL' }));

    expect(document.querySelector('.quiz__feedback.is-wrong')).toHaveTextContent('请输入要执行的 SQL');
    expect(store.answerOf('sql-orders')).toMatchObject({ correct: false, solved: false });
  });

  it('按题目 id 读写草稿，重置恢复初始查询并清理结果', async () => {
    const user = userEvent.setup();
    writeDraft('sql-orders', 'SELECT id FROM users');
    renderTask();
    const editor = screen.getByRole('textbox', { name: 'SQL 编辑器' });
    expect(editor).toHaveValue('SELECT id FROM users');

    await user.clear(editor);
    await user.type(editor, 'SELECT name FROM users');
    expect(readDraft('sql-orders')).toBe('SELECT name FROM users');

    await user.click(screen.getByRole('button', { name: '执行 SQL' }));
    expect(document.querySelector('.tbl')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: '重置' }));
    expect(editor).toHaveValue(task.query);
    expect(readDraft('sql-orders')).toBe(task.query);
    expect(document.querySelector('.tbl')).toBeNull();
    expect(document.querySelector('.quiz__feedback')).toBeNull();
  });

  it('提示与参考答案按 v2 文案切换', async () => {
    const user = userEvent.setup();
    renderTask();

    await user.click(screen.getByRole('button', { name: '查看提示' }));
    expect(document.querySelector('.hint-box')).toBeVisible();
    expect(screen.getByText(/按 user_id 分组后用 COUNT/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '收起提示' }));
    expect(document.querySelector('.hint-box')).not.toBeVisible();
    expect(screen.getByRole('button', { name: '查看提示' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '查看参考答案' }));
    expect(screen.getByRole('heading', { name: '参考答案' })).toBeInTheDocument();
    expect(screen.getByText(task.solution)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '收起参考答案' }));
    expect(document.querySelector('.reference')).not.toBeVisible();
  });

  it('恢复已通过状态', () => {
    store.recordAnswer('sql-orders', [], true);
    renderTask();
    expect(screen.getByText('已通过 · 结果与预期一致')).toBeInTheDocument();
  });
});
