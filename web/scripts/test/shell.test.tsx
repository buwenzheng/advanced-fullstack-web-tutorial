import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../app/router';
import { DRAFT_KEY, store } from '../state/store';
import { lang } from '../state/lang';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  localStorage.clear();
  store.reset();
  lang.set('javascript');
  Object.defineProperty(window, 'scrollTo', { value: vi.fn(), writable: true });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { value: vi.fn(), writable: true });
});

describe('React shell', () => {
  it('侧栏规模：9 个阶段、45 个课时、0/45', () => {
    renderAt('/');
    expect(document.querySelectorAll('.stage-node')).toHaveLength(9);
    expect(document.querySelectorAll('.lesson-link')).toHaveLength(45);
    expect(document.getElementById('rail-count')).toHaveTextContent('0/45');
  });

  it('当前课时：s0-l1 为 current，s0 自动展开并 active', () => {
    renderAt('/lesson/s0-l1');
    const link = document.querySelector('.lesson-link[data-lesson="s0-l1"]');
    expect(link).toHaveClass('is-current');
    expect(link).toHaveAttribute('aria-current', 'page');
    const node = document.querySelector('.stage-node[data-stage="s0"]');
    expect(node).toHaveClass('is-open');
    expect(node).toHaveClass('is-active');
    expect(node?.querySelector('.stage-node__head')).toHaveAttribute('aria-expanded', 'true');
  });

  it('进度联动：标记课时后总计数与阶段徽标更新', () => {
    renderAt('/lesson/s0-l1');
    act(() => store.setLessonDone('s0-l1', true));
    expect(document.getElementById('rail-count')).toHaveTextContent('1/45');
    const s0 = document.querySelector('.stage-node[data-stage="s0"]');
    expect(within(s0 as HTMLElement).getByText('1/3')).toBeInTheDocument();
  });

  it('搜索键盘：↓ + Enter 打开毕业项目并清空输入', async () => {
    const user = userEvent.setup();
    const router = renderAt('/');
    const input = screen.getByRole('combobox');
    await user.type(input, 'LinkHub 短链服务');
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getAllByRole('option')).toHaveLength(1);
    await user.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/project/p-graduation'));
    expect(input).toHaveValue('');
    expect(listbox).toHaveAttribute('hidden');
  });

  it('搜索空态：没有匹配的课程内容', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.type(screen.getByRole('combobox'), '不存在的词');
    expect(screen.getByText('没有匹配的课程内容')).toBeInTheDocument();
  });

  it('语言轨道：点击 Python 写入 localStorage 并同步 aria-pressed', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const python = screen.getByRole('button', { name: 'Python' });
    await user.click(python);
    expect(python).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('bff-lab-lang-v1')).toBe('python');
  });

  it('抽屉：菜单打开、scrim 关闭', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(screen.getByRole('button', { name: '打开课程目录' }));
    const sidebar = document.getElementById('sidebar');
    const scrim = document.getElementById('scrim');
    expect(sidebar).toHaveClass('is-open');
    expect(scrim).not.toHaveAttribute('hidden');
    await user.click(scrim as HTMLElement);
    expect(sidebar).not.toHaveClass('is-open');
    expect(scrim).toHaveAttribute('hidden');
  });

  it('重置：进度归零、草稿删除、toast 出现', async () => {
    act(() => store.setLessonDone('s0-l1', true));
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ draft: true }));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderAt('/');
    expect(document.getElementById('rail-count')).toHaveTextContent('1/45');
    await user.click(screen.getByRole('button', { name: '清空学习记录' }));
    expect(confirmSpy).toHaveBeenCalledWith('确定要清空全部学习记录吗？此操作不可撤销。');
    expect(document.getElementById('rail-count')).toHaveTextContent('0/45');
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(await screen.findByText('学习记录已清空')).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('无效课时：空状态与返回总览', () => {
    renderAt('/lesson/not-exist');
    expect(screen.getByText('找不到这一讲，可能是链接有误。')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回总览' })).toHaveAttribute('href', '/');
  });

  it('无效阶段/项目与未知路由', () => {
    renderAt('/stage/not-exist');
    expect(screen.getByText('找不到这个阶段。')).toBeInTheDocument();
    cleanup();
    renderAt('/project/not-exist');
    expect(screen.getByText('找不到这个项目。')).toBeInTheDocument();
    cleanup();
    const router = renderAt('/unknown-route');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('把前端的手感，接后端的世界');
    expect(router.state.location.pathname).toBe('/unknown-route');
  });
});
