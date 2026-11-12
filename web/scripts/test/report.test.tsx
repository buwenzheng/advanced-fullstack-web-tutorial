import { Suspense } from 'react';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ReportPage from '../app/pages/ReportPage';
import { loadAllStages, loadCatalog, loadGraduation } from '../app/data/resources';
import { curriculum, graduationProject } from '../content/index';
import { store } from '../state/store';

async function renderReport() {
  await loadCatalog();
  await loadAllStages();
  await loadGraduation();
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <ReportPage />
      </Suspense>,
    );
  });
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
}

function sectionByHeading(title: string): HTMLElement {
  const heading = screen.getByRole('heading', { name: title });
  return heading.closest('section') as HTMLElement;
}

function stageTaskCount(stageId: string): number {
  const stage = curriculum.find((item) => item.id === stageId)!;
  return new Set(
    stage.lessons.flatMap((lesson) => [...lesson.checks, ...lesson.exercises].map((task) => task.id)),
  ).size;
}

const stageProjects = curriculum
  .flatMap((stage) => stage.projects ?? (stage.project ? [stage.project] : []));
const totalMilestones = [...stageProjects, graduationProject]
  .reduce((sum, project) => sum + project.milestones.length, 0);
const codeTaskCount = curriculum
  .flatMap((stage) => stage.lessons)
  .flatMap((lesson) => lesson.exercises)
  .filter((exercise) => exercise.kind === 'code' && exercise.python).length;

beforeEach(() => {
  localStorage.clear();
  store.reset();
});

afterEach(cleanup);

