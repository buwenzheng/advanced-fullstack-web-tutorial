import { h, clear, toast } from './ui.js';
import { store } from './store.js';
import { lang, LANGUAGES } from './lang.js';
import { curriculum, allLessons, lessonById, stageById, stageLabel, graduationProject } from './content/index.js';
import { isLessonMastered, courseMastery, stageMastery } from './progress.js';
import { renderOverview } from './views/overview.js';
import { renderStage } from './views/stage.js';
import { renderLesson } from './views/lesson.js';
import { renderProject } from './views/project.js';
import { renderLab } from './views/lab.js';
import { renderReport } from './views/report.js';

const main = document.getElementById('main');
const sidebar = document.getElementById('sidebar');
const sidebarNav = document.getElementById('sidebar-nav');
const scrim = document.getElementById('scrim');
const menuToggle = document.getElementById('menu-toggle');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const langSwitch = document.getElementById('lang-switch');

const state = { route: { name: 'overview', param: null } };

function parseHash() {
  const raw = (location.hash || '#/').replace(/^#\/?/, '');
  const [name = '', param = ''] = raw.split('/');
  const known = ['overview', 'stage', 'lesson', 'project', 'lab', 'report'];
  if (!known.includes(name)) return { name: 'overview', param: null };
  return { name, param: param ? decodeURIComponent(param) : null };
}

let disposeView = null;

function navigate() {
  state.route = parseHash();
  render();
  window.scrollTo(0, 0);
}

/* ---------------- 侧边栏 ---------------- */
function buildSidebar() {
  clear(sidebarNav);

  sidebarNav.appendChild(h('div', { class: 'rail-head' },
    h('h2', { text: '学习路径' }),
    h('span', { id: 'rail-count', text: '' })));

  curriculum.forEach((stage) => {
    const stageLessons = stage.lessons;
    const doneCount = stageLessons.filter((lesson) => store.lessonDone(lesson.id)).length;
    const node = h('div', { class: 'stage-node', 'data-stage': stage.id });
    const head = h('button', {
      class: 'stage-node__head',
      type: 'button',
      'aria-expanded': 'false',
      onclick: () => {
        const open = node.classList.toggle('is-open');
        head.setAttribute('aria-expanded', String(open));
      },
    },
    h('span', { class: 'stage-node__pip', text: stage.appendix ? 'A' : String(stage.index) }),
    h('span', { class: 'stage-node__title', text: stage.title }),
    h('span', { class: 'badge badge--muted tiny', text: `${doneCount}/${stageLessons.length}` }),
    h('svg', { class: 'stage-node__chevron', viewBox: '0 0 20 20', html: '<path d="M8 5l6 5-6 5"/>' }));

    const bar = h('div', { class: 'stage-node__bar' }, h('i', { style: `width:${stageLessons.length ? (doneCount / stageLessons.length) * 100 : 0}%` }));

    const list = h('ul', { class: 'stage-node__lessons' });
    stageLessons.forEach((lesson) => {
      const link = h('a', {
        class: `lesson-link${isLessonMastered(lesson) ? ' is-done' : ''}`,
        href: `#/lesson/${lesson.id}`,
        'data-lesson': lesson.id,
      },
      h('span', { class: 'lesson-link__mark', html: '<svg viewBox="0 0 20 20"><path d="M4 10.5l4 4 8-9"/></svg>' }),
      h('span', { text: lesson.title }),
      lesson.status !== 'ready' ? h('span', { class: 'badge badge--muted tiny', text: '草稿' }) : null);
      list.appendChild(h('li', {}, link));
    });

    node.appendChild(head);
    node.appendChild(bar);
    node.appendChild(list);
    sidebarNav.appendChild(node);
  });

  sidebarNav.appendChild(h('div', { class: 'rail-section' },
    h('a', { class: 'rail-link', href: '#/lab', 'data-rail': 'lab' },
      h('svg', { viewBox: '0 0 20 20', html: '<path d="M4 15l3.5-4.5L10 13l5.5-7"/><circle cx="4" cy="15" r="1"/><circle cx="15.5" cy="6" r="1"/>' }),
      h('span', { text: 'HTTP 实验室' })),
    h('a', { class: 'rail-link', href: '#/report', 'data-rail': 'report' },
      h('svg', { viewBox: '0 0 20 20', html: '<path d="M4 16V9M8 16V5M12 16v-4M16 16V7"/>' }),
      h('span', { text: '学习报告' })),
    h('a', { class: 'rail-link', href: `#/project/${graduationProject.id}`, 'data-rail': 'graduation' },
      h('svg', { viewBox: '0 0 20 20', html: '<path d="M10 3l7 4v6l-7 4-7-4V7z"/><path d="M10 17v-6"/>' }),
      h('span', { text: '毕业项目' }))));

  updateSidebarState();
}

function updateSidebarState() {
  const { total, done, percent } = courseMastery();
  const count = document.getElementById('rail-count');
  if (count) count.textContent = `${done}/${total}`;

  document.querySelectorAll('.stage-node').forEach((node) => {
    const stage = stageById(node.dataset.stage);
    if (!stage) return;
    const mastery = stageMastery(stage);
    const badge = node.querySelector('.badge');
    if (badge) badge.textContent = `${mastery.done}/${mastery.total}`;
    const bar = node.querySelector('.stage-node__bar i');
    if (bar) bar.style.width = `${mastery.percent}%`;
    node.classList.toggle('is-done', mastery.done === mastery.total && mastery.total > 0);
    node.querySelectorAll('.lesson-link').forEach((link) => {
      const lesson = lessonById(link.dataset.lesson);
      link.classList.toggle('is-done', Boolean(lesson) && isLessonMastered(lesson));
    });
  });

  const ring = document.getElementById('progress-ring');
  const label = document.getElementById('progress-label');
  if (ring) ring.style.strokeDashoffset = String(97.4 * (1 - percent / 100));
  if (label) label.textContent = `${percent}%`;
}

function highlightNav(route) {
  document.querySelectorAll('.stage-node').forEach((node) => {
    const stage = stageById(node.dataset.stage);
    const active = route.name === 'stage' ? stage?.id === route.param
      : route.name === 'lesson' ? stage?.lessons.some((lesson) => lesson.id === route.param)
        : false;
    node.classList.toggle('is-active', Boolean(active));
    if (active) node.classList.add('is-open');
    node.querySelectorAll('.lesson-link').forEach((link) => {
      link.classList.toggle('is-current', route.name === 'lesson' && link.dataset.lesson === route.param);
    });
  });
  document.querySelectorAll('.rail-link').forEach((link) => {
    link.classList.toggle('is-current', link.dataset.rail === route.name);
  });
}

/* ---------------- 视图渲染 ---------------- */
function render() {
  const { name, param } = state.route;
  if (typeof disposeView === 'function') {
    disposeView();
    disposeView = null;
  }
  clear(main);
  let node;
  switch (name) {
    case 'stage':
      node = renderStage(param);
      break;
    case 'lesson':
      node = renderLesson(param);
      break;
    case 'project':
      node = renderProject(param);
      break;
    case 'lab':
      node = renderLab();
      break;
    case 'report':
      node = renderReport();
      break;
    default:
      node = renderOverview();
  }
  main.appendChild(node);
  disposeView = typeof node.__dispose === 'function' ? node.__dispose : null;
  highlightNav(state.route);
  updateSidebarState();
  closeDrawer();
}

/* ---------------- 搜索 ---------------- */
function blockText(block) {
  const parts = [block.title, block.html, block.text, block.note, block.code];
  if (block.items) parts.push(...block.items);
  if (block.head) parts.push(...block.head);
  if (block.rows) block.rows.forEach((row) => parts.push(...row));
  if (block.steps) {
    block.steps.forEach((step) => parts.push(step.name, step.title, step.detail, step.body, step.html));
  }
  if (block.cols) {
    block.cols.forEach((col) => parts.push(col.title, ...col.items));
  }
  if (block.type === 'case') {
    parts.push(block.context, block.symptom, block.cause, block.fix, block.prevention, block.metric);
  }
  return parts.filter(Boolean).join(' ');
}

const lessonHaystacks = new Map();

function lessonHaystack(lesson) {
  if (!lessonHaystacks.has(lesson.id)) {
    const parts = [lesson.title, lesson.subtitle, ...(lesson.keywords || [])];
    lesson.blocks.forEach((block) => parts.push(blockText(block)));
    lesson.checks.forEach((check) => parts.push(check.prompt || check.question, check.explain, ...check.options.map((option) => option.text)));
    lesson.exercises.forEach((exercise) => parts.push(exercise.title, exercise.brief, exercise.prompt));
    lessonHaystacks.set(lesson.id, parts.filter(Boolean).join(' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase());
  }
  return lessonHaystacks.get(lesson.id);
}

function searchAll(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits = [];
  curriculum.forEach((stage) => {
    if (stage.title.toLowerCase().includes(q) || (stage.keywords || []).some((k) => k.toLowerCase().includes(q))) {
      hits.push({ type: 'stage', title: stage.title, sub: `${stageLabel(stage)} · ${stage.subtitle}`, href: `#/stage/${stage.id}` });
    }
    stage.lessons.forEach((lesson) => {
      if (lessonHaystack(lesson).includes(q)) {
        hits.push({ type: 'lesson', title: lesson.title, sub: `${stageLabel(stage)} · ${lesson.subtitle || ''}`, href: `#/lesson/${lesson.id}` });
      }
    });
    if (stage.project && `${stage.project.title} ${stage.project.brief}`.toLowerCase().includes(q)) {
      hits.push({ type: 'project', title: stage.project.title, sub: '阶段项目', href: `#/project/${stage.project.id}` });
    }
  });
  if (`${graduationProject.title} ${graduationProject.brief} ${(graduationProject.stack || []).join(' ')}`.toLowerCase().includes(q)) {
    hits.push({ type: 'project', title: graduationProject.title, sub: '毕业项目', href: `#/project/${graduationProject.id}` });
  }
  return hits.slice(0, 12);
}

let searchActive = -1;

function searchHits() {
  return [...searchResults.querySelectorAll('.search-hit')];
}

function setSearchActive(index) {
  const hits = searchHits();
  if (!hits.length) return;
  searchActive = (index + hits.length) % hits.length;
  hits.forEach((hit, position) => hit.classList.toggle('is-active', position === searchActive));
  hits[searchActive].scrollIntoView({ block: 'nearest' });
}

function renderSearchResults(query) {
  const hits = searchAll(query);
  searchActive = -1;
  clear(searchResults);
  if (!query.trim()) {
    searchResults.hidden = true;
    searchInput.setAttribute('aria-expanded', 'false');
    return;
  }
  if (!hits.length) {
    searchResults.appendChild(h('div', { class: 'search-empty', text: '没有匹配的课程内容' }));
  } else {
    hits.forEach((hit) => {
      searchResults.appendChild(h('a', {
        class: 'search-hit',
        href: hit.href,
        onclick: () => {
          searchResults.hidden = true;
          searchInput.setAttribute('aria-expanded', 'false');
          searchInput.value = '';
          searchActive = -1;
        },
      },
      h('strong', { text: hit.title }),
      h('span', { text: hit.sub })));
    });
  }
  searchResults.hidden = false;
  searchInput.setAttribute('aria-expanded', 'true');
}

/* ---------------- 语言轨道 ---------------- */
function buildLangSwitch() {
  if (!langSwitch) return;
  clear(langSwitch);
  LANGUAGES.forEach((item) => {
    langSwitch.appendChild(h('button', {
      type: 'button',
      'data-lang': item.id,
      title: `切换到 ${item.label} 轨道`,
    }, item.short));
  });
}

function syncLangSwitch() {
  if (!langSwitch) return;
  langSwitch.querySelectorAll('button[data-lang]').forEach((button) => {
    const active = button.dataset.lang === lang.get();
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

/* ---------------- 抽屉 ---------------- */
function openDrawer() {
  sidebar.classList.add('is-open');
  scrim.hidden = false;
  menuToggle.setAttribute('aria-expanded', 'true');
}
function closeDrawer() {
  sidebar.classList.remove('is-open');
  scrim.hidden = true;
  menuToggle.setAttribute('aria-expanded', 'false');
}

/* ---------------- 启动 ---------------- */
function init() {
  buildSidebar();
  buildLangSwitch();
  syncLangSwitch();
  if (langSwitch) {
    langSwitch.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-lang]');
      if (!button) return;
      const next = button.dataset.lang;
      if (next === lang.get()) return;
      const offset = window.scrollY;
      lang.set(next);
      window.scrollTo(0, offset);
    });
  }
  lang.subscribe(() => {
    syncLangSwitch();
    const offset = window.scrollY;
    render();
    window.scrollTo(0, offset);
  });
  menuToggle.addEventListener('click', () => {
    if (sidebar.classList.contains('is-open')) closeDrawer(); else openDrawer();
  });
  scrim.addEventListener('click', closeDrawer);
  document.querySelector('.skip-link')?.addEventListener('click', (event) => {
    event.preventDefault();
    main.focus();
    main.scrollIntoView({ block: 'start' });
  });
  document.getElementById('reset-progress').addEventListener('click', () => {
    if (!window.confirm('确定要清空全部学习记录吗？此操作不可撤销。')) return;
    store.reset();
    localStorage.removeItem('bff-lab-drafts-v1');
    buildSidebar();
    render();
    toast('学习记录已清空');
  });

  searchInput.addEventListener('input', (event) => renderSearchResults(event.target.value));
  searchInput.addEventListener('focus', () => { if (searchInput.value) renderSearchResults(searchInput.value); });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.topbar__search')) {
      searchResults.hidden = true;
      searchInput.setAttribute('aria-expanded', 'false');
    }
  });
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setSearchActive(searchActive + 1); return; }
    if (event.key === 'ArrowUp') { event.preventDefault(); setSearchActive(searchActive - 1); return; }
    if (event.key === 'Enter') {
      const hits = searchHits();
      const target = hits[searchActive] || hits[0];
      if (target) {
        event.preventDefault();
        target.click();
        searchInput.blur();
      }
      return;
    }
    if (event.key === 'Escape') {
      searchResults.hidden = true;
      searchInput.setAttribute('aria-expanded', 'false');
      searchInput.blur();
    }
  });

  store.subscribe(() => {
    updateSidebarState();
  });

  window.addEventListener('hashchange', navigate);
  navigate();
}

init();
