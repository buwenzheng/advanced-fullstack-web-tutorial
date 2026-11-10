import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CodeTask } from '../app/exercises/CodeTask';
import { readDraft, writeDraft } from '../app/exercises/drafts';
import { ToastProvider } from '../app/shell/ToastProvider';
import type { CodeExercise } from '../content/types';
import type { RunResult } from '../engine/runner/index';
import { lang } from '../state/lang';
import { store } from '../state/store';

const mocks = vi.hoisted(() => ({
  runTests: vi.fn(),
  runPythonTests: vi.fn(),
  warmPython: vi.fn(),
  unsubscribe: vi.fn(),
  statusListeners: [] as Array<() => void>,
  pythonState: { ready: false, loadError: false },
  pythonHarness: vi.fn((tests: unknown) => ({ harness: tests })),
}));

vi.mock('../engine/runner/index', () => ({ runTests: mocks.runTests }));
vi.mock('../engine/python/index', () => ({
  onPythonStatus: (fn: () => void) => {
    mocks.statusListeners.push(fn);
    fn();
    return mocks.unsubscribe;
  },
  pythonReady: () => mocks.pythonState.ready,
  pythonLoadError: () => mocks.pythonState.loadError,
  warmPython: mocks.warmPython,
  runPythonTests: mocks.runPythonTests,
}));
vi.mock('../engine/python/harness', () => ({ pythonHarness: mocks.pythonHarness }));

const task: CodeExercise = {
  id: 'ex-sum',
  kind: 'code',
  title: '实现求和',
  brief: '返回两个数之和。',
  hint: '使用 <code>reduce</code> 累加。',
  starter: 'function sum(a, b) {\n  // TODO\n}\n',
  solution: 'function sum(a, b) {\n  return a + b;\n}\n',
  tests: [
    { name: '测试 1', code: 'assert.equal(sum(1, 2), 3);' },
    { name: '测试 2', code: 'assert.equal(sum(-1, 1), 0);' },
  ],
  python: {
    starter: 'def sum(a, b):\n    pass\n',
    solution: 'def sum(a, b):\n    return a + b\n',
    tests: [{ name: '测试 1', code: 'assert sum(1, 2) == 3' }],
  },
};

const passed: RunResult = {
  ok: true,
  results: [
    { name: '测试 1', ok: true },
    { name: '测试 2', ok: true },
  ],
  logs: [],
};

function renderTask(ui = <CodeTask task={task} />) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

