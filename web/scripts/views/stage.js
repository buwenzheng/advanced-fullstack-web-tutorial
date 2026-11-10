import { h } from '../ui.js';
import { formatDuration } from '../state/store';
import { stageById } from '../content/index';
import { isLessonMastered, stageMastery } from '../state/progress';

const ACCENT_VAR = {
  teal: 'var(--teal)',
  amber: 'var(--amber)',
  violet: 'var(--violet)',
  rose: 'var(--rose)',
  blue: 'var(--blue)',
  green: 'var(--green)',
};

export function renderStage(stageId) {
  const stage = stageById(stageId);
  if (!stage) {
    return h('div', { class: 'page' }, h('div', { class: 'empty-state', text: '找不到这个阶段。' }));
  }

  const page = h('div', { class: 'page' });
  const accent = ACCENT_VAR[stage.accent] || 'var(--teal)';
  const doneCount = stageMastery(stage).done;

  page.appendChild(h('section', { class: 'stage-hero', style: `--accent:${accent}` },
    h('span', { class: 'stage-hero__num', text: stage.appendix ? 'APPENDIX' : `STAGE ${String(stage.index).padStart(2, '0')}` }),
    h('h1', { text: stage.title }),
    h('p', { text: stage.subtitle }),
    h('div', { class: 'stage-hero__tags' },
      h('span', { class: 'badge badge--muted', text: formatDuration(stage.duration) }),
      h('span', { class: 'badge badge--muted', text: `${stage.lessons.length} 讲` }),
      stage.appendix ? h('span', { class: 'badge badge--teal', text: '附录 · 性能、架构、工程与 AI 基础设施' }) : null,
      h('span', { class: 'badge badge--muted', text: `已完成 ${doneCount}/${stage.lessons.length}` }),
      ...(stage.keywords || []).map((keyword) => h('span', { class: 'badge badge--blue', text: keyword })))));

  const left = h('div', { class: 'list-stack' });
  left.appendChild(h('div', { class: 'section__head', style: 'margin-bottom:0' },
    h('div', {},
      h('h2', { text: '本阶段课程' }),
      h('p', { text: '按顺序学；标为草稿的讲次会在后续模块补齐正文与练习。' }))));

  stage.lessons.forEach((lesson, index) => {
    const done = isLessonMastered(lesson);
    const checkCount = lesson.checks.length + lesson.exercises.length;
    left.appendChild(h('a', {
      class: 'lesson-row',
      href: `#/lesson/${lesson.id}`,
    },
    h('span', { class: 'lesson-row__num', text: stage.appendix ? `A.${index + 1}` : `${stage.index}.${index + 1}` }),
    h('div', {},
      h('div', { class: 'lesson-row__title', text: lesson.title }),
      h('div', { class: 'lesson-row__sub', text: lesson.subtitle || '' })),
    h('div', { class: 'lesson-row__right' },
      h('span', { text: formatDuration(lesson.duration) }),
      lesson.status !== 'ready'
        ? h('span', { class: 'badge badge--muted', text: '草稿' })
        : h('span', { text: `${checkCount} 题` }),
      done ? h('span', { class: 'badge badge--teal', text: '已掌握' }) : null)));
  });

  const right = h('aside', { class: 'list-stack' },
    h('div', { class: 'aside-card' },
      h('h3', { text: '阶段目标' }),
      h('p', { text: stage.goal })),
    stage.outcome?.length ? h('div', { class: 'aside-card' },
      h('h3', { text: '达成标准' }),
      h('ul', {}, stage.outcome.map((item) => h('li', { text: item })))) : null,
    stage.project ? h('a', {
      class: 'panel',
      href: `#/project/${stage.project.id}`,
      style: 'display:block;padding:16px;text-decoration:none;color:inherit',
    },
    h('span', { class: 'eyebrow', text: '阶段项目' }),
    h('h3', { style: 'font-size:15px;margin:8px 0 6px', text: stage.project.title }),
    h('p', { class: 'tiny muted', style: 'line-height:1.7', text: stage.project.brief })) : null);

  page.appendChild(h('div', { class: 'split', style: 'margin-top:28px' }, left, right));
  return page;
}
