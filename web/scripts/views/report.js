import { h } from '../ui.js';
import { store } from '../store.js';
import { curriculum, allLessons, graduationProject, stageLabel } from '../content/index';
import { courseMastery, isLessonMastered, trackSolved } from '../progress.js';

function taskLabel(task) {
  if (task.kind === 'mcq') return task.prompt || task.question || '概念检查';
  return task.title || '练习';
}

function collectTasks() {
  const map = new Map();
  curriculum.forEach((stage) => {
    stage.lessons.forEach((lesson) => {
      [...lesson.checks, ...lesson.exercises].forEach((task) => {
        map.set(task.id, { task, lesson, stage });
      });
    });
  });
  return map;
}

function mergeAnswers(state, questionMap) {
  const map = new Map();
  Object.entries(state.q).forEach(([rawId, value]) => {
    const id = rawId.split('@')[0];
    if (!questionMap.has(id)) return;
    const entry = map.get(id) || { attempts: 0, correct: false, solved: false };
    entry.attempts += value.attempts || 0;
    entry.correct = entry.correct || Boolean(value.correct);
    entry.solved = entry.solved || Boolean(value.solved);
    map.set(id, entry);
  });
  return map;
}

export function renderReport() {
  const page = h('div', { class: 'page' });
  const state = store.get();
  const questionMap = collectTasks();

  const answeredMap = mergeAnswers(state, questionMap);
  const answered = [...answeredMap.entries()].filter(([, value]) => value.attempts > 0);
  const answeredCorrect = answered.filter(([, value]) => value.solved).length;
  const accuracy = answered.length ? Math.round((answeredCorrect / answered.length) * 100) : 0;
  const mastery = courseMastery();
  const wrongList = answered.filter(([, value]) => !value.solved)
    .map(([id]) => questionMap.get(id))
    .filter(Boolean);

  const projectEntries = [
    ...curriculum.map((stage) => stage.project).filter(Boolean),
    graduationProject,
  ];

  const totalMilestones = projectEntries.reduce((sum, project) => sum + project.milestones.length, 0);
  const doneMilestones = projectEntries.reduce((sum, project) => (
    sum + project.milestones.filter((milestone) => store.milestoneDone(project.id, milestone.id)).length
  ), 0);

  page.appendChild(h('div', { class: 'section__head', style: 'margin-bottom:18px' },
    h('div', {},
      h('h1', { text: '学习报告' }),
      h('p', { text: '所有数据保存在本机浏览器。它回答一个具体问题：哪些知识点你已经真的掌握了，哪些只是读过去了。' }))));

  page.appendChild(h('div', { class: 'stat-grid' },
    h('div', { class: 'stat is-teal' }, h('b', { text: `${mastery.done}/${mastery.total}` }), h('span', { text: '课程掌握' })),
    h('div', { class: 'stat is-violet' }, h('b', { text: `${answered.length}` }), h('span', { text: '已作答题目' })),
    h('div', { class: 'stat is-amber' }, h('b', { text: `${accuracy}%` }), h('span', { text: '题目通过率' })),
    h('div', { class: 'stat' }, h('b', { text: `${doneMilestones}/${totalMilestones}` }), h('span', { text: '项目里程碑' })),
    h('div', { class: 'stat is-rose' }, h('b', { text: String(wrongList.length) }), h('span', { text: '待攻克题目' }))));

  const codeTasks = [...questionMap.values()].map((entry) => entry.task)
    .filter((task) => task.kind === 'code' && task.python);
  if (codeTasks.length) {
    const nodeDone = codeTasks.filter((task) => trackSolved(task, 'javascript')).length;
    const pythonDone = codeTasks.filter((task) => trackSolved(task, 'python')).length;
    const lane = (label, done, tone) => {
      const percent = Math.round((done / codeTasks.length) * 100);
      return h('div', { class: 'bar-row' },
        h('span', { class: 'bar-row__label', text: label }),
        h('div', { class: 'bar-row__track' }, h('i', { style: `width:${percent}%;background:${tone}` })),
        h('span', { class: 'bar-row__val', text: `${done}/${codeTasks.length}` }));
    };
    page.appendChild(h('section', { class: 'section' },
      h('div', { class: 'section__head' },
        h('div', {},
          h('h2', { text: '代码练习轨道' }),
          h('p', { text: '同一道代码题在任一语言轨道通过，即计入课程掌握。两条轨道都做一遍，能把语言差异变成真正的理解。' }))),
      h('div', { class: 'panel' },
        h('div', { class: 'panel__body' },
          h('div', { class: 'bar-list' },
            lane('Node.js 轨道', nodeDone, 'var(--teal)'),
            lane('Python 轨道', pythonDone, 'var(--blue)'))))));
  }

  const stageSection = h('section', { class: 'section' },
    h('div', { class: 'section__head' },
      h('div', {},
        h('h2', { text: '各阶段掌握度' }),
        h('p', { text: '按「该阶段内已答对的题目数 / 总题目数」计算，反映真实的理解程度而不只是勾选。' }))),
    h('div', { class: 'panel' },
      h('div', { class: 'panel__body' },
        h('div', { class: 'bar-list' }, curriculum.map((stage) => {
          const ids = [...new Set(stage.lessons.flatMap((lesson) => (
            [...lesson.checks, ...lesson.exercises].map((q) => q.id)
          )))];
          const total = ids.length;
          const right = ids.filter((id) => answeredMap.get(id)?.solved).length;
          const percent = total ? Math.round((right / total) * 100) : 0;
          return h('div', { class: 'bar-row' },
            h('a', { class: 'bar-row__label', href: `#/stage/${stage.id}`, text: stage.appendix ? stage.title : `${stageLabel(stage)} · ${stage.title}` }),
            h('div', { class: 'bar-row__track' }, h('i', { style: `width:${percent}%` })),
            h('span', { class: 'bar-row__val', text: `${right}/${total}` }));
        })))));
  page.appendChild(stageSection);

  const wrongSection = h('section', { class: 'section' },
    h('div', { class: 'section__head' },
      h('div', {},
        h('h2', { text: '待攻克题目' }),
        h('p', { text: '这些题你还没有答对。点进去重做一遍，比从头再看一遍有效得多。' }))),
    h('div', { class: 'panel' },
      h('div', { class: 'panel__body' },
        wrongList.length
          ? h('div', { class: 'list-stack' }, wrongList.map(({ task, lesson, stage }) => h('a', {
            class: 'lesson-row',
            href: `#/lesson/${lesson.id}`,
          },
          h('span', { class: 'lesson-row__num', text: stage.appendix ? 'A' : String(stage.index) }),
          h('div', {},
            h('div', { class: 'lesson-row__title', text: taskLabel(task) }),
            h('div', { class: 'lesson-row__sub', text: task.kind === 'design'
              ? `${lesson.title} · 自检清单未完成`
              : `${lesson.title} · 已尝试 ${answeredMap.get(task.id)?.attempts || 0} 次` })),
          h('span', { class: 'badge badge--rose', text: '重做' }))))
          : h('div', { class: 'empty-state', text: '目前没有待攻克的题目——要么你还没开始，要么你已经全部答对了。' }))));
  page.appendChild(wrongSection);

  const projectSection = h('section', { class: 'section' },
    h('div', { class: 'section__head' },
      h('div', {},
        h('h2', { text: '项目进度' }),
        h('p', { text: '每个阶段的实战项目。项目的完成度比课程勾选更能说明你能不能真的交付。' }))),
    h('div', { class: 'list-stack' }, projectEntries.map((project) => {
      const total = project.milestones.length;
      const done = project.milestones.filter((milestone) => store.milestoneDone(project.id, milestone.id)).length;
      const percent = total ? Math.round((done / total) * 100) : 0;
      return h('a', {
        class: 'panel',
        href: `#/project/${project.id}`,
        style: 'display:block;padding:16px 18px;text-decoration:none;color:inherit',
      },
      h('div', { style: 'display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap' },
        h('strong', { style: 'font-size:14.5px', text: project.title }),
        h('span', { class: `badge ${percent === 100 ? 'badge--teal' : 'badge--muted'}`, text: `${done}/${total}` })),
      h('div', { class: 'stage-card__bar', style: 'margin-top:10px' }, h('i', { style: `width:${percent}%` })));
    })));
  page.appendChild(projectSection);

  const nextUp = allLessons.filter((lesson) => !isLessonMastered(lesson)).slice(0, 3);
  if (nextUp.length) {
    page.appendChild(h('section', { class: 'section' },
      h('div', { class: 'panel' },
        h('div', { class: 'panel__head' }, h('h3', { text: '接下来学什么' })),
        h('div', { class: 'panel__body', style: 'display:flex;gap:10px;flex-wrap:wrap' },
          nextUp.map((lesson) => h('a', { class: 'btn btn--ghost btn--sm', href: `#/lesson/${lesson.id}`, text: lesson.title }))))));
  }

  return page;
}
