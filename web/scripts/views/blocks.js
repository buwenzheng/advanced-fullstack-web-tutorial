import { h, codeBlock } from '../ui.js';
import { lang, languageLabel } from '../lang.js';

function callout(variant, icon, title, bodyHtml) {
  return h('div', { class: `callout callout--${variant}` },
    h('div', { class: 'callout__icon', text: icon }),
    h('div', {},
      title ? h('div', { class: 'callout__title', text: title }) : null,
      h('div', { html: bodyHtml })));
}

function renderCode(block) {
  if (!block.python) return codeBlock(block);

  const variants = [
    { id: 'javascript', code: block.code, lang: block.lang || 'javascript' },
    { id: 'python', code: block.python, lang: 'python', note: block.pythonNote },
  ];
  const panes = new Map(variants.map((variant) => [variant.id, codeBlock({
    ...block,
    code: variant.code,
    lang: variant.lang,
    note: variant.note ?? block.note,
  })]));
  const buttons = [];

  function show(id) {
    buttons.forEach((entry) => {
      const active = entry.id === id;
      entry.button.classList.toggle('is-active', active);
      entry.button.setAttribute('aria-selected', String(active));
      panes.get(entry.id).hidden = !active;
    });
  }

  const tabs = h('div', { class: 'code-tabs', role: 'tablist', 'aria-label': '语言实现' },
    variants.map((variant) => {
      const button = h('button', {
        class: 'code-tab',
        type: 'button',
        role: 'tab',
        onclick: () => show(variant.id),
      },
      h('span', { class: `code-tab__dot code-tab__dot--${variant.id}` }),
      languageLabel(variant.id));
      buttons.push({ id: variant.id, button });
      return button;
    }));

  show(block.python && lang.get() === 'python' ? 'python' : 'javascript');

  return h('div', { class: 'code-tracks' },
    h('div', { class: 'code-tracks__head' },
      tabs,
      h('span', { class: 'tiny muted', text: '同一概念的两种实现' })),
    variants.map((variant) => panes.get(variant.id)));
}

export function renderBlock(block) {
  switch (block.type) {
    case 'text':
      return h('section', { class: 'lblock' },
        block.title ? h('h3', { class: 'lblock__title', text: block.title }) : null,
        h('div', { html: block.html }));

    case 'analogy':
      return h('section', { class: 'lblock' },
        callout('analogy', '⇄', block.title || '前端类比', block.html));

    case 'pitfall':
      return h('section', { class: 'lblock' },
        callout('pitfall', '!', block.title || '常见坑', block.html));

    case 'note':
      return h('section', { class: 'lblock' },
        callout('note', 'i', block.title || '补充', block.html));

    case 'tip':
      return h('section', { class: 'lblock' },
        callout('tip', '✓', block.title || '实践建议', block.html));

    case 'list':
      return h('section', { class: 'lblock' },
        block.title ? h('h3', { class: 'lblock__title', text: block.title }) : null,
        h(block.ordered ? 'ol' : 'ul', {}, block.items.map((item) => h('li', { html: item }))));

    case 'steps':
      return h('section', { class: 'lblock' },
        block.title ? h('h3', { class: 'lblock__title', text: block.title }) : null,
        h('div', { class: 'steps', role: 'list' }, block.steps.map((step, index) => h('div', { class: 'steps__item', role: 'listitem' },
          h('span', { class: 'steps__idx', text: String(index + 1).padStart(2, '0') }),
          h('div', { class: 'steps__body' },
            h('div', { class: 'steps__name', text: step.title }),
            h('div', { class: 'steps__text', html: step.html }),
            step.code ? h('pre', { class: 'steps__code', text: step.code }) : null,
            step.note ? h('div', { class: 'steps__note', html: step.note }) : null)))));

    case 'code':
      return h('section', { class: 'lblock' },
        block.title ? h('h3', { class: 'lblock__title', text: block.title }) : null,
        renderCode(block));

    case 'table':
      return h('section', { class: 'lblock' },
        block.title ? h('h3', { class: 'lblock__title', text: block.title }) : null,
        h('div', { class: 'tbl-wrap' },
          h('table', { class: 'tbl' },
            h('thead', {}, h('tr', {}, block.head.map((cell) => h('th', { text: cell })))),
            h('tbody', {}, block.rows.map((row) => h('tr', {}, row.map((cell) => h('td', { html: cell }))))))));

    case 'compare':
      return h('section', { class: 'lblock' },
        block.title ? h('h3', { class: 'lblock__title', text: block.title }) : null,
        h('div', { class: 'compare' }, block.cols.map((col) => h('div', { class: 'compare__col' },
          h('h4', { text: col.title }),
          h('ul', {}, col.items.map((item) => h('li', { html: item })))))));

    case 'flow': {
      const wrap = h('div', { class: 'flow' });
      block.steps.forEach((step, index) => {
        const node = h('button', { class: 'flow__step', type: 'button' },
          h('span', { class: 'flow__idx', text: String(index + 1) }),
          h('span', {},
            h('span', { class: 'flow__name', text: step.name }),
            h('span', { class: 'flow__detail', html: step.detail })),
          h('span', { class: 'tiny muted', text: '点击展开' }));
        const detail = h('div', { class: 'flow__detail', style: 'display:none;margin-top:8px;color:var(--text-dim)', html: step.body || '' });
        node.addEventListener('click', () => {
          const open = node.classList.toggle('is-open');
          detail.style.display = open ? 'block' : 'none';
          node.querySelector('.tiny').textContent = open ? '收起' : '点击展开';
        });
        wrap.appendChild(h('div', {}, node, detail));
      });
      return h('section', { class: 'lblock' },
        block.title ? h('h3', { class: 'lblock__title', text: block.title }) : null,
        wrap);
    }

    case 'case': {
      const rows = [
        ['context', '背景'],
        ['symptom', '现象'],
        ['cause', '根因'],
        ['fix', '止损与修复'],
        ['prevention', '预防'],
      ].filter(([field]) => block[field]);
      return h('section', { class: 'lblock' },
        h('div', { class: 'case' },
          h('div', { class: 'case__head' },
            h('span', { class: 'case__tag', text: '案例复盘' }),
            h('h3', { class: 'case__title', text: block.title })),
          rows.map(([field, label]) => h('div', { class: `case__row case__row--${field}` },
            h('span', { class: 'case__label', text: label }),
            h('div', { class: 'case__body', html: block[field] }))),
          block.metric ? h('div', { class: 'case__metric' },
            h('span', { class: 'case__label', text: '指标变化' }),
            h('span', { html: block.metric })) : null));
    }

    default:
      return h('section', { class: 'lblock' }, h('p', { text: `未知内容块：${block.type}` }));
  }
}
