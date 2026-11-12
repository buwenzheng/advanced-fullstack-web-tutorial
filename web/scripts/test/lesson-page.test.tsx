import { Suspense } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LessonView } from '../app/pages/LessonPage';
import { loadCatalog, loadLessonContext } from '../app/data/resources';
import { routes } from '../app/router';
import { lessonById, stageById } from '../content/index';
import { m1Http } from '../content/stages/m1/m1-http';
import type { Lesson } from '../content/types';
import { lang } from '../state/lang';
import { store } from '../state/store';

async function renderAt(path: string) {
  const lessonId = path.split('/').at(-1) ?? '';
  await loadCatalog();
  await loadLessonContext(lessonId);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <RouterProvider router={router} />
      </Suspense>,
    );
  });
  expect(document.querySelector('.page')).not.toBeNull();
  return router;
}

beforeEach(() => {
  localStorage.clear();
  store.reset();
  lang.set('javascript');
  Object.defineProperty(window, 'scrollTo', { value: vi.fn(), writable: true });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { value: vi.fn(), writable: true });
});

afterEach(cleanup);

describe('LessonPage', () => {
  it('无效课时渲染空状态与返回总览', async () => {
    await renderAt('/lesson/not-exist');
    expect(screen.getByText('找不到这一讲，可能是链接有误。')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回总览' })).toHaveAttribute('href', '/');
  });

  it('m1-http 渲染 meta、目标、12 类块区域、检查题与翻页', async () => {
    await renderAt('/lesson/m1-http');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('从 URL 到响应：请求的四段旅程');
    expect(screen.getByText(m1Http.subtitle)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /阶段 0 · 地基/ })).toHaveAttribute('href', '#/stage/m1');
    expect(screen.getByText('55 分钟')).toBeInTheDocument();
    expect(screen.getByText('3 道检查点 · 2 道练习')).toBeInTheDocument();
    expect(screen.getByText('已验证 0/5')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: '学完这一讲，你能做到' })).toBeInTheDocument();
    expect(document.querySelectorAll('.objectives li')).toHaveLength(m1Http.objectives.length);
    expect(document.querySelectorAll('.lesson-body > *')).toHaveLength(m1Http.blocks.length);
    expect(document.querySelector('.lesson-body .callout--analogy')).not.toBeNull();
    expect(document.querySelector('.lesson-body .flow__step')).not.toBeNull();
    expect(document.querySelectorAll('.lesson-body .code-tabs [role="tab"]')).toHaveLength(2);

    expect(screen.getByRole('heading', { name: '概念检查' })).toBeInTheDocument();
    expect(document.querySelectorAll('.quiz')).toHaveLength(3);
    expect(document.querySelectorAll('.quiz__head')[0]).toHaveTextContent('单选题');
    expect(document.querySelectorAll('.quiz__head')[1]).toHaveTextContent('多选题');
    expect(screen.getByRole('heading', { name: '本讲练习' })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: '标记为已掌握' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '进入阶段项目：HTTP 探针 CLI' })).toHaveAttribute(
      'href',
      '#/project/p-m1-probe',
    );
    expect(screen.getByRole('link', { name: /下一讲/ })).toHaveAttribute('href', '#/lesson/m1-runtime');
    expect(screen.queryByRole('link', { name: /上一讲/ })).toBeNull();
  });

  it('掌握按钮写入进度并展示已掌握徽标', async () => {
    const user = userEvent.setup();
    await renderAt('/lesson/m1-http');
    await user.click(screen.getByRole('button', { name: '标记为已掌握' }));
    expect(store.lessonDone('m1-http')).toBe(true);
    expect(screen.getByRole('button', { name: '已掌握' })).toBeInTheDocument();
    expect(screen.getByText('本讲已掌握')).toBeInTheDocument();
  });

  it('草稿课时隐藏 objectives 与掌握按钮并展示横幅', async () => {
    const lesson = lessonById('m1-http')!;
    const stage = stageById('m1')!;
    const draftLesson = { ...lesson, status: 'draft' } as unknown as Lesson;
    await loadCatalog();
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <LessonView context={{ lesson: draftLesson, stage, prev: null, next: null }} />
        </Suspense>,
      );
    });

    const banner = document.querySelector('.draft-banner');
    expect(banner).not.toBeNull();
    expect(banner).toHaveTextContent('本讲内容建设中');
    expect(screen.getByText('草稿')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '学完这一讲，你能做到' })).toBeNull();
    expect(document.querySelector('.objectives')).toBeNull();
    expect(screen.queryByText(/已验证/)).toBeNull();
    const doneButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === '标记为已掌握',
    );
    expect(doneButton).toHaveStyle({ display: 'none' });
    expect(document.querySelectorAll('.lesson-body > *')).toHaveLength(m1Http.blocks.length);
  });

  it('M2 API 章链到 p-m2-api', async () => {
    await renderAt('/lesson/m2-resource');
    expect(screen.getByRole('link', { name: /进入阶段项目：/ })).toHaveAttribute('href', '#/project/p-m2-api');
  });

  it('M2 数据章链到 p-m2-data', async () => {
    await renderAt('/lesson/m2-sql');
    expect(screen.getByRole('link', { name: /进入阶段项目：/ })).toHaveAttribute('href', '#/project/p-m2-data');
  });

  it('M3 产品章链到 p-m3-web', async () => {
    await renderAt('/lesson/m3-bff');
    expect(screen.getByRole('link', { name: /进入阶段项目：/ })).toHaveAttribute('href', '#/project/p-m3-web');
  });

  it('语言切换整页重挂载：代码轨道重置且已答状态保留', async () => {
    const user = userEvent.setup();
    store.recordAnswer('m1-http-check-1', [1], true);
    await renderAt('/lesson/m1-http');

    expect(document.querySelectorAll('[role="tab"]')[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('答对了')).toBeInTheDocument();

    await user.click(document.querySelectorAll('[role="tab"]')[1] as HTMLElement);
    expect(document.querySelectorAll('[role="tab"]')[1]).toHaveAttribute('aria-selected', 'true');

    await act(async () => {
      lang.set('python');
    });
    expect(localStorage.getItem('bff-lab-lang-v1')).toBe('python');
    expect(document.querySelectorAll('[role="tab"]')[1]).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelectorAll('[role="tab"]')[0]).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('答对了')).toBeInTheDocument();
    expect(document.querySelectorAll('.quiz .opt[disabled]')).toHaveLength(4);

    await act(async () => {
      lang.set('javascript');
    });
    expect(document.querySelectorAll('[role="tab"]')[1]).toHaveAttribute('aria-selected', 'false');
  });
});
