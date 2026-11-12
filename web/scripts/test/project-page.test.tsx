import { Suspense } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectPage from '../app/pages/ProjectPage';
import { loadCatalog, loadProject } from '../app/data/resources';
import { ToastProvider } from '../app/shell/ToastProvider';
import { store } from '../state/store';

const writeText = vi.fn();

function mockClipboard() {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
}

async function renderAt(path: string) {
  const projectId = path.split('/').at(-1) ?? '';
  await loadCatalog();
  await loadProject(projectId);
  const router = createMemoryRouter(
    [{ path: '/project/:projectId', element: <ProjectPage /> }],
    { initialEntries: [path] },
  );
  await act(async () => {
    render(
      <ToastProvider>
        <Suspense fallback={null}>
          <RouterProvider router={router} />
        </Suspense>
      </ToastProvider>,
    );
  });
  expect(document.querySelector('.page')).not.toBeNull();
  return router;
}

beforeEach(() => {
  localStorage.clear();
  store.reset();
  writeText.mockReset();
  mockClipboard();
});

afterEach(cleanup);

describe('ProjectPage', () => {
  it('无效项目显示空状态', async () => {
    await renderAt('/project/not-exist');
    expect(screen.getByText('找不到这个项目。')).toBeInTheDocument();
    expect(document.querySelector('.empty-state')).toBeInTheDocument();
    expect(document.querySelector('.project-hero')).toBeNull();
  });

  it('阶段项目渲染 hero、路线与里程碑清单', async () => {
    await renderAt('/project/p-m1-probe');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('HTTP 探针 CLI');
    expect(document.querySelector('.project-hero .eyebrow')).toHaveTextContent('阶段 0');
    expect(document.querySelector('.badge--amber')).toHaveTextContent('里程碑进度 0/5');
    expect(document.querySelectorAll('.project-hero .badge--muted')).toHaveLength(3);

    expect(screen.getByText('你要交付什么')).toBeInTheDocument();
    expect(screen.getByText('实施路线')).toBeInTheDocument();
    expect(screen.getByText('交付物')).toBeInTheDocument();
    expect(screen.getByText('验收自评')).toBeInTheDocument();
    expect(screen.getByText('项目笔记')).toBeInTheDocument();

    const items = document.querySelectorAll('.milestone');
    expect(items).toHaveLength(5);
    expect(items[0]?.querySelector('.milestone__title')).toHaveTextContent('发起请求并打印响应');
    expect(document.querySelectorAll('.milestone__note')).toHaveLength(0);
  });

  it('勾选里程碑更新进度徽章，再次点击撤销', async () => {
    const user = userEvent.setup();
    await renderAt('/project/p-m1-probe');
    const button = screen.getByRole('button', { name: '标记 发起请求并打印响应 完成' });
    await user.click(button);
    expect(document.querySelectorAll('.milestone')[0]).toHaveClass('is-done');
    expect(document.querySelector('.milestone__box')).toBe(button);
    expect(document.querySelector('.badge--amber')).toHaveTextContent('里程碑进度 1/5');
    expect(store.milestoneDone('p-m1-probe', 'p-m1-probe-m1')).toBe(true);

    await user.click(button);
    expect(document.querySelectorAll('.milestone')[0]).not.toHaveClass('is-done');
    expect(document.querySelector('.badge--amber')).toHaveTextContent('里程碑进度 0/5');
  });

  it('毕业项目渲染 11 个里程碑、6 份模板与里程碑笔记', async () => {
    await renderAt('/project/x-linkhub');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('LinkHub 短链服务');
    expect(document.querySelector('.project-hero .eyebrow')).toHaveTextContent('毕业项目');
    expect(document.querySelector('.badge--amber')).toHaveTextContent('里程碑进度 0/11');
    expect(document.querySelectorAll('.milestone')).toHaveLength(11);
    expect(document.querySelectorAll('.milestone__note')).toHaveLength(11);
    expect(document.querySelectorAll('.template-card')).toHaveLength(6);
    expect(screen.getByText('答辩模板库')).toBeInTheDocument();
  });

  it('毕业里程碑笔记持久化并在重渲染后恢复', async () => {
    const user = userEvent.setup();
    await renderAt('/project/x-linkhub');
    const note = screen.getAllByPlaceholderText('记录这个里程碑的证据位置、缺口与下一步……')[0] as HTMLTextAreaElement;
    await user.type(note, '证据在 docs/m1.md');
    expect(store.milestoneNote('x-linkhub', 'm1')).toBe('证据在 docs/m1.md');

    cleanup();
    await renderAt('/project/x-linkhub');
    const restored = screen.getAllByPlaceholderText('记录这个里程碑的证据位置、缺口与下一步……')[0] as HTMLTextAreaElement;
    expect(restored.value).toBe('证据在 docs/m1.md');
  });

  it('模板复制成功后按钮进入已复制并弹出 toast', async () => {
    const user = userEvent.setup();
    mockClipboard();
    writeText.mockResolvedValue(undefined);
    await renderAt('/project/x-linkhub');
    await user.click(screen.getAllByRole('button', { name: '复制模板' })[0]!);
    expect(await screen.findByRole('button', { name: '已复制' })).toBeInTheDocument();
    expect(screen.getByText('已复制：ADR 模板')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('# ADR-00X'));
  });

  it('模板复制失败时显示复制失败', async () => {
    const user = userEvent.setup();
    mockClipboard();
    writeText.mockRejectedValue(new Error('clipboard denied'));
    await renderAt('/project/x-linkhub');
    await user.click(screen.getAllByRole('button', { name: '复制模板' })[0]!);
    expect(await screen.findByRole('button', { name: '复制失败' })).toBeInTheDocument();
  });
});
