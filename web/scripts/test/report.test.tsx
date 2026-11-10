import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ReportPage from '../app/pages/ReportPage';
import { curriculum, graduationProject } from '../content/index';
import { store } from '../state/store';

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
  .map((stage) => stage.project)
  .filter((project): project is NonNullable<typeof project> => Boolean(project));
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
  it('空进度展示零统计、空错题与 9 条阶段进度', () => {
    render(<ReportPage />);

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
    expect(stageRows).toHaveLength(9);
    expect(stageRows[0]).toHaveTextContent('阶段 0 · 地基：请求、运行时与排障');
    expect(stageRows[0]).toHaveTextContent(`0/${stageTaskCount('s0')}`);
    expect((stageRows[0] as HTMLElement).querySelector('a')).toHaveAttribute('href', '#/stage/s0');
    expect(stageRows[8]).toHaveTextContent('附录：数据结构、性能、架构、工程与 AI 基础设施');
    expect((stageRows[8] as HTMLElement).querySelector('a')).toHaveAttribute('href', '#/stage/appendix');

    expect(screen.getByText('目前没有待攻克的题目——要么你还没开始，要么你已经全部答对了。')).toBeInTheDocument();

    const projects = sectionByHeading('项目进度');
    const projectCards = projects.querySelectorAll('a.panel');
    expect(projectCards).toHaveLength(9);
    expect(within(projects).getByText(graduationProject.title)).toBeInTheDocument();

    const nextUp = sectionByHeading('接下来学什么');
    const nextLinks = nextUp.querySelectorAll('a.btn');
    expect(nextLinks).toHaveLength(3);
    expect(nextLinks[0]).toHaveAttribute('href', '#/lesson/s0-l1');
    expect(nextLinks[0]).toHaveTextContent('从 URL 到响应：请求的四段旅程');
    expect(nextLinks[1]).toHaveAttribute('href', '#/lesson/s0-l2');
  });

  it('答错题目进入待攻克列表，附录阶段显示 A 标签', () => {
    store.recordAnswer('s2-l1-check-3', [2], false);
    store.recordAnswer('a1-check-1', [0], false);
    render(<ReportPage />);

    const stats = document.querySelectorAll('.stat');
    expect(stats[1]).toHaveTextContent('2');
    expect(stats[2]).toHaveTextContent('0%');
    expect(stats[4]).toHaveTextContent('2');

    const rows = document.querySelectorAll('.list-stack .lesson-row');
    expect(rows).toHaveLength(2);
    const first = rows[0] as HTMLElement;
    expect(first.querySelector('.lesson-row__num')).toHaveTextContent('2');
    expect(first.querySelector('.lesson-row__title')).toHaveTextContent(
      'LinkHub 的 POST /v1/links 已在第三方使用。以下哪项最可能构成破坏性变更？',
    );
    expect(first.querySelector('.lesson-row__sub')).toHaveTextContent('资源建模与 HTTP 语义 · 已尝试 1 次');
    expect(first.querySelector('.badge')).toHaveTextContent('重做');
    expect(first).toHaveAttribute('href', '#/lesson/s2-l1');

    const appendixRow = rows[1] as HTMLElement;
    expect(appendixRow.querySelector('.lesson-row__num')).toHaveTextContent('A');
    expect(appendixRow.querySelector('.lesson-row__sub')).toHaveTextContent(
      '复杂度与测量：先能算，再能测 · 已尝试 1 次',
    );
    expect(appendixRow).toHaveAttribute('href', '#/lesson/a1');

    cleanup();
    store.recordAnswer('s2-l1-check-3', [2], true);
    render(<ReportPage />);
    const afterStats = document.querySelectorAll('.stat');
    expect(afterStats[1]).toHaveTextContent('2');
    expect(afterStats[2]).toHaveTextContent('50%');
    expect(afterStats[4]).toHaveTextContent('1');
    const remaining = document.querySelectorAll('.list-stack .lesson-row');
    expect(remaining).toHaveLength(1);
    expect((remaining[0] as HTMLElement).querySelector('.lesson-row__num')).toHaveTextContent('A');
  });

  it('设计题未完成计入错题，Python 轨道与里程碑分别汇总', () => {
    store.recordChecklist('s2-l1-ex-2', [0, 1], 8);
    store.recordAnswer('s2-l1-ex-1@py', [], true);
    store.setLessonDone('s0-l1', true);
    store.toggleMilestone('p0', 'p0-m1');
    render(<ReportPage />);

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
      row.textContent?.includes('阶段 2 · API 设计与契约：把实现藏起来')
    )) as HTMLElement;
    expect(s2Row).toHaveTextContent(`1/${stageTaskCount('s2')}`);

    const projects = sectionByHeading('项目进度');
    const p0Card = [...projects.querySelectorAll('a.panel')].find((card) => (
      card.getAttribute('href') === '#/project/p0'
    )) as HTMLElement;
    const p0 = curriculum.find((stage) => stage.id === 's0')!.project!;
    expect(within(p0Card).getByText(`1/${p0.milestones.length}`)).toBeInTheDocument();
    expect((p0Card.querySelector('.stage-card__bar i') as HTMLElement).style.width).toBe(
      `${Math.round((1 / p0.milestones.length) * 100)}%`,
    );

    const nextUp = sectionByHeading('接下来学什么');
    expect(nextUp.querySelector('a.btn')).toHaveAttribute('href', '#/lesson/s0-l2');
  });
});
