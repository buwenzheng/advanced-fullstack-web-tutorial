import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { m2Index } from '../web/scripts/content/stages/m2/m2-index';
import { m2Tx } from '../web/scripts/content/stages/m2/m2-tx';
import { entryUrl } from './lib/entry';

interface ExerciseData {
  id: string;
  title?: string;
  starter?: string;
  solution?: string;
  checklist?: unknown[];
}

function exerciseOf(source: { exercises: unknown[] }, id: string): ExerciseData {
  const found = (source.exercises as ExerciseData[]).find((item) => item.id === id);
  if (!found) throw new Error(`内容中缺少练习 ${id}`);
  return found;
}

const codeTask = exerciseOf(m2Tx, 'm2-tx-ex-1');
const designTask = exerciseOf(m2Tx, 'm2-tx-ex-2');
const sqlTask = exerciseOf(m2Index, 'm2-index-ex-2');const codeTitle = codeTask.title;
const codeStarter = codeTask.starter;
const codeSolution = codeTask.solution;
const designTitle = designTask.title;
const designCount = designTask.checklist?.length ?? 0;
const sqlTitle = sqlTask.title;
const sqlSolution = sqlTask.solution;
if (!codeTitle || !codeStarter || !codeSolution || !designTitle || !sqlTitle || !sqlSolution) {
  throw new Error('练习题内容缺少标题、starter 或 solution');
}

const SHOT_DIR = 'docs/reviews/frontend-engineering/e3/screenshots';

test.beforeAll(() => {
  mkdirSync(SHOT_DIR, { recursive: true });
});

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

async function gotoReact(page: Page, route: string): Promise<void> {
  await page.goto(entryUrl(route));
  await page.locator('main h1').waitFor();
  await page.waitForLoadState('networkidle');
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: true });
}