beforeEach(() => {
  localStorage.clear();
  store.reset();
  lang.set('javascript');
  mocks.runTests.mockReset();
  mocks.runPythonTests.mockReset();
  mocks.warmPython.mockReset();
  mocks.unsubscribe.mockReset();
  mocks.pythonHarness.mockClear();
  mocks.statusListeners.length = 0;
  mocks.pythonState.ready = false;
  mocks.pythonState.loadError = false;
  mocks.runTests.mockResolvedValue(passed);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('drafts', () => {
  it('读写草稿并保留其他键', () => {
    expect(readDraft('a')).toBeNull();
    writeDraft('a', '甲');
    writeDraft('b', '乙');
    expect(readDraft('a')).toBe('甲');
    expect(readDraft('b')).toBe('乙');
  });

  it('损坏 JSON 回退为无草稿且写入不抛错', () => {
    localStorage.setItem('bff-lab-drafts-v1', '{oops');
    expect(readDraft('a')).toBeNull();
    expect(() => writeDraft('a', '甲')).not.toThrow();
  });

  it('存储写入异常时静默', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    try {
      expect(() => writeDraft('a', '甲')).not.toThrow();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('CodeTask', () => {
  it('渲染头部与语言元信息，切换轨道时按轨道读写草稿', async () => {
    const user = userEvent.setup();
    renderTask();

    expect(screen.getByText('代码题')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '实现求和' })).toBeInTheDocument();
    expect(screen.getByText('solution.js')).toBeInTheDocument();
    expect(screen.getByText('JavaScript · Node 风格')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Node.js' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Python' })).toHaveAttribute('aria-selected', 'false');

    const editor = screen.getByRole('textbox', { name: '实现求和' });
    expect(editor).toHaveValue(task.starter);
    await user.type(editor, '// js');
    expect(readDraft('ex-sum')).toBe(`${task.starter}// js`);
    expect(readDraft('ex-sum@py')).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Python' }));
    expect(screen.getByText('solution.py')).toBeInTheDocument();
    expect(screen.getByText('Python 3.13 · 标准库')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Python' })).toHaveAttribute('aria-selected', 'true');
    expect(mocks.warmPython).toHaveBeenCalledTimes(1);

    const pyEditor = screen.getByRole('textbox', { name: '实现求和' });
    expect(pyEditor).toHaveValue(task.python!.starter);
    await user.type(pyEditor, '# py');
    expect(readDraft('ex-sum@py')).toBe(`${task.python!.starter}# py`);

    await user.click(screen.getByRole('tab', { name: 'Node.js' }));
    expect(screen.getByRole('textbox', { name: '实现求和' })).toHaveValue(`${task.starter}// js`);
  });

  it('语言偏好为 Python 时初始挂载 Python 轨道并展示运行时提示', () => {
    lang.set('python');
    renderTask();
    expect(screen.getByRole('tab', { name: 'Python' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('首次运行需下载 Python 运行时（约 10 MB）')).toBeInTheDocument();
    expect(mocks.warmPython).toHaveBeenCalledTimes(1);
  });

  it('运行成功后展示测试、控制台与通过 toast，并记录进度', async () => {
    const user = userEvent.setup();
    mocks.runTests.mockResolvedValue({
      ok: true,
      results: [
        { name: '测试 1', ok: true },
        { name: '测试 2', ok: true },
      ],
      logs: [{ level: 'log', text: 'hello' }],
    });
    renderTask();

    await user.click(screen.getByRole('button', { name: '运行测试' }));
    expect(await screen.findByText('Node.js 轨道全部测试通过')).toBeInTheDocument();
    expect(screen.getByText('已通过 · Node.js 轨道')).toBeInTheDocument();
    expect(document.querySelectorAll('.test-item.is-pass')).toHaveLength(2);
    expect(document.querySelector('.console-out')?.textContent).toBe('hello');
    expect(document.querySelector('.console-out .log-log')).not.toBeNull();
    expect(store.answerOf('ex-sum')).toMatchObject({ correct: true, solved: true, attempts: 1 });
    expect(mocks.runTests).toHaveBeenCalledWith(
      task.starter,
      expect.stringContaining('__run("测试 1", async function () {'),
      { timeout: 6000 },
    );
  });

  it('部分测试失败时展示错误行与非通过 toast', async () => {
    const user = userEvent.setup();
    mocks.runTests.mockResolvedValue({
      ok: false,
      results: [
        { name: '测试 1', ok: true },
        { name: '测试 2', ok: false, error: 'expected 3, got 4' },
      ],
      logs: [],
    });
    renderTask();

    await user.click(screen.getByRole('button', { name: '运行测试' }));
    expect(await screen.findByText('1/2 项测试通过')).toBeInTheDocument();
    expect(document.querySelectorAll('.test-item.is-fail')).toHaveLength(1);
    expect(screen.getByText('expected 3, got 4')).toBeInTheDocument();
    expect(store.answerOf('ex-sum')).toMatchObject({ correct: false, solved: false });
  });

  it('测试未全部执行时提示数量差', async () => {
    const user = userEvent.setup();
    mocks.runTests.mockResolvedValue({
      ok: false,
      results: [{ name: '测试 1', ok: true }],
      logs: [],
    });
    renderTask();

    await user.click(screen.getByRole('button', { name: '运行测试' }));
    expect(await screen.findByText('测试未全部执行（1/2），请查看下方结果')).toBeInTheDocument();
    expect(store.answerOf('ex-sum')).toMatchObject({ correct: false, solved: false });
  });

  it('运行超时不计入练习记录并提示', async () => {
    const user = userEvent.setup();
    mocks.runTests.mockRejectedValue(new Error('执行超过 6000ms 限制'));
    renderTask();

    await user.click(screen.getByRole('button', { name: '运行测试' }));
    expect(await screen.findByText('运行超时，本次不计入练习记录')).toBeInTheDocument();
    expect(screen.getByText('运行环境')).toBeInTheDocument();
    expect(screen.getByText('执行超过 6000ms 限制')).toBeInTheDocument();
    expect(store.answerOf('ex-sum')).toBeNull();
  });

  it('运行环境异常不计入练习记录并提示', async () => {
    const user = userEvent.setup();
    mocks.runTests.mockRejectedValue(new Error('sandbox failed'));
    renderTask();

    await user.click(screen.getByRole('button', { name: '运行测试' }));
    expect(await screen.findByText('运行环境没有就绪，本次不计入练习记录')).toBeInTheDocument();
    expect(store.answerOf('ex-sum')).toBeNull();
  });

  it('运行期间展示加载态并禁用按钮', async () => {
    const user = userEvent.setup();
    let resolveRun: (value: RunResult) => void = () => {};
    mocks.runTests.mockReturnValue(
      new Promise<RunResult>((resolve) => {
        resolveRun = resolve;
      }),
    );
    renderTask();

    await user.click(screen.getByRole('button', { name: '运行测试' }));
    expect(screen.getByText('正在执行测试…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '运行中…' })).toBeDisabled();

    await act(async () => {
      resolveRun(passed);
      await Promise.resolve();
    });
    expect(await screen.findByText('Node.js 轨道全部测试通过')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '运行测试' })).toBeEnabled();
  });

  it('提示、参考答案与重置代码按 v2 文案切换', async () => {
    const user = userEvent.setup();
    renderTask();

    await user.click(screen.getByRole('button', { name: '查看提示' }));
    expect(document.querySelector('.hint-box')).toBeVisible();
    expect(document.querySelector('.hint-box')).toHaveTextContent('使用 reduce 累加。');
    await user.click(screen.getByRole('button', { name: '收起提示' }));
    expect(document.querySelector('.hint-box')).not.toBeVisible();

    await user.click(screen.getByRole('button', { name: '查看参考答案' }));
    expect(screen.getByRole('heading', { name: '参考答案 · Node.js' })).toBeInTheDocument();
    expect(document.querySelector('.reference pre')?.textContent).toBe(task.solution);
    await user.click(screen.getByRole('button', { name: '收起参考答案' }));
    expect(document.querySelector('.reference')).not.toBeVisible();

    const editor = screen.getByRole('textbox', { name: '实现求和' });
    await user.clear(editor);
    await user.type(editor, 'console.log(0)');
    await user.click(screen.getByRole('button', { name: '重置代码' }));
    expect(editor).toHaveValue(task.starter);
    expect(readDraft('ex-sum')).toBe(task.starter);
  });

  it('已答对时展示通过状态，另一轨道通过时提示待完成', () => {
    store.recordAnswer('ex-sum', [], true);
    const view = renderTask();
    expect(screen.getByText('已通过 · Node.js 轨道')).toBeInTheDocument();
    view.unmount();

    store.recordAnswer('ex-sum@py', [], true);
    renderTask();
    expect(screen.getByText('已通过 · Node.js 轨道')).toBeInTheDocument();
    expect(screen.queryByText('Python 轨道已通过，本轨道待完成')).toBeNull();
  });

  it('仅有另一轨道通过时提示本轨道待完成', () => {
    store.recordAnswer('ex-sum@py', [], true);
    renderTask();
    expect(screen.getByText('Python 轨道已通过，本轨道待完成')).toBeInTheDocument();
  });

  it('Python 轨道加载运行时后执行测试并记录 @py 进度', async () => {
    lang.set('python');
    mocks.pythonState.ready = true;
    mocks.runPythonTests.mockResolvedValue({
      ok: true,
      results: [{ name: '测试 1', ok: true }],
      logs: [],
    });
    const user = userEvent.setup();
    renderTask();

    expect(screen.getByText('Pyodide · Python 3.13 · 浏览器内执行')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '运行测试' }));
    expect(await screen.findByText('Python 轨道全部测试通过')).toBeInTheDocument();
    expect(mocks.runTests).not.toHaveBeenCalled();
    expect(mocks.pythonHarness).toHaveBeenCalledWith([
      { name: '测试 1', code: 'assert sum(1, 2) == 3', async: undefined },
    ]);
    expect(store.answerOf('ex-sum@py')).toMatchObject({ correct: true, solved: true });
    expect(store.answerOf('ex-sum')).toBeNull();
    expect(screen.getByText('已通过 · Python 轨道')).toBeInTheDocument();
  });

  it('Python 运行时未就绪时展示加载文案，卸载时取消订阅并清理定时器', async () => {
    vi.useFakeTimers();
    lang.set('python');
    mocks.runPythonTests.mockRejectedValue(new Error('执行超过 8000ms 限制'));
    const view = renderTask();
    expect(mocks.statusListeners).toHaveLength(1);
    expect(mocks.warmPython).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '运行测试' }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText('运行超时，本次不计入练习记录')).toBeInTheDocument();
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    view.unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
