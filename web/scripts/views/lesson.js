import { h } from '../ui.js';
import { store, formatDuration } from '../store.js';
import { lessonById, stageById, stageLabel } from '../content/index.js';
import { isLessonMastered, lessonTasks, taskSolved } from '../progress.js';
import { renderBlock } from './blocks.js';
import { renderTask } from '../engine/exercise.js';

function checkIcon() {
  return h('span', { html: '<svg viewBox="0 0 20 20"><path d="M4 10.5l4 4 8-9"/></svg>' });
}

export function renderLesson(lessonId) {
  const lesson = lessonById(lessonId);
  if (!lesson) {
    return h('div', { class: 'page' },
      h('div', { class: 'empty-state', text: '找不到这一讲，可能是链接有误。' }),
      h('p', { style: 'margin-top:16px' }, h('a', { class: 'btn btn--ghost btn--sm', href: '#/', text: '返回总览' })));
  }
  const stage = stageById(lesson.stageId);
  const siblings = stage ? stage.lessons : [];
  const index = siblings.findIndex((item) => item.id === lesson.id);
  const prev = index > 0 ? siblings[index - 1] : null;
  const next = index < siblings.length - 1 ? siblings[index + 1] : null;

  const tasks = lessonTasks(lesson);
  const isDraft = lesson.status !== 'ready';

  const doneBtn = h('button', { class: 'btn btn--sm', type: 'button' });
  doneBtn.addEventListener('click', () => {
    store.setLessonDone(lesson.id, !store.lessonDone(lesson.id));
  });

  const verifiedBadge = h('span', { class: 'badge' });
  const masteredBadge = h('span', { class: 'badge badge--teal', text: '本讲已掌握' });

  function refreshMeta() {
    const solved = tasks.filter(taskSolved).length;
    const verified = tasks.length > 0 && solved === tasks.length;
    verifiedBadge.textContent = `已验证 ${solved}/${tasks.length}`;
    verifiedBadge.className = `badge ${verified ? 'badge--teal' : 'badge--muted'}`;
    verifiedBadge.style.display = isDraft ? 'none' : '';
    masteredBadge.style.display = !isDraft && isLessonMastered(lesson) ? '' : 'none';
    const manual = store.lessonDone(lesson.id);
    doneBtn.className = `btn btn--sm ${manual ? 'btn--primary' : 'btn--ghost'}`;
    doneBtn.textContent = manual ? '已掌握' : '标记为已掌握';
    doneBtn.style.display = isDraft || (isLessonMastered(lesson) && !manual) ? 'none' : '';
  }
  refreshMeta();

  const cleanups = [store.subscribe(refreshMeta)];
  const page = h('article', { class: 'page' });
  page.__dispose = () => cleanups.forEach((fn) => fn());

  page.appendChild(h('header', { class: 'lesson-head' },
    h('div', { class: 'lesson-head__meta' },
      stage ? h('a', { class: 'badge badge--teal', href: `#/stage/${stage.id}`, text: stage.appendix ? stage.title : `${stageLabel(stage)} · ${stage.title}` }) : null,
      h('span', { class: 'badge badge--muted', text: formatDuration(lesson.duration) }),
      h('span', { class: 'badge badge--muted', text: `${lesson.checks.length} 道检查点 · ${lesson.exercises.length} 道练习` }),
      isDraft ? h('span', { class: 'badge badge--amber', text: '草稿' }) : null,
      verifiedBadge,
      masteredBadge),
    h('h1', { text: lesson.title }),
    lesson.subtitle ? h('p', { class: 'lesson-head__lede', text: lesson.subtitle }) : null));

  if (isDraft) {
    page.appendChild(h('div', { class: 'draft-banner' },
      h('strong', { text: '本讲内容建设中' }),
      h('p', { text: 'M0 已锁定本讲的 ID、时长与项目归属，正文、检查题与练习会在后续模块补齐。当前可先浏览阶段目标与项目验收标准。' })));
  }

  if (!isDraft && lesson.objectives?.length) {
    page.appendChild(h('div', { class: 'objectives' },
      h('h3', { text: '学完这一讲，你能做到' }),
      h('ul', {}, lesson.objectives.map((item) => h('li', {}, checkIcon(), h('span', { text: item }))))));
  }

  const body = h('div', { class: 'lesson-body' });
  lesson.blocks.forEach((block) => body.appendChild(renderBlock(block)));
  page.appendChild(body);

  if (lesson.checks.length) {
    const section = h('section', { class: 'lblock', style: 'margin-top:40px' },
      h('h3', { class: 'lblock__title', text: '概念检查' }),
      h('p', { class: 'muted tiny', style: 'margin:-4px 0 14px', text: '答对会自动记录，可以随时重做。' }));
    lesson.checks.forEach((question) => {
      const node = renderTask(question);
      if (typeof node.__dispose === 'function') cleanups.push(node.__dispose);
      section.appendChild(node);
    });
    page.appendChild(section);
  }

  if (lesson.exercises.length) {
    const section = h('section', { class: 'lblock', style: 'margin-top:36px' },
      h('h3', { class: 'lblock__title', text: '本讲练习' }),
      h('p', { class: 'muted tiny', style: 'margin:-4px 0 14px', text: '练习在浏览器里真实运行：代码会被执行，SQL 会被解析，结果自动比对。' }));
    lesson.exercises.forEach((task) => {
      const node = renderTask(task);
      if (typeof node.__dispose === 'function') cleanups.push(node.__dispose);
      section.appendChild(node);
    });
    page.appendChild(section);
  }

  page.appendChild(h('div', { style: 'margin-top:32px;display:flex;gap:12px;flex-wrap:wrap;align-items:center' },
    doneBtn,
    stage?.project ? h('a', { class: 'btn btn--ghost btn--sm', href: `#/project/${stage.project.id}`, text: `进入阶段项目：${stage.project.title}` }) : null));

  const nav = h('nav', { class: 'lesson-nav', 'aria-label': '课程翻页' });
  if (prev) nav.appendChild(h('a', { href: `#/lesson/${prev.id}` }, h('span', { text: '← 上一讲' }), h('strong', { text: prev.title })));
  if (next) nav.appendChild(h('a', { class: 'is-next', href: `#/lesson/${next.id}` }, h('span', { text: '下一讲 →' }), h('strong', { text: next.title })));
  if (!prev && !next && stage?.project) {
    nav.appendChild(h('a', { class: 'is-next', href: `#/project/${stage.project.id}` }, h('span', { text: '本阶段结束 →' }), h('strong', { text: stage.project.title })));
  }
  page.appendChild(nav);

  return page;
}