test.describe('React 入口交互清单', () => {
  test('MCQ：答错反馈、重试后可再次作答', async ({ page }) => {
    const errors = collectErrors(page);
    await gotoReact(page, '#/lesson/m1-http');
    const quiz = page.locator('.quiz').first();
    await quiz.getByRole('button', { name: /所有用户的 DNS 缓存同时过期/ }).click();
    await quiz.getByRole('button', { name: '提交答案' }).click();
    await expect(quiz.locator('.quiz__feedback')).toHaveClass(/is-wrong/);
    await expect(quiz.locator('.quiz__feedback')).toContainText('答错了');
    await expect(quiz.getByRole('button', { name: '再试一次' })).toBeVisible();
    await shot(page, 'mcq-wrong');

    await quiz.getByRole('button', { name: '再试一次' }).click();
    await expect(quiz.locator('.quiz__feedback')).toHaveCount(0);
    await expect(quiz.getByRole('button', { name: '提交答案' })).toBeVisible();
    await quiz.locator('.opt').first().click();
    await quiz.getByRole('button', { name: '提交答案' }).click();
    await expect(quiz.locator('.quiz__feedback')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('代码题：标准答案通过全部测试，重置恢复 starter', async ({ page }) => {
    const errors = collectErrors(page);
    await gotoReact(page, '#/lesson/m2-tx');
    const exercise = page.locator('.exercise').filter({ hasText: codeTitle });
    const editor = exercise.getByRole('textbox', { name: codeTitle });
    await editor.fill(codeSolution);
    await exercise.getByRole('button', { name: '运行测试' }).click();
    await expect(exercise.locator('.exercise__head')).toContainText('已通过 · Node.js 轨道', {
      timeout: 20_000,
    });
    await expect(exercise.locator('.test-item.is-pass')).toHaveCount(6);
    await expect(exercise.locator('.test-item.is-fail')).toHaveCount(0);
    await shot(page, 'code-task-pass');

    await exercise.getByRole('button', { name: '重置代码' }).click();
    await expect(editor).toHaveValue(codeStarter);
    expect(errors).toEqual([]);
  });

  test('SQL 题：标准答案返回正确结果', async ({ page }) => {
    const errors = collectErrors(page);
    await gotoReact(page, '#/lesson/m2-index');
    const exercise = page.locator('.exercise').filter({ hasText: sqlTitle });
    await exercise.getByRole('textbox', { name: 'SQL 编辑器' }).fill(sqlSolution);
    await exercise.getByRole('button', { name: '执行 SQL' }).click();
    await expect(exercise.locator('.quiz__feedback.is-right')).toContainText('正确');
    await expect(exercise.locator('.tbl-wrap tbody tr')).toHaveCount(3);
    await shot(page, 'sql-task-correct');
    expect(errors).toEqual([]);
  });

  test('方案题：勾满自检清单并刷新保持', async ({ page }) => {
    const errors = collectErrors(page);
    await gotoReact(page, '#/lesson/m2-tx');
    const exercise = page.locator('.exercise').filter({ hasText: designTitle });
    const boxes = exercise.locator('input[type="checkbox"]');
    await expect(boxes).toHaveCount(designCount);
    for (let index = 0; index < designCount; index += 1) {
      await boxes.nth(index).check();
    }
    await expect(exercise).toContainText(`自检 ${designCount}/${designCount} · 已完成`);
    await shot(page, 'design-complete');

    await page.reload();
    await page.locator('main h1').waitFor();
    await page.waitForLoadState('networkidle');
    const reloaded = page.locator('.exercise').filter({ hasText: designTitle });
    await expect(reloaded).toContainText(`自检 ${designCount}/${designCount} · 已完成`);
    await expect(reloaded.locator('input[type="checkbox"]:checked')).toHaveCount(designCount);
    expect(errors).toEqual([]);
  });

  test('草稿：刷新保留输入，重置恢复 starter', async ({ page }) => {
    const errors = collectErrors(page);
    await gotoReact(page, '#/lesson/m2-tx');
    const editor = page.getByRole('textbox', { name: codeTitle });
    await editor.fill('// fixture draft 保留');
    await page.reload();
    await page.locator('main h1').waitFor();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('textbox', { name: codeTitle })).toHaveValue('// fixture draft 保留');

    const exercise = page.locator('.exercise').filter({ hasText: codeTitle });
    await exercise.getByRole('button', { name: '重置代码' }).click();
    await expect(page.getByRole('textbox', { name: codeTitle })).toHaveValue(codeStarter);
    expect(errors).toEqual([]);
  });

  test('@python 语言轨道：切换 Python 默认 Python 且刷新保持，可切回 Node', async ({ page }) => {
    const errors = collectErrors(page);
    await gotoReact(page, '#/lesson/m2-tx');
    await expect(page.getByRole('tab', { name: 'Node.js' })).toHaveAttribute('aria-selected', 'true');

    await page.locator('#lang-switch button[data-lang="python"]').click();
    await expect(page.getByRole('tab', { name: 'Python' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.code-editor__bar')).toContainText('solution.py');
    await shot(page, 'lang-python');

    await page.reload();
    await page.locator('main h1').waitFor();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('tab', { name: 'Python' })).toHaveAttribute('aria-selected', 'true');

    await page.locator('#lang-switch button[data-lang="javascript"]').click();
    await expect(page.getByRole('tab', { name: 'Node.js' })).toHaveAttribute('aria-selected', 'true');
    expect(errors).toEqual([]);
  });

  test('项目：里程碑进度 +1 且刷新保持，毕业项目笔记刷新保持', async ({ page }) => {
    const errors = collectErrors(page);
    await gotoReact(page, '#/project/x-linkhub');
    const badge = page.locator('.project-hero .badge--amber');
    await expect(badge).toHaveText('里程碑进度 0/11');
    await page.locator('.milestone').first().locator('.milestone__box').click();
    await expect(badge).toHaveText('里程碑进度 1/11');

    await page.reload();
    await page.locator('main h1').waitFor();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.project-hero .badge--amber')).toHaveText('里程碑进度 1/11');

    const note = page.locator('.milestone').first().locator('.milestone__note');
    await note.fill('E3.6 里程碑笔记夹具');
    await page.reload();
    await page.locator('main h1').waitFor();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.milestone').first().locator('.milestone__note')).toHaveValue('E3.6 里程碑笔记夹具');
    await shot(page, 'project-persist');
    expect(errors).toEqual([]);
  });

  test('模板：复制模板写剪贴板并弹出提示', async ({ page, context }) => {
    const errors = collectErrors(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'http://127.0.0.1:4173',
    });
    await gotoReact(page, '#/project/x-linkhub');
    const card = page.locator('.template-card').first();
    await card.getByRole('button', { name: '复制模板' }).click();
    await expect(card.getByRole('button', { name: '已复制' })).toBeVisible();
    await expect(page.locator('#toast-host')).toContainText('已复制：');
    const clipboard = await page.evaluate(async () => {
      const target = navigator as unknown as { clipboard: { readText(): Promise<string> } };
      return target.clipboard.readText();
    });
    expect(clipboard.length).toBeGreaterThan(0);
    await shot(page, 'template-copied');
    expect(errors).toEqual([]);
  });

  test('实验台：429 连发、幂等重放与重置清空历史', async ({ page }) => {
    const errors = collectErrors(page);
    await gotoReact(page, '#/lab');

    await page.getByRole('button', { name: '触发限流（429）' }).click();
    for (let index = 0; index < 3; index += 1) {
      const send = page.getByRole('button', { name: '发送请求' });
      await send.click();
      await expect(send).toBeEnabled();
    }
    await expect(page.locator('.badge', { hasText: '429 Too Many Requests' })).toBeVisible();
    const retryRow = page.locator('.tbl-wrap tr').filter({ hasText: 'retry-after' });
    await expect(retryRow).toContainText('3');

    await page.getByRole('button', { name: '幂等键（重复提交）' }).click();
    for (let index = 0; index < 2; index += 1) {
      const send = page.getByRole('button', { name: '发送请求' });
      await send.click();
      await expect(send).toBeEnabled();
    }
    await expect(page.locator('.badge--violet')).toHaveText('幂等重放');
    const replayRow = page.locator('.tbl-wrap tr').filter({ hasText: 'idempotency-replayed' });
    await expect(replayRow).toContainText('true');
    await shot(page, 'lab-429-idempotent');

    await page.getByRole('button', { name: '重置', exact: true }).click();
    await expect(page.getByText('还没有请求记录。')).toBeVisible();
    await expect(page.locator('.tbl-wrap')).toHaveCount(0);
    await shot(page, 'lab-reset');
    expect(errors).toEqual([]);
  });

  test('报告：预置进度后统计与进度条正确', async ({ page }) => {
    const errors = collectErrors(page);
    await page.addInitScript(() => {
      localStorage.setItem('bff-lab-progress-v1', JSON.stringify({
        q: { 's2-l1-check-3': { picked: [2], correct: false, attempts: 1, solved: false } },
        l: {},
        p: {},
        meta: { version: 2, startedAt: 0 },
      }));
    });
    await gotoReact(page, '#/report');
    await expect(page.locator('.stat')).toHaveCount(5);
    await expect(page.locator('.stat').nth(1)).toContainText('1');
    await expect(page.locator('.stat').nth(4)).toContainText('1');
    await expect(page.locator('.bar-row')).toHaveCount(8);
    const wrongRow = page.locator('.list-stack .lesson-row');
    await expect(wrongRow).toHaveCount(1);
    await expect(wrongRow.first()).toContainText('破坏性变更');
    await shot(page, 'report-stats');
    expect(errors).toEqual([]);
  });

  test('搜索：Enter 打开毕业项目，Esc 关闭结果', async ({ page }) => {
    const errors = collectErrors(page);
    await gotoReact(page, '#/');
    const input = page.locator('#search-input');
    await input.focus();
    await input.fill('LinkHub 短链服务');
    const option = page.getByRole('option').first();
    await expect(option).toBeVisible({ timeout: 15_000 });
    await expect(option).toContainText('LinkHub 短链服务');
    await expect(option).toContainText('毕业项目');
    await shot(page, 'search-results');

    await input.press('Enter');
    await expect(page.locator('main h1')).toHaveText('LinkHub 短链服务');
    await expect(page).toHaveURL(/#\/project\/x-linkhub$/);

    await input.focus();
    await input.fill('LinkHub');
    await expect(page.getByRole('option').first()).toBeVisible();
    await input.press('Escape');
    await expect(page.locator('#search-results')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('重置进度：确认后清空记录并删除草稿', async ({ page }) => {
    const errors = collectErrors(page);
    await page.addInitScript(() => {
      localStorage.setItem('bff-lab-progress-v1', JSON.stringify({
        q: { 's2-l1-check-3': { picked: [2], correct: false, attempts: 1, solved: false } },
        l: { 's1-l1': { done: true } },
        p: {},
        meta: { version: 2, startedAt: 0 },
      }));
      localStorage.setItem('bff-lab-drafts-v1', JSON.stringify({ 'm2-tx-ex-1': '// draft to clear' }));
    });
    await gotoReact(page, '#/lesson/m2-tx');
    await expect(page.getByRole('textbox', { name: codeTitle })).toHaveValue('// draft to clear');

    page.once('dialog', (dialog) => {
      void dialog.accept();
    });
    await page.locator('#reset-progress').click();
    await expect(page.locator('#toast-host')).toContainText('学习记录已清空');

    const stored = await page.evaluate(() => {
      const progress = JSON.parse(localStorage.getItem('bff-lab-progress-v1') || '{}');
      return { progress, drafts: localStorage.getItem('bff-lab-drafts-v1') };
    });
    expect(stored.progress.q).toEqual({});
    expect(stored.progress.l).toEqual({});
    expect(stored.progress.p).toEqual({});
    expect(stored.drafts).toBeNull();
    expect(errors).toEqual([]);
  });
});

test.describe('旧进度夹具', () => {
  test('v1 附录 s6 迁移后 b-bigO 显示本讲已掌握', async ({ page }) => {
    const errors = collectErrors(page);
    await page.addInitScript(() => {
      localStorage.setItem('bff-lab-progress-v1', JSON.stringify({
        q: {},
        l: {
          's6-l1': { done: true },
          's6-l2': { done: true },
          's6-l3': { done: true },
          's6-l4': { done: true },
          's6-l5': { done: true },
          's6-l6': { done: true },
        },
        p: {},
        meta: { version: 1, startedAt: 0 },
      }));
    });
    await gotoReact(page, '#/lesson/b-bigO');
    await expect(page.locator('.lesson-head')).toContainText('本讲已掌握');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('bff-lab-progress-v1') || '{}'));
    expect(stored.meta.version).toBe(3);
    expect(stored.l['b-bigO']).toEqual({ done: true });
    expect(stored.l['s6-l1']).toBeUndefined();
    await shot(page, 'legacy-mastered');
    expect(errors).toEqual([]);
  });

  test('v2 BFF 的 s6 迁移到 m3-bff 而非工具箱', async ({ page }) => {
    const errors = collectErrors(page);
    await page.addInitScript(() => {
      localStorage.setItem('bff-lab-progress-v1', JSON.stringify({
        q: {},
        l: { 's6-l1': { done: true } },
        p: {},
        meta: { version: 2, startedAt: 0 },
      }));
    });
    await gotoReact(page, '#/lesson/m3-bff');
    await expect(page.locator('.lesson-head')).toContainText('本讲已掌握');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('bff-lab-progress-v1') || '{}'));
    expect(stored.meta.version).toBe(3);
    expect(stored.l['m3-bff']).toEqual({ done: true });
    expect(stored.l['b-bigO']).toBeUndefined();
    expect(errors).toEqual([]);
  });

  test('种子草稿显示在编辑器；v2 进度下旧 s6 草稿迁到 m3-bff', async ({ page }) => {
    const errors = collectErrors(page);
    await page.addInitScript(() => {
      localStorage.setItem('bff-lab-progress-v1', JSON.stringify({
        q: {},
        l: {},
        p: {},
        meta: { version: 2, startedAt: 0 },
      }));
      localStorage.setItem('bff-lab-drafts-v1', JSON.stringify({
        'm2-tx-ex-1': '// seeded draft',
        's6-l1-ex-1': '// legacy draft',
      }));
    });
    await gotoReact(page, '#/lesson/m2-tx');
    await expect(page.getByRole('textbox', { name: codeTitle })).toHaveValue('// seeded draft');
    const drafts = await page.evaluate(() => JSON.parse(localStorage.getItem('bff-lab-drafts-v1') || '{}'));
    expect(drafts['m3-bff-ex-1']).toBe('// legacy draft');
    expect(drafts['s6-l1-ex-1']).toBeUndefined();
    expect(drafts['b-bigO-ex-1']).toBeUndefined();
    expect(errors).toEqual([]);
  });

  test('种子错误作答显示上次答错', async ({ page }) => {
    const errors = collectErrors(page);
    await page.addInitScript(() => {
      localStorage.setItem('bff-lab-progress-v1', JSON.stringify({
        q: { 's2-l1-check-3': { picked: [2], correct: false, attempts: 1, solved: false } },
        l: {},
        p: {},
        meta: { version: 2, startedAt: 0 },
      }));
    });
    await gotoReact(page, '#/lesson/s2-l1');
    const quiz = page.locator('.quiz').filter({ hasText: '破坏性变更' });
    await expect(quiz.locator('.quiz__feedback.is-wrong')).toContainText('上次答错');
    await shot(page, 'legacy-wrong-answer');
    expect(errors).toEqual([]);
  });
});