describe('ReportPage', () => {
  it('空进度展示零统计、空错题与 6 条内容块进度', async () => {
    await renderReport();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('学习报告');
    const stats = document.querySelectorAll('.stat');
    expect(stats).toHaveLength(5);
    expect(stats[0]).toHaveTextContent('0/45');
    expect(stats[0]).toHaveTextContent('课程掌握');
    expect(stats[1]).toHaveTextContent('0');
    expect(stats[1]).toHaveTextContent('已作答题目');
    expect(stats[2]).toHaveTextContent('0%');
    expect(stats[2]).toHaveTextContent('题目通过率');
    expect(stats[3]).toHaveTextContent(`0/${totalMilestones}`);
    expect(stats[3]).toHaveTextContent('项目里程碑');
    expect(stats[4]).toHaveTextContent('0');
    expect(stats[4]).toHaveTextContent('待攻克题目');

    const tracks = sectionByHeading('代码练习轨道');
    const trackRows = tracks.querySelectorAll('.bar-row');
    expect(trackRows).toHaveLength(2);
    expect(within(trackRows[0] as HTMLElement).getByText('Node.js 轨道')).toBeInTheDocument();
    expect(within(trackRows[0] as HTMLElement).getByText(`0/${codeTaskCount}`)).toBeInTheDocument();
    expect(within(trackRows[1] as HTMLElement).getByText('Python 轨道')).toBeInTheDocument();
    expect(within(trackRows[1] as HTMLElement).getByText(`0/${codeTaskCount}`)).toBeInTheDocument();

    const stages = sectionByHeading('各阶段掌握度');
    const stageRows = stages.querySelectorAll('.bar-row');
    expect(stageRows).toHaveLength(6);
    expect(stageRows[0]).toHaveTextContent('阶段 0 · 地基：请求、运行时与排障');
    expect(stageRows[0]).toHaveTextContent(`0/${stageTaskCount('m1')}`);
    expect((stageRows[0] as HTMLElement).querySelector('a')).toHaveAttribute('href', '#/stage/m1');
    expect(stageRows[5]).toHaveTextContent('工具箱');
    expect((stageRows[5] as HTMLElement).querySelector('a')).toHaveAttribute('href', '#/stage/b');

    expect(screen.getByText('目前没有待攻克的题目——要么你还没开始，要么你已经全部答对了。')).toBeInTheDocument();

    const projects = sectionByHeading('项目进度');
    const projectCards = projects.querySelectorAll('a.panel');
    expect(projectCards).toHaveLength(8);
    expect(within(projects).getByText(graduationProject.title)).toBeInTheDocument();

    const nextUp = sectionByHeading('接下来学什么');
    const nextLinks = nextUp.querySelectorAll('a.btn');
    expect(nextLinks).toHaveLength(3);
    expect(nextLinks[0]).toHaveAttribute('href', '#/lesson/m1-http');
    expect(nextLinks[0]).toHaveTextContent('从 URL 到响应：请求的四段旅程');
    expect(nextLinks[1]).toHaveAttribute('href', '#/lesson/m1-runtime');
  });

  it('答错题目进入待攻克列表，附录阶段显示 A 标签', async () => {
    store.recordAnswer('m2-resource-check-3', [2], false);
    store.recordAnswer('b-bigO-check-1', [0], false);
    await renderReport();

    const stats = document.querySelectorAll('.stat');
    expect(stats[1]).toHaveTextContent('2');
    expect(stats[2]).toHaveTextContent('0%');
    expect(stats[4]).toHaveTextContent('2');

    const rows = document.querySelectorAll('.list-stack .lesson-row');
    expect(rows).toHaveLength(2);
    const first = rows[0] as HTMLElement;
    expect(first.querySelector('.lesson-row__num')).toHaveTextContent('1');
    expect(first.querySelector('.lesson-row__title')).toHaveTextContent(
      'LinkHub 的 POST /v1/links 已在第三方使用。以下哪项最可能构成破坏性变更？',
    );
    expect(first.querySelector('.lesson-row__sub')).toHaveTextContent('资源建模与 HTTP 语义 · 已尝试 1 次');
    expect(first.querySelector('.badge')).toHaveTextContent('重做');
    expect(first).toHaveAttribute('href', '#/lesson/m2-resource');

    const appendixRow = rows[1] as HTMLElement;
    expect(appendixRow.querySelector('.lesson-row__num')).toHaveTextContent('A');
    expect(appendixRow.querySelector('.lesson-row__sub')).toHaveTextContent(
      '复杂度与测量：先能算，再能测 · 已尝试 1 次',
    );
    expect(appendixRow).toHaveAttribute('href', '#/lesson/b-bigO');

    cleanup();
    store.recordAnswer('m2-resource-check-3', [2], true);
    await renderReport();
    const afterStats = document.querySelectorAll('.stat');
    expect(afterStats[1]).toHaveTextContent('2');
    expect(afterStats[2]).toHaveTextContent('50%');
    expect(afterStats[4]).toHaveTextContent('1');
    const remaining = document.querySelectorAll('.list-stack .lesson-row');
    expect(remaining).toHaveLength(1);
    expect((remaining[0] as HTMLElement).querySelector('.lesson-row__num')).toHaveTextContent('A');
  });

  it('设计题未完成计入错题，Python 轨道与里程碑分别汇总', async () => {
    store.recordChecklist('m2-resource-ex-2', [0, 1], 8);
    store.recordAnswer('m2-resource-ex-1@py', [], true);
    store.setLessonDone('m1-http', true);
    store.toggleMilestone('p-m1-probe', 'p-m1-probe-m1');
    await renderReport();

    const stats = document.querySelectorAll('.stat');
    expect(stats[0]).toHaveTextContent('1/45');
    expect(stats[1]).toHaveTextContent('2');
    expect(stats[2]).toHaveTextContent('50%');
    expect(stats[3]).toHaveTextContent(`1/${totalMilestones}`);
    expect(stats[4]).toHaveTextContent('1');

    const designRow = document.querySelector('.list-stack .lesson-row') as HTMLElement;
    expect(designRow.querySelector('.lesson-row__title')).toHaveTextContent('LinkHub 资源树与版本化');
    expect(designRow.querySelector('.lesson-row__sub')).toHaveTextContent(
      '资源建模与 HTTP 语义 · 自检清单未完成',
    );

    const tracks = sectionByHeading('代码练习轨道');
    const trackRows = tracks.querySelectorAll('.bar-row');
    expect(within(trackRows[0] as HTMLElement).getByText(`0/${codeTaskCount}`)).toBeInTheDocument();
    expect(within(trackRows[1] as HTMLElement).getByText(`1/${codeTaskCount}`)).toBeInTheDocument();
    expect(((trackRows[1] as HTMLElement).querySelector('i') as HTMLElement).style.width).toBe(
      `${Math.round((1 / codeTaskCount) * 100)}%`,
    );

    const stages = sectionByHeading('各阶段掌握度');
    const s2Row = [...stages.querySelectorAll('.bar-row')].find((row) => (
      row.textContent?.includes('阶段 1 · 后端交付：数据与 API 契约')
    )) as HTMLElement;
    expect(s2Row).toHaveTextContent(`1/${stageTaskCount('m2')}`);

    const projects = sectionByHeading('项目进度');
    const probeCard = [...projects.querySelectorAll('a.panel')].find((card) => (
      card.getAttribute('href') === '#/project/p-m1-probe'
    )) as HTMLElement;
    const probeProject = curriculum.find((stage) => stage.id === 'm1')!.project!;
    expect(within(probeCard).getByText(`1/${probeProject.milestones.length}`)).toBeInTheDocument();
    expect((probeCard.querySelector('.stage-card__bar i') as HTMLElement).style.width).toBe(
      `${Math.round((1 / probeProject.milestones.length) * 100)}%`,
    );

    const nextUp = sectionByHeading('接下来学什么');
    expect(nextUp.querySelector('a.btn')).toHaveAttribute('href', '#/lesson/m1-runtime');
  });
});
