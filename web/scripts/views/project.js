import { h, toast } from '../ui.js';
import { store } from '../store.js';
import { findProject } from '../content/index';

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    area.remove();
    return ok;
  }
}

function renderTemplate(template) {
  const copyButton = h('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: '复制模板' });
  copyButton.addEventListener('click', async () => {
    const copied = await copyText(template.body);
    copyButton.textContent = copied ? '已复制' : '复制失败';
    if (copied) toast(`已复制：${template.title}`);
    setTimeout(() => { copyButton.textContent = '复制模板'; }, 1600);
  });
  return h('article', { class: 'template-card' },
    h('div', { class: 'template-card__head' },
      h('h4', { text: template.title }),
      copyButton),
    h('p', { class: 'template-card__purpose', text: template.purpose }),
    h('p', { class: 'template-card__when', text: `使用时机：${template.when}` }),
    h('pre', { class: 'template-card__body' }, h('code', { text: template.body })));
}

export function renderProject(projectId) {
  const page = h('div', { class: 'page' });
  const project = findProject(projectId);
  if (!project) {
    page.appendChild(h('div', { class: 'empty-state', text: '找不到这个项目。' }));
    return page;
  }

  const doneCount = project.milestones.filter((item) => store.milestoneDone(project.id, item.id)).length;

  page.appendChild(h('section', { class: 'project-hero' },
    h('span', { class: 'eyebrow', text: project.stageLabel || '阶段项目' }),
    h('h1', { style: 'margin-top:8px', text: project.title }),
    h('p', { text: project.brief }),
    h('div', { style: 'margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center' },
      h('span', { class: 'badge badge--amber', text: `里程碑进度 ${doneCount}/${project.milestones.length}` }),
      ...(project.stack || []).map((item) => h('span', { class: 'badge badge--muted', text: item })))));

  const split = h('div', { class: 'split', style: 'margin-top:28px' });
  const left = h('div', { class: 'list-stack' });
  const right = h('aside', { class: 'list-stack' });

  if (project.goal) {
    left.appendChild(h('div', { class: 'aside-card' },
      h('h3', { text: '你要交付什么' }),
      h('p', { html: project.goal })));
  }

  if (project.steps?.length) {
    left.appendChild(h('div', { class: 'aside-card' },
      h('h3', { text: '实施路线' }),
      h('ul', {}, project.steps.map((step) => h('li', { html: step })))));
  }

  const milestoneSection = h('div', { class: 'panel' },
    h('div', { class: 'panel__head' },
      h('h3', { text: '里程碑清单' }),
      h('span', { class: 'tiny muted', text: '做完一项就勾上，进度保存在本机' })),
    h('div', { class: 'panel__body' },
      h('ul', { class: 'milestone-list' }, project.milestones.map((milestone) => {
        const done = store.milestoneDone(project.id, milestone.id);
        const box = h('button', {
          class: 'milestone__box',
          type: 'button',
          'aria-label': `标记 ${milestone.title} 完成`,
          html: '<svg viewBox="0 0 20 20"><path d="M4 10.5l4 4 8-9"/></svg>',
        });
        const detail = h('div', {},
          h('div', { class: 'milestone__title', text: milestone.title }),
          h('div', { class: 'milestone__desc', html: milestone.desc }),
          milestone.delivery ? h('div', { class: 'milestone__line' },
            h('b', { text: '交付：' }),
            h('span', { html: milestone.delivery })) : null,
          milestone.acceptance?.length ? h('div', { class: 'milestone__block' },
            h('b', { class: 'milestone__label', text: '可观察验收' }),
            h('ul', { class: 'milestone__checks' },
              milestone.acceptance.map((entry) => h('li', { html: entry })))) : null,
          milestone.evidence?.length ? h('div', { class: 'milestone__block' },
            h('b', { class: 'milestone__label', text: '证据' }),
            h('div', { class: 'milestone__chips' },
              milestone.evidence.map((entry) => h('span', { text: entry })))) : null,
          (milestone.reuse?.length || milestone.related?.length) ? h('div', { class: 'milestone__meta' },
            milestone.reuse?.length ? h('span', { class: 'milestone__links' },
              h('b', { text: '复用：' }),
              ...milestone.reuse.map((id, index) => h('span', {},
                index ? ' / ' : '',
                h('a', { href: `#/project/${id}`, text: id })))) : null,
            milestone.related?.length ? h('span', { class: 'milestone__links' },
              h('b', { text: '关联：' }),
              ...milestone.related.map((entry, index) => h('span', {},
                index ? ' / ' : '',
                h('span', { html: entry })))) : null) : null,
          milestone.criteria ? h('div', { class: 'milestone__crit', html: `一句话验收：${milestone.criteria}` }) : null);
        if (project.id === 'p-graduation') {
          const milestoneNote = h('textarea', {
            class: 'milestone__note',
            placeholder: '记录这个里程碑的证据位置、缺口与下一步……',
          });
          milestoneNote.value = store.milestoneNote(project.id, milestone.id);
          milestoneNote.addEventListener('input', () => store.setMilestoneNote(project.id, milestone.id, milestoneNote.value));
          detail.appendChild(milestoneNote);
        }
        const item = h('li', { class: `milestone${done ? ' is-done' : ''}` }, box, detail);
        box.addEventListener('click', () => {
          const nextValue = store.toggleMilestone(project.id, milestone.id);
          item.classList.toggle('is-done', nextValue);
          const badge = page.querySelector('.badge--amber');
          if (badge) {
            const total = project.milestones.length;
            const count = project.milestones.filter((entry) => store.milestoneDone(project.id, entry.id)).length;
            badge.textContent = `里程碑进度 ${count}/${total}`;
          }
        });
        return item;
      }))));
  left.appendChild(milestoneSection);

  if (project.deliverables?.length) {
    right.appendChild(h('div', { class: 'aside-card' },
      h('h3', { text: '交付物' }),
      h('ul', {}, project.deliverables.map((item) => h('li', { html: item })))));
  }

  if (project.checklist?.length) {
    const box = h('div', { class: 'aside-card' },
      h('h3', { text: '验收自评' }),
      h('ul', {}, project.checklist.map((item) => h('li', { html: item }))));
    right.appendChild(box);
  }

  if (project.stretch?.length) {
    right.appendChild(h('div', { class: 'aside-card' },
      h('h3', { text: '进阶挑战（选做）' }),
      h('ul', {}, project.stretch.map((item) => h('li', { html: item })))));
  }

  const note = h('textarea', {
    placeholder: '记录你的设计决策、踩过的坑、待解决的问题……',
    style: 'width:100%;min-height:170px;padding:13px 15px;background:var(--ink-900);border:1px solid var(--line);border-radius:10px;font-size:13.5px;line-height:1.8;resize:vertical;outline:none',
    oninput: (event) => store.setProjectNote(project.id, event.target.value),
  });
  note.value = store.projectNote(project.id);
  right.appendChild(h('div', { class: 'aside-card' },
    h('h3', { text: '项目笔记' }),
    note));

  split.appendChild(left);
  split.appendChild(right);
  page.appendChild(split);

  if (project.templates?.length) {
    page.appendChild(h('section', { class: 'panel', style: 'margin-top:28px' },
      h('div', { class: 'panel__head' },
        h('h3', { text: '答辩模板库' }),
        h('span', { class: 'tiny muted', text: `${project.templates.length} 份模板；复制到 docs/ 后逐项填写` })),
      h('div', { class: 'panel__body' },
        h('div', { class: 'template-grid' },
          project.templates.map((template) => renderTemplate(template))))));
  }

  return page;
}
